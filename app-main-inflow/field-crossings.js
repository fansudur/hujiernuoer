/* ==========================================================================
   app-main-inflow/field-crossings.js
   Pure, zero-DOM model & validator for "现场桥涵" (2026-11-23 fieldwork &
   dual-DEM downstream branch diagnostic review):
   - Two strictly separate structures (NEVER merged into a single channel):
     1. G332 三八水库中桥（F1, E08–E09）— rain/snowmelt priority #1
     2. 地方道路圆涵（近 Wcross2, E10–E11）— independent check, never chained to F1
   - Bridge-after-branch imagery selector bound strictly by scene_id + bounds_wgs84
     + 6-point coverage verification (rejects same-day narrow Sentinel-2 crop
     S2B_T50UPV_20210721T030913_L2A that omits bridge, old bend & fade ends).
   - Wraps exact diagnostic-branches.geojson (41 lines, EPSG:4326) with explicit
     "地形模型，非实测支路" role separation across NE/SE/context/culvert layers.
   ========================================================================== */

export const BRIDGE_BRANCH_LAYERS = Object.freeze({
  'bridge-f1-ne-branch': {
    id: 'bridge-f1-ne-branch',
    name: '三八水库中桥 · 东北候选方向（模型 · 往东池）',
    stroke: '#14b8a6',
    color3d: 0x14b8a6,
    dash: [7, 4],
    symbol: '┄',
    roleLabel: '地形模型，非实测支路（东北暗纹端 → 东池）',
  },
  'bridge-f1-se-branch': {
    id: 'bridge-f1-se-branch',
    name: '三八水库中桥 · 东南候选方向（模型 · 往主湖）',
    stroke: '#f59e0b',
    color3d: 0xf59e0b,
    dash: [7, 4],
    symbol: '┄',
    roleLabel: '地形模型，非实测支路（东南暗纹端 → 历史主湖）',
  },
  'bridge-f1-diag-raw': {
    id: 'bridge-f1-diag-raw',
    name: '三八水库中桥 · 桥东四个起算窗（原地表与填洼）',
    stroke: '#94a3b8',
    color3d: 0x94a3b8,
    dash: [3, 4],
    symbol: '┄',
    roleLabel: '填洼模型情景 · 不是过水证据',
  },
  'bridge-f1-anchors': {
    id: 'bridge-f1-anchors',
    name: '三八水库中桥 · 东南暗纹端搜索窗',
    stroke: '#fbbf24',
    color3d: 0xfbbf24,
    dash: null,
    symbol: '◇',
    roleLabel: '待核搜索窗（非实测水路）',
  },
  'culvert-diag-branches': {
    id: 'culvert-diag-branches',
    name: '地方道路圆涵 · 东侧双模型对照（独立核查）',
    stroke: '#a78bfa',
    color3d: 0xa78bfa,
    dash: [5, 4],
    symbol: '┄',
    roleLabel: '地形模型，非实测支路（独立于三八水库中桥）',
  },
});

export const BRIDGE_BRANCH_LAYER_IDS = Object.freeze(Object.keys(BRIDGE_BRANCH_LAYERS));
export const isBridgeBranchLayer = layer => Object.hasOwn(BRIDGE_BRANCH_LAYERS, layer);

// Six independent reference nodes that must fit simultaneously in the
// 三八水库中桥 (F1) branch comparison card (界面设计交接说明 · 桥后支路卡片验收).
export const F1_SIX_POINTS = Object.freeze([
  { id: 'f1_bridge', label: '三八水库中桥（F1）', featureId: 'west-slope-f1-bridge', lonlat: [119.6495, 49.14652] },
  { id: 'old_bend', label: '桥东老转折窗口', featureId: 'west-slope-old-bend', lonlat: [119.659134, 49.147921] },
  { id: 'ne_fade', label: '东北暗纹消散端', featureId: 'west-slope-old-ne-fade', lonlat: [119.667541, 49.151235] },
  { id: 'se_fade', label: '东南暗纹消散端', featureId: 'bridge-f1-se-fade', lonlat: [119.666840, 49.145854] },
  { id: 'east_pool', label: '东池参照', featureId: 'archive-east_pool_2025-09-22_scl6', lonlat: [119.696581, 49.153988] },
  { id: 'main_lake', label: '呼吉尔诺尔 · 主湖参照', lakeId: 'MAIN', lonlat: [119.691569, 49.132795] },
]);

