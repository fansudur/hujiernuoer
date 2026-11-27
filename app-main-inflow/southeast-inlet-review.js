/* ==========================================================================
   southeast-inlet-review.js
   Zero-DOM logic for Southeast Same-Location Monthly Inspection:
   - Primary window: profile_zero_r60m (E20 0 m anchor, 22 native 0.00025° cells)
     2024-06 (0/22) -> 2024-07 (5/22, same main component) -> 2024-08 (5/22, separate)
   - Independent cross-check window: cluster7_r37m_fixed_KMZ (8 native cells,
     57.01 m from E20 anchor, only 2 overlapping cells [64,126] & [64,127])
     plus 2014-08 partial local no-data regression (0 water / 7 observed / 1 nodata
     at [62,127], while whole lake remains qualified 108.09 ha).
   - Never substitutes one window's cells for another, never renders loading/error
     as zero water, never calls no-detection "dry ground", and never labels raster
     adjacency as hydraulic connectivity.
   ========================================================================== */

export const SE_PRIMARY_WINDOW = 'profile_zero_r60m';
export const SE_CLUSTER7_WINDOW = 'cluster7_r37m_fixed_KMZ';

export const SE_WINDOWS = Object.freeze({
  [SE_PRIMARY_WINDOW]: Object.freeze({
    id: SE_PRIMARY_WINDOW,
    title: '主试例：东南剖面 B · 0 m（半径 60 m）',
    shortLabel: '剖面 B · 60 m（E20 主试例）',
    anchorLabel: 'E20 剖面 B · 0 m 历史模型锚点',
    totalCells: 22,
    radiusM: 60,
    domainLabel: '历史外窗 +250 m（亦在固定 KMZ 内）',
    quickMonths: Object.freeze(['2024-06', '2024-07', '2024-08']),
    note: '以东南剖面 B 的 0 m 历史模型锚点为中心、UTM 32650 半径 60 m 内的 22 个原生 JRC 格。三个月均为 22/22 有效观测。',
  }),
  [SE_CLUSTER7_WINDOW]: Object.freeze({
    id: SE_CLUSTER7_WINDOW,
    title: '独立核查窗：东南入口簇 7（半径 37 m）',
    shortLabel: '入口簇 7 · 37 m（独立核查窗）',
    anchorLabel: '入口簇 7 历史中心（距 E20 约 57.01 m）',
    totalCells: 8,
    radiusM: 37,
    domainLabel: '固定 KMZ 统计窗（8 格独立样本）',
    quickMonths: Object.freeze(['2024-06', '2024-07', '2024-08', '2014-08']),
    note: '以历史入口簇 7 中心为圆心、半径 37 m 的 8 格独立窗；与剖面 B 60 m 仅重叠 2 格 [64,126]、[64,127]，用于独立核查与 2014-08 局部缺测验收，不替代主试例。',
  }),
});

export const SE_SENTINEL2_SCENES = Object.freeze([
  Object.freeze({
    date: '2024-07-02',
    validCells: '27/27',
    scl6: 0,
    coreWater: 6,
    sameMain: 0,
    relation: '本期未与主盆分类水斑连片（中心水样 6 格）',
  }),
  Object.freeze({
    date: '2024-07-30',
    validCells: '27/27',
    scl6: 0,
    coreWater: 3,
    sameMain: 3,
    relation: '与主盆同一分类水斑（中心水样 3/3 格）',
  }),
  Object.freeze({
    date: '2024-08-16',
    validCells: '27/27',
    scl6: 1,
    coreWater: 7,
    sameMain: 0,
    relation: '本期未与主盆分类水斑连片（中心水样 7 格）',
  }),
]);

