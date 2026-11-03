import os
SITE_ROOT=os.environ.get("LAKE_SITE_DIST", "/workspace/scratch/951b8192a501/lake-interactive-site/dist")
WORKSPACE_ROOT=os.environ.get("LAKE_DATA_WORKSPACE", "/workspace/shared")
from pathlib import Path
import json,hashlib
import numpy as np
from osgeo import gdal
gdal.UseExceptions();R=Path(WORKSPACE_ROOT+'/lake_imagery_v13');out=[]
for p in(R/'full_bands').glob('*_red.tif'):
 sid=p.name[:-8];orig=Path(WORKSPACE_ROOT+'/alkali_grassland/roi_extended')/(sid+'_red.tif');d=gdal.Open(str(orig));g=d.GetGeoTransform();f=gdal.Open(str(p));fg=f.GetGeoTransform();x=round((g[0]-fg[0])/20);y=round((g[3]-fg[3])/-20);a=f.ReadAsArray(x,y,d.RasterXSize,d.RasterYSize);b=d.ReadAsArray();assert np.array_equal(a,b);scl=gdal.Open(str(R/'full_bands'/(sid+'_scl.tif'))).ReadAsArray();v=~np.isin(scl,[0,1,3,8,9,10,11]);out.append({'id':sid,'red_overlap_pixels':int(a.size),'red_overlap_mismatch':int((a!=b).sum()),'full_window_scl_screen_clear_fraction':float(v.mean()),'full_window_cloud_shadow_snow_not_removed_from_display':True})
records=json.load(open(R/'download_results.json'));full=json.load(open(R/'full_download_results.json'));report={'small_band_requests':len(records),'small_band_success':sum(x['success']for x in records),'small_crop_total_bytes':sum(Path(x['path']).stat().st_size for x in records if x['success']),'full_band_requests':len(full),'full_band_success':sum(x['success']for x in full),'full_crop_total_bytes':sum(x.get('bytes',0)for x in full),'full_dates_overlap_and_cloud_quality':out};(R/'source_checks.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
