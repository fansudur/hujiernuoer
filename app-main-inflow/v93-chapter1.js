// Hujiernuoer Atlas v93 — Chapter 1 Spatial Documentary Controller
// Drives the First-Open Prologue, 7-Stage / 29-Stop Interactive Timeline & Index,
// Dual-Date Telemetry, and Mobile Tabbed Story/Profile/Radar Theatre.

// Capture initial URL state at module load time before app.js boot() calls history.replaceState(syncUrl)
const INITIAL_CLEAN_OPEN = new URLSearchParams(location.search).size === 0;

const STAGES = [
  { id: 's1', num: '①', short: '开场总览', title: '一、开场总览 · 全域方位', routes: ['opening'] },
  { id: 's2', num: '②', short: '西北与中桥', title: '二、西北大沟壑与 G332 中桥（含 3 处断口）', routes: ['runoff'] },
  { id: 's3', num: '③', short: '历史旧影', title: '三、桥东低带与旧转折 · 历年同位影像', routes: ['history'] },
  { id: 's4', num: '④', short: '03 路四点', title: '四、03 道路现场四点与涵口核对', routes: ['road'] },
  { id: 's5', num: '⑤', short: '桥东与东池', title: '五、东部泥沼、东池与分流回看', routes: ['corridor-to-lake', 'east-water'] },
  { id: 's6', num: '⑥', short: '南部与圆涵', title: '六、南部地方道路 B、C 与圆涵', routes: ['road-context'] },
  { id: 's7', num: '⑦', short: '主湖收束', title: '七、主湖地形复盘与全章收束', routes: ['lake-inflow', 'closing'] },
];

function classifyStopEvidence(step) {
  if (!step) return { key: 'observed', sym: '━', label: '影像可见地貌' };
  if (step.kind === 'gap' || step.status === 'gap') {
    return { key: 'gap', sym: '├⋯┤', label: '待核证据断口 · 保留空白' };
  }
  if (step.status === 'field_reference' || step.photoId || step.photoGallery?.length || step.detail?.fieldMarks?.length) {
    return { key: 'field', sym: '◉', label: '现场实拍参照' };
  }
  if (step.status === 'candidate') {
    return step.historyCard
      ? { key: 'candidate', sym: '◷', label: '历史影像对照 · 连通待核' }
      : { key: 'candidate', sym: '┄', label: '候选走向 · 连通待核' };
  }
  if (step.status === 'image_label' || step.historyCard) {
    return { key: 'history', sym: '◷', label: '历史影像对照（文件标记）' };
  }
  if (step.status === 'modeled' || step.status === 'model_candidate') {
    return { key: 'model', sym: '┄', label: '30m 地形模型推演' };
  }
  return { key: 'observed', sym: '━', label: '影像可见形态与地标参照' };
}

