from pathlib import Path
ROOT = Path(__file__).resolve().parent
import os,json, numpy as np,rasterio,concurrent.futures
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds,Window
os.environ['GDAL_DISABLE_READDIR_ON_OPEN']='EMPTY_DIR'
os.environ['GDAL_HTTP_TIMEOUT']='30'
os.environ['CURL_CA_BUNDLE']=os.environ.get('SSL_CERT_FILE', '/etc/ssl/certs/ca-certificates.crt')
os.environ['GDAL_HTTP_PROXY']=os.environ.get('HTTPS_PROXY','')
os.environ['CPL_VSIL_CURL_ALLOWED_EXTENSIONS']='.tif'
b=(119.61,49.105,119.73,49.175)
def run(f):
 try:
  with rasterio.open(f['assets']['scl']['href']) as ds:
   bb=transform_bounds('EPSG:4326',ds.crs,*b,densify_pts=21);w=from_bounds(*bb,ds.transform);w=Window(np.floor(w.col_off),np.floor(w.row_off),np.ceil(w.col_off+w.width)-np.floor(w.col_off),np.ceil(w.row_off+w.height)-np.floor(w.row_off))
   a=ds.read(1,window=w);q={'id':f['id'],'datetime':f['properties']['datetime'],'scene_cloud_percent':f['properties']['eo:cloud_cover'],'scl_window_pixels':a.size,'scl_clear_fraction':float(np.isin(a,[2,4,5,6,7]).mean()),'scl_histogram':{str(int(v)):int(n) for v,n in zip(*np.unique(a,return_counts=True))}};print(q,flush=True);return q
 except Exception as e:return {'id':f['id'],'error':str(e)}
f=sum([json.load(open(str(ROOT / 'sources')+'/may'+yr+'.json'))['features'] for yr in ['2025','2026']],[])
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:out=list(ex.map(run,f))
json.dump(out,open(str(ROOT / 'sources')+'/quality.json','w'),indent=2)
