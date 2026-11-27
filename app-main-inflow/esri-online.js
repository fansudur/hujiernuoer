// On-demand ArcGIS Imagery Standard. No imagery, token, or generated image is persisted.
import {mercatorX,mercatorY} from './esri-atlas-windows.mjs?v=1';
export const ESRI_ATTRIBUTION='Esri, Vantor, Earthstar Geographics, and the GIS User Community';
const MAX_TILES=220, CONCURRENCY=8;
export async function loadEsriBasemap(bounds,signal,zoom){
 const [west,south,east,north]=bounds||[];
 if(![west,south,east,north].every(Number.isFinite)||west>=east||south>=north||Math.abs(north)>85||Math.abs(south)>85)throw new Error('图谱范围尚未载入。');
 const renderSize=256;
 const scale=2**zoom*renderSize;
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
    const url='/atlas-esri/tile/'+zoom+'/'+y+'/'+x;
    const r=await fetch(url,{credentials:'omit',redirect:'error',signal:requestSignal});
    if(!r.ok)throw Error('Esri 参考图暂不可用。');
    const bitmap=await createImageBitmap(await r.blob());
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
 const [width,height]=[canvas.width,canvas.height];
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.93));
 canvas.width=canvas.height=0;
 signal.throwIfAborted();
 if(!blob)throw new Error('浏览器无法显示该影像。');
 return {url:URL.createObjectURL(blob),bounds_wgs84:[...bounds],attribution:ESRI_ATTRIBUTION,tileCount:jobs.length,dimensions:[width,height]};
}
