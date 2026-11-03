import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {nearestBoundary} from '../../assets/office-shore-analysis.js';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),read=async p=>JSON.parse(await fs.readFile(p,'utf8')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const index=await read(path.join(root,'linked/shoreline_index.json')),officeRaw=await fs.readFile(path.join(root,'office_reference.geojson')),office=JSON.parse(officeRaw).features[0].geometry.coordinates;
const rows=[];
for(const s of index.samples){if(!s.quality_qualified)continue;const relative='linked/'+s.water_geojson,bytes=await fs.readFile(path.join(root,relative)),geometry=JSON.parse(bytes);rows.push({date:s.date,area_ha:s.detected_water_ha,classification_disputed:!!s.classification_disputed,water_asset:relative,source_sha256:hash(bytes),...nearestBoundary(office,geometry)});}
const out={schema_version:1,kind:'office_to_classified_water_boundary_proximity_not_route',office,office_source_sha256:hash(officeRaw),method:'Local equirectangular segment projection centred at office; choose minimum candidate haversine distance. EPSG:4326 inputs. Includes polygon hole boundaries. Map-plane distance, no terrain/obstacle/routing cost.',limits:['Office point is user-identified approximate reference, not surveyed doorway.','Water boundaries are native JRC monthly pixel classifications, not surveyed water level or safe ground.','Inside-water office or observed-zero water produces no approach line; no fabricated endpoint.','Each month chooses its own closest boundary point: differences are proximity changes, not motion of one fixed shoreline point.','A geometric line is not a recommended walking/driving path and has no safety or land-rights meaning.'],rows};
await fs.writeFile(path.join(here,'office-shore-summary.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({records:rows.length,empty:rows.filter(r=>r.distance_m===null).map(r=>({date:r.date,status:r.status})),representative:rows.filter(r=>['2021-07','2024-07'].includes(r.date))},null,2));