export function validateSoutheastFixture(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('东南月份验收夹为空');
  const grid = raw.native_grid;
  if (!Array.isArray(grid?.shape) || grid.shape[0] !== 87 || grid.shape[1] !== 182 ||
      !Array.isArray(grid?.geotransform) || grid.geotransform.length !== 6 ||
      !grid.geotransform.every(Number.isFinite)) {
    throw new Error('东南验收夹原生格网定义无效');
  }
  const scopes = raw.scope_definitions;
  if (!scopes?.[SE_PRIMARY_WINDOW]?.anchor || !scopes?.[SE_CLUSTER7_WINDOW]?.anchor) {
    throw new Error('东南验收夹缺少双窗口锚点定义');
  }
  const months = raw.months;
  if (!Array.isArray(months) || months.map(m => m.date).join(',') !== '2024-06,2024-07,2024-08') {
    throw new Error('东南验收夹缺少 2024-06/07/08 基础月记录');
  }
  const mix = raw.mixed_coverage_regression;
  if (mix?.date !== '2014-08' || mix.primary_window_for_this_regression !== SE_CLUSTER7_WINDOW ||
      mix.footprint_cells !== 8 || mix.observed_cells !== 7 || mix.water_class_cells !== 0 ||
      mix.nodata_count !== 1 || !Array.isArray(mix.nodata_cells) ||
      mix.nodata_cells.length !== 1 || mix.nodata_cells[0][0] !== 62 || mix.nodata_cells[0][1] !== 127) {
    throw new Error('东南验收夹 2014-08 局部缺测回归记录无效');
  }
  const b60Cross = mix.distinct_2014_primary_60m_crosscheck;
  if (!b60Cross || b60Cross.window !== SE_PRIMARY_WINDOW || b60Cross.target !== 22 ||
      b60Cross.valid !== 22 || b60Cross.water !== 0 || (b60Cross.nodata_cells?.length || 0) !== 0) {
    throw new Error('东南验收夹 2014-08 60m 独立核算校验失败');
  }

  const byDate = new Map(months.map(m => [m.date, m]));
  const cluster7All72 = new Map((mix.all_72_qualified?.months || []).map(m => [m.date, m]));

  return {
    raw,
    nativeGrid: grid,
    scopes,
    compare: raw.compare,
    acceptance: raw.acceptance,
    monthsByDate: byDate,
    mixedRegression: mix,
    cluster7All72,
  };
}

export function cellToPolygon(nativeGrid, row, col) {
  const [originLon, dx, _rotX, originLat, _rotY, dy] = nativeGrid.geotransform;
  const lonW = originLon + col * dx;
  const lonE = lonW + dx;
  const latN = originLat + row * dy;
  const latS = latN + dy;
  return {
    type: 'Polygon',
    coordinates: [[
      [lonW, latN],
      [lonE, latN],
      [lonE, latS],
      [lonW, latS],
      [lonW, latN],
    ]],
  };
}

const cellKey = (r, c) => `${r},${c}`;

function buildTargetCells(fixture, windowId) {
  const refMonth = fixture.monthsByDate.get('2024-06');
  return refMonth?.windows?.[windowId]?.target_cells || [];
}

function buildWholeLakeSummary(date, waterIndexMainRow, mixedRegression) {
  if (date === '2014-08' && mixedRegression?.whole_lake) {
    const wl = mixedRegression.whole_lake;
    const ha = Number.isFinite(waterIndexMainRow?.area_ha)
      ? waterIndexMainRow.area_ha
      : wl.classified_water_ha;
    const pct = Number.isFinite(waterIndexMainRow?.valid_pct)
      ? waterIndexMainRow.valid_pct
      : wl.valid_pct_fixed_KMZ;
    return {
      qualified: true,
      disputed: Boolean(waterIndexMainRow?.classification_disputed),
      areaHa: ha,
      validPct: pct,
      text: `整湖合格，${ha.toFixed(2)}公顷（固定窗有效覆盖 ${pct.toFixed(1)}%）`,
      shortBadge: `合格 · ${ha.toFixed(2)} 公顷`,
    };
  }
  if (!waterIndexMainRow || waterIndexMainRow.status === 'invalid' || !Number.isFinite(waterIndexMainRow.area_ha)) {
    const pct = Number.isFinite(waterIndexMainRow?.valid_pct) ? `${waterIndexMainRow.valid_pct.toFixed(1)}%` : '—';
    return {
      qualified: false,
      disputed: false,
      areaHa: null,
      validPct: waterIndexMainRow?.valid_pct ?? null,
      text: `整湖覆盖不足（有效覆盖 ${pct}，留空不补零）`,
      shortBadge: '整湖覆盖不足（留空）',
    };
  }
  const disputed = waterIndexMainRow.classification_disputed === true;
  const pct = Number.isFinite(waterIndexMainRow.valid_pct) ? `${waterIndexMainRow.valid_pct.toFixed(1)}%` : '—';
  if (waterIndexMainRow.status === 'zero') {
    return {
      qualified: true,
      disputed,
      areaHa: 0,
      validPct: waterIndexMainRow.valid_pct,
      text: disputed
        ? `整湖争议零值（0.00公顷，有效覆盖 ${pct}）`
        : `整湖合格零检出（0.00公顷，有效覆盖 ${pct}）`,
      shortBadge: disputed ? '争议零值' : '合格 · 0.00 公顷',
    };
  }
  return {
    qualified: true,
    disputed,
    areaHa: waterIndexMainRow.area_ha,
    validPct: waterIndexMainRow.valid_pct,
    text: disputed
      ? `整湖争议正值，${waterIndexMainRow.area_ha.toFixed(2)}公顷（有效覆盖 ${pct}）`
      : `整湖合格，${waterIndexMainRow.area_ha.toFixed(2)}公顷（有效覆盖 ${pct}）`,
    shortBadge: `${disputed ? '争议' : '合格'} · ${waterIndexMainRow.area_ha.toFixed(2)} 公顷`,
  };
}

