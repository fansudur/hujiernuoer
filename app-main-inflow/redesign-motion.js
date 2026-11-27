/* ==========================================================================
   app-main-inflow/redesign-motion.js
   Plan A — Lightweight Non-Invasive Micro-Interaction & Layout Guard Script
   - Sliding capsule gliders for segmented controls (.dim-switch, #exag-group,
     .scope-strip, .mode-switch, .drawer-tabs, .tools-theme-seg,
     .rm-tablet-lane-switch, and #v93-mob-tabs underline indicator)
   - Strict tablet (761px–1179px) left/right panel mutual exclusion
   - 6 restrained exhibition micro-motions:
     1) Guided-tour stop story cross-fade rise
     2) Photo lightbox reveal & image swap scale-fade
     3) Space-reference overview/local view transition
     4) Mobile/tablet tab sliding indicators + spring height transitions
     5) Monthly telemetry area readout micro-pulse
     6) SVG terrain profile floating readout capsule damped follow
   - Respects prefers-reduced-motion; never touches cameras, narration, or data.
   ========================================================================== */

const TABLET_MQ = '(min-width: 761px) and (max-width: 1179px)';

function isTabletViewport() {
  return window.matchMedia(TABLET_MQ).matches;
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function replayAnim(el, cls) {
  if (!el || reducedMotion()) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/* --------------------------------------------------------------------------
   1. Smooth Sliding Capsule / Underline Gliders
   -------------------------------------------------------------------------- */
function attachCapsuleGlider(container, itemSelector, activeMatch, tone = 'inverse', { mode = 'pill' } = {}) {
  if (!container || container.dataset.rmGliderBound === '1') return;
  container.dataset.rmGliderBound = '1';

  const glider = document.createElement('span');
  glider.className = 'rm-glider';
  glider.dataset.tone = tone;
  glider.setAttribute('aria-hidden', 'true');
  glider.style.opacity = '0';
  container.prepend(glider);

  let raf = 0;
  let initialized = false;

  const update = (instant = false) => {
    raf = 0;
    const rect = container.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      glider.style.opacity = '0';
      container.classList.remove('rm-has-glider');
      return;
    }
    const items = [...container.querySelectorAll(itemSelector)].filter(el => !el.hidden && el.offsetWidth > 0);
    const active = items.find(activeMatch);
    if (!active) {
      glider.style.opacity = '0';
      container.classList.remove('rm-has-glider');
      return;
    }

    let x = active.offsetLeft;
    let y = active.offsetTop;
    let w = active.offsetWidth;
    let h = active.offsetHeight;

    if (mode === 'underline') {
      const padX = Math.min(12, Math.round(w * 0.2));
      x = active.offsetLeft + padX;
      w = Math.max(18, active.offsetWidth - padX * 2);
      h = 2;
      y = active.offsetTop + active.offsetHeight - 2;
    } else {
      const mobileSlim = window.matchMedia('(max-width: 760px)').matches && active.offsetHeight >= 42;
      const insetY = mobileSlim ? 6 : 0;
      y = active.offsetTop + insetY;
      h = Math.max(24, active.offsetHeight - insetY * 2);
    }

    if (instant || !initialized) {
      glider.style.transition = 'none';
    }
    glider.style.width = `${w}px`;
    glider.style.height = `${h}px`;
    glider.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    glider.style.opacity = '1';
    container.classList.add('rm-has-glider');

    if (instant || !initialized) {
      void glider.offsetWidth;
      glider.style.transition = '';
      initialized = true;
    }
  };

  const schedule = (instant = false) => {
    if (instant) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      update(true);
      return;
    }
    if (!raf) raf = requestAnimationFrame(() => update(false));
  };

  const mo = new MutationObserver(() => schedule(false));
  mo.observe(container, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-pressed', 'aria-selected', 'hidden'],
    childList: true,
    characterData: true,
  });

  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => schedule(true));
    ro.observe(container);
  }
  window.addEventListener('resize', () => schedule(true), { passive: true });
  window.addEventListener('atlas:languagechange', () => {
    requestAnimationFrame(() => schedule(false));
  });
  container.addEventListener('click', () => schedule(false), { passive: true });

  const obs = document.getElementById('observatory');
  if (obs && container.classList.contains('dim-switch')) {
    new MutationObserver(() => schedule(false)).observe(obs, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  schedule(true);
}

function initAllGliders() {
  const obs = document.getElementById('observatory');
  attachCapsuleGlider(
    document.querySelector('#hud-top-right .dim-switch'),
    ':scope > .seg-btn',
    el => {
      if (obs?.classList.contains('walk-active')) return el.classList.contains('walk-btn');
      return el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true';
    },
    'inverse'
  );
  attachCapsuleGlider(
    document.getElementById('exag-group'),
    '.exag-btn',
    el => el.classList.contains('active'),
    'ice'
  );
  attachCapsuleGlider(
    document.getElementById('focus-scope-bar'),
    '.scope-btn',
    el => el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true',
    'soft'
  );
  attachCapsuleGlider(
    document.querySelector('#chart-deck .mode-switch'),
    '.mode-btn',
    el => el.classList.contains('active') || el.getAttribute('aria-selected') === 'true',
    'inverse'
  );
  attachCapsuleGlider(
    document.querySelector('#studio-drawer .drawer-tabs'),
    '.d-tab',
    el => el.classList.contains('active') || el.getAttribute('aria-selected') === 'true',
    'inverse'
  );
  for (const seg of document.querySelectorAll('#export-menu .tools-theme-seg')) {
    attachCapsuleGlider(
      seg,
      '.tools-seg-btn',
      el => el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true',
      'inverse'
    );
  }

  // Mobile guided tour tab underline glider (mounted dynamically by v93-chapter1.js)
  const bindMobTabs = () => {
    const mobTabs = document.getElementById('v93-mob-tabs');
    if (!mobTabs) return false;
    attachCapsuleGlider(
      mobTabs,
      '.v93-mob-tab',
      el => el.getAttribute('aria-selected') === 'true',
      'underline',
      { mode: 'underline' }
    );
    return true;
  };
  if (!bindMobTabs() && obs) {
    const mo = new MutationObserver(() => {
      if (bindMobTabs()) mo.disconnect();
    });
    mo.observe(obs, { childList: true });
  }

  // Space Reference 全区 / 本站 glider
  const refGroup = document.querySelector('#guided-reference-dock .guided-reference-title > [role="group"]');
  if (refGroup) {
    attachCapsuleGlider(
      refGroup,
      '#guide-map-overview, #guide-map-local',
      el => el.getAttribute('aria-pressed') === 'true',
      'inverse'
    );
  }

  // Dynamic Chart Deck Sub-Segmented Controls (同月跨年/同年跨月, 双湖/主湖/西长湖, profile filters)
  const deckSubbar = document.getElementById('deck-subbar');
  const bindSubSegs = () => {
    if (!deckSubbar) return;
    for (const seg of deckSubbar.querySelectorAll('.sub-seg')) {
      attachCapsuleGlider(
        seg,
        '.sub-seg-btn',
        el => el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true',
        'subtle'
      );
    }
  };
  if (deckSubbar) {
    new MutationObserver(bindSubSegs).observe(deckSubbar, { childList: true, subtree: true });
    bindSubSegs();
  }

  // Walk Mode Advanced Settings Gliders (1x/4x/8x & 08:00/12:00/18:00)
  const walkAdv = document.getElementById('walk-advanced');
  const walkExag = walkAdv?.querySelector('[role="group"][aria-label="地形垂向比例"]');
  const walkSunRow = walkAdv?.querySelector('.walk-row:has([data-walk-sun])') || walkAdv?.querySelector('[data-walk-sun]')?.closest('.walk-row');
  if (walkExag) {
    attachCapsuleGlider(
      walkExag,
      '[data-walk-exag]',
      el => el.getAttribute('aria-pressed') === 'true',
      'ice'
    );
  }
  if (walkSunRow) {
    attachCapsuleGlider(
      walkSunRow,
      '[data-walk-sun]',
      el => el.getAttribute('aria-pressed') === 'true',
      'soft'
    );
  }
  if (walkAdv) {
    walkAdv.addEventListener('toggle', () => {
      if (walkAdv.open) {
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      }
    });
  }
}

/* --------------------------------------------------------------------------
   2. Strict Tablet (761px–1179px) Left/Right Panel Mutual Exclusion
   -------------------------------------------------------------------------- */
function initTabletMutualExclusion() {
  const obs = document.getElementById('observatory');
  const studio = document.getElementById('studio-drawer');
  const inspector = document.getElementById('inspector-drawer');
  if (!obs || !studio || !inspector) return;

  let prevStudioOpen = obs.classList.contains('studio-open');
  let prevInspectorOpen = obs.classList.contains('inspector-open');
  let reconciling = false;

  const reconcileBrowseDrawers = () => {
    const sOpen = obs.classList.contains('studio-open');
    const iOpen = obs.classList.contains('inspector-open');

    if (!reconciling && isTabletViewport() && sOpen && iOpen) {
      reconciling = true;
      try {
        if (!prevStudioOpen && sOpen) {
          const closeInsp = inspector.querySelector('#btn-close-inspector, .icon-close');
          if (closeInsp) closeInsp.click();
          else {
            inspector.hidden = true;
            inspector.dataset.open = 'false';
            obs.classList.remove('inspector-open');
          }
        } else {
          const closeStudio = document.getElementById('btn-close-studio');
          if (closeStudio) closeStudio.click();
          else {
            studio.hidden = true;
            studio.dataset.open = 'false';
            obs.classList.remove('studio-open');
          }
        }
      } finally {
        reconciling = false;
      }
    }

    prevStudioOpen = obs.classList.contains('studio-open');
    prevInspectorOpen = obs.classList.contains('inspector-open');
  };

  new MutationObserver(reconcileBrowseDrawers).observe(obs, {
    attributes: true,
    attributeFilter: ['class'],
  });
  window.addEventListener('resize', reconcileBrowseDrawers, { passive: true });

  const setTabletTourLane = lane => {
    const next = lane === 'reference' ? 'reference' : 'story';
    obs.dataset.rmTabletLane = next;
    for (const btn of document.querySelectorAll('.rm-tablet-lane-btn')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.rmLane === next));
    }
  };

  const mountTabletTourSwitch = () => {
    const topbar = document.getElementById('v93-tour-topbar');
    if (!topbar || topbar.querySelector('.rm-tablet-lane-switch')) return Boolean(topbar);
    const rightGroup = topbar.querySelector('.v93-topbar-right');
    if (!rightGroup) return false;

    const wrap = document.createElement('div');
    wrap.className = 'rm-tablet-lane-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', '平板端左右栏互斥切换');
    wrap.innerHTML = `
      <button type="button" class="rm-tablet-lane-btn" data-rm-lane="story" aria-pressed="true">讲解</button>
      <button type="button" class="rm-tablet-lane-btn" data-rm-lane="reference" aria-pressed="false">参照·原图</button>
    `;
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('.rm-tablet-lane-btn');
      if (btn) setTabletTourLane(btn.dataset.rmLane);
    });
    rightGroup.prepend(wrap);
    if (!obs.dataset.rmTabletLane) setTabletTourLane('story');

    attachCapsuleGlider(
      wrap,
      '.rm-tablet-lane-btn',
      el => el.getAttribute('aria-pressed') === 'true',
      'inverse'
    );
    return true;
  };

  if (!mountTabletTourSwitch()) {
    const waitObs = new MutationObserver(() => {
      if (mountTabletTourSwitch()) waitObs.disconnect();
    });
    waitObs.observe(obs, { childList: true });
  }

  document.addEventListener('click', e => {
    if (!isTabletViewport() || !obs.classList.contains('guided-tour-active')) return;
    if (e.target.closest('#guided-board-media button, #guided-tour-photo-link')) {
      setTabletTourLane('reference');
    } else if (e.target.closest('#guided-photo-close')) {
      setTabletTourLane('story');
    } else if (e.target.closest('#v74-open-tour-profile, [data-guide-kmz-profile], #guided-east-profiles button')) {
      setTabletTourLane('story');
    }
  });

  new MutationObserver(() => {
    if (obs.classList.contains('guided-tour-active') && !obs.dataset.rmTabletLane) {
      setTabletTourLane('story');
    }
  }).observe(obs, { attributes: true, attributeFilter: ['class'] });
}

