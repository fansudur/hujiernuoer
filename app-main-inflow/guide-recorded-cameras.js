// Owner captures, v102, 2560 × 1305. Coordinates are camera poses, not hydrology geometry.
const pose=([lon,lat,eyeM,heading,pitch,directorFov])=>Object.freeze({lon,lat,eyeM,heading,pitch,directorFov});
const view={
 'opening-nw':pose([119.68737972440637,49.10723751604655,7502.757409624278,0,-69.2,53.03769766300133]),
 'runoff-upper-slope':pose([119.62160318027934,49.12602764085111,318.74022253722126,35.6,-15.4,53.03769766300133]),
 'bridge-start':pose([119.64776405,49.14319729698011,62.01938961235318,8.58,-13.2,42]),
 'bridge-end':pose([119.64983152,49.14483029153253,50.74925477234365,349.44,-8.8,42]),
 'runoff-cross-gap':pose([119.64983152,49.14483029153253,50.74925477234365,5.5,-9.6,42]),
 'runoff-east':pose([119.64358174894255,49.14646506678945,264.3995790910676,87.50350810395423,-18.2,42]),
 'runoff-se':pose([119.65809294458901,49.14846356969521,265.2301999920883,112.24447238935454,-18.4,84.57761010021457]),
 'runoff-apron-gap':pose([119.66016843985577,49.14266996439227,190.64334964830573,75.96,-25.8,84.57761010021457]),
 'kmz-north-to-crossings':pose([119.6777925942404,49.13705509714098,562.0373389110424,294.66,-16.8,42]),
 'road-nw-gully':pose([119.69339585220041,49.14179933372189,878.8642348398226,263.2,-21.2,41.29027804335074]),
 'runoff-main-entrance-context':pose([119.74920340061101,49.138664327059374,7502.757409624278,270.9,-52.6,33.25936225980924]),
 'shared-south':pose([119.6854047025999,49.111033600746126,7230.666286300895,359.56,-72.2,53.03769766300134]),
 'road-round':pose([119.64804216044669,49.1327028838667,156.53298695229586,77.3325,-23.6,53.03769766300134])
};
export const SHARED_SOUTH_STOPS=new Set(['road-b-southeast','road-c-south-central','lake-office-caution','chapter-closing']);
export const OPENING_NW_POSE=view['opening-nw'];
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function blendGuidePose(a,b,w){
 if(w<=0)return {...a};if(w>=1)return {...b};
 const q={...b};
 for(const k of ['lon','lat','eyeM','pitch','directorFov']){
  if(Number.isFinite(a[k])&&Number.isFinite(b[k]))q[k]=a[k]+(b[k]-a[k])*w;
 }
 q.heading=(a.heading+(((b.heading-a.heading+540)%360)-180)*w+360)%360;
 return q;
}
export function recordedGuidePose(id,seconds){
 if(id==='runoff-bridge')return blendGuidePose(view['bridge-start'],view['bridge-end'],smooth((seconds-.56)/(17.25-.56)));
 if(SHARED_SOUTH_STOPS.has(id))return view['shared-south'];
 return id==='runoff-east'||id==='runoff-se'?null:view[id]||null;
}
export function recordedTravelLead(id,progress){
 if(id!=='runoff-east'&&id!=='runoff-se')return null;
 // Start on the reviewed composition and settle into the existing visible evidence track.
 return {start:view[id],weight:smooth(progress/.72)};
}

// Desktop captures: preserve world pose and proportionally scale the composition offset.
const desktopPose=([lon,lat,eyeM,heading,pitch,directorFov,x=0,y=0])=>
 Object.freeze({lon,lat,eyeM,heading,pitch,directorFov,desktopOffset:[x/2560,y/1305],site:'guided'});
// Desktop-only capture set. Reused poses stay fixed across shared stops.
const desktopFov=53.03769766300133;
const shot=(lon,lat,eyeM,heading,pitch,fov=desktopFov)=>desktopPose([lon,lat,eyeM,heading,pitch,fov]);
const crossingsDesktop=shot(119.67870460514698,49.14458501063403,619.349022071796,269.9000000000175,-25.399999999999977);
const historyDesktop=shot(119.6859273742244,49.141156429345926,619.349022071796,268.14000000001727,-23.599999999999984);
const eastPoolDesktop=desktopPose([119.68002929764249,49.13191980621406,2121.2397227782785,359.34,-37,42,36,233]);
const desktopShots=Object.freeze({
 'runoff-upper-slope':shot(119.6100861064306,49.13609222799051,952.1215949388045,90.82000000000414,-28.199999999999967),
 'runoff-west':shot(119.63623038256543,49.1433499007414,523.3959212881225,92.58000000000425,-26.199999999999974),
 'runoff-bridge':shot(119.64596855373993,49.14925719412843,167.75732252713556,135.48000000000627,-29.399999999999963),
 'runoff-cross-gap':shot(119.64983400505022,49.149633222639764,167.75732252713556,184.32000000001176,-19.200000000000003),
 'runoff-east':shot(119.65397175952499,49.151330002937826,275.9711096977406,176.84000000001083,-26.19999999999998),
 'runoff-bend-gap':shot(119.66079840232292,49.15355442323289,619.349022071796,190.26000000001227,-28.799999999999965),
 'runoff-se':shot(119.66079840232292,49.15355442323289,619.349022071796,162.98000000000889,-26.799999999999972),
 'runoff-field-bands-05':shot(119.66079840232292,49.15355442323289,619.349022071796,192.0200000000125,-25.999999999999975),
 'runoff-apron-gap':crossingsDesktop,'kmz-north-to-crossings':crossingsDesktop,
 'history-200405':historyDesktop,'history-201309':historyDesktop,'history-202109':historyDesktop,
 'road-nw-gully':shot(119.68744470117812,49.12790968497338,878.8642348398226,315.78000000000634,-26.399999999999977,41.29027804335074),
 'lake-office-caution':shot(119.68535373908874,49.11537349293983,5741.559716329042,359.56,-72.2,53.03769766300134),
 'east-marsh-source':desktopPose([119.67741418469713,49.135290515944746,1701.2689173162516,359.12,-37,42,36,233]),
 'east-pool-source':eastPoolDesktop,'east-connection-check':eastPoolDesktop,
 'runoff-main-entrance-context':desktopPose([119.66310178740194,49.10513595411023,4845.043470576619,4.84,-46.6,33.25936225980924]),
});
export const desktopRecordedGuidePose=id=>desktopShots[id]??null;
