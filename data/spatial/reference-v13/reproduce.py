import os
os.environ.update(GDAL_HTTP_TIMEOUT='45',GDAL_HTTP_MAX_RETRY='1',GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif')
from pathlib import Path
import json,math,hashlib,concurrent.futures
import numpy as np
from osgeo import gdal,osr
from scipy.ndimage import binary_dilation
import argparse
p=argparse.ArgumentParser();p.add_argument('--cache',default='reference-cache');p.add_argument('--output',default='reference-output');args=p.parse_args()
gdal.UseExceptions();HERE=Path(__file__).resolve().parent;R=Path(args.cache).resolve();D=Path(args.output).resolve();R.mkdir(parents=True,exist_ok=True);D.mkdir(parents=True,exist_ok=True)
features=json.load(open(HERE/'source_stac.json'));json.dump(features,open(R/'catalog.json','w'),indent=2)
s=osr.SpatialReference();s.ImportFromEPSG(4326);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);t=osr.SpatialReference();t.ImportFromEPSG(32650);t.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);tf=osr.CoordinateTransformation(s,t)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
contexts={}
for config in json.load(open(HERE/'config.json')):
 name,date,b=config['name'],config['date'],config['bounds']
 f=next(f for f in features if date.replace('-','') in f['id'] and '50UPV' in f['id']);r=R/(name if name=='local' else name+'_'+date);r.mkdir(exist_ok=True);json.dump(f,open(r/'source_stac.json','w'),indent=2)
 pts=[tf.TransformPoint(x,y) for x,y in [(b[0],b[1]),(b[0],b[3]),(b[2],b[1]),(b[2],b[3])]]
 ub=[math.floor(min(p[0] for p in pts)/30)*30-60,math.floor(min(p[1] for p in pts)/30)*30-60,math.ceil(max(p[0] for p in pts)/30)*30+60,math.ceil(max(p[1] for p in pts)/30)*30+60];w=round((ub[2]-ub[0])/30);h=round((ub[3]-ub[1])/30)
 def fetch(k):
  out=r/(k+'.tif')
  if not out.exists():
   src=gdal.Open('/vsicurl/'+f['assets'][k]['href']); ds=gdal.Translate(str(out),src,projWin=[ub[0],ub[3],ub[2],ub[1]],width=w,height=h,resampleAlg='nearest',creationOptions=['COMPRESS=DEFLATE','TILED=YES']);ds=None
  d=gdal.Open(str(out));print(name,k,d.RasterXSize,d.RasterYSize,flush=True);return k,d.ReadAsArray()
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:a=dict(ex.map(fetch,['red','green','blue','scl']))
 valid=~binary_dilation(np.isin(a['scl'],[0,1,3,8,9,10,11]),iterations=1)
 for k in ['red','green','blue']:valid&=a[k]>0
 src=gdal.GetDriverByName('MEM').Create('',w,h,4,gdal.GDT_Byte);src.SetProjection(t.ExportToWkt());src.SetGeoTransform((ub[0],30,0,ub[3],0,-30))
 for i,k in enumerate(['red','green','blue']):
  m=f['assets'][k]['raster:bands'][0];refl=a[k]*m['scale']+m.get('offset',0);v=np.rint(np.clip(refl/.3,0,1)**(1/1.6)*255).astype('uint8');v[~valid]=0;src.GetRasterBand(i+1).WriteArray(v);src.GetRasterBand(i+1).SetColorInterpretation([gdal.GCI_RedBand,gdal.GCI_GreenBand,gdal.GCI_BlueBand][i])
 src.GetRasterBand(4).WriteArray(valid.astype('uint8')*255);src.GetRasterBand(4).SetColorInterpretation(gdal.GCI_AlphaBand)
 ow=math.ceil((b[2]-b[0])*111320*math.cos(math.radians((b[1]+b[3])/2))/30);oh=math.ceil((b[3]-b[1])*111320/30)
 dst=gdal.Warp('',src,format='MEM',dstSRS='EPSG:4326',outputBounds=b,width=ow,height=oh,resampleAlg='near',srcAlpha=True,dstAlpha=True,errorThreshold=0)
 p=D/(name+'_'+date+'.png');gdal.GetDriverByName('PNG').CreateCopy(str(p),dst,options=['WORLDFILE=YES']);aa=dst.ReadAsArray()[3]
 m={'date':date,'dates':[date],'datetime':f['properties']['datetime'],'id':f['id'],'sensor':'Sentinel-2 '+f['properties'].get('platform',''),'purpose':'Fixed actual-date geographical reference only, not selected-year observation','bounds_wgs84':b,'crs':'EPSG:4326','size_px':[ow,oh],'display_pixel_m':30,'native_rgb_pixel_m':10,'native_scl_pixel_m':20,'source_crop_utm_bounds':ub,'valid_fraction':float(np.mean(aa==255)),'invalid_pixels':int(np.sum(aa==0)),'qa_rule':'SCL 0,1,3,8,9,10,11 excluded; one 30m cross dilation; all RGB DN>0; nearest sampling and reprojection, no filling.','display_transform':'Per STAC asset reflectance scale/offset then clip(reflectance/0.3,0,1)^(1/1.6).','assets':{'geographic':{'path':'data/spatial/reference-v13/'+p.name,'sha256':sha(p),'bounds':b,'crs':'EPSG:4326','size_px':[ow,oh]}},'sources':{k:{'href':f['assets'][k]['href'],'crop_path':str((r/(k+'.tif')).relative_to(R)),'crop_sha256':sha(r/(k+'.tif')),'radiometric_metadata':f['assets'][k].get('raster:bands')} for k in a},'attribution':'Contains modified Copernicus Sentinel data (2026). Earth Search public COG distribution.','license_references':['https://cds.climate.copernicus.eu/licences/ec-sentinel','https://dataspace.copernicus.eu/terms-and-conditions'],'fixed_background_not_temporal_observation':True,'warnings':['Reference date differs from historical selected observations.','Invalid/cloud pixels remain transparent.','30m display sampling does not increase native detail.']}
 contexts[name]=m;json.dump(m,open(r/'manifest.json','w'),ensure_ascii=False,indent=2);json.dump({'contexts':contexts},open(D/'manifest.json','w'),ensure_ascii=False,indent=2);print('DONE',name,m['valid_fraction'],[ow,oh],flush=True)