export const F1_SIX_POINT_BOUNDS = Object.freeze([119.645, 49.126, 119.705, 49.158]);
export const CULVERT_COMPARE_BOUNDS = Object.freeze([119.658, 49.131, 119.683, 49.140]);

export function checkSixPointCoverage(boundsWgs84) {
  if (!Array.isArray(boundsWgs84) || boundsWgs84.length !== 4 || !boundsWgs84.every(Number.isFinite)) {
    return { coversAll: false, missing: F1_SIX_POINTS.map(p => p.id), byPoint: {} };
  }
  const [w, s, e, n] = boundsWgs84;
  const byPoint = {};
  const missing = [];
  for (const pt of F1_SIX_POINTS) {
    const ok = pt.lonlat[0] >= w && pt.lonlat[0] <= e && pt.lonlat[1] >= s && pt.lonlat[1] <= n;
    byPoint[pt.id] = ok;
    if (!ok) missing.push(pt.id);
  }
  return { coversAll: missing.length === 0, missing, byPoint };
}

// Historical wide-crop Landsat scenes from data/process/imagery_manifest.json (38 scenes)
// + recent 10 m Sentinel-2 wide scenes from frozen terrain/manifest.json.
// Bound strictly by scene_id AND exact bounds_wgs84 (never date-only!).
export const BRIDGE_CARD_IMAGERY = Object.freeze([
  {
    id: 'LT05_L2SP_123026_19920705_02_T1',
    scene_id: 'LT05_L2SP_123026_19920705_02_T1',
    basemapId: 'LT05_L2SP_123026_19920705_02_T1',
    date: '1992-07-05',
    shortLabel: '1992-07-05',
    sensor: 'Landsat 5 TM · 30m',
    sourceManifest: 'data/process/imagery_manifest.json',
    url: './bridge-imagery/1992-07-05_landsat_truecolor_geographic.png',
    bounds_wgs84: [119.60319444444445, 49.078472222222224, 119.77958333333335, 49.185972222222226],
    sha256: 'a56e8db542ea312ded0cc828d911d0a8ee7cfbbb96dffaa1f15cf18722723af1',
    validFraction: 0.9999,
    eligibleForBranchCard: true,
    note: '原裁片覆盖六点（桥位、老转折、东北/东南纹理端、东池与主湖）；30 m 真彩不是水体分类，1992-07 无合格 JRC 月度掩膜。',
  },
  {
    id: 'LT05_L2SP_123026_20070731_02_T1',
    scene_id: 'LT05_L2SP_123026_20070731_02_T1',
    basemapId: 'LT05_L2SP_123026_20070731_02_T1',
    date: '2007-07-31',
    shortLabel: '2007-07-31',
    sensor: 'Landsat 5 TM · 30m',
    sourceManifest: 'data/process/imagery_manifest.json',
    url: './bridge-imagery/2007-07-31_landsat_truecolor_geographic.png',
    bounds_wgs84: [119.60319444444445, 49.078472222222224, 119.77958333333335, 49.185972222222226],
    sha256: 'd87d43c00924e4b09312854078da73f5c18b1439f19f919182b9216d9ccc85fd',
    validFraction: 0.9893,
    eligibleForBranchCard: true,
    note: '原裁片覆盖六点；真彩透明处为质量剔除，不代表无水。',
  },
  {
    id: 'LC08_L2SP_123026_20210721_02_T1',
    scene_id: 'LC08_L2SP_123026_20210721_02_T1',
    basemapId: 'LC08_L2SP_123026_20210721_02_T1',
    date: '2021-07-21',
    shortLabel: '2021-07-21 (L8)',
    sensor: 'Landsat 8 OLI · 30m',
    sourceManifest: 'data/process/imagery_manifest.json',
    url: './bridge-imagery/2021-07-21_landsat_truecolor_geographic.png',
    bounds_wgs84: [119.60319444444445, 49.078472222222224, 119.77958333333335, 49.185972222222226],
    sha256: '523468f317d75a7858fc52b51074c1106137c2166e00ce9b3eb63fbd4ead89db',
    validFraction: 0.9999,
    eligibleForBranchCard: true,
    note: '与同天 Sentinel-2 窄裁片区分：仅此 Landsat 8 原裁片完整覆盖六点，按景 ID 与范围绑定。',
  },
  {
    id: 'S2B_50UPV_20250528_0_L2A',
    scene_id: 'S2B_50UPV_20250528_0_L2A',
    basemapId: 'sentinel2-2025-05-28',
    date: '2025-05-28',
    shortLabel: '2025-05-28 (S2)',
    sensor: 'Sentinel-2 · 10m 大片',
    sourceManifest: 'hujiernuoer-handoff-v2/terrain/manifest.json',
    url: null, // Uses frozen terrain/satellite-2025-05-28.png
    bounds_wgs84: [119.61, 49.101, 119.77, 49.175],
    eligibleForBranchCard: true,
    sclShadowWarning: true,
    note: '核心水路 10 m 真彩大片（覆盖六点）。显示掩膜保留 20 m SCL 投影阴影（类别 2），暗带或高保留率均不能直接判定有水。',
  },
  {
    id: 'S2A_50UPV_20260808_0_L2A',
    scene_id: 'S2A_50UPV_20260808_0_L2A',
    basemapId: 'sentinel2-2026-08-08',
    date: '2026-08-08',
    shortLabel: '2026-08-08 (S2)',
    sensor: 'Sentinel-2 · 10m 大片',
    sourceManifest: 'hujiernuoer-handoff-v2/terrain/manifest.json',
    url: null, // Uses frozen terrain/satellite-2026-08-08.png
    bounds_wgs84: [119.61, 49.101, 119.77, 49.175],
    eligibleForBranchCard: true,
    sclShadowWarning: true,
    note: '核心水路 10 m 真彩大片（覆盖六点）。显示掩膜保留 20 m SCL 投影阴影（类别 2），看见暗带需对照局部质量分类与原始影像。',
  },
]);