function mountPrologue(bridge) {
  const isCleanFirstOpen = INITIAL_CLEAN_OPEN;
  const obs = document.getElementById('observatory');
  if (!obs) return null;

  const card = document.createElement('section');
  card.id = 'v93-prologue';
  card.setAttribute('aria-label', '第一章导览导读：水怎么来到呼吉尔诺尔');
  card.hidden = !isCleanFirstOpen;

  card.innerHTML = `
    <div class="v93-pro-head">
      <div>
        <div class="v93-pro-kicker">呼吉尔诺尔来水调查 · 第一章纪事导览</div>
        <h2 class="v93-pro-title">水怎么来到呼吉尔诺尔？</h2>
      </div>
      <button type="button" class="v93-pro-close" id="v93-prologue-close" aria-label="收起导读，先自由浏览地图" title="先看自由图谱">✕</button>
    </div>
    <button type="button" id="v93-prologue-details" aria-expanded="false" aria-controls="v93-prologue-body">查看章节与证据</button>
    <div id="v93-prologue-body">
    <p class="v93-pro-lead">无需先学图层操作——跟随 <strong>29 站离线语音与三维地形</strong>，从西北坡大沟壑出发，逐段核对实拍桥涵、二十年卫星旧影与 30 米地表模型，看清哪些水路有据可查、哪些仍是留白待核的断口。</p>
    <div class="v93-ev-grid" aria-label="四类图面证据一眼分辨">
      <div class="v93-ev-card" data-ev="field">
        <span class="v93-ev-sym">◉</span>
        <div><strong>现场实拍参照</strong><small>中桥桥牌、03 四点与圆涵原片（相机位≠洞口）</small></div>
      </div>
      <div class="v93-ev-card" data-ev="observed">
        <span class="v93-ev-sym">━━</span>
        <div><strong>影像可见低带</strong><small>亮青实线标示可辨沟槽，看不清处绝不补画</small></div>
      </div>
      <div class="v93-ev-card" data-ev="model">
        <span class="v93-ev-sym">┄┄</span>
        <div><strong>30m 地形推演</strong><small>品紫虚线／琥珀汇水分区仅示坡向，非实测水流</small></div>
      </div>
      <div class="v93-ev-card" data-ev="gap">
        <span class="v93-ev-sym">├⋯┤</span>
        <div><strong>待核证据断口</strong><small>隔路与消散处留白，标尺仅量端点直距</small></div>
      </div>
    </div>
    <div class="v93-pro-stages-lbl">七幕调查脉络（可点任意幕直达，或从头连播）：</div>
    <div class="v93-pro-stages" id="v93-pro-stages"></div>
    </div>
    <div class="v93-pro-actions">
      <button type="button" class="v93-btn-primary" id="v93-prologue-start">▶ 开始第一章语音导览（29 站）</button>
      <button type="button" class="v93-btn-secondary" id="v93-prologue-explore">自由浏览图谱</button>
    </div>
  `;
  obs.appendChild(card);

  const disclosure = card.querySelector('#v93-prologue-details');
  disclosure.onclick = () => {
    const expanded = disclosure.getAttribute('aria-expanded') !== 'true';
    disclosure.setAttribute('aria-expanded', String(expanded));
    disclosure.textContent = expanded ? '收起章节与证据' : '查看章节与证据';
  };
  const stagesHost = card.querySelector('#v93-pro-stages');
  for (const st of STAGES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'v93-stage-jump';
    b.textContent = `${st.num} ${st.short}`;
    b.title = st.title;
    b.onclick = () => {
      card.hidden = true;
      bridge.openAtRoute(st.routes[0], 0, { autoPlay: false });
    };
    stagesHost.appendChild(b);
  }

  const dismiss = () => { card.hidden = true; };
  card.querySelector('#v93-prologue-close').onclick = dismiss;
  card.querySelector('#v93-prologue-explore').onclick = dismiss;
  card.querySelector('#v93-prologue-start').onclick = () => {
    card.hidden = true;
    bridge.openAtRoute('opening', 0, { autoPlay: true });
  };

  // Auto-dismiss if user interacts with any free-atlas drawer, walk mode, or map drag
  document.addEventListener('pointerdown', e => {
    if (card.hidden) return;
    if (e.target.closest('#v93-prologue')) return;
    if (e.target.closest('#hud-top-right, #hud-top-left, #chart-deck, #map-2d-canvas, #map-3d-stage')) {
      dismiss();
    }
  }, { capture: true });

  return card;
}

