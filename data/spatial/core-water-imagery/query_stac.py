from pathlib import Path
ROOT = Path(__file__).resolve().parent
import requests,json
base='https://earth-search.aws.element84.com/v1'
for yr in ['2025','2026']:
 x=requests.get(base+'/search',params={'collections':'sentinel-2-c1-l2a','bbox':'119.61,49.105,119.73,49.175','datetime':f'{yr}-05-01T00:00:00Z/{yr}-05-31T23:59:59Z','limit':100},timeout=60).json()
 json.dump(x,open(ROOT / 'sources' / f'may{yr}.json','w'));print(yr,len(x['features']),[(f['id'],f['properties'].get('eo:cloud_cover')) for f in x['features']],flush=True)
x=requests.get(base+'/collections/sentinel-2-c1-l2a/items/S2A_T50UPV_20260808T030153_L2A',timeout=60).json();json.dump(x,open(str(ROOT / 'sources')+'/aug_item.json','w'));print(x['assets'].keys());print(x['assets']['visual'])
