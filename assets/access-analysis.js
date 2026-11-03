// Pure, renderer-independent road geometry analysis. EPSG:4326; lengths in metres.
export function distanceM(a,b){const r=Math.PI/180,p=a[1]*r,q=b[1]*r,d=(b[1]-a[1])*r,l=(b[0]-a[0])*r;return 6371008.8*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(d/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(l/2)**2)));}
export const coordinateKey=c=>`${c[0]},${c[1]}`;
export function buildRoadGraph(collection,{mode='pedestrian',includeRestricted=false,topology='strict-layer'}={}){
 const nodes=new Map(),edges=[],adj=new Map(),stats={sourceFeatures:collection.features.length,highwayFeatures:0,waterwayExcluded:0,restrictedExcluded:0,modeExcluded:0,zeroLengthExcluded:0,nonLineExcluded:0};
 const endpoints=new Set();if(topology==='shared-endpoints')for(const f of collection.features){if(!f.properties?.highway)continue;const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];for(const line of lines){if(line.length){endpoints.add(coordinateKey(line[0]));endpoints.add(coordinateKey(line.at(-1)));}}}
 const put=(c,p)=>{const key=coordinateKey(c)+'|layer='+((topology==='shared-endpoints'&&endpoints.has(coordinateKey(c)))?'endpoint-assumed':String(p.layer??'0'));if(!nodes.has(key)){nodes.set(key,{id:key,coordinate:c.slice(0,2)});adj.set(key,[]);}return key;};
 for(const f of collection.features){const p=f.properties||{};if(!p.highway){if(p.waterway)stats.waterwayExcluded++;continue;}stats.highwayFeatures++;
  if(!includeRestricted&&(['no','private'].includes(p.access)||(mode==='pedestrian'&&['no','private'].includes(p.foot))||(mode==='service'&&[p.motor_vehicle,p.motorcar,p.vehicle].some(x=>['no','private'].includes(x))))){stats.restrictedExcluded++;continue;}
  if(mode==='pedestrian'&&['motorway','motorway_link','trunk','trunk_link'].includes(p.highway)||mode==='service'&&['footway','path','steps','cycleway','pedestrian','bridleway'].includes(p.highway)){stats.modeExcluded++;continue;}
  const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];if(!lines.length)stats.nonLineExcluded++;
  lines.forEach((line,k)=>{for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];if(!a.slice(0,2).every(Number.isFinite)||!b.slice(0,2).every(Number.isFinite))continue;const length=distanceM(a,b);if(length<.001){stats.zeroLengthExcluded++;continue;}const from=put(a,p),to=put(b,p),id=`${p.osm_id||'feature'+collection.features.indexOf(f)}:${k}:${i-1}`,edge={id,from,to,length,coordinates:[a,b],source:p.osm_id,properties:{...p}};edges.push(edge);if(mode!=='service'||p.oneway!=='-1')adj.get(from).push({to,edge:id,length});if(mode!=='service'||!['yes','1','true'].includes(p.oneway))adj.get(to).push({to:from,edge:id,length});}});
 }
 const edgeMap=new Map(edges.map(e=>[e.id,e]));return {nodes,edges,edgeMap,adj,stats,mode};
}
export function nearestNode(graph,coordinate){let best=null;for(const node of graph.nodes.values()){const distance=distanceM(coordinate,node.coordinate);if(!best||distance<best.distance)best={...node,distance};}return best;}
export function shortestRoute(graph,from,to,{closedEdges=[],connector=null}={}){
 if(![from,to].every(id=>graph.nodes.has(id)||id===connector?.from||id===connector?.to))return {connected:false,lengthM:null,edgeIds:[],nodeIds:[]};
 const blocked=new Set(closedEdges),dist=new Map([[from,0]]),prev=new Map(),done=new Set();
 const neighbors=id=>{const a=[...(graph.adj.get(id)||[])];if(connector){if(id===connector.from)a.push({to:connector.to,edge:connector.id,length:connector.length});if(id===connector.to)a.push({to:connector.from,edge:connector.id,length:connector.length});}return a;};
 while(true){let u=null,minimum=Infinity;for(const [id,d] of dist)if(!done.has(id)&&d<minimum){u=id;minimum=d;}if(u===null)break;if(u===to){const edgeIds=[],nodeIds=[to];let at=to;while(at!==from){const p=prev.get(at);edgeIds.unshift(p.edge);at=p.node;nodeIds.unshift(at);}return {connected:true,lengthM:minimum,edgeIds,nodeIds};}done.add(u);for(const e of neighbors(u)){if(blocked.has(e.edge)||done.has(e.to))continue;const next=minimum+e.length;if(next<(dist.get(e.to)??Infinity)){dist.set(e.to,next);prev.set(e.to,{node:u,edge:e.edge});}}}
 return {connected:false,lengthM:null,edgeIds:[],nodeIds:[]};
}
export function topologySummary(graph){const seen=new Set(),sizes=[];const undirected=new Map([...graph.nodes.keys()].map(k=>[k,[]]));for(const e of graph.edges){undirected.get(e.from).push(e.to);undirected.get(e.to).push(e.from);}for(const id of graph.nodes.keys())if(!seen.has(id)){const queue=[id];seen.add(id);let size=0;while(queue.length){const u=queue.pop();size++;for(const v of undirected.get(u))if(!seen.has(v)){seen.add(v);queue.push(v);}}sizes.push(size);}return {...graph.stats,nodes:graph.nodes.size,edges:graph.edges.length,weakComponents:sizes.length,componentNodeCounts:sizes.sort((a,b)=>b-a),totalLengthM:graph.edges.reduce((s,e)=>s+e.length,0)};}
export function compareRoutes(base,scenario){return {base,scenario,extraM:base.connected&&scenario.connected?scenario.lengthM-base.lengthM:null,ratio:base.connected&&scenario.connected&&base.lengthM>0?scenario.lengthM/base.lengthM:null};}
export async function loadAccessData(base=new URL('../data/',import.meta.url),fetcher=globalThis.fetch){const files=['reference/roads.geojson','office_reference.geojson','spatial/spatial_features.geojson','access/config.json'];const [roads,office,features,config]=await Promise.all(files.map(async p=>{const r=await fetcher(new URL(p,base));if(!r.ok)throw new Error(`${p}: ${r.status}`);return r.json();}));return {roads,office:office.features[0],features,config};}
export function bearingDeg(a,b){const r=Math.PI/180,p=a[1]*r,q=b[1]*r,d=(b[0]-a[0])*r;return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/r+360)%360;}
export const turnDeg=(a,b)=>Math.abs(((b-a+540)%360)-180);
export function routeTurnDegrees(graph,route,connector=null){if(!route.connected)return null;const coordinate=id=>id===connector?.from?connector.coordinates[0]:id===connector?.to?connector.coordinates[1]:graph.nodes.get(id)?.coordinate;let sum=0,previous=null;for(let i=1;i<route.nodeIds.length;i++){const angle=bearingDeg(coordinate(route.nodeIds[i-1]),coordinate(route.nodeIds[i]));if(previous!==null)sum+=turnDeg(previous,angle);previous=angle;}return sum;}
// Edge-state Dijkstra: lexicographic objective (sum absolute heading changes, metres).
// Every source polyline vertex is counted; not normalized integration/choice.
export function leastAngularRoute(graph,from,to,{closedEdges=[],connector=null}={}){
 if(![from,to].every(id=>graph.nodes.has(id)||id===connector?.from||id===connector?.to))return {connected:false,lengthM:null,angleDeg:null,edgeIds:[],nodeIds:[]};
 const blocked=new Set(closedEdges),records=new Map(),heap=[];const less=(a,b)=>a.angle<b.angle||a.angle===b.angle&&a.length<b.length;
 const push=x=>{heap.push(x);let i=heap.length-1;while(i){const p=(i-1)>>1;if(!less(heap[i],heap[p]))break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let j=i,l=2*i+1,r=l+1;if(l<heap.length&&less(heap[l],heap[j]))j=l;if(r<heap.length&&less(heap[r],heap[j]))j=r;if(j===i)break;[heap[i],heap[j]]=[heap[j],heap[i]];i=j;}}return top;};
 const coord=id=>id===connector?.from?connector.coordinates[0]:id===connector?.to?connector.coordinates[1]:graph.nodes.get(id)?.coordinate;
 const start={key:'START',node:from,angle:0,length:0,heading:null,prev:null};records.set(start.key,start);push(start);
 while(heap.length){const u=pop();if(records.get(u.key)!==u)continue;if(u.node===to){const edgeIds=[],nodeIds=[u.node];let p=u;while(p.prev){edgeIds.unshift(p.edge);p=p.prev;nodeIds.unshift(p.node);}return {connected:true,lengthM:u.length,angleDeg:u.angle,edgeIds,nodeIds};}
 const adj=[...(graph.adj.get(u.node)||[])];if(connector){if(u.node===connector.from)adj.push({to:connector.to,edge:connector.id,length:connector.length});if(u.node===connector.to)adj.push({to:connector.from,edge:connector.id,length:connector.length});}
 for(const e of adj){if(blocked.has(e.edge))continue;const heading=bearingDeg(coord(u.node),coord(e.to)),v={key:e.to+'@'+e.edge,node:e.to,edge:e.edge,angle:u.angle+(u.heading===null?0:turnDeg(u.heading,heading)),length:u.length+e.length,heading,prev:u},old=records.get(v.key);if(!old||less(v,old)){records.set(v.key,v);push(v);}}}
 return {connected:false,lengthM:null,angleDeg:null,edgeIds:[],nodeIds:[]};
}