/* --------------------------------------------------------------------------
   3. Exhibition Micro-Motions (Story, Photo, Reference, Telemetry)
   -------------------------------------------------------------------------- */
function initTourStoryMotion() {
  const titleEl = document.getElementById('guided-tour-title');
  if (!titleEl) return;
  let lastTitle = titleEl.textContent || '';

  new MutationObserver(() => {
    const next = titleEl.textContent || '';
    if (!next || next === lastTitle) return;
    lastTitle = next;
    replayAnim(titleEl, 'rm-story-enter');
    replayAnim(document.getElementById('guided-tour-caption'), 'rm-story-enter');
    replayAnim(document.getElementById('v93-ev-badge'), 'rm-story-enter');
    replayAnim(document.getElementById('guided-director-board'), 'rm-story-enter');
  }).observe(titleEl, { childList: true, characterData: true, subtree: true });
}

function initPhotoMotion() {
  const preview = document.getElementById('guided-photo-preview');
  const mainImg = document.getElementById('guided-photo-enlarged');
  if (preview) {
    let wasHidden = preview.hidden;
    new MutationObserver(() => {
      if (wasHidden && !preview.hidden) {
        replayAnim(preview, 'rm-photo-enter');
      }
      wasHidden = preview.hidden;
    }).observe(preview, { attributes: true, attributeFilter: ['hidden'] });
  }
  if (mainImg) {
    let lastSrc = mainImg.getAttribute('src') || '';
    new MutationObserver(() => {
      const next = mainImg.getAttribute('src') || '';
      if (next && next !== lastSrc) {
        lastSrc = next;
        replayAnim(mainImg.closest('.v83-photo-frame') || mainImg, 'rm-photo-enter');
      }
    }).observe(mainImg, { attributes: true, attributeFilter: ['src'] });
  }
}

