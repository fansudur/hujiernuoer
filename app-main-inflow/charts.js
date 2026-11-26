/* ==========================================================================
   app-ui/charts.js
   Pure SVG Chart Renderers styled for the Nocturnal Obsidian Observatory UI:
   1. Dual-lake water comparison charts on TWO explicit independent axes:
      - 'same-month': fixed calendar month across all 40/41 years (1984–2024)
      - 'same-year':  all months within the selected year (9 or 12 months)
      Strictly separates all 5 water states without leaking gaps across nulls.
   2. Interactive dual-DSM terrain elevation profile chart with in-place
      touch/mouse cursor scrubbing synced to both 2D Canvas and 3D WebGL.
   ========================================================================== */

import { describeWaterMonth, buildTimeComparison } from './view-model.js';
import { formatProfileDisplayName } from './field-crossings.js';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSingleLakeAxisSVG(lakeId, lakeName, rows, axis, selectedDate) {
  const isMain = lakeId === 'MAIN';
  const strokeLine = isMain ? '#38bdf8' : '#2dd4bf';
  const areaGlow = isMain ? 'rgba(56, 189, 248, 0.14)' : 'rgba(45, 212, 191, 0.14)';
  const W = 540;
  const H = 154;
  const padL = 42;
  const padR = 16;
  const padT = 24;
  const padB = 34;
  const pw = W - padL - padR;
  const ph = H - padT - padB;

  const items = rows.map((r, idx) => {
    const desc = describeWaterMonth(lakeId, r.date, r.lakes[lakeId]);
    return { idx, date: r.date, desc };
  });

  const validAreas = items.filter(it => it.desc.areaHa !== null).map(it => it.desc.areaHa);
  const rawMax = validAreas.length ? Math.max(...validAreas) : (isMain ? 140 : 30);
  const yMax = Math.max(isMain ? 40 : 12, Math.ceil((rawMax * 1.16) / 10) * 10);
  const yTicks = [0, Math.round(yMax / 2), yMax];

  const n = Math.max(1, items.length);
  const xp = i => (n === 1 ? padL + pw * 0.5 : padL + (i / (n - 1)) * pw);
  const yp = v => padT + ph - (Math.max(0, Math.min(yMax, v)) / yMax) * ph;

  // Build contiguous polyline segments ONLY between adjacent qualified points (never across invalid!)
  const segments = [];
  let curSeg = [];
  for (const it of items) {
    if (it.desc.areaHa !== null) {
      curSeg.push(`${xp(it.idx).toFixed(1)},${yp(it.desc.areaHa).toFixed(1)}`);
    } else if (curSeg.length) {
      segments.push(curSeg);
      curSeg = [];
    }
  }
  if (curSeg.length) segments.push(curSeg);

  const selectedItem = items.find(it => it.date === selectedDate) || null;
  const selX = selectedItem ? xp(selectedItem.idx) : null;
  const hitW = Math.max(8, Math.min(28, pw / Math.max(n, 1)));

  // Adaptive non-overlapping x-axis labels (prevents 1984 / 1985 collision at all viewport widths)
  const xLabels = [];
  if (axis === 'same-month') {
    const lastIdx = items.length - 1;
    const minGapPx = 46;
    const lastX = xp(lastIdx);
    const pushIfClear = (x, txt, anchor = 'middle') => {
      const prev = xLabels[xLabels.length - 1];
      if (!prev || Math.abs(x - prev.x) >= minGapPx) {
        xLabels.push({ x, txt, anchor });
      }
    };
    if (items.length) {
      pushIfClear(xp(0), items[0].date.slice(0, 4), 'start');
      for (let i = 1; i < lastIdx; i++) {
        const y = Number(items[i].date.slice(0, 4));
        if (y % 10 === 0 || y % 10 === 5) {
          const cx = xp(i);
          if (cx - xLabels[xLabels.length - 1].x >= minGapPx && lastX - cx >= minGapPx) {
            pushIfClear(cx, String(y), 'middle');
          }
        }
      }
      if (lastIdx > 0) {
        const endTxt = items[lastIdx].date.slice(0, 4);
        const prev = xLabels[xLabels.length - 1];
        if (prev && lastX - prev.x < minGapPx) xLabels.pop();
        xLabels.push({ x: lastX, txt: endTxt, anchor: 'end' });
      }
    }
  } else {
    for (const it of items) {
      const m = Number(it.date.slice(5));
      if (items.length > 9 && m % 2 === 0 && it.idx !== items.length - 1) continue;
      xLabels.push({
        x: xp(it.idx),
        txt: `${m}月`,
        anchor: it.idx === 0 ? 'start' : it.idx === items.length - 1 ? 'end' : 'middle',
      });
    }
  }

  const qualCount = items.filter(it => it.desc.status !== 'invalid').length;
  const dispCount = items.filter(it => it.desc.disputed).length;

  let calloutText = '';
  let calloutColor = strokeLine;
  if (selectedItem) {
    const d = selectedItem.desc;
    if (d.stateKey === 'invalid') {
      calloutText = `${selectedDate} · 覆盖不足（留空）`;
      calloutColor = '#94a3b8';
    } else if (d.stateKey === 'positive_disputed') {
      calloutText = `${selectedDate} · ⚠ 争议 ${d.areaText}`;
      calloutColor = '#fb7185';
    } else if (d.stateKey === 'zero_disputed') {
      calloutText = `${selectedDate} · ⊗ 争议零值`;
      calloutColor = '#fb7185';
    } else if (d.stateKey === 'zero') {
      calloutText = `${selectedDate} · ○ 观测为零`;
      calloutColor = '#fbbf24';
    } else {
      calloutText = `${selectedDate} · ${d.areaText}`;
    }
  }

  const selState = selectedItem ? selectedItem.desc.stateKey : 'none';
  const selDisputed = selectedItem ? String(selectedItem.desc.disputed) : 'false';
  const selHa = selectedItem && selectedItem.desc.areaHa !== null ? selectedItem.desc.areaHa.toFixed(2) : '';
  const covRailY = padT + ph + 5.5;

  return `
    <div class="lake-chart-card" data-chart-lake="${lakeId}">
      <div class="lake-chart-head">
        <span class="lake-chart-title">
          <span class="lake-dot ${lakeId.toLowerCase()}"></span>
          <strong>${esc(lakeName)}</strong>
          <span class="lake-sub-tag">${isMain ? '主湖固定窗' : '西长湖独立窗'}</span>
        </span>
        <span class="lake-chart-meta">
          <span class="lake-axis-badge ${lakeId.toLowerCase()}" title="两湖面积量级不同，采用各自独立纵轴以便看清变化">独立纵轴 0–${yMax} ha</span>
          <span>合格 ${qualCount}/${items.length}${dispCount ? ` · <span class="meta-warn">争议 ${dispCount}</span>` : ''}</span>
        </span>
      </div>
      <svg class="atlas-svg" viewBox="0 0 ${W} ${H}" data-lake="${lakeId}" data-axis="${axis}"
        data-selected-date="${esc(selectedDate)}" data-selected-state="${selState}"
        data-selected-disputed="${selDisputed}" data-selected-ha="${selHa}"
        role="img" aria-label="${esc(lakeName)} ${axis === 'same-month' ? '同月跨年' : '同年跨月'} 水面面积图（独立纵轴 0 至 ${yMax} 公顷）">
        ${yTicks.map(t => `
          <line x1="${padL}" y1="${yp(t).toFixed(1)}" x2="${W - padR}" y2="${yp(t).toFixed(1)}"
            stroke="${t === 0 ? 'var(--chart-axis, rgba(148,163,184,0.34))' : 'var(--chart-grid, rgba(255,255,255,0.08))'}" stroke-width="${t === 0 ? 1.1 : 0.9}" ${t === 0 ? '' : 'stroke-dasharray="3 3"'}/>
          <text x="${padL - 7}" y="${(yp(t) + 3.5).toFixed(1)}" text-anchor="end" fill="var(--chart-ink, #9fb0c5)" font-size="10.2" font-family="var(--font-mono)">${t}</text>
        `).join('')}

        <!-- Subtle dedicated coverage-gap track below y=0 so missing months never crowd the zero line -->
        <line x1="${padL}" y1="${covRailY.toFixed(1)}" x2="${W - padR}" y2="${covRailY.toFixed(1)}"
          stroke="var(--chart-grid, rgba(148,163,184,0.16))" stroke-width="1"/>
        <text x="${padL - 7}" y="${(covRailY + 3).toFixed(1)}" text-anchor="end" fill="var(--chart-muted, #7f8fa3)" font-size="8.2">缺测</text>

        ${selX !== null ? `
          <line x1="${selX.toFixed(1)}" y1="${padT - 4}" x2="${selX.toFixed(1)}" y2="${(covRailY + 4).toFixed(1)}"
            stroke="${calloutColor}" stroke-width="1.3" stroke-dasharray="3 2" opacity="0.82"/>
          <text x="${Math.min(W - padR - 4, Math.max(padL + 6, selX)).toFixed(1)}" y="14"
            text-anchor="${selX > W * 0.64 ? 'end' : selX < W * 0.34 ? 'start' : 'middle'}"
            fill="${calloutColor}" font-size="10.6" font-weight="700" font-family="var(--font-mono)">${esc(calloutText)}</text>
        ` : ''}

        ${segments.map(seg => seg.length >= 2
          ? `<polyline points="${seg.join(' ')}" fill="none" stroke="${strokeLine}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>`
          : ''
        ).join('')}

        ${items.map(it => {
          const cx = xp(it.idx);
          const cxStr = cx.toFixed(1);
          const isSel = it.date === selectedDate;
          const d = it.desc;
          const dt = it.date;

          if (d.status === 'invalid') {
            return `
              <g class="svg-slot" data-pick-date="${dt}" data-state="invalid" style="cursor:pointer">
                <rect x="${(cx - hitW / 2).toFixed(1)}" y="${padT}" width="${hitW.toFixed(1)}" height="${ph + 18}" fill="transparent"/>
                <rect x="${(cx - 2.3).toFixed(1)}" y="${(covRailY - 2.4).toFixed(1)}" width="4.6" height="4.8" rx="1.1"
                  fill="${isSel ? '#cbd5e1' : 'rgba(148,163,184,0.34)'}" stroke="${isSel ? '#f8fafc' : 'rgba(148,163,184,0.58)'}" stroke-width="${isSel ? 1.2 : 0.8}"/>
                <title>${esc(`${lakeName} ${dt}：覆盖不足（有效覆盖 ${d.validPctText}，留空不补零）`)}</title>
              </g>
            `;
          }

          const cy = yp(d.areaHa).toFixed(1);
          const isZero = d.status === 'zero';
          const isDisp = d.disputed;
          return `
            <g class="svg-slot" data-pick-date="${dt}" data-state="${d.stateKey}" data-ha="${d.areaHa.toFixed(2)}" style="cursor:pointer">
              <rect x="${(cx - hitW / 2).toFixed(1)}" y="${padT}" width="${hitW.toFixed(1)}" height="${ph + 18}" fill="transparent"/>
              ${isSel ? `<circle cx="${cxStr}" cy="${cy}" r="8.2" fill="${isDisp ? 'rgba(244,63,94,0.22)' : areaGlow}" stroke="${calloutColor}" stroke-width="1.35"/>` : ''}
              ${isDisp ? `<circle cx="${cxStr}" cy="${cy}" r="6.3" fill="none" stroke="#fb7185" stroke-width="1.5" stroke-dasharray="2.5 1.5"/>` : ''}
              <circle cx="${cxStr}" cy="${cy}" r="${isSel ? 4.3 : isZero ? 3.7 : 3.2}"
                fill="${isZero ? 'var(--chart-zero-bg, #0c131d)' : isDisp ? '#d97706' : strokeLine}"
                stroke="${isDisp ? '#e11d48' : isZero ? '#d97706' : 'var(--chart-zero-bg, #0b1119)'}"
                stroke-width="${isZero ? 2.0 : 1.2}"/>
              ${isZero && isDisp ? `
                <line x1="${(cx - 2.3).toFixed(1)}" y1="${(Number(cy) - 2.3).toFixed(1)}" x2="${(cx + 2.3).toFixed(1)}" y2="${(Number(cy) + 2.3).toFixed(1)}" stroke="#fb7185" stroke-width="1.3"/>
                <line x1="${(cx + 2.3).toFixed(1)}" y1="${(Number(cy) - 2.3).toFixed(1)}" x2="${(cx - 2.3).toFixed(1)}" y2="${(Number(cy) + 2.3).toFixed(1)}" stroke="#fb7185" stroke-width="1.3"/>
              ` : ''}
              <title>${esc(`${lakeName} ${dt}：${d.badgeText}（覆盖 ${d.validPctText}）`)}</title>
            </g>
          `;
        }).join('')}

        ${xLabels.map(t => `
          <text x="${t.x.toFixed(1)}" y="${H - 7}" text-anchor="${t.anchor || 'middle'}" fill="var(--chart-ink, #9fb0c5)" font-size="10" font-family="var(--font-mono)" style="pointer-events:none">${esc(t.txt)}</text>
        `).join('')}
      </svg>
    </div>
  `;
}

export function renderDualLakeCompareCharts(waterIndex, axis, selectedDate, lakeView = 'BOTH') {
  if (!waterIndex) return '';
  const rows = buildTimeComparison(waterIndex, axis, selectedDate, 'BOTH');
  const lakesToShow = lakeView === 'BOTH' ? ['MAIN', 'WF1'] : [lakeView];
  const scaleHint = lakesToShow.length === 2
    ? '两图使用各自独立纵轴（单位 ha），便于分别看清主湖与西长湖自身变化。'
    : '纵轴单位为公顷（ha）。';
  const axisQuestion = axis === 'same-month'
    ? `同月跨年（固定 ${Number(selectedDate.slice(5))} 月 · ${rows.length} 年）：对比不同年份同一季节的丰枯变化，非逐月连续序列。${scaleHint}`
    : `同年跨月（${selectedDate.slice(0, 4)} 年 · ${rows.length} 期）：查看年内季节涨落与两湖同期表现，覆盖不足处留空不插值。${scaleHint}`;

  return `
    <div class="axis-question-bar">${esc(axisQuestion)}</div>
    <div class="dual-charts-grid ${lakesToShow.length === 1 ? 'single-lake' : ''}">
      ${lakesToShow.map(id => renderSingleLakeAxisSVG(id, waterIndex.lakes[id].name, rows, axis, selectedDate)).join('')}
    </div>
    <div class="chart-legend-strip">
      <span><i class="lg-dot pos"></i>● 合格正值</span>
      <span><i class="lg-dot disp"></i>⚠ 争议正值（红虚环）</span>
      <span><i class="lg-dot zero"></i>○ 观测为零</span>
      <span><i class="lg-dot zdisp"></i>⊗ 争议零值</span>
      <span><i class="lg-dot inv"></i>▨ 覆盖不足（底部缺测轨，不补零）</span>
    </div>
  `;
}

export function profileCursorReadout(profileData, idx) {
  const cur = profileData.samples[idx];
  return [
    `点 #${idx + 1}/${profileData.samples.length}`,
    `里程 ${cur.distance_m.toFixed(1)} m`,
    `${cur.lon.toFixed(6)}°E, ${cur.lat.toFixed(6)}°N`,
    cur.waterMasked ? '参考水面内，湖底未测' : Number.isFinite(cur.glo30_m) ? `GLO-30 ${cur.glo30_m.toFixed(2)} m` : 'GLO-30 无可用值',
    profileData.hasAw && Number.isFinite(cur.aw3d30_m) ? `AW3D30 ${cur.aw3d30_m.toFixed(2)} m` : null,
  ];
}

