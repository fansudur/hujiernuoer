import json, hashlib
from pathlib import Path
import argparse
parser = argparse.ArgumentParser(description='Export source-backed spatial vectors without synthesizing missing geometries.')
parser.add_argument('repository', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
ROOT = args.repository.resolve(); OUT = args.output.resolve()
OUT.mkdir(parents=True, exist_ok=True)
def read(p): return json.loads((ROOT/p).read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(n,d): (OUT/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def feature(id,g,p): return dict(type='Feature',id=id,geometry=g,properties=p)
def fc(f,**kw): return dict(type='FeatureCollection',features=f,**kw)
def coordinates(c):
 if isinstance(c[0],(int,float)): yield c
 else:
  for a in c: yield from coordinates(a)
def bounds(fs):
 pts=[c for f in fs for c in coordinates(f['geometry']['coordinates'])];return [min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)]
e=read('data/water-network/evidence.json'); fs=[]; zs=[]
for k,a in e['profiles'].items():
 assert all(a[i][0]<a[i+1][0] for i in range(len(a)-1))
 z=[r for r in a if r[0]==0];assert len(z)==1
 p=dict(profile_id=k,source_path='data/water-network/evidence.json',source_json_pointer='/profiles/'+k,station_m=[r[0] for r in a],zero_anchor_lonlat=z[0][1:3],zero_anchor_status='exact source station 0 coordinate; not field-surveyed',positive_direction='north' if k.startswith('T') else 'from first vertex toward last vertex (southeast)',negative_direction='south' if k.startswith('T') else 'not sampled; do not extend beyond 0m',interpretation='Exact extraction of published sample coordinates, not independently surveyed geometry. Historical DSM profile; not a waterway, current water level, hydraulic head or legal boundary.')
 if k.startswith('P'):p['placement_caveat']='Original transect was approximately positioned from screenshot; decimal precision does not imply positioning accuracy.'
 fs.append(feature(k,dict(type='LineString',coordinates=[r[1:3] for r in a]),p)); zs.append(feature(k+'_0m',dict(type='Point',coordinates=z[0][1:3]),dict(profile_id=k,station_m=0,anchor_status=p['zero_anchor_status'],placement_caveat=p.get('placement_caveat','Source reference-line intersection, not surveyed boundary'))))
write('profiles.geojson',fc(fs));write('profile_zero_anchors.geojson',fc(zs))
# Retain the exact source geometries intersecting requested core bounds: no clipping, resampling or invented road names.
aoi=[119.61,49.105,119.73,49.175]
def intersect(a,b):
 lo,hi=0.,1.
 for axis in range(2):
  d=b[axis]-a[axis]; mn=aoi[axis];mx=aoi[axis+2]
  if d==0:
   if a[axis]<mn or a[axis]>mx:return False
  else:
   x,y=sorted([(mn-a[axis])/d,(mx-a[axis])/d]);lo=max(lo,x);hi=min(hi,y)
   if lo>hi:return False
 return True
roads=[]
for f in read('data/reference/roads_context.geojson')['features']:
 p=f['properties'];g=f['geometry']; ref=str(p.get('ref','')).replace(' ','').upper()
 if not p.get('highway') or 'G332' in ref:continue
 lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
 if any(intersect(a,b) for line in lines for a,b in zip(line,line[1:])): roads.append(f)
write('secondary_roads.geojson',fc(roads,attribution='© OpenStreetMap contributors',license='ODbL 1.0',copyright_url='https://www.openstreetmap.org/copyright',selection_bounds_wgs84=aoi,geometry_policy='Original context geometries retained in full if intersecting selection bounds. Not clipped to this selection rectangle.'))
write('hotspot_reference_segment.geojson',fc([feature('yard_reference_2100_2270m',dict(type='LineString',coordinates=e['hotspot']['reference_line_segment_2100_2270_m']),dict(source_path='data/water-network/evidence.json',interpretation=e['hotspot']['note'],not_a_statistical_strip=True,not_a_water_polygon=True))]))
write('hotspot_may_summary.json',dict(status='aggregate_only_geometry_missing',source_path='data/water-network/evidence.json',observations=[x for x in e['observations'] if x['month']==5],interpretation='Preserved source statistics only. Areas do not identify pixels and cannot reconstruct water-mask polygons.'))
entries=[]
for n in ['profiles.geojson','profile_zero_anchors.geojson','secondary_roads.geojson','hotspot_reference_segment.geojson','hotspot_may_summary.json']:
 d=json.loads((OUT/n).read_text()); item=dict(path='data/spatial-vectors/'+n,sha256=sha(OUT/n),bytes=(OUT/n).stat().st_size)
 if 'features' in d:item.update(crs='EPSG:4326',coordinate_order='longitude,latitude',bounds_wgs84=bounds(d['features']),feature_count=len(d['features']))
 entries.append(item)
manifest=dict(status='partial_source_backed_export',source_repository='https://github.com/fansudur/hujiernuoer',source_commit='9366e3f51cb03af73b850aeb2434c56ba6221559',sources=[dict(path=p,sha256=sha(ROOT/p)) for p in ['data/water-network/evidence.json','data/reference/roads_context.geojson','data/reference/README.md','data/reference/manifest.json']],datasets=entries,road_source=dict(attribution='© OpenStreetMap contributors',license='ODbL 1.0',copyright_url='https://www.openstreetmap.org/copyright',retrieved_at_from_source='2026-10-27T03:37Z',source_manifest='data/reference/manifest.json',original_scope='Original OSM API bounded map query about 13×12km; source geometries already clipped to DSM context extent. See source manifest.',selection='highway present AND ref not containing G332 AND at least one segment intersects [119.61,49.105,119.73,49.175]; original coordinates/properties retained.',limitations='OSM community references, not complete road survey. osm_timestamp is last object edit, not imagery/survey date. North road / west road local labels are not assigned without source identification. Roads do not prove passability, culverts or hydraulic connections.'),missing=[dict(id='E_S_20_100_strip',reason='No original strip geometry, raster transform or reproducible projection/buffer definition recovered; reference chainage segment is not the statistical strip.'),dict(id='hotspot_repeat_pixels_2025_05_2026_05',reason='Only aggregate 0.56ha/0.84ha source statistics recovered. No source pixel identities, repeated-observation masks or raster georeferencing. No polygons fabricated.'),dict(id='C_crossroad_analysis_and_paired_control_boxes',reason='No original window/control corner coordinates recovered. Approximate point 119.65684,49.12513 does not define extents. C_ROAD_1/2 geometric intersections are distinct and not replacements.')],validation=dict(profile_count=len(fs),anchors_count=len(zs),unique_exact_zero_per_profile=True,profile_coordinates_copied_without_interpolation=True,road_count=len(roads),road_features_exact_source_subsets=True,no_frontend_changes=True))
write('manifest.json',manifest)
print(json.dumps(manifest,ensure_ascii=False,indent=2))