function mountTheatreChrome(bridge) {
  const obs = document.getElementById('observatory');
  const panel = document.getElementById('guided-tour-panel');
  const nav = document.getElementById('guided-tour-nav-strip');
  const radar = document.getElementById('guided-reference-dock');
  if (!obs || !panel || !nav) return;

  obs.dataset.v93MobTab = 'story';

  // 1. Top Documentary Bar
  const topbar = document.createElement('header');
  topbar.id = 'v93-tour-topbar';
  topbar.hidden = true;
  topbar.setAttribute('aria-label', '第一章导览进度与独立日期栏');
  topbar.innerHTML = `
    <div class="v93-topbar-left">
      <button type="button" class="v93-index-btn" id="v93-index-toggle" aria-expanded="false" aria-controls="v93-index-drawer" title="展开全部 7 幕 29 站调查目录">
        <span class="v93-stop-pill" id="v93-stop-num">01 / 29</span>
        <span class="v93-act-name" id="v93-act-label">① 开场总览</span>
        <span aria-hidden="true">▾</span>
      </button>
    </div>
    <nav class="v93-stage-scrubber" id="v93-stage-scrubber" aria-label="七幕二十九站叙事进度条"></nav>
    <div class="v93-topbar-right">
      <div class="v93-dual-dates" aria-label="主湖水面统计月与底图日期彼此独立">
        <span class="v93-date-tag water" id="v93-water-tag"><small>水面月</small><strong id="v93-water-val">2024-07</strong></span>
        <span class="v93-date-sep" aria-hidden="true"></span>
        <span class="v93-date-tag imagery"><small>底图</small><strong id="v93-imagery-val">2021-09</strong></span>
      </div>
    </div>
  `;
  obs.appendChild(topbar);
  const origCloseBtn = document.getElementById('guided-tour-close');
  if (origCloseBtn) {
    origCloseBtn.classList.add('v93-exit-btn');
    origCloseBtn.textContent = '✕ 退出导览';
    topbar.querySelector('.v93-topbar-right').appendChild(origCloseBtn);
  }

  // 2. 29-Stop Visual Index Drawer
  const drawer = document.createElement('aside');
  drawer.id = 'v93-index-drawer';
  drawer.hidden = true;
  drawer.setAttribute('aria-label', '第一章 7 幕 29 站完整目录');
  drawer.innerHTML = `
    <div class="v93-idx-head">
      <div>
        <strong>第一章 · 水怎么来到呼吉尔诺尔（全 29 站目录）</strong>
        <div><small>按调查顺序排列；点击任意站点立即切换机位与对应证据，未证实连接均留空。</small></div>
      </div>
      <button type="button" class="v93-pro-close" id="v93-idx-close" aria-label="关闭目录">✕</button>
    </div>
    <div id="v93-idx-body"></div>
  `;
  obs.appendChild(drawer);

  // 3. Inject Evidence Classification Badge into #guided-tour-panel
  const evRow = document.createElement('div');
  evRow.className = 'v93-evidence-header';
  evRow.innerHTML = `<span class="v93-ev-badge" id="v93-ev-badge" data-ev="observed">━ 影像可见地貌</span>`;
  const board = document.getElementById('guided-director-board');
  if (board?.parentElement === panel) {
    panel.insertBefore(evRow, board);
  } else {
    panel.prepend(evRow);
  }

  // 4. Add Radar Minimize Toggle on Desktop
  const radarHdr = radar?.querySelector('.guided-reference-title > div');
  let radarMinBtn = null;
  if (radarHdr) {
    radarMinBtn = document.createElement('button');
    radarMinBtn.type = 'button';
    radarMinBtn.className = 'deck-btn';
    radarMinBtn.id = 'v93-radar-min';
    radarMinBtn.textContent = '收起';
    radarMinBtn.title = '折叠或展开右上空间参照小地图';
    radarMinBtn.onclick = () => {
      const min = radar.classList.toggle('v93-radar-minimized');
      radarMinBtn.textContent = min ? '展开' : '收起';
      bridge.refitCurrentPose();
    };
    radarHdr.appendChild(radarMinBtn);
  }

  // 5. Add Step Progress Hairline into #guided-tour-nav-strip
  const prog = document.createElement('div');
  prog.id = 'v93-step-progress';
  prog.innerHTML = `<div id="v93-step-progress-fill"></div>`;
  nav.prepend(prog);

  // 6. Mobile Mode Switcher Strip (#v93-mob-tabs)
  const mobTabs = document.createElement('div');
  mobTabs.id = 'v93-mob-tabs';
  mobTabs.hidden = true;
  mobTabs.setAttribute('role', 'tablist');
  mobTabs.setAttribute('aria-label', '移动端导览面板切换');
  mobTabs.innerHTML = `
    <button type="button" class="v93-mob-tab" role="tab" data-mob-tab="story" aria-selected="true">讲解</button>
    <button type="button" class="v93-mob-tab" role="tab" data-mob-tab="profile" id="v93-mob-tab-profile" aria-selected="false"><span>剖面</span><i class="v93-mob-dot" id="v93-mob-prof-dot" hidden></i></button>
    <button type="button" class="v93-mob-tab" role="tab" data-mob-tab="photo" id="v93-mob-tab-photo" aria-selected="false"><span>原图</span><i class="v93-mob-dot" id="v93-mob-photo-dot" hidden></i></button>
    <button type="button" class="v93-mob-tab" role="tab" data-mob-tab="radar" aria-selected="false">参照图</button>
    <button type="button" class="v93-mob-expand" id="v93-mob-expand" aria-expanded="false">▴ 展开</button>
  `;
  obs.appendChild(mobTabs);

  const setMobTab = tab => {
    if (tab === 'photo') {
      bridge.openCurrentMedia();
      return;
    }
    if (tab === 'profile') {
      bridge.ensureStopProfileOpen();
    }
    obs.dataset.v93MobTab = tab;
    for (const b of mobTabs.querySelectorAll('.v93-mob-tab')) {
      b.setAttribute('aria-selected', String(b.dataset.mobTab === tab));
    }
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      bridge.refitCurrentPose();
    });
  };

  mobTabs.addEventListener('click', e => {
    const t = e.target.closest('[data-mob-tab]');
    if (t && !t.disabled) {
      setMobTab(t.dataset.mobTab);
      return;
    }
    const exp = e.target.closest('#v93-mob-expand');
    if (exp) {
      const next = !obs.classList.contains('v93-mob-expanded');
      obs.classList.toggle('v93-mob-expanded', next);
      exp.setAttribute('aria-expanded', String(next));
      exp.textContent = next ? '▾ 收窄' : '▴ 展开';
      requestAnimationFrame(() => bridge.refitCurrentPose());
    }
  });

  // If user clicks #v74-close-tour-profile or KMZ profile buttons on mobile, switch tab cleanly
  document.getElementById('v74-close-tour-profile')?.addEventListener('click', () => {
    if (innerWidth <= 760 && obs.dataset.v93MobTab === 'profile') setMobTab('story');
  });
  document.addEventListener('click', e => {
    if (innerWidth <= 760 && e.target.closest('[data-guide-kmz-profile], [data-east-choice], #v74-open-tour-profile')) {
      const el = e.target.closest('[data-east-choice]');
      if (!el || el.parentElement?.id === 'guided-east-profiles') {
        setTimeout(() => setMobTab('profile'), 30);
      }
    }
  });

  // Wire Topbar & Index Drawer
  const setDrawerOpen = open => {
    drawer.hidden = !open;
    topbar.querySelector('#v93-index-toggle').setAttribute('aria-expanded', String(open));
  };
  topbar.querySelector('#v93-index-toggle').onclick = () => setDrawerOpen(drawer.hidden);
  drawer.querySelector('#v93-idx-close').onclick = () => setDrawerOpen(false);
  origCloseBtn?.addEventListener('click', () => setDrawerOpen(false), { capture: true });
  document.addEventListener('pointerdown', e => {
    if (!drawer.hidden && !e.target.closest('#v93-index-drawer, #v93-index-toggle')) {
      setDrawerOpen(false);
    }
  });

  // Build 7-Stage Scrubber & 29-Stop Index once book is ready
  let builtBookLen = 0;
  const ensureIndexBuilt = () => {
    const book = bridge.getBook();
    if (!book?.length || book.length === builtBookLen) return;
    builtBookLen = book.length;

    const flat = [];
    book.forEach((route, rIdx) => {
      route.steps.forEach((step, sIdx) => {
        flat.push({ globalIdx: flat.length + 1, route, rIdx, step, sIdx });
      });
    });

    const scrubber = topbar.querySelector('#v93-stage-scrubber');
    const idxBody = drawer.querySelector('#v93-idx-body');
    scrubber.replaceChildren();
    idxBody.replaceChildren();

    for (const stage of STAGES) {
      const stageStops = flat.filter(x => stage.routes.includes(x.route.id));
      if (!stageStops.length) continue;

      // Scrubber segment
      const seg = document.createElement('div');
      seg.className = 'v93-stage-group';
      seg.dataset.stageId = stage.id;
      const lbl = document.createElement('span');
      lbl.className = 'v93-stage-lbl';
      lbl.textContent = `${stage.num} ${stage.short}`;
      lbl.onclick = e => {
        e.stopPropagation();
        setDrawerOpen(false);
        bridge.jumpTo(stageStops[0].route.id, stageStops[0].sIdx);
      };
      const ticks = document.createElement('div');
      ticks.className = 'v93-tick-row';
      for (const item of stageStops) {
        const tick = document.createElement('button');
        tick.type = 'button';
        tick.className = 'v93-stop-tick' + (item.step.kind === 'gap' ? ' is-gap' : '');
        tick.dataset.stepId = item.step.id;
        tick.dataset.globalIdx = String(item.globalIdx);
        tick.title = `第 ${item.globalIdx}/${flat.length} 站 · ${item.step.title}`;
        tick.setAttribute('aria-label', tick.title);
        tick.onclick = e => {
          e.stopPropagation();
          setDrawerOpen(false);
          bridge.jumpTo(item.route.id, item.sIdx);
        };
        ticks.appendChild(tick);
      }
      seg.append(lbl, ticks);
      scrubber.appendChild(seg);

      // Drawer Stage Block
      const block = document.createElement('section');
      block.className = 'v93-idx-stage';
      const firstN = String(stageStops[0].globalIdx).padStart(2, '0');
      const lastN = String(stageStops.at(-1).globalIdx).padStart(2, '0');
      block.innerHTML = `<div class="v93-idx-stage-title"><span>${stage.title}</span><small>第 ${firstN === lastN ? firstN : `${firstN}–${lastN}`} 站</small></div>`;
      const grid = document.createElement('div');
      grid.className = 'v93-idx-grid';
      for (const item of stageStops) {
        const ev = classifyStopEvidence(item.step);
        const hasProf = bridge.hasStopProfile(item.step.id);
        const hasPhoto = Boolean(item.step.photoId || item.step.photoGallery?.length || item.step.detail?.fieldMarks?.length);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'v93-idx-item';
        btn.dataset.stepId = item.step.id;
        const tags = [`<span class="v93-idx-tag" data-t="${ev.key}">${ev.sym} ${ev.key === 'gap' ? '断口' : ev.key === 'field' ? '实拍' : ev.key === 'model' ? '模型' : ev.key === 'history' ? '旧影' : ev.key === 'candidate' ? (item.step.historyCard ? '旧影 · 连通待核' : '候选 · 连通待核') : '影像'}</span>`];
        if (hasProf) tags.push(`<span class="v93-idx-tag" data-t="profile">⛰ 剖面</span>`);
        if (hasPhoto && ev.key !== 'field') tags.push(`<span class="v93-idx-tag" data-t="field">📷 原片</span>`);
        btn.innerHTML = `
          <span class="v93-idx-num">${String(item.globalIdx).padStart(2, '0')}</span>
          <span class="v93-idx-copy">
            <strong>${item.step.title}</strong>
            <span class="v93-idx-tags">${tags.join('')}</span>
          </span>
        `;
        btn.onclick = () => {
          setDrawerOpen(false);
          bridge.jumpTo(item.route.id, item.sIdx);
        };
        grid.appendChild(btn);
      }
      block.appendChild(grid);
      idxBody.appendChild(block);
    }
  };

  let lastStepId = null;
  const syncUI = () => {
    const snap = bridge.getSnapshot();
    const active = Boolean(snap?.active);
    topbar.hidden = !active;
    mobTabs.hidden = !active;
    if (!active) {
      drawer.hidden = true;
      lastStepId = null;
      obs.classList.remove('v93-mob-expanded');
      return;
    }
    ensureIndexBuilt();

    const { step, route, globalIdx, totalStops, waterMonth, imageryLabel, isOverview, progressRatio, hasProfile, hasMedia } = snap;
    if (step && step.id !== lastStepId) {
      lastStepId = step.id;
      obs.classList.remove('v93-mob-expanded');
      const expBtn = document.getElementById('v93-mob-expand');
      if (expBtn) { expBtn.setAttribute('aria-expanded', 'false'); expBtn.textContent = '▴ 展开'; }
      if (innerWidth <= 760 && obs.dataset.v93MobTab === 'profile' && !hasProfile) {
        setMobTab('story');
      } else if (innerWidth <= 760 && obs.dataset.v93MobTab !== 'radar') {
        // Default back to story when stepping to a new station so user sees what's spoken
        setMobTab('story');
      }
    }

    const stage = STAGES.find(s => s.routes.includes(route?.id)) || STAGES[0];
    document.getElementById('v93-stop-num').textContent = `${String(globalIdx).padStart(2, '0')} / ${totalStops}`;
    document.getElementById('v93-act-label').textContent = `${stage.num} ${stage.short}`;

    // Dual-date bar: strictly distinguish JRC monthly water vs basemap file label
    const waterTag = document.getElementById('v93-water-tag');
    const waterVal = document.getElementById('v93-water-val');
    if (isOverview) {
      waterTag.classList.add('is-muted');
      waterVal.textContent = `${waterMonth || '2024-07'}（全景暂隐叠层）`;
    } else {
      waterTag.classList.remove('is-muted');
      waterVal.textContent = waterMonth || '2024-07';
    }
    const cleanImg = (imageryLabel || '2021-09（文件标记）').replace('（文件标记）', '');
    document.getElementById('v93-imagery-val').innerHTML = `${cleanImg}<span class="v93-file-tag">（文件标记）</span>`;

    // Evidence badge
    const ev = classifyStopEvidence(step);
    const badge = document.getElementById('v93-ev-badge');
    if (badge) {
      badge.dataset.ev = ev.key;
      badge.textContent = `${ev.sym} ${ev.label}`;
    }

    // Scrubber & Index active states
    for (const seg of topbar.querySelectorAll('.v93-stage-group')) {
      seg.classList.toggle('is-active', seg.dataset.stageId === stage.id);
    }
    for (const tick of topbar.querySelectorAll('.v93-stop-tick')) {
      const idx = Number(tick.dataset.globalIdx);
      tick.classList.toggle('is-current', tick.dataset.stepId === step?.id);
      tick.classList.toggle('is-past', idx < globalIdx);
    }
    for (const item of drawer.querySelectorAll('.v93-idx-item')) {
      item.classList.toggle('is-current', item.dataset.stepId === step?.id);
    }

    // Progress bar
    const fill = document.getElementById('v93-step-progress-fill');
    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, (progressRatio || 0) * 100)).toFixed(1)}%`;
    }

    // Mobile tab availability dots
    const profTab = document.getElementById('v93-mob-tab-profile');
    const profDot = document.getElementById('v93-mob-prof-dot');
    if (profTab && profDot) {
      profTab.disabled = !hasProfile;
      profDot.hidden = !hasProfile;
    }
    const photoTab = document.getElementById('v93-mob-tab-photo');
    const photoDot = document.getElementById('v93-mob-photo-dot');
    if (photoTab && photoDot) {
      photoTab.disabled = !hasMedia;
      photoDot.hidden = !hasMedia;
    }
  };

  return { syncUI };
}

function bootV93() {
  const wait = () => {
    const bridge = window.__HJN_V93_BRIDGE__;
    if (!bridge || !bridge.isReady()) {
      requestAnimationFrame(wait);
      return;
    }
    mountPrologue(bridge);
    const theatre = mountTheatreChrome(bridge);
    if (theatre) {
      bridge.onSync(theatre.syncUI);
      // Lightweight RAF tick while guided tour is playing to keep progress hairline & audio cues smooth
      const loop = () => {
        if (document.getElementById('observatory')?.classList.contains('guided-tour-active')) {
          theatre.syncUI();
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wait, { once: true });
  } else {
    wait();
  }
}

bootV93();
