"""Reproduce the historical 30 m DSM catchments; no frontend dependencies."""
from pathlib import Path
import heapq, json, hashlib
import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from scipy import ndimage
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform
from pyproj import Transformer
O=Path(__file__).resolve().parent
with rasterio.open(O/'routing_dsm_30m.tif') as src:
    dem=src.read(1); tr=src.transform; crs=src.crs
h,w=dem.shape
ll=Transformer.from_crs(crs,4326,always_xy=True).transform
utm=Transformer.from_crs(4326,crs,always_xy=True).transform
q=json.loads((O/'historical_sample_water_input.geojson').read_text(encoding='utf-8'))['features']
lake=rasterize([(mapping(transform(utm,unary_union([shape(f['geometry']) for f in q]))),1)],out_shape=(h,w),transform=tr).astype(bool)
D8=[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]
DIST=[30,42.43,30,42.43,30,42.43,30,42.43]
f=dem.copy();done=np.zeros((h,w),bool);pq=[]
edge=np.zeros((h,w),bool);edge[0,:]=edge[-1,:]=edge[:,0]=edge[:,-1]=True
for r,c in zip(*np.where((edge|lake)&np.isfinite(dem))):
    heapq.heappush(pq,(dem[r,c],r,c));done[r,c]=True
while pq:
    e,r,c=heapq.heappop(pq)
    for dr,dc in D8:
        rr,cc=r+dr,c+dc
        if 0<=rr<h and 0<=cc<w and not done[rr,cc] and np.isfinite(dem[rr,cc]):
            done[rr,cc]=True;f[rr,cc]=max(dem[rr,cc],e+1e-4);heapq.heappush(pq,(f[rr,cc],rr,cc))
fp=np.pad(f,1,constant_values=np.inf);best=np.zeros((h,w));fd=np.full((h,w),-1,np.int8)
for i,(dr,dc) in enumerate(D8):
    s=(f-fp[1+dr:1+dr+h,1+dc:1+dc+w])/DIST[i];m=s>best;best[m]=s[m];fd[m]=i
fd[lake]=-1;fd[edge]=-1
entry=np.zeros((h,w),bool)
for i,(dr,dc) in enumerate(D8):
    tgt=np.zeros((h,w),bool);tgt[max(0,-dr):h-max(0,dr),max(0,-dc):w-max(0,dc)]=lake[max(0,dr):h-max(0,-dr) or h,max(0,dc):w-max(0,-dc) or w]
    entry|=(fd==i)&tgt
acc=np.ones((h,w))
for idx in np.argsort(-np.nan_to_num(f,nan=-1e9),axis=None):
    r,c=divmod(idx,w);i=fd[r,c]
    if i>=0:
        dr,dc=D8[i];acc[r+dr,c+dc]+=acc[r,c]
big=entry&(acc*.09>=10)
lab,n=ndimage.label(ndimage.binary_dilation(big,iterations=3,structure=np.ones((3,3))))
lab=np.where(entry&~big,9999,lab);elab=np.where(entry,lab,0);cid=elab.copy()
for idx in np.argsort(np.nan_to_num(f,nan=1e9),axis=None):
    r,c=divmod(idx,w)
    if cid[r,c]==0 and fd[r,c]>=0:
        dr,dc=D8[fd[r,c]];cid[r,c]=cid[r+dr,c+dc]
cid[lake]=0
# Polygonize exact square cell footprints, no smoothing or simplification.
def geom(mask):
    parts=[shape(g) for g,v in shapes(mask.astype('uint8'),mask=mask,transform=tr,connectivity=4) if v==1]
    g=unary_union(parts);assert g.is_valid
    assert abs(g.area-int(mask.sum())*900)<.01
    return mapping(transform(ll,g))
def feature(mask,id,props):
    return dict(type='Feature',id=id,properties=dict(id=id,pixel_count=int(mask.sum()),area_m2=int(mask.sum())*900,area_km2=round(int(mask.sum())*.0009,4),evidence='terrain_model',**props),geometry=geom(mask))
