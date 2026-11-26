import { STUDY_POINTS, STUDY_DRAFT } from './site-study-data.js';
export const STUDY_LAYER='ring-model-test-points';
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RING = [
  ['北',157,17],['东北',199,71],['东',304,23],['东南',465,14],
  ['南',118,13],['西南',207,0],['西',312,4],['西北',198,0],
];
export const SPRING_IDS=['sentinel2-2026-04-01','sentinel2-2026-04-08'];
function sameBounds(a,b) {return Array.isArray(a) && a.length===4 && Array.isArray(b) && a.every((v,i)=>v===b[i]);}
export function springScenes(provider) {
  const scenes = SPRING_IDS.map(id=>provider.getImagerySpec(id));
  if (!scenes[0]?.path || !scenes[1]?.path || !sameBounds(scenes[0].bounds_wgs84,scenes[1].bounds_wgs84)) return [];
  return scenes.map(im=>({date:im.time_utc.slice(0,10), path:provider.url('terrain/'+im.path), bounds:im.bounds_wgs84}));
}
export function seasonCoverage(index) {
  return ['06','07','08','09','10'].map(m=>{
    const stats=['MAIN','WF1'].map(lk=>{
      const qualified=(index?.dates||[]).filter(d=>d.slice(5)===m).map(d=>index?.lakes?.[lk]?.months?.[d]).filter(r=>['positive','zero'].includes(r?.status));
      return {total:qualified.length,disputed:qualified.filter(r=>r.classification_disputed).length};
    });
    return [Number(m),...stats];
  });
}
export function registerStudyFeatures(provider) {
  // Exact verified points only. Do not load or promote the diagnostic linework.
  if (STUDY_POINTS.length!==8 || STUDY_POINTS.some(f=>provider.analysisById.has(f.id))) return;
  provider.analysis={...provider.analysis,features:[...provider.analysis.features,...STUDY_POINTS]};
  for(const f of STUDY_POINTS) provider.analysisById.set(f.id,f);
}
export function studyPanelHtml(provider,{pointsOn=false}={}) {
  const spring=springScenes(provider);
  const points=STUDY_POINTS.filter(f=>provider.analysisById.has(f.id));
  const season=seasonCoverage(provider.waterIndex);
  return `
    <article class="drawer-card featured">
      <div class="card-kicker">本机研究 · 证据复核</div>
      <h2 class="ev-title">环湖方向、春融与景观季节</h2>
      <p class="card-note">研究点不是实测入水口，影像不是月度水面，七章试读不替换现有录音。</p>
      <button type="button" class="mini-pill" data-study-back>返回证据清单</button>
    </article>
    <details class="drawer-card tech-details" open>
      <summary>环湖八方位 · 模型复核点</summary>
      <p class="ev-judgment">东北是本轮最值得优先现场核查的近岸方向；不是已经测得的最大来水。北、东、南和东南也有局地候选。</p>
      <p class="card-note">离岸外 60–300 米，30 米候选格。下表分母是各方向测试格数，分子是两套地表 × 两套岸线四个不填洼组合中，落在同一入岸方向且落点最大间距不超过 60 米的格数。不是流量。</p>
      <table class="kv-table"><thead><tr><th scope="col">起点方位</th><th scope="col">模型一致／测试格</th></tr></thead><tbody>${RING.map(([dir,all,ok])=>`<tr><th scope="row">${dir}</th><td>${ok} / ${all}</td></tr>`).join('')}</tbody></table>
      <p class="card-note">下面 8 点采用更严口径：四次模型落到完全相同的格心。名称中的岸段是落点，不代表水一定从同名方向来；点旁不画流向。北岸月度连片明水属于另一项岸线证据，也不能判断流向。</p>
      ${points.length?`<label class="f-chip"><input type="checkbox" data-study-points ${pointsOn?'checked':''}>显示 8 个模型复核点</label>
        <div class="ev-links">${points.map(f=>`<button type="button" class="mini-pill" data-study-point="${esc(f.id)}">${esc(f.properties.name)}</button>`).join('')}</div>`:'<p>模型标记暂不可用。</p>'}
    </details>
    <details class="drawer-card tech-details">
      <summary>春季退雪 · 2026 年 4 月前后真彩</summary>
      <p class="ev-judgment">4 月 8 日比 4 月 1 日，外围陆地亮色条带明显消退，主湖仍大范围明亮。这里只比较颜色与形态，不判哪块是雪、湖冰或明水。</p>
      ${spring.length?`<div class="ev-links" role="group" aria-label="同范围真彩拍摄日">${spring.map((s,i)=>`<button type="button" class="mini-pill${i?'':' active'}" data-study-april="${i}" aria-pressed="${i?'false':'true'}">${s.date}</button>`).join('')}</div>
      <figure style="margin:8px 0"><img data-study-april-img src="${esc(spring[0].path)}" alt="${spring[0].date} 同范围 Sentinel-2 真彩" loading="lazy" style="display:block;width:100%;height:auto;border-radius:6px"><figcaption data-study-april-caption>拍摄日 ${spring[0].date} · 固定同一范围 · 不叠加月度水面</figcaption></figure>`:'<p>同范围影像暂不可用，不替换为其他日期。</p>'}
      <p class="card-note">1984–2024 冻结月表不覆盖 2026；这里切换不改变主地图统计月。2000–2024 的 25 个完整春季格点窗口中，19 年第一次连续 7 天低雪后又出现回升，不能用第一次低雪日当作最终退雪或湖冰解冻日。</p>
    </details>
    <details class="drawer-card tech-details">
      <summary>6–10 月景观季节 · 水面证据覆盖</summary>
      <p class="ev-judgment">6–8 月适合对照水面、草地与软泥；水多不等于草更好。9–10 月适合补拍秋景，主湖月面积样本明显稀疏。</p>
      <table class="kv-table"><thead><tr><th scope="col">月</th><th scope="col">主湖（争议）</th><th scope="col">西长湖</th></tr></thead><tbody>${season.map(([mo,m,w])=>`<tr><th scope="row">${mo} 月</th><td>${m.total}（${m.disputed}）</td><td>${w.total}</td></tr>`).join('')}</tbody></table>
      <div class="ev-links">${['2024-06','2024-07','2024-08','2007-10'].map(m=>`<button type="button" class="mini-pill" data-study-month="${m}">看水面月 ${m}</button>`).join('')}</div>
      <p class="card-note">仅计合格正值和有效零值；主湖 10 月两期是 2007-10、2008-10（后者有争议），不是典型秋景。不补画 9–10 月景观；可另配确切日期及覆盖已核的影像与现场照片。景观季不是放牧、上冰或开放许可。</p>
    </details>
    <details class="drawer-card tech-details">
      <summary>七章文字试读 · 暂无新录音</summary>
      <p class="card-note">新稿只供试读；旧五章录音、13 句时码与地图联动继续独立使用。五区是浏览分区，不是分水岭、所有权或活动许可。</p>
      ${STUDY_DRAFT.map(c=>`<article data-study-chapter="${c.n}"><h3 class="ev-title">${c.n}｜${esc(c.title)}</h3>${c.paragraphs.map(t=>`<p>${esc(t)}</p>`).join('')}</article>`).join('')}
    </details>`;
}
