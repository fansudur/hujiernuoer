import {RENDER_DEMO_NOTICE} from '../custom/scene-quality.js';
// Uses the app's single playback owner; camera and observational clock remain fixed.
export async function playNearshoreRain(app){
 const scene=app.scene;
 if(!['immersive','shore'].includes(scene.viewExperience))return '请先进入近岸虚拟机位。';
 if(scene.visualReducedMotion||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return '减少动态效果已开启；请关闭后再播放示意雨景。';
 const camera=scene.camera,position=camera.position.clone(),target=scene.controls.target.clone(),topView=scene.topView,up=camera.up?.clone();
 // fit() replaces scene.camera. Restore the live camera, including the short
 // near clip needed at a 1.7 m eye height, rather than the discarded instance.
 const projection={},limits={};
 for(const key of ['near','far','fov','zoom','aspect','left','right','top','bottom','filmGauge','filmOffset','focus'])if(key in camera)projection[key]=camera[key];
 for(const key of ['minDistance','maxDistance','minPolarAngle','maxPolarAngle','minAzimuthAngle','maxAzimuthAngle','minZoom','maxZoom'])if(key in scene.controls)limits[key]=scene.controls[key];
 const restore=()=>{const live=scene.camera;Object.assign(live,projection);live.position.copy(position);if(up)live.up.copy(up);live.updateProjectionMatrix?.();scene.controls.object=live;Object.assign(scene.controls,limits);scene.controls.target.copy(target);scene.topView=topView;scene.controls.update();scene.render();};
 app.stop();
 if(app.state.theme!=='rain'){
  app.changeTheme('rain');restore();const playToken=app.state.playToken;
  // changeTheme starts a non-returned load. Await a token-guarded refresh so
  // only the newest load installs state before playback starts.
  await app.renderTheme();if(app.state.playToken!==playToken)return '播放请求已取消；保持暂停。';restore();
 }
 if(app.state.theme!=='rain'||scene.state.theme!=='rain'||!['immersive','shore'].includes(scene.viewExperience))return '场景已切换或资料尚未就绪；未启动雨景。';
 await app.play();return '正在当前近岸机位播放示意雨景；年月、场景日与太阳时不变。可用“暂停过程”停止。';
}
// Independent renderer controls. They don't edit the research dataset or clock.
export function initVisualControls(){
 const app=window.lakeProcess,scene=app?.scene,toolbar=document.querySelector('.px-map-toolbar');if(!scene||!toolbar||document.getElementById('visual-settings-open'))return;
 const button=document.createElement('button');button.id='visual-settings-open';button.textContent='画质 / 天气演示';button.setAttribute('aria-label','调整显示画质和示意天气，不更改研究数据');toolbar.append(button);
 const dialog=document.createElement('dialog');dialog.id='visual-settings';dialog.innerHTML='<div class="dialog-head"><h2>画面效果，不是新增测量</h2><button type="button" data-close>关闭</button></div><p data-notice></p><div style="display:grid;gap:18px;padding:14px 0"><label>画质 <select id="visual-quality"><option value="low">轻量 · 低像素密度与粒子数</option><option value="balanced">平衡</option><option value="high">较高 · 更多粒子</option></select></label><label><input id="visual-motion" type="checkbox"> 暂停云、雨滴与过程动态</label><fieldset><legend>仅在降雨专题与播放状态生效</legend><label style="display:block;margin:12px 0">示意雨量强度 <input id="visual-rain" type="range" min="0" max="1" step=".05"><output id="visual-rain-label"></output></label><label style="display:block;margin:12px 0">示意云量 <input id="visual-cloud" type="range" min="0" max="1" step=".05"><output id="visual-cloud-label"></output></label><button type="button" id="visual-shore-rain">在近岸播放雨景（示意）</button><p id="visual-rain-status" role="status">先进入近岸虚拟机位，再点此按钮；保留当前日期和镜头。</p><small>这里的百分比只调粒子数量和天空视觉覆盖，不是毫米降水或实测云量。太阳仍按已选日期和太阳时计算。</small></fieldset></div><p>水域分类显示采用既有 616 米参考面与约 2 米绘图偏移；它不是当月实测水位。历史地形不含湖底，因此不能从渲染图读取水深或通行安全。</p><p>浏览器三维支持、屏幕与显卡会影响效果；高画质不是更高科学精度。系统“减少动态效果”设置始终优先。</p>';
 dialog.querySelector('[data-notice]').textContent=RENDER_DEMO_NOTICE;document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);const sync=()=>{$('visual-shore-rain').disabled=!['immersive','shore'].includes(scene.viewExperience);$('visual-quality').value=scene.visualQuality||'balanced';$('visual-motion').checked=!!scene.visualReducedMotion;$('visual-rain').value=scene.weatherDemo?.rainIntensity??.55;$('visual-cloud').value=scene.weatherDemo?.cloudCover??.82;$('visual-rain-label').value=Math.round(+$('visual-rain').value*100)+'%（视觉）';$('visual-cloud-label').value=Math.round(+$('visual-cloud').value*100)+'%（视觉）';};
 button.onclick=()=>{sync();if(!dialog.open)dialog.showModal();};dialog.querySelector('[data-close]').onclick=()=>dialog.close();$('visual-quality').onchange=e=>scene.setVisualQuality(e.target.value);$('visual-motion').onchange=e=>{scene.visualReducedMotion=e.target.checked;scene.render();};for(const id of ['visual-rain','visual-cloud'])$(id).oninput=()=>{scene.setWeatherDemo({rainIntensity:+$('visual-rain').value,cloudCover:+$('visual-cloud').value});sync();};
 $('visual-shore-rain').onclick=async()=>{const b=$('visual-shore-rain');b.disabled=true;try{$('visual-rain-status').textContent=await playNearshoreRain(app);}catch(e){app.stop();$('visual-rain-status').textContent='雨景未能载入，已暂停；请稍后重试。';}finally{sync();}};
 window.lakeVisualSettings={open:()=>button.click(),getState:()=>({quality:scene.visualQuality||'balanced',reducedMotion:!!scene.visualReducedMotion,weather:{...scene.weatherDemo},kind:'rendering-demo-not-observation'})};
}
