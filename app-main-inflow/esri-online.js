// On-demand ArcGIS Imagery Standard. No imagery, token, or generated image is persisted.
export const ESRI_BASEMAP_ID='esri-online';
export const ESRI_ATTRIBUTION='Esri, Vantor, Earthstar Geographics, and the GIS User Community';
const STANDARD='https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery/standard?echoToken=false';
const ZOOM=15, MAX_TILES=220, CONCURRENCY=8;
const mercatorY=(lat,scale)=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)*scale/2;
const mercatorX=(lon,scale)=>(lon+180)*scale/360;
function authorizedUrl(value){
 const u=new URL(value,STANDARD);
 if(u.protocol!=='https:'||u.username||u.password||!/(^|\.)(arcgis\.com|arcgisonline\.com)$/i.test(u.hostname))
   throw new Error('影像服务返回了不受支持的地址。');
 return u;
}
async function response(url,key,signal){
 const r=await fetch(authorizedUrl(url),{credentials:'omit',redirect:'error',signal,headers:{Authorization:'Bearer '+key}});
 if(!r.ok)throw new Error(r.status===401||r.status===403?'API Key 无效、权限不足，或未授权当前网址。':'Esri 服务未能返回影像（HTTP '+r.status+'）。');
 return r;
}
async function rasterSource(key,signal){
 const style=await (await response(STANDARD,key,signal)).json();
 if(style.error)throw new Error('Esri 未授权此请求；检查底图权限和网址限制。');
 const source=Object.values(style.sources||{}).find(x=>x.type==='raster');
 if(!source)throw new Error('Esri 未返回可用的卫星瓦片。');
 let info=source;
 if(!source.tiles?.length&&source.url){
   const u=authorizedUrl(source.url);
   if(/\/MapServer\/?$/i.test(u.pathname)){
     u.searchParams.set('f','json');
     const doc=await(await response(u,key,signal)).json();
     const prefix=u.origin+u.pathname.replace(/\/$/,'');
     info={...source,tiles:[prefix+'/tile/{z}/{y}/{x}'],tileSize:doc.tileInfo?.rows};
   }else info={...source,...await(await response(u,key,signal)).json()};
 }
 const template=info.tiles?.find(url=>typeof url==='string'&&['{z}','{y}','{x}'].every(tag=>url.includes(tag)));
 if(!template)throw new Error('没有找到兼容的 Esri 瓦片地址。');
 if(info.scheme&&info.scheme!=='xyz')throw new Error('不支持此瓦片坐标格式。');
 return {template,size:Number(info.tileSize)||256};
}
export async function loadEsriBasemap(bounds,key,signal){
 const [west,south,east,north]=bounds||[];
 if(![west,south,east,north].every(Number.isFinite)||west>=east||south>=north||Math.abs(north)>85||Math.abs(south)>85)throw new Error('图谱范围尚未载入。');
 const {template,size}=await rasterSource(key,signal);
 if(![256,512].includes(size))throw new Error('不支持此瓦片尺寸。');
 const renderSize=256; // Keep the temporary canvas within mobile GPU memory budgets.
 const scale=2**ZOOM*renderSize;
 const x0=mercatorX(west,scale),x1=mercatorX(east,scale);
 const y0=mercatorY(north,scale),y1=mercatorY(south,scale);
 const left=Math.floor(x0/renderSize),right=Math.ceil(x1/renderSize)-1,top=Math.floor(y0/renderSize),bottom=Math.ceil(y1/renderSize)-1;
 const jobs=[];
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)jobs.push([x,y]);
 if(!jobs.length||jobs.length>MAX_TILES)throw new Error('当前图谱超出在线底图的预览范围。');
 const raw=document.createElement('canvas');
 raw.width=(right-left+1)*renderSize;raw.height=(bottom-top+1)*renderSize;
 const layer=raw.getContext('2d',{alpha:false});
 const internal=new AbortController();
 const requestSignal=AbortSignal.any([signal,internal.signal]);
 let cursor=0;
 try{
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,jobs.length)},async()=>{
   while(!requestSignal.aborted&&cursor<jobs.length){
    const [x,y]=jobs[cursor++];
    const url=template.replaceAll('{z}',ZOOM).replaceAll('{x}',x).replaceAll('{y}',y);
    const bitmap=await createImageBitmap(await(await response(url,key,requestSignal)).blob());
    try{layer.drawImage(bitmap,(x-left)*renderSize,(y-top)*renderSize,renderSize,renderSize);}
    finally{bitmap.close();}
   }
  }));
 }catch(e){internal.abort();throw e;}
 signal.throwIfAborted();
 // The existing atlas uses geographic coordinates, not the tiles' Web Mercator.
 const canvas=document.createElement('canvas');
 canvas.width=Math.min(4096,Math.max(1,Math.round(x1-x0)));
 canvas.height=Math.min(4096,Math.max(1,Math.round((y1-y0)*canvas.width/(x1-x0))));
 const out=canvas.getContext('2d',{alpha:false});
 const x=x0-left*renderSize;
 for(let row=0;row<canvas.height;row++){
  const y=mercatorY(north-(north-south)*row/canvas.height,scale)-top*renderSize;
  const next=mercatorY(north-(north-south)*(row+1)/canvas.height,scale)-top*renderSize;
  out.drawImage(raw,x,y,x1-x0,next-y,0,row,canvas.width,1);
 }
 raw.width=raw.height=0;
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.93));
 canvas.width=canvas.height=0;
 signal.throwIfAborted();
 if(!blob)throw new Error('浏览器无法显示该影像。');
 return {id:ESRI_BASEMAP_ID,url:URL.createObjectURL(blob),bounds_wgs84:[...bounds],attribution:ESRI_ATTRIBUTION,tileCount:jobs.length};
}
