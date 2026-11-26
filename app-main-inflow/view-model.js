/* ==========================================================================
   app/view-model.js
   Pure, zero-DOM evidence vocabulary, sub-role styling rules, 5-state water
   classifier, dual time-axis comparison builder, profile inspector helpers,
   URL state codec, and spatial-water-export/v2 GeoJSON export serializer.
   ========================================================================== */

export const EVIDENCE_STATUS_META = {
  observed: {
    code: 'observed',
    label: '遥感观测',
    short: '观测',
    symbol: '●',
    color: '#0284c7',
    lightBg: '#e0f2fe',
    stroke: '#38bdf8',
    fill: 'rgba(14, 165, 233, 0.34)',
    dash: null,
  },
  disputed: {
    code: 'disputed',
    label: '历史分类争议',
    short: '争议',
    symbol: '⚠',
    color: '#dc2626',
    lightBg: '#fee2e2',
    stroke: '#f87171',
    fill: 'rgba(239, 68, 68, 0.24)',
    dash: [5, 3],
  },
  candidate: {
    code: 'candidate',
    label: '待核候选',
    short: '候选',
    symbol: '◇',
    color: '#d97706',
    lightBg: '#fef3c7',
    stroke: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.20)',
    dash: [7, 4],
  },
  modeled: {
    code: 'modeled',
    label: '地形模型',
    short: '模型',
    symbol: '▲',
    color: '#7c3aed',
    lightBg: '#ede9fe',
    stroke: '#a78bfa',
    fill: 'rgba(139, 92, 246, 0.16)',
    dash: [8, 4, 2, 4],
  },
  context: {
    code: 'context',
    label: '外围参考',
    short: '参考',
    symbol: '■',
    color: '#475569',
    lightBg: '#f1f5f9',
    stroke: '#94a3b8',
    fill: 'rgba(148, 163, 184, 0.14)',
    dash: null,
  },
  nodata: {
    code: 'nodata',
    label: '缺测 / 覆盖不足',
    short: '缺测',
    symbol: '▨',
    color: '#64748b',
    lightBg: '#f1f5f9',
    stroke: '#94a3b8',
    fill: 'rgba(100, 116, 139, 0.28)',
    dash: [3, 3],
  },
};

export const HISTORICAL_LAYERS = {
  'historic-water': { name: '历史图 · 水体线索', color: '#0f766e', color3d: 0x0f766e, symbol: '◇' },
  'historic-roads': { name: '历史图 · 路线线索', color: '#b45309', color3d: 0xb45309, symbol: '┄' },
  'historic-landmarks': { name: '历史图 · 地名与定位点', color: '#7c3aed', color3d: 0x7c3aed, symbol: '◆' },
};
export const isHistoricalLayer = layer => Object.hasOwn(HISTORICAL_LAYERS, layer);
export const isHistoricalId = id => typeof id === 'string' && /^historic-[a-z0-9][a-z0-9._-]*$/i.test(id);

export const LAYER_GROUPS = [
  { id: 'main-inflow-office', title: '主湖来水与办公院上下游', layers: ['main-catchments', 'f1-waterway', 'f1-waterway-sensitivity', 'archive-routing', 'office-corridor', 'office-flow-tests', 'marsh-review', 'north-boundary-checks', 'main-lake-profiles', 'west-slope-user-sketch', 'west-slope-review', 'office-nw-audit', 'roadside-terrain-check', 'wc2-optical-review', 'wcross-upstream', 'wcross-far-west', 'owner-blue-201909', 'field-photos-20261122', 'july-2023-review', 'seasonal-network'] },
  { id: 'pending-clues', title: '待核线索', layers: ['slope-road-clues'] },
  { id: 'field-crossings-diag', title: '现场桥涵 · 候选方向对照（地形模型，非实测支路）', layers: ['bridge-f1-anchors', 'bridge-f1-ne-branch', 'bridge-f1-se-branch', 'bridge-f1-diag-raw', 'culvert-diag-branches'] },
  {
    id: 'road-and-g332',
    title: '道路与 G332 待核过路范围',
    layers: ['road-review', 'roads', 'secondary-roads','g332-opening-road','owner-water-network-v75'],
  },
  {
    id: 'snow-and-s7',
    title: '西北坡残雪、S7 严格格与绿度对照',
    layers: ['snow-sites', 'snow-2026', 's7-repeat-green', 's7-green-controls'],
  },
  {
    id: 'pools-and-qa',
    title: '周边水体样本与 2013 Landsat QA',
    layers: ['nearby-pools', 'landsat-2013-quality'],
  },
  {
    id: 'terrain-and-profiles',
    title: '伊敏河剖面、历史剖面与模型参考',
    layers: ['yimin-profile', 'yimin-reference', 'yimin-probes', 'east-profiles', 'regional-reference'],
  },
  { id: 'historical-context', title: '历史地图参考（不随月份变化）', layers: Object.keys(HISTORICAL_LAYERS) },
];

export const DEFAULT_VISIBLE_LAYERS = new Set([
  'road-review',
  'roads',
  'secondary-roads',
  'snow-sites',
  'snow-2026',
  's7-repeat-green',
  'yimin-profile',
  'yimin-reference',
  'nearby-pools',
  'east-profiles',
  'regional-reference',
]);

/**
 * Classify a single monthly water record into one of 5 explicit, mutually
 * exclusive semantic states (never conflating disputed positive, disputed zero,
 * qualified zero, and invalid/missing coverage).
 */
