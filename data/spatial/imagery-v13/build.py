import os
SITE_ROOT=os.environ.get("LAKE_SITE_DIST", "/workspace/scratch/951b8192a501/lake-interactive-site/dist")
WORKSPACE_ROOT=os.environ.get("LAKE_DATA_WORKSPACE", "/workspace/shared")
from pathlib import Path
import json,hashlib,copy,math
import numpy as np
from osgeo import gdal,osr
gdal.UseExceptions()
ROOT=Path(SITE_ROOT); OUT=ROOT/'data/spatial/imagery-v13';OUT.mkdir(exist_ok=True)
B=json.load(open(ROOT/'data/spatial/terrain_expanded.json'))['bounds']; W,H=1400,1510
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
wgs=osr.SpatialReference();wgs.ImportFromEPSG(4326);wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
def mem(a,projection,gt):
 d=gdal.GetDriverByName('MEM').Create('',a.shape[2],a.shape[1],4,gdal.GDT_Byte);d.SetProjection(projection);d.SetGeoTransform(gt)
 for i in range(4):d.GetRasterBand(i+1).WriteArray(a[i]);d.GetRasterBand(i+1).SetColorInterpretation([gdal.GCI_RedBand,gdal.GCI_GreenBand,gdal.GCI_BlueBand,gdal.GCI_AlphaBand][i])
 return d
def footprint(d):
 s=osr.SpatialReference();s.ImportFromWkt(d.GetProjection());s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);t=osr.CoordinateTransformation(s,wgs);g=d.GetGeoTransform();p=[t.TransformPoint(g[0]+x*g[1],g[3]+y*g[5])[:2]for x,y in[(0,0),(d.RasterXSize,0),(d.RasterXSize,d.RasterYSize),(0,d.RasterYSize)]]
 return [min(x[0]for x in p),min(x[1]for x in p),max(x[0]for x in p),max(x[1]for x in p)],p
checks=[]
def output(src,name):
 d=gdal.Warp('',src,format='MEM',dstSRS='EPSG:4326',outputBounds=B,width=W,height=H,resampleAlg='near',srcAlpha=True,dstAlpha=True,errorThreshold=0);a=d.ReadAsArray();a[:3,a[3]==0]=0
 for i in range(4):d.GetRasterBand(i+1).WriteArray(a[i])
 p=OUT/name;gdal.GetDriverByName('PNG').CreateCopy(str(p),d)
 # independent inverse-center nearest-neighbor comparison at deterministic 4000 pixels per asset
 rng=np.random.default_rng(19013);ys=rng.integers(0,H,4000);xs=rng.integers(0,W,4000);dsts=osr.SpatialReference();dsts.ImportFromWkt(src.GetProjection());dsts.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);tr=osr.CoordinateTransformation(wgs,dsts);xy=np.array(tr.TransformPoints(np.column_stack([B[0]+(xs+.5)*(B[2]-B[0])/W,B[3]-(ys+.5)*(B[3]-B[1])/H])));gt=src.GetGeoTransform();ix=np.floor((xy[:,0]-gt[0])/gt[1]).astype(int);iy=np.floor((xy[:,1]-gt[3])/gt[5]).astype(int);inside=(ix>=0)&(iy>=0)&(ix<src.RasterXSize)&(iy<src.RasterYSize);expect=np.zeros((4,4000),dtype=np.uint8);sa=src.ReadAsArray();expect[:,inside]=sa[:,iy[inside],ix[inside]];expect[:3,expect[3]==0]=0;bad=int(np.any(expect!=a[:,ys,xs],axis=0).sum());assert bad==0,(name,bad)
 checks.append({'file':name,'inverse_center_samples':4000,'rgba_mismatch':bad,'alpha_binary':set(np.unique(a[3]).tolist())<={0,255}})
 return {'path':'data/spatial/imagery-v13/'+name,'bounds':B,'size_px':[W,H],'sha256':sha(p),'opaque_pixels':int((a[3]>0).sum()),'canvas_pixels':W*H,'opaque_fraction':float((a[3]>0).mean()),'crs':'EPSG:4326'}