function initReferenceMotion() {
  const pane = document.getElementById('guided-map-pane');
  if (!pane) return;
  let lastView = pane.dataset.view;
  new MutationObserver(() => {
    if (pane.dataset.view !== lastView) {
      lastView = pane.dataset.view;
      replayAnim(pane, 'rm-ref-fade');
    }
  }).observe(pane, { attributes: true, attributeFilter: ['data-view'] });
}

function initTelemetryMotion() {
  const chips = document.getElementById('lake-chips');
  if (!chips) return;
  let lastVal = '';
  new MutationObserver(() => {
    const valEl = chips.querySelector('.lake-chip-val');
    const txt = valEl?.textContent?.trim() || '';
    if (valEl && txt && txt !== lastVal) {
      const hadPrev = Boolean(lastVal);
      lastVal = txt;
      if (hadPrev) replayAnim(valEl, 'rm-num-tick');
    }
  }).observe(chips, { childList: true, subtree: true, characterData: true });
}

/* --------------------------------------------------------------------------
   4. Live SVG Profile Floating Pill & Horizontal Crosshair Sync (Damped)
   -------------------------------------------------------------------------- */
function syncProfileSvgPill(svg) {
  if (!svg) return;
  const line = svg.querySelector('[data-prof-cursor-line]');
  const pill = svg.querySelector('[data-prof-cursor-pill]');
  if (!line || !pill) return;

  const cx = parseFloat(line.getAttribute('x1'));
  if (!Number.isFinite(cx)) return;

  const padL = Number(svg.dataset.padL) || 46;
  const padR = Number(svg.dataset.padR) || 16;
  const padT = Number(svg.dataset.padT) || 28;
  const viewW = Number(svg.dataset.viewW) || 760;

  const gloDot = svg.querySelector('[data-prof-cursor-glo]');
  const gloHalo = svg.querySelector('[data-prof-cursor-halo]');
  const hLine = svg.querySelector('[data-prof-cursor-hline]');
  const gloVisible = gloDot && gloDot.getAttribute('visibility') !== 'hidden';
  const cy = gloVisible ? parseFloat(gloDot.getAttribute('cy')) : NaN;

  if (gloHalo) {
    gloHalo.setAttribute('cx', cx.toFixed(1));
    gloHalo.setAttribute('visibility', gloVisible ? 'visible' : 'hidden');
    if (Number.isFinite(cy)) gloHalo.setAttribute('cy', cy.toFixed(1));
  }

  if (hLine) {
    if (gloVisible && Number.isFinite(cy)) {
      hLine.setAttribute('y1', cy.toFixed(1));
      hLine.setAttribute('y2', cy.toFixed(1));
      hLine.setAttribute('visibility', 'visible');
    } else {
      hLine.setAttribute('visibility', 'hidden');
    }
  }

  const readout = document.getElementById('profile-cursor-readout');
  const txtEl = pill.querySelector('text');
  const rectEl = pill.querySelector('rect');
  if (readout && txtEl) {
    const distText = readout.children[1]?.textContent?.replace(/^(?:里程|Distance(?:\s+along\s+profile)?)\s*/i, '') || '';
    const elevText = readout.children[3]?.textContent
      ?.replace(/^GLO-30\s*/, '')
      ?.replace(/;\s*lakebed not surveyed$/i, '') || '';
    const label = [distText, elevText].filter(Boolean).join(' · ');
    if (label && txtEl.textContent !== label) {
      txtEl.textContent = label;
    }
  }

  if (txtEl && rectEl) {
    let textW = 112;
    try {
      const bb = txtEl.getBBox();
      if (bb.width > 10) textW = bb.width;
    } catch {}
    const pillW = Math.max(82, Math.round(textW + 18));
    const pillH = 19;
    const minX = padL + 2;
    const maxX = viewW - padR - pillW - 2;
    const px = Math.max(minX, Math.min(maxX, cx - pillW * 0.5));
    const py = Math.max(1, padT - pillH - 3);
    rectEl.setAttribute('x', '0');
    rectEl.setAttribute('y', '0');
    rectEl.setAttribute('width', String(pillW));
    rectEl.setAttribute('height', String(pillH));
    txtEl.setAttribute('x', (pillW * 0.5).toFixed(1));
    txtEl.setAttribute('y', (pillH * 0.5 + 3.1).toFixed(1));
    pill.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
  }
}