export function describeWaterMonth(lakeId, date, row) {
  if (!row) {
    return {
      lakeId,
      date,
      stateKey: 'invalid',
      status: 'invalid',
      disputed: false,
      areaHa: null,
      areaText: '—',
      badgeText: '缺测 / 无记录',
      symbol: '▨',
      tone: 'nodata',
      summaryText: '无月度记录（留空，不补零）',
      validPctText: '—',
      outerValidPctText: null,
      nodataHaText: null,
      note: null,
    };
  }

  const disputed = row.classification_disputed === true;
  const validPct = Number.isFinite(row.valid_pct) ? `${row.valid_pct.toFixed(1)}%` : '—';
  const outerPct = Number.isFinite(row.outer_valid_pct) ? `${row.outer_valid_pct.toFixed(1)}%` : null;
  const nodataHa = Number.isFinite(row.nodata_ha) ? `${row.nodata_ha.toFixed(2)} ha` : null;

  if (row.status === 'invalid' || row.area_ha === null || !Number.isFinite(row.area_ha)) {
    return {
      lakeId,
      date,
      stateKey: 'invalid',
      status: 'invalid',
      disputed: false,
      areaHa: null,
      areaText: '—（留空）',
      badgeText: '▨ 覆盖不足 / 缺测',
      symbol: '▨',
      tone: 'nodata',
      summaryText: `有效覆盖 ${validPct}${outerPct ? `（外环 ${outerPct}）` : ''} 未达 95% 门槛，留空不补零、不沿用上月`,
      validPctText: validPct,
      outerValidPctText: outerPct,
      nodataHaText: nodataHa,
      note: row.classification_note || null,
    };
  }

  if (row.status === 'zero') {
    if (disputed) {
      return {
        lakeId,
        date,
        stateKey: 'zero_disputed',
        status: 'zero',
        disputed: true,
        areaHa: 0,
        areaText: '0.00 ha',
        badgeText: '⊗ 争议零值（归档为 0 · 有分歧）',
        symbol: '⊗',
        tone: 'disputed',
        summaryText: '归档月分类为 0.00 ha 但存在历史分类争议，不能据此断定完全干涸',
        validPctText: validPct,
        outerValidPctText: outerPct,
        nodataHaText: nodataHa,
        note: row.classification_note || '存在历史分类争议；零值不等于实地干涸。',
      };
    }
    return {
      lakeId,
      date,
      stateKey: 'zero',
      status: 'zero',
      disputed: false,
      areaHa: 0,
      areaText: '0.00 ha',
      badgeText: '○ 合格零值（观测为零）',
      symbol: '○',
      tone: 'zero',
      summaryText: `有效覆盖达标（${validPct}），产品分类未检出水体，不等于证明彻底干涸`,
      validPctText: validPct,
      outerValidPctText: outerPct,
      nodataHaText: nodataHa,
      note: row.classification_note || null,
    };
  }

  // status === 'positive'
  const areaTxt = `${row.area_ha.toFixed(2)} ha`;
  if (disputed) {
    return {
      lakeId,
      date,
      stateKey: 'positive_disputed',
      status: 'positive',
      disputed: true,
      areaHa: row.area_ha,
      areaText: areaTxt,
      badgeText: `⚠ 争议正值（${areaTxt} · 有分类争议）`,
      symbol: '⚠',
      tone: 'disputed',
      summaryText: `归档检出水体 ${areaTxt}，但保留历史分类争议标记（覆盖率 ${validPct} 不能消除争议）`,
      validPctText: validPct,
      outerValidPctText: outerPct,
      nodataHaText: nodataHa,
      note: row.classification_note || '历史分类争议月；保留冻结归档值与争议标记。',
    };
  }
  return {
    lakeId,
    date,
    stateKey: 'positive',
    status: 'positive',
    disputed: false,
    areaHa: row.area_ha,
    areaText: areaTxt,
    badgeText: `● 合格正值（${areaTxt}）`,
    symbol: '●',
    tone: 'observed',
    summaryText: `合格月分类检出水体 ${areaTxt}（有效覆盖 ${validPct}）`,
    validPctText: validPct,
    outerValidPctText: outerPct,
    nodataHaText: nodataHa,
    note: row.classification_note || null,
  };
}

/**
 * Resolve rich, color+pattern+symbol visual styling for any feature in
 * analysis.geojson, strictly distinguishing intra-layer roles:
 *   - nearby-pools: rule='SCL6' (observed) vs rule='candidate' (candidate)
 *   - landsat-2013-quality: feature_role='usable' vs 'excluded'
 *   - s7-repeat-green: two_dsm_two_scale_low=true (5 S7 positives) vs false (2 counterexamples)
 *   - snow-sites / snow-2026: S7 low-spot vs S3 high-band counterexample vs S6/C1 controls
 *   - road-review vs roads vs archive-routing (NEVER draw candidate/model as confirmed waterway!)
 */
import { isWaybackLayer, waybackVisualSpec } from './wayback.js';
import { withSemanticTone, ANALYSIS_PALETTE } from './atlas-visual-policy.js';
import { F1_WATERWAY_LAYER, F1_COMPARE_LAYER, WCROSS_UPSTREAM_LAYER, WCROSS_FAR_LAYER, OWNER_BLUE_LAYER, f1WaterwayVisualSpec } from './f1-waterway.js';
import { SEASONAL_LAYER, seasonalVisualSpec } from './seasonal-network.js';
import { isBridgeBranchLayer, BRIDGE_BRANCH_LAYERS } from './field-crossings.js';

