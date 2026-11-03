// Node.js >= 18; no packages, no network. Run: node dist/data/access/recompute.mjs
import fs from 'node:fs';import crypto from 'node:crypto';
import {buildRoadGraph,nearestNode,shortestRoute,leastAngularRoute,routeTurnDegrees,topologySummary} from '../../assets/access-analysis.js';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const roads=read('reference/roads.geojson'),features=read('spatial/spatial_features.geojson'),office=read('office_reference.geojson').features[0].geometry.coordinates,config=read('access/config.json');
const outputs=[];
for(const mode of ['pedestrian','service'])for(const topology of ['shared-endpoints','strict-layer']){
 const graph=buildRoadGraph(roads,{mode,topology}),start=nearestNode(graph,office),targets=[];
 for(const id of config.referenceIds){const ref=features.features.find(f=>f.properties.id===id),end=nearestNode(graph,ref.geometry.coordinates),base=shortestRoute(graph,start.id,end.id),edge=base.edgeIds[Math.floor(base.edgeIds.length/2)]||null;
 const scenarios=[];for(const closed of [null,edge]){const options={closedEdges:closed?[closed]:[]},metric=shortestRoute(graph,start.id,end.id,options),angular=leastAngularRoute(graph,start.id,end.id,options);scenarios.push({illustrativeClosedEdge:closed,distanceMinimum:{...metric,angleDeg:routeTurnDegrees(graph,metric)},angularMinimum:angular});}
 targets.push({referenceId:id,referenceCoordinate:ref.geometry.coordinates,targetNode:end,scenarios});}
 outputs.push({mode,topology,topologySummary:topologySummary(graph),originNearestNode:start,targets});
}
const sourceFiles=['reference/roads.geojson','office_reference.geojson','spatial/spatial_features.geojson','access/config.json'];const result={version:'access-prototype-1',runAt:new Date().toISOString(),runtime:process.version,status:'actually_executed',sources:sourceFiles.map(path=>({path:'data/'+path,sha256:crypto.createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex')})),scope:'Frozen extract; not historical road reconstruction. Route endpoint offset is nearest existing vertex, not automatically inserted road projection. Candidate office connection OFF in these calculations. Closures hypothetical only. Angular cost counts every source bend, not formal integration or choice.',outputs};
fs.writeFileSync(new URL('analysis-summary.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(outputs.map(x=>({mode:x.mode,topology:x.topology,nodes:x.topologySummary.nodes,components:x.topologySummary.weakComponents,targets:x.targets.map(t=>({id:t.referenceId,baseM:t.scenarios[0].distanceMinimum.lengthM,angularM:t.scenarios[0].angularMinimum.lengthM,closedM:t.scenarios[1].distanceMinimum.lengthM}))})),null,2));