/**
 * Evaluate exact atomic state for the active Southeast observation window on `date`.
 * Strictly enforces:
 * - Loading or fetch failure clears previous-month cells (NEVER relabels stale water).
 * - Failure or missing coverage NEVER renders as observed zero.
 * - 60m and 37m windows are computed independently (never sharing cells or nodata).
 */
export function evaluateSoutheastMonth(fixture, windowId, date, waterMonthEntry = null, waterIndexMainRow = null) {
  const winMeta = SE_WINDOWS[windowId] || SE_WINDOWS[SE_PRIMARY_WINDOW];
  const scope = fixture?.scopes?.[winMeta.id];
  const anchor = scope?.anchor || [119.70013221965465, 49.12632089274489];
  const otherId = winMeta.id === SE_PRIMARY_WINDOW ? SE_CLUSTER7_WINDOW : SE_PRIMARY_WINDOW;
  const otherAnchor = fixture?.scopes?.[otherId]?.anchor || null;
  const targetCells = fixture ? buildTargetCells(fixture, winMeta.id) : [];
  const totalCells = targetCells.length || winMeta.totalCells;
  const wholeLake = buildWholeLakeSummary(date, waterIndexMainRow, fixture?.mixedRegression);

  const base = {
    windowId: winMeta.id,
    windowTitle: winMeta.title,
    windowShortLabel: winMeta.shortLabel,
    anchor,
    anchorLabel: winMeta.anchorLabel,
    otherAnchor,
    radiusM: winMeta.radiusM,
    domainLabel: winMeta.domainLabel,
    date,
    productLabel: 'JRC 月度产品（非单景日期）',
    totalCells,
    wholeLake,
    overlapNote: '剖面 B 60 m 与入口簇 7 37 m 中心相距 57.01 m，仅重叠 2 格 [64,126]、[64,127]，两窗独立核算。',
  };

  // 1. Atomic loading guard: never show stale previous-month cells under the new date
  if (waterMonthEntry?.loading) {
    return {
      ...base,
      kind: 'loading',
      validCount: null,
      waterCount: null,
      nodataCount: null,
      sameMainCount: null,
      wetCells: [],
      nodataCells: [],
      cells: targetCells.map(([row, col]) => ({
        row, col, state: 'pending', polygon: cellToPolygon(fixture.nativeGrid, row, col),
      })),
      headline: '正在加载当月水面图层（已清除上一月水斑）…',
      patchRelation: '等待当月完整返回，不沿用上一月图形或归属',
      relationTone: 'nodata',
      diagnostics: null,
      staleCleared: true,
    };
  }

  // 2. Atomic error guard: fetch failure NEVER renders as observed zero
  if (waterMonthEntry?.error) {
    return {
      ...base,
      kind: 'error',
      validCount: null,
      waterCount: null,
      nodataCount: null,
      sameMainCount: null,
      wetCells: [],
      nodataCells: [],
      cells: targetCells.map(([row, col]) => ({
        row, col, state: 'error', polygon: cellToPolygon(fixture.nativeGrid, row, col),
      })),
      headline: '水面图层加载失败，请重试',
      patchRelation: `当月数据加载失败（${waterMonthEntry.error}），不渲染为观测为零或旧月水面`,
      relationTone: 'disputed',
      diagnostics: null,
      staleCleared: true,
    };
  }

  // 3. Primary 3-month fixture records (2024-06, 2024-07, 2024-08) for either window
  const primaryMonth = fixture?.monthsByDate?.get(date);
  if (primaryMonth?.windows?.[winMeta.id]) {
    const w = primaryMonth.windows[winMeta.id];
    const validCount = w.valid_count;
    const waterCount = w.classified_water_count;
    const nodataCount = Math.max(0, totalCells - validCount);
    const wetCells = w.classified_water_cells || [];
    const nodataCells = [];
    const compOuter4 = w.components?.historical_outer_support_4;
    const compKmz4 = w.components?.fixed_KMZ_4;
    const sameMainCount = compOuter4?.in_main_cells ?? 0;
    const wetSet = new Set(wetCells.map(([r, c]) => cellKey(r, c)));
    const isSameMain = waterCount > 0 && sameMainCount === waterCount;

    const cells = targetCells.map(([row, col]) => {
      const k = cellKey(row, col);
      let state = 'valid_nonwater';
      if (wetSet.has(k)) state = isSameMain ? 'water_main' : 'water_separate';
      return { row, col, state, polygon: cellToPolygon(fixture.nativeGrid, row, col) };
    });

    const diag = primaryMonth.water_component_diagnostics;
    let headline, patchRelation, relationTone, diagnostics;
    if (waterCount === 0) {
      headline = `0格检出明水（${validCount}/${totalCells}格有效）`;
      patchRelation = '本窗口未检出明水（全格有效）';
      relationTone = 'zero';
      diagnostics = `外窗主分量 ${diag?.historical_outer_support_4?.main_component_cells ?? '—'} 格 · 固定 KMZ 主分量 ${diag?.fixed_KMZ_4?.main_component_cells ?? '—'} 格`;
    } else if (isSameMain) {
      headline = `${waterCount}格检出明水（${validCount}/${totalCells}格有效）`;
      patchRelation = `与主盆同一分类水斑（${sameMainCount}/${waterCount}格同属主盆分类像元组，4/8邻接一致）`;
      relationTone = 'observed';
      diagnostics = `外窗主分量 ${compOuter4?.component_sizes_of_hits?.[0]?.full_component_count ?? 2603} 格 · 固定 KMZ 主分量 ${compKmz4?.component_sizes_of_hits?.[0]?.full_component_count ?? 2597} 格`;
    } else {
      headline = `${waterCount}格检出明水（${validCount}/${totalCells}格有效）`;
      patchRelation = `本期未与主盆分类水斑连片（本地同样 ${waterCount} 格见水，与主盆水斑分开，4/8邻接一致）`;
      relationTone = 'candidate';
      const outerSe = compOuter4?.component_sizes_of_hits?.[0]?.full_component_count ?? 207;
      const kmzSe = compKmz4?.component_sizes_of_hits?.[0]?.full_component_count ?? 206;
      diagnostics = `外窗东南独立分量 ${outerSe} 格 · 固定 KMZ 东南独立分量 ${kmzSe} 格 · 最近格心距约 ${fixture.compare.aug_min_component_cell_center_distance_utm_m.toFixed(2)} m`;
    }

    return {
      ...base,
      kind: waterCount > 0 ? (isSameMain ? 'water_main' : 'water_separate') : 'valid_zero',
      validCount,
      waterCount,
      nodataCount,
      sameMainCount,
      wetCells,
      nodataCells,
      cells,
      headline,
      patchRelation,
      relationTone,
      diagnostics,
      assetsSha: primaryMonth.assets,
    };
  }

  // 4. 2014-08 independent primary 60m crosscheck (strictly 22/22 valid, 0 water, 0 nodata)
  if (winMeta.id === SE_PRIMARY_WINDOW && date === '2014-08') {
    const c60 = fixture.mixedRegression.distinct_2014_primary_60m_crosscheck;
    return {
      ...base,
      kind: 'valid_zero',
      validCount: c60.valid,
      waterCount: c60.water,
      nodataCount: 0,
      sameMainCount: 0,
      wetCells: [],
      nodataCells: [],
      cells: targetCells.map(([row, col]) => ({
        row, col, state: 'valid_nonwater', polygon: cellToPolygon(fixture.nativeGrid, row, col),
      })),
      headline: '0格检出明水（22/22格有效）',
      patchRelation: '本窗口未检出明水（剖面 B 60 m 独立核算为 22/22 全有效，不套用 37 m 窗局部缺测）',
      relationTone: 'zero',
      diagnostics: '与独立 37 m 入口簇 7 的局部缺测分开核算',
    };
  }

  // 5. Cluster7 37m qualified months archive (including 2014-08 mixed partial coverage!)
  if (winMeta.id === SE_CLUSTER7_WINDOW) {
    const rec = fixture?.cluster7All72?.get(date);
    if (rec) {
      const validCount = rec.valid;
      const waterCount = rec.water;
      const nodataCells = rec.nodata_cells || [];
      const nodataCount = nodataCells.length;
      const wetCells = rec.wet_cells || [];
      const sameMainCount = rec.same_main_4 ?? 0;
      const wetSet = new Set(wetCells.map(([r, c]) => cellKey(r, c)));
      const ndSet = new Set(nodataCells.map(([r, c]) => cellKey(r, c)));
      const isSameMain = waterCount > 0 && sameMainCount === waterCount;

      const cells = targetCells.map(([row, col]) => {
        const k = cellKey(row, col);
        let state = 'valid_nonwater';
        if (ndSet.has(k)) state = 'nodata';
        else if (wetSet.has(k)) state = isSameMain ? 'water_main' : 'water_separate';
        return { row, col, state, polygon: cellToPolygon(fixture.nativeGrid, row, col) };
      });

      if (nodataCount > 0 && waterCount === 0) {
        const ndList = nodataCells.map(([r, c]) => `[${r},${c}]`).join('、');
        return {
          ...base,
          kind: 'partial_nodata_zero',
          validCount,
          waterCount,
          nodataCount,
          sameMainCount: 0,
          wetCells,
          nodataCells,
          cells,
          headline: `0格检出明水（${validCount}格有观测，${nodataCount}格缺测）`,
          patchRelation: `局部 ${nodataCount} 格缺测（${ndList}）单独以缺测样式保留，与其余 ${validCount} 格观测非水分开；无水样检出，整湖仍合格`,
          relationTone: 'nodata',
          diagnostics: `局部有效率 ${((validCount / totalCells) * 100).toFixed(1)}%（${validCount}/${totalCells}）；整湖 2131 格分类明水，固定 KMZ 有效率 97.2%`,
        };
      }

      if (waterCount === 0) {
        return {
          ...base,
          kind: 'valid_zero',
          validCount,
          waterCount: 0,
          nodataCount: 0,
          sameMainCount: 0,
          wetCells: [],
          nodataCells: [],
          cells,
          headline: `0格检出明水（${validCount}/${totalCells}格有效）`,
          patchRelation: '本窗口未检出明水（全格有效）',
          relationTone: 'zero',
          diagnostics: rec.disputed ? '该月全湖记录含历史分类争议标记' : '合格月局部无明水检出',
        };
      }
    }
  }

  // 6. Other months outside the frozen Southeast acceptance fixture
  if (!wholeLake.qualified) {
    return {
      ...base,
      kind: 'unqualified_month',
      validCount: null,
      waterCount: null,
      nodataCount: null,
      sameMainCount: null,
      wetCells: [],
      nodataCells: [],
      cells: targetCells.map(([row, col]) => ({
        row, col, state: 'nodata', polygon: cellToPolygon(fixture.nativeGrid, row, col),
      })),
      headline: '当月整湖未达 95% 有效覆盖门槛（留空不补零）',
      patchRelation: '非合格观测月，不渲染为观测为零或沿用他月水面',
      relationTone: 'nodata',
      diagnostics: null,
    };
  }

  return {
    ...base,
    kind: 'outside_fixture',
    validCount: null,
    waterCount: null,
    nodataCount: null,
    sameMainCount: null,
    wetCells: [],
    nodataCells: [],
    cells: targetCells.map(([row, col]) => ({
      row, col, state: 'footprint', polygon: cellToPolygon(fixture.nativeGrid, row, col),
    })),
    headline: '当前月份未纳入东南逐格验收样例',
    patchRelation: `请点选 ${winMeta.quickMonths.join(' / ')} 查看已复核的原生格水斑关系`,
    relationTone: 'context',
    diagnostics: null,
  };
}