export function getFeatureVisualSpec(feature){
  const spec=legacyFeatureVisualSpec(feature);
  const p=feature?.properties||{}, k=spec.roleKey, role=p.feature_role;
  if(p.layer==='catchment-screen-nw-network'){
    const tone=p.tone, mark=ANALYSIS_PALETTE[tone];
    const stroke=feature.id==='nw96-marsh'?'#ffd074':(p.group==='up'&&feature.geometry?.type.includes('Polygon'))?'#9bb9cc':({lake:'#f4d378',point:'#e5f9fb',overlap:'#ffffff'})[tone]||mark?.stroke||'#bea6fa';
    const polygon=feature.geometry?.type.includes('Polygon');
    return {roleKey:'nw-bridge-network',roleLabel:({lake:'主湖模型分区',point:'现场或位置参照',overlap:'沟段与 E18 叠置',landform:'影像可辨地貌',candidate:'原标绘线索',water:'影像水面参照',model:'条件地形模型'})[tone],
     symbol:tone==='point'?(/pin[1-4]$/.test(feature.id)?feature.id.slice(-1):'◆'):'◇',stroke,
     fill:polygon?stroke+'35':tone==='point'?'#15212e':null,
     dash:tone==='overlap'?[2,5]:tone==='candidate'||tone==='model'?[7,5]:null,
     lineWidth:tone==='overlap'?3:2.3,color3d:parseInt(stroke.slice(1),16)};
  }
  if(p.is_contour||p.layer==='owner-water-network-v75')return spec;
  let tone='reference';
  if(p.status==='disputed')tone='disputed';
  else if(p.layer==='wc2-optical-review')tone=role==='stop'?'model':'reference';
  else if(p.status==='gap'||['gap','schematic_road_uncertainty_gap','qa-excluded'].includes(k))tone='gap';
  else if(['pool-scl6','water_reference','water_overlap','water_observation'].includes(k)||['water_reference','water_overlap','water_observation'].includes(role))tone='water';
  else if(['pool-candidate','g332-review','candidate_link','road_crossing','owner_blue_sketch','snow-counter','s7-low-counter'].includes(k)||
      p.status==='candidate'||(p.layer==='field-photos-20261122'&&p.accuracy_m>20)||['road-review','north-boundary-checks','west-slope-user-sketch','west-slope-review'].includes(p.layer))tone='candidate';
  else if(['observed_outline','diffuse_observation','morphology','interpretation_area'].includes(k)||['observed_outline','diffuse_observation','morphology'].includes(role)||p.status==='observed'&&!['field-photos-20261122','july-2023-review','landsat-2013-quality'].includes(p.layer)&&role!=='road_profile')tone='landform';
  else if(['upstream_core','terrain_variant','search_window','terrain_only_approach','alternative_dsm_approach','catchment-terminal','catchment-model','archive-route','yimin-profile','yimin-probe','east-profile','yard-index-line','main-lake-profiles','road_profile','roadside-terrain-check','ring-model-test-points','s7-low-positive','snow-s7','snow-control'].includes(k)||
       ['modeled','model','model_only'].includes(p.status)||p.layer==='office-flow-tests'||p.layer?.includes('diag-')||p.layer?.startsWith('bridge-f1-'))tone='model';
  const out=withSemanticTone(spec,tone);
  if(k==='g332-osm'){out.lineWidth=1.35;out.casing=null;}
  if(feature?.geometry?.type?.includes('LineString')){
    if(tone==='model')out.dash=spec.dash||[7,4];
    if(tone==='candidate')out.dash=spec.dash||[6,5];
    if(tone==='gap')out.dash=[2,6];
    if(tone==='landform'&&role!=='diffuse_observation')out.dash=null;
  }
  return out;
}
function legacyFeatureVisualSpec(feature) {
  if (isWaybackLayer(feature?.properties?.layer)) return waybackVisualSpec(feature);
  const p = feature?.properties || {};
  const id = feature?.id || '';
  const layer = p.layer || '';
  const status = p.status || 'context';
  const base = EVIDENCE_STATUS_META[status] || EVIDENCE_STATUS_META.context;

  if(p.is_contour)return {roleKey:'modern-contour',roleLabel:'地表模型等高线',symbol:'═',stroke:'#f9e0b0',fill:null,dash:null,hatch:null,lineWidth:1.2,color3d:0xf9e0b0};
  if (layer==='ring-model-test-points') return {
    roleKey:layer, roleLabel:'模型复核点 · 非实测入水口', symbol:'◇',
    stroke:'#e6bcfa', fill:'#e6bcfa33', hatch:null, dash:null, lineWidth:1.8, color3d:0xe6bcfa,
  };
  if (layer===F1_WATERWAY_LAYER||layer===F1_COMPARE_LAYER||layer===WCROSS_UPSTREAM_LAYER||layer===WCROSS_FAR_LAYER||layer===OWNER_BLUE_LAYER) { const spec=f1WaterwayVisualSpec(p.feature_role); if(spec)return spec; }
  if (layer===SEASONAL_LAYER) { const spec=seasonalVisualSpec(p.feature_role); if(spec)return spec; }
  if (isBridgeBranchLayer(layer)) {
    const def = BRIDGE_BRANCH_LAYERS[layer];
    const isRaw = p.feature_role === 'diag-raw';
    return {
      roleKey: layer,
      roleLabel: isRaw ? '地形模型，非实测支路（原地表局部停下）' : def.roleLabel,
      symbol: def.symbol,
      stroke: isRaw ? '#94a3b8' : def.stroke,
      fill: `${def.stroke}24`,
      hatch: null,
      dash: isRaw ? [2, 4] : def.dash,
      lineWidth: isRaw ? 1.8 : 2.6,
      color3d: isRaw ? 0x94a3b8 : def.color3d,
    };
  }

  if (layer === 'field-photos-20261122') { const stroke = feature.properties.accuracy_m>20 ? '#fb923c' : '#e9a8ff'; return {roleKey:layer,roleLabel:'相机位置／拍摄朝向',symbol:'◉',stroke,fill:'#1e163d',hatch:null,dash:null,lineWidth:2.2,color3d:parseInt(stroke.slice(1),16)}; }
  if (layer === 'wc2-optical-review') { const p=feature.properties; const stroke=p.feature_role==='fringe'?'#72e6dc':(p.feature_role==='stop' || feature.id==='wc2-review-gap')?'#f8c36c':'#ceb2f4'; return {roleKey:layer,roleLabel:p.feature_role==='fringe'?'末段影像采样线 · 不是水面范围':p.feature_role==='stop'?'不填洼模型停点':'影像核查段 · 沿旧模型线',symbol:p.feature_role==='stop'?'◇':'┄',stroke,fill:stroke+'22',hatch:null,dash:[6,5],lineWidth:2.5,color3d:parseInt(stroke.slice(1),16)}; }
  if(layer==='slope-road-clues'){
    const patch=p.feature_role==='bright-patch', search=p.feature_role==='road-search';
    return {roleKey:p.feature_role,roleLabel:patch?'影像查找范围 · 不代表浅斑实测边界':search?'地方路核查点 · 不是涵口':'手绘蓝笔定位点 · 不是通水',
      symbol:patch?'□':search?'⊘':'◇',stroke:patch?'#39d3a5':'#edb75f',fill:patch?'#157f6728':'#98712e40',
      dash:patch?[2,4]:null,hatch:null,lineWidth:patch?1.8:2.1,color3d:patch?0x39d3a5:0xedb75f};
  }
  if (layer === 'roadside-terrain-check') return {roleKey:layer,roleLabel:'地表取样带 · 非水路',symbol:'┄',stroke:'#d3b6ff',fill:'#d3b6ff22',hatch:null,dash:[5,5],lineWidth:2,color3d:0xd3b6ff};
  if (layer === 'office-nw-audit') return {roleKey:layer,roleLabel:'核查定位点',symbol:'◇',stroke:'#fbc98b',fill:'#fbc98b30',hatch:null,dash:null,lineWidth:2.2,color3d:0xfbc98b};
  if (layer === 'july-2023-review') {
    return { roleKey: layer, roleLabel: '影像采样格 · 不是水面', symbol: '□',
      stroke: '#f5f3f4', fill: null, hatch: null, dash: [2, 3], lineWidth: 1.5, color3d: 0xf5f3f4 };
  }
  if (layer === 'west-slope-user-sketch' || layer === 'west-slope-review') {
    const red = p.feature_role === 'red-outline';
    const review = layer === 'west-slope-review';
    const hex = review ? '#fcd34d' : red ? '#fb7185' : '#38bdf8';
    return {roleKey:layer,roleLabel:review?'待核地点':red?'用户范围示意':'用户支路假设',symbol:review?'◇':'┄',stroke:hex,fill:hex+'2b',hatch:null,dash:[6,4],lineWidth:2.3,color3d:parseInt(hex.slice(1),16)};
  }
  if (layer === 'north-boundary-checks') {
    return {
      roleKey: layer,
      roleLabel: '院墙调查控制点 · 独立核查（非已证水路）',
      symbol: '◇',
      stroke: '#e6a84c',
      fill: 'rgba(230, 168, 76, 0.24)',
      hatch: null,
      dash: [4, 3],
      lineWidth: 2.2,
      color3d: 0xe6a84c,
    };
  }
  if (layer === 'main-lake-profiles') {
    return {roleKey:layer,roleLabel:'主湖地表剖面',symbol:'⋯',stroke:'#a5b4fc',fill:'#a5b4fc30',hatch:null,dash:[6,3],lineWidth:2.2,color3d:0xa5b4fc};
  }
  if (layer === 'office-flow-tests' || layer === 'office-corridor' || layer === 'marsh-review') {
    const raw = p.feature_role === 'raw';
    const field = p.feature_role === 'field-check';
    const hex = layer === 'marsh-review' ? '#fbbf24' : layer === 'office-corridor' ? '#67e8f9' : field ? '#fda4af' : raw ? '#fbbf24' : '#c4b5fd';
    return {roleKey:layer,roleLabel:layer === 'marsh-review' ? '圈注导航' : layer === 'office-corridor' ? '定位与地形剖面' : field ? '现场待核' : raw ? '原面停点' : '填洼模型线',symbol:layer === 'office-corridor' ? '◇' : '┄',stroke:hex,fill:hex+'30',hatch:null,dash:layer === 'office-flow-tests' ? (raw ? [3,3] : [7,4]) : null,lineWidth:2.1,color3d:parseInt(hex.slice(1),16)};
  }

  if (isHistoricalLayer(layer)) {
    const h = HISTORICAL_LAYERS[layer];
    return {
      roleKey: layer, roleLabel: '历史地图参考（非同期观测）',
      symbol: h.symbol, stroke: h.color, fill: h.color + '24',
      hatch: null, dash: [5, 4], lineWidth: 1.9, color3d: h.color3d,
    };
  }

  // 1. nearby-pools: SCL6 (observed) vs candidate (candidate)
  if (layer === 'nearby-pools') {
    if (p.rule === 'candidate' || status === 'candidate') {
      return {
        roleKey: 'pool-candidate',
        roleLabel: '候选水分类 (candidate)',
        symbol: '◇',
        stroke: '#f59e0b',
        fill: 'rgba(245, 158, 11, 0.20)',
        hatch: 'amber',
        dash: [6, 3],
        lineWidth: 1.8,
        color3d: 0xf59e0b,
      };
    }
    return {
      roleKey: 'pool-scl6',
      roleLabel: '光学观测分类 (SCL6)',
      symbol: '●',
      stroke: '#0ea5e9',
      fill: 'rgba(14, 165, 233, 0.34)',
      hatch: null,
      dash: null,
      lineWidth: 1.8,
      color3d: 0x0ea5e9,
    };
  }

  // 2. landsat-2013-quality: usable vs excluded
  if (layer === 'landsat-2013-quality') {
    if (p.feature_role === 'excluded') {
      return {
        roleKey: 'qa-excluded',
        roleLabel: 'QA 排除像元 (excluded)',
        symbol: '✕',
        stroke: '#e11d48',
        fill: 'rgba(225, 29, 72, 0.14)',
        hatch: 'crimson',
        dash: [3, 3],
        lineWidth: 1.5,
        color3d: 0xe11d48,
      };
    }
    return {
      roleKey: 'qa-usable',
      roleLabel: 'QA 可用像元 (usable)',
      symbol: '✓',
      stroke: '#10b981',
      fill: 'rgba(16, 185, 129, 0.18)',
      hatch: null,
      dash: null,
      lineWidth: 1.5,
      color3d: 0x10b981,
    };
  }

  // 3. s7-repeat-green: 5 positive two_dsm_two_scale_low=true vs 2 false counterexamples
  if (layer === 's7-repeat-green') {
    if (p.two_dsm_two_scale_low === true) {
      return {
        roleKey: 's7-low-positive',
        roleLabel: 'S7 稳定低地正例（两源两尺度偏低）',
        symbol: '★',
        stroke: '#10b981',
        fill: 'rgba(16, 185, 129, 0.50)',
        hatch: null,
        dash: null,
        lineWidth: 2.2,
        color3d: 0x10b981,
      };
    }
    return {
      roleKey: 's7-low-counter',
      roleLabel: '反例 · 非稳定低地（不满足两源两尺度）',
      symbol: '⊘',
      stroke: '#f97316',
      fill: 'rgba(249, 115, 22, 0.24)',
      hatch: 'amber',
      dash: [4, 3],
      lineWidth: 2.0,
      color3d: 0xf97316,
    };
  }

  if (layer === 's7-green-controls') {
    return {
      roleKey: 's7-controls',
      roleLabel: 'S7 同期 108 格陆地对照',
      symbol: '▫',
      stroke: '#84cc16',
      fill: 'rgba(132, 204, 22, 0.14)',
      hatch: null,
      dash: [4, 3],
      lineWidth: 1.3,
      color3d: 0x84cc16,
    };
  }

  // 4. snow-sites & snow-2026: distinguish S7 priority vs S3 counterexample vs S6/C1
  if (layer === 'snow-sites' || layer === 'snow-2026') {
    const isS3 = id.startsWith('s3-');
    const isS7 = id.startsWith('s7-');
    const isS6 = id.startsWith('s6-');
    const isC1 = id.startsWith('c1-');
    if (isS3) {
      return {
        roleKey: 'snow-counter',
        roleLabel: layer === 'snow-sites' ? 'S3 反例点（白带偏高）' : 'S3 反例残雪（偏高）',
        symbol: '⊘',
        stroke: '#fb7185',
        fill: 'rgba(251, 113, 133, 0.30)',
        hatch: 'crimson',
        dash: [4, 3],
        lineWidth: 1.9,
        color3d: 0xfb7185,
      };
    }
    if (isS7) {
      return {
        roleKey: 'snow-s7',
        roleLabel: layer === 'snow-sites' ? 'S7 坡西优先点（非过路点）' : 'S7 残雪斑块（相对偏低）',
        symbol: '◆',
        stroke: '#22d3ee',
        fill: 'rgba(34, 211, 238, 0.34)',
        hatch: null,
        dash: null,
        lineWidth: 2.0,
        color3d: 0x22d3ee,
      };
    }
    if (isS6 || isC1) {
      return {
        roleKey: 'snow-control',
        roleLabel: isS6 ? 'S6 尺度敏感对照' : 'C1 无雪低地对照',
        symbol: '◇',
        stroke: '#eab308',
        fill: 'rgba(234, 179, 8, 0.22)',
        hatch: null,
        dash: [5, 3],
        lineWidth: 1.6,
        color3d: 0xeab308,
      };
    }
    return {
      roleKey: 'snow-other',
      roleLabel: '其余 SCL 11 残雪像元',
      symbol: '●',
      stroke: '#e2e8f0',
      fill: 'rgba(226, 232, 240, 0.26)',
      hatch: null,
      dash: null,
      lineWidth: 1.1,
      color3d: 0xe2e8f0,
    };
  }

  // 5. G332 road review vs OSM roads
  if (layer === 'road-review') {
    return {
      roleKey: 'g332-review',
      roleLabel: 'G332 待核过路范围（非已证涵洞）',
      symbol: '◇',
      stroke: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.14)',
      hatch: null,
      dash: [7, 4],
      lineWidth: 2.1,
      color3d: 0xf59e0b,
    };
  }
  if (layer === 'roads') {
    return {
      roleKey: 'g332-osm',
      roleLabel: 'G332 OSM 道路参考线',
      symbol: '■',
      stroke: '#f8fafc',
      casing: '#0f172a',
      fill: null,
      hatch: null,
      dash: null,
      lineWidth: 2.6,
      color3d: 0xf8fafc,
    };
  }
  if(layer==='owner-water-network-v75'){
    const tentative=Boolean(feature?.id?.includes('potential')||feature?.id?.includes('seepage'));
    return {roleKey:'v75-owner-kmz',roleLabel:tentative?'潜在线 · 未核过水':'现场标绘 · 需核验',symbol:'◇',stroke:tentative?'#ffb465':'#79d8f4',casing:'#102733',fill:null,hatch:null,dash:tentative?[4,4]:[9,3],lineWidth:2.6,color3d:tentative?0xffb465:0x79d8f4};
  }
  if(layer==='g332-opening-road')return {roleKey:'g332-context',roleLabel:'国道 G332 与南部环岛（路网）',symbol:'■',stroke:'#ee747b',casing:'#3d1420',fill:null,hatch:null,dash:null,lineWidth:2.6,color3d:0xee747b};
  if (layer === 'secondary-roads') {
    return {
      roleKey: 'secondary-road',
      roleLabel: '次级 OSM 道路参考',
      symbol: '■',
      stroke: 'rgba(203, 213, 225, 0.42)',
      fill: null,
      hatch: null,
      dash: null,
      lineWidth: 1.1,
      color3d: 0x94a3b8,
    };
  }

  // 6. Yimin profile, probes, reference
  if (layer === 'yimin-profile') {
    return {
      roleKey: 'yimin-profile',
      roleLabel: '伊敏河直剖面（无流向箭头）',
      symbol: '▲',
      stroke: '#c084fc',
      fill: null,
      hatch: null,
      dash: [8, 4, 2, 4],
      lineWidth: 2.6,
      color3d: 0xc084fc,
    };
  }
  if (layer === 'yimin-probes') {
    return {
      roleKey: 'yimin-probe',
      roleLabel: '地形瓶颈探针（无向几何）',
      symbol: '▲',
      stroke: '#a855f7',
      fill: null,
      hatch: null,
      dash: [4, 4],
      lineWidth: 1.5,
      color3d: 0xa855f7,
    };
  }
  if (layer === 'yimin-reference') {
    return {
      roleKey: 'yimin-river',
      roleLabel: '伊敏河参考中心线 (OSM)',
      symbol: '■',
      stroke: '#60a5fa',
      fill: null,
      hatch: null,
      dash: [3, 3],
      lineWidth: 2.0,
      color3d: 0x60a5fa,
    };
  }

  // 7. East profiles & 0m anchors & yard index line
  if (layer === 'east-profiles') {
    if (id === 'archive-yard_reference_2100_2270m') {
      return {
        roleKey: 'yard-index-line',
        roleLabel: '北场院东端索引段（非条带/非水斑）',
        symbol: '■',
        stroke: '#fb923c',
        fill: null,
        hatch: null,
        dash: [4, 3],
        lineWidth: 2.3,
        color3d: 0xfb923c,
      };
    }
    return {
      roleKey: 'east-profile',
      roleLabel: feature?.geometry?.type === 'Point' ? '历史剖面 0 m 锚点' : '历史 DSM 剖面线',
      symbol: '▲',
      stroke: '#e879f9',
      fill: 'rgba(232, 121, 249, 0.25)',
      hatch: null,
      dash: [6, 3, 2, 3],
      lineWidth: 2.0,
      color3d: 0xe879f9,
    };
  }

  if(layer?.startsWith('catchment-screen-')){
    const tone=ANALYSIS_PALETTE.model;
    return { roleKey:'catchment-screen',roleLabel:'30 米候选汇水范围 · 地形模型',symbol:'◇',
      stroke:tone.stroke,fill:tone.fill+'38',hatch:null,dash:layer.endsWith('-raw')||layer.endsWith('-nw')?[3,2]:[7,4],
      lineWidth:1.55,color3d:parseInt(tone.stroke.slice(1),16) };
  }

  // 8. Main catchments & archive routing (strictly modeled, NO flow arrows!)
  if (layer === 'main-catchments') {
    if (p.display_role === 'terminal') {
      return {
        roleKey: 'catchment-terminal',
        roleLabel: '模型终点掩膜（不计入 17.28 km²）',
        symbol: '▲',
        stroke: '#818cf8',
        fill: 'rgba(129, 140, 248, 0.16)',
        hatch: null,
        dash: [4, 3],
        lineWidth: 1.5,
        color3d: 0x818cf8,
      };
    }
    const palette = [
      '#a78bfa', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#2dd4bf', '#f472b6', '#94a3b8',
    ];
    const cid = Number(p.entry_cluster_id);
    const col = Number.isFinite(cid) && cid >= 1 && cid <= 7 ? palette[cid - 1] : '#a78bfa';
    return {
      roleKey: 'catchment-model',
      roleLabel: '模型集水区（非实测流量份额）',
      symbol: '▲',
      stroke: col,
      fill: p.display_role === 'total' ? 'rgba(167, 139, 250, 0.05)' : `${col}1c`,
      hatch: null,
      dash: [8, 4, 2, 4],
      lineWidth: p.display_role === 'total' ? 2.0 : 1.3,
      color3d: parseInt(col.slice(1), 16),
    };
  }

  if (layer === 'archive-routing') {
    return {
      roleKey: 'archive-route',
      roleLabel: '旧版 30m 模型格链（非新三情景/非实测水路）',
      symbol: '▲',
      stroke: '#c084fc',
      fill: null,
      hatch: null,
      dash: [6, 5, 2, 5],
      lineWidth: 2.0,
      color3d: 0xc084fc,
    };
  }

  if (layer === 'regional-reference') {
    return {
      roleKey: 'rain-gauge',
      roleLabel: '外围雨量站参考（规划坐标）',
      symbol: '■',
      stroke: '#38bdf8',
      fill: '#0f172a',
      hatch: null,
      dash: null,
      lineWidth: 2.0,
      color3d: 0x38bdf8,
    };
  }

  return {
    roleKey: status,
    roleLabel: base.label,
    symbol: base.symbol,
    stroke: base.stroke,
    fill: base.fill,
    hatch: null,
    dash: base.dash,
    lineWidth: 1.7,
    color3d: parseInt(base.stroke.slice(1), 16) || 0x94a3b8,
  };
}