// Explicitly recorded excluded same-day narrow Sentinel-2 scene so acceptance checks
// can verify by scene_id + crop bounds why 2021-07-21 cannot be selected by date alone.
export const BRIDGE_CARD_EXCLUDED_SCENES = Object.freeze([
  {
    scene_id: 'S2B_T50UPV_20210721T030913_L2A',
    date: '2021-07-21',
    sensor: 'Sentinel-2 L2A 窄裁片',
    sourceManifest: 'data/process/imagery_manifest.json',
    bounds_wgs84: [119.667195, 49.120519, 119.714920, 49.143170],
    eligibleForBranchCard: false,
    reason: '同天 Sentinel-2 窄裁片仅覆盖主湖，不含三八水库中桥、老转折窗口与东北/东南纹理末端，已禁用于桥后支路卡片。',
  },
]);

export const STRUCTURE_CROSSING_SPECS = Object.freeze({
  f1_bridge: {
    id: 'f1_bridge',
    name: 'G332 三八水库中桥',
    codeTag: 'F1 · E08–E09',
    priorityBadge: '雨后 / 融雪首查',
    bridgeFeatureId: 'west-slope-f1-bridge',
    oldBendFeatureId: 'west-slope-old-bend',
    neFadeFeatureId: 'west-slope-old-ne-fade',
    seFadeFeatureId: 'bridge-f1-se-fade',
    northModelFeatureId: 'west-slope-model-cross',
    comparisonImg: './bridge-imagery/F1-comparison.jpg',
    comparisonCaption: 'F1 四期真彩对照（B=桥位、T=老转折、NE/SE=暗纹消散端搜索窗；绿/暗/白不直接判定过水）',
    roadsideProfiles: ['roadside-check-f1-west', 'roadside-check-f1-east'],
    photos: [
      { id: 'field-photo-2026', label: '桥牌 2026', role: '桥牌实读（K1347+671 · 45.04 m · 2011-12-01）' },
      { id: 'field-photo-2025', label: '桥侧 2025', role: '桥侧环境参照（与桥牌配对）' },
      { id: 'field-photo-2027', label: '通道 2027', role: '桥侧过水通道组' },
      { id: 'field-photo-2028', label: '护砌 2028', role: '通道边缘与硬质护砌' },
      { id: 'field-photo-2029', label: '对景 2029', role: '桥侧通道另一视角' },
    ],
    dualDemStats: {
      stations: '21 / 21 站西侧较高',
      copCenterM: '+1.95 m',
      awCenterM: '+2.13 m',
      caveat: '道路外侧 45–90 m 宽尺度地表对照，使「西来东出」成为首查方向；不是桥底或沟底实测落差。',
    },
    geometryFacts: [
      ['桥牌与双幅距', '桥长 45.04 m（2011-12-01）；双幅 OSM 中心线相距约 16.5 m（地图定位距，非桥孔净宽）'],
      ['桥东 → 老转折', '约 717 m 平面直距；多期影像可见弯曲低地，但双模型从桥东肩均未进老转折 30 m 窗，不画实线'],
      ['北侧模型点区分', '桥北约 450 m 的填洼模型跨路点不是 F1 桥，不能由南桥反证北侧有孔'],
      ['圆涵严格分离', '距南侧地方道路圆涵相机约 1.57 km，属两处独立设施，不串成一条水路'],
    ],
    rainChecklist: [
      '先查三八水库中桥东口 → 约 717 m 老转折是否在同一场雨后 / 融雪下连续通水（并核双幅之间是否同槽）。',
      '再在老转折东侧分开核对「东北往东池」与「东南往主湖」两条候选走向，判断是否为同一次来水的分流。',
      '仅在安全公共位置记录同场水痕与方向，不下陡坡、不进桥下涵洞、不在车道停留。',
    ],
  },
  round_culvert: {
    id: 'round_culvert',
    name: '地方道路圆涵',
    codeTag: '独立核查 · E10–E11',
    priorityBadge: '单独查 · 不与桥串联',
    bridgeFeatureId: 'wc2-review-stop',
    comparisonImg: './bridge-imagery/ROUND-comparison.jpg',
    comparisonCaption: '圆涵四期真彩对照（L=LOW-A 约 422 m 原地表模型停点；浅蓝为原有模型线，不是实测沟道）',
    roadsideProfiles: ['roadside-check-wcross2-west', 'roadside-check-wcross2-east'],
    photos: [
      { id: 'field-photo-2020', label: '圆涵 2020', role: '圆形管身及对端透光（相机点非洞口；252° 为相机朝向）' },
      { id: 'field-photo-2019', label: '对景 2019', role: '圆涵附近反向对景（57° 参照道路位置）' },
    ],
    dualDemStats: {
      stations: '21 / 21 站西侧较高',
      copCenterM: '+1.24 m',
      awCenterM: '+2.08 m',
      caveat: '道路外侧 45–90 m 宽尺度西高东低；30 m 地表格不能量管底坡度或实测流向。',
    },
    geometryFacts: [
      ['与三八水库中桥独立', '距三八水库中桥约 1.57 km；F1 东南模型线交次级路处距圆涵相机约 827–933 m，非同一路线'],
      ['缺口 ① 东口 → 首格', '归档模型线未跨道路，首格距道路中心线约 31.7 m、距 2020 相机约 29.5 m，需先查东口接沟'],
      ['缺口 ② LOW-A 停点', 'Copernicus 原地表约 422 m 止于浅洼 LOW-A；四期 20 m 影像前 1 km 未检出水类，中段不补实线'],
      ['分支判断', '填洼虽趋历史主湖，但经过 / 绕行 LOW-A 随模型变化；当前无稳定可定位分叉，也不连到嘎查办公院'],
    ],
    rainChecklist: [
      '单独核查圆涵两端实际洞口与相邻边沟，确认东口是否接上旧模型首格附近的低带。',
      '独立查看约 422 m 处浅洼 LOW-A 前后是否有连续水迹、侧溢或旁路；两处缺口接上前不延画入湖实线。',
      '不与三八水库中桥合并为同一水线，也不与嘎查办公院排水线自动拼接。',
    ],
  },
});