function profileElevationRuns(samples, key) {
  const runs = [];
  let run = [];
  for (const sample of samples) {
    if (!sample.waterMasked && Number.isFinite(sample[key])) run.push(sample);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

export function renderTerrainProfileChart(profileData, cursorIdx = 0) {
  if (!profileData || !profileData.samples.length) {
    return '<div class="empty-msg">当前未选中地形剖面。</div>';
  }
  const samples = profileData.samples;
  const idx = Math.max(0, Math.min(samples.length - 1, cursorIdx));
  const cur = samples[idx];

  const W = 760;
  const H = 148;
  const padL = 46;
  const padR = 16;
  const padT = 22;
  const padB = 28;
  const pw = W - padL - padR;
  const ph = H - padT - padB;

  const dMin = profileData.minDistM;
  const dMax = Math.max(dMin + 1, profileData.maxDistM);
  const hasElevation = Number.isFinite(profileData.minElev) && Number.isFinite(profileData.maxElev);
  const zPad = hasElevation ? Math.max(1.0, (profileData.maxElev - profileData.minElev) * 0.14) : 0;
  const zMin = hasElevation ? Math.floor(profileData.minElev - zPad) : 0;
  const zMax = hasElevation ? Math.ceil(profileData.maxElev + zPad) : 1;
  const zMid = Math.round((zMin + zMax) * 0.5);

  const xp = dist => padL + ((dist - dMin) / (dMax - dMin)) * pw;
  const yp = z => padT + ph - ((z - zMin) / Math.max(1, zMax - zMin)) * ph;
  const f = x => x.toFixed(1);
  const lines = (key, kind, color, width, dash = '') => profileElevationRuns(samples, key).map(run => {
    const pts = run.map(s => `${f(xp(s.distance_m))},${f(yp(s[key]))}`);
    if (run.length === 1) return `<circle data-prof-elevation="${kind}" cx="${f(xp(run[0].distance_m))}" cy="${f(yp(run[0][key]))}" r="1.8" fill="${color}"/>`;
    const area = kind === 'glo'
      ? `<path d="M${f(xp(run[0].distance_m))},${f(padT + ph)} L${pts.join(' L')} L${f(xp(run.at(-1).distance_m))},${f(padT + ph)} Z" fill="url(#profGloWash)"/>`
      : '';
    return area + `<polyline data-prof-elevation="${kind}" points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" ${dash}/>`;
  }).join('');

  const x0 = dMin <= 0 && dMax >= 0 ? xp(0) : null;
  const cx = xp(cur.distance_m);
  const cyGlo = Number.isFinite(cur.glo30_m) ? yp(cur.glo30_m) : null;
  const cyAw = profileData.hasAw && Number.isFinite(cur.aw3d30_m) ? yp(cur.aw3d30_m) : null;
  const readout = profileCursorReadout(profileData, idx);

  const dTicks = [dMin, dMin + (dMax - dMin) * 0.25, dMin + (dMax - dMin) * 0.5, dMin + (dMax - dMin) * 0.75, dMax];
  const riseInfo = profileData.hasMask
    ? (profileData.waterIntervals.length ? `湖底未测。蓝色斜纹为${profileData.waterMaskLabel}，不表示水位或水深。` : '本剖面未与所选参考水面重叠；仅展示地表高程。')
    : profileData.hasAw && Number.isFinite(profileData.riseGloM) && Number.isFinite(profileData.riseAwM)
      ? `${profileData.sampleOrigin?'相对当前所选线 0 m 起点最高抬升':'中段较湖端最高抬升'}：GLO-30 +${profileData.riseGloM.toFixed(2)} m · AW3D30 +${profileData.riseAwM.toFixed(2)} m`
      : Number.isFinite(profileData.riseGloM) ? `相对 0 m 起点最大高差：+${profileData.riseGloM.toFixed(2)} m（历史 30m DSM）` : '起点无可用地表高程，不计算相对高差。';

  return `
    <div class="profile-meta-bar">
      <div class="profile-cursor-readout" id="profile-cursor-readout">
        ${readout.map((v, i) => `<span class="mono-pill${i === 3 ? ' glo' : i === 4 ? ' aw' : ''}" ${v === null ? 'hidden' : ''}>${esc(v ?? '')}</span>`).join('')}
      </div>
      <div class="profile-rise-note">${esc(riseInfo)}</div>
    </div>
    <svg class="atlas-svg profile-svg" viewBox="0 0 ${W} ${H}" data-profile-svg="${esc(profileData.id)}"
      data-pad-l="${padL}" data-pad-r="${padR}" data-pad-t="${padT}" data-pad-b="${padB}"
      data-view-w="${W}" data-view-h="${H}"
      data-d-min="${dMin}" data-d-max="${dMax}" data-z-min="${zMin}" data-z-max="${zMax}"
      role="img" aria-label="${esc(formatProfileDisplayName(profileData.id, profileData.name))} 地形剖面图（拖动或点击在地图上联动定位）">
      <defs>
        <linearGradient id="profGloWash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c084fc" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#c084fc" stop-opacity="0.01"/>
        </linearGradient>
        <pattern id="profReferenceWater" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="6" height="6" fill="#164765" fill-opacity="0.40"/>
          <path d="M0 0V6" stroke="#7dd3fc" stroke-opacity="0.45" stroke-width="1.4"/>
        </pattern>
      </defs>
      ${(profileData.gaps||[]).map(g=>`<rect data-profile-gap x="${f(xp(g.startM))}" y="${padT}" width="${f(xp(g.endM)-xp(g.startM))}" height="${ph}" fill="var(--chart-grid,rgba(255,255,255,.09))"><title>空白间隔约 ${Math.round(g.endM-g.startM)} m；不补高程</title></rect>`).join('')}
      ${(profileData.waterIntervals || []).map(({startM, endM}) => `
        <rect data-prof-water-zone x="${f(xp(startM))}" y="${padT}" width="${f(Math.max(0, xp(endM) - xp(startM)))}" height="${ph}" fill="url(#profReferenceWater)">
          <title>${esc(profileData.waterMaskLabel)}；湖底未测</title>
        </rect>`).join('')}
      ${(hasElevation ? [zMin, zMid, zMax] : []).map(z => `
        <line x1="${padL}" y1="${yp(z).toFixed(1)}" x2="${W - padR}" y2="${yp(z).toFixed(1)}" stroke="var(--chart-grid, rgba(255,255,255,0.09))" stroke-width="1"/>
        <text x="${padL - 6}" y="${(yp(z) + 3.2).toFixed(1)}" text-anchor="end" fill="var(--chart-ink, #8b9bb0)" font-size="9.5" font-family="var(--font-mono)">${z}m</text>
      `).join('')}

      ${x0 !== null ? `
        <line x1="${x0.toFixed(1)}" y1="${padT}" x2="${x0.toFixed(1)}" y2="${padT + ph}" stroke="#d99a3a" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.9"/>
        <text x="${(x0 > W - padR - 54 ? x0 - 4 : x0 + 4).toFixed(1)}" y="${padT + 10}" text-anchor="${x0 > W - padR - 54 ? 'end' : 'start'}" fill="#d99a3a" font-size="8.5" font-weight="600">0 m 锚点</text>
      ` : ''}

      ${lines('glo30_m', 'glo', 'var(--prof-glo, #a796e2)', 2.1)}
      ${profileData.hasAw ? lines('aw3d30_m', 'aw', 'var(--prof-aw, #2eb8a6)', 1.8, 'stroke-dasharray="5 3"') : ''}

      <!-- Interactive Cursor (updated in-place during touch/pointer scrubbing) -->
      <line data-prof-cursor-line="1" x1="${cx.toFixed(1)}" y1="${padT}" x2="${cx.toFixed(1)}" y2="${padT + ph}" stroke="#df5c6b" stroke-width="1.6" stroke-dasharray="3 2"/>
      <circle data-prof-cursor-glo="1" cx="${cx.toFixed(1)}" cy="${f(cyGlo ?? padT)}" visibility="${cyGlo === null ? 'hidden' : 'visible'}" r="4.8" fill="#df5c6b" stroke="#ffffff" stroke-width="1.6"/>
      ${profileData.hasAw ? `<circle data-prof-cursor-aw="1" cx="${cx.toFixed(1)}" cy="${f(cyAw ?? padT)}" visibility="${cyAw === null ? 'hidden' : 'visible'}" r="3.9" fill="var(--prof-aw, #2eb8a6)" stroke="var(--chart-zero-bg, #0b1119)" stroke-width="1.4"/>` : ''}

      ${dTicks.map(d => `
        <text x="${xp(d).toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--chart-ink, #8b9bb0)" font-size="9" font-family="var(--font-mono)">${d >= 1000 || d <= -1000 ? `${(d / 1000).toFixed(2)}km` : `${Math.round(d)}m`}</text>
      `).join('')}
    </svg>
    <div class="profile-foot-note">
      <span><i class="lg-line glo"></i>Copernicus GLO-30 (30m DSM)</span>
      ${profileData.hasAw ? '<span><i class="lg-line aw"></i>JAXA AW3D30 (30m DSM)</span>' : ''}
      ${profileData.waterIntervals?.length ? `<span>▨ ${esc(profileData.waterMaskLabel)}（湖底未测）</span>` : ''}
      <span>方向：${esc(profileData.positiveDirection)}</span>
      ${profileData.placementCaveat ? `<span class="prof-caveat-tag" title="${esc(profileData.placementCaveat)}">⚠ 近似放置研究剖面</span>` : ''}
      <span>· ${profileData.hasMask ? '陆段地表高程' : '历史地表高程采样'}，非水位、实测水头或流向（鼠标悬停或拖动实时联动 2D/3D 地表）</span>
    </div>
  `;
}