function initProfileChartSync() {
  const host = document.getElementById('deck-chart-host');
  if (!host) return;

  let activeObserver = null;
  let observedSvg = null;

  const bindSvg = () => {
    const svg = host.querySelector('svg[data-profile-svg]');
    if (svg === observedSvg) {
      if (svg) syncProfileSvgPill(svg);
      return;
    }
    activeObserver?.disconnect();
    observedSvg = svg;
    if (!svg) return;
    syncProfileSvgPill(svg);

    const line = svg.querySelector('[data-prof-cursor-line]');
    if (line) {
      activeObserver = new MutationObserver(() => syncProfileSvgPill(svg));
      activeObserver.observe(line, { attributes: true, attributeFilter: ['x1', 'x2'] });
    }
  };

  new MutationObserver(bindSvg).observe(host, { childList: true, subtree: true });
  bindSvg();
}

/* --------------------------------------------------------------------------
   5. Desktop Walk-Mode First-Entry Concise HUD Hint (Non-Invasive UI Only)
   -------------------------------------------------------------------------- */
function initWalkDesktopHint() {
  const obs = document.getElementById('observatory');
  const walkLab = document.getElementById('walk-lab');
  if (!obs || !walkLab) return;

  const HINT_KEY = 'rm_walk_desktop_hint_seen_v1';
  const desktopFine = () =>
    window.matchMedia('(min-width: 761px)').matches &&
    !window.matchMedia('(pointer: coarse)').matches;

  // Build concise floating hint bar
  let hint = document.getElementById('rm-walk-desktop-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'rm-walk-desktop-hint';
    hint.className = 'rm-walk-hint';
    hint.setAttribute('role', 'status');
    hint.setAttribute('aria-live', 'polite');
    hint.hidden = true;
    hint.innerHTML = `
      <span class="rm-walk-hint-items">
        <span class="rm-walk-hint-item"><kbd>拖动</kbd>转向</span>
        <span class="rm-walk-hint-sep" aria-hidden="true"></span>
        <span class="rm-walk-hint-item"><kbd>WASD</kbd>移动</span>
        <span class="rm-walk-hint-sep" aria-hidden="true"></span>
        <span class="rm-walk-hint-item"><kbd>E / Q</kbd>升降</span>
        <span class="rm-walk-hint-sep" aria-hidden="true"></span>
        <span class="rm-walk-hint-item"><kbd>滚轮</kbd>调速</span>
      </span>
      <button type="button" class="rm-walk-hint-close" aria-label="收起操作提示">知道了</button>
    `;
    obs.appendChild(hint);
  }

  // Add subtle '?' toggle button in desktop #walk-lab header so users can recall hint anytime
  const headerRow = walkLab.querySelector(':scope > .walk-row:first-of-type');
  let helpBtn = walkLab.querySelector('.rm-walk-help-btn');
  if (headerRow && !helpBtn) {
    helpBtn = document.createElement('button');
    helpBtn.type = 'button';
    helpBtn.className = 'rm-walk-help-btn';
    helpBtn.textContent = '?';
    helpBtn.title = '显示/隐藏键鼠操作提示';
    helpBtn.setAttribute('aria-label', '键鼠操作提示');
    helpBtn.setAttribute('aria-controls', 'rm-walk-desktop-hint');
    helpBtn.setAttribute('aria-expanded', 'false');
    headerRow.appendChild(helpBtn);
  }

  const syncHintOffset = () => {
    const h = walkLab.getBoundingClientRect().height;
    if (h > 30) {
      obs.style.setProperty('--rm-walk-lab-h', `${Math.round(h)}px`);
    }
  };

  let hideTimer = 0;
  let leaveTimer = 0;
  const setHintVisible = (show, { remember = false, autoFade = false } = {}) => {
    clearTimeout(hideTimer);
    clearTimeout(leaveTimer);
    const visible = Boolean(show && desktopFine() && obs.classList.contains('walk-active'));
    if (helpBtn) helpBtn.setAttribute('aria-expanded', String(visible));
    if (visible) {
      hint.classList.remove('rm-walk-hint-leaving');
      hint.hidden = false;
      syncHintOffset();
      replayAnim(hint, 'rm-story-enter');
      if (autoFade) {
        hideTimer = window.setTimeout(() => setHintVisible(false, { remember: true }), 14000);
      }
    } else if (!hint.hidden) {
      if (reducedMotion()) {
        hint.hidden = true;
      } else {
        hint.classList.add('rm-walk-hint-leaving');
        leaveTimer = window.setTimeout(() => {
          hint.hidden = true;
          hint.classList.remove('rm-walk-hint-leaving');
        }, 185);
      }
    }
    if (remember) {
      try { sessionStorage.setItem(HINT_KEY, '1'); } catch {}
    }
  };

  // Speed Readout Micro-Pulse on every speed adjustment (buttons, pace toggle, wheel)
  const speedVal = document.getElementById('walk-speed-value');
  if (speedVal) {
    let lastSpeed = speedVal.textContent?.trim() || '';
    new MutationObserver(() => {
      const next = speedVal.textContent?.trim() || '';
      if (next && next !== lastSpeed) {
        const hadPrev = Boolean(lastSpeed);
        lastSpeed = next;
        if (hadPrev && obs.classList.contains('walk-active')) {
          replayAnim(speedVal, 'rm-num-tick');
        }
      }
    }).observe(speedVal, { childList: true, characterData: true, subtree: true });
  }

  hint.querySelector('.rm-walk-hint-close')?.addEventListener('click', () => {
    setHintVisible(false, { remember: true });
  });

  helpBtn?.addEventListener('click', () => {
    setHintVisible(hint.hidden, { remember: false, autoFade: false });
  });

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(syncHintOffset).observe(walkLab);
  }

  // Dismiss gracefully once user begins navigating with movement keys
  window.addEventListener('keydown', e => {
    if (hint.hidden || !obs.classList.contains('walk-active')) return;
    if (/^(KeyW|KeyA|KeyS|KeyD|KeyE|KeyQ|Space)$/.test(e.code)) {
      setHintVisible(false, { remember: true });
    }
  }, { passive: true });

  let wasWalk = obs.classList.contains('walk-active');
  const onWalkState = () => {
    const isWalk = obs.classList.contains('walk-active');
    if (isWalk && !wasWalk) {
      let seen = false;
      try { seen = sessionStorage.getItem(HINT_KEY) === '1'; } catch {}
      if (!seen && desktopFine()) {
        requestAnimationFrame(() => setHintVisible(true, { autoFade: true }));
      }
      // Recalculate top-right dim-switch glider after ::before live dot mounts
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 40);
    } else if (!isWalk && wasWalk) {
      setHintVisible(false);
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 40);
    }
    wasWalk = isWalk;
  };

  new MutationObserver(onWalkState).observe(obs, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

/* --------------------------------------------------------------------------
   6. Guided-Tour Audio Scrubber Visual Sync (60fps) & Drag Isolation +
      Studio Drawer Tab Content Cross-Fade
   -------------------------------------------------------------------------- */
function initGuidedSeekEnhancement() {
  const obs = document.getElementById('observatory');
  const bind = () => {
    const seek = document.getElementById('v93-step-seek');
    const time = document.getElementById('v93-step-time');
    if (!seek || seek.dataset.rmSeekBound === '1') return Boolean(seek);
    seek.dataset.rmSeekBound = '1';

    let lastPct = '';
    const syncPct = () => {
      const max = parseFloat(seek.max) || 0;
      const val = parseFloat(seek.value) || 0;
      const pct = `${(max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0).toFixed(2)}%`;
      if (pct !== lastPct) {
        lastPct = pct;
        seek.style.setProperty('--seek-pct', pct);
      }
    };

    const stopBubble = e => e.stopPropagation();
    seek.addEventListener('pointerdown', stopBubble);
    seek.addEventListener('mousedown', stopBubble);
    seek.addEventListener('touchstart', stopBubble, { passive: true });
    seek.addEventListener('input', syncPct);
    seek.addEventListener('change', syncPct);

    if (time) {
      new MutationObserver(syncPct).observe(time, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    // Silky sub-second track fill sync while Guided Tour is active
    let rafId = 0;
    const tick = () => {
      rafId = 0;
      if (!obs?.classList.contains('guided-tour-active')) return;
      syncPct();
      rafId = requestAnimationFrame(tick);
    };
    const syncLoop = () => {
      if (obs?.classList.contains('guided-tour-active')) {
        if (!rafId) rafId = requestAnimationFrame(tick);
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
    if (obs) {
      new MutationObserver(syncLoop).observe(obs, { attributes: true, attributeFilter: ['class'] });
    }
    syncPct();
    syncLoop();
    return true;
  };

  if (!bind()) {
    const nav = document.getElementById('guided-tour-nav-strip') || document.body;
    const mo = new MutationObserver(() => {
      if (bind()) mo.disconnect();
    });
    mo.observe(nav, { childList: true, subtree: true });
  }
}

function initDrawerContentMotion() {
  const tabs = document.querySelector('#studio-drawer .drawer-tabs');
  const body = document.getElementById('studio-drawer-body');
  if (!tabs || !body) return;
  tabs.addEventListener('click', e => {
    if (e.target.closest('.d-tab')) {
      requestAnimationFrame(() => replayAnim(body, 'rm-story-enter'));
    }
  });
}

/* --------------------------------------------------------------------------
   7. Bidirectional Guided-Tour Right-Rail Coupling
      - Space Reference resize/collapse/credit-expand pushes Photo Preview live at 60fps
      - Space Reference width resize syncs docked single-photo width & right alignment
      - Photo Preview upward drag/resize smoothly compresses Space Reference above it
      - Strict zero-overlap floor & ceiling matching the left-column coupling
   -------------------------------------------------------------------------- */
function initGuidedRightRailSync() {
  const obs = document.getElementById('observatory');
  const dock = document.getElementById('guided-reference-dock');
  const photo = document.getElementById('guided-photo-preview');
  const nav = document.getElementById('guided-tour-nav-strip');
  if (!obs || !dock || !photo) return;

  const credit = document.getElementById('guided-reference-credit');
  const eastLegend = document.getElementById('guided-east-legend');
  const prevVars = new Map();

  // Mount optional one-click wide compare toggle ("展宽 ⤢" / "还原 ⤡") for paired satellite photos
  let wideToggle = document.getElementById('rm-photo-wide-toggle');
  const photoHeader = photo.querySelector(':scope > header');
  const photoClose = document.getElementById('guided-photo-close');
  if (!wideToggle && photoHeader && photoClose) {
    wideToggle = document.createElement('button');
    wideToggle.id = 'rm-photo-wide-toggle';
    wideToggle.type = 'button';
    wideToggle.className = 'deck-btn';
    wideToggle.setAttribute('aria-pressed', 'false');
    wideToggle.title = '放大查看原图或还原默认尺寸';
    wideToggle.dataset.i18n = 'rm.photo.expand';
    wideToggle.textContent = '放大 ⤢';
    photoHeader.insertBefore(wideToggle, photoClose);
  }

  const updateWideToggleUI = () => {
    if (!wideToggle) return;
    const isCustomNow = photo.classList.contains('v74-custom-panel');
    if (photo.hidden || isCustomNow) {
      photo.classList.remove('rm-paired-wide');
    }
    wideToggle.hidden = isCustomNow;
    const wide = photo.classList.contains('rm-paired-wide');
    wideToggle.setAttribute('aria-pressed', String(wide));
    wideToggle.dataset.i18n = wide ? 'rm.photo.collapse' : 'rm.photo.expand';
    wideToggle.textContent = wide ? '还原 ⤡' : '放大 ⤢';
  };

  if (wideToggle && wideToggle.dataset.rmBound !== '1') {
    wideToggle.dataset.rmBound = '1';
    wideToggle.addEventListener('click', () => {
      photo.classList.toggle('rm-paired-wide');
      updateWideToggleUI();
      sync();
    });
  }

  const setVar = (name, val) => {
    const next = val == null ? '' : String(val);
    if (prevVars.get(name) === next) return;
    prevVars.set(name, next);
    if (next) obs.style.setProperty(name, next);
    else obs.style.removeProperty(name);
  };

  const clearAll = () => {
    setVar('--rm-photo-top', null);
    setVar('--rm-photo-max-h', null);
    setVar('--rm-photo-width', null);
    setVar('--rm-photo-right', null);
    setVar('--rm-ref-max-h', null);
  };

  let raf = 0;

  const sync = () => {
    raf = 0;
    updateWideToggleUI();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
    if (!obs.classList.contains('guided-tour-active') || vw <= 760) {
      clearAll();
      return;
    }

    const topbar = document.getElementById('v93-tour-topbar');
    const topFloor = Math.max(66, Math.round((topbar?.getBoundingClientRect().bottom || 56) + 10));
    const gap = 10;

    const dockRect = dock.getBoundingClientRect();
    const photoRect = photo.getBoundingClientRect();
    const navRect = nav ? nav.getBoundingClientRect() : null;

    const dockVisible = !dock.hidden && dockRect.width > 4 && dockRect.height > 4;
    const photoVisible = !photo.hidden && photoRect.width > 4 && photoRect.height > 4;
    const dockCustom = dock.classList.contains('v74-custom-panel');
    const photoCustom = photo.classList.contains('v74-custom-panel');
    const dockMinimized = dock.classList.contains('v93-radar-minimized');
    const isExpandedWide = photo.classList.contains('rm-paired-wide');
    const navVisible = Boolean(nav && !nav.hidden && !nav.classList.contains('v74-custom-panel') && navRect && navRect.height > 4);

    if (!photoCustom) {
      if (isExpandedWide) {
        const expW = vw >= 1180 ? Math.min(vw * 0.60, 780) : Math.min(vw - 28, 680);
        const estPhotoLeft = (vw - 14) - expW;
        const overlapsNav = navVisible && estPhotoLeft < navRect.right + 14;
        const laneBottom = overlapsNav ? Math.round(navRect.top) - 10 : Math.round(vh - 14);
        setVar('--rm-ref-max-h', null);
        setVar('--rm-photo-top', `${topFloor}px`);
        setVar('--rm-photo-max-h', `${Math.max(240, laneBottom - topFloor)}px`);
        setVar('--rm-photo-width', `${Math.round(expW)}px`);
        setVar('--rm-photo-right', '14px');
        return;
      }

      const dockInRight = dockVisible && dockRect.right > vw * 0.45;
      const syncWidth = dockInRight && dockCustom && dockRect.left > vw * 0.42 && vw >= 1180;
      const estPhotoW = syncWidth
        ? dockRect.width
        : vw >= 1180
          ? Math.max(360, Math.min(vw * 0.32, 480))
          : Math.min(410, vw - 76);
      const estPhotoRightEdge = syncWidth ? dockRect.right : vw - 14;
      const estPhotoLeft = estPhotoRightEdge - estPhotoW;
      const overlapsNav = navVisible && estPhotoLeft < navRect.right + 14;
      const laneBottom = overlapsNav ? Math.round(navRect.top) - 10 : Math.round(vh - 14);

      if (dockInRight) {
        let effDockBottom = dockRect.bottom;
        if (photoVisible && !dockMinimized) {
          const maxDockH = Math.max(158, laneBottom - Math.round(dockRect.top) - gap - 176);
          setVar('--rm-ref-max-h', `${maxDockH}px`);
          effDockBottom = Math.min(dockRect.bottom, dockRect.top + maxDockH);
        } else {
          setVar('--rm-ref-max-h', null);
        }

        const photoTop = Math.max(topFloor, Math.round(effDockBottom) + gap);
        const photoMaxH = Math.max(148, laneBottom - photoTop);
        setVar('--rm-photo-top', `${photoTop}px`);
        setVar('--rm-photo-max-h', `${photoMaxH}px`);

        if (syncWidth) {
          setVar('--rm-photo-width', `${Math.round(dockRect.width)}px`);
          setVar('--rm-photo-right', `${Math.max(10, Math.round(vw - dockRect.right))}px`);
        } else {
          setVar('--rm-photo-width', null);
          setVar('--rm-photo-right', null);
        }
      } else {
        setVar('--rm-ref-max-h', null);
        setVar('--rm-photo-width', null);
        setVar('--rm-photo-right', null);
        setVar('--rm-photo-top', `${topFloor}px`);
        setVar('--rm-photo-max-h', `${Math.max(180, laneBottom - topFloor)}px`);
      }
      return;
    }

    // Photo preview was manually moved/resized: let it float freely, and compress Space Reference
    // cleanly above it whenever Photo Preview moves up into Space Reference's vertical footprint.
    setVar('--rm-photo-top', null);
    setVar('--rm-photo-max-h', null);
    setVar('--rm-photo-width', null);
    setVar('--rm-photo-right', null);

    if (dockVisible && photoVisible && !dockMinimized) {
      const horizOverlap = photoRect.left < dockRect.right - 8 && photoRect.right > dockRect.left + 8;
      if (horizOverlap && photoRect.top > dockRect.top + 80) {
        const availDockH = Math.max(158, Math.round(photoRect.top - dockRect.top - gap));
        setVar('--rm-ref-max-h', `${availDockH}px`);
        return;
      }
    }
    setVar('--rm-ref-max-h', null);
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(sync);
  };

  // Immediate synchronous sync on every v74 drag/resize frame for locked 60fps coupling
  window.addEventListener('hjn-v74-panel-change', sync);
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });

  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(schedule);
    for (const el of [dock, photo, nav, credit, eastLegend].filter(Boolean)) {
      ro.observe(el);
    }
  }

  new MutationObserver(schedule).observe(obs, {
    attributes: true,
    attributeFilter: ['class', 'data-rm-tablet-lane'],
  });
  for (const el of [dock, photo]) {
    new MutationObserver(schedule).observe(el, {
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });
  }
  credit?.addEventListener('toggle', schedule);
  eastLegend?.addEventListener('toggle', schedule);

  sync();
}

/* --------------------------------------------------------------------------
   8. Exhibition Opening Veil (upgrades #v93-prologue) & Author Colophon Badge
      - Translucent atmospheric opening curtain on clean first visit (URL without params)
      - Auto-skipped on deep-linked URLs & remembered per browser session
      - Re-openable anytime from Tools Menu ("关于本图谱与开场序幕")
      - Persistent subtle bottom-right author colophon badge on wide Browse screens
   -------------------------------------------------------------------------- */
function initExhibitionIntroAndColophon() {
  const obs = document.getElementById('observatory');
  if (!obs) return;

  const INTRO_SEEN_KEY = 'rm_intro_seen_v1';

  // 1. Mount subtle persistent author badge (Desktop Browse Mode bottom-right)
  if (!document.getElementById('rm-author-badge')) {
    const badge = document.createElement('a');
    badge.id = 'rm-author-badge';
    badge.className = 'rm-author-badge';
    badge.href = 'https://fansudur.com';
    badge.target = '_blank';
    badge.rel = 'noopener noreferrer';
    badge.title = '苏凡 (Fan Sudur) · 访问个人主页 fansudur.com';
    badge.setAttribute('aria-label', '作者苏凡 Fan Sudur，访问 fansudur.com');
    badge.innerHTML = `
      <span class="rm-author-badge-mark" aria-hidden="true">
        <img class="rm-brand-logo rm-logo-for-dark" src="brand/logo-light.png" alt="" width="15" height="15" decoding="async">
        <img class="rm-brand-logo rm-logo-for-light" src="brand/logo-dark.png" alt="" width="15" height="15" decoding="async">
      </span>
      <span class="rm-author-badge-name">苏凡 · Fan Sudur</span>
      <span class="rm-author-badge-sep" aria-hidden="true"></span>
      <span class="rm-author-badge-url">fansudur.com ↗</span>
    `;
    obs.appendChild(badge);
  }

  // 2. Mount atmospheric scrim for the Opening Veil
  let scrim = document.getElementById('rm-intro-veil-scrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.id = 'rm-intro-veil-scrim';
    scrim.className = 'rm-intro-veil-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    scrim.hidden = true;
    obs.appendChild(scrim);
  }

  let leavingTimer = 0;

  const syncIntroClass = card => {
    const isTour = obs.classList.contains('guided-tour-active');
    const isWalk = obs.classList.contains('walk-active');
    const open = Boolean(card && !card.hidden && !isTour && !isWalk);
    obs.classList.toggle('rm-intro-open', open);
    scrim.hidden = !open;
  };

  const dismissIntro = (card, { instant = false } = {}) => {
    if (!card || card.hidden) return;
    try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch {}
    clearTimeout(leavingTimer);
    if (instant || reducedMotion()) {
      card.classList.remove('rm-veil-leaving');
      card.hidden = true;
      syncIntroClass(card);
      return;
    }
    card.classList.add('rm-veil-leaving');
    scrim.classList.add('rm-veil-leaving');
    leavingTimer = window.setTimeout(() => {
      card.hidden = true;
      card.classList.remove('rm-veil-leaving');
      scrim.classList.remove('rm-veil-leaving');
      syncIntroClass(card);
    }, 220);
  };

  const openIntro = card => {
    if (!card || obs.classList.contains('guided-tour-active') || obs.classList.contains('walk-active')) return;
    clearTimeout(leavingTimer);
    card.classList.remove('rm-veil-leaving');
    scrim.classList.remove('rm-veil-leaving');
    const detailsBtn = card.querySelector('#v93-prologue-details');
    if (detailsBtn) {
      detailsBtn.setAttribute('aria-expanded', 'false');
      detailsBtn.textContent = '查看章节脉络与四类证据';
    }
    card.hidden = false;
    syncIntroClass(card);
  };

  const enhancePrologue = () => {
    const card = document.getElementById('v93-prologue');
    if (!card || card.dataset.rmVeilBound === '1') return Boolean(card);
    card.dataset.rmVeilBound = '1';

    // Ensure scrim sits immediately beneath the card in DOM order
    if (scrim.parentElement === obs && card.parentElement === obs) {
      obs.insertBefore(scrim, card);
    }

    // Add coordinate eyebrow at top of the Opening Veil
    if (!card.querySelector('.rm-veil-eyebrow')) {
      const eyebrow = document.createElement('div');
      eyebrow.className = 'rm-veil-eyebrow';
      eyebrow.innerHTML = `
        <span class="rm-veil-emblem" aria-hidden="true">
          <img class="rm-brand-logo rm-logo-for-dark" src="brand/logo-light.png" alt="" width="20" height="20" decoding="async">
          <img class="rm-brand-logo rm-logo-for-light" src="brand/logo-dark.png" alt="" width="20" height="20" decoding="async">
        </span>
        <span class="rm-veil-coords">49°08′N · 119°42′E</span>
        <span class="rm-veil-dot" aria-hidden="true"></span>
        <span class="rm-veil-region" data-i18n="rm.intro.region">鄂温克族自治旗</span>
      `;
      card.prepend(eyebrow);
    }

    // Add concise 1-sentence exhibition hook directly under title header
    const head = card.querySelector('.v93-pro-head');
    if (head && !card.querySelector('.rm-veil-hook')) {
      const hook = document.createElement('p');
      hook.className = 'rm-veil-hook';
      hook.dataset.i18n = 'rm.intro.hook';
      hook.textContent = '一座草原内陆湖四十年的涨退，与寻找它来水路径的实地追踪。';
      head.insertAdjacentElement('afterend', hook);
    }

    // Refine disclosure label for desktop + mobile unified expandable details
    const detailsBtn = card.querySelector('#v93-prologue-details');
    if (detailsBtn) {
      detailsBtn.textContent = '查看章节脉络与四类证据';
      const origOnclick = detailsBtn.onclick;
      detailsBtn.onclick = e => {
        if (typeof origOnclick === 'function') origOnclick.call(detailsBtn, e);
        const expanded = detailsBtn.getAttribute('aria-expanded') === 'true';
        detailsBtn.textContent = expanded ? '收起章节与证据说明' : '查看章节脉络与四类证据';
      };
    }

    // Append Author Colophon & Copyright footer inside Opening Veil
    if (!card.querySelector('.rm-veil-colophon')) {
      const footer = document.createElement('footer');
      footer.className = 'rm-veil-colophon';
      footer.innerHTML = `
        <div class="rm-veil-colophon-row">
          <span class="rm-veil-author">
            <span class="rm-veil-author-role" data-i18n="rm.intro.by">调查、制图与交互</span>
            <strong>苏凡 · Fan Sudur</strong>
          </span>
          <a class="rm-colophon-link" href="https://fansudur.com" target="_blank" rel="noopener noreferrer">fansudur.com <span aria-hidden="true">↗</span></a>
        </div>
        <div class="rm-veil-rights" data-i18n="rm.intro.rights">© 2026 苏凡（Fan Sudur）版权所有 · 未经书面许可禁止任何转载或其他用途</div>
      `;
      card.appendChild(footer);
    }

    // Remember dismissal across same-session refreshes; allow instant bypass when already seen
    let seenBefore = false;
    try { seenBefore = sessionStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch {}
    if (seenBefore && !card.hidden) {
      card.hidden = true;
    }

    // Intercept close/explore/start clicks to persist session memory cleanly
    const markSeen = () => {
      try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch {}
    };
    card.querySelector('#v93-prologue-start')?.addEventListener('click', markSeen);
    card.querySelector('#v93-prologue-close')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      dismissIntro(card);
    }, true);
    card.querySelector('#v93-prologue-explore')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      dismissIntro(card);
    }, true);
    card.addEventListener('click', e => {
      if (e.target.closest('.v93-stage-jump')) markSeen();
    });

    scrim.addEventListener('click', () => dismissIntro(card));
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !card.hidden && obs.classList.contains('rm-intro-open')) {
        e.preventDefault();
        dismissIntro(card);
      }
    });

    // Wire "关于本图谱与开场序幕" replay button inside Tools Menu (#export-menu)
    const replayBtn = document.getElementById('rm-btn-open-intro');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        const exportMenu = document.getElementById('export-menu');
        const closeBtn = exportMenu?.querySelector('[data-close-popover="export-menu"]');
        if (closeBtn) closeBtn.click();
        else if (exportMenu) exportMenu.hidden = true;
        requestAnimationFrame(() => openIntro(card));
      });
    }

    // Keep observatory .rm-intro-open strictly synchronized with card.hidden & mode switches
    new MutationObserver(() => {
      if (card.hidden) markSeen();
      syncIntroClass(card);
    }).observe(card, { attributes: true, attributeFilter: ['hidden'] });
    new MutationObserver(() => syncIntroClass(card)).observe(obs, {
      attributes: true,
      attributeFilter: ['class'],
    });

    syncIntroClass(card);
    return true;
  };

  if (!enhancePrologue()) {
    const mo = new MutationObserver(() => {
      if (enhancePrologue()) mo.disconnect();
    });
    mo.observe(obs, { childList: true });
  }
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
function boot() {
  initAllGliders();
  initTabletMutualExclusion();
  initTourStoryMotion();
  initPhotoMotion();
  initReferenceMotion();
  initTelemetryMotion();
  initProfileChartSync();
  initWalkDesktopHint();
  initGuidedSeekEnhancement();
  initDrawerContentMotion();
  initGuidedRightRailSync();
  initExhibitionIntroAndColophon();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