const DEST_LABEL_ZH = Object.freeze({
  east_pool_2025_09_22: '东池参照（2025-09-22）',
  'east_pool_2025-09-22': '东池参照（2025-09-22）',
  historical_main: '呼吉尔诺尔 · 历史主湖掩膜',
  local_stop: '原地表局部停下（未达受纳水面）',
});

const MODEL_LABEL_ZH = Object.freeze({
  Cop_frozen30_raw: 'Copernicus 30m 原地表',
  Cop_frozen30_filled: 'Copernicus 30m 填洼',
  AW3D30_sameUTM_raw: 'AW3D30 30m 原地表',
  AW3D30_sameUTM_filled: 'AW3D30 30m 填洼',
});

const SEED_LABEL_ZH = Object.freeze({
  F1_east_shoulder: '三八水库中桥东肩',
  F1_east_turn: '桥东老转折窗口',
  F1_NE_fade: '东北暗纹消散端',
  F1_SE_fade: '东南暗纹消散端',
  Wcross2_road_east: '地方道路圆涵东肩',
  Wcross2_start: '圆涵下游旧模型首格',
  Wcross2_LOW_A: '圆涵下游 LOW-A 浅洼',
  Wcross2_A_before: 'LOW-A 上游邻格',
  Wcross2_A_after: 'LOW-A 下游邻格',
});

