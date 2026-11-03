// Presentation navigation only: the existing controllers own all map state.
export function comparisonHref(page,state={}){
 const mode=state.mode==='expert'?'expert':'simple';
 const query=new URLSearchParams({mode});
 if(mode==='expert'){
  if(state.chapter)query.set('chapter',state.chapter);
  if(state.month)query.set('month',state.month);
 }else query.set('step',String((state.index||0)+1));
 return page+'?'+query;
}
export function bindEntryLink(link,page,getState){
 const update=()=>{link.href=comparisonHref(page,getState());};
 // Keep native open-in-new-tab/context-menu navigation as current as normal clicks.
 const stateEvents=['lake-simple-committed','lake-reading-mode','lake-story-stage','lake-process-rendered'],linkEvents=['click','auxclick','contextmenu'];
 for(const event of stateEvents)window.addEventListener(event,update);
 for(const event of linkEvents)link.addEventListener(event,update);
 update();
 return ()=>{for(const event of stateEvents)window.removeEventListener(event,update);for(const event of linkEvents)link.removeEventListener(event,update);};
}
export function atlasReturnRoute(pathname,search=''){
 const name=pathname.split('/').pop();
 // Both clean hosting aliases and ordinary .html/subdirectory mirrors work.
 const page=/^design-preview(?:\.html)?$/.test(name)?'design-preview.html':'index.html';
 return page+search;
}
