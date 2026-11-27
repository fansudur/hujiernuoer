// Review-specific decisions: preserve map evidence by purpose, not by a broad layer toggle.
export const BRIDGE_REVIEW_STOPS=new Set(['runoff-main-entrance-context','lake-office-caution','chapter-closing']);
export const WF1_MODELS=['hjn-seasonal-wf1-cop','hjn-seasonal-wf1-aw'];
export const CONTEXT_GUIDE_LINES=Object.freeze({
 'road-c-south-central':['main-profile-southeast-inlet'],
 'road-round-approach':['main-profile-southeast-inlet'],
 'lake-west':['wcross2-west-extension-approach']
});
export const easeGuide=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
export function openingPinNumbers(cue){
 return cue?.anchorIds?.includes('hjn-03-road-pin-02')?[2,4]:[];
}