/**
 * Compute comparison series strictly on the frozen water-index.json dates:
 *   - 'same-month': fixed calendar month across all 40/41 years (1984–2024)
 *   - 'same-year':  all months within the selected year (9 in 1984, 12 in 1985–2024)
 */
export function buildTimeComparison(waterIndex, axis, anchorDate, lakeKey = 'BOTH') {
  if (!waterIndex?.dates?.includes(anchorDate)) {
    throw new RangeError(`Month outside archive: ${anchorDate}`);
  }
  if (axis !== 'same-month' && axis !== 'same-year') {
    throw new RangeError(`Unknown comparison axis: ${axis}`);
  }
  const lakeIds = lakeKey === 'BOTH' ? Object.keys(waterIndex.lakes) : [lakeKey];
  const dates = waterIndex.dates.filter(d =>
    axis === 'same-month' ? d.slice(5) === anchorDate.slice(5) : d.slice(0, 4) === anchorDate.slice(0, 4)
  );
  return dates.map(d => ({
    date: d,
    lakes: Object.fromEntries(lakeIds.map(id => [id, waterIndex.lakes[id].months[d]])),
  }));
}

/**
 * Spatial water GeoJSON export matching hujiernuoer/spatial-water-export/v2
 * (identical contract to handoff exports.js).
 */