function classifyDiagnosticLayer(props) {
  const seed = props.seed_group;
  const state = props.state;
  const dest = props.dest;
  if (seed.startsWith('Wcross2')) return 'culvert-diag-branches';
  if (seed === 'F1_NE_fade' && state.endsWith('_filled') && dest === 'east_pool_2025-09-22') {
    return 'bridge-f1-ne-branch';
  }
  if (seed === 'F1_SE_fade' && state.endsWith('_filled') && dest === 'historical_main') {
    return 'bridge-f1-se-branch';
  }
  return 'bridge-f1-diag-raw';
}

/**
 * Validate diagnostic-branches.geojson (41 representative lines from
 * Downstream-Branches-20261123) and wrap them with place-first Chinese labels
 * plus the explicit F1_SE_fade anchor point (so all 6 points are clickable).
 */
export function validateDiagnosticBranches(payload, knownIds = new Set()) {
  if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features) || payload.features.length !== 41) {
    throw new Error('Invalid diagnostic-branches.geojson (expected 41 features)');
  }
  const seen = new Set();
  const out = [];

  for (const raw of payload.features) {
    const p = raw?.properties;
    const g = raw?.geometry;
    if (raw?.type !== 'Feature' || typeof raw.id !== 'string' || !raw.id || seen.has(raw.id)) {
      throw new Error(`Invalid diagnostic branch id: ${raw?.id}`);
    }
    if (p?.status !== 'terrain_model_only_not_observed_branch') {
      throw new Error(`Diagnostic branch missing mandatory model-only status: ${raw.id}`);
    }
    if (g?.type !== 'LineString' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) {
      throw new Error(`Invalid diagnostic branch geometry: ${raw.id}`);
    }
    seen.add(raw.id);

    const wrappedId = `diag-branch-${raw.id}`;
    if (knownIds.has(wrappedId)) throw new Error(`Duplicate feature id: ${wrappedId}`);
    const layer = classifyDiagnosticLayer(p);
    const seedZh = SEED_LABEL_ZH[p.seed_group] || p.seed_group;
    const modelZh = MODEL_LABEL_ZH[p.state] || p.state;
    const destZh = DEST_LABEL_ZH[p.dest] || p.dest;
    const isCulvert = layer === 'culvert-diag-branches';
    const minorCross = p.first_cross_by_road?.OSM162036946;
    const crossNote = !isCulvert && minorCross
      ? `；与次级道路几何相交处距圆涵相机约 ${Math.round(minorCross.distance_to_IMG2020_camera_m)} m，不是该圆涵的过水依据。`
      : '';

    out.push({
      type: 'Feature',
      id: wrappedId,
      geometry: g,
      properties: {
        name: `${seedZh} → ${destZh}（${modelZh}）`,
        layer,
        status: 'modeled',
        original_status: p.status,
        feature_role: p.state.endsWith('_raw') ? 'diag-raw' : 'diag-filled',
        seed_group: p.seed_group,
        model_state: p.state,
        dest: p.dest,
        length_m: p.length_m,
        road_geometry_crossings: p.road_geometry_crossings,
        first_cross_by_road: p.first_cross_by_road,
        other_windows_min_distance_m: p.other_windows_min_distance_m,
        description: `地形模型诊断线，非实测支路。起点窗「${seedZh}」，在「${modelZh}」情景下走向「${destZh}」，平面长度约 ${Number(p.length_m).toFixed(0)} m${crossNote}`,
        placement_caveat: isCulvert
          ? '圆涵单独核查，不与三八水库中桥串成一条；原地表均在局部停下，填洼路径不代表实测沟道或已通水。'
          : '仅表地形模型条件推演，非实测水路或分流比例；桥东至老转折约 717 m 段尚未证实连通，不能与两条候选方向合成一条已通水路线。',
        source: 'Downstream-Branches-20261123/diagnostic-branches.geojson',
        related_ids: isCulvert
          ? ['field-photo-2020', 'wc2-review-stop', 'roadside-check-wcross2-west']
          : ['west-slope-f1-bridge', 'west-slope-old-bend', 'west-slope-old-ne-fade', 'bridge-f1-se-fade'],
      },
    });
  }

  // Add the explicit F1_SE_fade reference anchor point from Downstream-Branches-20261123/summary.json
  // so all six nodes (F1, old bend, NE fade, SE fade, East Pool, Main Lake) are clickable on the map.
  const seFadeId = 'bridge-f1-se-fade';
  if (!knownIds.has(seFadeId)) {
    out.push({
      type: 'Feature',
      id: seFadeId,
      geometry: { type: 'Point', coordinates: [119.66684014240464, 49.14585356650558] },
      properties: {
        name: '桥东东南 · 旧暗纹消散端',
        layer: 'bridge-f1-anchors',
        status: 'candidate',
        feature_role: 'review',
        description: '三八水库中桥东侧老转折以东的东南暗纹消散端搜索窗。从此端起算，Copernicus 与 AW3D30 填洼情景均指向历史主湖；原地表均在局部停下。',
        placement_caveat: '搜索窗不是已证实通道；东南条件线与次级道路几何相交处距圆涵相机约 827–933 m，不是圆涵过水依据。',
        source: 'Downstream-Branches-20261123/summary.json · F1_SE_fade',
        related_ids: ['west-slope-f1-bridge', 'west-slope-old-bend', 'west-slope-old-ne-fade'],
      },
    });
  }

  return out;
}

