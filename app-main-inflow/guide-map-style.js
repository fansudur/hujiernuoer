// Shared guide style and identifiers. Canvas inset and WebGL use the same palettes.
import {ANALYSIS_PALETTE} from './atlas-visual-policy.js';
export const GUIDE_METERS_PER_DEG_LON=72800;
export const GUIDE_METERS_PER_DEG_LAT=111320;
export const GUIDE_DEFAULT_MEDIA='ge-root-202109';
export const EAST_SECTION='east-guide-marsh-cross-section';
export const EAST_COP='diag-branch-Cop_frozen30_filled_F1_NE_fade_east_pool_2025-09-22_G3320_minor0';
export const EAST_AW='diag-branch-AW3D30_sameUTM_filled_F1_NE_fade_east_pool_2025-09-22_G3320_minor0';
export const eastModelStroke=ANALYSIS_PALETTE.model.stroke, eastModelColor=parseInt(eastModelStroke.slice(1),16);
export const EAST_STYLE={
 'review-area':['#DFB164',true,0xdfb164],
 'gap-area':['#CFCBC2',true,0xcfcbc2],
 'water-ref':[ANALYSIS_PALETTE.water.stroke,false,parseInt(ANALYSIS_PALETTE.water.stroke.slice(1),16)],
 section:['#F4F1EA',true,0xf4f1ea],
 'raw-model':[eastModelStroke,true,eastModelColor],
 'model-alt':[eastModelStroke,true,eastModelColor],
 model:[eastModelStroke,true,eastModelColor],
};
export const eastDash=ref=>{
 if(ref.mode==='model-alt'||ref.mode==='raw-model'&&ref.id.includes('AW3D30'))return {km:[.025,.05],svg:'1.2 2.6'};
 if(ref.mode==='model'||ref.mode==='raw-model')return {km:[.10,.055],svg:'5.5 2.8'};
 if(ref.mode==='section')return {km:[.016,.026],svg:'1.2 1.8'};
 return {km:[.08,.05],svg:'3.5 2.2'};
};
export const GUIDE_MAIN_MODEL_STROKE='#B4A7EB';
export const GUIDE_MODEL_VARIANTS=Object.freeze({
 'main-profile-southeast-inlet':{svg:'6 2.5',km:[.125,.045]},
 'main-profile-south-central-inlet':{svg:'3.5 2.2',km:[.070,.042]},
 'main-profile-west-inlet':{svg:'7 2.5',km:[.14,.045]},
 'archive-route-wcross2':{svg:'1.2 2.6',km:[.026,.058]},
 'wcross2-west-extension-approach':{svg:'1.2 2.6',km:[.026,.058]},
 'hjn-seasonal-round-model':{svg:'3.5 2.2',km:[.061,.042]},
 'hjn-seasonal-wf1-cop':{svg:'1.2 2.6',km:[.026,.058]},
 'hjn-seasonal-wf1-aw':{svg:'5.5 2.4',km:[.096,.056]}
});
export const guideModelDash=ref=>GUIDE_MODEL_VARIANTS[ref.id]||{svg:'3.5 2.2',km:[.065,.045]};

export const modelsEast=new Set([EAST_COP,EAST_AW]);
export const isEastGuideRef=(step,ref)=>modelsEast.has(ref.id)||step.id.startsWith('east-')||['water-ref','review-area'].includes(ref.mode);
export const guideDashStyle=(step,ref)=>ref.id.startsWith('owner-05-band-')?'4.5 2.5':((modelsEast.has(ref.id)||step.id.startsWith('east-')||ref.mode==='review-area')&&EAST_STYLE[ref.mode]?.[1])?eastDash(ref).svg:ref.mode==='model'?guideModelDash(ref).svg:'none';
export const guideInsetStroke=(step,ref)=>ref.id.startsWith('owner-05-band-')?'#DFB164':isEastGuideRef(step,ref)?(EAST_STYLE[ref.mode]?.[0]||'#6ED4BA'):ref.mode==='road'?'#E4D7AE':ref.mode==='model'?GUIDE_MAIN_MODEL_STROKE:'#6ED4BA';

// Emphasis is width only. A section across several evidence segments does not
// turn those segments into a single highlighted line or create a new stroke.
export const GUIDE_FOCUS_WIDTH=0.55;
const road03Focus=Object.freeze({
 4:'hjn-v74-03-pin4-upper-neck',3:'hjn-v75-kmz-upstream-03',
 2:'road03-ge-pin2-south-gully',1:'hjn-v75-kmz-upstream-01',0:'road03-ge-common-reach',
});
export function guideFocusLineId(step,visibleRefs,{openingIds=[],point=null}={}){
 const ids=new Set(visibleRefs.filter(r=>!['road','review-area','gap-area','water-ref','band'].includes(r.mode)).map(r=>r.id));
 const valid=id=>ids.has(id)?id:null;
 if(step.id==='chapter-opening'){
   const lines=[...new Set(openingIds)].filter(id=>ids.has(id));
   return lines.length===1?lines[0]:null;
 }
 if(step.id==='road-nw-gully')return valid(road03Focus[point??4]);
 if(step.kind==='gap')return null;
 if(step.featureId&&ids.has(step.featureId))return step.featureId;
 const frame=step.director?.frameLines||[];
 if(frame.length===1&&ids.has(frame[0]))return frame[0];
 return ids.size===1?ids.values().next().value:null;
}
