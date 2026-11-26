import {geometryBounds} from './terrain-math.js';
export const CONTOUR_DEFAULT_INTERVAL=5;
export const CONTOUR_CHOICES=[10,5,2];
export const CONTOUR_LAYER='modern-contour-pick';
const goodCoords=a=>Array.isArray(a)&&a.length>=2&&a.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite));
export function normalizeContours(data,step){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length)throw new Error('等高线数据无效');
 const ids=new Set();
 return data.features.map(f=>{
  const p=f?.properties,e=p?.elevation_m,g=f?.geometry,key=p?.id||f?.id;
  if(f?.type!=='Feature'||(g?.type!=='LineString'||!goodCoords(g.coordinates))||!Number.isFinite(e)||e%step!==0
    ||p.interval_m!==step||p.index_contour!==(e%10===0)||typeof key!=='string'||!key.length||ids.has(key))throw new Error('等高线与所选间隔不符');
  ids.add(key);
  return {...f,id:`map-contour-${step}m-${key}`,bbox:geometryBounds(g),properties:{...p,layer:CONTOUR_LAYER,
    status:'modeled',is_contour:true,name:`${e} 米等高线`,description:`这条线的标称地表高程为 ${e} 米，未作三维垂向夸张。图层源自 30 米地表模型；等高距不是测量精度，不代表沟底、湖底或现场测量。`}};
 });
}
export function contourSelection(source,step){
 return step===10 ? source.filter(f=>f.properties.elevation_m%10===0) : source;
}
export const nearbyContours=(features,location,padLon,padLat)=>{
 if(!location||!features?.length)return [];
 const [x,y]=location;
 return features.filter(f=>{const b=f.bbox;return !b||(x>=b[0]-padLon&&x<=b[2]+padLon&&y>=b[1]-padLat&&y<=b[3]+padLat);});
};
