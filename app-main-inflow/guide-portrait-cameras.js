// Phone portrait captures use their original viewport for proportional offsets. Array fields:
// longitude, latitude, eye height (scene m), heading, pitch, vertical FOV, viewport offset X/Y, outside-DEM datum.
const make=([lon,lat,eyeM,heading,pitch,directorFov,x,y,guideOriginM],[width,height]=[393,852])=>Object.freeze({
 lon,lat,eyeM,heading,pitch,directorFov,guideOriginM,portraitOffset:[x/width,y/height],site:'guided',
});
const phone402=fields=>make(fields,[402,714]);
const phone682=fields=>make(fields,[402,682]);
const nw=phone402([119.70765633719252,49.05198001043784,17599.37520680059,1.759999999999991,-69,60,0,101,627.8500517646572]);
const opening=[
 [0,nw],
 [33.290,make([119.67596072264291,49.08230753544127,11969.765092110576,1.54,-69.2,60,0,121,638.8587932434145])],
 [44.985,make([119.68734359147994,49.1098355268412,8757.341317674964,2.64,-69.4,60,0,121])],
 [57.900,make([119.67654564906853,49.082046036698586,12920.061023010832,1.10,-70.2,60,0,121,642.0470799357589])],
 [69.715,make([119.66598311860844,49.106319598609396,7525.670061462098,1.10,-70.2,60,0,121])],
];
const final=phone682([119.69628966619837,49.09990755158544,15470.826078620266,0.22000000000002728,-81.73333333333333,60,0,96,629.4669231641178]);
const bridgeClose=phone402([119.64983796036259,49.14942970957515,69.15414456053796,175.56666666666592,-10.933333333333314,60,122,128]);
const crossings=make([119.69301782552321,49.14193714532206,1499.6433943879567,283.2799999999909,-36.39999999999984,60,-18,108]);
const bridgeGap=make([119.64983796036259,49.14942970957515,69.15414456053796,173.8066666666657,-9.533333333333317,60,119,153]);
const bridgeEast=make([119.64674207218796,49.16696744104409,655.3410700227222,159.5066666666637,-17.933333333333294,60,119,153]);
const south=phone682([119.69699282880582,49.07327614051553,15852.97113038894,0.88,-72.6,60,-1,96,641.4769939891013]);
const revised=Object.freeze(Object.fromEntries(Object.entries({
 'runoff-upper-slope':[119.53290238574918,49.126654723448645,6850.282546243865,89.5,-40.39999999999993,60,0,127,692.2868445311179],
 'runoff-west':[119.57341666280367,49.189833312308714,7391.195763095537,117.7569972666779,-48.78700022025294,42,178,76,680.6422049618777],
 'runoff-field-bands-05':[119.6627265242907,49.11352020386618,2314.8427538988713,358.3431226173002,-36.50844190100926,51.41160006979897,-2,117],
 'history-200405':[119.70799920598203,49.124235545311485,1143.5758448894926,305.1138062605296,-22.355413210550065,42,0,101],
}).map(([id,fields])=>[id,phone402(fields)])));
const shots=Object.freeze(Object.fromEntries(Object.entries({
 'road-nw-approach':[119.67477742759334,49.14300402147253,40.85811513659337,261.4881252409516,-4.7,42,0,121],
 'road-nw-gully':[119.6961529647348,49.12859693504906,695.1649263606365,306.32,-17.8,53.29027804335074,0,121],
 'kmz-outer-options':[119.68262365680606,49.11793449227682,6394.21583500279,3.74,-65.2,42,-154,113],
 'east-marsh-source':[119.68308173188403,49.12689656368233,4791.963408755842,1.98,-63.4,60,0,122],
 'east-pool-source':[119.68876732502298,49.131258802261165,6044.761750688649,358.46,-72.2,60,-1,120],
 'east-connection-check':[119.68294104627321,49.12526400380222,7577.075155765093,.88,-72.6,60,-1,120],
 'runoff-main-entrance-context':[119.67573788037379,49.10985434427851,9626.671267710288,1.98,-72.6,60,-1,120],
 'road-round':[119.64491954434796,49.13235994276293,168.25890175309607,81.0725,-22.6,60,0,121],
}).map(([id,fields])=>[id,make(fields)])));
const shared=Object.freeze({
 'runoff-bridge':bridgeClose,'runoff-cross-gap':bridgeGap,'runoff-east':bridgeEast,
 'runoff-apron-gap':crossings,'kmz-north-to-crossings':crossings,
 'runoff-bend-gap':phone682([119.65227214298875,49.158580990083955,417.4774488707431,161.70000000000232,-21.066666666666702,60,1,86]),
 'runoff-se':phone682([119.64892266883726,49.16646992455742,1125.0072040017628,158.25333333333356,-28.00000000000005,60,1,86]),
 'road-b-southeast':south,'road-c-south-central':south,
 'lake-west':final,'lake-office-caution':final,'chapter-closing':final,
});
export function portraitGuidePair(id,seconds){
 const sameView=({ 'history-201309':'history-200405','history-202109':'history-200405' })[id]??id;
 if(id!=='chapter-opening'){
   const shot=shared[sameView]??revised[sameView]??shots[sameView];
   return shot?[shot,shot,0]:null;
 }
 // Keep the opening pose through the full bridge-downstream cue.
 const firstChange=opening[1][0], glide=2.2;
 if(seconds<firstChange+glide){
   const t=Math.max(0,(seconds-firstChange)/glide);
   return [nw,opening[1][1],t*t*(3-2*t)];
 }
 const next=opening.findIndex(([end])=>end>seconds);
 if(next<=0){const shot=next===0?nw:opening.at(-1)[1];return [shot,shot,0];}
 const [end,to]=opening[next], [,from]=opening[next-1];
 const t=Math.min(1,Math.max(0,(seconds-end+2.2)/2.2));
 return [from,to,t*t*(3-2*t)];
}
// These consecutive observations share a visual itinerary. This selects camera
// continuity only: the dashed evidence, gaps and hydrology remain independent.
const continuousPortraitRuns=[
 ['chapter-opening','runoff-se'],
 ['kmz-north-to-crossings','chapter-closing'],
];
export function followsPortraitItinerary(book,from,to){
 const ids=book.flatMap(r=>r.steps.map(s=>s.id));
 const a=ids.indexOf(from), b=ids.indexOf(to);
 return a>=0&&b>=0&&Math.abs(a-b)===1&&continuousPortraitRuns.some(([start,end])=>
   Math.min(a,b)>=ids.indexOf(start)&&Math.max(a,b)<=ids.indexOf(end));
}
export const portraitGuideImages=Object.freeze({
 'east-pool-source':'ge-root-202107-2','east-connection-check':'ge-root-202209-2',
});

