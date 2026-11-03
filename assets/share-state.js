// Relative query state works on a static mirror or local HTTP server, without rewrites.
export const CHAPTERS=['history','shore','season','runoff','exposure','production','context','livelihoods','synthesis'];
export function readShareState(url){const q=new URL(url,'https://example.invalid/').searchParams;const mode=q.get('mode')==='expert'?'expert':'simple',chapter=CHAPTERS.includes(q.get('chapter'))?q.get('chapter'):null,m=q.get('month'),month=/^\d{4}-(0[1-9]|1[0-2])$/.test(m||'')&&m>='1984-04'&&m<='2026-12'?m:null,raw=q.get('step'),step=raw!==null&&/^\d+$/.test(raw)?Math.max(0,Math.min(5,Number(raw)-1)):null;return {mode,chapter,month,step,hasState:['mode','chapter','month','step'].some(k=>q.has(k))};}
export function writeShareURL(url,state){const u=new URL(url,'https://example.invalid/');for(const k of ['mode','chapter','month','step'])u.searchParams.delete(k);u.searchParams.set('mode',state.mode);if(state.chapter)u.searchParams.set('chapter',state.chapter);if(state.month)u.searchParams.set('month',state.month);if(state.mode==='simple')u.searchParams.set('step',String((state.index||0)+1));return u.pathname+u.search+u.hash;}
export async function initShareState(){
 const app=window.lakeProcess,story=window.lakeStory,guide=window.lakeSimpleGuide;if(!app||!story||!guide)return;
 let restoring=false,generation=0,saveGeneration=0;
 function snapshot(){const g=guide.getState();return {mode:g.mode,index:g.index,chapter:story.getState().stage,month:app.state.date};}
 async function restore(){const token=++generation;++saveGeneration;restoring=true;const target=readShareState(location.href);try{
  if(!target.hasState){const current=guide.getState();if(current.mode!=='simple')await guide.setMode('simple');if(token!==generation)return;if(guide.getState().index!==0)await guide.show(0);return;}
  app.stop();guide.stop();await guide.setMode(target.mode);if(token!==generation)return;
  if(target.mode==='expert'){if(target.chapter)story.selectStage(CHAPTERS.indexOf(target.chapter));if(target.month)await app.setClockMonth(target.month);if(token!==generation)return;await app.whenSceneReady({date:app.state.date,stage:story.getState().stage,isCurrent:()=>token===generation});}
  else{let step=target.step;if(step===null&&target.month){step=guide.frames.findIndex(f=>f.date===target.month&&(!target.chapter||f.stage===target.chapter));}if(step!==null&&step>=0)await guide.show(step);}
 }catch(error){console.warn('Requested map link could not be fully restored',error);}finally{if(token===generation){restoring=false;history.replaceState(null,'',writeShareURL(location.href,snapshot()));}}}
 async function save(event){if(restoring)return;const token=++saveGeneration,g=guide.getState();if(g.busy)return;if(g.mode==='simple'&&event?.type!=='lake-simple-committed'&&event?.type!=='lake-reading-mode')return;const before=snapshot();if(event?.type==='lake-simple-committed'&&globalThis.document?.body?.classList?.contains('lake-design-preview')){
   // This event is emitted only after applyFrame has passed the readiness barrier.
   // Commit URL in the same task as the visible frame, not after another async wait.
   const d=event.detail;if(d&&(d.index!==before.index||d.date!==before.month||d.stage!==before.chapter))return;
   const url=writeShareURL(location.href,before);if(url!==location.pathname+location.search+location.hash)history[g.playing?'replaceState':'pushState'](null,'',url);return;
  }try{const ready=await app.whenSceneReady({date:before.month,stage:before.chapter,isCurrent:()=>token===saveGeneration&&!restoring});if(!ready)return;}catch{return;}if(token!==saveGeneration||restoring)return;const now=snapshot(),url=writeShareURL(location.href,now),current=location.pathname+location.search+location.hash;if(url===current)return;const replace=app.state.playing||guide.getState().playing||event?.type==='lake-reading-mode';history[replace?'replaceState':'pushState'](null,'',url);}
 window.addEventListener('popstate',restore);for(const name of ['lake-simple-committed','lake-reading-mode','lake-story-stage','lake-process-rendered'])window.addEventListener(name,save);
 await restore();if(!readShareState(location.href).hasState)history.replaceState(null,'',writeShareURL(location.href,snapshot()));
 window.lakeShareState={getURL:()=>new URL(writeShareURL(location.href,snapshot()),location.href).href,restore};
}