// Place-name-first profile display titles (keeping source GeoJSON & IDs immutable).
export const PROFILE_PLACE_FIRST_NAMES = Object.freeze({
  'main-profile-west-inlet': '主湖西侧模型入口（E18）',
  'main-profile-south-central-inlet': '主湖南中模型入口（E19）',
  'main-profile-southeast-inlet': '主湖东南模型入口（E20）',
  'main-profile-east-west-axis': '主湖东西贯湖（E21）',
  'main-profile-north-south-axis': '主湖南北贯湖（E22）',
  'profile-B_nw_slope_to_office': '西北坡至嘎查办公院（E02）',
  'profile-A_office_to_lake': '嘎查办公院至主湖（E03）',
  'archive-t6': '东部低地西段南北剖面（T6）',
  'archive-t7': '东部低地中段南北剖面（T7）',
  'archive-t8': '东池南侧南北剖面（T8）',
  'archive-p1': '西长湖东侧至东部泥沼（P1 · 近似）',
  'archive-p2': '北小湖南侧至东部泥沼（P2 · 近似）',
  'yimin-nearest-profile': '主湖至伊敏河最近格网剖面',
  'roadside-check-f1-west': '三八水库中桥 · 西侧路外地形',
  'roadside-check-f1-east': '三八水库中桥 · 东侧路外地形',
  'roadside-check-wcross2-west': '地方道路圆涵 · 西侧路外地形',
  'roadside-check-wcross2-east': '地方道路圆涵 · 东侧路外地形',
});

export function formatProfileDisplayName(featureOrId, fallbackName = '') {
  const id = typeof featureOrId === 'string' ? featureOrId : featureOrId?.id;
  if (id && Object.hasOwn(PROFILE_PLACE_FIRST_NAMES, id)) {
    return PROFILE_PLACE_FIRST_NAMES[id];
  }
  const raw = (typeof featureOrId === 'object' ? featureOrId?.properties?.name : '') || fallbackName || id || '';
  return raw.replace('主湖最大连片水面—', '');
}
