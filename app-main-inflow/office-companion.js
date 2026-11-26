/* Project supplements stay separate from the frozen archival data contract. */
export const OFFICE_DEFS = Object.freeze([
  {id:'office-corridor',name:'嘎查办公院与两条地形剖面',count:3},
  {id:'office-flow-tests',name:'办公院下游：模型对照与现场核查点',count:5},
  {id:'west-slope-user-sketch',name:'西坡来水：你的红线范围和三支草图',count:7},
  {id:'west-slope-review',name:'西坡复核：F1 桥、北桥东转折与模型跨路点',count:4},
  {id:'office-nw-audit',name:'办公院与西北岸核查点',count:7},
  {id:'roadside-terrain-check',name:'道路两侧地形剖面 · 圆涵与三八水库中桥',count:4},
  {id:'wc2-optical-review',name:'圆涵下游 · 同位置影像核查',count:5},
  {id:'marsh-review',name:'东部泥沼：用户原图导航点',count:1},
]);
const counts = new Map(OFFICE_DEFS.map(d=>[d.id, d.count]));

export function validateOfficeCompanion(collection, existingIds) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features) || collection.features.length !== 36) throw new Error('办公院专题格式不匹配');
  const ids = new Set();
  const observed = new Map();
  const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) &&
    p[0] >= 119.61 && p[0] <= 119.77 && p[1] >= 49.10 && p[1] <= 49.175;
  for (const f of collection.features) {
    const l = f?.properties?.layer;
    if (f?.type !== 'Feature' || typeof f.id !== 'string' || ids.has(f.id) ||
        existingIds.has(f.id) || !counts.has(l) || !f?.properties?.name) throw new Error('办公院专题对象无效');
    ids.add(f.id);
    observed.set(l, (observed.get(l) || 0) + 1);
    const g=f.geometry;
    if (!(g?.type === 'Point' ? validPoint(g.coordinates) :
        g?.type === 'LineString' && g.coordinates.length >= 2 && g.coordinates.every(validPoint))) throw new Error(f.id);
    if (l==='office-nw-audit' && g?.type!=='Point') throw new Error(f.id);
    const prof=f.properties.profile;
    if (prof) {
      if (prof.columns.join(',') !== 'distance_m,lon,lat,glo30_m' ||
          prof.samples.length === 0 || prof.samples.some((p,i)=>p.length!==4 || !p.every(Number.isFinite) ||
              !validPoint(p.slice(1,3)) || (i===0 ? p[0]!==0 : p[0]<=prof.samples[i-1][0]))) throw new Error(f.id);
    }
  }
  for (const [l,n] of counts) if (observed.get(l)!==n) throw new Error(l);
  return collection.features;
}
