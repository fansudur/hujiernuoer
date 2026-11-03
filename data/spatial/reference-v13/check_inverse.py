from pathlib import Path
import json,hashlib,math
import numpy as np
from osgeo import gdal,osr,ogr
from scipy.ndimage import binary_dilation
import argparse
a=argparse.ArgumentParser();a.add_argument('--cache',default='reference-cache');a.add_argument('--reproduced',default='reference-output');a.add_argument('--huhe-reference');args=a.parse_args();R=Path(args.cache).resolve();D=Path(__file__).resolve().parent;m=json.load(open(D/'manifest.json'));sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();checks={}
s=osr.SpatialReference();s.ImportFromEPSG(4326);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);t=osr.SpatialReference();t.ImportFromEPSG(32650);t.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);tf=osr.CoordinateTransformation(s,t)
for name,c in m['contexts'].items():
 p=D/Path(c['assets']['geographic']['path']).name;ds=gdal.Open(str(p));out=ds.ReadAsArray();b=c['bounds_wgs84'];gt=(b[0],(b[2]-b[0])/ds.RasterXSize,0,b[3],0,-(b[3]-b[1])/ds.RasterYSize);r=R/('local' if name=='local' else name+'_'+c['date']);raw={k:gdal.Open(str(r/(k+'.tif'))).ReadAsArray() for k in ['red','green','blue','scl']};rg=gdal.Open(str(r/'red.tif')).GetGeoTransform();valid=~binary_dilation(np.isin(raw['scl'],[0,1,3,8,9,10,11]),iterations=1)
 for k in ['red','green','blue']:valid&=raw[k]>0
 f=json.load(open(r/'source_stac.json'));rng=np.random.default_rng(137);bad=0
 for row,col in zip(rng.integers(0,out.shape[1],5000),rng.integers(0,out.shape[2],5000)):
  lon=gt[0]+(col+.5)*gt[1];lat=gt[3]+(row+.5)*gt[5];x,y,_=tf.TransformPoint(lon,lat);sc=int((x-rg[0])/rg[1]);sr=int((y-rg[3])/rg[5]);expect=[]
  for k in ['red','green','blue']:
   a=f['assets'][k]['raster:bands'][0];val=round(np.clip((float(raw[k][sr,sc])*a['scale']+a.get('offset',0))/.3,0,1)**(1/1.6)*255);expect.append(val if valid[sr,sc] else 0)
  expect.append(255 if valid[sr,sc] else 0)
  bad+=not np.array_equal(out[:,row,col],expect)
 facts={'inverse_sample_count':5000,'inverse_rgba_mismatches':int(bad),'reproduction_sha_equal':sha(p)==sha(Path(args.reproduced)/p.name),'png_sha_matches_manifest':sha(p)==c['assets']['geographic']['sha256'],'width':ds.RasterXSize,'height':ds.RasterYSize,'valid_fraction':float(np.mean(out[3]==255)),'geotransform':gt,'expected_bounds':c['bounds_wgs84']}
 if name=='local':
  lon,lat=119.66093779576451,49.1409469769002;col=int((lon-gt[0])/gt[1]);row=int((lat-gt[3])/gt[5]);facts['office_alpha']=int(out[3,row,col])
 elif args.huhe_reference:
  v=ogr.Open(args.huhe_reference);mask=gdal.GetDriverByName('MEM').Create('',ds.RasterXSize,ds.RasterYSize,1,gdal.GDT_Byte);mask.SetGeoTransform(gt);mask.SetProjection(ds.GetProjection());gdal.RasterizeLayer(mask,[1],v.GetLayer(),burn_values=[1]);sel=mask.ReadAsArray()==1;facts['huhe_window_valid_fraction']=float(np.mean(out[3][sel]==255));facts['huhe_window_pixel_count']=int(sel.sum())
 checks[name]=facts
json.dump(checks,open(R/'independent-checks.json','w'),indent=2);print(json.dumps(checks,indent=2));assert all(c['inverse_rgba_mismatches']==0 and c['reproduction_sha_equal'] and c['png_sha_matches_manifest'] for c in checks.values())
