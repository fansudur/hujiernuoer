// Geographic windows shared by the browser and the Cloudflare relay.
export const ATLAS_BOUNDS=Object.freeze([119.61,49.101,119.77,49.175]);
export const BRIDGE_BOUNDS=Object.freeze([119.6455,49.1437,119.6537,49.1509]);
export const OVERVIEW_ZOOM=14, BRIDGE_ZOOM=18;
export const DETAIL_ZOOMS=Object.freeze([17,16,15]);
export const mercatorY=(lat,scale)=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)*scale/2;
export const mercatorX=(lon,scale)=>(lon+180)*scale/360;
export function tileWindow([w,s,e,n],zoom){
 const scale=2**zoom;
 return {left:Math.floor(mercatorX(w,scale)),right:Math.ceil(mercatorX(e,scale))-1,
   top:Math.floor(mercatorY(n,scale)),bottom:Math.ceil(mercatorY(s,scale))-1};
}