export function buildMonthExport(waterIndex, waterDataMap, lakeKey, date) {
  if (!waterIndex.dates.includes(date)) throw new RangeError(`Month outside archive: ${date}`);
  const lakeIds = lakeKey === 'BOTH' ? Object.keys(waterIndex.lakes) : [lakeKey];
  const readPart = p => {
    if (!p) return null;
    const part = waterDataMap[p];
    if (!part) throw new Error(`Missing frozen collection ${p}`);
    return part;
  };
  const partState = p => {
    const part = readPart(p);
    return part ? (part.features.length ? 'provided_nonempty' : 'provided_empty') : 'unavailable';
  };
  const annotate = (f, extra) => ({
    ...f,
    properties: { ...(f.properties || {}), ...extra },
  });

  const out = {
    type: 'FeatureCollection',
    schema: 'hujiernuoer/spatial-water-export/v2',
    selection: { date, lake_ids: lakeIds },
    month_records: [],
    features: [],
  };

  for (const lake of lakeIds) {
    const ser = waterIndex.lakes[lake];
    const row = ser.months[date];
    out.month_records.push({
      lake_id: lake,
      date,
      ...row,
      water_geometry: partState(row.water),
      nodata_geometry: partState(row.nodata),
    });
    const bPart = readPart(ser.boundary);
    if (bPart) {
      out.features.push(...bPart.features.map(f => annotate(f, { archive_lake_id: lake, archive_kind: 'boundary' })));
    }
    for (const kind of ['water', 'nodata']) {
      const part = readPart(row[kind]);
      if (!part) continue;
      out.features.push(
        ...part.features.map(f =>
          annotate(f, {
            archive_lake_id: lake,
            archive_month: date,
            archive_kind: kind,
            status: row.status,
            qualification: row.qualification,
            area_ha: row.area_ha,
            valid_pct: row.valid_pct,
            classification_disputed: row.classification_disputed === true,
            classification_note: row.classification_note || null,
          })
        )
      );
    }
  }
  return out;
}