clusters=[]
for i in np.unique(cid[cid>0]):
    rr,cc=np.where(elab==i)
    lon,lat=ll(*tr*(float(cc.mean())+.5,float(rr.mean())+.5))
    label={1:'north_entry',2:'northwest_entry',3:'northeast_entry',4:'west_main_entry',5:'south_central_main_entry',6:'east_secondary_entry',7:'southeast_main_entry',9999:'small_entries_under_10ha'}[int(i)]
    clusters.append(feature(cid==i,'entry_cluster_'+str(i),dict(entry_cluster_id=int(i),label=label,entry_count=len(rr),entry_center_wgs84=[lon,lat])))
collections={'catchment_total.geojson':[feature(cid>0,'historical_sample_union_catchment',dict(excludes_terminal_water=True))],'catchment_entry_clusters.geojson':clusters,'terminal_mask.geojson':[feature(lake,'historical_sample_union_terminal',dict(is_capacity=False))]}
for name,features in collections.items(): (O/name).write_text(json.dumps(dict(type='FeatureCollection',features=features),ensure_ascii=False,separators=(',',':')),encoding='utf-8')
assert int((cid>0).sum())==19200, 'Historical total differs; inspect before delivery'
assert sum(x['properties']['pixel_count'] for x in clusters)==19200
for name,features in collections.items():
    for ft in features: assert shape(ft['geometry']).is_valid
manifest=dict(id='model-catchments-historical-sample-union-v1',created_utc='2026-11-17',crs='EPSG:4326',model_grid=dict(crs=str(crs),transform=list(tr)[:6],shape=[h,w],resolution_m=30),terminal=dict(source='historical_sample_water_input.geojson',selection='class_code == 2 and quality_qualified == true',feature_count=len(q),dates=sorted(set(x['properties']['date'] for x in q)),mask_rule='UTM rasterization at pixel center; union of 25 features from 8 sampled months, NOT 25 months or the full monthly sequence',area_m2=int(lake.sum())*900),algorithm=dict(flow='D8 steepest descent',filling='priority flood with lake pixels and grid edges seeded as sinks, epsilon 0.0001 m',diagonal_distance_m=42.43,entry_threshold_ha=10,clustering='3 iterations of 3x3 binary dilation of major entry pixels, connected-component labeling; small entries pooled as 9999',upstream_propagation='ascending filled elevation',area='pixel count * 900 square metres in EPSG:32650',vectorization='exact pixel footprints, no smoothing'),total_area_km2=round(int((cid>0).sum())*.0009,4),limits=['Terrain partition only; not water volume or flood peak fractions.','Not measured flow directions or proof of culvert connectivity.','DSM includes surface objects; original GLO-30 was bilinearly reprojected to this 30m model grid.','Endpoint is the historical sampled union, not newly complete monthly union; new masks require a separately versioned rerun.','The 90m dilation radius is not a strict 90m pairwise merge-distance: dilated neighborhoods may join farther-spaced entries.','Do not equate entry clusters with Wcross/B/C without a separate spatial relationship check.'],files=[])
for name in ['routing_dsm_30m.tif','historical_sample_water_input.geojson',*collections,'reproduce.py']:
    p=O/name;item=dict(path=name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size)
    if name in collections:item['bounds_wgs84']=list(unary_union([shape(x['geometry']) for x in collections[name]]).bounds)
    manifest['files'].append(item)
manifest['provenance']=json.loads((O/'provenance.json').read_text(encoding='utf-8'))
manifest['files'].append(dict(path='provenance.json',sha256=hashlib.sha256((O/'provenance.json').read_bytes()).hexdigest(),bytes=(O/'provenance.json').stat().st_size))
(O/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'total':manifest['total_area_km2'],'terminal_pixels':int(lake.sum()),'clusters':[(x['properties']['label'],x['properties']['area_km2']) for x in clusters]}))
