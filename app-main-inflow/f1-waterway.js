export const F1_WATERWAY_LAYER='f1-waterway';
export const F1_COMPARE_LAYER='f1-waterway-sensitivity';
export const F1_WATERWAY_NAME='三八水库桥上下游与主湖西北水路';
export const F1_EVIDENCE_ID='f1-waterway-chain';
export const F1_LEGEND='紫色面：桥西模型汇水范围；青色实线／轮廓：可见形态；蓝色面：注明日期的水类参照；琥珀色虚线：待核连接；×：缺口；◇：跨路标记；●：现场记录的 03 道路四点。现场构造或局地走向不代表已知入湖水路。';
export const WCROSS_UPSTREAM_LAYER='wcross-upstream';
export const WCROSS_UPSTREAM_NAME='地方道路 Wcross1／2 · 路西模型段与影像';
export const WCROSS_UPSTREAM_LEGEND='青色线：可见田缘／旧横纹；浅绿虚边：影像核查范围；紫色虚边：路西模型搜索窗；紫线：模型段；灰点线：地方道路证据缺口。各段不拼为连续水路，不标流向。';
export const WCROSS_FAR_LAYER='wcross-far-west';
export const WCROSS_FAR_NAME='地方道路 Wcross1／2 · G332 西坡试算（可选）';
export const OWNER_BLUE_LAYER='owner-blue-201909';
export const OWNER_BLUE_NAME='2019-09 用户蓝线 · 原图判读草图';

const roles={
 owner_blue_sketch:['用户蓝线 · 待核假设','◇','#51acff','#51acff2c',[9,5]],
 terrain_only_approach:['原地形试算至路西 · 未观测流路','▧','#c6a5f5','#c6a5f525',[10,4]],
 alternative_dsm_approach:['另一套 DSM 对照 · 未观测流路','▧','#b7b2de','#b7b2de25',[4,3]],
 schematic_road_uncertainty_gap:['跨路证据缺口 · 虚线不表示连通','×','#a8aab0','#a8aab028',[2,6]],
 search_window:['模型搜索窗 · 非涵口或已知汇水边界','▧','#ad92ef','#ad92ef23',[5,5]],
 upstream_core:['桥西模型汇水范围 · 终点只到桥西', '▧','#c6a5f5','#c6a5f52d',null],
 terrain_variant:['路边搜索窗 · 非主湖汇水区','▧','#9c86bf','#9c86bf17',[3,5]],
 water_reference:['指定日期的水类参照 · 不证明入流','●','#63b8fe','#63b8fe36',null],
 diffuse_observation:['可见暗色低带 · 不是沟槽判定','◇','#a1dca4','#a1dca423',[2,4]],
 observed_outline:['可见地貌 · 非水路实测','●','#4bdcc6','#4bdcc625',null],
 candidate_link:['待核连接 · 不是已知水路','◇','#f5b86b','#f5b86b28',[8,5]],
 gap:['证据缺口 · 未建立连通','×','#ff9a9e','#ff9a9e28',[2,5]],
 field_kmz_observation:['现场记录 · 03 道路原标记','●','#dcec9b','#dcec9b32',null],
 road_crossing:['手绘跨路标记 · 不证明过水','◇','#dcec9b','#dcec9b32',null],
 contextual:['地名或参考位置 · 非通水证据','◇','#bacad7','#bacad72a',null]
};
export function f1WaterwayVisualSpec(role){
 const v=roles[role];
 return v?{roleKey:role, roleLabel:v[0],symbol:v[1],stroke:v[2],fill:v[3],dash:v[4],hatch:null,lineWidth:2.2,color3d:parseInt(v[2].slice(1),16)}:null;
}
const pt=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const line=l=>Array.isArray(l)&&l.length>=2&&l.every(pt)&&l.some(x=>x[0]!==l[0][0]||x[1]!==l[0][1]);
const ring=r=>line(r)&&r.length>=4&&r[0].every((v,i)=>v===r.at(-1)[i]);
const group=(a,t)=>Array.isArray(a)&&a.length>0&&a.every(t);
const poly=a=>group(a,ring);
const geom=g=>({Point:pt,LineString:line,MultiLineString:a=>group(a,line),Polygon:poly,MultiPolygon:a=>group(a,poly)})[g?.type]?.(g.coordinates)===true;
export function validateF1Waterway(data,byId=new Map()){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length)throw new Error('没有专题矢量');
 const seen=new Set();
 for(const f of data.features){
   const p=f?.properties;
   if(f?.type!=='Feature'||typeof f.id!=='string'||!f.id.trim()||seen.has(f.id)||byId.has(f.id)||!geom(f.geometry)
     ||![F1_WATERWAY_LAYER,F1_COMPARE_LAYER].includes(p?.layer)||!Object.hasOwn(roles,p.feature_role)||typeof p.name!=='string'||!p.name.trim()
     ||!['modeled','observed','candidate','gap','context'].includes(p.status)
     ||(p.layer===F1_COMPARE_LAYER&&p.feature_role!=='terrain_variant')||(p.feature_role==='candidate_link'&&p.status!=='candidate')||(p.feature_role==='gap'&&p.status!=='gap'))throw new Error('专题要素缺少有效证据分类或几何：'+(f?.id||'无编号'));
   seen.add(f.id);
 }
 const ev=data.evidence;
 if(!ev||typeof ev.judgment!=='string'||typeof ev.boundary!=='string'||!ev.feature_ids?.length
    ||!ev.feature_ids.every(id=>seen.has(id)&&data.features.find(f=>f.id===id)?.properties.layer===F1_WATERWAY_LAYER))throw new Error('缺少专题阅读顺序或相关对象');
 return {features:data.features,evidence:{...ev,id:F1_EVIDENCE_ID,title:F1_WATERWAY_NAME,classification:'地形模型 · 观测与待核'}};
}

export function validateWcrossUpstream(data,byId=new Map()){return validateAncillary(data,byId,WCROSS_UPSTREAM_LAYER);}
export function validateOwnerBlue(data,byId=new Map()){if(data?.features?.length!==9)throw new Error('不是九条原蓝笔');return validateAncillary(data,byId,OWNER_BLUE_LAYER);}
function validateAncillary(data,byId,layer){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length) throw new Error('专题为空');
 const seen=new Set();
 for(const f of data.features){
  const p=f?.properties;
  const spec=(layer===OWNER_BLUE_LAYER?{owner_blue_sketch:['candidate','LineString']}:{observed_outline:['observed','LineString'],diffuse_observation:['observed','Polygon'],search_window:['modeled','Polygon'],terrain_only_approach:['modeled','LineString'],alternative_dsm_approach:['modeled','LineString'],schematic_road_uncertainty_gap:['gap','LineString']})[p?.feature_role];
  if(f?.type!=='Feature'||typeof f.id!=='string'||!f.id.trim()||seen.has(f.id)||byId.has(f.id)||!geom(f.geometry)||!(p?.layer===layer||(layer===WCROSS_UPSTREAM_LAYER&&p?.layer===WCROSS_FAR_LAYER&&['alternative_dsm_approach','schematic_road_uncertainty_gap'].includes(p.feature_role)))||
     !Array.isArray(spec)||p.status!==spec[0]||f.geometry.type!==spec[1]||p.hydraulic_link_confirmed===true||p.is_confirmed_waterway===true||(layer===OWNER_BLUE_LAYER&&(p.ink!=='blue'||p.direction!=null))||
     ![p.name,p.description,p.placement_caveat,p.source].every(x=>typeof x==='string'&&x.trim())) throw new Error('无效专题要素：'+f?.id);
  seen.add(f.id);
 }
 return data.features;
}
