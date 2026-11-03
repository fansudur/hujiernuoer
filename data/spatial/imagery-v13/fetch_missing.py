import os
SITE_ROOT=os.environ.get("LAKE_SITE_DIST", "/workspace/scratch/951b8192a501/lake-interactive-site/dist")
WORKSPACE_ROOT=os.environ.get("LAKE_DATA_WORKSPACE", "/workspace/shared")
import os,json,hashlib,concurrent.futures,time
from pathlib import Path
from osgeo import gdal
gdal.UseExceptions()
for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif','GDAL_HTTP_TIMEOUT':'35','GDAL_HTTP_MAX_RETRY':'0'}.items():gdal.SetConfigOption(k,v)
ROOT=Path(WORKSPACE_ROOT+'/lake_imagery_v13');OUT=ROOT/'new_bands';OUT.mkdir(exist_ok=True);fs={f['id']:f for f in json.load(open(WORKSPACE_ROOT+'/alkali_annual_water/source_manifest.json'))['features']};sc=json.load(open(SITE_ROOT+'/data/spatial/imagery-v11/manifest.json'))['scenes'];B=[693400,5444000,698800,5447800]
def fetch(j):
 sid,bn=j;f=fs[sid];out=OUT/(sid+'_'+bn+'.tif');r={'id':sid,'band':bn,'url':f['assets'][bn]['href'],'bounds_utm':B,'shape':[270,190],'resample':'average','source':'Earth Search public COG asset from existing STAC manifest'}
 try:
  if not out.exists():
   d=gdal.Open('/vsicurl/'+r['url']);o=gdal.Translate(str(out),d,projWin=[B[0],B[3],B[2],B[1]],width=270,height=190,resampleAlg='average',creationOptions=['COMPRESS=DEFLATE']);o=None
  d=gdal.Open(str(out));assert(d.RasterXSize,d.RasterYSize)==(270,190);r.update(success=True,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),path=str(out))
 except Exception as e:r.update(success=False,error=str(e))
 print(json.dumps(r),flush=True);return r
jobs=[(s['id'],bn)for s in sc if not s.get('sensor','').startswith('Landsat')and s['date'] not in ['2026-08-08','2025-08-04']for bn in ['green','blue']]
# first probe before running rest, no workaround after denied network
first=fetch(jobs[0]);results=[first]
if first['success']:
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as ex:results+=list(ex.map(fetch,jobs[1:]))
(ROOT/'download_results.json').write_text(json.dumps(results,indent=2))
