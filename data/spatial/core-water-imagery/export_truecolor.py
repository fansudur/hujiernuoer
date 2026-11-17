from pathlib import Path
ROOT = Path(__file__).resolve().parent
import os,json,math,hashlib,shutil
import numpy as np,rasterio
from rasterio.windows import from_bounds,Window
from rasterio.warp import transform_bounds,reproject,Resampling
from rasterio.transform import from_bounds as grid_bounds
from rasterio.enums import ColorInterp
from pyproj import Transformer
from PIL import Image
os.environ.update(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',GDAL_HTTP_TIMEOUT='60',CURL_CA_BUNDLE=os.environ.get('SSL_CERT_FILE', '/etc/ssl/certs/ca-certificates.crt'),GDAL_HTTP_PROXY=os.environ.get('HTTPS_PROXY',''))
b=(119.61,49.105,119.73,49.175)
out=str(ROOT);os.makedirs(out,exist_ok=True)
quality=json.load(open(str(ROOT / 'sources')+'/quality.json'))
q=sorted([r for r in quality if 'error' not in r],key=lambda r:(-r['scl_clear_fraction'],r['scene_cloud_percent'],r['id']))[0]
features=sum([json.load(open(str(ROOT / 'sources')+'/may'+yr+'.json'))['features'] for yr in ['2025','2026']],[])
scenes=[json.load(open(str(ROOT / 'sources')+'/aug_item.json')),next(f for f in features if f['id']==q['id'])]
manifest={'schema_version':1,'requested_bounds_wgs84':b,'created_utc':'2026-11-17','selection':{'candidate_months':['2025-05','2026-05'],'candidate_count':len(quality),'ranking':'Largest SCL-retained fraction in integer 20m window enclosing ROI; tie-break lower full-scene cloud percentage, then item id. Retained classes 2,4,5,6,7; no claim of ground-verified or absolute optimal quality.','selected_may_item':q['id']},'scenes':[]}
for f in scenes:
 date=f['properties']['datetime'][:10]; print('export',date,flush=True)
 with rasterio.open(f['assets']['visual']['href']) as ds:
  bb=transform_bounds('EPSG:4326',ds.crs,*b,densify_pts=21);w=from_bounds(*bb,ds.transform);w=Window(math.floor(w.col_off),math.floor(w.row_off),math.ceil(w.col_off+w.width)-math.floor(w.col_off),math.ceil(w.row_off+w.height)-math.floor(w.row_off))
  rgb=ds.read(window=w);tr=ds.window_transform(w);crs=ds.crs;h,wd=rgb.shape[1:];assert ds.res==(10,10)
  source_transform=list(ds.transform)[:6];source_shape=[ds.height,ds.width]
 with rasterio.open(f['assets']['scl']['href']) as ds:
  sb=from_bounds(*rasterio.transform.array_bounds(h,wd,tr),ds.transform);sw=Window(math.floor(sb.col_off)-1,math.floor(sb.row_off)-1,math.ceil(sb.width)+3,math.ceil(sb.height)+3)
  a=ds.read(1,window=sw);scl=np.zeros((h,wd),np.uint8)
  reproject(a,scl,src_transform=ds.window_transform(sw),src_crs=ds.crs,dst_transform=tr,dst_crs=crs,resampling=Resampling.nearest)
 x,y=np.meshgrid(tr.c+(np.arange(wd)+.5)*10,tr.f-(np.arange(h)+.5)*10)
 trans=Transformer.from_crs(crs,4326,always_xy=True);lon,lat=trans.transform(x,y)
 inside=(lon>=b[0])&(lon<=b[2])&(lat>=b[1])&(lat<=b[3]);retained=inside&np.all(rgb>0,axis=0)&np.isin(scl,[2,4,5,6,7]);alpha=retained.astype('uint8')*255
 rgba=np.concatenate((rgb,alpha[None]),axis=0)
 stem=date+'_sentinel2_tci';tif=out+'/'+stem+'_native10m.tif'
 with rasterio.open(tif,'w',driver='GTiff',width=wd,height=h,count=4,dtype='uint8',crs=crs,transform=tr,compress='deflate',tiled=True) as dst:
  dst.write(rgba);dst.colorinterp=(ColorInterp.red,ColorInterp.green,ColorInterp.blue,ColorInterp.alpha);dst.update_tags(source_item=f['id'],description='Native 10m TCI RGB retained; alpha masks excluded SCL and outside requested ROI. No RGB resampling or gap fill.')
 # Explicitly distinct north-up geographic display asset. Nearest-neighbour only.
 dw,dh=878,779;dt=grid_bounds(*b,dw,dh);geo=np.zeros((4,dh,dw),np.uint8)
 for i in range(4):reproject(rgba[i],geo[i],src_transform=tr,src_crs=crs,dst_transform=dt,dst_crs='EPSG:4326',resampling=Resampling.nearest)
 geo[:3,:, :][:,geo[3]==0]=0
 png=out+'/'+stem+'_wgs84_nearest.png';Image.fromarray(np.moveaxis(geo,0,2)).save(png)
 corners=[trans.transform(*p) for p in [(tr.c,tr.f),(tr.c+wd*10,tr.f),(tr.c+wd*10,tr.f-h*10),(tr.c,tr.f-h*10)]]
 def asset(path):return {'path':'data/spatial/core-water-imagery/'+os.path.basename(path),'sha256':hashlib.sha256(open(path,'rb').read()).hexdigest(),'bytes':os.path.getsize(path)}
 metadata=out+'/'+stem+'_source-stac.json';json.dump(f,open(metadata,'w'),ensure_ascii=False,indent=2)
 rec={'id':f['id'],'date':date,'datetime':f['properties']['datetime'],'source_collection':'sentinel-2-c1-l2a','source_stac_url':next(l['href'] for l in f['links'] if l['rel']=='self'),'source_assets':{k:f['assets'][k] for k in ['visual','scl']},'source_metadata':asset(metadata),'native':{**asset(tif),'crs':str(crs),'resolution_m':[10,10],'size_px':[wd,h],'affine_transform':list(tr)[:6],'source_window_col_row_width_height':list(w.flatten()),'source_transform':source_transform,'source_shape':source_shape,'corners_wgs84_TL_TR_BR_BL':corners,'bounds_wgs84':transform_bounds(crs,'EPSG:4326',*rasterio.transform.array_bounds(h,wd,tr),densify_pts=21),'rgb_resampled':False},'display':{**asset(png),'crs':'EPSG:4326','bounds_wgs84':b,'corners_wgs84_TL_TR_BR_BL':[[b[0],b[3]],[b[2],b[3]],[b[2],b[1]],[b[0],b[1]]],'size_px':[dw,dh],'affine_transform':list(dt)[:6],'resampling':'nearest','native_grid':False},'quality':{'alpha_rule':'Inside requested WGS84 ROI by native pixel centre AND all TCI channels >0 AND SCL in [2,4,5,6,7]. SCL is 20m categorical data mapped by nearest neighbour; no dilation, gap filling, interpolation or multi-date composite.','valid_native_pixels':int(retained.sum()),'roi_native_pixels':int(inside.sum()),'retained_fraction_roi':float(retained.sum()/inside.sum())},'interpretation_limits':['TCI is provider-rendered true colour, not calibrated reflectance or water classification.','Transparent pixels mean excluded/cloud/shadow/snow/no-data/outside ROI, not dry land.','This single May scene does not reproduce the monthly repeated-water hotspot statistic.','Native UTM grid corners are not an axis-aligned WGS84 rectangle; use transform/CRS for exact placement. WGS84 PNG is a separately labelled nearest-neighbour display derivative.','SCL is automated 20m quality classification; remaining atmospheric artefacts are possible.']}
 manifest['scenes'].append(rec)
json.dump(quality,open(out+'/may-scene-quality.json','w'),ensure_ascii=False,indent=2)
manifest['may_quality_table']={'path':'data/spatial/core-water-imagery/may-scene-quality.json','sha256':hashlib.sha256(open(out+'/may-scene-quality.json','rb').read()).hexdigest()}
json.dump(manifest,open(out+'/manifest.json','w'),ensure_ascii=False,indent=2)
# Script is already next to exported assets.
print('done',q,flush=True)
