export const SEASONAL_LAYER='seasonal-network';
export const SEASONAL_NAME='季节性水文与地貌线索';
export const SEASONAL_LEGEND='青实线：影像可见地貌；琥珀虚线：待核连接；×：缺口；紫面：冬景判读；蓝面：2024-07 分类水面重合；白点线：道路剖面。不是实测水路或流向。';
const ROLES={
  water_observation:{label:'2024-07 分类水面重合 · 固定日期',symbol:'≈',stroke:'#5db3ff',fill:'#388afa88',dash:null},
  road_profile:{label:'道路地表剖面 · 非管底',symbol:'≍',stroke:'#e8e6bd',fill:'#e8e6bd30',dash:[2,4]},
  interpretation_area:{label:'判读范围 · 非实测地质单元',symbol:'▧',stroke:'#d5b3f5',fill:'#c7a4ef45',dash:null},
  morphology:{label:'影像可见地貌 · 不证明水流',symbol:'●',stroke:'#49dbc5',fill:'#49dbc530',dash:null},
  candidate_link:{label:'待核连接 · 非已知水路',symbol:'◇',stroke:'#f9b357',fill:'#f9b35735',dash:[8,5]},
  gap:{label:'证据缺口 · 未建立连通',symbol:'×',stroke:'#ff9a9e',fill:'#ff9a9e35',dash:[2,5]},
  target:{label:'核查位置 · 不是实测入水口',symbol:'◇',stroke:'#d9e681',fill:'#d9e68135',dash:null},
};
export function seasonalVisualSpec(role) {
  const r=ROLES[role];
  return r ? {...r,roleKey:role,roleLabel:r.label,hatch:null,lineWidth:role==='morphology'?2.6:2.1,color3d:parseInt(r.stroke.slice(1),16)} : null;
}
const coord=c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90;
const line=l=>Array.isArray(l)&&l.length>=2&&l.every(coord)&&l.some(p=>p[0]!==l[0][0]||p[1]!==l[0][1]);
const ring=r=>line(r)&&r.length>=4&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1];
const many=(a,f)=>Array.isArray(a)&&a.length>0&&a.every(f);
const polygon=p=>many(p,ring);
const geometry=g=>({Point:coord,LineString:line,MultiLineString:a=>many(a,line),Polygon:polygon,MultiPolygon:a=>many(a,polygon)})[g?.type]?.(g.coordinates)===true;
export function validateSeasonalNetwork(data,existing=new Map()) {
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length)throw new Error('无独立专题矢量');
  const seen=new Set();
  for(const f of data.features){
    const p=f?.properties;
    if(f?.type!=='Feature'||typeof f.id!=='string'||!f.id.trim()||seen.has(f.id)||existing.has(f.id)||
       !geometry(f.geometry)||p?.layer!==SEASONAL_LAYER||!Object.hasOwn(ROLES,p.feature_role)||
       !['observed','candidate','gap'].includes(p.status)||typeof p.name!=='string'||!p.name.trim()||
       (p.feature_role==='candidate_link'&&p.status!=='candidate')||(p.feature_role==='gap'&&p.status!=='gap')||(p.feature_role==='water_observation'&&(p.status!=='observed'||!['Polygon','MultiPolygon'].includes(f.geometry.type)))||(p.feature_role==='road_profile'&&!Array.isArray(p.profile?.samples))){
      throw new Error('专题要素不合规：'+(f?.id||'无编号'));
    }
    seen.add(f.id);
  }
  return data.features;
}
