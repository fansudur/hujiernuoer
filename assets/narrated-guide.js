// Preview-only transport. The scene commit and media ended event are the only clocks.
function createPreviewAudio(src){const media=new Audio(src);media.id='atlas-narration-audio';media.hidden=true;media.preload='none';media.setAttribute('aria-label','合成语音讲解');document.body.append(media);return media;}
export function createNarratedGuideController({applyFrame,onState=()=>{},onCommit=()=>{},onError=()=>{},frames,segments=[],createAudio=createPreviewAudio}){
 let ready=false,index=0,pendingIndex=null,playing=false,busy=false,generation=0,disposed=false,audio=null,mediaIndex=null,playPending=false,status='idle',muted=false;
 const state=()=>({index,pendingIndex,playing,busy,total:frames.length,status,muted,currentTime:audio?.currentTime||0});
 const emit=()=>onState(state());
 function release(){if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute?.('src');audio.load?.();audio.remove?.();}audio=null;mediaIndex=null;playPending=false;}
 function stop(){if(busy)ready=false;++generation;playing=false;busy=false;pendingIndex=null;release();status='idle';emit();}
 function fail(message){++generation;playing=false;release();status=message;emit();}
 function start(){
  if(disposed||busy)return;const segment=segments.find(s=>s.frameIndex===index);
  if(!segment?.src){fail('unavailable');return;}
  // Self-hosted reviewed assets only; never invoke speechSynthesis or a provider.
  if(!/^assets\/audio\/[a-zA-Z0-9_./-]+\.mp3$/.test(segment.src)||segment.src.includes('..')){fail('unavailable');return;}
  if(!audio||mediaIndex!==index){release();audio=createAudio(segment.src);mediaIndex=index;audio.preload='none';audio.muted=muted;}
  const media=audio,token=++generation;playing=true;status='loading';playPending=true;
  media.onended=()=>{if(token!==generation||media!==audio||!playing)return;if(index===frames.length-1){playing=false;status='complete';release();emit();}else show(index+1,{continuePlay:true});};
  media.onerror=()=>{if(token===generation&&media===audio)fail('load-error');};emit();
  try{Promise.resolve(media.play()).then(()=>{if(token!==generation||media!==audio||!playing){media.pause();return;}playPending=false;status='playing';emit();},error=>{if(token===generation&&media===audio)fail(error?.name==='NotAllowedError'?'blocked':'load-error');});}catch(error){if(token===generation)fail(error?.name==='NotAllowedError'?'blocked':'load-error');}
 }
 function pause(){++generation;playing=false;audio?.pause();
  // A still-pending play() can resolve late. Retire that element so it cannot stop a resumed one.
  if(playPending){const time=audio?.currentTime||0,src=segments.find(s=>s.frameIndex===index)?.src;release();if(src){audio=createAudio(src);audio.currentTime=time;mediaIndex=index;audio.muted=muted;}}
  status='paused';emit();
 }
 async function show(next,{continuePlay=false}={}){
  if(disposed)return;stop();const requested=Math.max(0,Math.min(frames.length-1,next));pendingIndex=requested;ready=false;busy=true;playing=continuePlay;status='preparing';const token=generation;emit();
  try{const applied=await applyFrame(frames[requested],requested,()=>!disposed&&token===generation);
   if(token!==generation||disposed)return;if(applied===false){playing=false;status='idle';return;}
   index=requested;pendingIndex=null;busy=false;ready=applied?.narrationReady!==false;onCommit(frames[index],index);status=ready?'idle':'comparison-unavailable';playing=continuePlay&&ready;emit();if(continuePlay&&ready)start();
  }catch(error){if(token===generation&&!disposed){playing=false;status='scene-error';onError(error);}}
  finally{if(token===generation&&!disposed){busy=false;pendingIndex=null;emit();}}
 }
 function toggle(){if(disposed)return;if(busy){stop();return;}if(playing){pause();return;}if(!ready)return show(index,{continuePlay:true});if(status==='complete')return show(0,{continuePlay:true});start();}
 return {show,toggle,stop,getState:state,setMuted(value){muted=!!value;if(audio)audio.muted=muted;emit();},dispose(){stop();disposed=true;}};
}