export function buildAllExport(waterIndex, waterDataMap) {
  const out = {
    type: 'FeatureCollection',
    schema: 'hujiernuoer/spatial-water-export/v2',
    selection: {
      date_range: [waterIndex.dates[0], waterIndex.dates[waterIndex.dates.length - 1]],
      lake_ids: Object.keys(waterIndex.lakes),
    },
    month_records: [],
    features: [],
  };
  const seen = new Set();
  for (const date of waterIndex.dates) {
    const m = buildMonthExport(waterIndex, waterDataMap, 'BOTH', date);
    out.month_records.push(...m.month_records);
    for (const f of m.features) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        out.features.push(f);
      }
    }
  }
  return out;
}

const PROFILE_GROUPS = [
  { id: 'main-lake', label: '主湖 · 来水与湖盆', legacy: [] },
  { id: 'office', label: '办公楼—主湖及西北坡', legacy: ['profile-B_nw_slope_to_office', 'profile-A_office_to_lake'] },
  { id: 'archive', label: '西长湖与北侧地块 · 原有剖面', legacy: ['archive-t6', 'archive-t7', 'archive-t8', 'archive-p1', 'archive-p2'] },
  { id: 'regional', label: '外围地形对照', legacy: ['yimin-nearest-profile'] },
  { id: 'roadside', label: '圆涵与三八水库中桥 · 道路两侧地形', legacy: [] },
  { id: 'seasonal-roads', label: '水路线索 · 道路纵横剖面', legacy: [] },
  { id: 'other', label: '其他剖面', legacy: [] },
];

