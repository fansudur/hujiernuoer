// Canonical two-level entry. Legacy apps are never imported by this module.
import {createEvidenceReader} from './evidence-reader.js';
window.lakeReader=createEvidenceReader();
window.lakeVersion={id:'spatial-narrative-v14',entry:'index.html',legacy:'legacy.html',scientificBaseline:'2026-10-26-report / v6.2 spatial data'};
function loadingStep(done,label){const p=document.getElementById('canonical-loading-progress'),s=document.getElementById('canonical-loading-stage'),d=document.getElementById('canonical-loading-detail');if(p)p.value=done;if(s)s.textContent=label;if(d)d.textContent=done+' / 6 项准备完成 · 实际准备步骤，不是下载百分比';}
try {
  loadingStep(0,'正在读取地形、影像索引与水面记录…');
  await import('./process-explorer.js?v=profile-linkage-20261103b');loadingStep(1,'地图基础已就绪，正在整理讲解章节…');
  await import('./unified-story.js');loadingStep(2,'章节已就绪，正在定位各专业图层…');
  await import('./native-spatial-story.js');loadingStep(3,'空间图层已就绪，正在准备地图操作…');
  await import('./attention-director.js');
  const {initHistoricalSourceBoard}=await import('./historical-source-board.js');initHistoricalSourceBoard();
  const {initVisualControls}=await import('./visual-controls.js');initVisualControls();
  const {initLayerControls}=await import('./layer-controls.js');initLayerControls();
  const {initEvidenceTools}=await import('./evidence-tools.js');initEvidenceTools();
  const {initAccessUI}=await import('./access-ui.js');await initAccessUI();
  const dataLink=document.createElement('a');dataLink.id='px-data-core';dataLink.href='research-core/index.html';dataLink.target='_blank';dataLink.rel='noopener';dataLink.textContent='数据与复算';dataLink.style.cssText='color:inherit;font:inherit;padding:6px 9px;white-space:nowrap';document.querySelector('.px-header nav')?.append(dataLink);
  loadingStep(4,'地图操作已就绪，正在准备观测时间轴…');
  const {initExpertControls}=await import('./expert-controls.js');initExpertControls();
  const {initObservationTimeline}=await import('./observation-timeline.js');await initObservationTimeline();
  loadingStep(5,'时间轴已就绪，正在准备第一幕影像…');
  const {initSimpleGuide}=await import('./simple-guide.js');await initSimpleGuide();
  const {initShareState}=await import('./share-state.js');await initShareState();
  loadingStep(6,'地图已准备完成');
  document.getElementById('canonical-loading')?.remove();
  document.documentElement.dataset.lakeReady='true';
  window.dispatchEvent(new Event('lake-ready'));
} catch(error) {
  console.error('Canonical lake entry failed',error);
  const loading=document.getElementById('canonical-loading');
  if(loading){loading.replaceChildren();const h=document.createElement('h1');h.textContent='部分资料未能载入';const p=document.createElement('p');p.textContent='不会转跳旧版。可以重试，或先阅读完整证据。';const retry=document.createElement('button');retry.textContent='重新载入';retry.onclick=()=>location.reload();const read=document.createElement('button');read.textContent='阅读研究报告';read.onclick=()=>window.lakeReader.open();loading.append(h,p,retry,read);}
}