old=json.load(open(ROOT/'data/spatial/imagery-v11/manifest.json'));features={x['id']:x for x in json.load(open(WORKSPACE_ROOT+'/alkali_annual_water/source_manifest.json'))['features']};records=[]
for rec in old['scenes']:
 r=copy.deepcopy(rec);sid=r['id']; origin={};folder=Path(WORKSPACE_ROOT+'/lake_imagery_v13/full_bands') if Path(WORKSPACE_ROOT+'/lake_imagery_v13/full_bands',sid+'_scl.tif').exists() else Path(WORKSPACE_ROOT+'/alkali_grassland/roi_extended')
 if r['date']=='2026-08-08':
  mf=json.load(open(ROOT/'data/process/context_background_manifest.json'));p=ROOT/'data/satellite'/mf['assets']['geographic']['path'];a=gdal.Open(str(p)).ReadAsArray();b=mf['bounds_wgs84'];src=mem(a,wgs.ExportToWkt(),[b[0],(b[2]-b[0])/a.shape[2],0,b[3],0,-(b[3]-b[1])/a.shape[1]]);origin={'path':str(p),'sha256':sha(p),'qa_rule':mf['qa_rule']};scope='existing_full_context'
 elif r.get('sensor','').startswith('Landsat'):
  p=Path(r['source']['local_path'].replace('/workspace/shared',WORKSPACE_ROOT,1));npz=np.load(p);a=np.moveaxis(np.rint(np.clip(npz['rgb'],0,1)*255).astype('uint8'),2,0);valid=npz['valid'];a=np.concatenate([a,valid[None].astype('uint8')*255]);a[:3,~valid]=0;d=gdal.Open(r['source']['raw_red_georeference_path'].replace('/workspace/shared',WORKSPACE_ROOT,1));src=mem(a,d.GetProjection(),d.GetGeoTransform());origin={'path':str(p),'sha256':sha(p),'qa_rule':'Existing regional aligned RGB and valid mask retained unchanged; inspect upstream source for cloud/saturation flags.'};scope='existing_regional_landsat'
 else:
  f=features[sid];bands=[];valid=None;hashes={};meta={}
  for k in ['red','green','blue']:
   p=folder/(sid+'_'+k+'.tif');p=p if p.exists() else Path(WORKSPACE_ROOT+'/lake_imagery_v13/new_bands')/p.name;d=gdal.Open(str(p));raw=d.ReadAsArray();m=f['assets'][k]['raster:bands'][0];off=m.get('offset',0)
   if f['collection']=='sentinel-2-l2a' and f['properties'].get('earthsearch:boa_offset_applied') is True:off=0
   valid=(raw>0)if valid is None else valid&(raw>0);bands.append(np.rint(np.clip((raw*m.get('scale',.0001)+off)/.3,0,1)**(1/1.6)*255).astype('uint8'));hashes[k]=sha(p);meta[k]={'scale':m.get('scale',.0001),'offset_used':off,'href':f['assets'][k]['href']}
  p=folder/(sid+'_scl.tif');scl=gdal.Open(str(p)).ReadAsArray();valid&=scl!=0;hashes['scl']=sha(p);a=np.stack(bands+[valid.astype('uint8')*255]);a[:3,~valid]=0;src=mem(a,d.GetProjection(),d.GetGeoTransform());origin={'directory':str(folder),'additional_band_directory':WORKSPACE_ROOT+'/lake_imagery_v13/new_bands','source_id':sid,'band_sha256':hashes,'band_radiometry':meta,'qa_rule':'Display only: all RGB DN>0 and SCL!=0. Clouds/shadow/snow visible, not silently removed. This mask is NOT NDVI analysis quality selection.','display_transform':'clip(reflectance/0.3,0,1)^(1/1.6)','native_display_pixel_m':20};scope='full_context' if 'full_bands' in str(folder) else 'extended_office_grass_crop'
 quality_by_id={x['id']:x for x in json.load(open(WORKSPACE_ROOT+'/lake_imagery_v13/source_checks.json'))['full_dates_overlap_and_cloud_quality']};origin['display_quality']=quality_by_id.get(sid);fb,fp=footprint(src);origin['bounds']=fb;origin['footprint_polygon_wgs84']=fp+[fp[0]];asset=output(src,r['date']+('_landsat'if r.get('sensor','').startswith('Landsat')else'_sentinel')+'_uniform.png');r['assets']={'geographic':asset};r['bounds_wgs84']=B;r['coordinates']=[[B[0],B[3]],[B[2],B[3]],[B[2],B[1]],[B[0],B[1]]];r['uniform_canvas']={'scope':scope,'original_source':origin,'not_full_scene':asset['opaque_fraction']<.999,'transparent_outside_source':True,'native_detail_unchanged':True,'render_path':asset['path'],'opaque_fraction':asset['opaque_fraction'],'notice':'统一地理画布；历史影像只覆盖实际观测区，外部可显示另标日期的参考底图。'};records.append(r);print(r['date'],scope,round(asset['opaque_fraction'],3),flush=True)
# Historic grayscale: retain same date/source and actual original footprint; reproject existing original small asset.
hist=[]
for r in old['history_red_band']:
 d=gdal.Open(str(ROOT/r['src']));a=d.ReadAsArray();b=r['bounds'];src=mem(a,wgs.ExportToWkt(),[b[0],(b[2]-b[0])/a.shape[2],0,b[3],0,-(b[3]-b[1])/a.shape[1]]);asset=output(src,r['date']+'_red_gray_uniform.png');hist.append({**r,'src':asset['path'],'bounds':B,'asset':asset})
manifest={**old,'schema_version':2,'title':'办公院、草地与邻近区域同地理画布真实日期影像','bounds_wgs84':B,'size_px':[W,H],'scenes':records,'history_red_band':hist,'rules':old['rules']+['31期Sentinel采用办公院和草地窗口；2024-07-02、2024-07-30、2025-07-24补取同一原景完整近邻地形范围RGB/SCL；2026-08-08沿用已核验背景。','三期Landsat恢复已有区域RGB覆盖；不补造外部或其他时期。','透明覆盖是显示有效性，不替代NDVI和水面统计的质量筛选。'],'source_manifest_sha256':sha(ROOT/'data/spatial/imagery-v11/manifest.json'),'script_sha256':sha(__file__)}
for sidecar in OUT.glob('*.aux.xml'): sidecar.unlink()
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));(OUT/'checks.json').write_text(json.dumps({'all_pass':all(c['rgba_mismatch']==0 and c['alpha_binary']for c in checks),'checks':checks},indent=2));print('DONE',len(records),len(hist))