export function groupProfileIds(features) {
  const groups = PROFILE_GROUPS.map(g => ({ ...g, ids: [] }));
  const byId = new Map(groups.map(g => [g.id, g]));
  for (const feature of features) {
    if (!feature?.properties?.profile?.samples?.length) continue;
    const group = byId.get(feature.properties.profile_group)
      || groups.find(g => g.legacy.includes(feature.id)) || byId.get('other');
    group.ids.push(feature.id);
  }
  return groups.filter(g => g.ids.length).map(({ label, ids, legacy }) => {
    const rank = id => legacy.includes(id) ? legacy.indexOf(id) : Infinity;
    return { label, ids: ids.sort((a, b) => (rank(a) - rank(b)) || 0) };
  });
}

export function describeProfileCursorElevation(sample, precision = 1) {
  if (sample.waterMasked) return '参考水面内，湖底未测';
  return Number.isFinite(sample.glo30_m) ? `${sample.glo30_m.toFixed(precision)}m` : '无地表高程';
}

/**
 * Keep WGS84 coordinates and chainage for every sample. Reference-water data
 * explicitly suppress both DSM values; they are not lake-bed measurements.
 */
export function extractProfileData(feature) {
  const prof = feature?.properties?.profile;
  if (!prof || !Array.isArray(prof.samples) || !prof.samples.length) return null;
  const mask = prof.water_mask;
  const hasMask = Object.hasOwn(prof, 'water_mask');
  // Fail closed for malformed masks rather than passing through a possibly
  // unmasked surface value. Legacy profiles have no mask property.
  if (hasMask && (!Array.isArray(mask) || mask.length !== prof.samples.length ||
    [...mask].some(v => typeof v !== 'boolean'))) return null;
  const cols = prof.columns || [];
  const awColumn = cols.indexOf('aw3d30_m');
  const samples = prof.samples.map((row, idx) => {
    const waterMasked = hasMask && mask[idx];
    return {
      index: idx, distance_m: row[0], lon: row[1], lat: row[2], waterMasked,
      glo30_m: !waterMasked && Number.isFinite(row[3]) ? row[3] : null,
      aw3d30_m: !waterMasked && awColumn !== -1 && Number.isFinite(row[awColumn]) ? row[awColumn] : null,
    };
  });

  const waterIntervals = [];
  let run = -1;
  const at = i => samples[i].distance_m;
  for (let i = 0; i <= samples.length; i++) {
    if (samples[i]?.waterMasked) {
      if (run < 0) run = i;
    } else if (run >= 0) {
      waterIntervals.push({
        startM: run > 0 ? (at(run - 1) + at(run)) / 2 : at(0),
        endM: i < samples.length ? (at(i - 1) + at(i)) / 2 : at(i - 1),
      });
      run = -1;
    }
  }

  const glos = samples.map(s => s.glo30_m).filter(Number.isFinite);
  const aws = samples.map(s => s.aw3d30_m).filter(Number.isFinite);
  const hasAw = aws.length > 0;
  const land = glos.concat(aws);
  const start = samples[0];
  let zeroSampleIdx = samples.findIndex(s => Math.abs(s.distance_m) < 1e-6);
  if (zeroSampleIdx < 0) {
    let bestDist = Infinity;
    zeroSampleIdx = 0;
    for (let i = 0; i < samples.length; i++) {
      const ad = Math.abs(samples[i].distance_m);
      if (ad < bestDist) {
        bestDist = ad;
        zeroSampleIdx = i;
      }
    }
  }
  const waterMaskedCount = samples.reduce((acc, s) => acc + (s.waterMasked ? 1 : 0), 0);
  return {
    id: feature.id,
    name: feature.properties.name || feature.id,
    note: prof.note || '',
    positiveDirection: feature.properties.positive_direction || '自首点（湖端 0 m）沿线递增',
    negativeDirection: feature.properties.negative_direction || null,
    zeroAnchor: feature.properties.zero_anchor_lonlat || [start.lon, start.lat],
    zeroSampleIdx,
    waterMaskedCount,
    placementCaveat: feature.properties.placement_caveat || null,
    hasAw, hasMask, samples, waterIntervals,
    waterMaskLabel: typeof prof.water_mask_label === 'string' && prof.water_mask_label.trim() || '参考水面范围',
    lengthM: samples[samples.length - 1].distance_m,
    minDistM: start.distance_m,
    maxDistM: samples[samples.length - 1].distance_m,
    minElev: land.length ? Math.min(...land) : null,
    maxElev: land.length ? Math.max(...land) : null,
    riseGloM: Number.isFinite(start.glo30_m) && glos.length ? Math.max(...glos) - start.glo30_m : null,
    riseAwM: Number.isFinite(start.aw3d30_m) && hasAw ? Math.max(...aws) - start.aw3d30_m : null,
  };
}

