#!/usr/bin/env python3
"""Repackage frozen native-pixel monthly polygons; no raster inference or interpolation.
Usage: python export_lake_geometry.py REPOSITORY OUTPUT_DIRECTORY
"""
import json, hashlib, sys, subprocess
from pathlib import Path
from copy import deepcopy
from shapely.geometry import shape
root=Path(sys.argv[1]); out=Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
def read(p): return json.loads((root/p).read_text())
def sha(p): return hashlib.sha256((root/p).read_bytes()).hexdigest()
def save(p,x): (out/p).write_text(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n')
src='data/linked/shoreline_index.json'; original=read(src)
samples={s['date']:s for s in original['samples']}
months=[r for r in read('data/monthly.json')['records'] if '1984-01'<=r['date']<='2024-12']
assert len(months)==492
assert set(samples)=={r['date'] for r in months if r['lake_qualified']}
grid=original['native_grid']; gt=grid['geotransform']; H,W=grid['shape']
sources={src:sha(src),'data/monthly.json':sha('data/monthly.json')}
features={'water':[],'nodata':[]}; obs=[]; checks=[]
def vertices(c):
 if isinstance(c[0],(float,int)): yield c
 else:
  for x in c:yield from vertices(x)
for r in months:
 date=r['date']; s=samples.get(date); qualified=bool(s)
 row={'id':f'LOCAL-{date}','window':'LOCAL_KMZ','date':date,'qualified_both_denominators':qualified,'geometry_available':qualified,'water_area_ha':r['lake_area_ha'] if qualified else None,'observed_zero':bool(qualified and s['detected_water_ha']==0),'class_water':2,'class_valid_nonwater':1,'class_no_observation':0,'water_feature_id':None,'nodata_feature_id':None,'status':r['lake_status'],'valid_pct':r['lake_valid_pct'],'outer_valid_pct':r['lake_outer_valid_pct'],'core_qualified':r['lake_core_qualified'],'primary_eligible':r['lake_primary_eligible'],'classification_disputed':r['lake_classification_disputed'],'classification_caution':r['lake_classification_caution'],'local_2008_conflict':r['lake_local_2008_conflict']}
 if s:
  row['season_interpretation']=s.get('season_interpretation')
  row['source_sample_path']='data/linked/shoreline_index.json'
  assert abs(s['detected_water_ha']-r['lake_area_ha'])<1e-10
  for kind in features:
   p='data/linked/'+s[kind+'_geojson']; sources[p]=sha(p); fcs=read(p)['features']; polygons=[]
   for f in fcs:
    g=f['geometry']; assert shape(g).is_valid
    for x,y,*_ in vertices(g['coordinates']):
     a=(x-gt[0])/gt[1];b=(y-gt[3])/gt[5]
     assert abs(a-round(a))<1e-7 and abs(b-round(b))<1e-7
     assert -1e-7<=a<=W+1e-7 and -1e-7<=b<=H+1e-7
    polygons.extend([deepcopy(g['coordinates'])] if g['type']=='Polygon' else deepcopy(g['coordinates']))
   if polygons:
    fid=f'LOCAL-{date}-{kind}';row[kind+'_feature_id']=fid
    geometry={'type':'MultiPolygon','coordinates':polygons}
    props={'id':fid,'window':'LOCAL_KMZ','date':date,'class':'water' if kind=='water' else 'no_observation','water_area_ha':s['detected_water_ha'],'geometry_kind':'native_classified_pixel_edges','not_surveyed_shoreline':True,'not_water_level_or_depth':True,'quality_qualified':True,'primary_eligible':s['primary_eligible'],'classification_disputed':s['classification_disputed'],'source_path':p,'source_sha256':sources[p]}
    features[kind].append({'type':'Feature','id':fid,'properties':props,'geometry':geometry})
    assert shape(geometry).is_valid
   checks.append({'date':date,'class':kind,'input_features':len(fcs),'output_polygons':len(polygons),'native_grid_vertices':True,'unchanged_coordinate_arrays':True})
 obs.append(row)
index={'schema_version':'1.0','title':'本湖固定统计窗全序列合格月原生像元几何','crs':'EPSG:4326','calendar':'1984-01 through 2024-12','product_calendar':'1984-04 through 2024-12','window':'LOCAL_KMZ','native_grid':grid,'bounds_wgs84':[gt[0],gt[3]+H*gt[5],gt[0]+W*gt[1],gt[3]],'bounds_semantics':'native source raster envelope, not the KMZ statistical mask or lake boundary','qualification':'Existing frozen dual95 fixed-window ledger; no new filtering','geometry_rule':original['method'],'water_asset':'lake_water.geojson','nodata_asset':'lake_nodata.geojson','notes':['1984-01–03 are explicit pre-product slots; no inferred geometry.','All 72 qualified months are included, not only 11 samples; 59 primary months and classification-dispute flags retained.','Empty water feature with geometry_available=true means observed zero, not missing or proof of a dry lake.','Unqualified months have geometry_available=false; no class geometry is fabricated for those months.','No-data polygons cover class 0 inside the frozen native pixel-center KMZ mask only.','Published geodesic pixel-weight area is preserved, not recomputed from planar polygon area.','monthly.json has_water_geometry is a legacy 11-sample availability field; use this index geometry_available for this export.','This export losslessly packages already-published native-pixel GeoJSON. Original NPZ is not present in this checkout; no claim of a new raw-raster recomputation.','Historical products are monthly classifications, not individual image acquisition dates; 2025/2026 are not represented.'],'observations':obs}
for k in features:save('lake_'+k+'.geojson',{'type':'FeatureCollection','features':features[k]})
save('lake_geometry_index.json',index)
save('lake_geometry_checks.json',{'status':'passed','calendar_slots':len(obs),'qualified_months':sum(x['geometry_available'] for x in obs),'observed_zero_months':sum(x['observed_zero'] for x in obs),'water_features':len(features['water']),'nodata_features':len(features['nodata']),'ledger_max_absolute_area_error_ha':0,'verification_scope':'Lossless coordinate packaging, grid-alignment, validity, bounds, exact qualified-month set and published area-ledger consistency; not a new NPZ recomputation','checks':checks})
manifest={'schema_version':'1.0','dataset_id':'local_lake_monthly_native_geometry','crs':'EPSG:4326','bounds_wgs84':index['bounds_wgs84'],'bounds_semantics':index['bounds_semantics'],'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'source_files_sha256':sources,'historical_raster_provenance':original['sources'],'interpretation_boundaries':index['notes'],'outputs':[]}
for p in ['lake_geometry_index.json','lake_water.geojson','lake_nodata.geojson','lake_geometry_checks.json']:
 manifest['outputs'].append({'path':'data/spatial/'+p,'sha256':hashlib.sha256((out/p).read_bytes()).hexdigest(),'bytes':(out/p).stat().st_size})
save('lake_geometry_manifest.json',manifest)
print(json.dumps({'months':len(obs),'qualified':len(samples),'water_features':len(features['water']),'nodata_features':len(features['nodata'])}))
