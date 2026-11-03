import os
SITE_ROOT=os.environ.get("LAKE_SITE_DIST", "/workspace/scratch/951b8192a501/lake-interactive-site/dist")
WORKSPACE_ROOT=os.environ.get("LAKE_DATA_WORKSPACE", "/workspace/shared")
from pathlib import Path
import json,math,hashlib,concurrent.futures
from osgeo import gdal,osr
gdal.UseExceptions()
for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif','GDAL_HTTP_TIMEOUT':'45','GDAL_HTTP_MAX_RETRY':'0'}.items():gdal.SetConfigOption(k,v)
R=Path(WORKSPACE_ROOT+'/lake_imagery_v13');O=R/'full_bands';O.mkdir(exist_ok=True);fs={f['id']:f for f in json.load(open(WORKSPACE_ROOT+'/alkali_annual_water/source_manifest.json'))['features']};b=json.load(open(SITE_ROOT+'/data/spatial/terrain_expanded.json'))['bounds'];s=osr.SpatialReference();s.ImportFromEPSG(4326);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);t=osr.SpatialReference();t.ImportFromEPSG(32650);t.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);tr=osr.CoordinateTransformation(s,t);pts=[tr.TransformPoint(x,y)for x,y in[(b[0],b[1]),(b[0],b[3]),(b[2],b[1]),(b[2],b[3])]];B=[math.floor(min(p[0]for p in pts)/20)*20-20,math.floor(min(p[1]for p in pts)/20)*20-20,math.ceil(max(p[0]for p in pts)/20)*20+20,math.ceil(max(p[1]for p in pts)/20)*20+20];W,H=round((B[2]-B[0])/20),round((B[3]-B[1])/20)
ids=['S2B_T50UPV_20240702T025820_L2A','S2A_T50UPV_20240730T030644_L2A','S2A_T50UPV_20250724T030155_L2A']
def fetch(j):
 sid,k=j;p=O/(sid+'_'+k+'.tif');r={'id':sid,'band':k,'url':fs[sid]['assets'][k]['href'],'bounds_utm':B,'size':[W,H],'pixel_m':20,'resample':'nearest'if k=='scl'else'average'}
 try:
  if not p.exists():
   src=gdal.Open('/vsicurl/'+r['url']);d=gdal.Translate(str(p),src,projWin=[B[0],B[3],B[2],B[1]],width=W,height=H,resampleAlg=r['resample'],creationOptions=['COMPRESS=DEFLATE','TILED=YES']);d=None
  d=gdal.Open(str(p));assert(d.RasterXSize,d.RasterYSize)==(W,H);r.update(success=True,path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size)
 except Exception as e:r.update(success=False,error=str(e))
 print(json.dumps(r),flush=True);return r
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as ex:r=list(ex.map(fetch,[(i,k)for i in ids for k in ['red','green','blue','scl']]))
(R/'full_download_results.json').write_text(json.dumps(r,indent=2))