/**
 * Classify a loaded/pending/failed water-geometry entry for a lake so network
 * failures and in-flight loads are NEVER misreported as "空水面几何（零值）".
 */
export function describeWaterGeometryState(entry) {
  if (entry?.error) {
    return {
      kind: 'error',
      text: `水面图层加载失败，请重试（${entry.error}）`,
      shortBadge: '⚠ 水面图层加载失败，请重试',
      isError: true,
      isLoading: false,
    };
  }
  if (!entry || entry.loading) {
    return {
      kind: 'loading',
      text: '正在加载当月水面与缺测几何（已清除上月水面）…',
      shortBadge: '加载中…',
      isError: false,
      isLoading: true,
    };
  }
  if (!entry.row || entry.row.status === 'invalid') {
    return {
      kind: 'invalid',
      text: '无几何（覆盖不足）',
      shortBadge: null,
      isError: false,
      isLoading: false,
    };
  }
  const ndSuffix = entry.nodata?.features?.length ? ` · 缺测 ${entry.nodata.features.length} 要素` : '';
  if (entry.row.status === 'zero') {
    return {
      kind: 'zero',
      text: `空水面几何（观测为零）${ndSuffix}`,
      shortBadge: null,
      isError: false,
      isLoading: false,
    };
  }
  if (entry.water?.features?.length) {
    return {
      kind: 'water',
      text: `水面 ${entry.water.features.length} 要素${ndSuffix}`,
      shortBadge: null,
      isError: false,
      isLoading: false,
    };
  }
  // Defensive guard: never misreport unloaded positive geometry as zero
  return {
    kind: 'loading',
    text: '当月水面图层尚未就绪，请稍候或重试',
    shortBadge: '加载中…',
    isError: false,
    isLoading: true,
  };
}

/**
 * Resolve export payload using the month and lakeView locked at click time
 * (immune to user switching month/lake during slow network fetches) and abort
 * cleanly if any required lake's geometry failed to load.
 */
export async function resolveExportMonthPayload(provider, lockedMonth, lockedLake) {
  if (!provider?.waterIndex?.dates?.includes(lockedMonth)) {
    throw new RangeError(`Month outside archive: ${lockedMonth}`);
  }
  const allLakes = Object.keys(provider.waterIndex.lakes);
  const requiredLakes = lockedLake === 'BOTH' ? allLakes : [lockedLake];
  const res = await provider.loadMonthWater(lockedMonth, requiredLakes);
  const failed = requiredLakes
    .map(id => res.lakes?.[id])
    .filter(entry => entry && entry.error);
  if (failed.length) {
    throw new Error(
      `几何加载失败，已中止导出（${failed.map(e => `${e.lakeId}: ${e.error}`).join('; ')}）`
    );
  }
  const payload = buildMonthExport(provider.waterIndex, provider.waterParts, lockedLake, lockedMonth);
  return {
    lockedMonth,
    lockedLake,
    filename: `hujiernuoer-water-${lockedMonth}-${lockedLake.toLowerCase()}.geojson`,
    payload,
  };
}

/**
 * Resolve effective 3D mode against actual WebGL availability so `?dim=3d` on
 * a WebGL-unavailable environment cleanly resets `view3d` to false and routes
 * all zoom/pan/fit/pick interactions back to 2D Canvas.
 */
export function resolveEffectiveView3d(requestedView3d, webglReady) {
  const req = Boolean(requestedView3d);
  const ok = Boolean(webglReady);
  return {
    view3d: req && ok,
    fallbackFrom3d: req && !ok,
  };
}

export function encodeAtlasUrl(state) {
  const p = new URLSearchParams();
  if (state.view3d) p.set('dim', '3d');
  if ([1,4,8].includes(state.exag3d) && (state.view3d || state.exagExplicit || state.exag3d!==8)) p.set('exag',String(state.exag3d));
  if (state.basemap && state.basemap !== 'sentinel2-2026-08-08') p.set('bm', state.basemap);
  if (state.month) p.set('month', state.month);
  if (state.lakeView && state.lakeView !== 'BOTH') p.set('lake', state.lakeView);
  if (state.compareAxis && state.compareAxis !== 'same-month') p.set('axis', state.compareAxis);
  if (state.selectedFeatureId) p.set('fid', state.selectedFeatureId);
  if (state.pickedDataId&&state.pickedDataId===state.selectedFeatureId)p.set('picked',state.pickedDataId);
  if (state.activeEvidenceId) p.set('ev', state.activeEvidenceId);
  if (state.activeProfileId && state.activeProfileId !== 'yimin-nearest-profile') p.set('prof', state.activeProfileId);
  if (Number.isInteger(state.profileCursorIdx) && state.profileCursorIdx >= 0) p.set('pidx', String(state.profileCursorIdx));
  if (state.bottomTab && state.bottomTab !== 'time') p.set('tray', state.bottomTab);
  return p.toString();
}

export function decodeAtlasUrl(search) {
  const p = new URLSearchParams(search || '');
  const out = {};
  if (p.get('dim') === '3d') out.view3d = true;
  if (['1','4','8'].includes(p.get('exag'))) {out.exag3d=Number(p.get('exag'));out.exagExplicit=true;}
  if (p.get('bm')) out.basemap = p.get('bm');
  if (p.get('month') && /^\d{4}-\d{2}$/.test(p.get('month'))) out.month = p.get('month');
  if (['BOTH', 'MAIN', 'WF1'].includes(p.get('lake'))) out.lakeView = p.get('lake');
  if (['same-month', 'same-year'].includes(p.get('axis'))) out.compareAxis = p.get('axis');
  if (p.get('fid')) out.selectedFeatureId = p.get('fid');
  if(p.get('picked')&&p.get('picked')===out.selectedFeatureId)out.pickedDataId=p.get('picked');
  if (p.get('ev')) out.activeEvidenceId = p.get('ev');
  if (p.get('prof')) out.activeProfileId = p.get('prof');
  if (p.get('pidx') && /^\d+$/.test(p.get('pidx'))) out.profileCursorIdx = Number(p.get('pidx'));
  if (['time','profile','feature'].includes(p.get('tray'))) out.bottomTab = p.get('tray');
  return out;
}

