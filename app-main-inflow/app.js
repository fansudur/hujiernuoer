import { ESRI_ATTRIBUTION, loadEsriBasemap } from './esri-online.js?v=6';
import {constrainedConnection,createEsriDetailController,overviewZoom} from './esri-view-detail.mjs?v=walk3';
import {ATLAS_BOUNDS,BRIDGE_BOUNDS,COMPACT_OVERVIEW_ZOOM,OVERVIEW_ZOOM,BRIDGE_ZOOM} from './esri-atlas-windows.mjs?v=3';
import { GUIDE_METERS_PER_DEG_LAT,GUIDE_METERS_PER_DEG_LON,EAST_SECTION,EAST_COP,EAST_AW,eastModelStroke,eastModelColor,EAST_STYLE,eastDash,GUIDE_MAIN_MODEL_STROKE,guideModelDash,modelsEast as guideEastModelIds,isEastGuideRef,guideDashStyle,guideInsetStroke,GUIDE_FOCUS_WIDTH,guideFocusLineId } from './guide-map-style.js?v=105.14';
import { portraitGuidePair, followsPortraitItinerary } from './guide-portrait-cameras.js?v=105.18.20';
import { blendGuidePose,recordedGuidePose,recordedTravelLead,OPENING_NW_POSE,desktopRecordedGuidePose } from './guide-recorded-cameras.js?v=105.18.13';
import { BRIDGE_REVIEW_STOPS,WF1_MODELS,CONTEXT_GUIDE_LINES,easeGuide,openingPinNumbers } from './guide-review-policy.js?v=105.18.21';
import {pointInGeoGeometry as insideSlopeWater} from './geo-pick.js';
import {wireReferenceZoom} from './v83-reference.js?v=105.9';
import {displayClip} from './v81-display-clip.js';
/* ==========================================================================
   app-ui/app.js
   Application Controller for "Steppe Cartographic Observatory" (app-ui).
   Built directly on the app-contours rendering & data foundation:
   - Full-bleed 2D/3D map stage with smoked-obsidian floating HUD
   - Instant twin-lake telemetry chips + progressive per-lake 10s timeout & retry
   - Neutral error copy ("水面图层加载失败，请重试")
   - Startup & runtime WebGL context-loss fallback to operable 2D preserving state
   - On-demand floating drawers (Layers / Evidence / Cases / History / Inspector)
   - Collapsible & draggable bottom Temporal / Profile Command Deck
   - Lazy-loaded modern 5m/10m contours & 1933–1980 historical map overlays
   ========================================================================== */

import {configureTourPanels} from './v74-panels.js';
import { HandoffDataProvider } from './data-provider.js?v=105.18.8';
import { sampleDemElevation,
  AOI_BOUNDS,
  geometryBounds,
  geometryCenter,
} from './terrain-math.js';
import {
  EVIDENCE_STATUS_META,
  LAYER_GROUPS,
  HISTORICAL_LAYERS,
  isHistoricalLayer,
  isHistoricalId,
  describeWaterMonth,
  describeWaterGeometryState,
  getFeatureVisualSpec,
  extractProfileData,
  groupProfileIds,
  describeProfileCursorElevation,
  resolveExportMonthPayload,
  resolveEffectiveView3d,
  buildAllExport,
  encodeAtlasUrl,
  decodeAtlasUrl,
} from './view-model.js';
import { CONTOUR_DEFAULT_INTERVAL, CONTOUR_CHOICES, normalizeContours, contourSelection } from './contour-controls.js';
import { isTrack, profileFromExactLine, nativeTrackProfiles } from './picked-line-profile.js';
import { WATERWAY_PANEL, ROUTE_DEEP_LINK, ROUTE_GUIDE_MAP, validateWaterwayOverview, renderWaterwayOverview } from './waterway-overview.js';
import { WATERWAY_MAP_GROUPS, hiddenWaterwayAliases, setWaterwayMapLayers, eastPoolTimelineFrame } from './waterway-map-policy.js?v=105.13';
import { EAST_POOL_TIMELINE, EAST_POOL_OBSERVATION_MONTHS } from './east-pool-timeline.js?v=105.13';
import { F1_WATERWAY_LAYER, F1_COMPARE_LAYER, F1_WATERWAY_NAME, F1_EVIDENCE_ID, F1_LEGEND, validateF1Waterway, WCROSS_UPSTREAM_LAYER, WCROSS_UPSTREAM_NAME, WCROSS_UPSTREAM_LEGEND, WCROSS_FAR_LAYER, WCROSS_FAR_NAME, validateWcrossUpstream, OWNER_BLUE_LAYER, OWNER_BLUE_NAME, validateOwnerBlue } from './f1-waterway.js';
import { SEASONAL_LAYER, SEASONAL_NAME, validateSeasonalNetwork } from './seasonal-network.js';
import { STUDY_LAYER, registerStudyFeatures, springScenes, studyPanelHtml } from './site-study.js';
import {
  renderDualLakeCompareCharts,
  renderTerrainProfileChart,
  profileCursorReadout,
} from './charts.js';
import { validateFixedHistory, loadHistoryImage, exactGoogleEarthMonth, broadHistoryMonths, isBroadHistoryScene, historySceneMonth, historyMenuEntries } from './fixed-history.js';
import { normalizeGuidedTours, sampleGuidedTour, softenedTravelProgress, buildCinematicHeightProfile } from './guided-tours.js';
import { AtlasMap2D } from './map-2d.js?v=105.18.6';
import { AtlasMap3D } from './map-3d.js?v=105.18.6';
import { WALK_ROAD_ID, WALK_ROAD_PHOTO, WALK_OFFICE_ID, WALK_EYE_M, FREE_FLY_ENTRY_M, WALK_GUIDE_SPEED_MPS, prepareWalkRoad, sampleWalkRoad, beijingSun, adjustFreeLook, stepFreePose, WALK_SPEED_LEVELS, WALK_SPEED_DEFAULT, FLY_SPEED_DEFAULT, walkSpeedMaxLevel, walkHorizontalMps, walkVerticalMps } from './terrain-walk.js';
import { ANALYSIS_PALETTE, VIEW_SCOPES, PAINT_BACKGROUND_ROADS } from './atlas-visual-policy.js';

import {
  WAYBACK_IDS, WAYBACK_LAYERS, isWaybackLayer, isWaybackId, isWayback2dOnly,
  createWaybackLoader, validateWayback, sourceRows,
} from './wayback.js';

import { createMonthPlayback } from './month-playback.js';
import { createTimelineCalendar, filterTimelineAxis, relativeTimelineDate, isUsableWaterMonth, representativeTimelineScene, TIMELINE_REFERENCE_SCENE } from './timeline-sync.js?v=105.13';
import { OFFICE_DEFS, validateOfficeCompanion } from './office-companion.js';
import { MAIN_PROFILE_LAYER, validateMainProfiles } from './main-profiles.js';
import { FIELD_LAYER, FIELD_LABEL, validateFieldPhotos } from './field-photos.js';
import { JULY_LAYER, JULY_DEF, julyEvidence, validateJulyWindows } from './july-2023-review.js';
import { NORTH_BOUNDARY_LAYER, NORTH_BOUNDARY_DEF, validateNorthBoundaryChecks } from './north-boundary.js';
import {
  SE_PRIMARY_WINDOW,
  SE_CLUSTER7_WINDOW,
  SE_WINDOWS,
  SE_SENTINEL2_SCENES,
  validateSoutheastFixture,
  evaluateSoutheastMonth,
} from './southeast-inlet-review.js';
import {
  BRIDGE_BRANCH_LAYERS,
  BRIDGE_BRANCH_LAYER_IDS,
  F1_SIX_POINTS,
  F1_SIX_POINT_BOUNDS,
  CULVERT_COMPARE_BOUNDS,
  BRIDGE_CARD_IMAGERY,
  BRIDGE_CARD_EXCLUDED_SCENES,
  STRUCTURE_CROSSING_SPECS,
  checkSixPointCoverage,
  validateDiagnosticBranches,
  formatProfileDisplayName,
} from './field-crossings.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isMobileViewport = () => window.matchMedia('(max-width: 760px)').matches;
const isCompactViewport = () => window.matchMedia('(max-width: 980px)').matches;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BASEMAP_LABELS = {
  'sentinel2-2026-08-08': '2026-08-08',
  'sentinel2-2025-05-28': '2025-05-28',
  'sentinel2-2026-04-01': '2026-04-01',
  'sentinel2-2026-04-08': '2026-04-08',
  [TIMELINE_REFERENCE_SCENE.id]: TIMELINE_REFERENCE_SCENE.date,
  'LT05_L2SP_123026_19920705_02_T1': '1992-07-05 L5',
  'LT05_L2SP_123026_20070731_02_T1': '2007-07-31 L5',
  'LC08_L2SP_123026_20210721_02_T1': '2021-07-21 L8',
  'dem-relief': 'GLO-30 晕渲',
};

const state = {
  theme: 'dark',               // 'dark' | 'light' (warm-paper gallery mode)
  view3d: false,
  exag3d: 8,
  pickedDataId:null,
  basemap: 'sentinel2-2026-08-08',
  month: '2024-07',
  timelineWaterContext: false,
  eastPoolTimeline: false,
  lakeView: 'BOTH',            // 'BOTH' | 'MAIN' | 'WF1'
  compareAxis: 'same-month',   // 'same-month' | 'same-year'
  bottomTab: 'time',           // 'time' | 'profile'
  deckExpanded: false,
  studioOpen: false,
  waterwayNav:false, waterwayBranch:null, waterwayItem:null, waterwayResult:'', waterwayFeature:null,
  waterwayReturn: null,        // { branch, branchTitle, item, itemTitle, kind, actionLabel }
  focusScope: 'main',          // 'main' | 'crossings' | 'office' | 'west' | 'north' | 'east' | 'marsh'
  studioTab: 'layers',         // 'waterway' | 'crossings' | 'southeast' | 'layers' | 'evidence' | 'cases' | 'history' | 'study'
  evidenceFilter: 'ALL',
  scenePreset:'home',
  visibleLayers: setWaterwayMapLayers(new Set(PAINT_BACKGROUND_ROADS),'all'),
  selectedFeatureId: null,
  activeEvidenceId: null,
  activeProfileId: 'yimin-nearest-profile',
  profileCursorIdx: -1,
  waterMonth: null,
  monthLoadErrors: [],
  exportError: null,
  webglFallbackNotice: false,  // false | 'startup' | 'runtime'
  playing: false,
  timelineSceneSync: true,
  timelineCalendarFull:false,
  timelineImageryPriority: 'wide-google',
  timelineBasemapStatus: null,
  playbackError: null,
  southeastFixture: null,
  southeastEnabled: false,
  southeastWindow: SE_PRIMARY_WINDOW,
  southeastStepping: false,
  northBoundaryReady: 0,
  crossingStructure: 'f1_bridge',
  crossingCompare: null,
  diagnosticBranchesReady: 0,
  spokenFeatureIds: new Set(),
  spokenLakeIds: new Set(),
};

const provider = new HandoffDataProvider('../hujiernuoer-handoff-v2/');
let map2d = null;
let map3d = null;
let monthReqSeq = 0;
let monthAbortCtrl = null;
let lakeChipViews = new Map();
const profileCache = new Map();
const mapStateSent = Object.create(null);

// ==========================================================================
// Lazy-Loaded Modern Contours & Historical Map Overlays (from app-contours)
// ==========================================================================
const EMPTY_CONTOURS = Object.freeze([]);
let contoursEnabled = false;
let slopeEnabled=false,slopeDensity=5,slopeData=null,slopeRequest=null,slopeError=false;
function activeSlope(){
 return slopeEnabled?slopeData?.[String(slopeDensity)]||null:null;
}
const slopeWaterCache=new WeakMap();
function visibleSlopeAspect(lakeView){
 const field=activeSlope(), wm=guidedTour.active?null:state.waterMonth;
 if(!field||!wm||lakeView==='NONE')return field;
 let cache=slopeWaterCache.get(wm);if(!cache){cache=new Map();slopeWaterCache.set(wm,cache);}
 const key=lakeView+':'+slopeDensity;if(cache.has(key))return cache.get(key);
 const keys=lakeView==='BOTH'?['MAIN','WF1']:[lakeView];
 const geometry=keys.flatMap(k=>{
   const entry=wm.lakes?.[k];return entry&&!entry.loading&&!entry.error?(entry.water?.features||[]):[];
 }).map(f=>f.geometry).filter(Boolean).map(g=>({g,b:geometryBounds(g)})).filter(x=>x.b?.length===4);
 const masked=geometry.length?{...field,arrows:field.arrows.filter(([x,y])=>!geometry.some(({g,b})=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]&&insideSlopeWater(x,y,g)))}:field;
 cache.set(key,masked);return masked;
}
function syncSlopeControls(){
 const tier=slopeDensity;
 for(const id of ['slope-aspect-density','quick-slope-aspect-density'])if($('#'+id))$('#'+id).value=String(tier);
 for(const id of ['slope-aspect-toggle','quick-slope-aspect-toggle'])if($('#'+id))$('#'+id).checked=slopeEnabled;
 for(const id of ['slope-aspect-status','quick-slope-aspect-status']){
  const n=$('#'+id);if(n)n.textContent=!slopeEnabled?'':slopeError?'坡向未载入，关闭再打开可重试。':slopeData?('箭头约每 '+slopeData[String(tier)].spacing_m+' 米采样'):'正在载入坡向…';
 }
}
function setSlopeDensity(n){
 n=Number(n);if(![2,5,10].includes(n))return;
 slopeDensity=n;syncMapsState();syncSlopeControls();
}
function setSlopeEnabled(on){
 slopeEnabled=Boolean(on);syncMapsState();syncSlopeControls();updateActiveLayerBadge();
 if(!slopeEnabled||slopeData||slopeRequest)return;
 slopeError=false;syncSlopeControls();
 slopeRequest=fetch(new URL('./slope-aspect.json?v=87',location.href)).then(r=>{if(!r.ok)throw Error('slope load');return r.json()}).then(raw=>{
  if(raw.schema!=='hjn-local-slope-aspect/v1'||![10,5,2].every(key=>Number.isFinite(raw.densities?.[key]?.spacing_m)&&raw.densities[key].arrows?.every(v=>v.length===5&&v.every(Number.isFinite))))throw Error('slope schema');
  slopeData=raw.densities;
 }).catch(()=>{slopeError=true}).finally(()=>{slopeRequest=null;syncMapsState();syncSlopeControls()});
}
let contourInterval=CONTOUR_DEFAULT_INTERVAL;
let contourFeatures=EMPTY_CONTOURS;
const contourBaseCache=new Map(),contourViewCache=new Map(),contourLoads=new Map(),contourErrors=new Set();
const currentContourSource=()=>contourInterval===2?2:5;

function contourControlOptions(){
  return CONTOUR_CHOICES.map(n=>`<option value="${n}" ${n===contourInterval?'selected':''}>${n} 米</option>`).join('');
}
function updateContourControls(){
  for(const id of ['contour-layer-toggle','quick-contour-toggle'])if($('#'+id))$('#'+id).checked=guidedTour.active?guidedTour.contours:contoursEnabled;
  $('#walk-contour-toggle')?.setAttribute('aria-pressed',String(contoursEnabled));
  for(const id of ['contour-distance','quick-contour-distance'])if($('#'+id))$('#'+id).value=String(guidedTour.active?guidedTour.contourInterval:contourInterval);
  const on=guidedTour.active?guidedTour.contours:contoursEnabled;
  const distance=guidedTour.active?guidedTour.contourInterval:contourInterval;
  const source=distance===2?2:5;
  const list=guidedTour.active?guideContourFeatures():contourFeatures;
  const loading=contourLoads.has(source),failed=contourErrors.has(source);
  for(const id of ['contour-load-state','quick-contour-load-state','walk-contour-status']){
    const status=$('#'+id);
    if(status)status.textContent=!on?'':failed?'所选间隔未能载入；关闭再打开可重试。':loading?`正在载入 ${distance} 米等高线…`:'';
  }
  const retry=$('#contour-retry');
  if(retry)retry.hidden=!on||!failed;
  const key=$('#contour-layer-count');
  if(key)key.textContent=on&&list.length?String(list.length):'';
  const legend=$('#legend-contour-distance');
  if(legend)legend.textContent=distance+' 米等高距'+(distance===10?'':'，每 10 米加粗')+'；30 米地表模型生成，不代表测量精度。';
  syncSlopeControls();updateActiveLayerBadge();
}
function applyActiveContours(){
  const previous=contourFeatures;
  const base=contourBaseCache.get(currentContourSource());
  if(contoursEnabled&&base&&!contourViewCache.has(contourInterval))contourViewCache.set(contourInterval,contourSelection(base,contourInterval));
  contourFeatures=contoursEnabled&&base?contourViewCache.get(contourInterval):EMPTY_CONTOURS;
  if(previous!==contourFeatures){
    const oldPicked=provider.analysisById.get(state.selectedFeatureId)?.properties?.is_contour;
    for(const f of previous)provider.analysisById.delete(f.id);
    for(const f of contourFeatures)provider.analysisById.set(f.id,f);
    if(oldPicked&&!provider.analysisById.has(state.selectedFeatureId))selectFeature(null);
  }
  syncMapsState();updateContourControls();
}
function loadContours(forceSource=null){
  if(!contoursEnabled&&!forceSource)return null;
  const src=forceSource||currentContourSource();
  if(contourBaseCache.has(src)){applyActiveContours();return null;}
  if(contourLoads.has(src))return contourLoads.get(src);
  contourErrors.delete(src);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
  const ready=fetch(new URL(src===2?'./contours-2m.geojson':'./contours.geojson',location.href),{signal:ctrl.signal})
    .then(resp=>{if(!resp.ok)throw new Error('等高线读取失败');return resp.json();})
    .then(doc=>{contourBaseCache.set(src,normalizeContours(doc,src));})
    .catch(()=>contourErrors.add(src))
    .finally(()=>{
      clearTimeout(timer);contourLoads.delete(src);
      if(src===currentContourSource())applyActiveContours();
      else if(guidedTour.active){syncMapsState();updateContourControls();}
    });
  contourLoads.set(src,ready);updateContourControls();return ready;
}
function setContourInterval(n,{persist=true}={}){
  n=Number(n);if(!CONTOUR_CHOICES.includes(n))return;
  if(guidedTour.active){guidedTour.contourInterval=n;guidedTour.contours=true;applyGuideContourChoice();return;}
  contourInterval=n;
  applyActiveContours();
  if(contoursEnabled)void loadContours();
  if(persist)syncUrl();
}
function setContoursEnabled(on,{persist=true}={}){
  if(guidedTour.active){guidedTour.contours=Boolean(on);applyGuideContourChoice();return;}
  contoursEnabled=Boolean(on);
  applyActiveContours();
  if(contoursEnabled)void loadContours();
  if(persist)syncUrl();
}

const historicalLayers = Object.keys(HISTORICAL_LAYERS);
let historicalPhase = 'idle';
let historicalLoad = null;
let historicalFeatures = null;
let historicalCombinedFeatures = null;

function validateHistoricalFeatures(payload) {
  if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features) || !payload.features.length) {
    throw new Error('Invalid historical FeatureCollection');
  }
  const depthByType = { Point: 0, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };
  const ids = new Set();
  function validCoordinates(value, depth) {
    return Array.isArray(value) && (depth === 0
      ? value.length >= 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
      : value.length > 0 && value.every(part => validCoordinates(part, depth - 1)));
  }
  for (const feature of payload.features) {
    const p = feature?.properties;
    const geometry = feature?.geometry;
    if (feature?.type !== 'Feature' || !isHistoricalId(feature.id) || ids.has(feature.id) ||
        provider.analysisById.has(feature.id) || !isHistoricalLayer(p?.layer) || p.status !== 'context' ||
        typeof p.name !== 'string' || !Object.hasOwn(depthByType, geometry?.type) ||
        !validCoordinates(geometry.coordinates, depthByType[geometry.type])) {
      throw new Error('Invalid or conflicting historical feature');
    }
    ids.add(feature.id);
  }
  return payload.features;
}

function updateHistoricalControls() {
  const master = $('#historical-layer-toggle');
  const quick = $('#quick-history-toggle');
  const mask=guidedTour.active?(guidedTour.extraLayers||new Set()):state.visibleLayers;
  const count = historicalLayers.filter(layer => mask.has(layer)).length;
  if (master) {
    master.checked = count === historicalLayers.length;
    master.indeterminate = count > 0 && count < historicalLayers.length;
  }
  if (quick) {
    quick.checked = count > 0;
    quick.indeterminate = count > 0 && count < historicalLayers.length;
  }
  for (const layer of historicalLayers) {
    const checkbox = $('#historical-check-' + layer);
    if (checkbox) checkbox.checked = mask.has(layer);
    const badge = $('#historical-count-' + layer);
    if (badge && historicalFeatures) {
      badge.textContent = String(historicalFeatures.filter(f => f.properties.layer === layer).length);
    }
  }
  const message = $('#historical-load-state');
  if (message) {
    message.textContent = count === 0 ? '' : ({
      pending: '正在载入历史地图参考…',
      error: '历史图层未能载入，月度水面不受影响。',
    }[historicalPhase] || '');
  }
  const retry = $('#historical-retry');
  if (retry) retry.hidden = count === 0 || historicalPhase !== 'error';
  updateActiveLayerBadge();
}

function ensureHistoricalContext() {
  if (historicalFeatures) return Promise.resolve(true);
  if (historicalLoad) return historicalLoad;
  historicalPhase = 'pending';
  updateHistoricalControls();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  historicalLoad = fetch(new URL('./historical-context.geojson', location.href), { signal: ctrl.signal })
    .then(response => {
      if (!response.ok) throw new Error('Historical layer request failed');
      return response.json();
    })
    .then(payload => {
      const features = validateHistoricalFeatures(payload);
      historicalFeatures = features;
      historicalCombinedFeatures = [...provider.analysis.features, ...features];
      for (const feature of features) provider.analysisById.set(feature.id, feature);
      historicalPhase = 'ready';
      syncMapsState();
      return true;
    })
    .catch(() => {
      historicalPhase = 'error';
      return false;
    })
    .finally(() => {
      clearTimeout(timer);
      historicalLoad = null;
      updateHistoricalControls();
    });
  return historicalLoad;
}

function setHistoricalLayers(layers, on) {
  if(guidedTour.active){
    for(const ly of layers){if(on)guidedTour.extraLayers.add(ly);else guidedTour.extraLayers.delete(ly);}
    syncMapsState();updateHistoricalControls();if(on)void ensureHistoricalContext();return;
  }
  for (const layer of layers) {
    if (on) state.visibleLayers.add(layer);
    else state.visibleLayers.delete(layer);
  }
  const selected = provider.analysisById.get(state.selectedFeatureId);
  if (!on && isHistoricalLayer(selected?.properties?.layer) &&
      !state.visibleLayers.has(selected.properties.layer)) {
    selectFeature(null);
  } else {
    syncMapsState();
  }
  updateHistoricalControls();
  if (on) void ensureHistoricalContext();
}

// ==========================================================================
// Core Helpers, Map Sync & Camera Routing
// ==========================================================================
function is3DActive() {
  return Boolean(state.view3d && map3d && !map3d.failed);
}

let nativePickedProfiles=new Map();
function getProfileData(id,{allowSampling=false}={}) {
  if (profileCache.has(id)) return profileCache.get(id);
  const f = provider.analysisById.get(id);
  if(['owner_blue_sketch','schematic_road_uncertainty_gap'].includes(f?.properties?.feature_role))return null;
  let data = f ? extractProfileData(f) : null;
  if(!data&&nativePickedProfiles.has(id)){data=extractProfileData(nativePickedProfiles.get(id));if(data)data.sampleOrigin='archive-model-grid';}
  if(!data&&allowSampling&&isTrack(f)&&!f.properties?.is_contour){
    const reference=provider.analysisById.get('historical_sample_union_terminal')?.geometry;
    const name=({[EAST_COP]:'东池来水情景｜Copernicus 填洼路径',[EAST_AW]:'东池来水情景｜AW3D30 填洼路径','diag-branch-Cop_frozen30_raw_F1_NE_fade_local_stop_G3320_minor0':'东北窗｜Copernicus 原地表停点','diag-branch-AW3D30_sameUTM_raw_F1_NE_fade_local_stop_G3320_minor0':'东北窗｜AW3D30 原地表停点'})[id];
    const track=profileFromExactLine(name?{...f,properties:{...f.properties,name}}:f,provider.dem,reference?[reference]:[]);
    if(track){data=extractProfileData(track);if(data)data.sampleOrigin='atlas-display-dem';}
  }
  if (data) profileCache.set(id, data);
  return data;
}

function getActiveProfileCursor() {
  if (state.profileCursorIdx < 0) return null;
  const pd = getProfileData(state.activeProfileId);
  if (!pd || !pd.samples.length) return null;
  const idx = Math.max(0, Math.min(pd.samples.length - 1, state.profileCursorIdx));
  return pd.samples[idx];
}

function syncUrl() {
  if (guidedTour.active||location.protocol === 'file:') return;
  const p=new URLSearchParams(encodeAtlasUrl(state.timelineBasemapStatus?.kind==='google-earth' ? {...state,basemap:lastManualBasemap}:state));
  if(state.waterwayNav){
    p.set('panel',ROUTE_DEEP_LINK);
    if(state.waterwayBranch)p.set('branch',state.waterwayBranch);
    if(state.waterwayItem)p.set('node',state.waterwayItem);
  }
  if(['esri-online',ESRI_PUBLIC_ID].includes(p.get('bm')))p.delete('bm');
  if(fixedHistory.active?.id)p.set('hs',fixedHistory.active.id);
  if(state.timelineCalendarFull)p.set('calendar','full');
  if(state.scenePreset!=='home')p.set('view',state.scenePreset);
  if(walkMode.active ? walkMode.saved.contoursEnabled : contoursEnabled)p.set('ctr',String(contourInterval));

  const qs=p.toString();
  try {
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  } catch {
    // Ignore history.replaceState throttling (e.g. iOS Safari)
  }
}

function syncMapStage() {
  const stage = $('#map-stage');
  if (!stage) return;
  const flags = {
    viewMode: is3DActive() ? '3d' : '2d',
    waterDate: state.waterMonth?.date || '',
    waterLoading: state.waterMonth?.loading ? 'true' : 'false',
    waterErrors: String(state.monthLoadErrors.length),
  };
  for (const [key, value] of Object.entries(flags)) {
    if (stage.dataset[key] !== value) stage.dataset[key] = value;
  }
}

let waybackMemo = null;
let pendingWaybackId = null;
let last3dFeatures;
const waybackLoader = createWaybackLoader(
  async signal => {
    const response = await fetch(new URL('./wayback-context.geojson', location.href), { signal });
    if (!response.ok) throw new Error('Wayback data unavailable');
    return response.json();
  },
  payload => {
    const features = validateWayback(payload, provider.analysisById, provider.dem.bounds_wgs84);
    for (const f of features) provider.analysisById.set(f.id, f);
    return features;
  },
  () => {
    updateWaybackControls();
    if (waybackLoader.value) syncMapsState();
  }
);

function updateWaybackControls() {
  const on = Boolean(pendingWaybackId) || WAYBACK_IDS.some(id => (guidedTour.active?guidedTour.extraLayers:state.visibleLayers)?.has(id));
  const status = $('#wayback-load-state');
  if (status) status.textContent = on ? ({
    pending: '正在载入多期影像核查…',
    error: '多期影像核查图层未载入；月度水面与其他图层不受影响。',
  }[waybackLoader.phase] || '') : '';
  const retry = $('#wayback-retry');
  if (retry) retry.hidden = !on || waybackLoader.phase !== 'error';
}

const FEATURE_IDS_BY_SCOPE=Object.fromEntries(Object.entries(VIEW_SCOPES).map(([id,p])=>[id,new Set(p.featureIds)]));
let lastCustomLayers=null;
const isInScenePreset=id=>FEATURE_IDS_BY_SCOPE[state.scenePreset]?.has(id)===true;
// An explicitly selected main-lake profile temporarily takes priority over the
// comparison area's water display. Keep the underlying place, overlays and month.
function mainLakeProfileContext(){
  return state.bottomTab==='profile' && state.selectedFeatureId===state.activeProfileId &&
    provider.analysisById.get(state.activeProfileId)?.properties?.layer==='main-lake-profiles';
}
function visibleSceneProfileScope(){
  return mainLakeProfileContext() && ['east','north','west'].includes(state.scenePreset) ? 'custom' : state.scenePreset;
}
function scenePresetWater(){
  return mainLakeProfileContext() ? 'MAIN' : state.scenePreset==='home'&&state.timelineWaterContext&&!guidedTour.active ? state.lakeView : VIEW_SCOPES[state.scenePreset]?.waterMode||state.lakeView;
}
const SCOPE_DISPLAY_NAMES = Object.freeze({
  main: '主湖',
  crossings: '桥涵',
  office: '办公院',
  west: '西长湖',
  north: '北小湖',
  east: '东池',
  marsh: '东部泥沼',
});

function updateScopeBar() {
  const lbl = $('#hero-scope-label');
  const label = SCOPE_DISPLAY_NAMES[mainLakeProfileContext() ? 'main' : state.focusScope] || '主湖';
  if (lbl && lbl.textContent !== label) lbl.textContent = label;
  $$('[data-focus-scope]').forEach(btn => {
    // The place buttons retain the underlying navigation context; main here is only a profile preview.
    const active = btn.dataset.focusScope === state.focusScope;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function closeScopePopover() {
  const pop = $('#scope-popover');
  closePopover(pop, pop?.contains(document.activeElement));
}

function selectFocusScope(scope) {
  state.focusScope = scope;
  closeScopePopover();
  updateScopeBar();
  if (scope === 'main') {
    chooseScenePreset('home', { fit: false });
    fitMainLakeFirstOpen(420);
    return;
  }
  if (scope === 'crossings') {
    openCrossingsWorkspace(state.crossingStructure || 'f1_bridge', { fly: true });
    return;
  }
  if (scope === 'office') {
    state.visibleLayers.add('office-corridor');
    state.visibleLayers.add('office-flow-tests');
    updateActiveLayerBadge();
    syncMapsState();
    selectFeature('office-service', { fly: true });
    return;
  }
  if (scope === 'west' || scope === 'north' || scope === 'east') {
    chooseScenePreset(scope, { fit: true });
    return;
  }
  if (scope === 'marsh') {
    state.visibleLayers.add('marsh-review');
    updateActiveLayerBadge();
    syncMapsState();
    const marsh = provider.analysisById.get('atlas-east-marsh-review');
    if (marsh) {
      selectFeature('atlas-east-marsh-review', { fly: false });
      const b = marsh.properties?.map_fit_bbox_wgs84;
      if (b) fitActiveBounds(b, 1.25);
    }
  }
}

function chooseScenePreset(id,{fit=true,boot=false}={}){
  if(!Object.hasOwn(VIEW_SCOPES,id))return;
  stopPlay();
  const previousPreset=state.scenePreset;
  if(previousPreset==='custom'&&id!=='custom')lastCustomLayers=new Set(state.visibleLayers);
  state.timelineWaterContext=false;
  state.eastPoolTimeline=false;
  state.scenePreset=id;
  if (id === 'home') state.focusScope = 'main';
  else if (id === 'west' || id === 'north' || id === 'east') state.focusScope = id;
  if(id!=='custom'||previousPreset!=='custom'){
    if(!boot){
      if(state.bottomTab==='profile'){state.bottomTab='time';state.profileCursorIdx=-1;renderChartDeck();setDeckExpanded(false);}
      selectFeature(null);
    }
    state.visibleLayers=new Set(id==='custom'&&lastCustomLayers?lastCustomLayers:PAINT_BACKGROUND_ROADS);
    if(id==='home')state.visibleLayers=setWaterwayMapLayers(state.visibleLayers,'all');
    state.visibleLayers.add('secondary-roads');
    state.visibleLayers.add(OWNER75_LAYER);
  }
  if(boot)return;
  if(state.studioOpen)closeStudioDrawer();
  updateScopeBar();
  updateActiveLayerBadge();syncMapsState();syncUrl();
  if(!fit)return;
  const selected=VIEW_SCOPES[id].featureIds.map(fid=>provider.analysisById.get(fid)).filter(Boolean);
  if(id==='home'||id==='west')fitActiveBounds(provider.waterIndex.lakes[id==='home'?'MAIN':'WF1'].bounds_wgs84,id==='home'?1.95:1.75);
  else if(selected[0])fitActiveBounds(geometryBounds(selected[0].geometry),1.85);
  else fitActiveBounds(AOI_BOUNDS,1.06);
}
function setMapLakeScope(id){
  state.lakeView=id;
  state.scenePreset='custom';
}
function optionalAnalysisFeatures(mask=state.visibleLayers) {
  const base = historicalCombinedFeatures && historicalLayers.some(id => mask.has(id))
    ? historicalCombinedFeatures : provider.analysis?.features;
  const source = waybackLoader.value;
  if (!base || !source || !WAYBACK_IDS.some(id => mask.has(id))) return [base, base];
  if (waybackMemo?.base !== base) {
    waybackMemo = { base, list: [[...base, ...source], [...base, ...source.filter(f => !isWayback2dOnly(f))]] };
  }
  return waybackMemo.list;
}

function applyTheme(theme, { persist = true } = {}) {
  const next = theme === 'light' ? 'light' : 'dark';
  state.theme = next;
  document.documentElement.dataset.theme = next;
  const btn = $('#btn-theme-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(next === 'light'));
    btn.title = next === 'light' ? '切回深色观测仪模式' : '切换暖灰纸感展厅浅色模式';
  }
  const ico = $('#theme-toggle-ico');
  const lbl = $('#theme-toggle-lbl');
  if (ico) ico.textContent = next === 'light' ? '☾' : '◐';
  if (lbl) lbl.textContent = next === 'light' ? '暗仪' : '展厅';
  $$('[data-set-theme]').forEach(el => {
    const on = el.dataset.setTheme === next;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  if (persist) {
    try { localStorage.setItem('hujiernuoer-atlas-theme', next); } catch {}
  }
  syncMapsState();
}

// Share a stable overlay payload between map syncs. UI readers still receive
// the complete evidence snapshot even when that layer isn't drawn.
let southeastSnapshotMemo=null;
function getActiveSoutheastSnapshot() {
  const {southeastFixture:fixture,southeastWindow:win,month:date,southeastEnabled:enabled}=state;
  if(!fixture){southeastSnapshotMemo=null;return null;}
  const row=provider.waterIndex?.lakes?.MAIN?.months?.[date]||null;
  const entry=state.waterMonth?.lakes?.MAIN||null;
  const old=southeastSnapshotMemo;
  if(old&&old.fixture===fixture&&old.win===win&&old.date===date&&old.row===row&&old.entry===entry&&old.enabled===enabled)return old.value;
  const value={...evaluateSoutheastMonth(fixture,win,date,entry,row),enabled};
  southeastSnapshotMemo={fixture,win,date,row,entry,enabled,value};
  return value;
}

const OWNER75_LAYER='owner-water-network-v75';
const GUIDE_MAP_NO_FEATURES=Object.freeze([]);
const visualClipCache=new WeakMap();
const terrainFootprintCache=new WeakMap();
// The source model extends west of the draped image and usable DEM. Clip its
// presentation only; keep the source polygon and all areas/analysis unchanged.
function guideTerrainFeatures(features,dem){
 if(!guidedTour.active||!dem?.bounds_wgs84||!features?.length)return features;
 let cache=terrainFootprintCache.get(dem);
 if(!cache){cache=new WeakMap();terrainFootprintCache.set(dem,cache);}
 if(cache.has(features))return cache.get(features);
 const [w,s,e,n]=dem.bounds_wgs84;
 const edges=[[0,w,1],[0,e,-1],[1,s,1],[1,n,-1]];
 const clipRing=ring=>{
   let points=ring.slice(0,-1);
   for(const [axis,edge,sign] of edges){
     const next=[];
     let a=points.at(-1);
     for(const b of points){
       const inside=p=>(p[axis]-edge)*sign>=0;
       if(inside(a)!==inside(b)){
         const t=(edge-a[axis])/(b[axis]-a[axis]), p=a.map((v,i)=>i===axis?edge:v+(b[i]-v)*t);
         next.push(p);
       }
       if(inside(b))next.push(b);
       a=b;
     }
     points=next;
   }
   return points.length>=3?[...points,points[0]]:null;
 };
 let changed=false;
 const result=features.flatMap(f=>{
   if(f.properties?.layer!==NW_NETWORK||f.properties.group!=='up'||!f.geometry.type.includes('Polygon'))return [f];
   const multi=f.geometry.type==='MultiPolygon', polys=multi?f.geometry.coordinates:[f.geometry.coordinates];
   if(polys.every(poly=>poly.every(ring=>ring.every(([x,y])=>x>=w&&x<=e&&y>=s&&y<=n))))return [f];
   changed=true;
   const visible=polys.flatMap(([outer,...holes])=>{
     const r=clipRing(outer);
     return r?[[r,...holes.map(clipRing).filter(Boolean)]]:[];
   });
   const {bbox,...feature}=f;
   return visible.length?[{...feature,geometry:{...f.geometry,coordinates:multi?visible:visible[0]}}]:[];
 });
 const out=changed?result:features;
 cache.set(features,out);
 return out;
}
function visualClipGeometry(id,fallback){
 return Object.hasOwn(displayClip,id)?displayClip[id]:fallback;
}
function visualClipFeatures(features){
 if(!features?.length)return features;
 if(visualClipCache.has(features))return visualClipCache.get(features);
 let changed=false;
 const result=features.flatMap(f=>{
  const g=visualClipGeometry(f.id??f.properties?.id,f.geometry);
  if(g===f.geometry)return [f];
  changed=true;
  if(!g)return [];
  const {bbox,...safe}=f;
  return [{...safe,geometry:g}];
 });
 const out=changed?result:features;
 visualClipCache.set(features,out);
 return out;
}
function privatePathParts(id,coords){
 const g=visualClipGeometry(id,{type:'LineString',coordinates:coords});
 if(!g)return [];
 if(g.type==='LineString')return [g.coordinates];
 if(g.type==='MultiLineString')return g.coordinates;
 if(g.type==='Polygon')return g.coordinates.slice(0,1);
 if(g.type==='MultiPolygon')return g.coordinates.map(x=>x[0]);
 return [];
}
const NW_NETWORK='catchment-screen-nw-network';
const NW_FULL=new Set(['runoff-main-entrance-context','lake-office-caution']);
const NW_UP=new Set(['runoff-upper-slope','runoff-west','runoff-bridge','runoff-cross-gap','runoff-east','runoff-bend-gap','runoff-se']);
const NW_ROAD=new Set(['runoff-apron-gap','kmz-north-to-crossings','road-nw-gully']);
const NW_EAST=new Set(['kmz-outer-options','east-marsh-source','east-pool-source','east-connection-check']);
const NW_REACHES=new Set([...NW_FULL,...NW_UP,...NW_ROAD,...NW_EAST]);
const GUIDE_FOCUSED_STOPS=new Set(['road-nw-gully','east-marsh-source','east-pool-source','east-connection-check','road-b-southeast','road-c-south-central','road-round','lake-west']);
const GUIDE_LAYER_RELEASE=Object.freeze({
 'entry_cluster_7':'road-b-southeast','main-profile-southeast-inlet':'road-b-southeast','model_b_southeast':'road-b-southeast',
 'entry_cluster_5':'road-c-south-central','main-profile-south-central-inlet':'road-c-south-central','model_c_south_central':'road-c-south-central',
 'entry_cluster_4':'lake-west','main-profile-west-inlet':'lake-west','archive-route-wcross2':'lake-west','model area label anchor':'lake-office-caution',
 'hjn-seasonal-wf1-aw':'runoff-main-entrance-context','hjn-seasonal-wf1-cop':'runoff-main-entrance-context','guide-wf1':'runoff-main-entrance-context',
 'f1-ge-imagefirst-marsh-west-gap':'east-marsh-source','east-guide-marsh-cross-section':'east-marsh-source','east-guide-texture-end':'east-marsh-source',
 'f1-ge-imagefirst-marsh-to-pond-gap':'east-connection-check',
 'wcross2-west-extension-approach':'road-round','hjn-seasonal-round-model':'road-round'
});
let nwNetworkFeatures=[];
const nwSubsets=new Map(), nwFiltered=new WeakMap();
const NW_FIELD_PIN=/^hjn-03-road-pin-0([1-4])$/;
const NW_EAST_MARSH='east-guide-marsh-pin',NW_EAST_POOL='east-guide-pool-pin';
function guideSpokenSeconds(){
 const t=guidedTour;
 return t.voice&&!t.audioFailed&&$('#guided-tour-voice').checked?t.voice.currentTime:t.elapsed;
}
function guideVisitStage(step,id){
 const book=guidedTour.book.flatMap(r=>r.steps);
 const here=book.findIndex(s=>s.id===step?.id), target=book.findIndex(s=>s.id===id);
 return here<0||target<0?-1:Math.sign(here-target);
}
function guideFourProgress(step){
 const stage=guideVisitStage(step,'road-nw-gully');
 if(stage!==0)return {count:stage>0?4:0,ids:stage>0?[1,2,3,4]:[],active:0};
 const sec=guideSpokenSeconds(), seen=(step.detail?.spokenPoints||[]).filter(q=>q.start<=sec);
 const ids=seen.map(q=>q.point).filter(Boolean);
 return {count:ids.length,ids,active:seen.at(-1)?.point||0};
}
function guideRevealSite(step,id){
 if(step.id==='chapter-opening'&&step===guideStep()){
   const ids=guideOpeningCue(step)?.anchorIds||[];
   if(NW_FIELD_PIN.test(id))return openingPinNumbers(guideOpeningCue(step)).includes(Number(id.slice(-2)));
   if([NW_EAST_MARSH,'f1-east-marsh-field-review'].includes(id))return ids.includes(NW_EAST_MARSH);
   if([NW_EAST_POOL,'f1-east-pool-shore-ref'].includes(id))return ids.includes(NW_EAST_POOL);
   if(['main-profile-southeast-inlet','main-profile-south-central-inlet'].includes(id))return ids.includes(id);
   if(['wcross2-west-extension-approach','hjn-seasonal-round-model'].includes(id))return ids.includes('hjn-seasonal-round-gap');
 }
 const narratedOnApproach={
   'road-c-approach':['main-profile-south-central-inlet'],
   'road-round-approach':['main-profile-south-central-inlet','wcross2-west-extension-approach','hjn-seasonal-round-model']
 };
 if(narratedOnApproach[step.id]?.includes(id))return true;
 const pin=NW_FIELD_PIN.exec(id);
 if(pin)return step.id==='kmz-north-to-crossings'?[1,3].includes(Number(pin[1])):guideFourProgress(step).ids.includes(Number(pin[1]));
 if(id==='guide-03')return step.id==='kmz-north-to-crossings'||(step.id==='chapter-opening'?guideOpeningCue(step)?.anchorIds?.some(x=>NW_FIELD_PIN.test(x))===true:guideFourProgress(step).count>0);
 if([NW_EAST_MARSH,'f1-east-marsh-field-review'].includes(id))return guideVisitStage(step,'east-marsh-source')>=0;
 if([NW_EAST_POOL,'f1-east-pool-shore-ref',EAST_COP,EAST_AW].includes(id))return guideVisitStage(step,'east-pool-source')>=0;
 if(id?.startsWith('owner-05-'))return ['runoff-field-bands-05','runoff-apron-gap','kmz-north-to-crossings'].includes(step.id);
 if(Object.hasOwn(GUIDE_LAYER_RELEASE,id))return guideVisitStage(step,GUIDE_LAYER_RELEASE[id])>=0;
 return true;
}
function nwForGuide(step){
 const id=step?.id, choice=activeCatchmentScreen(guidedTour.extraLayers);
 if(!id||choice&&choice!==NW_NETWORK)return GUIDE_MAP_NO_FEATURES;
 if(!nwSubsets.has(id))nwSubsets.set(id,nwNetworkFeatures.filter(f=>{
   const {original_source:source,group}=f.properties;
   if(!guideRevealSite(step,source))return false;
   if(GUIDE_FOCUSED_STOPS.has(id)){
     if(group==='east')return id.startsWith('east-')&&f.geometry.type.includes('Polygon');
     if(group==='overlap')return id==='lake-west';
     return false;
   }
   // Ribbon paths and named markers are already drawn by the guide; this list supplies fills only.
   if(group==='up'&&f.geometry.type.includes('Polygon'))return guideVisitStage(step,'runoff-upper-slope')>=0;
   if(group==='east'&&f.geometry.type.includes('Polygon'))return true;
   if(group==='lake')return guideVisitStage(step,GUIDE_LAYER_RELEASE[source])>0;
   if(group==='overlap')return guideVisitStage(step,'lake-west')>=0;
   return false;
 }));
 return nwSubsets.get(id);
}
function nwGuideList(base,network){
 if(!base?.length||base===network)return network;
 let cache=nwFiltered.get(base);
 if(!cache){cache=new WeakMap();nwFiltered.set(base,cache);}
 if(!cache.has(network)){
  const existing=new Set(base.map(f=>f.id)), wanted=new Set(network.map(f=>f.id));
  cache.set(network,[...base.filter(f=>f.properties?.layer!==NW_NETWORK||wanted.has(f.id)),...network.filter(f=>!existing.has(f.id))]);
 }
 return cache.get(network);
}
function nwNetworkBounds(){
 if(!nwNetworkFeatures.length)return null;
 return nwNetworkFeatures.reduce((b,f)=>{
  const g=geometryBounds(f.geometry);
  return g?[Math.min(b[0],g[0]),Math.min(b[1],g[1]),Math.max(b[2],g[2]),Math.max(b[3],g[3])]:b;
 },[Infinity,Infinity,-Infinity,-Infinity]);
}
function nwNetworkLegend(){
 return '<ul class="nw-network-key"><li><b>桥西上游：</b>灰蓝面是两处候选范围，未合并。</li><li><b>桥后线索：</b>01–04 与主湖西北岸、东侧泥沼与东池、西长湖（独立候选）。青绿实线是可辨沟形，琥珀虚线是原标绘，紫虚线是条件推演，缺口留空。</li><li><b>主湖分区：</b>金色面保留 E18、南中 C、东南 B。白色点线为与 E18 叠置的沟段；E18 边界和面积不变。</li></ul>';
}
const CATCHMENT_SCREEN = new Map([
 [NW_NETWORK,['西北沟壑、中桥下游与主湖分区 · 同屏总览','查看上游、中桥和三条下游线索，同时保留主湖三个原分区。']],
 ['catchment-screen-nw-overview',['西北沟壑与中桥西侧 · 上游范围','显示外坡大沟壑和中桥西侧两个候选汇水面，分别止于桥西的观察断面。仅显示两套 30 米地形、各三处断面共同支持的范围，未合并成一个过桥流域。']],
 ['catchment-screen-nw',['西北坡 · 原地表局部对照','各个西北坡观察点是独立终点，不能相加。桥西近岸没有双模型共同命中的上游格，图上不画跨桥连线。']],
 ['catchment-screen-raw',['东侧 · 原地表双模型','东池共同命中的陆侧来水候选仅 20 格（0.018 km²），不含东池终点本身。']],
 ['catchment-screen-east-only',['东池 · 不单列泥沼拦蓄','只把东池作为东侧收水终点，两套地形模型重合 7.8759 km²。计算中让局部低点达到可外溢的高程，不是填土、开挖或施工方案。']],
 ['catchment-screen-compete',['东池与泥沼 · 分开收水','把东池和三处泥沼分别作为收水终点，水在模型里到先遇到的终点就停止追踪。重新计算后东池重合 1.0386 km²。这是终点设定带来的差异，不是实测分流。']]
]);
function activeCatchmentScreen(mask){
 return [...CATCHMENT_SCREEN.keys()].find(k=>mask?.has(k))||'';
}
function effectiveCatchmentLayers(mask){
 if(!activeCatchmentScreen(mask)||!mask.has('main-catchments'))return mask;
 const result=new Set(mask);result.delete('main-catchments');return result;
}
const withoutMainPartitionCache=new WeakMap();
function withoutMainPartition(features){
 if(!features)return features;
 if(!withoutMainPartitionCache.has(features))withoutMainPartitionCache.set(features,features.filter(f=>f.properties?.layer!=='main-catchments'));
 return withoutMainPartitionCache.get(features);
}
function currentGuideCatchment(step=guideStep()){
 const selected=activeCatchmentScreen(guidedTour.extraLayers);
 return selected&&selected!==NW_NETWORK?null:GUIDE_CATCHMENTS[step?.id]||null;
}
const SCREEN_REACHES = new Set([...NW_REACHES,'runoff-upper-slope','east-pool-source','east-marsh-source','east-connection-check','runoff-east','runoff-bridge','road-b-southeast','road-c-south-central','lake-west']);
function renderCatchmentScreen(host,mask,compact=false){
 if(!host)return;
 const present=provider.analysis?.features.some(f=>CATCHMENT_SCREEN.has(f.properties?.layer));
 host.hidden=!present;
 if(!present)return;
 const active=activeCatchmentScreen(mask);
 const activeInfo=CATCHMENT_SCREEN.get(active);
 const station=compact?guideStep()?.id:null;
 const showLegend=active===NW_NETWORK||(!active&&NW_FULL.has(station));
 const dockKey=active+':'+(station||'');
 if(host.dataset.catchmentChoice===dockKey&&host.catchmentMask===mask&&host.querySelector('select'))return;
 host.catchmentMask=mask;
 host.dataset.catchmentChoice=dockKey;
 host.innerHTML=`<label class="card-note" style="display:flex;gap:.45rem;align-items:baseline;flex-wrap:wrap">候选汇水试算 <select aria-label="候选汇水试算" data-catchment-screen><option value="">关闭</option>${[...CATCHMENT_SCREEN].map(([k,[label]])=>`<option value="${k}" ${k===active?'selected':''}>${label}</option>`).join('')}</select></label>${activeInfo||!compact?`<p class="card-note">${activeInfo?.[1]||'切换西北坡、东池和东部泥沼的 30 米地形对照。'} ${compact||active===NW_NETWORK?'':'单项试算开启时暂隐主湖分区；关闭即恢复。未指定涵洞通行。'}</p>`:''}`;
 const select=host.querySelector('select');
 if(compact)select.options[0].textContent='随站点显示';
 const fit=()=>{const b=nwNetworkBounds();if(b)fitActiveBounds(b,1.25);};
 if(showLegend){
  host.insertAdjacentHTML('beforeend',compact?'<details class="nw-guide-key"><summary>图例 · 随导览逐段显示</summary><p>青绿实线是可辨沟形，紫色是模型，金色面是已讲到的主湖分区。未讲到的水带与范围先隐藏。</p></details>':nwNetworkLegend());
  if(!compact){
   const button=document.createElement('button');button.type='button';button.textContent='定位全图';button.addEventListener('click',fit);host.append(button);
  }
 }
 select.onchange=e=>{
   const k=e.target.value;for(const id of CATCHMENT_SCREEN.keys())mask.delete(id);
   if(CATCHMENT_SCREEN.has(k))mask.add(k);
   renderCatchmentScreen(host,mask,compact);
   host.querySelector('select').focus({preventScroll:true});
   updateActiveLayerBadge();syncMapsState();
   if(guidedTour.active){readTourHUD();prepareGuideNavMap();}else if(k===NW_NETWORK){fit();}
 };
}
const GUIDE_FOCUS_AREAS=Object.freeze({
 'east-marsh-source':['nw96-marsh'],'east-pool-source':['nw96-east-pool'],
 'east-connection-check':['nw96-marsh','nw96-east-pool']
});
const GUIDE_FOCUS_LABEL=Object.freeze({
 'road-b-southeast':['nw96-label-7','东南 B'],
 'road-c-south-central':['nw96-label-5','南中 C'],
 'lake-west':['nw96-label-4','西侧 E18'],
});
const GUIDE_CATCHMENTS=Object.freeze({
  'road-b-southeast':'entry_cluster_7',
  'road-c-south-central':'entry_cluster_5',
  'lake-west':'entry_cluster_4',
});
function guideCatchmentFeature(step){
  const id=currentGuideCatchment(step);
  if(!id)return null;
  const f=provider.analysisById.get(id);
  return f ? visualClipFeatures([f])[0] : null;
}
function guideCatchmentPolys(step){
  const g=guideCatchmentFeature(step)?.geometry;
  return g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
}
let guideCatchmentCache={base:null,id:null,list:null};
const eastMonthlyFeatureLists=new WeakMap();
function withEastMonthlyFeature(base,f){
 let row=eastMonthlyFeatureLists.get(base);
 if(!row||row.id!==f.id){row={id:f.id,list:[...base,f]};eastMonthlyFeatureLists.set(base,row);}
 return row.list;
}
function showsEastPoolTimeline(){
 return !guidedTour.active&&state.eastPoolTimeline&&(state.scenePreset==='home'||state.scenePreset==='east'||state.visibleLayers.has('nearby-pools'));
}
function syncMapsState() {
  state.visibleLayers.add('secondary-roads');
  const manualGuide=guidedTour.active&&guidedTour.extraLayers?.size;
  let [features2d, features3d] = guidedTour.active&&!manualGuide?[GUIDE_MAP_NO_FEATURES,GUIDE_MAP_NO_FEATURES]:optionalAnalysisFeatures(guidedTour.active?guidedTour.extraLayers:state.visibleLayers);
  if(activeCatchmentScreen(guidedTour.active?guidedTour.extraLayers:state.visibleLayers)){
    features2d=withoutMainPartition(features2d);
    features3d=withoutMainPartition(features3d);
  }
  const guideNetwork=guidedTour.active?nwForGuide(guideStep()):GUIDE_MAP_NO_FEATURES;
  if(guidedTour.active){features2d=nwGuideList(features2d,guideNetwork);features3d=nwGuideList(features3d,guideNetwork);}
  const catchmentId=guidedTour.active?currentGuideCatchment():null;
  if(catchmentId){
    if(guideCatchmentCache.base!==features3d||guideCatchmentCache.id!==catchmentId){
      const f=provider.analysisById.get(catchmentId);
      guideCatchmentCache={base:features3d,id:catchmentId,list:!f||features3d.some(x=>x.id===catchmentId)?features3d:[...features3d,f]};
    }
    features3d=guideCatchmentCache.list;
  }
  let sceneIds = FEATURE_IDS_BY_SCOPE[visibleSceneProfileScope()];
  const eastFrame=showsEastPoolTimeline()?eastPoolTimelineFrame(state.month,provider.analysisById,EAST_POOL_TIMELINE):null;
  if(eastFrame?.feature){
    const f=eastFrame.feature;
    sceneIds=new Set([...(sceneIds||[]),f.id]);
    features2d=withEastMonthlyFeature(features2d,f);
    features3d=withEastMonthlyFeature(features3d,f);
  }
  const scopeLabel = SCOPE_DISPLAY_NAMES[mainLakeProfileContext() ? 'main' : state.focusScope] || '主湖';
  const scopeLabelEl = $('#hero-scope-label');
  if (scopeLabelEl && scopeLabelEl.textContent !== scopeLabel) scopeLabelEl.textContent = scopeLabel;
  const next = {
    theme: state.theme,
    basemap: fixedHistory.active?.id || state.basemap,
    waterMonth: guidedTour.active ? null : state.waterMonth,
    lakeView: scenePresetWater(),
    scopeFeatureIds:guidedTour.active?new Set():sceneIds,
    hiddenFeatureIds:new Set([...hiddenWaterwayAliases(state.visibleLayers,provider.analysisById,state.selectedFeatureId,{scope:sceneIds,spoken:state.spokenFeatureIds}),...(eastFrame?.hiddenIds||[])]),
    selectedFeatureId: guidedTour.active ? null : state.selectedFeatureId,
    profileHighlightId:!guidedTour.active&&state.bottomTab==='profile'&&state.selectedFeatureId===state.activeProfileId?state.activeProfileId:null,
    profileCursor: !guidedTour.active?getActiveProfileCursor():($('#observatory').classList.contains('v74-tour-profile-open')&&guidedTour.v74ProfileInteracted&&Number.isFinite(getActiveProfileCursor()?.glo30_m)?getActiveProfileCursor():null),
    southeastInspection: state.southeastEnabled ? getActiveSoutheastSnapshot() : null,
    crossingCompare: state.crossingCompare,
    analysisFeatures: visualClipFeatures(features2d),
    contourFeatures:visualClipFeatures(guidedTour.active?guideContourFeatures():contourFeatures),
    contourInterval:guidedTour.active?guidedTour.contourInterval:contourInterval,
    slopeAspect:visibleSlopeAspect(scenePresetWater()),
    guidedTerrain:guidedTour.active,
  };
  const sameSetVal = (a, b) => a && b && a.size === b.size && [...a].every(id => b.has(id));
  let displayedLayers=effectiveCatchmentLayers(guidedTour.active?(guidedTour.extraLayers||new Set()):state.visibleLayers);
  if(guideNetwork.length&&!displayedLayers.has(NW_NETWORK))displayedLayers=new Set([...displayedLayers,NW_NETWORK]);
  if(!guidedTour.active&&displayedLayers.has(NW_NETWORK))for(const f of nwNetworkFeatures)next.hiddenFeatureIds.add(f.properties.original_source);
  if (!sameSetVal(mapStateSent.visibleLayers, displayedLayers)) {
    next.visibleLayers = new Set(displayedLayers);
  }
  const speakFeatures=guidedTour.active?new Set(catchmentId?[catchmentId]:[]):state.spokenFeatureIds;
  const speakLakes=guidedTour.active?new Set():state.spokenLakeIds;
  if (!sameSetVal(mapStateSent.spokenFeatureIds, speakFeatures)) next.spokenFeatureIds=new Set(speakFeatures);
  if (!sameSetVal(mapStateSent.spokenLakeIds, speakLakes)) next.spokenLakeIds=new Set(speakLakes);
  if (mapStateSent.selectedFeatureId !== next.selectedFeatureId) {
    const selected = next.selectedFeatureId ? provider.analysisById.get(next.selectedFeatureId) : null;
    next.relatedFeatureIds = new Set(selected?.properties?.related_ids || []);
  }
  const patch = {};
  for (const [key, value] of Object.entries(next)) {
    if (mapStateSent[key] !== value) patch[key] = value;
  }
  if (Object.keys(patch).length) {
    map2d?.setState(patch);
    Object.assign(mapStateSent, patch);
  }
  const { analysisFeatures: _2d, ...patch3d } = patch;
  const terrainFeatures=guideTerrainFeatures(visualClipFeatures(features3d),provider.dem);
  if (last3dFeatures !== terrainFeatures) {
    patch3d.analysisFeatures = terrainFeatures;
    last3dFeatures = terrainFeatures;
  }
  if (Object.keys(patch3d).length) map3d?.setState(patch3d);
  document.querySelector('#observatory')?.setAttribute('data-view-preset',state.scenePreset);
  syncMapStage();
  updateWalkLayerNote();
  syncPublicEsriDetail();
}

function resizeActiveMap() {
  (is3DActive() ? map3d : map2d)?.resize();
}

function flyActiveMap(focus, duration) {
  if (is3DActive()) map3d.flyTo({ ...focus, duration });
  else map2d?.flyTo({ ...focus, duration });
}

function fitActiveBounds(bounds, pad = 1.2) {
  if (!bounds) return;
  if (!is3DActive() && map2d) {
    map2d.fitBounds(bounds, pad);
    return;
  }
  const [w, s, e, n] = bounds;
  const lon = (w + e) * 0.5;
  const lat = (s + n) * 0.5;
  const dxKm = Math.max(0.35, (e - w) * 72.8);
  const dyKm = Math.max(0.35, (n - s) * 111.32);
  flyActiveMap({ lon, lat, spanKm: Math.max(dxKm, dyKm) * pad });
}

// First-open portrait-aware framing: centers Main Lake cleanly in the unobstructed
// window between top header and collapsed bottom deck. Never overrides URL deep-links
// or user-adjusted camera positions.
function fitMainLakeFirstOpen(duration = 0) {
  const bounds = provider.waterIndex?.lakes?.MAIN?.bounds_wgs84;
  if (!bounds) return;
  if (is3DActive() || !map2d) {
    fitActiveBounds(bounds, 1.85);
    return;
  }
  updateLayoutOffsets();
  const canvas = $('#map-2d-canvas');
  const c = canvas?.getBoundingClientRect();
  if (!c?.width || !c?.height) {
    map2d.fitBounds(bounds, 1.95, duration);
    return;
  }
  const mobile = isMobileViewport();
  const tl = $('#hud-top-left')?.getBoundingClientRect();
  const deck = $('#chart-deck')?.getBoundingClientRect();
  const top = Math.max(12, Math.min(c.height * 0.34, (tl?.bottom ?? (mobile ? 80 : 124)) - c.top + 8));
  const bottom = Math.max(top + 120, Math.min(c.height - 14, (deck?.top ?? c.bottom) - c.top - 10));
  const left = mobile ? 10 : 28;
  const right = Math.max(left + 120, c.width - (mobile ? 46 : 64));
  const isPortrait = (bottom - top) > (right - left) * 1.05;
  const pad = isPortrait ? 1.24 : 1.92;
  map2d.fitBounds(bounds, pad, duration, { left, top, right, bottom });
}

// Fit exact geometries into the unobstructed map after drawers and charts settle.
let usableFitSequence=0;
function usableMapRect(){
  const canvas=is3DActive()?$('#map-3d-stage canvas'):$('#map-2d-canvas');
  const c=canvas?.getBoundingClientRect();
  if(!c?.width||!c?.height)return null;
  const mobile=isMobileViewport(), deck=$('#chart-deck')?.getBoundingClientRect();
  const top=Math.max(10,(mobile?105:80)-c.top);
  const bottom=Math.max(top+80,Math.min(c.height-12,(deck?.top??c.bottom)-c.top-14));
  return {left:mobile?11:35,top,right:c.width-(mobile?47:79),bottom};
}
function fitVisibleObjects(features,stillCurrent=()=>true){
  const id=++usableFitSequence;
  const lines=features.flatMap(f=>f?.geometry?.type==='LineString'?[f.geometry.coordinates]:
      f?.geometry?.type==='MultiLineString'?f.geometry.coordinates:[]);
  const pts=lines.flat();
  if(pts.length<2)return;
  // Project all real vertices, retaining independent line segments.
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];
  for(const [x,y] of pts){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
  window.setTimeout(()=>{
    if(id!==usableFitSequence||!stillCurrent())return;
    const rect=usableMapRect();
    if(!rect)return;
    if(is3DActive())map3d.fitVisibleTracks(pts,rect);
    else map2d?.fitBounds(bounds,1.13,undefined,rect);
  },330);
}
function locateWcrossLayer(ly){
  const roles=new Set(ly===WCROSS_FAR_LAYER?['alternative_dsm_approach']:['terrain_only_approach']);
  const features=(state.wcrossUpstream||[]).filter(f=>f.properties?.layer===ly&&roles.has(f.properties?.feature_role));
  if(!features.length)return;
  if(state.studioOpen)closeStudioDrawer();
  hideInspectorSurface();
  if(state.deckExpanded)setDeckExpanded(false);
  fitVisibleObjects(features,()=>state.visibleLayers.has(ly));
}
function openLinkedProfile(id,{sample=null}={}){
 if(guidedTour.active){if(guidedTour.v74Profile!==id)v74SelectProfile(id);return true;}
  const pd=getProfileData(id,{allowSampling:true});
  const feature=provider.analysisById.get(id);
  if(!pd||!feature)return false;
  stopPlay(); // The time-strip Play/Pause control is no longer available here.
  if(state.studioOpen)closeStudioDrawer();
  if(state.view3d&&isWayback2dOnly(feature))setDimension('2d');
  state.bottomTab='profile';
  setProfileSample(id,sample??pd.zeroSampleIdx??0,{selectProfileFeature:true});
  setDeckExpanded(true);
  hideInspectorSurface();
  renderWaterwayReturnPill();
  fitVisibleObjects([feature],()=>state.bottomTab==='profile'&&state.activeProfileId===id&&(state.visibleLayers.has(feature.properties?.layer)||isInScenePreset(id)));
  return true;
}

// Frame crossing comparison bounds cleanly inside the visible map area between
// open desktop drawers (so F1 bridge & culvert camera points never hide behind the left studio drawer).
function fitCrossingBounds(bounds, pad = 1.14) {
  if (!bounds) return;
  if (isCompactViewport()) {
    fitActiveBounds(bounds, pad);
    return;
  }
  const [w, s, e, n] = bounds;
  const vw = Math.max(640, window.innerWidth || 1440);
  const vh = Math.max(500, window.innerHeight || 900);
  const leftPx = state.studioOpen ? (($('#studio-drawer')?.offsetWidth || 360) + 28) : 24;
  const inspOpen = Boolean(state.selectedFeatureId && !$('#inspector-drawer')?.hidden);
  const rightPx = vw - (inspOpen ? (($('#inspector-drawer')?.offsetWidth || 344) + 84) : 74);
  const visW = Math.max(320, rightPx - leftPx);
  const topPx = 112;
  const botPx = vh - 110;
  const visH = Math.max(280, botPx - topPx);

  const dLon = Math.max(0.004, (e - w) * pad);
  const dLat = Math.max(0.003, (n - s) * pad);
  const fullLon = dLon * (vw / visW);
  const fullLat = dLat * (vh / visH);
  const shiftX = ((leftPx + rightPx) * 0.5 - vw * 0.5) / visW;
  const shiftY = ((topPx + botPx) * 0.5 - vh * 0.5) / visH;
  const cLon = (w + e) * 0.5 - shiftX * dLon;
  const cLat = (s + n) * 0.5 + shiftY * dLat;
  fitActiveBounds([cLon - fullLon * 0.5, cLat - fullLat * 0.5, cLon + fullLon * 0.5, cLat + fullLat * 0.5], 1.0);
}

function setCompassAngle(deg) {
  const svg = $('#compass-svg');
  if (svg) svg.style.transform = `rotate(${deg.toFixed(1)}deg)`;
}

function updateActiveLayerBadge() {
  const el = $('#active-layer-badge');
  if (!el) return;
  const n = guidedTour.active ? 1+(guidedTour.extraLayers?.size||0)+(guidedTour.contours?1:0)+(slopeEnabled?1:0) : state.visibleLayers.size+(contoursEnabled?1:0)+(slopeEnabled?1:0);
  el.textContent = String(n);
}

let timelineScenes = [];
const fixedHistory={wanted:false,active:null,scenes:null,request:0,loading:null};
let registeredImagery={};
const recentFixedImageUrls=[];

async function fixedHistoryInventory(){
  if(fixedHistory.scenes)return fixedHistory.scenes;
  fixedHistory.loading ??= fetch(new URL('./google-earth-history.json',location.href),{signal:AbortSignal.timeout?.(4500)})
    .then(r=>{if(!r.ok)throw new Error('本机历史影像清单未载入');return r.json();})
    .then(doc=>Array.isArray(doc.scenes)&&!doc.scenes.length?[]:validateFixedHistory(doc,provider.terrainManifest?.bounds_wgs84,registeredImagery));
  try {return fixedHistory.scenes=await fixedHistory.loading;}
  finally {fixedHistory.loading=null;}
}

function registerFixedImage(r){
  if(!Object.hasOwn(registeredImagery,r.id)){
    registeredImagery={...registeredImagery,[r.id]:r};
    map2d?.setState({imageryById:registeredImagery});
    map3d?.setState({imageryById:registeredImagery});
  }
  // Bound memory for large local historical rasters; leave current imagery alone.
  const recent=recentFixedImageUrls.indexOf(r.url);
  if(recent>=0)recentFixedImageUrls.splice(recent,1);
  recentFixedImageUrls.push(r.url);
  while(recentFixedImageUrls.length>2){
    const expired=recentFixedImageUrls.shift();
    map2d?.evictFixedImage(expired);
    map3d?.evictFixedImage(expired);
  }
}

const historicalFlags={cloud:'有云', 'heavy-cloud':'云遮较多', dark:'画面偏暗',
  'snow-mosaic':'有雪色／拼接', 'snow-seam':'有雪色和接缝', 'winter-visual-only':'冬季局部目视'};
function updateBasemapSelection() {
  const sync=state.timelineBasemapStatus;
  const active=fixedHistory.active?.id || (sync?.kind==='google-earth'?sync.scene?.id:state.basemap);
  if(active===fixedHistory.marked)return;
  if(fixedHistory.markedButton){
    fixedHistory.markedButton.classList.remove('active');
    fixedHistory.markedButton.setAttribute('aria-pressed','false');
  }
  fixedHistory.marked=active;
  fixedHistory.markedButton=fixedHistory.buttons?.get(active);
  if(fixedHistory.markedButton){
    fixedHistory.markedButton.classList.add('active');
    fixedHistory.markedButton.setAttribute('aria-pressed','true');
  }
}
function wireFixedHistory() {
  const pop=$('#basemap-popover'), list=$('#basemap-chronology'), note=$('#fixed-history-note');
  const clear=$('#fixed-history-clear');
  if(!pop||!list||!note||!clear)return;
  const announce=t=>{note.textContent=t;};
  const native=Array.from($('#basemap-native-scenes').content.querySelectorAll('[data-bm]'),btn=>{
    const node=btn.cloneNode(true), date=node.querySelector('.bm-date').textContent;
    return {node,year:date.slice(0,4),key:date};
  });
  function renderCatalog(scenes,unavailable=false){
    if(scenes===fixedHistory.renderedCatalog && unavailable===fixedHistory.catalogUnavailable)return;
    fixedHistory.renderedCatalog=scenes;
    fixedHistory.catalogUnavailable=unavailable;
    const options=[...native,...historyMenuEntries(scenes||[]).map(({scene:r,year,key,label})=>{
      const node=document.createElement('button');
      node.type='button';node.className='bm-opt';node.dataset.historyScene=r.id;node.setAttribute('aria-pressed','false');
      const title=document.createElement('span'), footprint=document.createElement('small'), date=document.createElement('span');
      title.className='bm-name';title.textContent='Google Earth · '+r.zone;
      const variant=r.title&&r.title!==label&&r.title!==r.sourceLabel&&r.title!==r.sourceDate ? ' · '+r.title : '';
      const file=String(r.sourceFile||r.imagePath).split('/').at(-1);
      const flags=(r.visualReviewFlags||[]).map(f=>historicalFlags[f]).filter(Boolean);
      footprint.className='bm-footprint';footprint.textContent=(isBroadHistoryScene(r)?'广域画幅':'局部画幅')+variant+(flags.length?' · '+flags.join('、'):'');
      footprint.title=file;
      date.className='bm-date';date.textContent=label;
      node.append(title,footprint,date);
      return {node,year,key};
    })].sort((x,y)=>x.key===y.key?0:x.key<y.key?-1:1);
    const pack=document.createDocumentFragment(), groups=new Map();
    fixedHistory.buttons=new Map([['dem-relief',pop.querySelector('[data-bm="dem-relief"]')]]);
    for(const {node,year} of options){
      if(!groups.has(year)){
        const group=document.createElement('div'), heading=document.createElement('h3');
        heading.className='bm-year';heading.textContent=/^\d{4}$/.test(year)?year+' 年':year;
        group.className='bm-year-group';group.append(heading);pack.append(group);groups.set(year,group);
      }
      groups.get(year).append(node);
      fixedHistory.buttons.set(node.dataset.bm||node.dataset.historyScene,node);
    }
    if(unavailable){
      const missing=document.createElement('p');missing.className='bm-hint-note';
      missing.textContent='未读到本机 Google Earth 清单。其他来源仍可用；重新打开可重试。';
      pack.prepend(missing);
    }
    list.replaceChildren(pack);
    fixedHistory.marked=null;updateBasemapSelection();
  }
  renderCatalog(fixedHistory.scenes,!fixedHistory.scenes);
  fixedHistory.prepareMenu=()=>{
    if(!fixedHistory.scenes)void fixedHistoryInventory().then(s=>renderCatalog(s)).catch(()=>{});
  };
  fixedHistory.disable=({restoreFollow=false}={})=>{
    if(!fixedHistory.wanted)return;
    ++fixedHistory.request;fixedHistory.controller?.abort();
    fixedHistory.wanted=false;fixedHistory.active=null;clear.disabled=true;
    announce(restoreFollow?'已解除固定，恢复当前时序／底图。':'');
    if(restoreFollow&&state.timelineSceneSync){stopPlay();seekTimelineBasemap(state.month);}
    updateHeaderPills();syncMapsState();syncUrl();
  };
  fixedHistory.openScene=async id=>{
    const token=++fixedHistory.request;
    fixedHistory.controller?.abort();
    const controller=new AbortController();
    fixedHistory.controller=controller;
    fixedHistory.autoHomeScene=false;fixedHistory.wanted=true;clear.disabled=false;
    // Keep the previous confirmed image visible until the requested one has decoded.
    announce('正在读取本机历史影像…');
    try{
      const scenes=await fixedHistoryInventory();
      if(token!==fixedHistory.request)return false;
      renderCatalog(scenes);
      if($('#tl-slider')&&Number($('#tl-slider').max)!==navigableDates().length-1 && state.bottomTab==='time')renderChartDeck();
      const r=scenes.find(row=>row.id===id);
      if(!r)throw new Error('未登记指定影像，不替代为其他日期');
      announce('正在载入 '+r.title+'；载入后切换底图。');
      await loadHistoryImage(r,{signal:controller.signal});
      if(token!==fixedHistory.request)return false;
      registerFixedImage(r);
      fixedHistory.active=r;fixedHistory.preferredZone=r.zone;
      announce('已固定｜'+r.zone+'｜'+(r.sourceDate?'拍摄 '+r.sourceDate:r.sourceLabel||'拍摄日期未核')+'。切换水面统计月时保留此景。');
      updateHeaderPills();syncMapsState();syncUrl();
      return true;
    }catch(err){
      if(token!==fixedHistory.request)return false;
      fixedHistory.wanted=Boolean(fixedHistory.active);
      clear.disabled=!fixedHistory.wanted;
      announce('未能切换影像：'+err.message+'。保留现有底图与水面月份。');
      updateHeaderPills();syncMapsState();
      return false;
    }
  };
  clear.onclick=()=>{
    $('#timeline-imagery-sync')?.focus({preventScroll:true});
    fixedHistory.disable({restoreFollow:true});
  };
  pop.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-history-scene],button[data-bm]');
    if(!btn||!pop.contains(btn))return;
    if(btn.dataset.historyScene){void fixedHistory.openScene(btn.dataset.historyScene);return;}
    fixedHistory.disable();
    announce('');
    setBasemap(btn.dataset.bm);
  });
}
let lastManualBasemap = null;
let timelineImageRequest = null;

function updateHeaderPills() {
  if ($('#hdr-month')) $('#hdr-month').textContent = state.month;
  const calendar=timelineCalendar(), date=state.month;
  const noVisibleWater=!isUsableWaterMonth(provider.waterIndex,date,scenePresetWater());
  const note=calendar.images.has(date)&&!calendar.water.has(date)&&!calendar.observations.has(date)?'仅有同月影像 · 无合格水面'
    : !calendar.availableSet.has(date)&&calendar.fullSet.has(date)?'无合格水面及同月影像'
    : calendar.water.has(date)&&noVisibleWater?'当前湖无合格水面 · 另一湖有记录':'';
  const marker=$('#imagery-only-month');
  const east=showsEastPoolTimeline()?eastPoolTimelineFrame(date,provider.analysisById,EAST_POOL_TIMELINE):null;
  if(marker){marker.hidden=!(east||note);marker.textContent=east?.label||note;marker.title=[note,east?'东池所在 N1 固定窗，含窗内分离水斑；不计入双湖面积。':''].filter(Boolean).join('｜');}
  const esriActive=!fixedHistory.active&&state.basemap===ESRI_PUBLIC_ID;
  const bmShort = (esriActive?'Esri 高清参考':null) || BASEMAP_LABELS[state.basemap]
    || provider.getImagerySpec(state.basemap)?.time_utc?.slice(0, 10)
    || state.basemap;
  const sync = state.timelineBasemapStatus;
  const bmChip = $('#btn-basemap-pop');
  const bmHint = fixedHistory.active ? '固定 · '+fixedHistory.active.zone+' · '+(fixedHistory.active.sourceDate||fixedHistory.active.sourceLabel||'日期未核')+' · 不随统计月切换' : sync?.kind === 'google-earth' ? 'Google Earth 同月文件参考（'+(sync.scene?.sourceDate?'按采集日':'实际采集日未核')+'；'+(isBroadHistoryScene(sync.scene)?'覆盖图谱范围':'仅覆盖局部')+'），不是当月水面'
    : sync?.kind === 'scene' ? '同月代表影像，日期为单景拍摄日期；月度水面不是当天水面'
    : sync?.kind === 'missing' ? '无同月影像，采用 GLO-30 地形晕渲'
    : sync?.kind === 'failed' ? '同月影像未能载入，采用 GLO-30 地形晕渲'
    : sync?.kind === 'loading' ? '正在载入同月影像，暂用 GLO-30 地形晕渲'
    : '背景卫星影像拍摄日期（独立于水面统计月，点击切换底图）';
  const rawHistDate = fixedHistory.active
    ? String(fixedHistory.active.sourceDate || fixedHistory.active.sourceLabel || '日期未核').replace(/（[^）]*）/g, '').replace(/\s*·\s*备选画幅\s*(\d+)/,' · $1').trim()
    : '';
  if ($('#hdr-basemap')) $('#hdr-basemap').textContent = fixedHistory.active ? (rawHistDate + ' 历史')
    : sync?.kind === 'google-earth' ? 'GE ' + state.month
    : sync?.kind === 'scene' ? sync.date
    : sync?.kind === 'missing' ? '无同月影像'
    : sync?.kind === 'failed' ? '影像加载失败'
    : sync?.kind === 'loading' ? '影像载入中' : bmShort;
  if (bmChip) bmChip.title = fixedHistory.active ? '固定历史影像｜'+fixedHistory.active.zone+'｜不随水面月份切换' : bmHint;
  const credit=$('#fixed-history-credit');
  if (credit) {
    const active=fixedHistory.active || (sync?.kind==='google-earth' ? sync.scene:null);
    credit.hidden=!(active||esriActive);
    $('#guided-reference-credit').hidden=!(active||esriActive);
    credit.textContent=active ? (isBroadHistoryScene(active)?'大范围画幅 · 显示图谱范围内部分 · ':'局部画幅 · ')+active.attribution+' · '+active.zone+' · '+(active.sourceDate||active.sourceLabel||'拍摄日期未核')+'；不是月度水面。':esriActive?ESRI_ATTRIBUTION+' · 在线参考，拍摄日随覆盖源变化，不是月度水面。':'';
  }
  const sourceDetail=$('#ge-attribution-detail');
  if(sourceDetail){
    const active=fixedHistory.active || (sync?.kind==='google-earth' ? sync.scene : null);
    const creditImage=sourceDetail.querySelector('img');
    sourceDetail.hidden=!active?.creditUrl;
    sourceDetail.dataset.creditUrl=active?.creditUrl||'';
    if(creditImage.src!==active?.creditUrl){sourceDetail.open=false;creditImage.removeAttribute('src');}
    sourceDetail.ontoggle=()=>{
      if(sourceDetail.open&&sourceDetail.dataset.creditUrl)creditImage.src=sourceDetail.dataset.creditUrl;
    };
  }
  if ($('#timeline-imagery-note')) $('#timeline-imagery-note').textContent = bmHint;
  if ($('#timeline-imagery-sync')) $('#timeline-imagery-sync').checked = state.timelineSceneSync;
  if($('#timeline-imagery-priority'))$('#timeline-imagery-priority').disabled=!state.timelineSceneSync;
  updateBasemapSelection();
  if ($('#export-month-hint')) {
    const lk = state.lakeView === 'BOTH' ? '双湖' : state.lakeView;
    $('#export-month-hint').textContent = `当前锁定 ${state.month}（${lk}）· 保留争议与缺测`;
  }
}

const ESRI_PUBLIC_ID='esri-public-online';
let publicEsriAdaptive=false;
let publicEsri=null,publicEsriStarted=false,bridgeEsri=null,bridgeEsriPending=null,bridgeEsriAttempts=0,bridgeEsriFailed=false;
const ESRI_BRIDGE_STOP='runoff-bridge', ESRI_BRIDGE_MAX_ATTEMPTS=2;
function esriRenderMetrics(){
 const use3d=is3DActive(), map=use3d?map3d:map2d;
 return {use3d,map,pixelRatio:use3d?map.renderer.getPixelRatio():(map?.dpr||1)};
}
const adaptiveEsriDetail=createEsriDetailController({
 context:()=>{
   if(!publicEsriAdaptive||!publicEsri||state.basemap!==ESRI_PUBLIC_ID||fixedHistory.wanted||fixedHistory.active||
      guidedTour.observer||monthPlayback.running)return null;
   if(document.hidden)return {paused:true};
   const {use3d,map,pixelRatio}=esriRenderMetrics();
   if(!map?.active||!map.width||!map.height||(use3d&&!map.terrainMesh))return null;
   const scope=(use3d?'3d:':'2d:')+(walkMode.active?'walk':guidedTour.active?guideStep()?.id||'guide':'explore');
   // Raycast only when settled. The projection includes off-axis phone and guide framing.
   const stamp=use3d
     ? [map.width,map.height,...map.camera.matrixWorld.elements,...map.camera.projectionMatrix.elements].map(x=>Math.round(x*1e7)).join(',')
     : [map.width,map.height,map.cam.lon,map.cam.lat,map.cam.ppm].join(',');
   const saveData=constrainedConnection(navigator.connection);
   const roaming=walkMode.active&&walkMode.mode!=='guide'&&use3d?walkMode.pose:null;
   const near=roaming&&!roaming.outsideTerrain&&roaming.eyeM<=175?roaming:null;
   const nearGround=near?[near.lon,near.lat,near.eyeM]:null;
   const nearStamp=near?[Math.round(near.lon*800),Math.round(near.lat*1230),Math.round(near.eyeM/35)]:stamp;
   return {scope,stamp:[nearStamp,pixelRatio,saveData].join(':'),nearGround,width:map.width,height:map.height,
     pixelRatio,baseZoom:publicEsri.zoom,saveData,
     ground:use3d?(x,y)=>map.groundAtScreenPx(x,y):(x,y)=>[map.xToLon(x),map.yToLat(y)],
     bridge:guideStep()?.id===ESRI_BRIDGE_STOP&&guidedTour.active?true:'focus'};
 },
 load:(plan,signal)=>loadEsriBasemap(plan.bounds,signal,plan.zoom,plan.tile),
 show:detail=>{
   const spec=detail?{...detail,parentSceneId:ESRI_PUBLIC_ID}:null;
   const in3d=is3DActive();
   map2d?.setNativeDetail(in3d?null:spec);
   map3d?.setNativeDetail(in3d?spec:null);
 }
});
function syncPublicEsriDetail(){
 if(publicEsriAdaptive)adaptiveEsriDetail.sync();
 else syncEsriBridgeDetail();
}
function syncAdaptiveEsriDetail(){if(publicEsriAdaptive)adaptiveEsriDetail.sync();}
document.addEventListener('visibilitychange',syncAdaptiveEsriDetail);
navigator.connection?.addEventListener?.('change',syncAdaptiveEsriDetail);

function syncEsriBridgeDetail(){
 const eligible=publicEsri&&guidedTour.active&&!guidedTour.observer&&
   guideStep()?.id===ESRI_BRIDGE_STOP&&state.basemap===ESRI_PUBLIC_ID&&!fixedHistory.wanted&&!fixedHistory.active&&map3d&&!map3d.failed;
 if(!eligible){
   if(bridgeEsriPending){bridgeEsriPending.abort();bridgeEsriPending=null;}
   if(bridgeEsri)map3d?.setNativeDetail(null);
   return;
 }
 if(bridgeEsri){map3d.setNativeDetail(bridgeEsri);return;}
 if(bridgeEsriPending||bridgeEsriFailed||bridgeEsriAttempts>=ESRI_BRIDGE_MAX_ATTEMPTS)return;
 const active=new AbortController();
 bridgeEsriPending=active;
 bridgeEsriAttempts++;
 const signal=AbortSignal.any([active.signal,AbortSignal.timeout(16000)]);
 void loadEsriBasemap(BRIDGE_BOUNDS,signal,BRIDGE_ZOOM).then(scene=>{
   if(bridgeEsriPending!==active){URL.revokeObjectURL(scene.url);return;}
   bridgeEsri={...scene,id:'esri-public-bridge-detail',parentSceneId:ESRI_PUBLIC_ID};
   map3d.setNativeDetail(bridgeEsri);
 }).catch(()=>{if(bridgeEsriPending===active)bridgeEsriFailed=true;}).finally(()=>{
   if(bridgeEsriPending===active)bridgeEsriPending=null;
 });
}
window.addEventListener('pagehide',e=>{
 if(e.persisted)return;
 adaptiveEsriDetail.dispose();
 bridgeEsriPending?.abort();
 if(bridgeEsri)URL.revokeObjectURL(bridgeEsri.url);
 if(publicEsri)URL.revokeObjectURL(publicEsri.url);
});
async function startPublicEsri(){
 if(publicEsriStarted||location.origin!=='https://hujiernuoer.fansudur.com')return;
 publicEsriStarted=true;
 try{
  const probe=await fetch('/atlas-esri/progressive-ready',{signal:AbortSignal.timeout(3000),credentials:'omit',redirect:'error'});
  if(!probe.ok||await probe.text()!=='atlas-esri-v2')return;
  // Keep old Workers compatible and use one readiness round trip on current versions.
  const compactSupported=probe.headers.get('X-Atlas-Compact-Overview')===String(COMPACT_OVERVIEW_ZOOM);
  const adaptiveAvailable=compactSupported?Promise.resolve(true):fetch('/atlas-esri/adaptive-ready',{signal:AbortSignal.timeout(3000),credentials:'omit',redirect:'error'})
    .then(async r=>r.ok&&await r.text()==='atlas-esri-v3').catch(()=>false);
  const {map,pixelRatio}=esriRenderMetrics();
  const zoom=compactSupported?overviewZoom({width:map?.width,pixelRatio,connection:navigator.connection}):OVERVIEW_ZOOM;
  const draft=await loadEsriBasemap(ATLAS_BOUNDS,AbortSignal.timeout(20000),zoom);
  publicEsriAdaptive=await adaptiveAvailable;
  publicEsri={...draft,id:ESRI_PUBLIC_ID,zoom};
  registeredImagery={...registeredImagery,[ESRI_PUBLIC_ID]:publicEsri};
  map2d?.setState({imageryById:registeredImagery});map3d?.setState({imageryById:registeredImagery});
  if(guidedTour.active&&!guidedTour.observer&&state.basemap===PUBLIC_GUIDE_BASEMAP){
    state.basemap=ESRI_PUBLIC_ID;updateHeaderPills();syncMapsState();v93NotifySync();
  }else if(!guidedTour.active&&!walkMode.active&&!fixedHistory.wanted&&!state.timelineBasemapStatus&&
     state.scenePreset==='home'&&state.basemap===PUBLIC_GUIDE_BASEMAP&&!monthPlayback.running){
    state.basemap=ESRI_PUBLIC_ID;lastManualBasemap=ESRI_PUBLIC_ID;updateHeaderPills();syncMapsState();
  }
 }catch{/* Retain the current reference when Esri is unavailable or over quota. */}
}
function setBasemap(bm) {
  stopPlay();
  timelineImageRequest?.abort();
  timelineImageRequest = null;
  lastManualBasemap = bm;
  state.timelineBasemapStatus = null;
  state.basemap = bm;
  updateHeaderPills();
  syncMapsState();
  syncUrl();
  if (state.studioOpen && (state.studioTab === 'layers' || state.studioTab === 'crossings')) renderStudioDrawer();
  if (state.selectedFeatureId) renderInspectorDrawer();
}

// ==========================================================================
// Temporal Playback, Progressive Month Load & Individual Lake Retry
// ==========================================================================
function timelinePlayTitle() {
  const mode = state.compareAxis === 'same-year' ? '同年跨月' : '同月跨年';
  return mode+'自动播放：'+playSequence().length+' 期（始终跳过无资料月份）';
}

function knownBroadMonths(){
  return broadHistoryMonths(fixedHistory.scenes||[]);
}
let cachedCalendar=null,calendarIndex=null,calendarNative=null,calendarHistory=null;
function timelineCalendar(){
  if(cachedCalendar&&calendarIndex===provider.waterIndex&&calendarNative===timelineScenes&&calendarHistory===fixedHistory.scenes)return cachedCalendar;
  calendarIndex=provider.waterIndex;calendarNative=timelineScenes;calendarHistory=fixedHistory.scenes;
  const native=timelineScenes.filter(scene=>scene.broad&&scene.url&&/^\d{4}-\d{2}-\d{2}$/.test(scene.date)).map(scene=>scene.date.slice(0,7));
  return cachedCalendar=createTimelineCalendar(provider.waterIndex,[...native,...(fixedHistory.scenes||[]).map(historySceneMonth)],EAST_POOL_OBSERVATION_MONTHS);
}
function navigableDates(){
  const cal=timelineCalendar();
  return state.timelineCalendarFull?cal.full:cal.available;
}
function playSequence() {
  return filterTimelineAxis(timelineCalendar().available,state.month,state.compareAxis);
}
function timelineChoices(dates){
  const year=state.month.slice(0,4), month=state.month.slice(5,7);
  const years=[...new Set(dates.map(d=>d.slice(0,4)))];
  const months=dates.filter(d=>d.startsWith(year+'-')).map(d=>d.slice(5,7));
  const active=dates.includes(state.month), candidate=Math.max(0,dates.indexOf(relativeTimelineDate(dates,state.month,1)));
  return {year,month,years,months,active,
    idx:active?dates.indexOf(state.month):(relativeTimelineDate(dates,state.month,1)?candidate:Math.max(0,dates.length-1))};
}
function timelineMonthDescription(){
  const cal=timelineCalendar(), d=state.month;
  if(!cal.availableSet.has(d))return '无合格水面及同月影像';
  if(!cal.water.has(d))return cal.observations.has(d)?eastPoolTimelineFrame(d,provider.analysisById,EAST_POOL_TIMELINE).label:'仅有同月影像';
  const records=['MAIN','WF1'].map(id=>provider.waterIndex.lakes[id]?.months?.[d]?.status);
  if(records.includes('zero')&&!records.includes('positive'))return '合格观测为零'+(cal.images.has(d)?'，另有同月影像':'');
  return cal.images.has(d)?'有合格观测和同月影像':'有合格水面观测';
}
function timelineOptions(values,current,suffix){
  const onlyDeepLink=values.includes(current)?'':`<option value="${current}" selected disabled>${Number(current)}${suffix}（当前）</option>`;
  return onlyDeepLink+values.map(x=>`<option value="${x}" ${x===current?'selected':''}>${Number(x)}${suffix}</option>`).join('');
}

async function loadTimelineScene(date, signal) {
  const normal = representativeTimelineScene(date,timelineScenes);
  let fallback=null;
  if(!signal.aborted && !fixedHistory.wanted &&
     (!normal || state.timelineImageryPriority==='wide-google')){
    try { fallback=exactGoogleEarthMonth(date,await fixedHistoryInventory(),fixedHistory.preferredZone); }
    catch { /* source absent: preserve normal or DEM */ }
  }
  if(signal.aborted)return {kind:'missing'};
  const preferred=(!normal || (state.timelineImageryPriority==='wide-google' && isBroadHistoryScene(fallback)))
    && !fixedHistory.wanted ? fallback:null;
  if(preferred){
    try {
      await loadHistoryImage(preferred,{signal,timeoutMs:2400});
      if(signal.aborted)return {kind:'missing'};
      if(!fixedHistory.wanted)return {kind:'google-earth',id:preferred.id,scene:preferred};
    } catch { if(!normal)return {kind:'failed'}; }
  }
  const scene=normal;
  if(!scene)return {kind:'missing'};
  if (signal.aborted) return Promise.resolve({kind:'failed'});
  return new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => finish(false), 2400);
    const aborted = () => finish(false);
    function finish(ok) {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      signal.removeEventListener('abort', aborted);
      resolve(ok ? {kind:'scene', id:scene.id, date:scene.date} : {kind:'failed'});
    }
    signal.addEventListener('abort', aborted, {once:true});
    img.onload = () => finish(img.naturalWidth > 0);
    img.onerror = () => finish(false);
    img.src = scene.url;
  });
}

function applyTimelineBasemap(result) {
  state.timelineBasemapStatus = result;
  if(result.kind==='google-earth') registerFixedImage(result.scene);
  state.basemap = ['scene','google-earth'].includes(result.kind) ? result.id : 'dem-relief';
}

function seekTimelineBasemap(date) {
  timelineImageRequest?.abort();
  applyTimelineBasemap({kind:'loading'});
  const req = new AbortController();
  timelineImageRequest = req;
  void loadTimelineScene(date, req.signal).then(result => {
    if (req !== timelineImageRequest || req.signal.aborted || state.month !== date || !state.timelineSceneSync) return;
    timelineImageRequest = null;
    applyTimelineBasemap(result);
    updateHeaderPills();
    syncMapsState();
    syncUrl();
  });
}

const monthPlayback = createMonthPlayback({
  dates: playSequence,
  runKey: () => `${state.compareAxis}:${state.timelineCalendarFull}:${state.lakeView}`,
  currentDate: () => state.month,
  prepare: async (date, signal) => {
    const [frame, timelineBasemap] = await Promise.all([
      provider.isMonthCached(date) ? provider.buildPendingMonthWater(date) : provider.loadMonthWater(date, null, { signal }),
      state.timelineSceneSync ? loadTimelineScene(date, signal) : null,
    ]);
    return { ...frame, timelineBasemap };
  },
  commit: (date, prepared) => { void selectMonth(date, { keepSlider: true, prepared }); },
  onStatus: (running, next) => {
    state.playing = running;
    const b = $('#btn-tl-play');
    if (b) {
      b.textContent = running ? '⏸' : '▶';
      b.title = running && next ? '暂停月度播放（准备 ' + next + '）' : timelinePlayTitle();
      b.setAttribute('aria-label', running ? '暂停月度播放' : '自动播放月度序列');
      b.classList.toggle('active', running);
    }
  },
  onError: (_error, date) => {
    state.playbackError = date;
    renderAlerts();
  },
});

let playIntent=0, startingPlay=false;
function stopPlay() {
  playIntent++;
  startingPlay=false;
  monthPlayback.stop();
  syncAdaptiveEsriDetail();
}

async function togglePlay() {
  if(monthPlayback.running||startingPlay){stopPlay();return;}
  state.playbackError=null;
  renderAlerts();
  stopSoutheastStepping();
  const ticket=++playIntent;
  if(!fixedHistory.scenes){
    startingPlay=true;
    try {await fixedHistoryInventory();}catch{}
    if(ticket!==playIntent)return;
    startingPlay=false;
    if(state.bottomTab==='time')renderChartDeck();
  }
  if($('#tl-slider')&&Number($('#tl-slider').max)!==navigableDates().length-1 && state.bottomTab==='time')renderChartDeck();
  if(!playSequence().some(date=>date!==state.month)){
    const el=$('#btn-tl-play');
    if(el)el.title='这个比较组没有可继续播放的月份；可切到完整月历查看无资料月份。';
    return;
  }
  if(state.timelineSceneSync&&fixedHistory.wanted){
    fixedHistory.autoHomeScene=false;
    fixedHistory.disable?.();
    seekTimelineBasemap(state.month);
  }
  if(!guidedTour.active){
    state.eastPoolTimeline=true;
    if(state.scenePreset==='home')state.timelineWaterContext=true;
    updateHeaderPills();syncMapsState();
    // Timeline playback changes the evidence layers, not the map camera.
  }
  monthPlayback.start();
}

let seStepTimer = null;
function stopSoutheastStepping() {
  if (seStepTimer) {
    clearTimeout(seStepTimer);
    seStepTimer = null;
  }
  if (state.southeastStepping) {
    state.southeastStepping = false;
    if (state.studioOpen && state.studioTab === 'southeast') renderStudioDrawer();
  }
}

function startSoutheastStepping() {
  stopPlay();
  stopSoutheastStepping();
  const seq = state.southeastWindow === SE_CLUSTER7_WINDOW
    ? ['2024-06', '2024-07', '2024-08', '2014-08']
    : ['2024-06', '2024-07', '2024-08'];
  state.southeastEnabled = true;
  state.southeastStepping = true;
  if (state.studioOpen && state.studioTab === 'southeast') renderStudioDrawer();
  let stepIdx = Math.max(0, seq.indexOf(state.month));
  const stepOnce = async () => {
    if (!state.southeastStepping || document.hidden) {
      stopSoutheastStepping();
      return;
    }
    stepIdx = (stepIdx + 1) % seq.length;
    await selectMonth(seq[stepIdx], { fromSoutheastStep: true });
    if (!state.southeastStepping) return;
    const delay = prefersReducedMotion() ? 1800 : 1400;
    seStepTimer = setTimeout(() => { void stepOnce(); }, delay);
  };
  seStepTimer = setTimeout(() => { void stepOnce(); }, prefersReducedMotion() ? 1200 : 900);
}

async function selectMonth(date, { keepSlider = false, prepared = null, fromSoutheastStep = false, timeline = false } = {}) {
  if(timeline&&state.timelineSceneSync&&fixedHistory.autoHomeScene&&date!==state.month){
    fixedHistory.autoHomeScene=false;
    fixedHistory.disable?.();
  }

  if(!timelineCalendar().fullSet.has(date))return;
  if((timeline||prepared)&&!guidedTour.active){
    state.eastPoolTimeline=true;
    if(state.scenePreset==='home')state.timelineWaterContext=true;
  }
  if (!prepared) stopPlay();
  if (!fromSoutheastStep) stopSoutheastStepping();
  state.playbackError = null;
  state.month = date;
  timelineImageRequest?.abort();
  timelineImageRequest = null;
  if (state.timelineSceneSync && prepared?.timelineBasemap) applyTimelineBasemap(prepared.timelineBasemap);
  else if (state.timelineSceneSync && timeline) seekTimelineBasemap(date);
  else if (!prepared && state.timelineBasemapStatus) {
    state.timelineBasemapStatus = null;
    state.basemap = lastManualBasemap || 'sentinel2-2026-08-08';
  }
  const reqId = ++monthReqSeq;
  if (monthAbortCtrl) monthAbortCtrl.abort();
  monthAbortCtrl = new AbortController();
  const signal = monthAbortCtrl.signal;

  // Prepared snapshots arrive only from auto-play and are complete for this date.
  // Manual navigation continues to clear previous geometry immediately.
  state.waterMonth = prepared || provider.buildPendingMonthWater(date);
  state.monthLoadErrors = state.waterMonth.errors || [];
  state.exportError = null;
  updateHeaderPills();
  if (!keepSlider || prepared) syncUrl();
  syncMapsState();
  renderLakeChips();
  renderAlerts();
  if (state.studioOpen && state.studioTab === 'southeast') renderStudioDrawer();
  if (keepSlider && state.bottomTab === 'time' && updateTimeDeckInPlace()) {
    // Slider stays alive mid-drag
  } else {
    renderChartDeck();
  }

  if (!state.waterMonth.loading) return;

  await provider.loadMonthWater(date, null, {
    signal,
    onLakeSettled: snapshot => {
      if (reqId !== monthReqSeq || state.month !== date) return;
      state.waterMonth = snapshot;
      state.monthLoadErrors = snapshot.errors || [];
      syncMapsState();
      renderLakeChips();
      renderAlerts();
      if (state.studioOpen && state.studioTab === 'southeast') renderStudioDrawer();
    },
  });
}

async function retryWaterLakes(lakeIds = null) {
  const date = state.month;
  if (!state.waterMonth || state.waterMonth.date !== date) {
    return selectMonth(date);
  }
  const allLakes = Object.keys(provider.waterIndex.lakes);
  const targetIds = Array.isArray(lakeIds) && lakeIds.length
    ? lakeIds.filter(id => allLakes.includes(id))
    : allLakes.filter(id => Boolean(state.waterMonth.lakes?.[id]?.error));
  if (!targetIds.length) return selectMonth(date);

  const reqId = monthReqSeq;
  if (!monthAbortCtrl || monthAbortCtrl.signal.aborted) {
    monthAbortCtrl = new AbortController();
  }
  const signal = monthAbortCtrl.signal;

  const nextLakes = { ...state.waterMonth.lakes };
  for (const id of targetIds) {
    const prev = nextLakes[id] || {};
    nextLakes[id] = {
      ...prev,
      lakeId: id,
      row: provider.waterIndex.lakes[id]?.months?.[date] || null,
      water: null,
      nodata: null,
      loading: true,
      error: null,
    };
  }
  const recompute = lakesObj => {
    const errors = [];
    let loading = false;
    for (const id of allLakes) {
      const e = lakesObj[id];
      if (!e) continue;
      if (e.loading) loading = true;
      if (e.error) errors.push({ lakeId: id, date, message: e.error });
    }
    return { date, loading, lakes: { ...lakesObj }, errors };
  };

  state.waterMonth = recompute(nextLakes);
  state.monthLoadErrors = state.waterMonth.errors;
  state.exportError = null;
  syncMapsState();
  renderLakeChips();
  renderAlerts();

  await Promise.all(
    targetIds.map(async id => {
      const entry = await provider.loadLakeWater(date, id, { signal });
      if (reqId !== monthReqSeq || state.month !== date || entry.aborted) return;
      const merged = { ...(state.waterMonth?.lakes || {}), [id]: entry };
      state.waterMonth = recompute(merged);
      state.monthLoadErrors = state.waterMonth.errors;
      syncMapsState();
      renderLakeChips();
      renderAlerts();
    })
  );
}

// ==========================================================================
// Feature Selection, Profile Scrubbing & 2D/3D Switching
// ==========================================================================
function selectFeature(featureOrId, { fly = false, showData = false } = {}) {
  const feat = typeof featureOrId === 'string'
    ? provider.analysisById.get(featureOrId) || null
    : featureOrId || null;

  const previousDeck=state.bottomTab;
  state.selectedFeatureId = feat ? feat.id : null;
  if(!showData&&state.pickedDataId!==state.selectedFeatureId){
    state.pickedDataId=null;
    if(state.bottomTab==='feature')state.bottomTab='time';
  }
  if(showData) {
    if(feat)stopPlay();
    state.pickedDataId=feat?.id||null;
  }

  if (feat) {
    const ly = feat.properties?.layer;
    if (ly && !feat.properties?.is_contour && !state.visibleLayers.has(ly) && !isInScenePreset(feat.id)) {
      state.visibleLayers.add(ly);
      updateActiveLayerBadge();
      if (state.studioOpen && state.studioTab === 'layers') renderStudioDrawer();
    }
    const pd = getProfileData(feat.id,{allowSampling:showData});
    if(showData && pd){state.bottomTab='profile';}
    if (pd !== null) {
      if (state.activeProfileId !== feat.id) {
        state.activeProfileId = feat.id;
        state.profileCursorIdx = pd.zeroSampleIdx ?? 0;
      } else if (state.profileCursorIdx < 0) {
        state.profileCursorIdx = pd.zeroSampleIdx ?? 0;
      }
      if (state.bottomTab === 'profile') renderChartDeck();
    }
    if (fly) {
      if ((isWayback2dOnly(feat) || feat.properties?.outside_dem === true) && is3DActive()) setDimension('2d');
      let b = geometryBounds(feat.geometry);
      const wholeRouteId=feat.properties?.canonical_old_line_id||(/^archive-route-wcross[12]$/.test(feat.id)?feat.id:null);
      const oldRoute=wholeRouteId&&provider.analysisById.get(wholeRouteId);
      const pieces=oldRoute?(state.wcrossUpstream||[]).filter(f=>f.properties.canonical_old_line_id===wholeRouteId&&f.properties.feature_role==='terrain_only_approach'):[];
      if(pieces.length&&b){
        // Fit separate segments together; never create a continuous synthetic route.
        const ext=[oldRoute,...pieces].map(f=>geometryBounds(f.geometry)).filter(Boolean);
        b=[Math.min(b[0],...ext.map(x=>x[0])),Math.min(b[1],...ext.map(x=>x[1])),Math.max(b[2],...ext.map(x=>x[2])),Math.max(b[3],...ext.map(x=>x[3]))];
        const routeLayer=oldRoute.properties?.layer;
        state.visibleLayers.add(WCROSS_UPSTREAM_LAYER);
        if(routeLayer)state.visibleLayers.add(routeLayer);
        updateActiveLayerBadge();
      }
      if (b) {
        if (feat.geometry.type === 'Point'&&!pieces.length) flyActiveMap({ lon: b[0], lat: b[1], spanKm: 1.6 });
        else fitActiveBounds(b, 1.55);
      }
    }
    if ((isMobileViewport() || isCompactViewport()) && state.studioOpen) {
      closeStudioDrawer();
    }
    if (isMobileViewport() && state.deckExpanded) {
      setDeckExpanded(false);
    }
  }

  syncMapsState();
  syncUrl();
  renderInspectorDrawer();
  const hasProfileForShow = Boolean(showData && feat && getProfileData(feat.id, { allowSampling: true }));
  if(hasProfileForShow){
    setDeckExpanded(true);renderChartDeck();
    if(state.bottomTab==='profile'){
      if(state.studioOpen)closeStudioDrawer();
      hideInspectorSurface();
      fitVisibleObjects([feat],()=>state.bottomTab==='profile'&&state.activeProfileId===feat.id&&(state.visibleLayers.has(feat.properties?.layer)||isInScenePreset(feat.id)));
    }
  }
  else if(showData&&!feat){
    if(state.bottomTab==='feature')state.bottomTab='time';
    renderChartDeck();
  } else if(previousDeck!==state.bottomTab)renderChartDeck();
  renderWaterwayReturnPill();
  syncSheetBackdrop();
}

function updateProfileCursorInPlace(pd, idx) {
  const cur = pd.samples[idx];
  if (!cur) return false;

  const mini = $('#deck-prof-mini');
  if (mini) {
    mini.textContent = `#${idx + 1} · ${cur.distance_m.toFixed(0)}m · ${describeProfileCursorElevation(cur)}`;
  }
  const slider = $('#prof-slider');
  if (slider && slider.value !== String(idx)) slider.value = String(idx);

  const svg = document.querySelector(`[data-profile-svg="${CSS.escape(pd.id)}"]`);
  if (svg) {
    const padL = Number(svg.dataset.padL);
    const padR = Number(svg.dataset.padR);
    const padT = Number(svg.dataset.padT);
    const padB = Number(svg.dataset.padB);
    const viewW = Number(svg.dataset.viewW);
    const viewH = Number(svg.dataset.viewH);
    const dMin = Number(svg.dataset.dMin);
    const dMax = Number(svg.dataset.dMax);
    const zMin = Number(svg.dataset.zMin);
    const zMax = Number(svg.dataset.zMax);
    const pw = viewW - padL - padR;
    const ph = viewH - padT - padB;
    const cx = padL + ((cur.distance_m - dMin) / Math.max(1, dMax - dMin)) * pw;
    const yFor = z => padT + ph - ((z - zMin) / Math.max(1, zMax - zMin)) * ph;

    const line = svg.querySelector('[data-prof-cursor-line]');
    if (line) {
      line.setAttribute('x1', cx.toFixed(1));
      line.setAttribute('x2', cx.toFixed(1));
    }
    for (const [key, value] of [['glo', cur.glo30_m], ['aw', cur.aw3d30_m]]) {
      const dot = svg.querySelector(`[data-prof-cursor-${key}]`);
      if (!dot) continue;
      const visible = !cur.waterMasked && Number.isFinite(value);
      dot.setAttribute('cx', cx.toFixed(1));
      dot.setAttribute('visibility', visible ? 'visible' : 'hidden');
      if (visible) dot.setAttribute('cy', yFor(value).toFixed(1));
    }
    const readout = $('#profile-cursor-readout');
    if (readout) {
      profileCursorReadout(pd, idx).forEach((value, i) => {
        const span = readout.children[i];
        if (!span) return;
        span.hidden = value === null;
        if (span.textContent !== (value ?? '')) span.textContent = value ?? '';
      });
    }
  }
  return true;
}

function setProfileSample(profileId, sampleIdx, { flyToPoint = false, inPlace = false, deferUrl = false, selectProfileFeature = true } = {}) {
  const pd = getProfileData(profileId);
  if (!pd) return;
  if(guidedTour.active){
    guidedTour.v74ProfileInteracted=true;
    state.activeProfileId=profileId;
    state.profileCursorIdx=Math.max(0,Math.min(pd.samples.length-1,sampleIdx));
    syncMapsState();
    if(!inPlace||!updateProfileCursorInPlace(pd,state.profileCursorIdx))renderChartDeck();
    return;
  }
  const prevFeat = state.selectedFeatureId;
  if(state.pickedDataId && state.pickedDataId!==profileId)state.pickedDataId=null;
  state.activeProfileId = profileId;
  state.profileCursorIdx = Math.max(0, Math.min(pd.samples.length - 1, sampleIdx));
  if (selectProfileFeature) state.selectedFeatureId = profileId;
  const feat = provider.analysisById.get(profileId);
  if (feat?.properties?.layer&&!isInScenePreset(feat.id)) {
    state.visibleLayers.add(feat.properties.layer);
    updateActiveLayerBadge();
  }
  const sample = pd.samples[state.profileCursorIdx];

  syncMapsState();
  if (!deferUrl) syncUrl();
  if (inPlace && state.bottomTab === 'profile' && updateProfileCursorInPlace(pd, state.profileCursorIdx)) {
    if (selectProfileFeature && prevFeat !== state.selectedFeatureId && !isMobileViewport()) {
      renderInspectorDrawer();
    }
  } else {
    renderChartDeck();
    if (selectProfileFeature && !isMobileViewport()) renderInspectorDrawer();
  }
  if (flyToPoint && sample) {
    flyActiveMap({ lon: sample.lon, lat: sample.lat, spanKm: 2.2 });
  }
}

const SLOPE_CLUE_LAYER='slope-road-clues';
const SLOPE_CLUE_NAME='国道西侧浅斑与东侧地方路';
const SLOPE_FEATURES=['slope-bright-patch-200405','slope-owner-blue-upper','slope-owner-blue-middle','slope-owner-blue-tip','slope-local-road-search'];
function parseSlopeClues(doc){
 const features=doc?.features;
 if(doc?.type!=='FeatureCollection'||features?.length!==SLOPE_FEATURES.length)throw new Error('核查要素数量不符');
 return SLOPE_FEATURES.map((id,i)=>{
   const f=features.find(el=>el.id===id),g=f?.geometry,p=f?.properties;
   const role=i===0?'bright-patch':i===4?'road-search':'owner-blue-control';
   const pt=xy=>Array.isArray(xy)&&xy.length===2&&xy.every(Number.isFinite)&&xy[0]>119.64&&xy[0]<119.68&&xy[1]>49.12&&xy[1]<49.14;
   const ring=g?.coordinates?.[0];
   const valid=i===0?g?.type==='Polygon'&&g.coordinates.length===1&&ring.length===5&&ring.every(pt)&&ring[0].every((v,j)=>v===ring[4][j]):g?.type==='Point'&&pt(g.coordinates);
   if(!valid||f.type!=='Feature'||p?.layer!==SLOPE_CLUE_LAYER||p.feature_role!==role||p.status!==(i===0?'observed':'candidate')||!p.name||!p.description||provider.analysisById.has(id))throw new Error('核查要素类型或状态不符');
   return f;
 });
}
const walkMode={active:false};
function syncDimensionButtons(view3d) {
  for (const [id, pressed] of [['#btn-2d', !view3d], ['#btn-3d', view3d]]) {
    const button = $(id);
    button?.classList.toggle('active', pressed);
    button?.setAttribute('aria-pressed', String(pressed));
  }
}

function handleWebGLContextLost({ reason = 'webglcontextlost', focus = null } = {}) {
  if(guidedTour.active)closeGuidedTour({lost:true});
  if(walkMode.active)closeTerrainWalk({lost:true});
  state.view3d = false;
  state.webglFallbackNotice = 'runtime';

  syncDimensionButtons(false);
  if ($('#btn-3d')) $('#btn-3d').title = '运行中 WebGL 上下文已丢失，已自动回退 2D Canvas';
  if ($('#exag-group')) $('#exag-group').hidden = true;
  if ($('#map-2d-canvas')) $('#map-2d-canvas').hidden = false;
  if ($('#map-3d-stage')) $('#map-3d-stage').hidden = true;
  if ($('#map-3d-labels')) $('#map-3d-labels').hidden = true;
  if ($('#render-engine-badge')) $('#render-engine-badge').textContent = '2D Canvas（WebGL 丢失已回退）';
  setCompassAngle(0);

  map3d?.setActive(false);
  map2d?.resize();
  if (focus && Number.isFinite(focus.lon) && Number.isFinite(focus.lat)) {
    map2d?.flyTo({ lon: focus.lon, lat: focus.lat, spanKm: focus.spanKm, duration: 0, exactFocus: true });
  }
  map2d?.setActive(true);
  syncMapStage();
  syncUrl();
  renderAlerts();
  renderInspectorDrawer();
}

function setDimension(dim) {
  const activeWalk=guidedTour.active?guidedTour:walkMode;
  const roamRestore2d=dim!=='3d'&&activeWalk.active&&!activeWalk.saved.view3d?activeWalk.saved.focus2d:null;
  if(dim!=='3d'&&guidedTour.active)closeGuidedTour({stay3d:true});
  if(dim!=='3d'&&walkMode.active)closeTerrainWalk({stay3d:true});
  const want3d = dim === '3d';
  if (want3d && (!map3d || map3d.failed)) {
    state.view3d = false;
    if (!state.webglFallbackNotice) state.webglFallbackNotice = 'startup';
    syncDimensionButtons(false);
    $('#exag-group').hidden = true;
    $('#map-2d-canvas').hidden = false;
    $('#map-3d-stage').hidden = true;
    $('#map-3d-labels').hidden = true;
    $('#render-engine-badge').textContent =
      state.webglFallbackNotice === 'runtime'
        ? '2D Canvas（WebGL 丢失已回退）'
        : '2D Canvas（WebGL 不可用已回退）';
    map3d?.setActive(false);
    map2d?.setActive(true);
    syncMapStage();
    syncUrl();
    renderAlerts();
    return;
  }
  if (want3d === state.view3d) return;

  const focus = want3d ? map2d.getCameraFocus() : roamRestore2d || map3d.getCameraFocus();
  state.view3d = want3d;

  syncDimensionButtons(want3d);
  $('#exag-group').hidden = !want3d;
  $('#map-2d-canvas').hidden = want3d;
  $('#map-3d-stage').hidden = !want3d;
  $('#map-3d-labels').hidden = !want3d;
  $('#render-engine-badge').textContent = want3d ? `3D WebGL (${state.exag3d}×)` : '2D Canvas';

  const outgoingMap = want3d ? map2d : map3d;
  const incomingMap = want3d ? map3d : map2d;
  outgoingMap.setActive(false);
  if (!want3d) {
    setCompassAngle(0);
    incomingMap.resize();
  }
  incomingMap.flyTo({ lon: focus.lon, lat: focus.lat, spanKm: focus.spanKm, duration: 0, exactFocus: true });
  incomingMap.setActive(true);
  syncMapStage();
  syncUrl();
}

// ==========================================================================
// Top-Left Instant Twin-Lake Telemetry Chips & Contextual Alert Stack
// ==========================================================================
function renderLakeChips() {
  const host = $('#lake-chips');
  if (!host || !provider.waterIndex) return;
  if (!lakeChipViews.size || !host.contains(lakeChipViews.get('MAIN')?.card)) {
    lakeChipViews = new Map();
    for (const [id, title, tag, css, short] of [
      ['MAIN', '呼吉尔诺尔 · 主湖', '', 'main-chip', '主湖'],
      ['WF1', '西长湖', '独立窗', 'wf1-chip', '西长湖'],
    ]) {
      const key = id.toLowerCase();
      const card = document.createElement('div');
      card.dataset.lakeCard = id;
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="lake-chip-top">
          <span class="lake-chip-label"><span>${title}</span>${tag ? '<span class="lake-chip-sub">' + tag + '</span>' : ''}</span>
          <span class="lake-chip-val" id="stat-${key}-area"></span>
        </div>
        <div class="lake-chip-bottom">
          <span class="status-badge" id="stat-${key}-badge"></span>
          <button type="button" class="chip-retry-btn" id="btn-retry-${key}" data-retry-lake="${id}" hidden>↻ 重试${short}</button>
          <span class="lake-chip-meta"></span>
        </div>
        <div class="lake-chip-geom" id="stat-${key}-geom"></div>`;
      const goLake = () => {
        const bounds = provider.waterIndex?.lakes?.[id]?.bounds_wgs84;
        if (bounds) fitActiveBounds(bounds, id === 'MAIN' ? 1.65 : 1.9);
      };
      card.onclick = goLake;
      card.onkeydown = e => {
        if (e.target !== card) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goLake(); }
      };
      const retry = card.querySelector('.chip-retry-btn');
      retry.onclick = e => { e.stopPropagation(); void retryWaterLakes([id]); };
      lakeChipViews.set(id, {
        card, css, title, retry, val: card.querySelector('.lake-chip-val'),
        badge: card.querySelector('.status-badge'), meta: card.querySelector('.lake-chip-meta'),
        geometry: card.querySelector('.lake-chip-geom'),
      });
    }
    host.replaceChildren(...[...lakeChipViews.values()].map(v => v.card));
  }

  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  for (const [id, v] of lakeChipViews) {
    const record = provider.waterIndex.lakes[id]?.months?.[state.month];
    const desc = describeWaterMonth(id, state.month, record);
    const geomState = describeWaterGeometryState(state.waterMonth?.lakes?.[id]);
    const status = geomState.isError ? 'error' : desc.disputed ? 'disputed' : desc.stateKey === 'invalid' ? 'invalid' : '';
    const dimmed = state.lakeView !== 'BOTH' && state.lakeView !== id;
    const badgeText = geomState.isError ? geomState.shortBadge : geomState.isLoading ? '⏳ 几何加载中…' : !record ? '▨ 无月度水面记录' : ({
      positive: '● 合格正值', positive_disputed: '⚠ 争议正值',
      zero: '○ 观测为零', zero_disputed: '⊗ 争议零值', invalid: '▨ 覆盖不足',
    }[desc.stateKey] || '▨ 覆盖不足');
    const tone = geomState.isError ? 'disputed' : geomState.isLoading ? 'nodata'
      : desc.tone === 'observed' && id === 'WF1' ? 'wf1-obs' : desc.tone;
    const classes = ['lake-chip', v.css, status, dimmed ? 'dimmed' : ''].filter(Boolean).join(' ');
    const badgeClasses = 'status-badge ' + tone;
    const title = '点击定位至' + v.title + '（有效覆盖 ' + desc.validPctText + '）';
    if (v.card.className !== classes) v.card.className = classes;
    if (v.card.dataset.geomState !== geomState.kind) v.card.dataset.geomState = geomState.kind;
    if (v.card.title !== title) v.card.title = title;
    if (v.badge.className !== badgeClasses) v.badge.className = badgeClasses;
    if (v.retry.hidden === geomState.isError) v.retry.hidden = !geomState.isError;
    if (v.meta.hidden !== geomState.isError) v.meta.hidden = geomState.isError;
    setText(v.val, geomState.isError ? '加载失败' : desc.areaText);
    setText(v.badge, badgeText);
    setText(v.meta, '覆盖 ' + desc.validPctText);
    setText(v.geometry, !record && !geomState.isError && !geomState.isLoading ? '没有该月观测，不补零' : geomState.text);
  }
  updateLayoutOffsets();
}

function renderAlerts() {
  const host = $('#alert-stack');
  if (!host) return;
  const parts = [];
  if (state.playbackError) {
    parts.push(`<div class="hud-banner error"><span>⚠ 月度播放已暂停，${esc(state.playbackError)} 未载入。可重新点播放。</span></div>`);
  }

  if (state.webglFallbackNotice) {
    const msg = state.webglFallbackNotice === 'runtime'
      ? '运行中 WebGL 上下文已丢失，已自动回退至 2D Canvas（月份、选中对象与视角已保留，缩放/平移/点选正常可用）。'
      : '当前环境 WebGL 不可用，已自动回退至 2D Canvas（缩放、平移、选点与剖面联动正常可用）。';
    parts.push(`
      <div class="hud-banner info" id="webgl-fallback-notice" data-fallback-kind="${esc(String(state.webglFallbackNotice))}">
        <span>ℹ ${esc(msg)}</span>
        <button type="button" class="hud-banner-btn" id="btn-dismiss-webgl-notice">知道了</button>
      </div>
    `);
  }

  if (state.monthLoadErrors.length) {
    parts.push(`
      <div class="hud-banner error" id="water-load-error">
        <span>⚠ 水面图层加载失败，请重试（${esc(state.monthLoadErrors.map(e => `${e.lakeId}: ${e.message}`).join('; '))}）</span>
        <button type="button" class="hud-banner-btn" id="btn-retry-water" data-retry-water="1">重试</button>
      </div>
    `);
  }

  if (state.exportError) {
    parts.push(`
      <div class="hud-banner error" id="export-load-error">
        <span>⚠ ${esc(state.exportError)}</span>
        <button type="button" class="hud-banner-btn" id="btn-dismiss-export-err">关闭</button>
      </div>
    `);
  }

  host.innerHTML = parts.join('');
  if ($('#btn-retry-water')) $('#btn-retry-water').onclick = () => retryWaterLakes();
  if ($('#btn-dismiss-export-err')) {
    $('#btn-dismiss-export-err').onclick = () => {
      state.exportError = null;
      renderAlerts();
    };
  }
  if ($('#btn-dismiss-webgl-notice')) {
    $('#btn-dismiss-webgl-notice').onclick = () => {
      state.webglFallbackNotice = false;
      renderAlerts();
    };
  }
  updateLayoutOffsets();
}

// ==========================================================================
// Drawer & Backdrop Coordination
// ==========================================================================
const studioTabScroll = new Map();
let lastRenderedStudioTab = null;

function hideInspectorSurface() {
  const insp = $('#inspector-drawer');
  const obs = $('#observatory');
  if (insp) {
    insp.hidden = true;
    insp.dataset.open = 'false';
    insp.removeAttribute('data-tall');
  }
  obs?.classList.remove('inspector-open');
}

function syncSheetBackdrop() {
  const bd = $('#sheet-backdrop');
  if (!bd) return;
  const needBackdrop = isMobileViewport() && state.studioOpen;
  bd.hidden = !needBackdrop;
}

function findWaterwayNode(branchId, itemId) {
  const sections = state.waterwayOverview?.sections || [];
  let branch = sections.find(s => s.id === branchId) || null;
  let item = branch?.items?.find(i => i.id === itemId) || null;
  if (!item && itemId) {
    for (const s of sections) {
      const hit = s.items.find(i => i.id === itemId);
      if (hit) { branch = s; item = hit; break; }
    }
  }
  return { branch, item };
}

function findWaterwayOwnerForFeature(fid) {
  if (!fid || !state.waterwayOverview?.sections) return null;
  for (const s of state.waterwayOverview.sections) {
    for (const it of s.items) {
      if ((it.featureIds || []).includes(fid) || (it.photos || []).includes(fid) || (it.profileIds || []).includes(fid)) {
        return { branch: s, item: it };
      }
    }
  }
  return null;
}

function setWaterwayReturn({ branch = state.waterwayBranch, item = state.waterwayItem, kind = '', actionLabel = '' } = {}) {
  const found = findWaterwayNode(branch, item);
  const bId = found.branch?.id || branch || state.waterwayOverview?.readingOrder?.[0] || 'independent-main-paths';
  const iId = found.item?.id || item || null;
  state.waterwayNav = true;
  state.waterwayBranch = bId;
  state.waterwayItem = iId;
  state.waterwayReturn = {
    branch: bId,
    branchTitle: (found.branch?.title || '水路总览').split('｜')[0],
    item: iId,
    itemTitle: (found.item?.title || found.branch?.title || '当前水路节点').split('：')[0],
    kind,
    actionLabel,
  };
  renderWaterwayReturnPill();
}

function renderWaterwayReturnPill() {
  const pill = $('#waterway-return-pill');
  if (!pill) return;
  const ret = state.waterwayReturn;
  const onWaterwayList = state.studioOpen && state.studioTab === WATERWAY_PANEL;
  const show = Boolean(ret) && !onWaterwayList && !walkMode.active;
  const wasHidden = pill.hidden;
  pill.hidden = !show;
  if (show) {
    const ctxEl = $('#return-waterway-ctx');
    if (ctxEl) {
      const ctx = [ret.itemTitle, ret.actionLabel].filter(Boolean).join(' · ');
      ctxEl.textContent = ctx || ret.branchTitle;
    }
  }
  if (wasHidden !== pill.hidden) updateLayoutOffsets();
}

function returnToWaterwayRoute() {
  const ret = state.waterwayReturn;
  if (ret) {
    state.waterwayBranch = ret.branch;
    state.waterwayItem = ret.item;
  }
  state.waterwayReturn = null;
  if (isMobileViewport() && state.deckExpanded) setDeckExpanded(false);
  if (isMobileViewport() || isCompactViewport()) hideInspectorSurface();
  openWaterwayOverview();
  renderWaterwayReturnPill();
}

function openWaterwayOverview(){
  state.waterwayNav=true;
  state.waterwayReturn = null;
  openStudioDrawer(WATERWAY_PANEL);
  renderWaterwayReturnPill();
  syncUrl();
}

function openStudioDrawer(tab = null) {
  if (tab) state.studioTab = tab;
  if (state.studioTab === WATERWAY_PANEL) state.waterwayReturn = null;
  state.studioOpen = true;
  $('#observatory')?.classList.add('studio-open');
  if (isMobileViewport()) {
    if(!guidedTour.active)setDeckExpanded(false);
    hideInspectorSurface();
  } else if (isCompactViewport() && state.selectedFeatureId) {
    hideInspectorSurface();
  }
  const drawer = $('#studio-drawer');
  drawer.hidden = false;
  drawer.dataset.open = 'true';
  $$('[data-drawer-tab]').forEach(b => {
    const active = !b.hidden&&b.dataset.drawerTab === studioSection();
    b.classList.toggle('active', active);
    b.setAttribute('aria-expanded', String(active));
  });
  renderStudioDrawer();
  renderWaterwayReturnPill();
  syncSheetBackdrop();
  updateLayoutOffsets();
}

function closeStudioDrawer() {
  if (lastRenderedStudioTab && $('#studio-drawer-body')) {
    studioTabScroll.set(lastRenderedStudioTab, $('#studio-drawer-body').scrollTop);
  }
  state.studioOpen = false;
  $('#observatory')?.classList.remove('studio-open');
  const drawer = $('#studio-drawer');
  if (drawer) {
    drawer.hidden = true;
    drawer.dataset.open = 'false';
  }
  $$('[data-drawer-tab]').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-expanded', 'false');
  });
  renderWaterwayReturnPill();
  syncSheetBackdrop();
  updateLayoutOffsets();
}

const STUDIO_DESTINATIONS={
  crossings:{parent:'waterway',label:'现场桥涵',back:'返回水路总览'},
  southeast:{parent:'waterway',label:'东南入口 · 同位月度核查',back:'返回水路总览'},
  cases:{parent:'evidence',label:'典型样例 · 水面与地形',back:'返回证据与资料'},
  history:{parent:'evidence',label:'历史纸图与早期线索',back:'返回证据与资料'},
  study:{parent:'evidence',label:'环湖方向与试读',back:'返回证据与资料'},
};
const studioSection=()=>STUDIO_DESTINATIONS[state.studioTab]?.parent||state.studioTab;
function renderStudioLocation(){
 const subnav=$('#studio-subnav');
 if(!subnav)return;
 const sec=studioSection();
 if(sec!=='waterway'&&sec!=='evidence'){
   subnav.hidden=true;
   subnav.dataset.section='';
   subnav.innerHTML='';
   return;
 }
 subnav.hidden=false;
 if(subnav.dataset.section!==sec||!subnav.querySelector('[data-subnav-tab]')){
   const focused=subnav.contains(document.activeElement)?document.activeElement.dataset.subnavTab:null;
   subnav.dataset.section=sec;
   if(sec==='waterway'){
     subnav.innerHTML=`
       <button type="button" class="subnav-btn" data-subnav-tab="waterway" aria-pressed="false">主湖来水路线</button>
       <button type="button" class="subnav-btn sub-se" data-subnav-tab="southeast" aria-pressed="false">东南同位月检</button>
       <button type="button" class="subnav-btn sub-cr" data-subnav-tab="crossings" aria-pressed="false">现场桥涵</button>
     `;
   } else {
     subnav.innerHTML=`
       <button type="button" class="subnav-btn" data-subnav-tab="evidence" aria-pressed="false">证据判断</button>
       <button type="button" class="subnav-btn" data-subnav-tab="cases" aria-pressed="false">典型样例</button>
       <button type="button" class="subnav-btn" data-subnav-tab="history" aria-pressed="false">历史纸图</button>
       <button type="button" class="subnav-btn" data-subnav-tab="docs">资料清单 (389)</button>
     `;
   }
   subnav.querySelectorAll('[data-subnav-tab]').forEach(btn=>{
     btn.onclick=()=>{
       const dest=btn.dataset.subnavTab;
       if(dest==='waterway')openWaterwayOverview();
       else if(dest==='southeast')openSoutheastInspection(state.southeastWindow, state.month, { fly: false });
       else if(dest==='crossings')openCrossingsWorkspace(state.crossingStructure, { fly: false });
       else if(dest==='docs')openCoverageModal();
       else openStudioDrawer(dest);
     };
   });
   if(focused)Array.from(subnav.querySelectorAll('[data-subnav-tab]')).find(b=>b.dataset.subnavTab===focused)?.focus({preventScroll:true});
 }
 subnav.querySelectorAll('[data-subnav-tab]').forEach(btn=>{
   const dest=btn.dataset.subnavTab;
   if(dest==='docs')return;
   const on=state.studioTab===dest;
   btn.classList.toggle('active',on);
   btn.setAttribute('aria-pressed',String(on));
 });
}
let waterwayActionSequence=0;
let waterwayMapDetailsOpen=false;
function applyWaterwayMapLayerAction(action,group=null){
 const previous=state.visibleLayers;
 state.visibleLayers=setWaterwayMapLayers(previous,action,group);
 const wasRemoved=id=>{
   const f=provider.analysisById.get(id), layer=f?.properties?.layer;
   return layer&&previous.has(layer)&&!state.visibleLayers.has(layer)&&!isInScenePreset(id);
 };
 if(state.bottomTab==='profile'&&wasRemoved(state.activeProfileId)){
   state.bottomTab='time';state.profileCursorIdx=-1;renderChartDeck();setDeckExpanded(false);
 }
 if(wasRemoved(state.selectedFeatureId))selectFeature(null);
 updateActiveLayerBadge();syncMapsState();
 if(action==='all'||action==='solo'){
   const sc=$('[data-waterway-map-details]');if(sc)waterwayMapDetailsOpen=sc.open;
   if(state.studioOpen)closeStudioDrawer();
   hideInspectorSurface();
   if(action==='all')fitActiveBounds(AOI_BOUNDS,1.06);
   else {
     const boxes=provider.analysis.features.filter(f=>f.properties.layer===group).map(f=>geometryBounds(f.geometry)).filter(Boolean);
     if(boxes.length)fitActiveBounds([Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),
       Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))],1.6);
   }
 } else if(state.studioOpen&&state.studioTab===WATERWAY_PANEL){
   const label=$('[data-waterway-map-count]');
   if(label)label.textContent=WATERWAY_MAP_GROUPS.filter(g=>state.visibleLayers.has(g.id)).length+'／7 已开启';
   $$('[data-waterway-map-action="toggle"]').forEach(el=>{el.checked=state.visibleLayers.has(el.dataset.waterwayMapGroup);});
 }
}

function renderStudioDrawer() {
  if (!state.studioOpen) return;
  const body = $('#studio-drawer-body');
  if (lastRenderedStudioTab && lastRenderedStudioTab !== state.studioTab) {
    studioTabScroll.set(lastRenderedStudioTab, body.scrollTop);
  }
  const tabChanged = lastRenderedStudioTab !== state.studioTab;
  lastRenderedStudioTab = state.studioTab;

  renderStudioLocation();
  $$('[data-studio-tab]').forEach(t => {
    const isAct = !t.hidden&&t.dataset.studioTab === studioSection();
    t.classList.toggle('active', isAct);
    t.setAttribute('aria-selected', String(isAct));
  });
  $$('[data-drawer-tab]').forEach(b => {
    const active = !b.hidden&&b.dataset.drawerTab === studioSection();
    b.classList.toggle('active', active);
    b.setAttribute('aria-expanded', String(active));
  });

  const finishTabRender = () => {
    if (tabChanged) {
      body.scrollTop = studioTabScroll.get(state.studioTab) || 0;
      if (!prefersReducedMotion()) {
        body.classList.remove('tab-enter');
        void body.offsetWidth;
        body.classList.add('tab-enter');
      }
    }
  };

  if(state.studioTab===WATERWAY_PANEL){
    body.innerHTML=renderWaterwayOverview(state.waterwayOverview,provider.analysisById,{
      branch:state.waterwayBranch,item:state.waterwayItem,result:state.waterwayResult,mapLayers:state.visibleLayers,mapDetailsOpen:waterwayMapDetailsOpen,slopeCluesReady:Boolean(state.slopeRoadClues?.length),slopeCanLocate:!walkMode.active
    });
    const details=body.querySelector('[data-waterway-map-details]');
    if(details)details.addEventListener('toggle',()=>{waterwayMapDetailsOpen=details.open;});
    body.querySelectorAll('[data-waterway-map-action]').forEach(el=>{
      const run=()=>applyWaterwayMapLayerAction(el.dataset.waterwayMapAction,el.dataset.waterwayMapGroup);
      if(el.type==='checkbox')el.onchange=run;else el.onclick=run;
    });
    const showResult=text=>{
      state.waterwayResult=text;
      const el=body.querySelector('[data-waterway-result]');
      if(el)el.textContent=text;
    };
    const updateSlopeShortcut=()=>{
      const on=state.visibleLayers.has(SLOPE_CLUE_LAYER),button=body.querySelector('[data-route-slope-toggle]');
      if(!button)return;
      button.setAttribute('aria-pressed',String(on));button.textContent=on?'隐藏待核标记':'显示待核标记';
      const status=body.querySelector('[data-route-slope-status]');
      if(status)status.textContent=on?'已显示 · 不计入七组':'未显示 · 不计入七组';
    };
    body.querySelector('[data-route-slope-toggle]')?.addEventListener('click',()=>{
      const on=!state.visibleLayers.has(SLOPE_CLUE_LAYER);
      if(on)state.visibleLayers.add(SLOPE_CLUE_LAYER);
      else{
        state.visibleLayers.delete(SLOPE_CLUE_LAYER);
        if(provider.analysisById.get(state.selectedFeatureId)?.properties?.layer===SLOPE_CLUE_LAYER)selectFeature(null);
      }
      updateSlopeShortcut();updateActiveLayerBadge();syncMapsState();
    });
    body.querySelector('[data-route-slope-field]')?.addEventListener('click',()=>{
      selectFeature('slope-local-road-search',{fly:!walkMode.active,showData:true});
      updateSlopeShortcut();
    });
    body.querySelector('[data-route-slope-evidence]')?.addEventListener('click',()=>{
      state.activeEvidenceId=SLOPE_CLUE_LAYER;state.evidenceFilter='ALL';openStudioDrawer('evidence');
      body.querySelector('[data-ev-card="slope-road-clues"]')?.scrollIntoView({block:'nearest'});
    });
    for(const details of body.querySelectorAll('[data-route-branch]')){
      details.querySelector('summary').onclick=()=>{
        if(details.open)return;
        state.waterwayBranch=details.dataset.routeBranch;
        state.waterwayItem=null;
        for(const other of body.querySelectorAll('[data-route-branch]')){
          if(other!==details)other.open=false;
          other.querySelectorAll('[data-route-item].active').forEach(x=>x.classList.remove('active'));
        }
        syncUrl();
      };
    }
    body.querySelectorAll('[data-route-action]').forEach(btn=>btn.onclick=async()=>{
      const {routeAction:kind,routeTarget:id}=btn.dataset;
      const group=btn.closest('[data-route-branch]');
      const item=btn.closest('[data-route-item]');
      const targetBranch=group?.dataset.routeBranch||state.waterwayBranch;
      const targetItem=item?.dataset.routeItem||state.waterwayItem;

      if(kind==='archive'){
        if(targetBranch || targetItem) setWaterwayReturn({ branch: targetBranch, item: targetItem, kind: 'archive', actionLabel: btn.textContent.trim() });
        if(id==='bridge'||id==='culvert')openCrossingsWorkspace(id==='bridge'?'f1_bridge':'round_culvert',{fly:false});
        else if(id==='docs')openCoverageModal();
        else if(id==='southeast')openSoutheastInspection();
        else if(id==='cases'||id==='history')openStudioDrawer(id);
        else {state.activeEvidenceId=F1_EVIDENCE_ID;state.evidenceFilter='ALL';openStudioDrawer('evidence');}
        return;
      }

      state.waterwayBranch=targetBranch;
      state.waterwayItem=targetItem;
      body.querySelectorAll('[data-route-item]').forEach(n=>n.classList.toggle('active',n===item));
      syncUrl();

      if(kind==='guide'){
        setWaterwayReturn({ branch: targetBranch, item: targetItem, kind: 'guide', actionLabel: '正在看导览站点' });
        openGuidedTour(btn,id);
        return;
      }

      if(kind==='imagery'){
        setWaterwayReturn({ branch: targetBranch, item: targetItem, kind: 'imagery', actionLabel: '影像 ' + btn.textContent.trim().slice(0, 14) });
        showResult('正在载入 '+btn.textContent.trim());
        const ticket=++waterwayActionSequence;
        const ok=await fixedHistory.openScene?.(id);
        if(ticket!==waterwayActionSequence)return;
        showResult(ok?'已显示该景影像；水面统计月份未切换。':'该景未能载入，未用其他日期替代。');
        if(ok&&isMobileViewport()&&state.studioOpen&&state.studioTab===WATERWAY_PANEL)closeStudioDrawer();
        renderWaterwayReturnPill();
        return;
      }
      waterwayActionSequence++;
      const f=provider.analysisById.get(id);
      if(!f){showResult('未找到该对象，保留当前地图。');return;}
      state.waterwayFeature=id;
      const actionLabel = kind==='photo' ? '正在看实拍照片' : kind==='profile' ? '正在看地形剖面' : '正在看地图位置';
      setWaterwayReturn({ branch: targetBranch, item: targetItem, kind, actionLabel });
      showResult((kind==='photo'?'已打开照片：':kind==='profile'?'已打开剖面：':'已定位：')+(f.properties?.name||id));
      if(kind==='profile'){
        if(!openLinkedProfile(id))showResult('剖面未载入，保留当前地图。');
      } else {
        selectFeature(id,{fly:true,showData:kind==='feature'});
      }
      renderWaterwayReturnPill();
    });
    finishTabRender();
    requestAnimationFrame(()=>{
      const active=body.querySelector('[data-route-item].active');
      if(state.studioOpen&&state.studioTab===WATERWAY_PANEL&&active)active.scrollIntoView({block:'nearest'});
    });
    return;
  }

  if (state.studioTab === 'study') {
    body.innerHTML = studyPanelHtml(provider,{pointsOn:state.visibleLayers.has(STUDY_LAYER)});
    body.querySelector('[data-study-back]').onclick=()=>openStudioDrawer('evidence');
    const toggle = body.querySelector('[data-study-points]');
    if (toggle) toggle.onchange = () => {
      if (toggle.checked) state.visibleLayers.add(STUDY_LAYER);
      else {
        state.visibleLayers.delete(STUDY_LAYER);
        if (provider.analysisById.get(state.selectedFeatureId)?.properties?.layer === STUDY_LAYER) selectFeature(null);
      }
      updateActiveLayerBadge();
      syncMapsState();
      syncUrl();
    };
    body.querySelectorAll('[data-study-point]').forEach(b=>b.onclick=()=>{
      if (toggle) toggle.checked=true;
      selectFeature(b.dataset.studyPoint,{fly:true});
    });
    body.querySelectorAll('[data-study-month]').forEach(b=>b.onclick=()=>{
      setMapLakeScope('BOTH');
      void selectMonth(b.dataset.studyMonth,{timeline:true});
    });
    const scenes=springScenes(provider);
    const buttons=[...body.querySelectorAll('[data-study-april]')];
    let sceneSeq=0;
    buttons.forEach(b=>b.onclick=()=>{
      const seq=++sceneSeq, sc=scenes[Number(b.dataset.studyApril)];
      const img=body.querySelector('[data-study-april-img]'), cap=body.querySelector('[data-study-april-caption]');
      if (!sc || !img || !cap) return;
      for(const btn of buttons){
        btn.classList.toggle('active',btn===b);
        btn.setAttribute('aria-pressed',String(btn===b));
      }
      img.style.visibility='hidden';
      cap.textContent='正在载入 '+sc.date+' · 不改变主地图月份';
      img.src=sc.path;
      img.alt=sc.date+' 同范围 Sentinel-2 真彩';
      void img.decode().then(()=>{
        if(seq!==sceneSeq || !img.isConnected)return;
        img.style.visibility='';
        cap.textContent='拍摄日 '+sc.date+' · 固定同一范围 · 不叠加月度水面';
      }).catch(()=>{
        if(seq===sceneSeq && img.isConnected)cap.textContent=sc.date+' 真彩未能载入；不替换成其他日期。';
      });
    });
    finishTabRender();
    return;
  }

  if (state.studioTab === 'crossings') {
    const structId = state.crossingStructure === 'round_culvert' ? 'round_culvert' : 'f1_bridge';
    const spec = STRUCTURE_CROSSING_SPECS[structId];
    const isF1 = structId === 'f1_bridge';
    const activeScene = BRIDGE_CARD_IMAGERY.find(sc => sc.basemapId === state.basemap) || null;
    const neOn = state.visibleLayers.has('bridge-f1-ne-branch');
    const seOn = state.visibleLayers.has('bridge-f1-se-branch');
    const rawOn = state.visibleLayers.has('bridge-f1-diag-raw');
    const culvOn = state.visibleLayers.has('culvert-diag-branches');
    const wc2OptOn = state.visibleLayers.has('wc2-optical-review');

    body.innerHTML = `
      <div class="cr-panel" data-crossing-structure="${esc(structId)}">
        <div class="drawer-card featured">
          <div class="card-kicker">
            <span>现场桥涵 · 照片、桥位与候选支路对照</span>
            <span>两处独立核查</span>
          </div>
          <div class="cr-struct-switch" role="group" aria-label="切换现场桥涵核查对象（两处独立，不串联）">
            <button type="button" class="cr-struct-btn ${isF1 ? 'active' : ''}" data-cr-select="f1_bridge">
              <strong>① 三八水库中桥</strong>
              <small>G332 · F1 · 雨后/融雪首查</small>
            </button>
            <button type="button" class="cr-struct-btn culvert ${!isF1 ? 'active' : ''}" data-cr-select="round_culvert">
              <strong>② 地方道路圆涵</strong>
              <small>单独查 · 不与桥串成一条</small>
            </button>
          </div>
          <div class="cr-sep-banner" style="margin-top:7px">
            ${isF1
              ? '<strong>首查重点：</strong>三八水库中桥东口 → 约 717 m 老转折先查是否连通（不画实线），再判断往东池（东北）与往主湖（东南）是否为同一次来水分流。'
              : '<strong>严格独立：</strong>圆涵距三八水库中桥约 1.57 km，单独核查东口接沟与约 422 m 浅洼 LOW-A，不与三八水库中桥或办公院串成一条水路。'}
          </div>
          <div class="ev-links" style="margin-top:7px">
            ${isF1
              ? `<button type="button" class="mini-pill accent-pill" id="btn-cr-fit-six">◎ 六点同屏对照</button>
                 <button type="button" class="mini-pill" id="btn-cr-focus-bridge">◇ 三八水库中桥桥位</button>
                 <button type="button" class="mini-pill" id="btn-cr-focus-bend">◇ 桥东老转折窗口</button>`
              : `<button type="button" class="mini-pill accent-pill" id="btn-cr-fit-culvert">◎ 圆涵→LOW-A 对照</button>
                 <button type="button" class="mini-pill" id="btn-cr-focus-lowa">◇ LOW-A 停点(422m)</button>`}
            <button type="button" class="mini-pill" id="btn-cr-open-roadside">📈 道路两侧地形剖面</button>
          </div>
        </div>

        <div class="drawer-card">
          <div class="card-kicker">
            <span>实拍照片与相机位置（相机点 ≠ 构造物底高）</span>
            <span>点击在图对照</span>
          </div>
          <div class="cr-photo-strip">
            ${spec.photos.map(ph => `
              <button type="button" class="cr-photo-tile ${state.selectedFeatureId === ph.id ? 'active' : ''}" data-cr-photo="${esc(ph.id)}" title="${esc(ph.role)}">
                <img src="./field-photo-thumbs/${esc(ph.id)}.jpg" alt="${esc(ph.label)}" loading="lazy">
                <span>${esc(ph.label)}</span>
              </button>
            `).join('')}
          </div>
          <p class="card-note">仅限本机离线查看；照片编号是文件尾号而非年份。点选后地图同步标出相机点与朝向，并与桥位/涵位分开展示。</p>
        </div>

        ${isF1 ? `
          <div class="drawer-card">
            <div class="card-kicker">
              <span>桥后候选方向分层对照</span>
              <span>地形模型，非实测支路</span>
            </div>
            <label class="layer-row">
              <span class="layer-left">
                <input type="checkbox" id="chk-cr-f1-ne" ${neOn ? 'checked' : ''}>
                <span class="swatch br-ne" style="width:16px"></span>
                <span><strong>东北候选方向</strong>（东北暗纹端 → 东池 · 双模型填洼一致）</span>
              </span>
              <span class="layer-count">2</span>
            </label>
            <label class="layer-row">
              <span class="layer-left">
                <input type="checkbox" id="chk-cr-f1-se" ${seOn ? 'checked' : ''}>
                <span class="swatch br-se" style="width:16px"></span>
                <span><strong>东南候选方向</strong>（东南暗纹端 → 主湖 · 交次级路处距圆涵 827–933 m）</span>
              </span>
              <span class="layer-count">2</span>
            </label>
            <label class="layer-row">
              <span class="layer-left">
                <input type="checkbox" id="chk-cr-f1-raw" ${rawOn ? 'checked' : ''}>
                <span class="swatch" style="width:16px;height:0;border-top:2px dotted #94a3b8"></span>
                <span><strong>桥东四个起算窗</strong>（原地表停点 8 条、填洼去向 5 条；填洼不是过水证据）</span>
              </span>
              <span class="layer-count">13</span>
            </label>
            <div class="ev-links" style="margin-top:6px">
              ${F1_SIX_POINTS.map(pt => `
                <button type="button" class="mini-pill" data-cr-six-pt="${esc(pt.id)}">◎ ${esc(pt.label.replace('呼吉尔诺尔 · ', ''))}</button>
              `).join('')}
              <button type="button" class="mini-pill" data-cr-fid="west-slope-model-cross">◇ 北侧模型点(非桥)</button>
            </div>
            <p class="card-note">两条候选走向与桥东→老转折分别绘制：桥东肩两套模型均未进老转折 30 m 窗，不画成已证实的一分二路线。</p>
          </div>

          <div class="drawer-card">
            <div class="card-kicker">
              <span>桥后支路影像选择（按景 ID + 范围绑定）</span>
              <span>六点全覆盖</span>
            </div>
            <div class="cr-scene-grid" role="group" aria-label="选择覆盖六点的真彩影像景">
              ${BRIDGE_CARD_IMAGERY.map(sc => {
                const cov = checkSixPointCoverage(sc.bounds_wgs84);
                const act = state.basemap === sc.basemapId;
                return `
                  <button type="button" class="cr-scene-btn ${act ? 'active' : ''}" data-cr-scene-id="${esc(sc.scene_id)}" data-cr-basemap="${esc(sc.basemapId)}" title="${esc(sc.scene_id)} · ${esc(sc.sourceManifest)}">
                    <strong>${esc(sc.shortLabel)}</strong>
                    <small>${esc(sc.sensor)} · ${cov.coversAll ? '6/6 点覆盖' : '缺覆盖'}</small>
                  </button>
                `;
              }).join('')}
              ${BRIDGE_CARD_EXCLUDED_SCENES.map(ex => `
                <button type="button" class="cr-scene-btn excluded" disabled title="${esc(ex.reason)}" data-cr-excluded-scene="${esc(ex.scene_id)}">
                  <strong>2021-07-21 (S2 窄)</strong>
                  <small>仅主湖 · 已禁用于支路卡</small>
                </button>
              `).join('')}
            </div>
            <div class="cr-scene-meta" id="cr-active-scene-meta">
              ${activeScene
                ? `<div><strong>当前绑定景 ID：</strong><code>${esc(activeScene.scene_id)}</code></div>
                   <div>范围：<code>[${activeScene.bounds_wgs84.map(n => n.toFixed(4)).join(', ')}]</code> · 来源：<code>${esc(activeScene.sourceManifest)}</code></div>
                   <div style="margin-top:3px">${esc(activeScene.note)}</div>`
                : `<div>当前底图：<code>${esc(state.basemap)}</code>（点上方任一六点全覆盖景 ID 即刻按原裁片范围切换）。</div>`}
              <div style="margin-top:3px;color:var(--cand-ink)">注意：Sentinel-2 10 m 大片显示掩膜保留 20 m SCL 投影阴影（类 2），看见暗带或高保留率均不能判定有水；2021-07-21 同天 S2 窄裁片不含桥、老转折与两处纹理末端。</div>
            </div>
          </div>
        ` : `
          <div class="drawer-card">
            <div class="card-kicker">
              <span>圆涵下游两处缺口与双模型对照</span>
              <span>独立于三八水库中桥</span>
            </div>
            <label class="layer-row">
              <span class="layer-left">
                <input type="checkbox" id="chk-cr-wc2-opt" ${wc2OptOn ? 'checked' : ''}>
                <span class="swatch cand" style="width:16px;height:9px"></span>
                <span><strong>圆涵下游四期影像核查段与 LOW-A 停点</strong>（前 1 km 未检出水类）</span>
              </span>
              <span class="layer-count">5</span>
            </label>
            <label class="layer-row">
              <span class="layer-left">
                <input type="checkbox" id="chk-cr-culv-diag" ${culvOn ? 'checked' : ''}>
                <span class="swatch mod" style="width:16px;height:9px"></span>
                <span><strong>圆涵东侧双模型诊断线</strong>（原地表停下 vs 填洼趋主湖，无稳定分叉）</span>
              </span>
              <span class="layer-count">24</span>
            </label>
            <div class="ev-links" style="margin-top:6px">
              <button type="button" class="mini-pill" data-cr-fid="field-photo-2020">◉ 圆涵 2020 相机</button>
              <button type="button" class="mini-pill" data-cr-fid="wc2-review-stop">◇ LOW-A 停点</button>
              <button type="button" class="mini-pill" data-cr-fid="wc2-review-fringe">┄ 主湖末段对照</button>
            </div>
            <p class="card-note">旧 Wcross2 模型首格未跨道路（距中心线约 31.7 m，距 2020 相机约 29.5 m）；两处缺口接上前不画成入湖实线。</p>
          </div>
        `}

        <div class="drawer-card">
          <div class="card-kicker">
            <span>道路两侧双地表复核（Copernicus / AW3D30）</span>
            <span>${esc(spec.dualDemStats.stations)}</span>
          </div>
          <div class="se-readout-grid" style="grid-template-columns:1fr 1fr">
            <div class="se-stat-box">
              <small>Copernicus 中心站西−东</small>
              <strong>${esc(spec.dualDemStats.copCenterM)}</strong>
            </div>
            <div class="se-stat-box">
              <small>AW3D30 中心站西−东</small>
              <strong>${esc(spec.dualDemStats.awCenterM)}</strong>
            </div>
          </div>
          <p class="card-note">${esc(spec.dualDemStats.caveat)}</p>
          <table class="kv-table" style="margin-top:6px">
            ${spec.geometryFacts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
          </table>
        </div>

        <details class="tech-details" open>
          <summary>安全雨后 / 融雪现场核查步骤</summary>
          <ol class="cr-check-list">
            ${spec.rainChecklist.map(step => `<li>${esc(step)}</li>`).join('')}
          </ol>
        </details>

        <details class="tech-details">
          <summary>查看四期真彩地貌对照图（2025-05 / 2026-04 / 2026-08）</summary>
          <img class="cr-comp-img" src="${esc(spec.comparisonImg)}" alt="${esc(spec.comparisonCaption)}" loading="lazy">
          <p class="card-note">${esc(spec.comparisonCaption)}</p>
        </details>
      </div>
    `;

    body.querySelectorAll('[data-cr-select]').forEach(btn => {
      btn.onclick = () => openCrossingsWorkspace(btn.dataset.crSelect, { fly: true });
    });
    body.querySelectorAll('[data-cr-photo]').forEach(btn => {
      btn.onclick = () => {
        state.visibleLayers.add(FIELD_LAYER);
        updateActiveLayerBadge();
        selectFeature(btn.dataset.crPhoto, { fly: true });
        if (!isMobileViewport() && state.studioOpen && state.studioTab === 'crossings') renderStudioDrawer();
      };
    });
    body.querySelectorAll('[data-cr-fid]').forEach(btn => {
      btn.onclick = () => selectFeature(btn.dataset.crFid, { fly: true });
    });
    body.querySelectorAll('[data-cr-six-pt]').forEach(btn => {
      btn.onclick = () => {
        const pt = F1_SIX_POINTS.find(x => x.id === btn.dataset.crSixPt);
        if (!pt) return;
        if (pt.lakeId) {
          fitActiveBounds(provider.waterIndex.lakes[pt.lakeId].bounds_wgs84, 1.55);
        } else if (pt.featureId && provider.analysisById.has(pt.featureId)) {
          selectFeature(pt.featureId, { fly: true });
        } else {
          flyActiveMap({ lon: pt.lonlat[0], lat: pt.lonlat[1], spanKm: 1.4 });
        }
      };
    });
    if ($('#btn-cr-fit-six')) {
      $('#btn-cr-fit-six').onclick = () => {
        state.crossingCompare = { mode: 'f1_bridge' };
        state.visibleLayers.add('west-slope-review');
        state.visibleLayers.add('bridge-f1-anchors');
        state.visibleLayers.add('nearby-pools');
        state.visibleLayers.add(FIELD_LAYER);
        updateActiveLayerBadge();
        syncMapsState();
        fitCrossingBounds(F1_SIX_POINT_BOUNDS, 1.15);
      };
    }
    if ($('#btn-cr-focus-bridge')) {
      $('#btn-cr-focus-bridge').onclick = () => selectFeature('west-slope-f1-bridge', { fly: true });
    }
    if ($('#btn-cr-focus-bend')) {
      $('#btn-cr-focus-bend').onclick = () => selectFeature('west-slope-old-bend', { fly: true });
    }
    if ($('#btn-cr-fit-culvert')) {
      $('#btn-cr-fit-culvert').onclick = () => {
        state.crossingCompare = { mode: 'round_culvert' };
        state.visibleLayers.add(FIELD_LAYER);
        state.visibleLayers.add('wc2-optical-review');
        state.visibleLayers.add('culvert-diag-branches');
        updateActiveLayerBadge();
        syncMapsState();
        fitCrossingBounds(CULVERT_COMPARE_BOUNDS, 1.18);
      };
    }
    if ($('#btn-cr-focus-lowa')) {
      $('#btn-cr-focus-lowa').onclick = () => selectFeature('wc2-review-stop', { fly: true });
    }
    if ($('#btn-cr-open-roadside')) {
      $('#btn-cr-open-roadside').onclick = () => {
        const pid = spec.roadsideProfiles[0];
        openLinkedProfile(pid);
      };
    }
    const toggleDiag = (elId, lyId) => {
      const el = $(elId);
      if (!el) return;
      el.onchange = e => {
        if (e.target.checked) state.visibleLayers.add(lyId);
        else state.visibleLayers.delete(lyId);
        updateActiveLayerBadge();
        syncMapsState();
      };
    };
    toggleDiag('#chk-cr-f1-ne', 'bridge-f1-ne-branch');
    toggleDiag('#chk-cr-f1-se', 'bridge-f1-se-branch');
    toggleDiag('#chk-cr-f1-raw', 'bridge-f1-diag-raw');
    toggleDiag('#chk-cr-wc2-opt', 'wc2-optical-review');
    toggleDiag('#chk-cr-culv-diag', 'culvert-diag-branches');

    body.querySelectorAll('[data-cr-basemap]').forEach(btn => {
      btn.onclick = () => {
        fixedHistory.disable?.();
        setBasemap(btn.dataset.crBasemap);
        fitCrossingBounds(F1_SIX_POINT_BOUNDS, 1.15);
      };
    });

    finishTabRender();
    return;
  }

  if (state.studioTab === 'southeast') {
    if (!state.southeastFixture) {
      body.innerHTML = `<div class="drawer-card"><p class="card-note">东南入口月度验收样例未载入（不影响月度主图谱）。</p></div>`;
      finishTabRender();
      return;
    }
    const snap = getActiveSoutheastSnapshot();
    const activeWin = SE_WINDOWS[state.southeastWindow];
    const quickMonths = activeWin.quickMonths;
    const cellChips = [
      ...(snap.wetCells || []).map(([r, c]) => `<span class="se-cell-chip ${snap.kind === 'water_main' ? 'wet-main' : 'wet-sep'}">[${r},${c}] 明水</span>`),
      ...(snap.nodataCells || []).map(([r, c]) => `<span class="se-cell-chip nd">[${r},${c}] 缺测</span>`),
    ];

    body.innerHTML = `
      <div class="se-panel" data-se-window="${esc(state.southeastWindow)}" data-se-month="${esc(state.month)}" data-se-kind="${esc(snap.kind)}">
        <div class="drawer-card featured">
          <div class="card-kicker">
            <span>东南入口同位月度切换</span>
            <span>JRC 月度 · 固定机位</span>
          </div>
          <div class="se-win-switch" role="group" aria-label="选择东南观测窗口（两个独立位置，不互相替代）">
            ${[SE_PRIMARY_WINDOW, SE_CLUSTER7_WINDOW].map(wid => {
              const w = SE_WINDOWS[wid];
              const act = wid === state.southeastWindow;
              return `
                <button type="button" class="se-win-btn ${act ? 'active' : ''}" data-se-select-win="${esc(wid)}">
                  <strong>
                    <span>${esc(w.title)}</span>
                    <span class="layer-count">${w.totalCells} 格</span>
                  </strong>
                  <small>${esc(w.domainLabel)}</small>
                </button>
              `;
            }).join('')}
          </div>
          <div class="ev-links" style="margin-top:7px">
            <button type="button" class="mini-pill ${state.southeastEnabled ? 'accent-pill' : ''}" id="btn-se-toggle-overlay">
              ${state.southeastEnabled ? '✓ 地图格网已叠合' : '⊞ 在地图叠合原生格网'}
            </button>
            <button type="button" class="mini-pill" id="btn-se-center">◎ 居中锚点</button>
            <button type="button" class="mini-pill" id="btn-se-open-e20">📈 打开 E20 剖面</button>
          </div>
          <p class="card-note">切月保持当前地图镜头与背景底图不变；切换窗口不改日期与镜头。两窗口中心相距 57.01 m，仅重叠 2 格 [64,126]、[64,127]。</p>
        </div>

        <div class="drawer-card">
          <div class="card-kicker">
            <span>同位月度切换（${esc(snap.productLabel)}）</span>
            <button type="button" class="mini-pill ${state.southeastStepping ? 'accent-pill' : ''}" id="btn-se-step-play">
              ${state.southeastStepping ? '⏸ 停止对照' : '▶ 顺序对照'}
            </button>
          </div>
          <div class="se-month-strip" role="group" aria-label="切换东南观测月份">
            ${quickMonths.map(dt => `
              <button type="button" class="se-month-btn ${state.month === dt ? 'active' : ''} ${dt === '2014-08' ? 'nodata-case' : ''}" data-se-month-btn="${esc(dt)}">
                ${esc(dt)}${dt === '2014-08' ? ' · 缺测' : ''}
              </button>
            `).join('')}
          </div>
          <p class="card-note">动画仅用于同位静态比较，不表示流向、流量或连通变化。</p>
        </div>

        <div class="drawer-card" id="se-atomic-readout" data-se-date="${esc(snap.date)}" data-se-kind="${esc(snap.kind)}">
          <div class="card-kicker">
            <span>同帧核查读数 · ${esc(snap.date)}</span>
            <span>${esc(snap.windowShortLabel)}</span>
          </div>

          <div class="se-relation-banner" data-tone="${esc(snap.relationTone)}">
            <strong id="se-headline">${esc(snap.headline)}</strong>
            <span id="se-relation">${esc(snap.patchRelation)}</span>
          </div>

          <div class="se-readout-grid" style="margin-top:7px">
            <div class="se-stat-box">
              <small>窗口明水格</small>
              <strong id="se-stat-water">${snap.waterCount === null ? '—' : `${snap.waterCount} / ${snap.totalCells}`}</strong>
            </div>
            <div class="se-stat-box">
              <small>与主盆同斑</small>
              <strong id="se-stat-main">${snap.sameMainCount === null ? '—' : `${snap.sameMainCount} 格`}</strong>
            </div>
            <div class="se-stat-box">
              <small>有效 / 缺测</small>
              <strong id="se-stat-valid">${snap.validCount === null ? '—' : `${snap.validCount} / ${snap.nodataCount}`}</strong>
            </div>
          </div>

          <table class="kv-table" style="margin-top:7px">
            <tr><th>整湖月度态</th><td id="se-whole-lake">${esc(snap.wholeLake.text)}</td></tr>
            <tr><th>历史锚点</th><td>${esc(snap.anchorLabel)}</td></tr>
            ${snap.diagnostics ? `<tr><th>分量核对</th><td>${esc(snap.diagnostics)}</td></tr>` : ''}
          </table>

          ${cellChips.length ? `
            <div style="margin-top:7px">
              <div class="insp-section-lbl">原生 0 起算格号 [row,col]（0.00025° WGS84）</div>
              <div class="se-cell-chips">${cellChips.join('')}</div>
            </div>
          ` : ''}

          <div class="legend-grid" style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--border-subtle)">
            <div class="legend-row"><span class="swatch obs"></span><span>与主盆同一分类水斑（实蓝）</span></div>
            <div class="legend-row"><span class="swatch se-sep"></span><span>本期未与主盆分类水斑连片（琥珀斜纹虚边）</span></div>
            <div class="legend-row"><span class="swatch nodata"></span><span>局部缺测像元（灰交叉纹，与观测非水分开）</span></div>
          </div>
        </div>

        <details class="tech-details">
          <summary>Sentinel-2 单景并列附证（20 m · 具体拍摄日，不替代月度态）</summary>
          <p class="card-note" style="margin-bottom:5px">三景 20 m UTM 像元（东南 B 60 m 内均为 27/27 有效）与 JRC 月度产品方法不同，独立并列对照，不拼成同一序列：</p>
          <table class="kv-table">
            <thead><tr><th>拍摄日</th><th>SCL6 / 中心水样 / 主盆同斑</th></tr></thead>
            <tbody>
              ${SE_SENTINEL2_SCENES.map(s => `
                <tr>
                  <td>${esc(s.date)}</td>
                  <td>${s.scl6} / ${s.coreWater} / ${s.sameMain}（${esc(s.relation)}）</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </details>

        <details class="tech-details">
          <summary>口径边界与双窗差异说明（57.01 m / 仅 2 格重叠）</summary>
          <p class="card-note">${esc(activeWin.note)}</p>
          <p class="card-note">未检出明水仅代表该月分类未检出水体，不等于地面干燥或无来水；像元相邻属于离散分类空间关系，不代表水力连通或入湖通堵。</p>
        </details>
      </div>
    `;

    body.querySelectorAll('[data-se-select-win]').forEach(btn => {
      btn.onclick = () => {
        stopSoutheastStepping();
        state.southeastWindow = btn.dataset.seSelectWin;
        state.southeastEnabled = true;
        syncMapsState();
        renderStudioDrawer();
      };
    });

    $('#btn-se-toggle-overlay').onclick = () => {
      state.southeastEnabled = !state.southeastEnabled;
      syncMapsState();
      renderStudioDrawer();
    };

    $('#btn-se-center').onclick = () => {
      state.southeastEnabled = true;
      state.visibleLayers.add(MAIN_PROFILE_LAYER);
      updateActiveLayerBadge();
      syncMapsState();
      flyActiveMap({ lon: snap.anchor[0], lat: snap.anchor[1], spanKm: 0.52 });
      renderStudioDrawer();
    };

    $('#btn-se-open-e20').onclick = () => {
      const pid = 'main-profile-southeast-inlet';
      openLinkedProfile(pid);
    };

    $('#btn-se-step-play').onclick = () => {
      if (state.southeastStepping) stopSoutheastStepping();
      else startSoutheastStepping();
    };

    body.querySelectorAll('[data-se-month-btn]').forEach(btn => {
      btn.onclick = () => {
        state.southeastEnabled = true;
        // Same-location switch: NEVER move camera or change basemap!
        void selectMonth(btn.dataset.seMonthBtn);
      };
    });

    finishTabRender();
    return;
  }

  if (state.studioTab === 'layers') {
    const mainProfileDef = { id:MAIN_PROFILE_LAYER,name:'主湖剖面 · 来水与湖盆',count:provider.analysis.features.filter(f=>f.properties?.layer===MAIN_PROFILE_LAYER).length };
    const bridgeLayerDefs = BRIDGE_BRANCH_LAYER_IDS.map(id => ({
      id,
      name: BRIDGE_BRANCH_LAYERS[id].name,
      count: provider.analysis.features.filter(f => f.properties?.layer === id).length,
    }));
    const defMap = new Map([{id:OWNER75_LAYER,name:'新增现场标绘 KMZ（5 条）',count:guidedTour.ownerLines?.length||0},{ id:SLOPE_CLUE_LAYER,name:SLOPE_CLUE_NAME,count:state.slopeRoadClues?.length||0 },{ id:OWNER_BLUE_LAYER,name:OWNER_BLUE_NAME,count:state.ownerBlue?.length||0 },{ id:WCROSS_UPSTREAM_LAYER,name:WCROSS_UPSTREAM_NAME,count:state.wcrossUpstream?.filter(f=>f.properties.layer===WCROSS_UPSTREAM_LAYER).length||0 },{id:WCROSS_FAR_LAYER,name:WCROSS_FAR_NAME,count:state.wcrossUpstream?.filter(f=>f.properties.layer===WCROSS_FAR_LAYER).length||0},{ id:F1_WATERWAY_LAYER, name:F1_WATERWAY_NAME, count:state.f1Waterway?.filter(f=>f.properties.layer===F1_WATERWAY_LAYER).length||0 }, {id:F1_COMPARE_LAYER,name:'桥西道路两窗口 · 填洼敏感性（可选）',count:state.f1Waterway?.filter(f=>f.properties.layer===F1_COMPARE_LAYER).length||0}, { id:SEASONAL_LAYER, name:SEASONAL_NAME, count:state.seasonalNetwork?.length || 0 },{id:GUIDE_G332_LAYER,name:'国道 G332 与南部环岛（道路参考）',count:guidedTour.contextPaths?.length||0},...(provider.analysisManifest?.layer_definitions || []), ...OFFICE_DEFS, ...bridgeLayerDefs, { ...NORTH_BOUNDARY_DEF, count: state.northBoundaryReady || 0 }, { id:FIELD_LAYER, name:FIELD_LABEL, count:state.fieldPhotos?.length || 0 }, mainProfileDef, { ...JULY_DEF, count: state.julyWindowsReady || 0 }].map(d => [d.id, d]));
    const subRoleNotes = {
      [SLOPE_CLUE_LAYER]: ['青绿虚框是 2004-05 文件中的浅斑查找范围，不是斑界；琥珀标注为手绘定位点或待查地方路。三个点之间和跨 G332 均不连线。'],
      [OWNER_BLUE_LAYER]: ['用户原稿为九条蓝笔；地图统一用琥珀虚线表示待核草图，不改原笔，不代表流向。'],
      [WCROSS_FAR_LAYER]: ['打开即跳到这组位置。Wcross1 原地形、Wcross2 有条件填洼；灰点线标国道证据缺口，不是通水。'],
      [WCROSS_UPSTREAM_LAYER]: ['打开即定位本组，关闭不影响 G332 西坡对照。',WCROSS_UPSTREAM_LEGEND],
      [F1_COMPARE_LAYER]: ['不是 F1 单桥汇水区。仅显示图谱内部分。默认不显示。'],
      [F1_WATERWAY_LAYER]: [state.f1Waterway?.length ? F1_LEGEND : '专题未载入，不影响原主湖模型汇水分区。'],
      [SEASONAL_LAYER]: [state.seasonalNetwork?.length ? '青绿：影像可见地貌或判读范围；琥珀：待核；灰点线×：证据缺口；蓝面：标明日期的分类水斑；紫线：地表剖面。均不代表已证流向。' : '专题矢量尚未载入；不影响其他图层。'],
      [FIELD_LAYER]: ['相机位置。选中后的箭头为手机记录朝向，未测量，不代表水流。琥珀色为手机报告误差大于 20 米。'],
      [JULY_LAYER]: [state.julyWindowsReady
        ? '边框是三期共同有效的 20 米采样格，不是水面。不随月份切换。'
        : '此次未载入对照窗；不影响月度水面。'],
      'nearby-pools': [
        '● 卫星光学检出水体 (3)',
        '◇ 待核候选水体 (3 · 与实测水体分色显示)',
      ],
      'landsat-2013-quality': [
        '✓ 影像清晰可用 (4 · 仅像元质量，非有水)',
        '✕ 云影遮挡排除 (6 · 非干涸)',
      ],
      's7-repeat-green': [
        '★ 两套地形均稳定偏低正例 (5)',
        '⊘ 非稳定低地对照反例 (2)',
      ],
      'snow-2026': [
        '◆ S7 低地残雪斑块 · ⊘ S3 偏高反例',
      ],
    };

    const toneForLayer=ly=>{
      if(['road-review',NORTH_BOUNDARY_LAYER,OWNER_BLUE_LAYER,'west-slope-user-sketch','west-slope-review'].includes(ly))return 'candidate';
      if(['yimin-profile','yimin-probes','east-profiles','main-catchments','archive-routing',MAIN_PROFILE_LAYER,'bridge-f1-diag-raw','bridge-f1-ne-branch','bridge-f1-se-branch','culvert-diag-branches',F1_COMPARE_LAYER,WCROSS_FAR_LAYER].includes(ly))return 'model';
      if([GUIDE_G332_LAYER,'roads','secondary-roads','yimin-reference','regional-reference',JULY_LAYER].includes(ly))return 'reference';
      return null; // mixed subjects deliberately have no single color
    };
    const layerSwatch=ly=>{
      const id=toneForLayer(ly), t=ANALYSIS_PALETTE[id];
      return t?`<span class="swatch visual-policy-swatch" style="width:16px;height:10px;--policy-color:${t.stroke};--policy-fill:${t.fill}" data-legend-tone="${id}"></span>`:'';
    };

    body.innerHTML = `
      <div class="drawer-card">
        <div class="card-kicker"><span>地图分区 · 主湖与周边对照</span></div>
        <div class="filter-chips">${Object.entries(VIEW_SCOPES).map(([id,k])=>`<button type="button" class="f-chip ${state.scenePreset===id?'active':''}" data-scene-preset="${id}" aria-pressed="${state.scenePreset===id}">${k.label}</button>`).join('')}<button type="button" class="f-chip ${state.focusScope==='marsh'?'active':''}" id="btn-layer-scope-marsh" aria-pressed="${state.focusScope==='marsh'}">东部泥沼</button></div>
        <p class="card-note">分区单独显示，仍可手动开图层；返回「双湖／自选」恢复先前自选。西长湖、北小湖、东池与东部泥沼均为独立周边对照，不与主湖合并。北小湖仍为单期参照。东池在时序中显示 N1 固定观测窗的月分类水面；窗内可含分离水斑，面积不计入双湖统计。覆盖不足不显示水面。</p>
      </div>
      <div class="drawer-card featured">
        <div class="card-kicker"><span>现代矢量等高线</span></div>
        <label class="layer-row">
          <span class="layer-left">
            <input type="checkbox" id="contour-layer-toggle">
            <span class="swatch ctr" style="width:18px"></span>
            <span><strong>现代地形等高线</strong>（叠加于影像与三维）</span>
          </span>
          <span id="contour-layer-count" class="layer-count"></span>
        </label>
        <label class="layer-row">等高距 <select id="contour-distance" class="deck-select" aria-label="现代等高线间隔">${contourControlOptions()}</select></label>
        <p class="card-note">30 米地表模型推导。2 米线更密，适合放大看走势，不代表高程精确到 2 米，不是测量沟底或水位。</p>
        <label class="layer-row"><span class="layer-left"><input type="checkbox" id="slope-aspect-toggle"><span><strong>地形坡向箭头</strong></span></span></label>
        <label class="layer-row">坡向箭头密度 <select id="slope-aspect-density" class="deck-select" aria-label="坡向箭头密度"><option value="10">10 米档 · 疏</option><option value="5">5 米档 · 中</option><option value="2">2 米档 · 密</option></select></label>
        <p class="card-note">密度独立于等高线。箭头表示 30 米地表模型的局部下坡方向；近水平处不绘制，不是水流路径。档位不是 DEM 分辨率。</p>
        <div id="slope-aspect-status" class="card-note" aria-live="polite"></div>
        <div id="contour-load-state" aria-live="polite" class="card-note"></div>
        <button type="button" id="contour-retry" class="mini-pill" style="margin-top:6px" hidden>↻ 重试等高线</button>
      </div>

      <div class="drawer-card history-card">
        <div class="card-kicker">
          <span>历史地图参考（1933–1980）</span>
          <button type="button" class="mini-pill" id="btn-jump-history-notes">查看图幅说明 →</button>
        </div>
        <label class="layer-row">
          <span class="layer-left">
            <input type="checkbox" id="historical-layer-toggle">
            <span class="swatch hist" style="width:18px;height:10px"></span>
            <span><strong>显示全部历史参考图层</strong></span>
          </span>
          <span class="layer-count">43</span>
        </label>
        ${historicalLayers.map(ly => {
          const h = HISTORICAL_LAYERS[ly];
          const checked = state.visibleLayers.has(ly);
          const cnt = historicalFeatures ? historicalFeatures.filter(f => f.properties.layer === ly).length : '—';
          return `
            <label class="layer-row">
              <span class="layer-left">
                <input type="checkbox" data-toggle-layer="${esc(ly)}" id="historical-check-${esc(ly)}" ${checked ? 'checked' : ''}>
                <span class="swatch" style="width:16px;height:9px;background:${h.color}44;border:1.4px dashed ${h.color}"></span>
                <span>${esc(h.name)}</span>
              </span>
              <span class="layer-count" id="historical-count-${esc(ly)}">${cnt}</span>
            </label>
          `;
        }).join('')}
        <p class="card-note">整合苏联、美军及早期纸图上的水域、道路与地标线索，不随月份变化，不代表实测岸线或水路连通。</p>
        <div id="historical-load-state" aria-live="polite" class="card-note"></div>
        <button type="button" id="historical-retry" class="mini-pill" style="margin-top:6px" hidden>↻ 重试历史图层</button>
      </div>

      <div class="drawer-card">
        <div class="card-kicker"><span>多期影像核查</span><span>Wayback</span></div>
        ${WAYBACK_IDS.map(ly => {
          const d = WAYBACK_LAYERS[ly];
          return `<label class="layer-row">
            <span class="layer-left">
              <input type="checkbox" data-toggle-layer="${ly}" ${state.visibleLayers.has(ly) ? 'checked' : ''}>
              <span class="swatch" style="width:16px;height:9px;background:${d.color}44;border:1.4px dashed ${d.color}"></span>
              <span>${esc(d.name)}</span>
            </span>
            <span class="layer-count">${d.count}</span>
          </label>`;
        }).join('')}
        <p class="card-note">31 个历史影像判读要素，不随统计年月变化，也不证明明沟、涵洞或水力连通。更北侧复核窗仅在二维完整显示。</p>
        <div id="wayback-load-state" aria-live="polite" class="card-note"></div>
        <button type="button" id="wayback-retry" class="mini-pill" hidden>↻ 重试影像核查图层</button>
      </div>

      <div class="drawer-card">
        <div class="card-kicker"><span>双湖统计范围（489 月）</span><span>JRC 月度水面</span></div>
        <div class="filter-chips" style="margin-bottom:4px">
          ${[['BOTH', '双湖并列'], ['MAIN', '仅看主湖'], ['WF1', '仅看西长湖']].map(([k, lbl]) => `
            <button type="button" class="f-chip ${state.lakeView === k ? 'active' : ''}" data-lake-view="${k}">${lbl}</button>
          `).join('')}
        </div>
        <p class="card-note">主湖与西长湖各自使用固定统计范围分别计算，不合并面积。</p>
      </div>

      <div class="drawer-card">
        <div class="card-kicker"><span>背景底图与地形晕渲</span><span>独立于水面月</span></div>
        <div class="filter-chips" style="margin-bottom:0">
          ${[
            ['sentinel2-2026-08-08', '2026-08 盛夏'],
            ['sentinel2-2025-05-28', '2025-05 春末'],
            ['sentinel2-2026-04-01', '2026-04-01 残雪'],
            ['sentinel2-2026-04-08', '2026-04-08 退雪'],
            ['dem-relief', '纯地形晕渲'],
          ].map(([k, lbl]) => `
            <button type="button" class="f-chip ${state.basemap === k ? 'active' : ''}" data-drawer-bm="${k}">${lbl}</button>
          `).join('')}
        </div>
      </div>

      
      ${LAYER_GROUPS.filter(g => g.id !== 'historical-context').map(grp => `
        <div class="drawer-card">
          <div class="card-kicker"><span>${esc(grp.title)}</span></div>
          ${grp.layers.map(ly => {
            const def = defMap.get(ly) || { id: ly, name: ly, count: 0 };
            const checked = state.visibleLayers.has(ly);
            const notes = subRoleNotes[ly];
            return `
              <label class="layer-row">
                <span class="layer-left">
                  <input type="checkbox" data-toggle-layer="${esc(ly)}" ${((ly==='secondary-roads') || (ly === JULY_LAYER && !state.julyWindowsReady) || (ly === SEASONAL_LAYER && !state.seasonalNetwork?.length) || (ly === F1_WATERWAY_LAYER && !state.f1Waterway?.length) || (ly === OWNER_BLUE_LAYER && !state.ownerBlue?.length) || (ly === SLOPE_CLUE_LAYER && !state.slopeRoadClues?.length) || ((ly === WCROSS_UPSTREAM_LAYER || ly === WCROSS_FAR_LAYER) && !state.wcrossUpstream?.some(f=>f.properties.layer===ly)) || (ly === F1_COMPARE_LAYER && !state.f1Waterway?.some(f=>f.properties.layer===F1_COMPARE_LAYER))) ? 'disabled' : ''} ${checked ? 'checked' : ''}>
                  ${layerSwatch(ly)}
                  <span>${esc(ly==='secondary-roads'?'次级道路（常驻）':ly==='nearby-pools'?'叠加全部周边水体样本（仅比较）':def.name)}</span>
                </span>
                <span class="layer-count">${def.count}</span>
              </label>
              ${ly===F1_COMPARE_LAYER && checked ? `<div class="ev-links">${state.f1Waterway.filter(f=>f.properties.layer===F1_COMPARE_LAYER).map(f=>`<button type="button" class="mini-pill" data-f1-compare-fid="${esc(f.id)}">${esc(f.properties.name)}</button>`).join('')}</div>` : ''}
              ${(ly===WCROSS_UPSTREAM_LAYER||ly===WCROSS_FAR_LAYER)&&checked ? `<button type="button" class="mini-pill" data-locate-wcross="${ly}">定位本组线段</button>` : ''}
              ${ly===F1_WATERWAY_LAYER && checked ? `<button type="button" class="mini-pill" data-open-f1-waterway>按上下游顺序查看证据</button>` : ''}
              ${ly===SLOPE_CLUE_LAYER && checked && state.slopeRoadClues?.length ? `<div class="ev-links">${walkMode.active?'':'<button type="button" class="mini-pill" data-locate-slope-clues>定位本组</button>'}<button type="button" class="mini-pill" data-open-slope-history>看 2004-05 标记影像</button></div><details class="tech-details"><summary>查看各核查位置</summary><div class="ev-links">${state.slopeRoadClues.map(f=>`<button type="button" class="mini-pill" data-slope-clue-fid="${esc(f.id)}">${esc(f.properties.name)}</button>`).join('')}</div></details>` : ''}
              ${ly===SEASONAL_LAYER && checked && state.seasonalNetwork?.length ? `<details class="tech-details"><summary>按名称定位</summary><div class="ev-links">${state.seasonalNetwork.map(f=>`<button type="button" class="mini-pill" data-seasonal-fid="${esc(f.id)}">${esc(f.properties.name)}</button>`).join('')}</div></details>` : ''}
              ${ly===FIELD_LAYER && checked && state.fieldPhotos?.length ? `<details class="tech-details" style="margin:4px 0 9px"><summary>按拍摄顺序浏览 ${state.fieldPhotos.length} 张</summary><div class="ev-links">${state.fieldPhotos.map(f=>`<button type="button" class="mini-pill" data-field-list-fid="${esc(f.id)}">${esc(f.id.slice(-4))}</button>`).join('')}</div></details>` : ''}
              ${notes ? `<div class="sub-role-notes">${notes.map(n => `<div style="display:flex;align-items:center;gap:5px">${n}</div>`).join('')}</div>` : ''}
            `;
          }).join('')}
        </div>
      `).join('')}
    `;

    if(!body.querySelector('#study-catchment-screen')){
     const host=document.createElement('div');
     host.id='study-catchment-screen';host.className='drawer-card';host.hidden=true;
     body.children[0]?.after(host);
    }
    renderCatchmentScreen(body.querySelector('#study-catchment-screen'),guidedTour.active?guidedTour.extraLayers:state.visibleLayers);
    $('#contour-distance').onchange=e=>setContourInterval(e.target.value);
    $('#slope-aspect-density').onchange=e=>setSlopeDensity(e.target.value);
    $('#slope-aspect-toggle').onchange=e=>setSlopeEnabled(e.target.checked);
    $('#contour-layer-toggle').onchange = e => setContoursEnabled(e.target.checked);
    $('#contour-retry').onclick = () => { if(guidedTour.active&&guidedTour.contours)void loadContours(guidedTour.contourInterval===2?2:5);else if (contoursEnabled) void loadContours(); };
    updateContourControls();

    $('#historical-layer-toggle').onchange = e => setHistoricalLayers(historicalLayers, e.target.checked);
    $('#historical-retry').onclick = () => { void ensureHistoricalContext(); };
    updateHistoricalControls();

    $('#wayback-retry').onclick = async () => {
      const items = await waybackLoader.ensure();
      if (items && pendingWaybackId) {
        const target = pendingWaybackId;
        pendingWaybackId = null;
        if (provider.analysisById.has(target)) selectFeature(target, { fly: true });
        updateWaybackControls();
      }
    };
    updateWaybackControls();

    $('#btn-jump-history-notes').onclick = () => {
      state.studioTab = 'history';
      renderStudioDrawer();
    };

    body.querySelectorAll('[data-lake-view]').forEach(b => {
      b.onclick = () => {
        stopPlay();
        setMapLakeScope(b.dataset.lakeView);
        updateHeaderPills();
        syncMapsState();
        syncUrl();
        renderLakeChips();
        renderChartDeck();
        renderStudioDrawer();
      };
    });

    body.querySelectorAll('[data-scene-preset]').forEach(b=>b.onclick=()=>chooseScenePreset(b.dataset.scenePreset==='home'?'home':b.dataset.scenePreset===state.scenePreset&&state.scenePreset!=='custom'?'custom':b.dataset.scenePreset));
    $('#btn-layer-scope-marsh')?.addEventListener('click', () => {
      if (state.studioOpen) closeStudioDrawer();
      selectFocusScope('marsh');
    });
    body.querySelectorAll('[data-drawer-bm]').forEach(b => {
      b.onclick = () => {fixedHistory.disable?.();setBasemap(b.dataset.drawerBm);};
    });

    body.querySelectorAll('[data-f1-compare-fid]').forEach(b=>b.onclick=()=>selectFeature(b.dataset.f1CompareFid,{fly:true}));
    body.querySelector('[data-open-f1-waterway]')?.addEventListener('click',()=>{openWaterwayOverview();});
    body.querySelector('[data-locate-slope-clues]')?.addEventListener('click',()=>{
      if(walkMode.active)return;
      const boxes=state.slopeRoadClues.map(f=>geometryBounds(f.geometry));
      const bounds=[Math.min(...boxes.map(x=>x[0])),Math.min(...boxes.map(x=>x[1])),Math.max(...boxes.map(x=>x[2])),Math.max(...boxes.map(x=>x[3]))];
      closeStudioDrawer();
      fitActiveBounds(bounds,1.45);
    });
    body.querySelector('[data-open-slope-history]')?.addEventListener('click',()=>void fixedHistory.openScene?.('ge-root-200405'));
    body.querySelectorAll('[data-slope-clue-fid]').forEach(b=>b.onclick=()=>selectFeature(b.dataset.slopeClueFid,{fly:!walkMode.active}));
    body.querySelectorAll('[data-seasonal-fid]').forEach(b=>{b.onclick=()=>selectFeature(b.dataset.seasonalFid,{fly:true});});
    body.querySelectorAll('[data-field-list-fid]').forEach(b=>{b.onclick=()=>selectFeature(b.dataset.fieldListFid,{fly:true});});
    body.querySelectorAll('[data-locate-wcross]').forEach(btn=>btn.onclick=()=>locateWcrossLayer(btn.dataset.locateWcross));
    body.querySelectorAll('[data-toggle-layer]').forEach(chk => {
      if(guidedTour.active&&!chk.disabled)chk.checked=guidedTour.extraLayers.has(chk.dataset.toggleLayer);
      chk.onchange = e => {
        const ly = chk.dataset.toggleLayer;
        if(guidedTour.active){
          if(e.target.checked)guidedTour.extraLayers.add(ly);else guidedTour.extraLayers.delete(ly);
          if(isHistoricalLayer(ly)){updateHistoricalControls();if(e.target.checked)void ensureHistoricalContext().then(()=>syncMapsState());}
          if(isWaybackLayer(ly)){updateWaybackControls();if(e.target.checked)void waybackLoader.ensure().then(()=>syncMapsState());}
          updateActiveLayerBadge();syncMapsState();return;
        }
        if (isHistoricalLayer(ly)) {
          setHistoricalLayers([ly], e.target.checked);
          return;
        }
        if (e.target.checked) state.visibleLayers.add(ly);
        else {
          state.visibleLayers.delete(ly);
          if(state.bottomTab==='profile'&&provider.analysisById.get(state.activeProfileId)?.properties?.layer===ly){
            state.bottomTab='time';state.profileCursorIdx=-1;renderChartDeck();setDeckExpanded(false);syncUrl();
          }
          if ((ly === JULY_LAYER || ly === FIELD_LAYER || ly === SEASONAL_LAYER || ly === F1_WATERWAY_LAYER || ly === F1_COMPARE_LAYER || ly === WCROSS_UPSTREAM_LAYER || ly === WCROSS_FAR_LAYER || ly === OWNER_BLUE_LAYER || ly === SLOPE_CLUE_LAYER) && provider.analysisById.get(state.selectedFeatureId)?.properties?.layer === ly) selectFeature(null);
        }
        updateActiveLayerBadge();
        if (isWaybackLayer(ly)) {
          if (e.target.checked) void waybackLoader.ensure();
          else if (provider.analysisById.get(state.selectedFeatureId)?.properties?.layer === ly) selectFeature(null);
          updateWaybackControls();
        }

        if (ly === FIELD_LAYER || ly === SEASONAL_LAYER || ly === F1_WATERWAY_LAYER || ly === F1_COMPARE_LAYER || ly === WCROSS_UPSTREAM_LAYER || ly === WCROSS_FAR_LAYER || ly === OWNER_BLUE_LAYER || ly === SLOPE_CLUE_LAYER) renderStudioDrawer();
        syncMapsState();
        if(e.target.checked&&(ly===WCROSS_UPSTREAM_LAYER||ly===WCROSS_FAR_LAYER))locateWcrossLayer(ly);
      };
    });
    finishTabRender();
    return;
  }

  if (state.studioTab === 'evidence') {
    const buckets = [
      { id: 'ALL', label: `全部 (${provider.evidence.length})`, test: () => true },
      { id: 'obs', label: '观测与时序', test: e => /观测|时间共现|对象/.test(e.classification) },
      { id: 'cand', label: '待核与质量', test: e => /待核|质量|无面/.test(e.classification) },
      { id: 'mod', label: '模型与地形', test: e => /模型|地形/.test(e.classification) },
      { id: 'ctx', label: '区域与背景', test: e => /区域|规划|历史/.test(e.classification) },
    ];
    const activeBucket = buckets.find(b => b.id === state.evidenceFilter) || buckets[0];
    const list = provider.evidence.filter(activeBucket.test);

    body.innerHTML = `
      <div class="drawer-card">
        <div class="card-kicker"><span>证据判断 · 适用边界与原始出处</span><span>${list.length} 条</span></div>
        <p class="card-note">每条判断均附解释边界与出处；上方子栏可直达典型样例、历史纸图与 389 项资料清单。点选位置直达统一详情。</p>
      </div>
      <button type="button" class="cta-btn" data-open-site-study>环湖方向 · 春融 · 6–10 月景观与讲解试读</button>
      <div class="filter-chips">
        ${buckets.map(b => `
          <button type="button" class="f-chip ${activeBucket.id === b.id ? 'active' : ''}" data-ev-filter="${esc(b.id)}">
            ${esc(b.label)}
          </button>
        `).join('')}
      </div>
      ${list.map(ev => {
        const linkLimit=ev.id===F1_EVIDENCE_ID?24:6;
        const isActive = ev.id === state.activeEvidenceId;
        const noGeoNote = !ev.feature_ids?.length
          ? '<p class="card-note">说明：本条目目前仅有文字与统计记录，未绘制空间范围，不作补画。</p>'
          : '';
        let extraSummary = '';
        if (ev.id === 'east-may-hotspot' && provider.hotspotMay?.observations?.length) {
          extraSummary = `
            <table class="kv-table" style="margin-bottom:6px">
              <tr><th>年份月份</th><th>重复水样面积</th><th>有效格比例</th></tr>
              ${provider.hotspotMay.observations.map(o => `
                <tr>
                  <td>${o.year}-${String(o.month).padStart(2, '0')} (${esc(o.zone)})</td>
                  <td>${o.candidate_repeat_ha.toFixed(2)} ha</td>
                  <td>${o.eligible}/${o.pixels} (${o.eligible_pct.toFixed(1)}%)</td>
                </tr>
              `).join('')}
            </table>
          `;
        }
        if (Array.isArray(ev.outcome_rows)) {
          extraSummary += `<table class="kv-table" style="margin-bottom:6px" aria-label="受纳位置比较">
            <thead><tr><th scope="col">位置</th><th scope="col">当前能判断什么</th></tr></thead><tbody>${ev.outcome_rows.map(([location,note])=>
              `<tr><th scope="row">${esc(location)}</th><td>${esc(note)}</td></tr>`).join('')}</tbody></table>`;
        }
        const webSources = (ev.source_refs || []).filter(s => s.url);
        const fileSources = (ev.source_refs || []).filter(s => !s.url);
        return `
          <article class="ev-card ${isActive ? 'active' : ''}" data-ev-card="${esc(ev.id)}">
            <div class="ev-head">
              <h3 class="ev-title">${esc(ev.title)}</h3>
              <span class="ev-tag">${esc(ev.classification)}</span>
            </div>
            <p class="ev-judgment">${esc(ev.judgment)}</p>
            ${extraSummary}
            ${ev.id===SLOPE_CLUE_LAYER?`<p class="card-note"><strong>先查地方路：</strong>以蓝笔末端旁的核查点为中心，沿路约 ±60 米，比对两侧是否有同位进出口。</p><div class="ev-links"><button type="button" class="mini-pill" data-slope-evidence-image>看 2004-05 标记影像（只换底图）</button></div>`:''}
            <div class="ev-boundary"><strong>解释边界：</strong>${esc(ev.boundary)}</div>
            ${noGeoNote}
            <div class="ev-links">
              ${(ev.months || []).map(m => `<button type="button" class="mini-pill month" data-jump-month="${esc(m)}">月 ${esc(m)}</button>`).join('')}
              ${(ev.feature_ids || []).slice(0, linkLimit).map(fid => {
                const f = provider.analysisById.get(fid);
                const lbl = f ? (ev.id===F1_EVIDENCE_ID?(f.properties?.name||fid):(f.properties?.name || fid).split(' · ')[0]) : fid;
                return `<button type="button" class="mini-pill" data-jump-fid="${esc(fid)}">◎ ${esc(lbl)}</button>`;
              }).join('')}
              ${(ev.feature_ids || []).length > linkLimit ? `<span class="layer-count">+${ev.feature_ids.length - linkLimit} 处</span>` : ''}
            </div>
            ${webSources.length ? `
              <div class="ev-sources">
                ${webSources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">↗ ${esc(s.label)}</a>`).join('')}
              </div>
            ` : ''}
            ${fileSources.length ? `
              <details class="tech-details compact" data-stop-card="1">
                <summary>查看内部档案与来源路径（${fileSources.length}）</summary>
                <div class="tech-source-list">
                  ${fileSources.map(s => `<div><span>📄 ${esc(s.label)}</span><code>${esc(s.path)}</code></div>`).join('')}
                </div>
              </details>
            ` : ''}
          </article>
        `;
      }).join('')}
    `;

    const archived=new Set(state.waterwayOverview?.archiveEvidenceIds||[]);
    const articles=[...body.querySelectorAll('[data-ev-card]')].filter(x=>archived.has(x.dataset.evCard));
    if(articles.length){
      const d=document.createElement('details');
      d.className='drawer-card tech-details';
      d.id='waterway-archived-evidence';
      d.open=articles.some(x=>x.dataset.evCard===state.activeEvidenceId);
      const s=document.createElement('summary');
      s.textContent='水路旧证据卡与引用（保留）';
      d.append(s,...articles);
      body.append(d);
    }
    $('#btn-ev-coverage')?.addEventListener('click', openCoverageModal);
    body.querySelectorAll('[data-evidence-section]').forEach(b=>b.onclick=()=>openStudioDrawer(b.dataset.evidenceSection));
    body.querySelector('[data-open-site-study]').onclick=()=>openStudioDrawer('study');
    body.querySelectorAll('[data-stop-card]').forEach(el => {
      el.onclick = e => e.stopPropagation();
    });
    body.querySelectorAll('[data-ev-filter]').forEach(b => {
      b.onclick = () => {
        state.evidenceFilter = b.dataset.evFilter;
        renderStudioDrawer();
      };
    });
    body.querySelectorAll('[data-jump-month]').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        state.activeEvidenceId = b.closest('[data-ev-card]')?.dataset.evCard || null;
        selectMonth(b.dataset.jumpMonth);
        if (isMobileViewport()) closeStudioDrawer();
        else renderStudioDrawer();
      };
    });
    body.querySelector('[data-slope-evidence-image]')?.addEventListener('click',e=>{e.stopPropagation();void fixedHistory.openScene?.('ge-root-200405');});
    body.querySelectorAll('[data-jump-fid]').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        state.activeEvidenceId = b.closest('[data-ev-card]')?.dataset.evCard || null;
        selectFeature(b.dataset.jumpFid, { fly: true });
        if (!isMobileViewport() && !isCompactViewport()) renderStudioDrawer();
      };
    });
    body.querySelectorAll('[data-ev-card]').forEach(card => {
      card.onclick = () => {
        const ev = provider.evidence.find(x => x.id === card.dataset.evCard);
        if (!ev) return;
        state.activeEvidenceId = ev.id;
        if (ev.feature_ids?.length) {
          for (const fid of ev.feature_ids) {
            const f = provider.analysisById.get(fid);
            if (f?.properties?.layer) state.visibleLayers.add(f.properties.layer);
          }
          updateActiveLayerBadge();
          selectFeature(ev.feature_ids[0], { fly: true });
        } else if (ev.months?.length) {
          selectMonth(ev.months[0]);
          if (isMobileViewport()) closeStudioDrawer();
        }
        if (!isMobileViewport() && !isCompactViewport()) renderStudioDrawer();
      };
    });
    finishTabRender();
    return;
  }

  if (state.studioTab === 'history') {
    const dryYearMonths = ['2017-05', '2017-06', '2017-07', '2017-08'];
    const dryCase = dryYearMonths.every(date => provider.waterIndex.lakes.MAIN.months[date]) ? `
      <div class="drawer-card">
        <div class="card-kicker"><span>2017 年初夏低水面</span><span>主湖月度观测</span></div>
        <p class="card-note">7 月仅识别约 0.10 公顷水面，8 月增至 22.77 公顷。6 月底区域气象预警覆盖鄂温克西部；月度图不能确定降雨和湖面变化的先后。</p>
        <div class="ev-links">
          ${dryYearMonths.map(date => {
            const row = provider.waterIndex.lakes.MAIN.months[date];
            const label = row.status === 'invalid' || !Number.isFinite(row.area_ha)
              ? '覆盖不足' : `${row.area_ha.toFixed(2)} 公顷`;
            return `<button type="button" class="mini-pill month" data-dry-year-month="${date}">${Number(date.slice(-2))} 月 · ${label}</button>`;
          }).join('')}
        </div>
        <div class="ev-sources"><a href="https://www.cneb.gov.cn/2017/06/27/ARTI1498527777103590.shtml" target="_blank" rel="noopener">↗ 2017 年 6 月 27 日市气象台干旱预警</a></div>
      </div>` : '';
    body.innerHTML = `
      ${dryCase}
      <div class="drawer-card history-card">
        <div class="card-kicker"><span>呼吉尔诺尔 · 历史图幅对照</span><span>纸图线索</span></div>
        <p style="margin:0 0 8px;font-size:12.5px;color:var(--ink-2)">
          将 1933–1980 年纸图上的水域、道路、地表符号、地名与高程注记叠加到同一位置对读。历史图层是图面证据，不代替月度卫星观测、现代路网、实测岸线或水路核验。
        </p>
        <button type="button" class="cta-btn" id="btn-enable-all-history" style="border-color:rgba(226,168,86,0.5);background:rgba(226,168,86,0.16);color:#fef3c7">
          ◇ 在地图上开启全部历史参考图层（43 要素）
        </button>
      </div>

      <div class="drawer-card">
        <div class="card-kicker"><span>可以用来回答什么 · 解释边界</span></div>
        <table class="hist-table">
          <thead><tr><th>问题</th><th>查到的图面线索</th><th>不宜据此推断</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>主湖旧称与入图</strong></td>
              <td>L542 写 Hoteru-ko；1980 苏联图写 оз. Хотэру，与现主湖统计区及 2024-07 水面相交。</td>
              <td>不作正式中文名；不能用纸图符号面积计算旧湖面积或水深。</td>
            </tr>
            <tr>
              <td><strong>西长湖与北侧水域</strong></td>
              <td>1980 版在西长湖西缘画无名水面，北偏东约 1 km 另绘独立蓝色符号。</td>
              <td>不证明同一岸线、持续积水或汇流次序，不合并为一个湖。</td>
            </tr>
            <tr>
              <td><strong>G332 与旧路线</strong></td>
              <td>1980 橙色道路距 G332 核查框约 0.4–0.5 km；L541/L542 亦不能连成确定现线。</td>
              <td>不能据图版定施工、改线、铺装或桥涵存在与否。</td>
            </tr>
            <tr>
              <td><strong>地形与湿地符号</strong></td>
              <td>画有高点、局部 640 m 等高线、河曲、湿地符号与水井，可供现代地形核对选点。</td>
              <td>不连成分水线，不把井或河岸湿地当成向主湖来水证据；棕色点纹未定性。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="drawer-card">
        <div class="card-kicker"><span>图幅来源与年代</span></div>
        <div class="ev-sources" style="margin-top:0;padding-top:0;border:none;gap:6px">
          <a href="https://github.com/ramSeraph/russian_world_topo_maps/releases/download/200k-gs-orig-extra14/M50-30.gif" target="_blank" rel="noopener">↗ 苏联 M-50-XXX 1:200,000（1980 年版原扫描，Pulkovo 1942 配准）</a>
          <a href="https://maps.lib.utexas.edu/maps/ams/manchuria_250k/txu-pclmaps-oclc-6614383-hu-lun.jpg" target="_blank" rel="noopener">↗ 美军 L541 1:250,000（1946 年汇编）</a>
          <a href="https://maps.lib.utexas.edu/maps/ams/manchuria/txu-oclc-6614368-nm50-9.jpg" target="_blank" rel="noopener">↗ 美军 L542（1951 汇编 / 1964 印刷）</a>
          <a href="https://nakaya-geolab.com/GaihozuTiles/?imageid=TH010087.jpg" target="_blank" rel="noopener">↗ 日图 TH010087（1933 版基 / 1942 修订）</a>
          <a href="https://meganorm.ru/mega_doc/norm/rukovodstvo/0/gkinp_05-053-79_rukovodstvo_po_kartograficheskim_i.html" target="_blank" rel="noopener">↗ 苏联同尺度制图规程（符号释读参考）</a>
        </div>
        <p class="card-note" style="margin-top:8px">三维中历史符号贴在现代地表上显示；不随月度时间轴变化，不参与面积、缺测或水力连通判断。</p>
      </div>
    `;

    body.querySelectorAll('[data-dry-year-month]').forEach(button => {
      button.onclick = () => {
        setMapLakeScope('MAIN');
        void selectMonth(button.dataset.dryYearMonth);
        if (isMobileViewport()) closeStudioDrawer();
      };
    });
    $('#btn-enable-all-history').onclick = () => {
      setHistoricalLayers(historicalLayers, true);
      if (isMobileViewport()) closeStudioDrawer();
    };
    finishTabRender();
    return;
  }

  // Tab: Representative Cases (样例 · 主湖优先 + 严格独立定位)
  const ac = provider.acceptance;
  const lakeLabel = lk => (lk === 'MAIN' ? '主湖' : lk === 'WF1' ? '西长湖' : lk);
  body.innerHTML = `
    <div class="drawer-card featured">
      <div class="card-kicker"><span>从主湖读回上游 · 核心验收场景</span><span>一键直达</span></div>
      <button type="button" class="case-btn" id="ac-se-60m">
        <strong>⊞ 东南入口同位月度切换（E20 剖面 B · 60 m 主试例）</strong>
        <small>固定机位比对 2024-06/07/08（0 → 5 同斑 → 5 分离）</small>
      </button>
      <button type="button" class="case-btn" id="ac-se-37m-nodata">
        <strong>▨ 独立 37 m 入口簇 7 · 2014-08 局部缺测回归</strong>
        <small>验证 0 水 / 7 有效 / 1 缺测 [62,127] 且整湖合格 108.09 ha</small>
      </button>
      <button type="button" class="case-btn" id="ac-main-profiles">
        <strong>▲ 主湖 5 条剖面（E18–E22 · 贯湖水面段断线）</strong>
        <small>统一剖面控件切换主湖、办公院与外围原有 5 条剖面</small>
      </button>
    </div>

    <div class="drawer-card">
      <div class="card-kicker"><span>严格独立定位 · 独立对象不共用按钮</span><span>全称标注</span></div>
      <div class="landmark-grid">
        <button type="button" class="landmark-btn" data-indep-fid="main-profile-south-central-inlet">
          <strong>主湖南中模型入口</strong>
          <small>E19 · 与 G332 跨路无关</small>
        </button>
        <button type="button" class="landmark-btn" data-indep-fid="g332-wf1-review">
          <strong>G332 跨路检查</strong>
          <small>独立核查窗 · 编号 g332-wf1-review</small>
        </button>
        <button type="button" class="landmark-btn" data-indep-fid="west-slope-f1-bridge">
          <strong>F1 双幅桥（三八水库中桥）</strong>
          <small>E08 · 实拍桥位参照</small>
        </button>
        <button type="button" class="landmark-btn" data-indep-fid="west-slope-model-cross">
          <strong>西坡北侧模型跨路点</strong>
          <small>E07 · 待核（距 F1 约 450 m）</small>
        </button>
        <button type="button" class="landmark-btn" data-indep-fid="archive-east_pool_2025-09-22_scl6">
          <strong>东池（2025-09-22 单景参照）</strong>
          <small>与东部泥沼及 S1 分开</small>
        </button>
        <button type="button" class="landmark-btn" data-indep-fid="atlas-east-marsh-review">
          <strong>东部泥沼 · 原图圈注查看点</strong>
          <small>E17 · 距 S1 约 0.89 km</small>
        </button>
        <button type="button" class="landmark-btn" data-indep-fid="wall-check-s1">
          <strong>院墙调查 S1 · 东段低值带</strong>
          <small>独立边界核查点</small>
        </button>
        <button type="button" class="landmark-btn" data-indep-fid="wall-check-s2">
          <strong>院墙调查 S2 · 东端转角</strong>
          <small>独立对照核查点</small>
        </button>
        <button type="button" class="landmark-btn" data-indep-fid="archive-north_pool_2025-09-22_scl6">
          <strong>北小湖（独立水体参照）</strong>
          <small>独立标注，不并入主湖</small>
        </button>
        <button type="button" class="landmark-btn" id="ac-far-north-wb">
          <strong>更北侧水面对照（Wayback）</strong>
          <small>二维完整复核窗</small>
        </button>
      </div>
    </div>

    <div class="drawer-card">
      <div class="card-kicker"><span>其余空间、剖面与双轴对照样例</span><span>点击直达</span></div>
      <button type="button" class="case-btn" id="ac-g332">
        <strong>◇ G332 跨路检查范围与双幅道路</strong>
        <small>查看待核过路范围及道路位置（非已证实涵洞）</small>
      </button>
      <button type="button" class="case-btn" id="ac-yimin-pt2">
        <strong>▲ 伊敏河方向地形剖面 · 采样点 #2 联动</strong>
        <small>在剖面与地图上同步查看中段抬升位置</small>
      </button>
      <button type="button" class="case-btn" id="ac-contours-hist">
        <strong>═ 现代等高线 (5m) 与历史纸图叠加</strong>
        <small>在卫星影像与三维地形上叠加对比，不改变水面读数</small>
      </button>
      <button type="button" class="case-btn" id="ac-s7-roles">
        <strong>★ 西侧低地 S7（5 正例与 2 反例）＋ S3 反例</strong>
        <small>同图层中按正例与反例分色、分纹路展示</small>
      </button>
      <button type="button" class="case-btn" id="ac-landsat-qa">
        <strong>✓/✕ 2013 年影像质量核查（4 可用与 6 排除）</strong>
        <small>仅反映云影遮挡情况，不代表有水或干涸</small>
      </button>
      <button type="button" class="case-btn" id="ac-pools">
        <strong>●/◇ 周边水体（3 实测池塘与 3 待核候选）</strong>
        <small>北小湖、东池独立展示，不并入主湖与西长湖统计</small>
      </button>
      <button type="button" class="case-btn" id="ac-axis-same-month">
        <strong>📊 同月跨年对照（历年 7 月 · 含 2010-07 争议）</strong>
        <small>展开双湖时序图对比 2008-07、2010-07 与 2024-07</small>
      </button>
      <button type="button" class="case-btn" id="ac-axis-same-year">
        <strong>📊 同年跨月对照（2017 年 · 7 至 8 月同期上涨）</strong>
        <small>展开双湖时序图查看年内季节变化与缺测留空</small>
      </button>
    </div>

    <div class="drawer-card">
      <div class="card-kicker"><span>14 期典型月份水面对照</span><span>点击跳转</span></div>
      ${(ac?.water_cases || []).map(c => `
        <button type="button" class="case-btn" data-ac-month="${esc(c.date)}" data-ac-lake="${esc(c.lake)}">
          <strong>${esc(lakeLabel(c.lake))} · ${esc(c.date)} · ${c.area_ha === null ? '覆盖不足（留空）' : `${c.area_ha.toFixed(2)} ha`}${c.disputed ? ' · ⚠ 存在争议' : ''}</strong>
          <small>${esc(c.visual_zh || `有效覆盖 ${c.valid_pct.toFixed(1)}%`)}</small>
        </button>
      `).join('')}
    </div>
  `;

  $('#ac-se-60m').onclick = () => openSoutheastInspection(SE_PRIMARY_WINDOW, '2024-07', { fly: true });
  $('#ac-se-37m-nodata').onclick = () => openSoutheastInspection(SE_CLUSTER7_WINDOW, '2014-08', { fly: true });
  $('#ac-main-profiles').onclick = () => {
    state.visibleLayers.add(MAIN_PROFILE_LAYER);
    updateActiveLayerBadge();
    if (isMobileViewport() || isCompactViewport()) closeStudioDrawer();
    const pid = 'main-profile-east-west-axis';
    openLinkedProfile(pid);
  };
  body.querySelectorAll('[data-indep-fid]').forEach(btn => {
    btn.onclick = () => selectFeature(btn.dataset.indepFid, { fly: true });
  });
  $('#ac-far-north-wb').onclick = async () => {
    state.visibleLayers.add('wayback-far-north');
    updateActiveLayerBadge();
    const items = await waybackLoader.ensure();
    const target = items?.find(f => f.properties?.layer === 'wayback-far-north');
    if (target) selectFeature(target.id, { fly: true });
    else openStudioDrawer('layers');
  };

  $('#ac-g332').onclick = () => {
    state.visibleLayers.add('road-review');
    state.visibleLayers.add('roads');
    updateActiveLayerBadge();
    selectFeature('g332-wf1-review', { fly: true });
  };
  $('#ac-yimin-pt2').onclick = () => {
    state.visibleLayers.add('yimin-profile');
    state.visibleLayers.add('yimin-reference');
    updateActiveLayerBadge();
    if (isMobileViewport() || isCompactViewport()) closeStudioDrawer();
    state.bottomTab = 'profile';
    setDeckExpanded(true);
    openLinkedProfile('yimin-nearest-profile',{sample:1});
  };
  $('#ac-contours-hist').onclick = () => {
    setContourInterval(5);setContoursEnabled(true);
    setHistoricalLayers(historicalLayers, true);
    fitActiveBounds(AOI_BOUNDS, 1.08);
    if (isMobileViewport()) closeStudioDrawer();
  };
  $('#ac-s7-roles').onclick = () => {
    state.visibleLayers.add('s7-repeat-green');
    state.visibleLayers.add('snow-sites');
    state.visibleLayers.add('snow-2026');
    updateActiveLayerBadge();
    setBasemap('sentinel2-2026-04-01');
    selectFeature('strict-scl11-i4632-j2589', { fly: true });
  };
  $('#ac-landsat-qa').onclick = () => {
    state.visibleLayers.add('landsat-2013-quality');
    updateActiveLayerBadge();
    selectFeature('landsat-2013-05-04-main-qualified', { fly: true });
  };
  $('#ac-pools').onclick = () => {
    state.visibleLayers.add('nearby-pools');
    updateActiveLayerBadge();
    selectFeature('archive-north_pool_2025-09-22_scl6', { fly: true });
  };
  $('#ac-axis-same-month').onclick = () => {
    if (isMobileViewport()) closeStudioDrawer();
    state.bottomTab = 'time';
    state.compareAxis = 'same-month';
    setMapLakeScope('BOTH');
    setDeckExpanded(true);
    selectMonth('2010-07');
  };
  $('#ac-axis-same-year').onclick = () => {
    if (isMobileViewport()) closeStudioDrawer();
    state.bottomTab = 'time';
    state.compareAxis = 'same-year';
    setMapLakeScope('BOTH');
    setDeckExpanded(true);
    selectMonth('2017-08');
  };
  body.querySelectorAll('[data-ac-month]').forEach(b => {
    b.onclick = () => {
      if (isMobileViewport()) closeStudioDrawer();
      state.bottomTab = 'time';
      setMapLakeScope('BOTH');
      const lake = b.dataset.acLake;
      selectMonth(b.dataset.acMonth);
      const wb = provider.waterIndex?.lakes?.[lake]?.bounds_wgs84;
      if (wb) fitActiveBounds(wb, 1.8);
    };
  });
  finishTabRender();
}

function openSoutheastInspection(windowId = SE_PRIMARY_WINDOW, month = null, { fly = true } = {}) {
  stopSoutheastStepping();
  state.southeastWindow = SE_WINDOWS[windowId] ? windowId : SE_PRIMARY_WINDOW;
  state.southeastEnabled = true;
  state.crossingCompare = null;
  setMapLakeScope('BOTH');
  state.visibleLayers.add(MAIN_PROFILE_LAYER);
  if (state.selectedFeatureId && !['main-profile-southeast-inlet', 'entry_cluster_7'].includes(state.selectedFeatureId)) {
    selectFeature(null);
  }
  updateActiveLayerBadge();
  const scope = state.southeastFixture?.scopes?.[state.southeastWindow];
  if (month && provider.waterIndex?.dates?.includes(month)) {
    void selectMonth(month);
  } else {
    syncMapsState();
  }
  if (fly && scope?.anchor) {
    flyActiveMap({ lon: scope.anchor[0], lat: scope.anchor[1], spanKm: 0.52 });
  }
  openStudioDrawer('southeast');
}

function openCrossingsWorkspace(structureId = 'f1_bridge', { fly = true } = {}) {
  stopSoutheastStepping();
  const nextId = structureId === 'round_culvert' ? 'round_culvert' : 'f1_bridge';
  state.crossingStructure = nextId;
  state.crossingCompare = { mode: nextId };
  setMapLakeScope('BOTH');
  state.visibleLayers.add(FIELD_LAYER);
  state.visibleLayers.add('roads');
  state.visibleLayers.add('roadside-terrain-check');

  if (nextId === 'f1_bridge') {
    state.visibleLayers.add('west-slope-review');
    state.visibleLayers.add('bridge-f1-anchors');
    state.visibleLayers.add('bridge-f1-ne-branch');
    state.visibleLayers.add('bridge-f1-se-branch');
    state.visibleLayers.add('nearby-pools');
    // Keep Culvert strictly separated so F1 & Culvert are never visually chained
    state.visibleLayers.delete('culvert-diag-branches');
  } else {
    state.visibleLayers.add('secondary-roads');
    state.visibleLayers.add('wc2-optical-review');
    state.visibleLayers.add('culvert-diag-branches');
    // Keep F1 bridge branches off when inspecting the independent round culvert
    state.visibleLayers.delete('bridge-f1-ne-branch');
    state.visibleLayers.delete('bridge-f1-se-branch');
    state.visibleLayers.delete('bridge-f1-diag-raw');
  }
  updateActiveLayerBadge();
  syncMapsState();
  openStudioDrawer('crossings');
  if (fly) {
    if (nextId === 'f1_bridge') fitCrossingBounds(F1_SIX_POINT_BOUNDS, 1.15);
    else fitCrossingBounds(CULVERT_COMPARE_BOUNDS, 1.18);
  }
}

// ==========================================================================
// Contextual Floating Object Inspector (Hidden until a feature is selected!)
// ==========================================================================
let inspectorClearTimer = null;

const OFFICE_GAP_FEATURE_IDS = new Set([
  'office-service',
  'atlas-office-trace-main_raw',
  'atlas-office-trace-main_historical_filled',
  'office-field-of_a',
  'office-field-of_b',
  'office-field-of_c',
]);

function classifyFeatureTaxonomy(feat, spec) {
  const p = feat?.properties || {};
  const ly = p.layer || '';
  if (ly === FIELD_LAYER || feat.id === 'west-slope-f1-bridge' || feat.id === 'f1-east-bridge-location-ref') {
    return { key: 'photo', sym: '◉', label: ly === FIELD_LAYER ? '实拍照片' : '现场实拍识别' };
  }
  if (ly === OWNER_BLUE_LAYER || ly === 'west-slope-user-sketch' || p.feature_role === 'owner_blue_sketch') {
    return { key: 'sketch', sym: '✎', label: '手绘草图（假设）' };
  }
  if (p.status === 'gap' || spec.semanticTone === 'gap' || p.feature_role === 'schematic_road_uncertainty_gap' || feat.id === 'office-service') {
    return { key: 'gap', sym: '×', label: feat.id === 'office-service' ? '待核缺口 · 出水口未确认' : '待核缺口' };
  }
  if (spec.semanticTone === 'disputed' || p.status === 'disputed') {
    return { key: 'disputed', sym: '⚠', label: '分类争议' };
  }
  if (spec.semanticTone === 'water') {
    return { key: 'water', sym: '●', label: '观测水体' };
  }
  if (spec.semanticTone === 'model' || ['modeled', 'model', 'model_only'].includes(p.status)) {
    return { key: 'model', sym: '┄', label: '地形模型' };
  }
  if (spec.semanticTone === 'landform') {
    return { key: 'landform', sym: '●', label: '影像地貌' };
  }
  if (spec.semanticTone === 'candidate' || p.status === 'candidate') {
    return { key: 'sketch', sym: '◇', label: '待核线索' };
  }
  return { key: 'reference', sym: '◌', label: '背景参考' };
}

function renderInspectorDrawer() {
  const drawer = $('#inspector-drawer');
  const body = $('#inspector-drawer-body');
  const obs = $('#observatory');
  const feat = state.selectedFeatureId ? provider.analysisById.get(state.selectedFeatureId) : null;

  if (inspectorClearTimer) {
    clearTimeout(inspectorClearTimer);
    inspectorClearTimer = null;
  }

  if (!feat) {
    drawer.hidden = true;
    drawer.dataset.open = 'false';
    drawer.removeAttribute('data-tall');
    obs.classList.remove('inspector-open');
    const card = body.querySelector('#selected-feature-card');
    if (card) card.removeAttribute('id');
    if (prefersReducedMotion()) {
      body.innerHTML = '';
    } else {
      inspectorClearTimer = setTimeout(() => {
        if (!state.selectedFeatureId) body.innerHTML = '';
        inspectorClearTimer = null;
      }, 220);
    }
    return;
  }

  drawer.hidden = false;
  drawer.dataset.open = 'true';
  obs.classList.add('inspector-open');

  const p = feat.properties || {};
  const spec = getFeatureVisualSpec(feat);
  const tax = classifyFeatureTaxonomy(feat, spec);
  const statusMeta = (p.layer===SEASONAL_LAYER || p.layer===F1_WATERWAY_LAYER || p.layer===WCROSS_UPSTREAM_LAYER || p.layer===WCROSS_FAR_LAYER) && p.status==='gap' ? {symbol:'×',label:'证据缺口'} : EVIDENCE_STATUS_META[p.status] || EVIDENCE_STATUS_META.context;
  const center = geometryCenter(feat.geometry);
  const linkedEv = provider.evidence.filter(ev => (ev.feature_ids || []).includes(feat.id));
  const photo = p.layer === FIELD_LAYER;
  const idx = photo ? state.fieldPhotos.findIndex(f=>f.id===feat.id) : -1;
  const wwOwner = findWaterwayOwnerForFeature(feat.id);
  const ownerGuideLinks = wwOwner ? (ROUTE_GUIDE_MAP[wwOwner.item.id] || []) : [];
  const ownerPhotos = !photo && wwOwner?.item?.photos?.length
    ? wwOwner.item.photos.map(id => provider.analysisById.get(id)).filter(Boolean)
    : [];
  const isOfficeGap = OFFICE_GAP_FEATURE_IDS.has(feat.id);

  // Primary reader-facing key facts (clear Chinese, zero raw field codes)
  const coreKv = [];
  const techKvJuly = [];
  const photoButton = (f, label) => f ? `<button type="button" class="mini-pill" data-photo-fid="${esc(f.id)}">${esc(label)}</button>` : '';
  if (photo) {
    if (p.outside_dem) coreKv.push(['地形覆盖','超出本项目 DEM，仅在二维按原坐标定位；无地形底图不代表无地物。']);
    coreKv.push(['拍摄时间', `2026-11-22 ${p.capture_time}（当地）`], ['手机记录朝向', `${p.heading_deg.toFixed(1)}°（真北为 0°；${p.heading_unverified ? '待校核，不画箭头' : '未测量，不代表水流'}）`],
      ['手机报告的水平定位误差', `约 ${p.accuracy_m.toFixed(1)} 米${p.accuracy_m>20 ? ' · 低精度，仅作大致参照' : ''}`]);
  }

  if (isHistoricalLayer(p.layer)) {
    if (p.edition) coreKv.push(['图幅版本', p.edition]);
    if (Number.isFinite(p.scale_denominator)) coreKv.push(['原图比例尺', '1:' + p.scale_denominator.toLocaleString('zh-CN')]);
    coreKv.push(['时间口径', '历史纸图线索，不随月份变化']);
  } else if (p.date) {
    coreKv.push(['观测日期', p.date]);
  }
  if (p.dates?.length) coreKv.push([isWaybackLayer(p.layer) ? '影像日期' : '样本日期', p.dates.join(' / ')]);
  if (p.layer === JULY_LAYER) {
    coreKv.push(['三期共同有效格', `${p.common_cells} / ${p.total_cells}（20 米）`]);
    coreKv.push(['三期判水格', p.scene_scl_water_pixels.join(' / ')]);
    const deltas = a => a.map(v => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`).join(' / ');
    techKvJuly.push(['水湿光谱指数变化（比 7 月 11 日）', deltas(p.paired_mndwi_median_delta)]);
    techKvJuly.push(['近邻对照指数变化', deltas(p.ring_paired_mndwi_median_delta)]);
  }
  if (isWayback2dOnly(feat)) coreKv.push(['显示范围', '完整范围仅在二维地图显示']);
  if (p.layer===STUDY_LAYER) coreKv.push(['模型重复起点', String(p.deterministic_seed_count)+' 个 · 不是来水量']);
  if (p.reference_water_month) coreKv.push(['对照水面月', p.reference_water_month]);
  if(p.layer===F1_COMPARE_LAYER&&Number.isFinite(p.overlap_area_km2))coreKv.push(['两窗口模型交叠','图内约 '+p.display_area_km2.toFixed(2)+' km²；完整 '+p.overlap_area_km2.toFixed(4)+' km²']);
  if (Number.isFinite(p.area_ha)) coreKv.push(['面积', `${p.area_ha} ha`]);
  if(Number.isFinite(p.area_km2)){
    const area=p.area_km2>0&&p.area_km2<.1
      ? `${(p.area_km2*1e6).toLocaleString('zh-CN',{maximumSignificantDigits:4})} m²`
      : `${p.area_km2.toFixed(2)} km²`;
    const bridge=p.layer===F1_WATERWAY_LAYER;
    coreKv.push([bridge?'桥西模型汇水面积':'模型分区面积',area+(bridge?' · 不计入主湖 17.28 km²':'（仅地形分区，非流量比例）')]);
  }
  if (Number.isFinite(p.length_m)) coreKv.push(['长度', `${p.length_m.toFixed(1)} m`]);
  if (p.positive_direction) coreKv.push(['剖面方向', p.positive_direction]);
  if (typeof p.two_dsm_two_scale_low === 'boolean') coreKv.push(['两套地形复核', p.two_dsm_two_scale_low ? '稳定偏低正例（5 处之一）' : '对照反例']);

  // Technical IDs, coordinates & audit parameters tucked into collapsible <details>
  const techKv = [
    ['对象编号', feat.id],
    ['所属图层', p.layer],
    ['证据类别', `${statusMeta.symbol} ${statusMeta.label} (${p.status})`],
    ['判读角色', `${spec.symbol} ${spec.roleLabel}`],
    ...techKvJuly,
  ];
  if (p.sheet) techKv.push(['图幅编号', p.sheet]);
  if (p.display_clipped_to_dem) techKv.push(['显示裁切', '贴地显示线段已按高程模型覆盖裁切']);
  if (p.rule) techKv.push(['分类规则', p.rule]);
  if (p.feature_role) techKv.push(['角色标注', p.feature_role]);
  if (p.zero_anchor_lonlat) techKv.push(['0 m 锚点坐标', `${p.zero_anchor_lonlat[0].toFixed(6)}°E, ${p.zero_anchor_lonlat[1].toFixed(6)}°N`]);
  if (p.Cop_TPI_m) techKv.push(['GLO-30 TPI', `${p.Cop_TPI_m.map(v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}m`).join(' / ')}`]);
  if (p.ALOS_TPI_m) techKv.push(['AW3D30 TPI', `${p.ALOS_TPI_m.map(v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}m`).join(' / ')}`]);
  if (center) techKv.push(['参考中心坐标', `${center[0].toFixed(6)}°E, ${center[1].toFixed(6)}°N`]);

  const waybackSources = isWaybackLayer(p.layer) ? sourceRows(p) : [];
  const ndviTable = Array.isArray(p.ndvi_by_date) && p.ndvi_by_date.length ? `
    <table class="kv-table" style="margin-top:8px">
      <tr><th>日期</th><th>S7 植被指数</th><th>对照中位</th><th>差值</th></tr>
      ${p.ndvi_by_date.map(n => `
        <tr>
          <td>${esc(n.date)}</td>
          <td>${n.ndvi.toFixed(3)}</td>
          <td>${n.control_median_ndvi.toFixed(3)}</td>
          <td style="color:#34d399;font-weight:700">${n.ndvi_minus_control_median >= 0 ? '+' : ''}${n.ndvi_minus_control_median.toFixed(3)}</td>
        </tr>
      `).join('')}
    </table>
  ` : '';

  const hasProfile = getProfileData(feat.id) !== null;
  const showBackRoute = Boolean(state.waterwayReturn || (state.waterwayNav && state.waterwayFeature === feat.id));

  body.innerHTML = `
    <div id="selected-feature-card" data-selected-fid="${esc(feat.id)}" data-feature-tax="${tax.key}">
      <div class="card-kicker" style="margin-bottom:8px">
        <span>位置统一详情</span>
        <div style="display:flex;gap:5px;align-items:center">
          <button type="button" class="mini-pill" id="btn-fly-selected">◎ 聚焦</button>
          <button type="button" class="icon-close" id="btn-clear-sel" aria-label="关闭对象详情" title="关闭（Esc）">✕</button>
        </div>
      </div>

      <h2 class="insp-title">${esc(p.name || feat.id)}</h2>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
        <span class="tax-badge ${tax.key}">${tax.sym} ${esc(tax.label)}</span>
        <span class="status-badge context">${esc(`${spec.symbol} ${spec.roleLabel}`)}</span>
      </div>

      ${showBackRoute ? `<button type="button" class="mini-pill return-inline-pill" data-back-waterway>← 返回原路线 · ${esc(state.waterwayReturn?.itemTitle || '水路总览')}</button>` : ''}

      ${isOfficeGap ? `<div class="office-gap-banner"><strong>× 办公院出水口未确认（图上保留断口）：</strong>现状实际出水口尚未现场定位，下游模型线仅为 30m 地表敏感性对照，不代表已接通主湖的实测水路。</div>` : ''}

      ${photo ? `<img src="./field-photo-thumbs/${esc(feat.id)}.jpg" alt="${esc(p.name)}" style="display:block;width:100%;max-height:240px;object-fit:contain;background:#0c131e;border-radius:6px;margin:8px 0">
        <div class="ev-links">${photoButton(state.fieldPhotos[idx-1],'上一张')} <span>${idx+1} / ${state.fieldPhotos.length}</span> ${photoButton(state.fieldPhotos[idx+1],'下一张')}</div>
        ${['field-photo-2025','field-photo-2026','field-photo-2027','field-photo-2028','field-photo-2029'].includes(feat.id) ? `
          <div class="insp-section-lbl" style="margin-top:8px">三八水库中桥 · 追上游 / 追下游（未接段留空）</div>
          <div class="ev-links">
            <button type="button" class="mini-pill" data-rel-fid="roadside-check-f1-west">↑ 追西侧坡脚</button>
            <button type="button" class="mini-pill" data-rel-fid="west-slope-f1-bridge">◇ 对照桥位参照</button>
            <button type="button" class="mini-pill" data-rel-fid="west-slope-old-bend">↓ 追桥东老转折(717m)</button>
            <button type="button" class="mini-pill accent-pill" data-open-crossing="f1_bridge">≍ 桥后支路对照</button>
          </div>` : ''}
        ${['field-photo-2019','field-photo-2020'].includes(feat.id) ? `
          <div class="insp-section-lbl" style="margin-top:8px">地方道路圆涵 · 追上游 / 追下游（单独查，不连 F1 桥）</div>
          <div class="ev-links">
            <button type="button" class="mini-pill" data-rel-fid="roadside-check-wcross2-west">↑ 追路西地形</button>
            <button type="button" class="mini-pill" data-rel-fid="wc2-review-stop">↓ 追 LOW-A 停点(422m)</button>
            <button type="button" class="mini-pill accent-pill" data-open-crossing="round_culvert">≍ 圆涵独立对照</button>
          </div>` : ''}
        ${p.nearby_ids.length ? `<div class="insp-section-lbl">相机位置在 35 米内的其他照片</div><div class="ev-links">${p.nearby_ids.map(id=>photoButton(provider.analysisById.get(id),id.slice(-4))).join('')}</div>` : ''}` : ''}

      ${p.description ? `<p class="insp-desc">${esc(p.description)}</p>` : ''}
      ${p.placement_caveat ? `<div class="ev-boundary"><strong>定位边界：</strong>${esc(p.placement_caveat)}</div>` : ''}

      ${ownerPhotos.length ? `
        <div style="margin:8px 0">
          <div class="insp-section-lbl">关联现场实拍照片（点击查看大图与朝向）</div>
          <div class="insp-photo-strip">
            ${ownerPhotos.slice(0, 6).map(ph => `
              <button type="button" class="cr-photo-tile" data-photo-fid="${esc(ph.id)}" title="${esc(ph.properties?.name || ph.id)}">
                <img src="./field-photo-thumbs/${esc(ph.id)}.jpg" alt="${esc(ph.properties?.name || ph.id)}" loading="lazy">
                <span>${esc(ph.id.slice(-4))}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="ev-links" style="margin:8px 0">
        ${hasProfile ? `<button type="button" class="mini-pill accent-pill" id="btn-open-feat-profile">📈 展开剖面图</button>` : ''}
        ${ownerGuideLinks.slice(0, 1).map(n => `<button type="button" class="mini-pill guide-link-pill" data-insp-guide="${esc(n.target)}">${esc(n.label)}</button>`).join('')}
        ${wwOwner && !showBackRoute ? `<button type="button" class="mini-pill" data-open-ww-node="${esc(wwOwner.branch.id)}:${esc(wwOwner.item.id)}">≍ 所属水路：${esc(wwOwner.item.title.split('：')[0])}</button>` : ''}
      </div>
      ${(feat.id === 'main-profile-southeast-inlet' || feat.id === 'entry_cluster_7') && state.southeastFixture ? `<button type="button" class="cta-btn" id="btn-open-se-from-insp" style="border-color:var(--cand-border);background:var(--cand-soft);color:var(--cand-ink)">⊞ 进入东南同位月度切换（${feat.id === 'entry_cluster_7' ? '独立 37 m 窗' : 'E20 主试例 60 m'}）</button>` : ''}

      ${coreKv.length ? `
        <table class="kv-table">
          ${coreKv.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
        </table>
      ` : ''}

      ${waybackSources.length ? `<details class="tech-details" style="margin-top:8px">
        <summary>影像来源与定位说明</summary>
        <div class="tech-source-list">
          ${waybackSources.map(row => `<div>${row.url
            ? `<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.label)} ↗</a>`
            : esc(row.label)} ${esc(row.note)}</div>`).join('')}
        </div>
      </details>` : ''}

      ${p.related_ids?.length ? `
        <div style="margin-top:10px">
          <div class="insp-section-lbl">相关位置（同一研究问题，不代表水路相连）</div>
          <div class="ev-links">
            ${p.related_ids.map(rid => {
              const rf = provider.analysisById.get(rid);
              return `<button type="button" class="mini-pill" data-rel-fid="${esc(rid)}">→ ${esc(rf?.properties?.name || rid)}</button>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${linkedEv.length ? `
        <div style="margin-top:10px">
          <div class="insp-section-lbl">关联证据卡</div>
          <div class="ev-links">
            ${linkedEv.map(ev => `<button type="button" class="mini-pill" data-open-ev="${esc(ev.id)}">◈ ${esc(ev.title)}</button>`).join('')}
          </div>
        </div>
      ` : ''}

      <details class="tech-details" style="margin-top:10px">
        <summary>查看技术编号、坐标与核查参数</summary>
        <table class="kv-table" style="margin-top:6px">
          ${techKv.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
        </table>
        ${ndviTable}
        ${p.source ? `
          <div class="ev-sources" style="margin-top:8px">
            ${String(p.source).startsWith('http')
              ? `<a href="${esc(p.source)}" target="_blank" rel="noopener">↗ 数据来源：${esc(p.source)}</a>`
              : `<span>📄 来源文件：<code>${esc(p.source)}</code></span>`
            }
          </div>
        ` : ''}
      </details>
    </div>
  `;

  $('#btn-clear-sel').onclick = () => selectFeature(null);
  $('#btn-fly-selected').onclick = () => selectFeature(feat.id, { fly: true });
  if ($('#btn-open-feat-profile')) {
    $('#btn-open-feat-profile').onclick = () => {
      const targetIdx=state.activeProfileId===feat.id&&state.profileCursorIdx>=0?state.profileCursorIdx:null;
      openLinkedProfile(feat.id,{sample:targetIdx});
    };
  }
  if ($('#btn-open-se-from-insp')) {
    $('#btn-open-se-from-insp').onclick = () => {
      const targetWin = feat.id === 'entry_cluster_7' ? SE_CLUSTER7_WINDOW : SE_PRIMARY_WINDOW;
      openSoutheastInspection(targetWin, state.month, { fly: true });
    };
  }
  body.querySelector('[data-back-waterway]')?.addEventListener('click', returnToWaterwayRoute);
  body.querySelectorAll('[data-insp-guide]').forEach(b => {
    b.onclick = () => openGuidedTour(b,b.dataset.inspGuide);
  });
  body.querySelectorAll('[data-open-ww-node]').forEach(b => {
    b.onclick = () => {
      const [br, it] = String(b.dataset.openWwNode || '').split(':');
      state.waterwayBranch = br || state.waterwayBranch;
      state.waterwayItem = it || state.waterwayItem;
      openWaterwayOverview();
    };
  });
  body.querySelectorAll('[data-photo-fid]').forEach(b => {
    b.onclick = () => {
      state.visibleLayers.add(FIELD_LAYER);
      updateActiveLayerBadge();
      selectFeature(b.dataset.photoFid, { fly: true });
    };
  });
  body.querySelectorAll('[data-open-crossing]').forEach(b => {
    b.onclick = () => openCrossingsWorkspace(b.dataset.openCrossing, { fly: true });
  });
  body.querySelectorAll('[data-rel-fid]').forEach(b => {
    b.onclick = () => selectFeature(b.dataset.relFid, { fly: true });
  });
  body.querySelectorAll('[data-open-ev]').forEach(b => {
    b.onclick = () => {
      state.activeEvidenceId = b.dataset.openEv;
      state.evidenceFilter = 'ALL';
      openStudioDrawer('evidence');
    };
  });
}

// ==========================================================================
// Bottom Collapsible / Expandable Temporal & Profile Command Deck
// ==========================================================================
function setDeckExpanded(expand, customMaxPx = null) {
  const deck = $('#chart-deck');
  const body = $('#deck-body');
  const btn = $('#btn-deck-expand');
  const grip = $('#deck-grip');
  const hint = $('#deck-grip-hint');
  state.deckExpanded = Boolean(expand);

  if (state.deckExpanded && isMobileViewport()) {
    // Keep mobile spacious: fold open inspector or studio sheet when chart expands
    if (state.studioOpen && !guidedTour.active) closeStudioDrawer();
    hideInspectorSurface();
  }

  deck.dataset.expanded = String(state.deckExpanded);
  body.setAttribute('aria-hidden', String(!state.deckExpanded));
  if ('inert' in body) body.inert = !state.deckExpanded;
  btn.setAttribute('aria-expanded', String(state.deckExpanded));
  grip.setAttribute('aria-expanded', String(state.deckExpanded));
  if (customMaxPx && state.deckExpanded) {
    body.style.setProperty('--deck-body-max', `${Math.round(customMaxPx)}px`);
  } else if (!state.deckExpanded) {
    body.style.removeProperty('--deck-body-max');
  }
  hint.textContent = state.deckExpanded ? '下拖或轻点收起图表' : '上拖或轻点展开图表';
  $('#deck-expand-label').textContent = state.deckExpanded
    ? '收起'
    : (state.bottomTab === 'time' ? '曲线' : state.bottomTab==='feature'?'对象资料':'剖面图');

  if (state.deckExpanded) {
    renderChartDeckBody();
  }
  updateLayoutOffsets();
  repositionOpenPopovers();
}

function updateLayoutOffsets() {
  const deck = $('#chart-deck');
  if (deck) {
    document.documentElement.style.setProperty('--deck-h', `${Math.round(deck.offsetHeight)}px`);
    const box=deck.getBoundingClientRect();
    if(box.height&&!guidedTour.active){
      const style=document.documentElement.style;
      style.setProperty('--browse-deck-top', `${Math.round(box.top)}px`);
      const expandedHeight=$('#deck-body-collapse').offsetHeight;
      const chrome=Math.max(0,deck.offsetHeight-expandedHeight);
      style.setProperty('--browse-deck-chrome', `${chrome}px`);
    }
  }
  const tl = $('#hud-top-left');
  if (tl) {
    const r = tl.getBoundingClientRect();
    document.documentElement.style.setProperty('--hud-tl-bottom', `${Math.round(r.bottom + 8)}px`);
  }
  const ret = $('#waterway-return-pill');
  const retH = ret && !ret.hidden ? Math.round(ret.offsetHeight + 6) : 0;
  document.documentElement.style.setProperty('--return-h', `${retH}px`);
}

function updateTimeDeckInPlace() {
  if (!state.playing && $('#btn-tl-play')) $('#btn-tl-play').title = timelinePlayTitle();
  const slider = $('#tl-slider');
  const selYear = $('#sel-year');
  const selMonth = $('#sel-month');
  if (!slider || !selYear || !selMonth) return false;
  const dates = navigableDates();
  const c=timelineChoices(dates);
  if(Number(slider.max)!==dates.length-1)return false;
  slider.value=String(c.idx);
  slider.setAttribute('aria-valuetext',state.month+' · '+timelineMonthDescription()+(c.active?'':'（当前在筛选之外）'));
  selYear.innerHTML=timelineOptions(c.years,c.year,'年');
  selMonth.innerHTML=timelineOptions(c.months,c.month,'月');

  if (state.deckExpanded) {
    const host = $('#deck-chart-host');
    if (host) {
      host.innerHTML = renderDualLakeCompareCharts(provider.waterIndex, state.compareAxis, state.month, state.lakeView);
      host.querySelectorAll('[data-pick-date]').forEach(g => {
        g.onclick = () => {
          stopPlay();
          selectMonth(g.dataset.pickDate, { timeline: true });
        };
      });
    }
  }
  return true;
}

function renderChartDeck() {
  const deck = $('#chart-deck');
  const quick = $('#deck-quick-controls');
  if (!deck || !quick || !provider.waterIndex) return;

  deck.dataset.mode = state.bottomTab;
  $$('[data-deck-mode]').forEach(b => {
    const act = b.dataset.deckMode === state.bottomTab;
    b.classList.toggle('active', act);
    b.setAttribute('aria-selected', String(act));
    if(b.dataset.deckMode==='feature')b.hidden=!state.pickedDataId;
  });
  $('#deck-expand-label').textContent = state.deckExpanded
    ? '收起'
    : (state.bottomTab === 'time' ? '曲线' : state.bottomTab==='feature'?'对象资料':'剖面图');

  if (state.bottomTab === 'time') {
    const dates = navigableDates();
    const c=timelineChoices(dates);
    quick.innerHTML = `
      <button type="button" class="deck-btn icon-only ${state.playing ? 'active' : ''}" id="btn-tl-play" title="${state.playing ? '暂停播放' : timelinePlayTitle()}">${state.playing ? '⏸' : '▶'}</button>
      <button type="button" class="deck-btn icon-only" id="btn-tl-prev" aria-label="上一可选月份" title="上一可选月份">‹</button>
      <select class="deck-select" id="sel-year" aria-label="选择年份">${timelineOptions(c.years,c.year,'年')}</select>
      <select class="deck-select" id="sel-month" aria-label="选择月份">${timelineOptions(c.months,c.month,'月')}</select>
      <select class="deck-select" id="sel-timeline-calendar" title="有资料月份：任一湖有合格水面观测，或有同月影像；完整月历手动查无资料月；播放始终跳过。" aria-label="时间轴月份范围">
        <option value="available" ${state.timelineCalendarFull?'':'selected'}>有资料月</option>
        <option value="full" ${state.timelineCalendarFull?'selected':''}>完整月历</option>
      </select>
      <input type="range" class="deck-slider" id="tl-slider" min="0" max="${Math.max(0,dates.length - 1)}" value="${c.idx}" aria-label="月度时间轴" aria-valuetext="${state.month} · ${timelineMonthDescription()}${c.active?'':'（当前在筛选之外）'}">
      <button type="button" class="deck-btn icon-only" id="btn-tl-next" aria-label="下一可选月份" title="下一可选月份">›</button>
    `;
    $('#sel-timeline-calendar').onchange=e=>{
      stopPlay();state.timelineCalendarFull=e.target.value==='full';syncUrl();renderChartDeck();
    };
    $('#btn-tl-play').onclick = togglePlay;
    $('#btn-tl-prev').onclick = () => {
      stopPlay();
      const before=relativeTimelineDate(dates,state.month,-1);if(before)selectMonth(before,{timeline:true});
    };
    $('#btn-tl-next').onclick = () => {
      stopPlay();
      const after=relativeTimelineDate(dates,state.month,1);if(after)selectMonth(after,{timeline:true});
    };
    $('#tl-slider').oninput = e => {
      stopPlay();
      selectMonth(dates[Number(e.target.value)], { keepSlider: true, timeline: true });
    };
    $('#tl-slider').onchange = () => syncUrl();
    $('#sel-year').onchange = e => {
      stopPlay();
      const curM = state.month.slice(5, 7);
      const cand = `${e.target.value}-${curM}`;
      const hit = dates.includes(cand) ? cand : dates.find(d => d.startsWith(`${e.target.value}-`)) || state.month;
      selectMonth(hit, { timeline: true });
    };
    $('#sel-month').onchange = e => {
      stopPlay();
      const curY = state.month.slice(0, 4);
      const cand = `${curY}-${e.target.value}`;
      if (dates.includes(cand)) selectMonth(cand, { timeline: true });
    };
  } else if(state.bottomTab==='feature'){
    const f=provider.analysisById.get(state.pickedDataId);
    quick.innerHTML=f?`<span class="deck-mini-stat">所选：${esc(f.properties?.name||f.id)}</span>`:'<span class="card-note">未选中对象</span>';
  } else {
    const pd = getProfileData(state.activeProfileId);
    if (state.profileCursorIdx < 0 && pd) {
      state.profileCursorIdx = pd.zeroSampleIdx ?? 0;
      syncMapsState();
    }
    const curIdx = Math.max(0, Math.min((pd?.samples?.length || 1) - 1, state.profileCursorIdx));
    const cur = pd?.samples?.[curIdx];

    quick.innerHTML = pd ? `
      <select class="deck-select profile-sel" id="sel-profile" aria-label="选择地形剖面（统一分组，地名优先）">
        ${groupProfileIds(provider.analysisById.values()).some(g=>g.ids.includes(pd.id))?'':`<optgroup label="当前选中的线"><option value="${esc(pd.id)}" selected>${esc(pd.name)}</option></optgroup>`}
        ${groupProfileIds(provider.analysisById.values()).map(group => {
          const opts = group.ids.filter(pid => getProfileData(pid)).map(pid => {
            const f = provider.analysisById.get(pid);
            const nm = formatProfileDisplayName(f);
            return `<option value="${esc(pid)}" ${pid === state.activeProfileId ? 'selected' : ''}>${esc(nm)}</option>`;
          }).join('');
          return opts ? `<optgroup label="${esc(group.label)}">${opts}</optgroup>` : '';
        }).join('')}
      </select>
      <button type="button" class="deck-btn icon-only" id="btn-p-prev" aria-label="上一点" title="上一点">‹</button>
      <input type="range" class="deck-slider profile-range" id="prof-slider" min="0" max="${pd.samples.length - 1}" value="${curIdx}" aria-label="剖面采样点滑块">
      <button type="button" class="deck-btn icon-only" id="btn-p-next" aria-label="下一点" title="下一点">›</button>
      <span class="deck-mini-stat" id="deck-prof-mini">#${curIdx + 1} · ${cur.distance_m.toFixed(0)}m · ${describeProfileCursorElevation(cur)}</span>
      <button type="button" class="deck-btn" id="btn-prof-zero" title="跳回该剖面 0 m 锚点并定位">0m</button>
      <button type="button" class="deck-btn" id="btn-prof-fly" title="在地图上显示并定位整条剖面">定位整线</button>
    ` : '<span class="card-note">未找到剖面采样数据</span>';

    if (pd) {
      $('#sel-profile').onchange = e => {
        openLinkedProfile(e.target.value);
      };
      $('#btn-p-prev').onclick = () => setProfileSample(pd.id, Math.max(0, state.profileCursorIdx) - 1, { inPlace: true });
      $('#btn-p-next').onclick = () => setProfileSample(pd.id, Math.max(0, state.profileCursorIdx) + 1, { inPlace: true });
      $('#prof-slider').oninput = e => setProfileSample(pd.id, Number(e.target.value), { inPlace: true, deferUrl: true });
      $('#prof-slider').onchange = () => syncUrl();
      $('#btn-prof-zero').onclick = () => setProfileSample(pd.id, pd.zeroSampleIdx ?? 0, { flyToPoint: true });
      $('#btn-prof-fly').onclick=()=>openLinkedProfile(pd.id,{sample:state.profileCursorIdx<0?null:state.profileCursorIdx});
    }
  }

  if (state.deckExpanded) {
    renderChartDeckBody();
  }
  updateLayoutOffsets();
}

function renderChartDeckBody() {
  const sub = $('#deck-subbar');
  const host = $('#deck-chart-host');
  if (!sub || !host) return;

  if (state.bottomTab === 'time') {
    sub.innerHTML = `
      <div class="sub-seg" role="group" aria-label="时间比较方式">
        <button type="button" class="sub-seg-btn ${state.compareAxis === 'same-month' ? 'active' : ''}" data-axis="same-month">同月跨年</button>
        <button type="button" class="sub-seg-btn ${state.compareAxis === 'same-year' ? 'active' : ''}" data-axis="same-year">同年跨月</button>
      </div>
      <div class="subbar-right">
        <div class="sub-seg" role="group" aria-label="双湖图层视图">
          <button type="button" class="sub-seg-btn ${state.lakeView === 'BOTH' ? 'active' : ''}" data-tray-lake="BOTH">双湖</button>
          <button type="button" class="sub-seg-btn ${state.lakeView === 'MAIN' ? 'active' : ''}" data-tray-lake="MAIN">主湖</button>
          <button type="button" class="sub-seg-btn ${state.lakeView === 'WF1' ? 'active' : ''}" data-tray-lake="WF1">西长湖</button>
        </div>
        <select id="mobile-timeline-lakes" class="deck-select mobile-only" aria-label="地图和曲线显示的湖泊">
          ${[['BOTH','双湖'],['MAIN','主湖'],['WF1','西长湖']].map(([key,label])=>`<option value="${key}" ${state.lakeView===key?'selected':''}>${label}</option>`).join('')}
        </select>
      </div>
    `;

    host.innerHTML = renderDualLakeCompareCharts(provider.waterIndex, state.compareAxis, state.month, state.lakeView);

    sub.querySelectorAll('[data-axis]').forEach(b => {
      b.onclick = () => {
        stopPlay();
        state.compareAxis = b.dataset.axis;
        if ($('#btn-tl-play')) $('#btn-tl-play').title = timelinePlayTitle();
        syncUrl();
        renderChartDeckBody();
      };
    });
    const chooseLake = value => {
      stopPlay();
      setMapLakeScope(value);
      if ($('#btn-tl-play')) $('#btn-tl-play').title = timelinePlayTitle();
      updateHeaderPills();
      syncMapsState();
      syncUrl();
      renderLakeChips();
      const mobileFocused=document.activeElement?.id==='mobile-timeline-lakes';
      renderChartDeckBody();
      if(mobileFocused)$('#mobile-timeline-lakes')?.focus({preventScroll:true});
      updateLayoutOffsets();
      if (state.studioOpen && state.studioTab === 'layers') renderStudioDrawer();
    };
    sub.querySelectorAll('[data-tray-lake]').forEach(b => b.onclick = () => chooseLake(b.dataset.trayLake));
    $('#mobile-timeline-lakes').onchange=e=>chooseLake(e.target.value);
    host.querySelectorAll('[data-pick-date]').forEach(g => {
      g.onclick = () => {
        stopPlay();
        selectMonth(g.dataset.pickDate, { timeline: true });
      };
    });
    return;
  }

  if(state.bottomTab==='feature'){
    const f=provider.analysisById.get(state.pickedDataId), p=f?.properties||{};
    sub.innerHTML='<span class="card-note">当前矢量资料 · 不借用双湖月度数据</span>';
    host.innerHTML=f?`<article class="drawer-card" data-picked-feature="${esc(f.id)}">
      <h3 class="ev-title">${esc(p.name||f.id)}</h3>
      <p class="card-note">${esc(p.is_contour?'等高线 · 当前图层 '+contourInterval+' 米等高距':getFeatureVisualSpec(f).roleLabel||'地图对象')}</p>
      <p>${esc(p.description||p.placement_caveat||'此对象仅供地图定位。')}</p>
       ${!p.is_contour&&isTrack(f)&&!getProfileData(f.id)?'<p class="card-note">本线没有可用地表高程；不生成虚构剖面。</p>':''}
      <p class="card-note">该矢量没有独立时间序列。双湖观测请切回「时序」。</p>
    </article>`:'<p class="card-note">点选地图上的矢量查看资料。</p>';
    return;
  }
  // Profile Chart Body (Unified group chips + 0 m anchor + hover/touch linkage)
  const pd = getProfileData(state.activeProfileId);
  const curIdx = Math.max(0, Math.min((pd?.samples?.length || 1) - 1, state.profileCursorIdx));
  const groups = groupProfileIds(provider.analysisById.values());
  const shortGroupLabel = lbl =>
    lbl.startsWith('主湖') ? '主湖 5' :
    lbl.startsWith('办公楼') ? '办公院 2' :
    lbl.startsWith('西长湖') ? '外围 5' :
    lbl.startsWith('外围地形') ? '伊敏河' :
    lbl.startsWith('圆涵') ? '道路 4' :
    lbl.startsWith('水路线索') ? '水路纵横' :
    lbl.startsWith('其他') ? '其他' : lbl;

  sub.innerHTML = `
    <div class="sub-seg" role="group" aria-label="按分组快速切换剖面">
      ${groups.map(g => {
        const isCurrent = g.ids.includes(state.activeProfileId);
        return `<button type="button" class="sub-seg-btn ${isCurrent ? 'active' : ''}" data-prof-group-first="${esc(g.ids[0])}" title="${esc(g.label)}（${g.ids.length} 条）">${esc(shortGroupLabel(g.label))}</button>`;
      }).join('')}
    </div>
    <div class="subbar-right">
      ${pd ? `<button type="button" class="deck-btn" id="btn-prof-sub-zero" title="定位到 0 m 锚点">◎ 0 m 锚点</button>` : ''}
      <button type="button" class="deck-btn" id="btn-prof-clear">清除光标</button>
    </div>
  `;
  host.innerHTML = pd
    ? (state.pickedDataId===pd.id?`<p class="card-note" data-picked-line-note>当前所选线：${esc(pd.name)}。高程为未垂向夸张的地表值；该线没有独立时间序列，双湖观测请切回「时序」。</p>
      ${pd.note?`<p class="card-note">${esc(pd.note)}</p>`:''}`:'')+renderTerrainProfileChart(pd, curIdx)
    : '<div class="card-note">未找到剖面采样数据。</div>';

  sub.querySelectorAll('[data-prof-group-first]').forEach(btn => {
    btn.onclick = () => {
      const pid = btn.dataset.profGroupFirst;
      openLinkedProfile(pid);
    };
  });
  if ($('#btn-prof-sub-zero') && pd) {
    $('#btn-prof-sub-zero').onclick = () => setProfileSample(pd.id, pd.zeroSampleIdx ?? 0, { flyToPoint: true });
  }
  $('#btn-prof-clear').onclick = () => {
    state.profileCursorIdx = -1;
    syncMapsState();
    syncUrl();
    renderChartDeck();
  };

  if (pd) {
    const svg = host.querySelector('[data-profile-svg]');
    if (svg) {
      let scrubbing = false;
      const pickFromEvent = (e, { isHover = false } = {}) => {
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return;
        const padL = Number(svg.dataset.padL);
        const padR = Number(svg.dataset.padR);
        const viewW = Number(svg.dataset.viewW);
        const ctm=svg.getScreenCTM();
        const vx=ctm?new DOMPoint(e.clientX,e.clientY).matrixTransform(ctm.inverse()).x:((e.clientX-rect.left)/rect.width)*viewW;
        const frac = Math.max(0, Math.min(1, (vx - padL) / (viewW - padL - padR)));
        const m=pd.minDistM+frac*(pd.maxDistM-pd.minDistM);
        const gap=pd.gaps?.some(g=>m>g.startM&&m<g.endM);
        const targetIdx=pd.samples.reduce((best,r,i)=>(!gap||!Number.isFinite(r.glo30_m))&&(best<0||Math.abs(r.distance_m-m)<Math.abs(pd.samples[best].distance_m-m))?i:best,-1);
        if(targetIdx<0)return;
        if (targetIdx !== state.profileCursorIdx || (guidedTour.active&&!guidedTour.v74ProfileInteracted)) {
          setProfileSample(pd.id, targetIdx, {
            inPlace: true,
            deferUrl: true,
            selectProfileFeature: !isHover && !isMobileViewport(),
          });
        }
      };
      const endScrub = () => {
        if (!scrubbing) return;
        scrubbing = false;
        syncUrl();
      };
      svg.addEventListener('pointerdown', e => {
        e.preventDefault();
        scrubbing = true;
        try { svg.setPointerCapture(e.pointerId); } catch {}
        pickFromEvent(e);
      });
      svg.addEventListener('pointermove', e => {
        if (scrubbing) pickFromEvent(e);
        else if (e.pointerType === 'mouse' && !e.buttons) pickFromEvent(e, { isHover: true });
      });
      svg.addEventListener('pointerup', endScrub);
      svg.addEventListener('pointercancel', endScrub);
    }
  }
}

// ==========================================================================
// 389-Dataset Source & Unmapped Items Modal + Locked GeoJSON Exports
// ==========================================================================
function openCoverageModal() {
  const cov = provider.coverage;
  if (!cov) return;
  closePopover($('#export-menu'), $('#export-menu')?.contains(document.activeElement));
  $('#btn-export-menu')?.setAttribute('aria-expanded', 'false');
  const body = $('#coverage-modal-body');
  body.innerHTML = `
    <div class="drawer-card">
      <p style="margin:0 0 6px;font-size:12.5px">共登记既有研究资料 <strong>${cov.count}</strong> 项。${esc(cov.package_overlay || '')}</p>
      <p class="card-note" style="margin:0">未直接画入本页地图的上游资料均已保留归档；缺少原始空间几何的 7 项仅作文字或统计记录，不作推演补画。</p>
      ${cov.baseline?.commit ? `<details class="tech-details compact" style="margin-top:8px"><summary>查看基线版本编号</summary><div style="margin-top:4px;font-family:var(--font-mono);font-size:11px;color:var(--ink-2)">${esc(cov.baseline.commit)}</div></details>` : ''}
    </div>

    <h3 style="margin:12px 0 6px;font-size:13.5px;color:var(--ink-1)">一、暂未绘制空间几何的条目（共 ${cov.missing_geometry?.length || 0} 项）</h3>
    <table class="audit-table">
      <thead><tr><th>条目</th><th>当前状态</th><th>本图谱中的处理方式</th></tr></thead>
      <tbody>
        ${(cov.missing_geometry || []).map(m => `
          <tr>
            <td><strong>${esc(m.label)}</strong><br><code style="font-size:10px;color:var(--ink-3)">${esc(m.id)}</code></td>
            <td><span class="status-badge candidate">${esc(m.state)}</span></td>
            <td>${esc(m.replacement)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h3 style="margin:12px 0 6px;font-size:13.5px;color:var(--ink-1)">二、上游 389 项研究资料分组去向（共 ${cov.groups?.length || 0} 组）</h3>
    <table class="audit-table">
      <thead><tr><th>资料分组</th><th>数量</th><th>归类</th><th>保留与展示方式</th></tr></thead>
      <tbody>
        ${(cov.groups || []).map(g => `
          <tr>
            <td><strong>${esc(g.title)}</strong></td>
            <td style="font-family:var(--font-mono)">${g.count}</td>
            <td><code style="font-size:10px;color:var(--ink-3)">${esc(g.disposition)}</code></td>
            <td>${esc(g.rule)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  $('#coverage-modal').showModal();
}

function triggerJsonDownload(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/geo+json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

async function handleExportMonth() {
  const lockedMonth = state.month;
  const lockedLake = state.lakeView;
  closePopover($('#export-menu'), $('#export-menu')?.contains(document.activeElement));
  $('#btn-export-menu')?.setAttribute('aria-expanded', 'false');
  state.exportError = null;
  const btn = $('#btn-export-month');
  const orig = btn ? btn.innerHTML : '';
  if (btn) btn.disabled = true;
  try {
    const { filename, payload } = await resolveExportMonthPayload(provider, lockedMonth, lockedLake);
    triggerJsonDownload(filename, payload);
  } catch (err) {
    state.exportError = `导出 ${lockedMonth}（${lockedLake}）失败：${err?.message || err}`;
    renderAlerts();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }
}

async function handleExportAll() {
  const btn = $('#btn-export-all');
  const orig = btn.innerHTML;
  btn.disabled = true;
  state.exportError = null;
  try {
    await provider.loadAllWaterParts((done, total) => {
      btn.innerHTML = `<strong>正在汇总 40 年原始数据 (${done}/${total})…</strong><small>整理全部 489 个月双湖水面记录</small>`;
    });
    const payload = buildAllExport(provider.waterIndex, provider.waterParts);
    triggerJsonDownload('hujiernuoer-water-all-489m-978rec-945id.geojson', payload);
  } catch (err) {
    state.exportError = `全量导出失败：${err?.message || err}`;
    renderAlerts();
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
    closePopover($('#export-menu'), $('#export-menu')?.contains(document.activeElement));
    $('#btn-export-menu')?.setAttribute('aria-expanded', 'false');
  }
}

// ==========================================================================
// Draggable Deck Grip, Top-Layer Clamped Popovers & Global Event Wiring
// ==========================================================================
function bindDeckGrip() {
  const grip = $('#deck-grip');
  const body = $('#deck-body');
  if (!grip || !body) return;
  let drag = null;

  grip.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    try { grip.setPointerCapture(e.pointerId); } catch {}
    drag = {
      id: e.pointerId,
      startY: e.clientY,
      startH: state.deckExpanded ? body.getBoundingClientRect().height : 0,
      moved: false,
    };
  });

  grip.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dy = drag.startY - e.clientY;
    if (!drag.moved && Math.abs(dy) < 7) return;
    drag.moved = true;
    const targetH = drag.startH + dy;
    const maxH = Math.round(window.innerHeight * (isMobileViewport() ? 0.68 : 0.56));
    if (targetH < 64) {
      if (state.deckExpanded) setDeckExpanded(false);
    } else {
      setDeckExpanded(true, Math.max(150, Math.min(maxH, targetH)));
    }
  });

  const endDrag = e => {
    if (!drag || drag.id !== e.pointerId) return;
    const wasMoved = drag.moved;
    drag = null;
    if (e.type === 'pointercancel') return;
    if (!wasMoved) setDeckExpanded(!state.deckExpanded);
  };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);
  grip.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDeckExpanded(!state.deckExpanded);
    }
  });
}

let popoverPairs = [];

function positionPopover(btn, pop) {
  if (!btn || !pop || pop.hidden) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = btn.getBoundingClientRect();
  const deckH = $('#chart-deck')?.offsetHeight || 70;

  pop.style.right = 'auto';
  pop.style.bottom = 'auto';

  if (pop.id === 'scope-popover') {
    const popW = Math.min(304, vw - 16);
    pop.style.width = `${popW}px`;
    const heroRect = $('#atlas-hero-card')?.getBoundingClientRect();
    const anchorBottom = heroRect ? heroRect.bottom : rect.bottom;
    const top = Math.max(10, Math.min(anchorBottom + 6, vh - 160));
    const left = Math.max(8, Math.min(heroRect ? heroRect.left : rect.left, vw - popW - 8));
    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.maxHeight = `${Math.max(180, Math.round(vh - top - deckH - 12))}px`;
    return;
  }

  if (pop.id === 'basemap-popover') {
    const popW = Math.min(358, vw - 20);
    pop.style.width = `${popW}px`;
    const top = Math.max(10, Math.min(rect.bottom + 8, vh - 160));
    const left = Math.max(10, Math.min(rect.left, vw - popW - 10));
    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.maxHeight = `${Math.max(180, Math.round(vh - top - deckH - 14))}px`;
    return;
  }

  if (pop.id === 'export-menu') {
    const popW = Math.min(288, vw - 20);
    pop.style.width = `${popW}px`;
    const top = Math.max(10, Math.min(rect.bottom + 8, vh - 160));
    const left = Math.max(10, Math.min(rect.right - popW, vw - popW - 10));
    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.maxHeight = `${Math.max(180, Math.round(vh - top - 16))}px`;
    return;
  }

  if (pop.id === 'legend-popover') {
    if (isMobileViewport()) {
      const tlRect = $('#hud-top-left')?.getBoundingClientRect();
      const top = Math.max(54, Math.min(tlRect ? tlRect.bottom + 6 : 96, Math.round(vh * 0.24)));
      const maxH = Math.max(180, Math.round(vh - top - deckH - 12));
      pop.style.left = '10px';
      pop.style.width = `${vw - 20}px`;
      pop.style.top = `${Math.round(top)}px`;
      pop.style.maxHeight = `${maxH}px`;
      return;
    }
    const popW = Math.min(316, vw - 84);
    pop.style.width = `${popW}px`;
    const topMin = 66;
    const safeBottom = Math.max(topMin + 200, vh - deckH - 22);
    const maxAvail = safeBottom - topMin;
    pop.style.maxHeight = `${Math.round(maxAvail)}px`;
    const naturalH = Math.min(pop.scrollHeight + 4, maxAvail);
    // Anchor downward from button when possible; clamp cleanly inside [topMin, safeBottom]
    const top = Math.max(topMin, Math.min(rect.top, safeBottom - naturalH));
    const left = Math.max(12, Math.min(rect.left - popW - 10, vw - popW - 12));
    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.maxHeight = `${Math.max(180, Math.round(safeBottom - top))}px`;
  }
}

const popoverOpeners = new Map();
const focusableIn = root => [...root.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]')]
  .filter(el => el.tabIndex >= 0 && el.getClientRects().length && !el.closest('[hidden],[inert]') && getComputedStyle(el).visibility !== 'hidden');

function closePopover(pop, restoreFocus = false) {
  if (!pop || pop.hidden) return false;
  const opener = popoverOpeners.get(pop);
  popoverOpeners.delete(pop);
  pop.hidden = true;
  for (const [btn, panel] of popoverPairs) if (panel === pop) btn.setAttribute('aria-expanded', 'false');
  if (restoreFocus) opener?.focus({preventScroll:true});
  return true;
}

function repositionOpenPopovers() {
  for (const [pop, btn] of popoverOpeners) positionPopover(btn, pop);
}

function bindPopovers() {
  popoverPairs = [
    ...['scope-popover','basemap-popover'].flatMap(id => $$('[aria-controls="'+id+'"]').map(btn => [btn, document.getElementById(id)])),
    [$('#btn-export-menu'), $('#export-menu')],
    [$('#btn-legend'), $('#legend-popover')],
  ].filter(([btn,pop]) => btn && pop);
  const closeAll = (except = null, restoreFocus = false) => {
    let closedAny = false;
    for (const pop of popoverOpeners.keys()) {
      if (pop !== except && closePopover(pop, restoreFocus)) closedAny = true;
    }
    return closedAny;
  };
  for (const [btn, pop] of popoverPairs) {
    btn.onclick = e => {
      e.stopPropagation();
      const wasSameOpener = !pop.hidden && popoverOpeners.get(pop) === btn;
      closeAll(pop);
      if (wasSameOpener) { closePopover(pop, true); return; }
      if (!pop.hidden) closePopover(pop);
      pop.hidden = false;
      if (pop.id === 'basemap-popover') fixedHistory.prepareMenu?.();
      popoverOpeners.set(pop, btn);
      btn.setAttribute('aria-expanded', 'true');
      positionPopover(btn, pop);
      requestAnimationFrame(() => {
        if (popoverOpeners.get(pop) === btn) positionPopover(btn, pop);
      });
      if (e.detail === 0) {
        const current = pop.id === 'scope-popover' ? '.scope-pop-btn.active, .scope-pop-btn'
          : '#timeline-imagery-sync';
        const target = pop.id === 'scope-popover'
          ? pop.querySelector('.scope-pop-btn.active') || pop.querySelector(current)
          : pop.id === 'basemap-popover'
            ? pop.querySelector(current) || pop.querySelector('#timeline-imagery-sync')
            : null;
        (target || focusableIn(pop)[0])?.focus();
      }
    };
  }
  $$('[data-close-popover]').forEach(closeBtn => {
    closeBtn.onclick = () => closePopover(document.getElementById(closeBtn.dataset.closePopover), true);
  });
  document.addEventListener('pointerdown', e => {
    for (const pop of popoverOpeners.keys()) {
      if (!pop.contains(e.target) && !popoverPairs.some(([btn,panel]) => panel===pop && btn.contains(e.target))) closePopover(pop);
    }
  });
  document.addEventListener('focusin', e => {
    for (const [pop, opener] of popoverOpeners) {
      if (!pop.contains(e.target) &&
          !opener.contains(e.target) && !popoverPairs.some(([btn,panel]) => panel===pop && btn.contains(e.target))) closePopover(pop);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      for (const [pop, opener] of popoverOpeners) {
        if (!pop.contains(document.activeElement)) continue;
        const options = focusableIn(pop);
        const boundary = e.shiftKey ? options[0] : options.at(-1);
        if (document.activeElement !== boundary) continue;
        const outside = focusableIn(document).filter(el => !pop.contains(el));
        const next = e.shiftKey ? opener : outside[outside.indexOf(opener)+1];
        closePopover(pop, true);
        if (next) { e.preventDefault(); next.focus(); }
        return;
      }
    }
    if (e.key !== 'Escape') return;
    if ($('#coverage-modal')?.open) return; // Native <dialog> handles its own Esc
    if (closeAll(null, true)) { e.preventDefault(); return; }
    if (state.selectedFeatureId && !$('#inspector-drawer')?.hidden) {
      selectFeature(null);
      return;
    }
    if (state.studioOpen) {
      closeStudioDrawer();
      return;
    }
    if (state.deckExpanded) {
      setDeckExpanded(false);
    }
  });
}

function bindEvents() {
  bindPopovers();
  bindDeckGrip();

  // 2D / 3D & Exaggeration
  const changeMapDimension=dim=>{
    setDimension(dim);
    const id=state.activeProfileId, f=provider.analysisById.get(id);
    if(state.bottomTab==='profile'&&state.selectedFeatureId===id&&(state.visibleLayers.has(f?.properties?.layer)||isInScenePreset(id)))
      fitVisibleObjects([f],()=>state.bottomTab==='profile'&&state.activeProfileId===id&&(state.visibleLayers.has(f.properties.layer)||isInScenePreset(id)));
  };
  $('#btn-2d').onclick=()=>changeMapDimension('2d');
  $('#btn-3d').onclick=()=>changeMapDimension('3d');
  $$('[data-exag]').forEach(b => {
    b.onclick = () => {
      state.exag3d = Number(b.dataset.exag);state.exagExplicit=true;
      $$('[data-exag]').forEach(x => x.classList.toggle('active', x === b));
      map3d?.setExaggeration(state.exag3d);
      if (is3DActive()) $('#render-engine-badge').textContent = `3D WebGL (${state.exag3d}×)`;
      syncUrl();
    };
  });

  // Top-left dual-date pill shortcuts
  $('#pill-water-month').onclick = () => {
    state.bottomTab = 'time';
    setDeckExpanded(!state.deckExpanded);
    renderChartDeck();
  };
  $('#quick-contour-distance').onchange=e=>setContourInterval(e.target.value);
  $('#quick-slope-aspect-density').onchange=e=>setSlopeDensity(e.target.value);
  $('#quick-slope-aspect-toggle').onchange=e=>setSlopeEnabled(e.target.checked);
  $('#quick-contour-toggle').onchange = e => setContoursEnabled(e.target.checked);
  $('#quick-history-toggle').onchange = e => setHistoricalLayers(historicalLayers, e.target.checked);

  // Top-right drawer triggers
  $$('[data-drawer-tab]').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.dataset.drawerTab;
      if (state.studioOpen && state.studioTab === tab) closeStudioDrawer();
      else if (tab === WATERWAY_PANEL) openWaterwayOverview();
      else if (tab === 'crossings') openCrossingsWorkspace(state.crossingStructure, { fly: true });
      else openStudioDrawer(tab);
    };
  });

  // Studio drawer tabs & close
  $$('[data-studio-tab]').forEach(t => {
    t.onclick = () => {
      const nextTab = t.dataset.studioTab;
      if (nextTab === WATERWAY_PANEL) {openWaterwayOverview();return;}
      if (nextTab === 'crossings') {
        openCrossingsWorkspace(state.crossingStructure, { fly: false });
        return;
      }
      state.studioTab = nextTab;
      renderStudioDrawer();
    };
  });
  $('#btn-close-studio').onclick = closeStudioDrawer;
  const studioHandle = $('#studio-sheet-handle');
  studioHandle.onclick = closeStudioDrawer;
  studioHandle.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeStudioDrawer(); } };
  $('#sheet-backdrop').onclick = closeStudioDrawer;

  // Mobile inspector handle toggles half <-> tall sheet
  const toggleInspTall = () => {
    const d = $('#inspector-drawer');
    if (!d) return;
    const tall = d.dataset.tall !== 'true';
    d.dataset.tall = String(tall);
    const lbl = $('#inspector-handle-label');
    if (lbl) lbl.textContent = tall ? '轻点恢复半屏' : '轻点展开 / 恢复半屏';
  };
  const inspHandle = $('#inspector-sheet-handle');
  inspHandle.onclick = toggleInspTall;
  inspHandle.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleInspTall(); } };

  // Export & Coverage modal
  $('#btn-export-month').onclick = handleExportMonth;
  $('#btn-export-all').onclick = handleExportAll;
  $('#btn-coverage').onclick = openCoverageModal;
  $('#btn-close-coverage').onclick = () => $('#coverage-modal').close();

  // Dark Charcoal / Warm Paper Light Theme Toggle (inside Tools Popover + fallback toggle)
  if ($('#btn-theme-toggle')) {
    $('#btn-theme-toggle').onclick = () => applyTheme(state.theme === 'light' ? 'dark' : 'light');
  }
  $$('[data-set-theme]').forEach(btn => {
    btn.onclick = () => applyTheme(btn.dataset.setTheme);
  });

  // Focus Scope Bar (Main-Lake-First + Peripheral Comparisons)
  $$('[data-focus-scope]').forEach(btn => {
    btn.onclick = () => selectFocusScope(btn.dataset.focusScope);
  });

  // Persistent Return-to-Route Pill
  if ($('#btn-return-waterway')) {
    $('#btn-return-waterway').onclick = returnToWaterwayRoute;
  }
  if ($('#btn-dismiss-return')) {
    $('#btn-dismiss-return').onclick = () => {
      state.waterwayReturn = null;
      renderWaterwayReturnPill();
      if (state.selectedFeatureId) renderInspectorDrawer();
    };
  }

  // Right-edge Cartographic Rail
  $('#btn-compass').onclick = () => {
    if (is3DActive()) map3d.resetNorth();
    else setCompassAngle(0);
  };
  $('#btn-zoom-in').onclick = () => (is3DActive() ? map3d.zoomBy(1.3) : map2d?.zoomBy(1.3));
  $('#btn-zoom-out').onclick = () => (is3DActive() ? map3d.zoomBy(1 / 1.3) : map2d?.zoomBy(1 / 1.3));
  if ($('#btn-fit-all')) $('#btn-fit-all').onclick = () => {
    closeScopePopover();
    if(!walkMode.active)fitActiveBounds(AOI_BOUNDS,1.06);
  };
  if ($('#btn-fit-main')) $('#btn-fit-main').onclick = () => selectFocusScope('main');
  if ($('#btn-fit-crossings')) {
    $('#btn-fit-crossings').onclick = () => selectFocusScope('crossings');
  }
  if ($('#btn-fit-office')) {
    $('#btn-fit-office').onclick = () => selectFocusScope('office');
  }
  if ($('#btn-fit-southeast')) {
    $('#btn-fit-southeast').onclick = () => openSoutheastInspection(SE_PRIMARY_WINDOW, state.month, { fly: true });
  }
  if ($('#btn-fit-wf1')) $('#btn-fit-wf1').onclick = () => fitActiveBounds(provider.waterIndex.lakes.WF1.bounds_wgs84, 1.9);
  if ($('#btn-fit-g332')) {
    $('#btn-fit-g332').onclick = () => {
      state.visibleLayers.add('road-review');
      state.visibleLayers.add('roads');
      updateActiveLayerBadge();
      selectFeature('g332-wf1-review', { fly: true });
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSoutheastStepping();
    }
  });

  // Bottom Deck Mode & Expand button
  $$('[data-deck-mode]').forEach(b => {
    b.onclick = () => {
      if(b.dataset.deckMode==='profile'&&state.activeProfileId&&openLinkedProfile(state.activeProfileId,{sample:state.profileCursorIdx<0?null:state.profileCursorIdx}))return;
      if(b.dataset.deckMode!=='time')stopPlay();
      state.bottomTab = b.dataset.deckMode;
      syncMapsState();
      syncUrl();
      renderChartDeck();
    };
  });
  $('#btn-deck-expand').onclick = () => setDeckExpanded(!state.deckExpanded);

  // Keep legend & popovers cleanly clamped whenever layout shifts
  const semanticLegend=$('#analysis-semantic-legend');
  if(semanticLegend)semanticLegend.innerHTML=Object.entries(ANALYSIS_PALETTE).map(([id,row])=>
    `<div class="legend-row"><span class="swatch visual-policy-swatch" style="--policy-color:${row.stroke};--policy-fill:${row.fill}" data-legend-tone="${id}"></span><span><strong>${esc(row.label)}</strong>：${esc(row.note)}</span></div>`).join('');
  for(const el of $$('#legend-popover [data-legend-tone]')){
    const tone=ANALYSIS_PALETTE[el.dataset.legendTone];
    el.style.setProperty('--policy-color',tone.stroke);
    el.style.setProperty('--policy-fill',tone.fill);
  }
  const legDetails = $('#legend-popover details');
  if (legDetails) {
    legDetails.addEventListener('toggle', () => requestAnimationFrame(repositionOpenPopovers));
  }
  const rail = $('#hud-rail');
  if (rail) {
    rail.addEventListener('transitionend', () => repositionOpenPopovers());
  }

  const deckCollapse = $('#deck-body-collapse');
  if (deckCollapse) {
    deckCollapse.addEventListener('transitionend', () => {
      updateLayoutOffsets();
      repositionOpenPopovers();
    });
  }
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => {
      updateLayoutOffsets();
      repositionOpenPopovers();
    });
    if ($('#chart-deck')) ro.observe($('#chart-deck'));
    if ($('#hud-top-left')) ro.observe($('#hud-top-left'));
    const mapObserver=new ResizeObserver(resizeActiveMap);
    mapObserver.observe($('#map-stage'));
  }

  window.addEventListener('resize', () => {
    // Live reflow when dragging wide -> 820px -> 390px without reload
    if (isCompactViewport() && state.studioOpen && state.selectedFeatureId && !$('#inspector-drawer')?.hidden) {
      closeStudioDrawer();
    }
    if (isMobileViewport() && !guidedTour.active && state.studioOpen && state.deckExpanded) {
      setDeckExpanded(false);
    }
    resizeActiveMap();
    syncSheetBackdrop();
    updateLayoutOffsets();
    repositionOpenPopovers();
  });
}

// ==========================================================================
// Boot
// ==========================================================================
const WALK_SUN_CLOCK={morning:480,noon:720,evening:1080};
const WALK_KEYS={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',
  KeyD:'right',ArrowRight:'right',KeyE:'up',Space:'up',KeyQ:'down',KeyC:'down',ControlLeft:'down',ControlRight:'down',
  ShiftLeft:'fast',ShiftRight:'fast'};
let walkRAF=0,walkDrag=null,walkWheelAccum=0,walkWheelAt=-Infinity;
const walkKeys=new Set(),walkTouches=new Map();
const walkCanvas=()=>map3d?.renderer?.domElement;
const hasWalkLock=()=>Boolean(walkCanvas()&&document.pointerLockElement===walkCanvas());
function currentWalkControls(){
 const ctl={};
 for(const k of walkKeys)ctl[WALK_KEYS[k]]=true;
 for(const {key} of walkTouches.values())ctl[key]=true;
 return ctl;
}
function updateWalkSpeed(){
 if(!walkMode.active)return;
 const guide=walkMode.mode==='guide';
 $('#walk-speed-controls').hidden=guide;
 if(guide)return;
 const level=walkMode.speedLevels[walkMode.mode];
 const speed=walkHorizontalMps(walkMode.mode,level,currentWalkControls().fast);
 const axis=walkMode.mode==='fly'?'水平与升降':'步行';
 $('#walk-speed-value').textContent=`${WALK_SPEED_LEVELS[level]}× · ${axis} ${speed.toLocaleString('zh-CN',{maximumFractionDigits:1})} 米/秒`;
 for(const button of $$('[data-walk-speed-step]')){
   button.disabled=Number(button.dataset.walkSpeedStep)<0?level===0:level===walkSpeedMaxLevel(walkMode.mode);
 }
}
function changeWalkSpeed(step){
 if(!walkMode.active||walkMode.mode==='guide')return;
 const levels=walkMode.speedLevels,mode=walkMode.mode;
 levels[mode]=Math.max(0,Math.min(walkSpeedMaxLevel(mode),levels[mode]+step));
 updateWalkSpeed();
}
function clearTerrainInputs(){
 walkKeys.clear();
 for(const {el} of walkTouches.values())delete el.dataset.held;
 walkTouches.clear();
 walkDrag=null;
 walkMode.tick=null;walkWheelAccum=0;walkWheelAt=-Infinity;
 updateWalkSpeed();
}
function stopTerrainGuide(){
 walkMode.playing=false;walkMode.tick=null;
 const btn=$('#walk-start');
 if(btn)btn.textContent='开始导览';
}
function releaseWalkLock(){
 if(hasWalkLock()){try{document.exitPointerLock?.();}catch{}}
}
function walkHUD(){
 const locked=hasWalkLock();
 $('#observatory')?.classList.toggle('walk-locked',locked);
 $('#walk-input-note').textContent=locked?'鼠标已接管。WASD 移动，Shift 加速，F 切换步行／飞行；滚轮调移动速度。飞行按 E／空格升、Q／C／Ctrl 降；Esc 释放鼠标。':
  window.matchMedia('(pointer:coarse)').matches?'滑动画面转头，按住方向键移动，−／＋调速；飞行用升、降。':
  '左键点击接管鼠标；按住右键或左键拖动转头。WASD 移动，Shift 加速，F 切换步行／飞行；画面上滚轮调速。飞行按 E／空格升、Q／C／Ctrl 降。';
}
function manualAerialPosition(previous,next){
 const oldGround=map3d.hasWalkGround(previous.lon,previous.lat);
 const newGround=map3d.hasWalkGround(next.lon,next.lat);
 if(oldGround&&newGround)return next;
 const from=previous.guideOriginM??(oldGround?guideGround(previous.lon,previous.lat):null);
 if(!Number.isFinite(from)||!map3d.hasAerialFramingRoom(next.lon,next.lat))return previous;
 if(newGround){
   const ground=guideGround(next.lon,next.lat);
   return {...next,eyeM:Math.max(2,next.eyeM+(from-ground)*map3d.exag),outsideTerrain:false,guideOriginM:undefined};
 }
 return {...next,guideOriginM:from,outsideTerrain:true};
}
function renderWalkPose(){
 if(!walkMode.active)return;
 const guide=walkMode.mode==='guide';
 const pose=guide?{...sampleWalkRoad(walkMode.road,walkMode.station),pitch:-2.3,site:'road'}:walkMode.pose;
 const sun=beijingSun($('#walk-date').value,WALK_SUN_CLOCK[walkMode.sunKey],pose.lon,pose.lat);
 if(!guide&&map3d.hasWalkGround(pose.lon,pose.lat))walkMode.lastGroundPose=pose;
 if(!map3d.setTerrainWalkPose(pose,sun,{simulatedSky:!guide})){
   stopTerrainGuide();clearTerrainInputs();$('#walk-chain').textContent='超出可用地形，已停下';return;
 }
 const chain=guide?`${Math.round(pose.stationM)} / ${Math.round(walkMode.road.lengthM)} 米 · 加速示意`:
   `${walkMode.mode==='fly'?'飞行':'步行'} ·  ${pose.outsideTerrain?'范围外 · 边缘参考高度':'离地'} ${pose.eyeM.toFixed(1)} 米 · 朝向 ${Math.round(pose.heading)}°`;
 if($('#walk-chain').textContent!==chain)$('#walk-chain').textContent=chain;
 $('#walk-guide-controls').hidden=!guide;
 $('#walk-site').disabled=guide;
 updateWalkLayerNote();
 for(const b of $$('[data-walk-hold]')){
   if(['up','down'].includes(b.dataset.walkHold))b.disabled=walkMode.mode!=='fly';else b.disabled=guide;
 }
 if(sun){
   const text=`真北方位 ${Math.round(sun.azimuth)}° · 太阳高度 ${Math.round(sun.altitude)}°${sun.altitude<=0?'（地平线下）':''}`;
   if($('#walk-sun').textContent!==text)$('#walk-sun').textContent=text;
 }else $('#walk-sun').textContent='日期无效，保留上次光照';
}
function startWalkTick(){
 if(walkRAF)return;
 const advance=now=>{
   walkRAF=0;
   if(!walkMode.active){walkMode.tick=null;return;}
   const ctl=currentWalkControls();
   const moving=walkMode.mode!=='guide'&&Object.keys(ctl).some(k=>k!=='fast');
   if(!walkMode.playing&&!moving){walkMode.tick=null;return;}
   const dt=walkMode.tick==null?0:Math.min(.10,(now-walkMode.tick)/1000);
   walkMode.tick=now;
   if(walkMode.mode==='guide'&&walkMode.playing){
     walkMode.station=Math.min(walkMode.road.lengthM,walkMode.station+WALK_GUIDE_SPEED_MPS*dt);
     if(walkMode.station>=walkMode.road.lengthM)stopTerrainGuide();
   }else if(moving){
     const prev=walkMode.pose, isFly=walkMode.mode==='fly';
     const next=stepFreePose(prev,ctl,dt,walkMode.mode,(x,y)=>isFly?map3d.hasAerialFramingRoom(x,y):map3d.hasWalkGround(x,y),walkMode.speedLevels[walkMode.mode]);
     walkMode.pose=isFly?manualAerialPosition(prev,next):next;
   }
   renderWalkPose();
   if(walkMode.playing||moving)walkRAF=requestAnimationFrame(advance);
 };
 walkRAF=requestAnimationFrame(advance);
}
function runTerrainGuide(){
 if(walkMode.playing){stopTerrainGuide();return;}
 if(!walkMode.active||walkMode.mode!=='guide')return;
 if(walkMode.station>=walkMode.road.lengthM)walkMode.station=0;
 walkMode.playing=true;$('#walk-start').textContent='暂停导览';startWalkTick();
}
function setFreeWalkMode(mode){
 const before=walkMode.mode;
 walkMode.mode=mode;
 if(mode==='walk'&&walkMode.pose.outsideTerrain){const p=walkMode.lastGroundPose||walkMode.origin;walkMode.pose={...p,heading:walkMode.pose.heading};}
 if(mode==='walk'||(mode==='fly'&&before!=='fly'))walkMode.pose={...walkMode.pose,eyeM:mode==='fly'?FREE_FLY_ENTRY_M:WALK_EYE_M};
 $('#walk-mode').value=mode;
 updateWalkSpeed();walkHUD();renderWalkPose();
}
function walkExaggeration(value){
 map3d.setExaggeration(value);
 $$('[data-walk-exag]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.walkExag)===value)));
}
function updateWalkLayerNote(){
 if(!walkMode.active)return;
 const [all,views3d]=optionalAnalysisFeatures();
 const absent=all!==views3d&&all.some(f=>state.visibleLayers.has(f.properties?.layer)&&isWayback2dOnly(f));
 const text=[walkMode.boundaryMessage,absent?'已打开的部分 Wayback 核查范围只在二维显示。':''].filter(Boolean).join(' ');
 const el=$('#walk-coverage-note');if(el.textContent!==text)el.textContent=text;el.hidden=!text;
}
function walkSpawn(site){
 const eyeM=walkMode.mode==='fly'?FREE_FLY_ENTRY_M:WALK_EYE_M;
 if(site==='current')return {...walkMode.origin,eyeM,site:'free'};
 if(site==='office'){
   const [lon,lat]=walkMode.office;
   return {lon,lat,heading:105,pitch:-3,eyeM,site:'free'};
 }
 const {lon,lat,heading}=sampleWalkRoad(walkMode.road,walkMode.road.lengthM*.5);
 return {lon,lat,heading,pitch:-3,eyeM,site:'free'};
}
function turnFreeWalk(x,y){
 if(!walkMode.active||walkMode.mode==='guide'||!Number.isFinite(x+y))return;
 walkMode.pose=adjustFreeLook(walkMode.pose,x,y);
 renderWalkPose();
}
function closeTerrainWalk({lost=false,stay3d=false}={}){
 if(!walkMode.active){if($('#walk-lab'))$('#walk-lab').hidden=true;return;}
 stopTerrainGuide();clearTerrainInputs();releaseWalkLock();
 if(walkRAF)cancelAnimationFrame(walkRAF);
 walkRAF=0;
 const saved=walkMode.saved;
 walkMode.active=false;walkMode.saved=null;
 try{map3d?.leaveTerrainWalk();}catch{}
 if(contoursEnabled!==saved.contoursEnabled)setContoursEnabled(saved.contoursEnabled,{persist:false});
 $('#walk-lab').hidden=true;
 $('#observatory')?.classList.remove('walk-active','walk-locked');
 if(!lost&&!stay3d&&!saved.view3d){
   setDimension('2d');
   if(saved.focus2d)map2d.flyTo({...saved.focus2d,duration:0,exactFocus:true});
 }
 updateLayoutOffsets();
 if(!lost&&!stay3d)$('#btn-open-walk')?.focus({preventScroll:true});
}
function openTerrainWalk(){
 if(guidedTour.active)closeGuidedTour();
 if(walkMode.active)return;
 const road=prepareWalkRoad(provider.analysisById.get(WALK_ROAD_ID),provider.analysisById.get(WALK_ROAD_PHOTO)?.geometry?.coordinates);
 const office=provider.analysisById.get(WALK_OFFICE_ID)?.geometry?.coordinates;
 const panel=$('#walk-lab');
 const fail=msg=>{
   $('#walk-chain').textContent=msg;panel.hidden=false;
   $('#walk-coverage-note').hidden=true;
   panel.querySelectorAll('button,input,select').forEach(el=>{el.disabled=el.id!=='walk-close';});
 };
 if(!map3d||map3d.failed)return fail('这台浏览器暂不支持 WebGL 漫游；二维图谱仍可用');
 const startView3d=state.view3d,focus2d=map2d.getCameraFocus();
 const focus=startView3d?map3d.getCameraFocus():focus2d;
 const bounds=provider.dem?.bounds_wgs84;
 if(!bounds||![focus.lon,focus.lat].every(Number.isFinite))return fail('当前地图没有可用地形，无法从这里开始漫游。');
 let {lon,lat}=focus;
 let boundaryMessage='';
 if(!map3d.hasWalkGround(lon,lat)){
   lon=Math.max(bounds[0]+1e-7,Math.min(bounds[2]-1e-7,lon));
   lat=Math.max(bounds[1]+1e-7,Math.min(bounds[3]-1e-7,lat));
   if(!map3d.hasWalkGround(lon,lat))return fail('地图中心超出可漫游地形，请移动到有地形覆盖的位置。');
   boundaryMessage='原地图中心超出地形覆盖，已从最近的地形边缘起飞；退出返回原位置。';
 }
 const heading=startView3d?map3d.getOrbitBearing():0;
 const saved={view3d:startView3d,focus2d,contoursEnabled};
 const hasRoad=Boolean(road),hasOffice=Array.isArray(office)&&map3d.hasWalkGround(...office);
 stopPlay();
 if(state.studioOpen)closeStudioDrawer();
 hideInspectorSurface();setDimension('3d');
 if(!map3d.enterTerrainWalk(road?.coords||[]))return fail('暂无法进入 WebGL 漫游');
 Object.assign(walkMode,{active:true,saved,road,office,origin:{lon,lat,heading,pitch:-12},boundaryMessage,
   site:'current',mode:'fly',station:0,sunKey:'noon',playing:false,tick:null,speedLevels:{walk:WALK_SPEED_DEFAULT,fly:FLY_SPEED_DEFAULT}});
 walkMode.pose=walkSpawn('current');
 panel.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);
 $('#walk-site').querySelector('[value="road"]').disabled=!hasRoad;
 $('#walk-site').querySelector('[value="office"]').disabled=!hasOffice;
 $('#walk-mode').querySelector('[value="guide"]').disabled=!hasRoad;

 $$('[data-walk-sun]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.walkSun==='noon')));
 $('#walk-mode').value='fly';$('#walk-site').value='current';panel.hidden=false;
 $('#observatory').classList.add('walk-active');
 walkCanvas()?.focus({preventScroll:true});
 walkExaggeration(8);updateContourControls();updateWalkSpeed();walkHUD();renderWalkPose();
}
// Keep buttons operable after a touch swipe even if the browser omits its synthetic click.
function bindWalkTapButton(button,activate){
 let tap=null,completedAt=-Infinity;
 button.onpointerdown=e=>{if(e.pointerType==='touch')tap={id:e.pointerId,x:e.clientX,y:e.clientY};};
 button.onpointercancel=()=>{tap=null;};
 button.onpointerup=e=>{
   const start=tap;tap=null;
   if(button.disabled||e.pointerType!=='touch'||start?.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)return;
   completedAt=performance.now();activate();
 };
 button.onclick=e=>{
   if(e.detail!==0&&(e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents)&&performance.now()-completedAt<800)return;
   if(!button.disabled)activate();
 };
}
function wireTerrainWalk(){
 $('#btn-open-walk').onclick=openTerrainWalk;
 $('#walk-close').onclick=()=>closeTerrainWalk();
 $('#walk-start').onclick=runTerrainGuide;
 bindWalkTapButton($('#walk-layer-trigger'),()=>{if(walkMode.active)openStudioDrawer('layers');});
 bindWalkTapButton($('#walk-contour-toggle'),()=>{if(walkMode.active)setContoursEnabled(!contoursEnabled,{persist:false});});
 for(const b of $$('[data-walk-speed-step]'))bindWalkTapButton(b,()=>changeWalkSpeed(Number(b.dataset.walkSpeedStep)));
 $$('[data-walk-exag]').forEach(b=>b.onclick=()=>{if(walkMode.active)walkExaggeration(Number(b.dataset.walkExag));});
 $('#walk-mode').onchange=e=>{
   stopTerrainGuide();clearTerrainInputs();releaseWalkLock();
   setFreeWalkMode(e.target.value);
   const canvas=walkCanvas();canvas?.focus({preventScroll:true});
 };
 $('#walk-site').onchange=e=>{
   stopTerrainGuide();clearTerrainInputs();walkMode.site=e.target.value;
   walkMode.pose=walkSpawn(walkMode.site);renderWalkPose();walkCanvas()?.focus({preventScroll:true});
 };
 $('#walk-date').onchange=renderWalkPose;
 $$('[data-walk-sun]').forEach(b=>b.onclick=()=>{
   walkMode.sunKey=b.dataset.walkSun;
   $$('[data-walk-sun]').forEach(x=>x.setAttribute('aria-pressed',String(b===x)));
   renderWalkPose();
 });
 for(const el of $$('[data-walk-hold]')){
   const end=e=>{
      walkTouches.delete(e.pointerId);
      if(![...walkTouches.values()].some(v=>v.el===el))delete el.dataset.held;
   };
   el.addEventListener('pointerdown',e=>{
     if(!walkMode.active||el.disabled)return;
     e.preventDefault();el.setPointerCapture?.(e.pointerId);
     walkTouches.set(e.pointerId,{key:el.dataset.walkHold,el});el.dataset.held='true';startWalkTick();
   });
   for(const typ of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(typ,end);
 }
 const canvas=walkCanvas();
 if(canvas){
   canvas.tabIndex=0;
   document.addEventListener('wheel',e=>{
     if(!walkMode.active||walkMode.mode==='guide'||e.ctrlKey||!e.deltaY)return;
     if(e.target!==canvas&&!hasWalkLock())return;
     e.preventDefault();
     const now=performance.now(),dy=e.deltaY*(e.deltaMode===1?32:e.deltaMode===2?80:1);
     if(now-walkWheelAt>220||Math.sign(dy)!==Math.sign(walkWheelAccum))walkWheelAccum=0;
     walkWheelAt=now;walkWheelAccum+=dy;
     if(Math.abs(walkWheelAccum)<28)return;
     changeWalkSpeed(walkWheelAccum<0?1:-1);
     walkWheelAccum=Math.abs(dy)>=28?0:walkWheelAccum-Math.sign(walkWheelAccum)*28;
   },{capture:true,passive:false});
   $('#map-3d-stage').addEventListener('contextmenu',e=>{if(walkMode.active)e.preventDefault();});
   canvas.addEventListener('pointerdown',e=>{
     if(!walkMode.active||walkMode.mode==='guide'||hasWalkLock())return;
     if(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)return;
     if(e.button===2)e.preventDefault();
     walkDrag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,button:e.button};
     canvas.focus({preventScroll:true});
     canvas.setPointerCapture?.(e.pointerId);
   });
   canvas.addEventListener('pointermove',e=>{
     if(!walkDrag||walkDrag.id!==e.pointerId||hasWalkLock())return;
     const dx=e.clientX-walkDrag.x,dy=e.clientY-walkDrag.y;
     if(!walkDrag.moved&&Math.abs(dx)+Math.abs(dy)<3)return;
     walkDrag.x=e.clientX;walkDrag.y=e.clientY;walkDrag.moved=true;
     turnFreeWalk(dx,dy);
   });
   const end=e=>{
      if(!walkDrag||walkDrag.id!==e.pointerId)return;
      const lock=e.type==='pointerup'&&!walkDrag.moved&&walkDrag.button===0&&e.pointerType==='mouse';
      walkDrag=null;
      if(lock&&canvas.requestPointerLock)try{canvas.requestPointerLock()?.catch?.(()=>{});}catch{}
   };
   for(const typ of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(typ,end);
 }
 document.addEventListener('pointerlockchange',()=>{
   if(!hasWalkLock())clearTerrainInputs();
   if(walkMode.active)walkHUD();
 });
 document.addEventListener('mousemove',e=>{
   if(hasWalkLock())turnFreeWalk(e.movementX,e.movementY);
 });
 window.addEventListener('blur',clearTerrainInputs);
 document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&walkMode.active){stopTerrainGuide();clearTerrainInputs();releaseWalkLock();}
 });
 window.addEventListener('keydown',e=>{
   if(!walkMode.active)return;
   if(e.code==='Escape'&&!hasWalkLock()&&(state.studioOpen||state.inspectorOpen))return;
   if(e.code==='Escape'){
      clearTerrainInputs();releaseWalkLock();e.stopImmediatePropagation();return;
   }
   if(walkMode.mode==='guide'||(!hasWalkLock()&&['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))||e.altKey||e.metaKey)return;
   if(e.code==='KeyF'){
      e.preventDefault();e.stopImmediatePropagation();
      if(e.repeat)return;
      clearTerrainInputs();
      setFreeWalkMode(walkMode.mode==='walk'?'fly':'walk');return;
   }
   if(e.code==='Space'&&e.target?.matches?.('[data-walk-speed-step]'))return;
   if(!Object.hasOwn(WALK_KEYS,e.code))return;
   if(walkMode.mode!=='fly'&&(WALK_KEYS[e.code]==='up'||WALK_KEYS[e.code]==='down'))return;
   e.preventDefault();e.stopImmediatePropagation();walkKeys.add(e.code);if(WALK_KEYS[e.code]==='fast'&&!e.repeat)updateWalkSpeed();startWalkTick();
 },{capture:true});
 window.addEventListener('keyup',e=>{if(walkKeys.delete(e.code)&&WALK_KEYS[e.code]==='fast')updateWalkSpeed();},{capture:true});
}

const guidedTour={playEpoch:0,readyStep:false,endSince:null,active:false,book:[],route:null,index:0,elapsed:0,playing:false,pose:null,frame:0,stamp:0,token:0,voice:null};
const guideStep=()=>guidedTour.route?.steps[guidedTour.index];
const guideWantsPlayback=t=>Boolean(t.playing||t.handoff?.resume||t.poseHandoff?.resume);
function pauseGuidePlayback(note,{stopMotion=false}={}){
 const t=guidedTour;
 if(stopMotion)cancelGuideHandoff();
 else for(const transition of [t.handoff,t.poseHandoff]){if(transition)transition.resume=false;}
 holdGuidedTour();readTourHUD(note);
}
const guideReduced=()=>prefersReducedMotion();
const isGuideOverview=s=>Boolean(s?.eyeM>=4000);
const PUBLIC_GUIDE_BASEMAP='sentinel2-2026-08-08';
const guidedScale=()=>8;
const contourGuideCache=new Map();
function applyGuideContourChoice(){
 const t=guidedTour;
 $('#guided-tour-contours').checked=t.contours;
 $('#guided-contour-caption').textContent=t.contourInterval+' 米等高线';
 if(t.contours)void loadContours(t.contourInterval===2?2:5);
 syncMapsState();updateContourControls();
}
function guideContourFeatures(){
 const i=guidedTour.contourInterval||10,base=contourBaseCache.get(i===2?2:5);
 if(!guidedTour.contours||!base)return EMPTY_CONTOURS;
 if(!contourGuideCache.has(i))contourGuideCache.set(i,contourSelection(base,i));
 return contourGuideCache.get(i);
}
function guidePhotoItems(step){
 const rows=(step?.photoGallery || (step?.photoId?[{id:step.photoId,caption:''}]:[])).filter(row=>Boolean(fieldPhotoThumb(row.id)));
 if(step?.id==='runoff-bridge'&&!rows.some(x=>x.id==='field-photo-2028')&&fieldPhotoThumb('field-photo-2028')){
  const i=rows.findIndex(v=>v.id==='field-photo-2029');
  rows.splice(i<0?rows.length:i,0,{id:'field-photo-2028',caption:'护栏边俯看雪地和低地近景；用于认桥侧，不是桥下开口照片。'});
 }
 return rows;
}
function syncGuidePhotoLocation(id){
 const photo=id&&provider.analysisById.get(id), g=photo?.geometry, p=photo?.properties, marker=$('#guided-nav-photo'), label=$('#guided-photo-position'), pin=$('#guided-photo-map-pin'), ground=$('#guide-photo-anchors');
 marker.setAttribute('hidden','');pin.hidden=true;label.hidden=true;
 trimGuideAnchors(ground,0);
 if(g?.type!=='Point'||!g.coordinates?.every(Number.isFinite))return;
 const [x,y]=navGuideMapCoords(g.coordinates), bearing=!p.heading_unverified&&Number.isFinite(p.heading_deg)?p.heading_deg:null;
 marker.setAttribute('transform','translate('+x+' '+y+') rotate('+(bearing??0)+')');
 marker.querySelector('path').setAttribute('visibility',bearing===null?'hidden':'visible');marker.removeAttribute('hidden');
 label.hidden=false;label.textContent='小地图相机标记＝原照 GPS，非涵洞口'+(bearing===null?'；拍向未核':'；拍向约 '+Math.round(bearing)+'°')+(p.accuracy_m>20?'；定位误差约 '+Math.round(p.accuracy_m)+' 米':'');
 if($('#guided-photo-preview').hidden)return;
 const box=guideSafeBox(), blocked=isMobileViewport()?[box.photo]:[box.photo,box.deck,box.n,box.panel];
 const {at,anchor}=fitGuideLabel(guideScreenPoint(g.coordinates),box,56,10,blocked,[]);
 if(at){positionGuideLabel(pin,pin.parentElement,at,anchor);pin.textContent='相机 IMG_'+id.slice(-4);pin.hidden=false;}
 if(anchor)drawGuideAnchor(ground,0,anchor,at,'#dcf0f9','camera-'+id);
}
function selectGuidePhoto(i,{refresh=false}={}){
 const t=guidedTour,book=t.photoBook||[], count=book.length;
 if(!count)return;
 const idx=Math.max(0,Math.min(count-1,i));
 if(!refresh&&idx===t.photoIndex)return;
 t.photoIndex=idx;
 const row=book[idx], id=row.id?.match(/^field-photo-(\d{4})$/)?.[1], fallback=row.src||fieldPhotoThumb(row.id);
 const image=$('#guided-photo-enlarged');
 const full=fallback;
 $('#guided-photo-label').textContent=row.title||'现场照片 · IMG_'+id;
 $('#guided-photo-caption').textContent=row.caption||'归档现场照片，供本位置参照。';
 image.alt=row.caption||'现场照片放大图';
 image.onerror=full===fallback?null:()=>{image.onerror=null;image.src=fallback;};
 image.src=full;
 const pane=$('#guided-photo-preview'), companion=$('#v75-compare-second');
 const pairedIndex=Number.isInteger(row.pairIndex)?row.pairIndex:book[0]?.src?.includes('wide-corridor-')&&idx<2?1-idx:-1;
 const paired=pairedIndex>=0&&Boolean(book[pairedIndex]);
 pane.classList.toggle('v75-paired-media',Boolean(paired));
 if(companion){companion.hidden=!paired;if(paired){companion.src=book[pairedIndex].src;companion.alt=book[pairedIndex].title;}}
 for(const [i,key] of ['#v75-compare-left','#v75-compare-right'].entries()){const n=$(key);if(n){n.hidden=!paired;n.textContent=paired?book[i?pairedIndex:idx].title.split(' · ')[0]+'（文件标记）':'';}}
 $('#guided-photo-counter').textContent=(idx+1)+' / '+count;
 $('#guided-photo-prev').disabled=idx===0;$('#guided-photo-next').disabled=idx===count-1;
 syncGuidePhotoLocation(row.id);
 $$('#guided-photo-thumbs button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.guidePhotoIndex)===idx)));
}
function setGuidePhoto(open,{focus=false,source=null,items=null,start=0}={}){
 const pane=$('#guided-photo-preview'),toggle=$('#guided-tour-photo-link'),image=$('#guided-photo-enlarged');
 if(open){
   const t=guidedTour,book=items||guidePhotoItems(source||t.observer?.fieldMark||guideStep());
   t.photoReturn=document.activeElement;
   if(!book.length)return;
   t.photoBook=book;
   pane.classList.toggle('v75-paired-media',Boolean(book[start]?.src?.includes('wide-corridor-')));
   const holder=$('#guided-photo-thumbs');
   holder.replaceChildren(...book.map((row,i)=>{
     const button=document.createElement('button'), thumb=document.createElement('img');
     button.type='button';button.dataset.guidePhotoIndex=i;
     button.setAttribute('aria-label','第 '+(i+1)+' 张：'+(row.caption||'现场照片'));
     thumb.alt='';thumb.src=row.src||fieldPhotoThumb(row.id);button.append(thumb);
     return button;
   }));
   holder.hidden=book.length<2;$('#guided-photo-controls').hidden=book.length<2;
   pane.hidden=false;selectGuidePhoto(start,{refresh:true});toggle.setAttribute('aria-expanded','true');
   if(focus)$('#guided-photo-close')?.focus({preventScroll:true});
 }else{
   if(pane.hidden)return;
   pane.hidden=true;pane.classList.remove('v75-paired-media');syncGuidePhotoLocation(null);image.onerror=null;image.removeAttribute('src');toggle.setAttribute('aria-expanded','false');
   $('#guided-photo-thumbs').replaceChildren();
   guidedTour.photoBook=null;
   const active=guideStep();if(active&&!guidedTour.observer){const mark=active.detail?.fieldMarks?.[Number($('#guided-location-card').dataset.point)-1];syncGuidePhotoLocation(guidePhotoItems(mark||active)[0]?.id);}
   const back=guidedTour.photoReturn;guidedTour.photoReturn=null;
   if(focus){if(back?.isConnected&&!back.closest('[hidden]'))back.focus({preventScroll:true});else if(!toggle.hidden)toggle.focus({preventScroll:true});}
 }
 if(isMobileViewport()&&guidedTour.active)requestAnimationFrame(()=>{
   const s=guideStep();if(!s||!guidedTour.active)return;
   if(guidedTour.observer){applyPortraitPhotoLift();if(!pane.hidden)syncGuidePhotoLocation(guidedTour.photoBook?.[guidedTour.photoIndex]?.id);}
   else showTourPose(s,s.duration?guidedTour.elapsed/s.duration:0);
 });
}
const guideRoadRoute=route=>['road','road-context'].includes(route?.id);
const guideHandoffs={
 opening:'从主湖西北方向的大沟壑出发，分段追到 G332 中桥。',
 runoff:'先对照桥东低带与旧转折的历年影像。',
 history:'转到 03 道路现场四点；不沿未核实的水路飞行。',
 road:'从 03 路南退到总览，对照桥东下游的各个方向。',
 'corridor-to-lake':'从两条琥珀虚线继续往东，分别核查东部泥沼和东池。',
 'east-water':'从分流总览把镜头移向南侧地方道路，先看东南 B，再向北看南中 C 和圆涵。',
 'road-context':'用主湖全景复盘几条不同的地形候选。',
 'lake-inflow':'回到开场全景，归纳本次线索与缺口。'
};
const guideCutStops=new Set(['runoff-shore-separate','runoff-main-entrance-context','lake-south-central','lake-southeast','lake-office-caution']);
function guideFollowing(direction){
 const t=guidedTour,i=t.index+direction;
 if(t.route?.steps[i])return {route:t.route,index:i,step:t.route.steps[i]};
 const route=t.book[t.book.indexOf(t.route)+direction];
 if(!route)return null;
 const index=direction===1?0:route.steps.length-1;
 return {route,index,step:route.steps[index]};
}
function isGuideIndependent(next){
 const t=guidedTour,s=guideStep(),to=next.step;
 if(s.id==='road-nw-approach'&&to.id==='road-nw-gully')return true;
 const southPair=t.route.id==='road-context'&&((s.id==='road-c-approach'&&to.id==='road-c-south-central')||(s.id==='road-round-approach'&&to.id==='road-round'));
 if(!southPair&&(next.route!==t.route || s.kind==='gap'||to.kind==='gap'||to.cutFromPrevious||s.stationRole==='terrain-low'||guideCutStops.has(to.id)))return true;
 if(s.kind==='travel'&&to.kind==='station')return guideDistance(s.coordinates.at(-1),to.target)>1.5;
 if(s.kind==='station'&&to.kind==='travel')return guideDistance(s.target,to.coordinates[0])>1.5;
 return s.kind==='station'&&to.kind==='station'&&guideDistance(s.target,to.target)>1.5;
}
function cancelGuideHandoff(){
 const t=guidedTour,h=t.handoff;
 t.poseHandoff=null;
 if(!h)return false;
 clearTimeout(h.commit);clearTimeout(h.finish);t.handoff=null;
 $('#guided-transition-shade').classList.remove('active');
 $('#guided-transition-label').textContent='';
 return true;
}
function guideProgressNote(s){
 if(s.kind==='gap')return '缺口站：保留空段。镜头转到下个观察位，不表示水路相连。';
 if(!guideFollowing(1))return '全章结束，可以回到地图或回看上一站。';
 if(!guidedTour.route.steps[guidedTour.index+1])return guideHandoffs[guidedTour.route.id]||'下节从另一个独立位置开始。';
 return '';
}
// Time scales with the visible change, without changing either authored endpoint.
function desktopHandoffDuration(from,to){
 const turn=Math.abs(((to.heading-from.heading+540)%360)-180);
 const tilt=Math.abs(to.pitch-from.pitch);
 const travel=guideDistance([from.lon,from.lat],[to.lon,to.lat]);
 const scale=Math.abs(Math.log(Math.max(1,to.eyeM)/Math.max(1,from.eyeM)));
 const lens=Math.abs(to.directorFov-from.directorFov);
 const shift=Math.max(...[0,1].map(i=>Math.abs((to.portraitOffset?.[i]??0)-(from.portraitOffset?.[i]??0))));
 if(turn<.01&&tilt<.01&&travel<.05&&Math.abs(to.eyeM-from.eyeM)<.05&&lens<.01&&shift<.0001)return 0;
 return Math.min(5200,Math.max(850,700+turn*28,700+tilt*42,700+travel*.35,700+scale*1100,700+lens*110,700+shift*3800));
}
function moveGuidedChapter(direction,{resume=null,destination=null}={}){
 const t=guidedTour;
 if(!t.active)return;
 const shouldPlay=resume??guideWantsPlayback(t);
 cancelGuideHandoff();
 closeGuideObserver({restorePosition:false,focus:false});
 const target=destination??guideFollowing(direction);
 if(!target){if(direction>0)closeGuidedTour();return;}
 const independent=!t.manualCamera&&isGuideIndependent(target), reduced=guideReduced();
 t.poseHandoff=null;
 const previous=guideStep();
 const oldPose=t.cameraPose, nextPose=recordedGuidePose(target.step.id,0);
 const bridgeTurn=previous.id==='runoff-bridge'&&target.step.id==='runoff-cross-gap'&&oldPose&&nextPose&&guideDistance([oldPose.lon,oldPose.lat],[nextPose.lon,nextPose.lat])<2;
 const panorama=previous.id==='runoff-main-entrance-context'&&target.step.id==='road-b-southeast';
 const trackJoins=GUIDE_ROAD_ENDPOINTS[target.step.id]?.[0]===previous.id||
   GUIDE_ROAD_ENDPOINTS[previous.id]?.[1]===target.step.id;
 const phoneEdited=isMobileViewport()&&(portraitGuidePair(previous.id,0)||portraitGuidePair(target.step.id,0));
 const desktopGlide=!isMobileViewport();
 const phoneItinerary=isMobileViewport()&&followsPortraitItinerary(t.book,previous.id,target.step.id);
 const edited=Boolean(phoneEdited||desktopGlide||phoneItinerary);
 const seamlessRoad=isMobileViewport()&&direction===1&&GUIDE_ROAD_ENDPOINTS[target.step.id]?.[0]===previous.id;
 const phoneTarget=phoneEdited&&!seamlessRoad&&!t.manualCamera&&oldPose?phoneRecordedPose(target.step.id,0):null;
 let phoneCut=false, phoneHold=false, phoneDuration=1550;
 if(phoneTarget){
   const turn=Math.abs(((phoneTarget.heading-oldPose.heading+540)%360)-180);
   const tilt=Math.abs(phoneTarget.pitch-oldPose.pitch);
   const travel=guideDistance([oldPose.lon,oldPose.lat],[phoneTarget.lon,phoneTarget.lat]);
   const height=Math.abs(phoneTarget.eyeM-oldPose.eyeM);
   const scale=Math.max(phoneTarget.eyeM,oldPose.eyeM)/Math.max(1,Math.min(phoneTarget.eyeM,oldPose.eyeM));
   const lens=Math.abs(phoneTarget.directorFov-map3d.camera.fov);
   // Compare the displayed whole-pixel framing; identical shots must not animate.
   const frameSize=[map3d.width,map3d.height];
   const shift=Math.max(...phoneTarget.portraitOffset.map((v,i)=>{
     const size=frameSize[i];
     return Math.abs(Math.round(v*size)-Math.round((oldPose.portraitOffset?.[i]??0)*size))/size;
   }));
   // Distant observations are clearer as cuts than as a fast flyover on a phone.
   phoneCut=!phoneItinerary&&(turn>=50||tilt>=30||travel>=1800||(height>=180&&scale>=3.5)||lens>=15||shift>=.27);
   if(phoneItinerary)phoneDuration=Math.min(4500,Math.max(1550,1250+turn*18,1300+tilt*33,1150+travel*.27,1200+Math.log(Math.max(1,scale))*510,lens*110));
   phoneHold=travel<.01&&turn<.01&&tilt<.01&&height<.01&&lens<.01&&shift<.001;
 }
 const overviewBlend=(edited?(desktopGlide||!trackJoins||(phoneItinerary&&!seamlessRoad)):direction===1&&(panorama||bridgeTurn))&&!reduced&&!t.manualCamera&&oldPose&&!phoneCut&&!phoneHold;
 if(phoneItinerary&&!phoneTarget&&!seamlessRoad)phoneDuration=3400;
 const oldView=map3d.camera.view,from=edited&&overviewBlend?{...oldPose,directorFov:map3d.camera.fov,
   portraitOffset:oldView?.enabled?[oldView.offsetX/map3d.width,(oldView.offsetY-(t.portraitPhotoLift||0))/map3d.height]:[0,0]}:overviewBlend;
 holdGuidedTour();
 if(overviewBlend)t.poseHandoff={from,to:target.step.id,elapsed:0,resume:shouldPlay,captured:edited,portraitItinerary:phoneItinerary,desktopGlide,duration:edited?phoneDuration:850};
 const commit=()=>{
  if(target.route===t.route)prepareTourStep(target.index);
  else setGuidedRoute(target.route,target.index);
 };
 if((!independent&&!overviewBlend&&!phoneCut)||phoneHold||seamlessRoad){
   commit();
   if(shouldPlay)void playGuidedTour();
   return;
 }
 if(overviewBlend){
   commit();
   const transition=t.poseHandoff;
   if(transition.captured){
     // Resolve the next composition once, including its actual lens/fit. Keeping
     // those values through the entire handoff avoids a final-frame reframe.
     t.poseHandoff=null;
     if(showTourPose(target.step,0)){
       const cam=map3d.camera,v=cam.view;
       transition.destination={...t.cameraPose,directorFov:cam.fov,portraitOffset:v?.enabled?
         [v.offsetX/map3d.width,(v.offsetY-(t.portraitPhotoLift||0))/map3d.height]:[0,0]};
     }
     if(transition.desktopGlide&&transition.destination){
       transition.duration=desktopHandoffDuration(transition.from,transition.destination);
       if(!transition.duration){
         if(transition.resume)void playGuidedTour();
         return;
       }
     }
     t.poseHandoff=transition;
     showTourPose(target.step,0);
   }
   transition.last=null;
   const animate=()=>{
     if(!t.active||t.poseHandoff!==transition||guideStep()?.id!==transition.to||t.manualCamera)return;
     showTourPose(target.step,0);
     if(t.poseHandoff===transition)requestAnimationFrame(animate);
     else if(transition.resume)void playGuidedTour();
   };
   requestAnimationFrame(animate);
   return;
 }
 const banner=$('#guided-transition-label'), shade=$('#guided-transition-shade');
 const label=phoneCut&&!independent?'切换观察位：'+target.step.title:previous.id==='road-nw-approach'&&target.step.id==='road-nw-gully'?'切到 03 道路四点全景':'另行定位：'+target.step.title+' · 不连画未证路线';
 banner.textContent=label;
 const h={resume:shouldPlay,commit:0,finish:0};
 t.handoff=h;
 if(!reduced)shade.classList.add('active');
 const finish=()=>{
   if(t.handoff!==h||!t.active)return;
   t.handoff=null;
   banner.textContent='';
   if(h.resume)void playGuidedTour();
 };
 h.commit=setTimeout(()=>{
   if(t.handoff!==h||!t.active)return;
   commit();
   requestAnimationFrame(()=>requestAnimationFrame(()=>{if(t.handoff===h)shade.classList.remove('active');}));
   h.finish=setTimeout(finish,reduced?320:380);
 },reduced?0:170);
}
const guideLineOf=step=>step?.coordinates||(step?.geometry?.type==='LineString'?step.geometry.coordinates:null);
function gapEvidenceEnds(){
 const t=guidedTour;
 const left=t.route.steps.slice(0,t.index).map(guideLineOf).filter(Boolean).at(-1);
 const right=guideStep()?.id==='runoff-apron-gap'
  ? [provider.analysisById.get('hjn-03-road-pin-02')?.geometry?.coordinates].filter(Boolean)
  : t.route.steps.slice(t.index+1).map(guideLineOf).find(Boolean);
 return left&&right?.length?{left:left.slice(-7),right:right.slice(0,7)}:null;
}
function renderGuideGapInset(elm){
 const pair=gapEvidenceEnds();
 if(!pair){elm.setAttribute('hidden','');elm.replaceChildren();return;}
 const bridge=guideStep()?.id==='runoff-cross-gap'?provider.analysisById.get('f1-east-bridge-location-ref')?.geometry?.coordinates:null;
 const p=pair.left.concat(pair.right,Array.isArray(bridge)?[bridge]:[]);
 const W=Math.min(...p.map(x=>x[0])), E=Math.max(...p.map(x=>x[0])),S=Math.min(...p.map(x=>x[1])),N=Math.max(...p.map(x=>x[1]));
 const pos=([x,y])=>[17+(x-W)/Math.max(1e-6,E-W)*105,13+(N-y)/Math.max(1e-6,N-S)*55];
 const add=(tag,attrs,word='')=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);node.textContent=word;elm.append(node);};
 elm.replaceChildren();
 for(const [i,part] of [pair.left,pair.right].entries()){
  if(part.length>1)add('polyline',{points:part.map(c=>pos(c).join(',')).join(' '),fill:'none',stroke:'#8ce6ed','stroke-width':2.3});
  const [cx,cy]=pos(i?part[0]:part.at(-1));
  add('circle',{cx,cy,r:4,fill:i?'#fdf7bb':'#bdeef4',stroke:'#152331'});
 }
 if(Array.isArray(bridge)){const [x,y]=pos(bridge);add('rect',{x:x-3,y:y-3,width:6,height:6,fill:'#ffe7a8',stroke:'#304056'});add('text',{'data-inset-at':[x,y].join(','),x,y:y-7,'text-anchor':'middle',fill:'#ffe7a8','font-size':9},'桥位');}
 add('text',{x:70,y:88,fill:'#f6f9ff','text-anchor':'middle','font-size':10},Array.isArray(bridge)?'桥两侧外部低带':guideStep()?.id==='runoff-apron-gap'?'弯槽末端／03 第 2 点':'已见末端 / 独立段起点');
 elm.setAttribute('aria-label','缺口两端独立标明，没有连接线');
 elm.removeAttribute('hidden');
}
function renderCorridorOverview(el,step){
 const get=id=>provider.analysisById.get(id)?.geometry;
 const lake=guideAnchorPoint('guide-main-lake');
 const bridge=get('f1-east-bridge-location-ref')?.coordinates;
 const marks=Array.from({length:4},(_,i)=>get('hjn-03-road-pin-0'+(i+1))?.coordinates).filter(Array.isArray);
 const list=['hjn-seasonal-f1-west','hjn-seasonal-f1-east','hjn-seasonal-f1-se','road03-ge-pin2-south-gully',
   'road03-ge-pin4-lower-arc','road03-ge-common-reach','main-profile-south-central-inlet','main-profile-southeast-inlet']
   .map(id=>({id,g:get(id)})).filter(r=>r.g?.type==='LineString');
 if(!bridge||marks.length!==4||!lake)return false;
 const eastAreas=[['f1-east-marsh-field-review','review-area'],['f1-east-pool-shore-ref','water-ref']].map(([id,mode])=>({id,mode,ring:get(id)?.coordinates?.[0]})).filter(r=>Array.isArray(r.ring?.[0]));
 const eastPins=['east-guide-marsh-pin','east-guide-pool-pin'].map(guideAnchorPoint);
 for(const id of ['wcross2-west-extension-approach','hjn-seasonal-round-model']){const g=get(id);if(g?.type==='LineString')list.push({id,g});}
 const road=guidedTour.contextPaths||[], ring=guideAnchorPoint('guide-south-roundabout'),culvert=guideAnchorPoint('guide-round');
 for(const {id,coords} of guidePriorRefs(step).filter(r=>guideEastModelIds.has(r.id)))list.push({id,g:{coordinates:coords}});
 const wf=step.id==='runoff-main-entrance-context'?guideAnchorPoint('guide-wf1'):null;
 if(wf)for(const id of ['hjn-seasonal-wf1-aw','hjn-seasonal-wf1-cop']){const g=get(id);if(g?.type==='LineString')list.push({id,g});}
 const q=[...(wf?[wf]:[]),...eastAreas.flatMap(a=>a.ring),...list.flatMap(a=>a.g.coordinates),...road.flatMap(x=>x.coords),bridge,...marks,lake,...(Array.isArray(culvert)&&Number.isFinite(culvert[0])?[culvert]:[])];
 const minX=Math.min(...q.map(p=>p[0])),maxX=Math.max(...q.map(p=>p[0])),minY=Math.min(...q.map(p=>p[1])),maxY=Math.max(...q.map(p=>p[1]));
 const scale=Math.min(103/(maxX-minX)/GUIDE_METERS_PER_DEG_LON,55/(maxY-minY)/GUIDE_METERS_PER_DEG_LAT);
 const to=([x,y])=>[70+(x-(minX+maxX)/2)*GUIDE_METERS_PER_DEG_LON*scale,43-(y-(minY+maxY)/2)*GUIDE_METERS_PER_DEG_LAT*scale];
 const ns='http://www.w3.org/2000/svg',add=(tag,attrs,t='')=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);n.textContent=t;el.append(n);return n;};
 el.replaceChildren();
 for(const path of road)add('polyline',{points:path.coords.map(p=>to(p).join(',')).join(' '),fill:'none',stroke:'#ed777c','stroke-width':1.4,'data-road-id':path.id});
 for(const {id,g} of list){
   if(!guideRevealSite(step,id))continue;
   const model=id.startsWith('main-profile-')||id.startsWith('hjn-seasonal-wf1-')||guideEastModelIds.has(id)||['wcross2-west-extension-approach','hjn-seasonal-round-model'].includes(id);
   add('polyline',{points:g.coordinates.map(p=>to(p).join(',')).join(' '),fill:'none',stroke:guideEastModelIds.has(id)?eastModelStroke:model?'#c7a7ce':'#a4edf4','stroke-dasharray':guideEastModelIds.has(id)?eastDash({id,mode:id===EAST_AW?'model-alt':'model'}).svg:model?'3 2':'none','stroke-width':1.5,'data-anchor-id':id,'aria-label':model?'独立地形候选':'独立影像可辨段'});
 }
 for(const r of eastAreas){
  if(!guideRevealSite(step,r.id))continue;
  const style=EAST_STYLE[r.mode];
  add('polyline',{points:r.ring.map(p=>to(p).join(',')).join(' '),fill:'none',stroke:style[0],'stroke-width':1.7,'stroke-dasharray':style[1]?'3 2':'none','data-anchor-id':r.id});
 }
 for(const [i,a] of marks.entries()){if(!guideRevealSite(step,'hjn-03-road-pin-0'+(i+1)))continue;const [cx,cy]=to(a);add('circle',{cx,cy,r:1.7,fill:'#f1f6ff',stroke:'#0e1622','stroke-width':.65,'data-anchor-id':'hjn-03-road-pin-0'+(i+1)});}
 const callouts=[
   ...(wf?[[wf,'西长湖',6,11,'start','guide-wf1']]:[]),
   [bridge,'G332 中桥',6,wf?27:17,'start','f1-east-bridge-location-ref'],
   [guideAnchorPoint('guide-03'),'03 四点',6,42,'start','guide-03'],
   [lake,'主湖',134,56,'end','guide-main-lake'],
   ...(eastPins[0]?[[eastPins[0],'东部泥沼',134,17,'end','east-guide-marsh-pin']]:[]),
   ...(eastPins[1]?[[eastPins[1],'东池',134,36,'end','east-guide-pool-pin']]:[]),
   ...(ring?[[ring,'南部环岛',134,73,'end','guide-south-roundabout']]:[]),
   ...(Array.isArray(culvert)&&Number.isFinite(culvert[0])?[[culvert,'圆涵',6,64,'start','hjn-seasonal-round-gap']]:[])
 ];
 for(const [p,t,x,y,anchor,id] of callouts){
  if(!guideRevealSite(step,id))continue;
  const [cx,cy]=to(p),toward=anchor==='start'?x+33:x-31;
  add('line',{x1:cx,y1:cy,x2:toward,y2:y-2,'data-inset-old-leader':'',stroke:'#8ba5b8','stroke-width':.55,'stroke-opacity':.82});
  add('circle',{cx,cy,'data-inset-old-dot':'',r:3,fill:guideLabelTone(id)||'#ffedc7',stroke:'#182531','data-anchor-id':id});
  add('text',{x,y,'data-anchor-id':id,'data-inset-at':[cx,cy].join(','),fill:guideLabelTone(id)||'#eff8ff','data-place-tone':guideLabelTone(id)||'','text-anchor':anchor,'font-size':8.2},t);
 }
 add('text',{x:70,y:88,fill:'#c7deee','font-size':8,'text-anchor':'middle'},'调查位置 · 各段留空');
 el.setAttribute('aria-label','按原位置并列中桥、圆涵、03 四点、主湖、东部泥沼和东池；可见线段独立，不画跨缺口线');
 el.removeAttribute('hidden');return true;
}
function renderDirectorLines(el,ids,attrs,labels,aria){
 const get=id=>provider.analysisById.get(id)?.geometry;
 const rows=ids.map(get);
 if(rows.some(g=>g?.type!=='LineString'))return false;
 const lines=rows.map(g=>g.coordinates), pts=lines.flat();
 const xx=pts.map(p=>p[0]),yy=pts.map(p=>p[1]), W=Math.min(...xx),E=Math.max(...xx),S=Math.min(...yy),N=Math.max(...yy);
 const k=Math.min(104/Math.max(1,(E-W)*GUIDE_METERS_PER_DEG_LON),60/Math.max(1,(N-S)*GUIDE_METERS_PER_DEG_LAT));
 const q=([lon,lat])=>[70+(lon-(W+E)/2)*GUIDE_METERS_PER_DEG_LON*k,43-(lat-(N+S)/2)*GUIDE_METERS_PER_DEG_LAT*k];
 const add=(type,attr,txt)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',type);for(const [k,v] of Object.entries(attr))n.setAttribute(k,v);if(txt)n.textContent=txt;el.append(n);};
 el.replaceChildren();
 for(let i=0;i<lines.length;i++){
  const line=lines[i];const attr={points:line.map(q).map(p=>p.join(',')).join(' '),fill:'none','stroke-width':2,stroke:attrs[i][0]};
  if(attrs[i][1])attr['stroke-dasharray']='4 3';
  add('polyline',attr);
  const p=q(i===2?line.at(-1):line[0]);
  add('text',{'data-inset-at':p.join(','),x:p[0],y:p[1]-(i===2?-12:6),fill:'#fff','font-size':9,'text-anchor':'middle'},labels[i]);
 }
 if(ids[0]==='road03-ge-pin2-south-gully'){
  for(let i=1;i<=4;i++){
    const id='hjn-03-road-pin-0'+i,a=get(id)?.coordinates;if(!Array.isArray(a))continue;
    const [x,y]=q(a), labelX=32+(i-1)*17,labelY=12;
    add('line',{x1:x,y1:y,x2:labelX,y2:labelY+4,'data-inset-old-leader':'',stroke:'#c0cbd6','stroke-width':.65,'stroke-dasharray':'1 1'});
    add('circle',{cx:x,cy:y,'data-inset-old-dot':'',r:1.8,fill:'#f9f1d2','data-anchor-id':id});
    add('text',{x:labelX,y:labelY,fill:'#fcf4d9','font-size':9,'text-anchor':'middle','data-label-id':id,'data-inset-at':[x,y].join(',')},String(i));
  }
 }
 el.setAttribute('aria-label',aria);el.removeAttribute('hidden');return true;
}
function renderGuideInset(step){
 const elm=$('#guided-map-inset');
 if(step.id==='runoff-upper-slope'&&renderDirectorLines(elm,step.director.frameLines,[['#a4edf4'],['#a4edf4'],['#a4edf4']],['丘脚暗带','外坡弯槽','槽形会合段'],'西北坡大沟壑三处可辨形态，间隔不连画'))return;
 if(step.id?.startsWith('east-')){renderEastGuidePlan(elm,step);return;}
 if(step.id==='runoff-shore-separate'&&renderDirectorLines(elm,['road03-ge-pin2-south-gully','road03-ge-pin4-lower-arc','road03-ge-common-reach'],[['#67e7f0'],['#a5e1a4'],['#9eeafe']],['2 号近沟','4 号下段','近湖端'],'从原几何绘制的 03 路南三段，不补连线'))return;
 if(step.id==='lake-office-caution'&&renderDirectorLines(elm,['main-profile-west-inlet','main-profile-south-central-inlet','main-profile-southeast-inlet'],[['#ead0ff',true],['#e9b7f5',true],['#d7a8ed',true]],['西侧','南中','东南子区'],'三个独立地形候选路径，不是实测入湖口'))return;
 if(['chapter-opening','runoff-main-entrance-context','chapter-closing'].includes(step.id)&&renderCorridorOverview(elm,step))return;
 if(step.kind==='gap'){renderGuideGapInset(elm);return;}
 const model=step.detail?.evidence?.find(x=>x.mode==='model');
 const survey=Boolean(model)&&(guideRoadRoute(guidedTour.route)||guidedTour.route.id==='lake-inflow');
 const line=survey?provider.analysisById.get(model.id)?.geometry?.coordinates:step.coordinates;
 if((guidedTour.route.id!=='lake-inflow'&&!survey)||!Array.isArray(line)){
  elm.setAttribute('hidden','');elm.replaceChildren();return;
 }
 const mask=provider.analysisById.get('historical_sample_union_terminal');
 const bounds=survey?(mask?[mask]:[]):state.waterMonth?.lakes?.MAIN?.boundary?.features || [];
 const source=bounds.flatMap(f=>f.geometry?.type==='Polygon'?f.geometry.coordinates:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates.flat():[]);
 const points=[...source.flat(),...line];
 const X=points.map(p=>p[0]),Y=points.map(p=>p[1]);
 const x0=Math.min(...X),y0=Math.min(...Y),dX=Math.max(...X)-x0,dY=Math.max(...Y)-y0;
 const scale=Math.min(108/(dX*GUIDE_METERS_PER_DEG_LON),63/(dY*GUIDE_METERS_PER_DEG_LAT));
 const pos=([x,y])=>[70+(x-x0-dX/2)*GUIDE_METERS_PER_DEG_LON*scale,43-(y-y0-dY/2)*GUIDE_METERS_PER_DEG_LAT*scale];
 const add=(tag,attrs,text='')=>{
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);
  node.textContent=text;elm.append(node);
 };
 const toPoints=c=>c.map(p=>pos(p).map(n=>n.toFixed(2)).join(',')).join(' ');
 elm.replaceChildren();
 for(const ring of source)add('polygon',{points:toPoints(ring),fill:'#315473',stroke:'#b5d7fa','stroke-width':1});
 add('polyline',{points:toPoints(line),stroke:'#f1c4ff','stroke-width':3,'stroke-dasharray':'5 3',fill:'none'});
 const [x,y]=pos(line.at(-1));
 add('circle',{cx:x,cy:y,r:3,fill:'#f1c4ff',stroke:'#141622'});
 const end=step.target||(step.kind==='travel'?step.coordinates?.at(-1):null); if(survey&&Array.isArray(end)){const a=pos(end);add('circle',{cx:a[0],cy:a[1],r:3.2,fill:'#ffe18a',stroke:'#141622'});}
 const label=survey?(step.detail.modelLabel||(model.id.includes('south-central')?'南中 C · 历史主湖主体':'东南 B · 历史子区')):'主湖统计窗 · 模型剖面';
 elm.setAttribute('aria-label',label);
 add('text',{x:70,y:89,'text-anchor':'middle',fill:'#f3f5f8','font-size':survey?10:12},label);
 elm.removeAttribute('hidden');
}
const GUIDE_G332_LAYER='g332-opening-road';
// Display-only line/rectangle intersection: keep real crossings down to the
// terrain edge and never join two surviving pieces through an invisible gap.
function clipGuideRoad(coords,bounds=provider.dem?.bounds_wgs84){
 if(!bounds)return [];
 const [w,s,e,n]=bounds;
 const pieces=[];
 let run=[];
 const close=(a,b)=>Math.abs(a[0]-b[0])<1e-10&&Math.abs(a[1]-b[1])<1e-10;
 const flush=()=>{if(run.length>1)pieces.push(run);run=[];};
 for(let i=1;i<coords.length;i++){
  const a=coords[i-1],b=coords[i],dx=b[0]-a[0],dy=b[1]-a[1];
  let lo=0,hi=1;
  for(const [p,q] of [[-dx,a[0]-w],[dx,e-a[0]],[-dy,a[1]-s],[dy,n-a[1]]]){
   if(Math.abs(p)<1e-14){if(q<0){lo=1;hi=0;break;}continue;}
   if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);
  }
  if(hi<=lo){flush();continue;}
  const point=t=>[a[0]+t*dx,a[1]+t*dy];
  const first=point(lo),last=point(hi);
  if(!run.length||!close(run.at(-1),first)){flush();run=[first];}
  if(!close(run.at(-1),last))run.push(last);
  if(hi<1)flush();
 }
 flush();return pieces;
}
function guideContextPaths(raw){
 return (Array.isArray(raw)?raw:[]).filter(x=>typeof x?.id==='string'&&x.mode==='road'&&Array.isArray(x.coords)&&x.coords.length>=2&&x.coords.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>119.5&&p[0]<119.9&&p[1]>49&&p[1]<49.3))
  .flatMap(r=>privatePathParts(r.id,r.coords).flatMap(path=>clipGuideRoad(path)).map((coords,i)=>({...r,id:i?r.id+'-part-'+i:r.id,coords})));
}
const interiorAnchorCache=new WeakMap();
function polygonGuideAnchor(geom){
 if(!geom)return null;
 if(interiorAnchorCache.has(geom))return interiorAnchorCache.get(geom);
 const polygons=geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];
 const area=ring=>ring.reduce((sum,[x,y],i)=>{const [x2,y2]=ring[(i+1)%ring.length], [ox,oy]=ring[0];return sum+(x-ox)*(y2-oy)-(x2-ox)*(y-oy);},0);
 const ring=[...polygons].sort((a,b)=>Math.abs(area(b[0]))-Math.abs(area(a[0])))[0];
 if(!ring)return null;
 const g={type:'Polygon',coordinates:ring}, [w,s,e,n]=geometryBounds(g);
 const edges=ring.flatMap(line=>line.slice(1).map((q,i)=>[line[i],q]));
 let point=null,max=-1;
 for(let i=0;i<16;i++)for(let j=0;j<16;j++){
   const x=w+(i+.5)*(e-w)/16,y=s+(j+.5)*(n-s)/16;
   if(!insideSlopeWater(x,y,g))continue;
   let dist=Infinity;
   for(const [a,b] of edges){
     const dx=(b[0]-a[0])*GUIDE_METERS_PER_DEG_LON,dy=(b[1]-a[1])*GUIDE_METERS_PER_DEG_LAT;
     const px=(x-a[0])*GUIDE_METERS_PER_DEG_LON,py=(y-a[1])*GUIDE_METERS_PER_DEG_LAT;
     const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)));
     dist=Math.min(dist,(px-t*dx)**2+(py-t*dy)**2);
   }
   if(dist>max){max=dist;point=[x,y];}
 }
 interiorAnchorCache.set(geom,point);return point;
}
const GUIDE_POINT_AREA=Object.freeze({
 'guide-main-lake':'historical_sample_union_terminal',
 'east-guide-pool-pin':'f1-east-pool-shore-ref',
 'east-guide-marsh-pin':'f1-east-marsh-field-review',
});
const GUIDE_STATION_ANCHOR=Object.freeze({
 'nw96-label-7':'road-b-southeast','nw96-label-5':'road-c-south-central','guide-round':'road-round',
});
const guideLabelTone=id=>['guide-main-lake','guide-wf1',NW_EAST_POOL].includes(id)?EAST_STYLE['water-ref'][0]:id===NW_EAST_MARSH?EAST_STYLE['review-area'][0]:null;
function guideAnchorPoint(id){
 const area=GUIDE_POINT_AREA[id];
 if(area){
   const p=polygonGuideAnchor(provider.analysisById.get(area)?.geometry);
   if(p)return p;
 }
 if(id==='guide-main-lake')return guidedTour.book[0]?.steps[0]?.target;
 const station=GUIDE_STATION_ANCHOR[id];
 if(station)return guidedTour.book.find(route=>route.id==='road-context')?.steps.find(s=>s.id===station)?.target;
 if(id==='guide-03'){
   const p=provider.analysisById.get('hjn-03-road-pin-02')?.geometry?.coordinates;
   const q=provider.analysisById.get('hjn-03-road-pin-03')?.geometry?.coordinates;
   return p&&q?[(p[0]+q[0])/2,(p[1]+q[1])/2]:p;
 }
 if(id==='guide-wf1'){const b=provider.waterIndex.lakes.WF1.bounds_wgs84;return [(b[0]+b[2])/2,(b[1]+b[3])/2];}
 if(id==='guide-south-roundabout'){
   const cr=guidedTour.contextPaths?.find(r=>r.id.includes('694618945'))?.coords;
   if(cr?.length){const n=cr.length-1;return cr.slice(0,n).reduce((a,p)=>[a[0]+p[0]/n,a[1]+p[1]/n],[0,0]);}
 }
 return provider.analysisById.get(id)?.geometry?.coordinates;
}
function guideOpeningCue(step){
 const cs=step?.director?.cues;
 if(!cs?.length)return null;
 const sec=guideSpokenSeconds();
 const i=cs.findLastIndex(c=>sec*1000>=Number(c.startMs??((c.at??0)*1000)));
 return cs[Math.max(i,0)];
}
const guideV74Lines=new Map();
const v74Profiles={
 'v88-nw-ravine-profile':['西北大沟壑｜三段影像线的地表纵剖面',['f1-ge-west-middle-hummock-toe','f1-ge-west-branched-meander-outer','f1-ge-sw-to-central-junction']],
 'v74-bridge-physical-profile':['中桥｜西坡脚／桥位东西两侧', ['hjn-seasonal-f1-west','hjn-seasonal-f1-east']],
 'v74-road03-p2-profile':['03 第 2 点路南｜沟形与共同弯槽',['road03-ge-pin2-south-gully','road03-ge-common-reach']],
 'v74-road03-p4-profile':['03 第 4 点路南｜窄槽、下部弧槽与共同段',['hjn-v74-03-pin4-upper-neck','road03-ge-pin4-lower-arc','road03-ge-common-reach']],
 'v74-road-round-profile':['地方道路圆涵｜西侧候选及东侧低线',['wcross2-west-extension-approach','hjn-seasonal-round-model']]
};
const guideKMZProfiles={1:'hjn-v75-kmz-upstream-01',3:'hjn-v75-kmz-upstream-03'};
function eastLegendLabel(r){
 if(r.mode==='model'||r.mode==='model-alt'||r.mode==='raw-model'){
   const model=r.id.includes('AW3D30')?'AW3D30':'Copernicus';
   return model+'｜东北纹理消散窗 · '+(r.mode==='raw-model'?'原地表停点':'填洼情景');
 }
 return {
 'f1-ge-imagefirst-marsh-west-gap':'东北纹理消散窗（影像缺口）',
 'f1-east-marsh-field-review':'东部泥沼核查区（不是积水边界）',
 'east-guide-marsh-cross-section':'东西地表横剖（不是水道）',
 'f1-east-pool-shore-ref':'东池分类水面 · 2025-09-22',
 'f1-ge-imagefirst-marsh-to-pond-gap':'泥沼与东池之间的过渡核查区',
 }[r.id]||r.id;
}
function guideVisibleEastRef(step,ref){return guidedTour.eastHidden?.get(step.id)?.has(ref.id)!==true;}
function renderEastLegend(step){
 const host=$('#guided-east-legend'), wrap=$('#guided-east-layers');
 host.hidden=!step.id.startsWith('east-');if(host.hidden){host.open=false;return;}
 if(host.dataset.step===step.id)return;
 host.dataset.step=step.id;
 wrap.replaceChildren(...guideStepLineRefs(step).filter(r=>EAST_STYLE[r.mode]).map(ref=>{
   const label=document.createElement('label'), txt=document.createElement('span');
   const cb=document.createElement('input');cb.type='checkbox';cb.dataset.eastLayer=ref.id;cb.checked=guideVisibleEastRef(step,ref);
   const ns='http://www.w3.org/2000/svg', sw=document.createElementNS(ns,'svg'), line=document.createElementNS(ns,'line');
   sw.setAttribute('viewBox','0 0 28 12');sw.setAttribute('aria-hidden','true');
   for(const [k,v] of Object.entries({x1:1,x2:27,y1:6,y2:6,stroke:EAST_STYLE[ref.mode][0],'stroke-width':2,'stroke-dasharray':EAST_STYLE[ref.mode][1]?eastDash(ref).svg:'none'}))line.setAttribute(k,v);
   sw.append(line);txt.textContent=eastLegendLabel(ref);label.append(cb,sw,txt);
   cb.onchange=()=>{
     const t=guidedTour;if(guideStep()?.id!==step.id)return;
     const set=t.eastHidden.get(step.id)||new Set();if(cb.checked)set.delete(ref.id);else set.add(ref.id);t.eastHidden.set(step.id,set);
     setGuideVisiblePath(step);renderEastGuidePlan($('#guided-map-inset'),step);prepareGuideNavMap(step);
   };
   return label;
 }));
}
const EAST_IMAGES=[
 ['ge-root-200405','2004-05'],['ge-root-202107-2','2021-07 · 2'],['ge-root-202109','2021-09'],['ge-root-202209-2','2022-09 · 2'],
];
function eastGuideProfileRows(step){
 if(step.id==='east-pool-source')return [[EAST_COP,'Copernicus 路线'],[EAST_AW,'AW3D30 路线']];
 if(step.id==='east-marsh-source')return [[EAST_SECTION,'东西横剖']];
 if(step.id==='east-connection-check')return step.detail.evidence.filter(x=>x.mode==='raw-model').map(x=>[x.id,x.id.includes('Cop_frozen30')?'Copernicus 原地表':'AW3D30 原地表']);
 return [];
}
function renderEastGuideControls(step){
 const host=$('#guided-east-controls'), imgs=$('#guided-east-scenes'), prof=$('#guided-east-profiles');
 const rows=eastGuideProfileRows(step);
 renderEastLegend(step);
 host.hidden=!rows.length;if(host.hidden)return;
 const draw=(box,items,run)=>{
   box.replaceChildren(...items.map(([id,title])=>{
    const b=document.createElement('button');b.type='button';b.className='deck-btn';b.dataset.eastChoice=id;b.textContent=title;
    b.onclick=()=>run(id);return b;
   }));
 };
 if(host.dataset.step!==step.id){
   host.dataset.step=step.id;
   draw(imgs,EAST_IMAGES,async id=>{const t=guidedTour,token=t.token;await fixedHistory.openScene(id);if(t.active&&t.token===token)renderEastGuideControls(guideStep());});
   draw(prof,rows,id=>{if(v74SelectProfile(id))renderEastGuideControls(step);});
 }
 for(const b of imgs.children)b.setAttribute('aria-pressed',String(b.dataset.eastChoice===(fixedHistory.active?.id||step.sceneId)));
 for(const b of prof.children)b.setAttribute('aria-pressed',String(b.dataset.eastChoice===guidedTour.v74Profile));
 const active=getProfileData(guidedTour.v74Profile);
 $('#guided-east-caveat').textContent=step.id==='east-marsh-source'?'横剖读取 GLO-30 原地表，不是沟道。':
   (active?.hasAw?'沿所选路线对照 GLO-30 与 AW3D30 两套 30 米地表。':'沿所选路线读取 GLO-30 30 米地表。')+'不是实测沟底或流量。';
}
function renderEastGuidePlan(el,step){
 const refs=[...guidePriorRefs(step).filter(r=>guideEastModelIds.has(r.id)),...guideStepLineRefs(step)], a=refs.flatMap(r=>r.coords);
 if(!a.length){el.setAttribute('hidden','');return;}
 const xs=a.map(p=>p[0]),ys=a.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),south=Math.min(...ys),north=Math.max(...ys);
 const sk=Math.min(112/Math.max(1,(right-left)*GUIDE_METERS_PER_DEG_LON),60/Math.max(1,(north-south)*GUIDE_METERS_PER_DEG_LAT));
 const q=([x,y])=>[70+(x-(left+right)/2)*GUIDE_METERS_PER_DEG_LON*sk,44-(y-(south+north)/2)*GUIDE_METERS_PER_DEG_LAT*sk];
 const add=(tag,attrs,txt='')=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);n.textContent=txt;el.append(n);};
 el.replaceChildren();
 for(const r of refs){const style=EAST_STYLE[r.mode];if(!style||!guideVisibleEastRef(step,r))continue;
   add('polyline',{points:r.coords.map(p=>q(p).join(',')).join(' '),fill:'none',stroke:style[0],'stroke-width':r.mode==='water-ref'?2.1:1.55,'stroke-dasharray':style[1]?eastDash(r).svg:'none','data-east-ref':r.id});
 }
 for(const [i,id] of (step.director?.anchorIds||[]).entries()){
   if(!guideRevealSite(step,id))continue;
   const spot=guideAnchorPoint(id);if(!Array.isArray(spot))continue;
   const [x,y]=q(spot), tx=i===0?8:i===1?69:132,ty=i===1?87:14;
   add('circle',{cx:x,cy:y,'data-inset-old-dot':'',r:2.1,fill:guideLabelTone(id)||'#f3faff'});
   add('line',{x1:x,y1:y,x2:tx,y2:ty+2,'data-inset-old-leader':'',stroke:'#92afbf','stroke-width':.65});
   add('text',{x:tx,y:ty,fill:guideLabelTone(id)||'#eefaff','data-place-tone':guideLabelTone(id)||'','font-size':7.5,'text-anchor':i===0?'start':i===1?'middle':'end'},id==='east-guide-texture-end'?'纹理消散窗':id==='east-guide-marsh-pin'?'东部泥沼':'东池');
 }
 el.setAttribute('aria-label',step.title+'：位置参照，模型与核查区不是证实水道');
 el.removeAttribute('hidden');
}
const v74StopProfiles={
 'runoff-upper-slope':'v88-nw-ravine-profile',
 'runoff-bridge':'v74-bridge-physical-profile','runoff-cross-gap':'v74-bridge-physical-profile',
 'road-nw-gully':guideKMZProfiles[1],'kmz-north-to-crossings':guideKMZProfiles[1],'runoff-shore-separate':'v74-road03-p4-profile',
 'road-b-southeast':'main-profile-southeast-inlet','road-c-south-central':'main-profile-south-central-inlet',
 'road-round':'v74-road-round-profile','lake-west':'main-profile-west-inlet',
 'east-marsh-source':EAST_SECTION,'east-pool-source':EAST_COP,
 'east-connection-check':'diag-branch-Cop_frozen30_raw_F1_NE_fade_local_stop_G3320_minor0'
};
function v74BuildProfiles(){
 const ref=provider.analysisById.get('historical_sample_union_terminal')?.geometry;
 for(const [id,[name,ids]] of Object.entries(v74Profiles)){
   const runs=[];
   for(const fid of ids){
    const a=guideFeature(fid)?.geometry?.coordinates;if(!Number.isFinite(a?.[0]?.[0]))continue;
    for(const part of (id==='v88-nw-ravine-profile'?privatePathParts(fid,a):[a])){
     const prev=runs.at(-1);
     if(prev&&guideDistance(prev.at(-1),part[0])<.01)prev.push(...part.slice(1));
     else runs.push([...part]);
    }
   }
   if(!runs.length)continue;
   const f={id,type:'Feature',properties:{name},geometry:{type:'MultiLineString',coordinates:runs}};
   const track=profileFromExactLine(f,provider.dem,ref?[ref]:[]);
   if(!track)continue;
   const prof=track.properties.profile;
   let offset=0;prof.gaps=[];
   for(let i=0;i<prof.samples.length;i++){
    const row=prof.samples[i],next=prof.samples[i+1];
    row[0]+=offset;
    if(row[3]===null&&next&&next[0]===row[0]-offset&&guideDistance(row.slice(1,3),next.slice(1,3))>.1){
      const dist=guideDistance(row.slice(1,3),next.slice(1,3));
      prof.gaps.push({startM:row[0],endM:row[0]+dist});
      row[0]+=dist/2;offset+=dist;
    }
   }
   prof.note='实线是原矢量可取样段，空白按端点间直距占位；不补高程。30 m 地表，非实测沟底或管口。';
   if(id==='v88-nw-ravine-profile')prof.note='按原标绘西向东取样，依次为丘脚暗带、外坡弯槽、槽形会合段。空白按端点直距占位，不补线、不补高程。30 m 地表，非实测沟底。';
   guideV74Lines.set(id,track);
   const pd=extractProfileData(track);if(pd){pd.gaps=prof.gaps;pd.sampleOrigin='atlas-display-dem';profileCache.set(id,pd);}
 }
 for(const [point,id] of Object.entries(guideKMZProfiles)){
   const line=guideFeature(id);if(line?.geometry?.type!=='LineString')continue;
   const track=profileFromExactLine({...line,properties:{...line.properties,
     name:'03 道路 '+point.padStart(2,'0')+' 点｜KMZ 来路纵剖面'}},provider.dem,[]);
   if(!track)continue;
   track.properties.profile.note='沿记录者原 KMZ 折线取样，不向涵洞补画。0 m 为文件首点（近道路），里程按原文件顺序向来路递增。高程是未夸张的 30 m GLO-30 地表，不是实测沟底或涵管高程。';
   const pd=extractProfileData(track);
   if(pd){pd.sampleOrigin='atlas-display-dem';profileCache.set(id,pd);}
 }
}
configureTourPanels({
 openProfile(id){
   const data=getProfileData(id,{allowSampling:true});if(!data)return false;
   guidedTour.v74ProfileInteracted=false;
   state.bottomTab='profile';state.activeProfileId=id;state.profileCursorIdx=data.zeroSampleIdx??0;
   $('#chart-deck').dataset.v74ProfileLabel=data.name;
   renderChartDeck();setDeckExpanded(true,Math.round(innerHeight*(isMobileViewport()?.19:.23)));
   syncMapsState();return true;
 },
 closeProfile(){guidedTour.v74ProfileInteracted=false;$$('[data-guide-kmz-profile]').forEach(b=>b.setAttribute('aria-pressed','false'));delete $('#chart-deck').dataset.v74ProfileLabel;setDeckExpanded(false);syncMapsState();}
});
function v74SelectProfile(id){
 const cfg=window.hjnV74Panels;if(!cfg)return false;
 if(!id){if(document.getElementById('observatory').classList.contains('v74-tour-profile-open'))cfg.closeProfile();guidedTour.v74Profile=null;$$('[data-guide-kmz-profile]').forEach(b=>b.setAttribute('aria-pressed','false'));return false;}
 if(guidedTour.v74Profile===id&&$('#observatory').classList.contains('v74-tour-profile-open'))return true;
 if(cfg.openProfile(id)){guidedTour.v74Profile=id;$$('[data-guide-kmz-profile]').forEach(b=>b.setAttribute('aria-pressed',String(guideKMZProfiles[b.dataset.guideKmzProfile]===id)));return true;}return false;
}
const guideFeature=id=>provider.analysisById.get(id)??guideV74Lines.get(id);
const guidePoint=id=>guideFeature(id)?.geometry?.coordinates;
const v74BridgeId='f1-east-bridge-location-ref';
const guideMeasurements=step=>{
 const left=id=>guidePoint(id)?.at(-1), right=id=>guidePoint(id)?.[0], bridge=guidePoint(v74BridgeId);
 const west=left('hjn-seasonal-f1-west'), east=right('hjn-seasonal-f1-east');
 const westMeasure=['24',west,bridge,'西低带末端','中桥桥位'], eastMeasure=['83',bridge,east,'中桥桥位','东低带起点'];
 const bend=['148',left('hjn-seasonal-f1-east'),right('hjn-seasonal-f1-se'),'东低带末端','东南弯槽起点'];
 const apron=['429–452',left('hjn-seasonal-f1-se'),guidePoint('hjn-03-road-pin-02'),'东南弯槽末端','03 第 2 点'];
 if(apron[1]&&apron[2])apron[0]=String(Math.round(guideDistance(apron[1],apron[2])));
 const m={
   'runoff-west':[westMeasure],'runoff-bridge':isMobileViewport()?[westMeasure]:[westMeasure,eastMeasure],'runoff-cross-gap':[westMeasure,eastMeasure],
   'runoff-bend-gap':[bend],'runoff-apron-gap':[apron],
   'kmz-north-to-crossings':[['159',left('hjn-v75-kmz-upstream-common'),left('hjn-v75-kmz-upstream-03'),'共同线东端','03 来路北端']],
   'kmz-outer-options':[['50',[119.66144254,49.14866815],right('hjn-v75-kmz-seepage-backyards'),'潜在水路近点','后院支路西端']]
 }[step?.id]??[];
 return m.filter(([,a,b])=>Number.isFinite(a?.[0])&&Number.isFinite(b?.[0]));
};
function guideFitPoints(step){
 const ms=guideMeasurements(step).flatMap(m=>m.slice(1,3));
 const explicit=step.director?.frameLines||[];
 const ls=explicit.filter(id=>guideRevealSite(step,id)).flatMap(id=>{const f=guideFeature(id);return f?.geometry?.type==='LineString'?f.geometry.coordinates:[]});
 const anchor=step.id==='road-round'?guidePoint('hjn-seasonal-round-gap'):null;
 const focus=GUIDE_FOCUS_AREAS[step.id]||[];
 const areaPoints=focus.flatMap(id=>{
   const f=provider.analysisById.get(id);
   const b=f&&geometryBounds(f.geometry);
   return b?[[b[0],b[1]],[b[0],b[3]],[b[2],b[1]],[b[2],b[3]]]:[];
 });
 const four=step.id==='road-nw-gully'?(step.detail.fieldMarks||[]).map(m=>m.coord).filter(p=>Number.isFinite(p?.[0])):[];
 const keyPoints=(step.director?.framePoints||[]).filter(id=>guideRevealSite(step,id)).map(guideAnchorPoint).filter(q=>Number.isFinite(q?.[0]));
 if(isGuideOpening(step)){
  for(const id of new Set(step.director.cues.flatMap(c=>c.anchorIds||[]))){
   const g=guideFeature(id)?.geometry, q=guideAnchorPoint(id);
   if(g?.type==='LineString')keyPoints.push(...privatePathParts(id,g.coordinates).flat());else if(Number.isFinite(q?.[0]))keyPoints.push(q);
  }
 }
 if(['chapter-opening','runoff-main-entrance-context','chapter-closing'].includes(step.id)){
   for(const id of ['f1-east-marsh-field-review','f1-east-pool-shore-ref']){
     if(!guideRevealSite(step,id))continue;
     const shape=guideFeature(id)?.geometry;
     if(shape?.type==='Polygon')keyPoints.push(...shape.coordinates[0]);
   }
 }
 if(NW_FULL.has(step.id)&&nwForGuide(step).length){
   for(const f of nwForGuide(step).filter(x=>['up','lake'].includes(x.properties.group)&&x.geometry.type.includes('Polygon'))){
     const [w,s,e,n]=geometryBounds(f.geometry);
     keyPoints.push([w,s],[w,n],[e,s],[e,n]);
   }
 }
 return [...ms,...ls,...keyPoints,...four,...areaPoints,...guideCatchmentPolys(step).flatMap(p=>p[0]),...(Number.isFinite(anchor?.[0])?[anchor]:[])];
}
const guideNorthFrame=new Set(['chapter-opening','runoff-main-entrance-context','road-b-southeast','road-c-south-central','lake-office-caution','chapter-closing']);
const guideSouthFrames=new Set(['road-b-southeast','road-c-south-central']);
function guideNorthCamera(step,base){
 const south=guideSouthFrames.has(step.id), portrait=isMobileViewport();
 let lon=south?119.669:(portrait?(step.id==='chapter-opening'?119.681:119.672):119.682), centerLat=south?(portrait?49.127:49.1265):(portrait?49.140:49.1358);
 const pitch=south?-72:-70, heading=0;
 const eyeM=portrait?(south?11600:13000):(south?7300:7600);
 const stand=eyeM/Math.tan(-pitch*Math.PI/180), angle=heading*Math.PI/180;
 const targetLon=lon; lon-=Math.sin(angle)*stand/GUIDE_METERS_PER_DEG_LON;
 const lat=centerLat-Math.cos(angle)*stand/GUIDE_METERS_PER_DEG_LAT;
 const bounds=provider.dem.bounds_wgs84;
 const lonRef=Math.max(bounds[0]+.00015,Math.min(bounds[2]-.00015,lon));
 const latRef=Math.max(bounds[1]+.00015,Math.min(bounds[3]-.00015,lat));
 const origin=guideGround(lonRef,latRef), z=guideGround(targetLon,centerLat);
 return {...base,lon,lat,heading,pitch,eyeM:eyeM+(z-origin)*map3d.exag,directorFov:portrait?47:42,guideOriginM:map3d.hasWalkGround(lon,lat)?undefined:origin};
}
function guideFocusCamera(step,base,points=null){
 if(guideNorthFrame.has(step.id))return guideNorthCamera(step,base);
 points??=guideFitPoints(step);
 if(points.length<2)return null;
 const west=Math.min(...points.map(p=>p[0])),east=Math.max(...points.map(p=>p[0]));
 const south=Math.min(...points.map(p=>p[1])),north=Math.max(...points.map(p=>p[1]));
 const cx=(west+east)/2,cy=(south+north)/2;
 const heading=step.director?.viewHeading??(step.id==='runoff-apron-gap'?180:0);
 const rad=heading*Math.PI/180;
 const span=Math.hypot((east-west)*GUIDE_METERS_PER_DEG_LON,(north-south)*GUIDE_METERS_PER_DEG_LAT);
 const isWide=isGuideOpening(step)||Boolean(GUIDE_CATCHMENTS[step.id])||step.director?.frameLines?.some(id=>id.startsWith('main-profile-'))||step.director?.framePoints?.includes('guide-main-lake');
 const pitch=(NW_FULL.has(step.id)&&nwForGuide(step).length?-40:GUIDE_CATCHMENTS[step.id]?-49:GUIDE_FOCUS_AREAS[step.id]?-37:step.id==='road-round'?-34:step.id==='road-nw-gully'?-37:isWide&&isMobileViewport()?-26:-24)+(step.director?.tiltLift||0), elevation=guideGround(cx,cy), box=guideSafeBox();
 const full=NW_FULL.has(step.id)&&nwForGuide(step).length;
 const usableW=Math.min(map3d.width||innerWidth,isMobileViewport()?innerWidth*.90:innerWidth*(full?.68:.80));
 const usableH=Math.max(165,box.bottom-box.top-50);
 const requestedSize=GUIDE_CATCHMENTS[step.id] ? .68:GUIDE_FOCUS_AREAS[step.id] ? .77:step.id==='road-nw-gully'?.86:.93;
 const wanted=Math.max(step.id==='road-nw-gully'?450:125,span*requestedSize*map3d.height/Math.min(usableW,usableH));
 const natural=step.id==='lake-west';
 const stand=Math.min(natural?13000:8000,wanted*(natural?1.34:step.director?.backoff||1));
 let lon=cx-Math.sin(rad)*stand/GUIDE_METERS_PER_DEG_LON,lat=cy-Math.cos(rad)*stand/GUIDE_METERS_PER_DEG_LAT;
 const lim=provider.dem.bounds_wgs84;
 const lonRef=Math.max(lim[0]+.00012,Math.min(lim[2]-.00012,lon));
 const latRef=Math.max(lim[1]+.00012,Math.min(lim[3]-.00012,lat));
 const reference=guideGround(lonRef,latRef);
 if(!isWide){lon=lonRef;lat=latRef;}
 const outside=isWide&&!map3d.hasWalkGround(lon,lat);
 const dist=guideDistance([lon,lat],[cx,cy]);
 if(!Number.isFinite(reference))return null;
 const delta=(elevation-reference)*map3d.exag;
 const eyeM=Math.max(42,delta+dist*Math.tan(-pitch*Math.PI/180));
 const actualPitch=-Math.atan2(eyeM-delta,dist)*180/Math.PI;
 const across=Math.max(2,Math.abs((east-west)*GUIDE_METERS_PER_DEG_LON*Math.cos(rad))+Math.abs((north-south)*GUIDE_METERS_PER_DEG_LAT*Math.sin(rad)));
 const fov=isWide?Math.max(42,Math.min(natural?52:78,2*Math.atan(across/(2*Math.max(70,dist)*Math.max(.2,map3d.width/map3d.height)*.78))*180/Math.PI)):42;
 return {...base,lon,lat,heading,pitch:actualPitch,eyeM,directorFov:fov,guideOriginM:outside?reference:undefined};
}
let v74MeasureNode;
function showGuideMeasures(step){
 const m=guideMeasurements(step);
 if(!m.length||!guidedTour.active||guidedTour.observer){if(v74MeasureNode)v74MeasureNode.hidden=true;return;}
 if(!v74MeasureNode){const div=document.createElement('div');div.id='guide-v74-measurements';$('#observatory').append(div);v74MeasureNode=div;}
 const host=v74MeasureNode,key=step.id;
 host.hidden=false;
 const ns='http://www.w3.org/2000/svg';
 const add=(parent,tag,attrs,t='')=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);n.textContent=t;parent.append(n);return n;};
 if(host.dataset.scene!==key){
  host.dataset.scene=key;
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('aria-label','实测位置间直距标注，不是水路线');
  host.replaceChildren(svg);
  const panel=document.createElement('div'); panel.className='guide-v74-measure-list';host.append(panel);
  for(const [meters,a,b,from,to] of m){
    const g=add(svg,'g',{'data-guide-measure':meters});
    for(const c of ['casing','measure'])add(g,'line',{class:c});
    for(const name of [from,to])add(g,'circle',{r:5,'aria-label':name});
    for(const name of ['约 '+meters+' m',from,to]){add(g,'line',{class:'guide-measure-stem'});add(g,'text',{},name);}
    const row=document.createElement('div');row.textContent=from+' ↔ '+to+' · 约 '+meters+' m';panel.append(row);
  }
 }
 const safe=guideSafeBox(), points=p=>guideScreenPoint(p);
 const groups=host.querySelectorAll('[data-guide-measure]'), occupied=[];
 for(const [i,[meters,p,q]] of m.entries()){
   const a=points(p),b=points(q),g=groups[i];
   if(!a||!b){g.style.display='none';continue;}
   g.style.display='';
   const ls=g.querySelectorAll('line.casing,line.measure'),cs=g.querySelectorAll('circle'),ts=g.querySelectorAll('text'),stems=g.querySelectorAll('.guide-measure-stem');
   stems.forEach(l=>l.style.display='none');
   for(const l of ls)for(const [k,v] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))l.setAttribute(k,v);
   const label=(n,x,y)=>{
     const half=Math.max(26,n.textContent.length*7);
     const allowed=(x,y)=>x>half+5&&x<innerWidth-half-5&&y>safe.top+20&&y<safe.bottom&&
       ![...(safe.photo.height&&isMobileViewport()?[safe.photo]:[safe.panel,safe.n,safe.deck,safe.photo]),...occupied].some(b=>b.width&&x+half>b.left&&x-half<b.right&&y+6>b.top&&y-15<b.bottom);
     const pos=[[0,0],[0,-23],[0,24],[-37,0],[37,0],[-50,-19],[50,20],[0,-47],[0,48]].map(([dx,dy])=>[x+dx,y+dy]).find(([x,y])=>allowed(x,y));
     n.style.display=pos?'':'none';
     if(pos){const [x,y]=pos;n.setAttribute('x',x);n.setAttribute('y',y);occupied.push({left:x-half,right:x+half,top:y-15,bottom:y+6,width:half*2});}
   };
   for(const [j,c] of [a,b].entries()){cs[j].setAttribute('cx',c.x);cs[j].setAttribute('cy',c.y);if(j===0||i===0)label(ts[j+1],c.x,c.y+(j?-23:26));else label(ts[j+1],c.x,c.y-27);}
   if(i===1&&ts[1].textContent===groups[0]?.querySelectorAll('text')[2]?.textContent)ts[1].style.display='none';
   const short=Math.hypot(a.x-b.x,a.y-b.y)<62;
   if((meters==='159'||meters==='50')&&Math.abs(a.x-b.x)<115){
     const space=a.x<innerWidth*.52?-1:1;
     label(ts[1],a.x-58*space,a.y-15);
     label(ts[2],b.x+58*space,b.y+17);
     label(ts[0],(a.x+b.x)*.5,Math.min(a.y,b.y)-35);
   }else label(ts[0],(a.x+b.x)/2+(short?(i===0?-28:28):0),(a.y+b.y)/2+(m.length>1?(i===0?-48:27):-16));
   const anchors=[{x:(a.x+b.x)/2,y:(a.y+b.y)/2},a,b];
   for(let k=0;k<anchors.length;k++){
     const p=anchors[k],x=Number(ts[k].getAttribute('x')),y=Number(ts[k].getAttribute('y'));
     if(ts[k].style.display==='none'||Math.hypot(p.x-x,p.y-y)<5)continue;
     const l=stems[k];l.style.display='';
     for(const [key,v] of Object.entries({x1:p.x,y1:p.y,x2:x,y2:y}))l.setAttribute(key,v);
   }
 }
}
const allGuideSecondary=()=>provider.analysis.features.filter(f=>f.properties?.layer==='secondary-roads'&&f.geometry?.type==='LineString').flatMap(f=>privatePathParts(f.id,f.geometry.coordinates).flatMap(coords=>clipGuideRoad(coords)).map(coordinates=>({...f,geometry:{type:'LineString',coordinates}})));
const isGuideSouth=(step)=>/^(road-(round|c-|b-)|lake-)/.test(step.id);
function guideStepLineRefs(s){
 const get=id=>guideFeature(id)?.geometry;
 const refs=(Array.isArray(s.detail?.evidence)?s.detail.evidence:[]).filter(o=>guideRevealSite(s,o.id)).map(o=>{
  const g=get(o.id);return {id:o.id,mode:o.mode,coords:g?.type==='Polygon'&&['band','review-area','gap-area','water-ref'].includes(o.mode)?g.coordinates[0]:g?.coordinates};
 }).filter(o=>Array.isArray(o.coords?.[0])&&Number.isFinite(o.coords[0][0]));
 if(s.id==='chapter-opening'&&guideOpeningCue(s)?.anchorIds?.includes('hjn-seasonal-round-gap')){
   for(const id of ['wcross2-west-extension-approach','hjn-seasonal-round-model']){
     const g=get(id);if(g?.type==='LineString')refs.push({id,mode:'model',coords:g.coordinates});
   }
 }
 if(s.id==='runoff-cross-gap'){
   for(const id of ['hjn-seasonal-f1-west','hjn-seasonal-f1-east']){
     const g=get(id);if(g?.type==='LineString'&&!refs.some(r=>r.id===id))refs.push({id,mode:'observed',coords:g.coordinates});
   }
 }
 if(s.id==='road-nw-gully'){
   const seconds=guideSpokenSeconds();
   const cue=s.detail?.spokenPoints?.findLast(q=>q.start<=seconds);
   for(const id of s.director?.pinLines?.[String(cue?.point)]||[]){
    const g=get(id);if(g?.type==='LineString')refs.push({id,mode:guideFeature(id)?.properties?.guideMode||'observed',coords:g.coordinates});
   }
 }
 if(isGuideOpening(s)&&s===guideStep()){
  for(const id of guideOpeningCue(s)?.anchorIds||[]){const g=get(id);if(g?.type==='LineString')refs.push({id,mode:id.startsWith('main-profile-')?'model':'observed',coords:g.coordinates});}
 }
 if(BRIDGE_REVIEW_STOPS.has(s.id)){
   for(const id of [...WF1_MODELS,...guideEastModelIds]){
     const g=get(id);
     if(g?.type==='LineString'&&!refs.some(r=>r.id===id))refs.push({id,mode:id===EAST_AW?'model-alt':'model',coords:g.coordinates});
   }
 }
 const coords=s.coordinates;
 if(s.kind!=='gap'&&Array.isArray(coords?.[0])&&Number.isFinite(coords[0][0])){
   const road=s.featureId?.startsWith('secondary-way-');
   if(!road||(s.kind==='travel'&&s.id!=='road-nw-approach'))refs.push({id:s.featureId||s.id,mode:road?'road':s.status?.startsWith('model')?'model':'observed',coords});
 }
 return refs.filter(r=>guideRevealSite(s,r.id)).flatMap(r=>privatePathParts(r.id,r.coords).map((coords,part)=>({...r,coords,key:r.id+'#'+part})));
}
function guidePointRefs(step){
 const flat=guidedTour.book.flatMap(r=>r.steps);
 const seen=flat.slice(0,flat.findIndex(s=>s.id===step.id)+1);
 const rows=[];const active=guideOpeningCue(step);
 if((seen.some(s=>s.id==='runoff-bridge')||active?.anchorIds?.includes('f1-east-bridge-location-ref'))&&(!GUIDE_FOCUSED_STOPS.has(step.id)||step.id==='road-nw-gully'))rows.push({id:'f1-east-bridge-location-ref',label:'中桥'});
 const label=GUIDE_FOCUS_LABEL[step.id];
 if(label)rows.push({id:label[0],label:label[1],current:true});
 const pins=guideFourProgress(step);
 const featured=step.id==='road-nw-approach'?[1,2,3,4]:step.id==='kmz-north-to-crossings'?[1,3]:openingPinNumbers(active);
 if(featured.length)for(const i of featured)rows.push({id:'hjn-03-road-pin-0'+i,label:String(i),current:true});
 if(step.id==='kmz-north-to-crossings')rows.push({id:'guide-03',label:'03 道路',current:true});
 if(!GUIDE_FOCUSED_STOPS.has(step.id)||step.id==='road-nw-gully')for(const i of pins.ids)rows.push({id:'hjn-03-road-pin-0'+i,label:String(i),current:i===pins.active});
 for(const [id,stop,label] of [[NW_EAST_MARSH,'east-marsh-source','东部泥沼'],[NW_EAST_POOL,'east-pool-source','东池']]){
  const phase=guideVisitStage(step,stop), intro=Boolean(active?.anchorIds?.includes(id));
  if(intro||phase>=0&&(!GUIDE_FOCUSED_STOPS.has(step.id)||step.id.startsWith('east-')))rows.push({id,label,current:intro||phase===0});
 }
 if(step.id==='road-nw-approach'||active?.anchorIds?.some(x=>NW_FIELD_PIN.test(x)))rows.push({id:'guide-03',label:'03 道路',current:true});
 if(active?.anchorIds?.includes('main-profile-southeast-inlet'))rows.push({id:'nw96-label-7',label:'东南 B',current:true});
 if(active?.anchorIds?.includes('main-profile-south-central-inlet'))rows.push({id:'nw96-label-5',label:'南中 C',current:true});
 const overview=['chapter-opening','runoff-main-entrance-context','chapter-closing'].includes(step.id);
 if(['lake-office-caution','chapter-closing'].includes(step.id)){
   rows.push({id:'nw96-label-7',label:'东南 B',current:true},{id:'nw96-label-5',label:'南中 C',current:true},{id:'guide-round',label:'圆涵',current:true});
 }
 if(step.id==='road-round')rows.push({id:'guide-round',label:'圆涵',current:true});
 if(overview||NW_FULL.has(step.id))rows.push({id:'guide-main-lake',label:'主湖'});
 for(const id of new Set([...(active?.anchorIds||step.director?.anchorIds||[]),...(overview||NW_FULL.has(step.id)?['east-guide-marsh-pin','east-guide-pool-pin']:[]),...(NW_FULL.has(step.id)?['guide-wf1']:[])])){
  if(NW_FIELD_PIN.test(id)||id===NW_EAST_MARSH||id===NW_EAST_POOL)continue;
  if(id==='hjn-seasonal-round-gap'&&step.id==='road-round')continue;
  const f=provider.analysisById.get(id), itself=rows.find(r=>r.id===id);
  if(itself)itself.current=true;
  else if(id==='guide-main-lake'||id==='guide-wf1'||id==='guide-south-roundabout'||f?.geometry?.type==='Point')rows.push({id,label:id==='guide-main-lake'?'主湖':id==='guide-wf1'?'西长湖':id==='guide-south-roundabout'?'南部环岛':id.startsWith('hjn-03-road-pin-')?String(Number(id.slice(-2))):f.properties?.name||'当前证据',current:!overview||Boolean(active?.anchorIds?.includes(id))});
 }
 const seenLabels=new Set();
 return rows.filter(r=>!(Object.hasOwn(displayClip,r.id)&&!displayClip[r.id])).map(r=>({...r,point:guideAnchorPoint(r.id)}))
  .filter(r=>Array.isArray(r.point)&&Number.isFinite(r.point[0])&&!seenLabels.has(r.id)&&seenLabels.add(r.id))
  .sort((a,b)=>Number(Boolean(b.current))-Number(Boolean(a.current)));
}
function updateArchivedGuideMarkers(step){
 const host=$('#guided-prior-landmarks');
 if(!guidedTour.active||guidedTour.observer||!step){host.hidden=true;trimGuideAnchors($('#guide-landmark-anchors'),0);return;}
 host.hidden=false;
 const marks=guideFourProgress(step);
 const key=step.id+':'+(guideOpeningCue(step)?.startMs??guideOpeningCue(step)?.at??0)+':'+marks.count+':'+marks.active;
 if(host.dataset.cue!==key){
  host.dataset.cue=key;
  host.replaceChildren(...guidePointRefs(step).filter(r=>(step.id!=='road-nw-gully'||r.label==='中桥')&&!(guideMeasurements(step).some(m=>m[3].includes('桥位')||m[4].includes('桥位'))&&r.label==='中桥')).map(r=>{
   const n=document.createElement('span');n.className='guide-continuity-pin'+(r.current?' current':'');n.dataset.evidenceId=r.id;n.dataset.coords=r.point.join(',');
   n.textContent=r.id==='hjn-seasonal-round-gap'?'圆涵 · 东口待核':r.id==='east-guide-texture-end'?'东北纹理消散窗':r.label;n.title=r.label;
   const tone=guideLabelTone(r.id);
   if(tone)n.style.setProperty('--guide-label-tone',tone);
   return n;
  }));
 }
 const fit=guideSafeBox(),occupied=[];
 const reserved=[$('#guided-photo-map-pin'),...$$('#guide-v74-measurements text')].filter(n=>n&&!n.closest('[hidden]')&&n.style.display!=='none').map(n=>n.getBoundingClientRect());
 const blocked=fit.photo.height&&isMobileViewport()?[fit.photo]:[fit.n,fit.panel,fit.card,fit.deck,fit.photo];
 const ground=$('#guide-landmark-anchors');let dots=0;
 for(const n of host.children){
   const xy=guideScreenPoint(n.dataset.coords.split(',').map(Number));
   const half=Math.min(82,Math.max(12,n.textContent.length*6.2+9));
   const {at,anchor}=fitGuideLabel(xy,fit,half,10,[...blocked,...reserved],occupied);
   n.hidden=!at;
   if(at)positionGuideLabel(n,host,at,anchor);
   if(anchor)drawGuideAnchor(ground,dots++,anchor,at,n.style.getPropertyValue('--guide-label-tone')||'#dcf0f9',n.dataset.evidenceId);
 }
 trimGuideAnchors(ground,dots);
}
const isGuideOpening=step=>step.id==='chapter-opening';
function guidePriorRefs(step){
 const flat=guidedTour.book.flatMap(t=>t.steps);
 const i=flat.findIndex(s=>s.id===step.id);
 const current=new Set(guideStepLineRefs(step).map(r=>r.id));
 const earlier=new Map();
 const retained=(CONTEXT_GUIDE_LINES[step.id]||[]).filter(id=>guideRevealSite(step,id)).flatMap(id=>{
   const g=guideFeature(id)?.geometry;
   return g?.type==='LineString'?privatePathParts(id,g.coordinates).map((coords,part)=>({id,coords,key:id+'#'+part,mode:'model',retained:true})):[];
 });
 for(const s of flat.slice(0,i))for(const item of s.id.startsWith('east-')?guideStepLineRefs(s).filter(r=>guideEastModelIds.has(r.id)&&guideVisibleEastRef(s,r)):guideStepLineRefs(s)){
    if(!current.has(item.id))earlier.set(item.key||item.id,item);
 }
 if(GUIDE_FOCUSED_STOPS.has(step.id)){
   if(step.id.startsWith('east-'))return [...earlier.values()].filter(ref=>guideEastModelIds.has(ref.id)||ref.id==='hjn-seasonal-f1-east'||ref.id.startsWith('hjn-v75-kmz-seepage')||ref.id.startsWith('hjn-v75-kmz-potential'));
   if(step.id!=='road-nw-gully')return retained;
 }
 const bridgeReview=BRIDGE_REVIEW_STOPS.has(step.id);
 const forRoad=step.id==='road-c-approach'||step.id==='road-round-approach';
 return [...earlier.values()].filter(ref=>!bridgeReview||!guideEastModelIds.has(ref.id)).filter(ref=>!forRoad||ref.mode!=='model').concat(retained.filter(ref=>forRoad||!earlier.has(ref.key)));
}
function currentGuideLineFocus(step,refs){
  const point=step.id==='road-nw-gully'
    ?step.detail?.spokenPoints?.findLast(q=>q.start<=guideSpokenSeconds())?.point
    :null;
  return guideFocusLineId(step,refs,{point,openingIds:guideOpeningCue(step)?.anchorIds||[]});
}
function setGuideVisiblePath(step){
 const t=guidedTour;
 const previous=guidePriorRefs(step).map(r=>({...r,color:r.mode==='road'?0xffcf59:EAST_STYLE[r.mode]&&guideEastModelIds.has(r.id)?eastModelColor:r.mode==='model'?parseInt(GUIDE_MAIN_MODEL_STROKE.slice(1),16):r.mode==='candidate'?0xffb465:r.mode==='owner'?0x79d8f4:r.mode==='band'?0x9ee8cc:0x53dce8,dashed:guideEastModelIds.has(r.id)||r.mode==='model'||r.mode==='candidate'||r.mode==='band'||r.mode==='owner',dashKm:guideEastModelIds.has(r.id)?eastDash(r).km:r.mode==='model'?guideModelDash(r).km:undefined,opacity:r.retained?.87:r.mode==='road'?.72:guideEastModelIds.has(r.id)?.86:.58,halfWidth:r.retained?2.7:guideEastModelIds.has(r.id)?2.5:2}));
 const refs=guideStepLineRefs(step);

 previous.push(...(t.contextPaths||[]).map(r=>({coords:r.coords,color:0xf36c71,opacity:.77,halfWidth:2.5})));
 const names=step.id==='road-nw-gully'?step.director?.pinLines?.[$('#guided-location-card').dataset.point]:null;
 const visibleRefs=Array.from(new Map(refs.filter(x=>x.mode!=='road'&&(!step.id.startsWith('east-')||guideVisibleEastRef(step,x))).map(x=>[x.key||x.id,x])).values());
 const focus=currentGuideLineFocus(step,visibleRefs);
 const active=visibleRefs.map(r=>(EAST_STYLE[r.mode]&&isEastGuideRef(step,r))?({...r,color:EAST_STYLE[r.mode][2],dashed:EAST_STYLE[r.mode][1],dashKm:eastDash(r).km,opacity:1,halfWidth:['review-area','gap-area','section'].includes(r.mode)?1.75:3}):({...r,color:r.mode==='model'?parseInt(GUIDE_MAIN_MODEL_STROKE.slice(1),16):r.mode==='candidate'?0xffb465:r.mode==='owner'?0x79d8f4:r.mode==='band'?0x9ee8cc:0x72faff,dashed:r.mode==='model'||r.mode==='candidate'||r.mode==='band'||r.mode==='owner',dashKm:r.mode==='model'?guideModelDash(r).km:undefined,opacity:names&&!names.includes(r.id)?.53:1,halfWidth:r.mode==='band'?1.65:names&&!names.includes(r.id)?2:3.1})).map(r=>r.id===focus?{...r,halfWidth:r.halfWidth+GUIDE_FOCUS_WIDTH}:r);
 const roads=allGuideSecondary();
 previous.push(...roads.map(f=>({id:f.id,coords:f.geometry.coordinates,color:0xffd467,opacity:.63,halfWidth:1.5})));
 const trail=refs.filter(x=>x.mode==='road'&&step.kind==='travel').map(x=>x.coords);
 map3d.setGuidedRoadPath(trail,{context:[...previous.filter(r=>r.mode!=='road'),...active]});
 $('#map-3d-stage').dataset.guideCurrentLines=active.map(r=>r.id).join(' ');
 $('#map-3d-stage').dataset.guideFocusLine=focus||'';
 $('#map-3d-stage').dataset.guidePriorLines=previous.filter(r=>r.id).map(r=>r.id).join(' ');
}
function guideSafeBox(){
 const m=$('#map-3d-stage').getBoundingClientRect(), panel=$('#guided-tour-panel').getBoundingClientRect();
 const n=$('#guided-reference-dock').getBoundingClientRect(), card=$('#guided-location-card').getBoundingClientRect();
 const deck=$('#chart-deck').getBoundingClientRect();
 const photo=$('#guided-photo-preview').getBoundingClientRect();
 const topbar=$('#v93-tour-topbar')?.getBoundingClientRect();
 const mobTabs=$('#v93-mob-tabs')?.getBoundingClientRect();
 const nav=$('#guided-tour-nav-strip').getBoundingClientRect();
 const portrait=isMobileViewport();
 const top=Math.max(52,(topbar?.height?topbar.bottom+8:62));
 if(portrait){
  const low=(photo.height?[photo,nav]:[mobTabs,panel,deck,n,nav]).filter(q=>q&&q.height>0&&q.top>innerHeight*.30).map(q=>q.top);
  const bottom=Math.max(top+156,(low.length?Math.min(...low)-10:innerHeight-290));
  return {m,panel,n,card,deck,photo,top,bottom};
 }
 const bottom=Math.max(top+220,(nav.height?nav.top-14:innerHeight-82));
 return {m,panel,n,card,deck,photo,top,bottom};
}
// Only the text can move for collision avoidance: the ground dot and start of
// its leader are projected from the geometry onto the same canvas as WebGL.
function guideScreenPoint(coords,lift=.0015){
 if(!Number.isFinite(coords?.[0])||!Number.isFinite(coords?.[1])||!map3d.hasWalkGround(...coords.slice(0,2)))return null;
 return map3d.screenGroundPoint(coords[0],coords[1],lift);
}
const guideSvgNS='http://www.w3.org/2000/svg';
function trimGuideAnchors(group,n){while(group.children.length>n)group.lastElementChild.remove();}
function drawGuideAnchor(group,i,xy,at,color,id){
 let g=group.children[i];
 if(!g){g=document.createElementNS(guideSvgNS,'g');for(const tag of ['line','circle'])g.append(document.createElementNS(guideSvgNS,tag));group.append(g);}
 const rect=group.ownerSVGElement.getBoundingClientRect();
 const x=xy.x-rect.left,y=xy.y-rect.top;
 g.dataset.anchorId=id;
 for(const [el,attrs] of [[g.children[0],{x1:x,y1:y,x2:at?at.x-rect.left:x,y2:at?at.y-rect.top:y,stroke:color}],
   [g.children[1],{cx:x,cy:y,r:3.2,fill:color}]])
   for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
}
function positionGuideLabel(n,host,at,anchor){
 const r=host.getBoundingClientRect();
 n.style.left=(at.x-r.left)+'px';n.style.top=(at.y-r.top)+'px';
 n.dataset.groundX=String(anchor.x);n.dataset.groundY=String(anchor.y);
}
function fitGuideLabel(xy,box,half,hh,blocked,occupied){
 const isBlocked=(x,y,w,h)=>blocked.some(b=>b.width&&x+w>b.left&&x-w<b.right&&y+h>b.top&&y-h<b.bottom);
 if(!xy||xy.x<6||xy.x>innerWidth-6||xy.y<box.top+4||xy.y>box.bottom-4||isBlocked(xy.x,xy.y,3,3))return {at:null,anchor:null};
 const candidates=[[0,-23],[0,23],[0,-45],[0,45]];
 for(const d of [-1,1])for(const y of [-12,12,-34,34,-55,55])candidates.push([d*(half+13),y],[d*(half+27),y]);
 const at=candidates.map(([x,y])=>({x:xy.x+x,y:xy.y+y})).find(({x,y})=>x>half+5&&x<innerWidth-half-5&&y>box.top+hh&&y<box.bottom-hh&&!isBlocked(x,y,half,hh)&&
   !occupied.some(p=>Math.abs(p.x-x)<p.half+half+4&&Math.abs(p.y-y)<p.hh+hh+3));
 if(at)occupied.push({...at,half,hh});
 return {at,anchor:xy};
}
function safeGuideXY(at,box,rad=16,checkCard=true){
 if(!at)return null;
 const pt={x:at.x+box.m.left,y:at.y+box.m.top}, {x,y}=pt;
 const hit=q=>q&&q.width&&x+rad>q.left&&x-rad<q.right&&y+rad>q.top&&y-rad<q.bottom;
 const hitPanel=!isMobileViewport()&&hit(box.panel);
 return x>=rad+5&&x<=innerWidth-rad-5&&y>=box.top+rad&&y<=box.bottom&& !hit(box.n)&&!hit(box.photo)&&!hit(box.deck)&&!hitPanel&&(!checkCard||!hit(box.card)) ? pt:null;
}
function setGuideScriptShown(shown){
 const box=$('#guided-observer-script'), btn=$('#guided-toggle-script');
 if(!shown&&box.contains(document.activeElement))btn.focus({preventScroll:true});
 box.hidden=!shown;btn.setAttribute('aria-expanded',String(shown));btn.textContent=shown?'收起讲稿':'展开讲稿';
 if(!shown)box.scrollTop=0;
}
function clearGuideLocation(){
 $('#guided-four-map').hidden=true;$('#guided-location-card').hidden=true;
 $('#guided-location-card').dataset.step='';
 if(map3d?.camera?.view?.enabled)map3d.camera.clearViewOffset();
}
function renderFourInset(marks){
 const svg=$('#guided-four-inset'), ns='http://www.w3.org/2000/svg';
 function add(host,name,p){const e=document.createElementNS(ns,name);for(const [k,v] of Object.entries(p))e.setAttribute(k,v);host.append(e);return e;}
 const coords=marks.map(m=>m.coord), west=coords[0][0]-.00033,east=coords[3][0]+.00033,mid=coords[0][1];
 const q=([lon,lat])=>[185*(lon-west)/(east-west),39-(lat-mid)*49000];
 const road=provider.analysisById.get('secondary-way-162036946')?.geometry?.coordinates;
 svg.replaceChildren();
 if(Array.isArray(road)){
 const lines=[];
 for(let i=1;i<road.length;i++){
   const [x,y]=q(road[i-1]),[u,v]=q(road[i]);if(Math.max(x,u)>=0&&Math.min(x,u)<=184&&Math.max(y,v)>=0&&Math.min(y,v)<=55)lines.push('M'+x+','+y+'L'+u+','+v);
 }
 add(svg,'path',{d:lines.join(' '),fill:'none',stroke:'#8397a5','stroke-width':2.3,opacity:.75});
 }
 marks.forEach((m,i)=>{
 const [x,y]=q(m.coord),g=add(svg,'g',{'data-num':i+1,transform:'translate('+x+','+y+')'});
 add(g,'circle',{r:8,fill:'#1a2834',stroke:'#a5eefa','stroke-width':1.4});
 const tx=add(g,'text',{'dominant-baseline':'central','text-anchor':'middle'});tx.textContent=i+1;
 });
}
function drawGuideTravelInset(step,coords,inset){
 const list=step.coordinates;
 if(!Array.isArray(list)||list.length<2||!coords)return;
 if(inset.dataset.geom!==step.id){
   const X=list.map(p=>p[0]),Y=list.map(p=>p[1]),w=Math.min(...X),n=Math.max(...Y);
   const dx=Math.max(...X)-w,dy=n-Math.min(...Y),k=Math.min(156/Math.max(1,dx*GUIDE_METERS_PER_DEG_LON),31/Math.max(1,dy*GUIDE_METERS_PER_DEG_LAT));
   const loc=[w,n,92-dx*GUIDE_METERS_PER_DEG_LON*k/2,27-dy*GUIDE_METERS_PER_DEG_LAT*k/2,k];
   inset.dataset.geom=step.id;inset.dataset.loc=JSON.stringify(loc);
   const [a,b,u,v]=loc, q=([x,y])=>[u+(x-a)*GUIDE_METERS_PER_DEG_LON*k,v+(b-y)*GUIDE_METERS_PER_DEG_LAT*k];
   const ns='http://www.w3.org/2000/svg', line=document.createElementNS(ns,'polyline'), dot=document.createElementNS(ns,'circle');
   line.setAttribute('points',list.map(c=>q(c).join(',')).join(' '));line.setAttribute('stroke',guideRoadRoute(guidedTour.route)?'#c7d4de':'#93e9f4');line.setAttribute('fill','none');line.setAttribute('stroke-width','3');
   dot.classList.add('guide-local-anchor');dot.setAttribute('r','4.5');dot.setAttribute('fill','#ecfcff');dot.setAttribute('stroke','#07141f');
   inset.replaceChildren(line,dot);
   inset.setAttribute('aria-label',guideRoadRoute(guidedTour.route)?'当前镜头线路和前方定位，不是水路':'独立可辨段和当前关注位置');
 }
 const [a,b,u,v,k]=JSON.parse(inset.dataset.loc);
 const dot=inset.querySelector('.guide-local-anchor');
 dot.setAttribute('cx',u+(coords[0]-a)*GUIDE_METERS_PER_DEG_LON*k);dot.setAttribute('cy',v+(b-coords[1])*GUIDE_METERS_PER_DEG_LAT*k);
 inset.removeAttribute('hidden');
}
function refreshGuideLocation(step,fraction=0){
 const t=guidedTour, c=$('#guided-location-card'), overlay=$('#guided-four-map'), inset=$('#guided-four-inset');
 if(!t.active||t.observer){overlay.hidden=true;c.hidden=true;trimGuideAnchors($('#guide-four-anchors'),0);return;}
 const mapTarget=$('#guided-nav-target');mapTarget.setAttribute('hidden','');
 if(step.id!=='road-nw-gully')trimGuideAnchors($('#guide-four-anchors'),0);
 if(step.director?.framePoints?.includes('guide-main-lake')){c.hidden=true;overlay.hidden=true;return;}
 if(step.kind==='gap'){c.hidden=true;overlay.hidden=true;inset.setAttribute('hidden','');c.dataset.step='';return;}
 if(guideMeasurements(step).length){c.hidden=true;overlay.hidden=true;c.dataset.step='';return;}
 const marks=step.detail?.spokenPoints?.length&&step.detail.fieldMarks, changed=c.dataset.step!==step.id;

 if(changed){
  $('#guided-nav-map').toggleAttribute('data-field-stop',Boolean(marks));
  c.dataset.step=step.id;delete c.dataset.point;
  inset.toggleAttribute('hidden',!marks);inset.dataset.geom='';overlay.hidden=!marks;
  overlay.replaceChildren();
  if(marks){inset.setAttribute('aria-label','03 道路原标记，1 到 4');renderFourInset(marks);marks.forEach((m,i)=>{const x=document.createElement('span');x.className='guide-mark';x.dataset.num=i+1;x.textContent=i+1;overlay.append(x);});}
 }
 if(marks){
   const time=guideSpokenSeconds();
   const cue=step.detail.spokenPoints.findLast(q=>q.start<=time);
   const {ids}=guideFourProgress(step);
   const i=cue?.point||0, m=i?marks[i-1]:null;
   if(c.dataset.point!==String(i)){
    c.dataset.point=String(i);
    setGuideVisiblePath(step);prepareGuideNavMap(step);
    if(i===4)v74SelectProfile('v74-road03-p4-profile');
    else if(i===2)v74SelectProfile('v74-road03-p2-profile');
    else if(i===1||i===3)v74SelectProfile(guideKMZProfiles[i]);
    $('#guided-location-title').textContent=m?m.title:'03 道路四点 · 位置参照';
    $('#guided-location-note').textContent=i===1||i===3?'现场圆涵点已落图；北侧青线是重复可辨的低带，至各涵口分段。':i===4?'近路窄槽与下部弧槽均已落图；中间低带展宽。':'灰线＝道路；02 北略高、南较低（30 米模型）。';
    for(const el of [...overlay.children,...inset.querySelectorAll('[data-num]')])el.classList.toggle('active',Number(el.dataset.num)===i);
    if($('#guided-photo-preview').hidden)syncGuidePhotoLocation(m?.photoGallery?.[0]?.id);
    directorEvidenceBoard(step,i);
   }
   c.hidden=false;
   for(const el of inset.querySelectorAll('[data-num]'))el.setAttribute('visibility',ids.includes(Number(el.dataset.num))?'visible':'hidden');
   const rect=guideSafeBox(), occupied=[], ground=$('#guide-four-anchors');let rendered=0;
   const blocked=isMobileViewport()&&rect.photo.height?[rect.photo]:[rect.panel,rect.n,rect.card,rect.deck,rect.photo];
   const dots=[...overlay.querySelectorAll('.guide-mark')].sort((a,b)=>Number(b.dataset.num===String(i))-Number(a.dataset.num===String(i)));
   dots.forEach(el=>{
    const k=Number(el.dataset.num)-1;
    const xy=ids.includes(k+1)?guideScreenPoint(guideAnchorPoint('hjn-03-road-pin-0'+(k+1))):null;
    const {at,anchor}=fitGuideLabel(xy,rect,14,14,blocked,occupied);
    el.hidden=!at;
    if(at)positionGuideLabel(el,overlay,at,anchor);
    if(anchor)drawGuideAnchor(ground,rendered++,anchor,at,k+1===i?'#f4c668':'#7cebf8','hjn-03-road-pin-0'+(k+1));
   });
   trimGuideAnchors(ground,rendered);
   return;
 }
 // In a constrained viewport, the stop or the road ahead must either project out of the
 // dock/mini-map or be located by a clearly identified mini-map reference.
 const path=step.cameraTrack, at=step.kind==='travel'&&path?path.position(path.length*Math.min(1,Math.max(0,fraction)+.24)):null;
 const coords=at?[at.lon,at.lat]:step.target;
 if(Array.isArray(coords)){
   const [x,y]=navGuideMapCoords(coords);
   mapTarget.setAttribute('transform','translate('+x+' '+y+')');mapTarget.removeAttribute('hidden');
   if(changed&&!guideReduced())mapTarget.animate([{opacity:.25},{opacity:1},{opacity:.52},{opacity:1}],{duration:660,iterations:1});
 }else mapTarget.setAttribute('hidden','');
 $('#guided-map-pin').hidden=true;
 if(step.kind==='travel')drawGuideTravelInset(step,coords,inset);
 c.hidden=inset.hasAttribute('hidden');
 if(!c.hidden){
   $('#guided-location-title').textContent=step.title;
   $('#guided-location-note').textContent='本段可辨线段；圆点标出当前观察位置。';
 }
}
function nudgePortraitStation(camera,step){
 if(!isMobileViewport()||step.kind!=='station'||!step.target||step.id==='road-nw-gully'||isGuideOverview(step)|| guidedTour.observer)return camera;
 if(safeGuideXY(map3d._projectToScreen(...step.target,.002),guideSafeBox(),18,false))return camera;
 const [lon,lat]=step.target, east=(lon-camera.lon)*GUIDE_METERS_PER_DEG_LON,north=(lat-camera.lat)*GUIDE_METERS_PER_DEG_LAT;
 const d=Math.hypot(east,north), dz=camera.eyeM+(guideGround(camera.lon,camera.lat)-guideGround(lon,lat))*map3d.exag;
 if(!(d>140&&Number.isFinite(dz)&&dz>0))return camera;
 const desired=-Math.atan2(dz,d)*180/Math.PI;
 if(desired < -40)return camera; // retain the landscape instead of a top-down crop
 const aim={...camera,heading:(Math.atan2(east,north)*180/Math.PI+360)%360,pitch:Math.max(-35,Math.min(-5,desired))};
 return aim;
}
function guidePortraitLens(step,desiredFov,fitPoints,verticalBias=0,horizontalBias=0){
 const cam=map3d.camera, t=guidedTour;
 if(!cam)return;
 const wide=isMobileViewport()&&isGuideOverview(step)&&!t.observer;
 const wanted=desiredFov||(wide?57:(t.originalGuideFov||42));
 if(!t.observer&&cam.fov!==wanted){cam.fov=wanted;cam.updateProjectionMatrix();}
 if(t.observer||!(map3d.width>0&&map3d.height>0)){
   if(cam.view?.enabled)cam.clearViewOffset();return;
 }
 const box=guideSafeBox();
 if(!isMobileViewport()){
   if(!guideNorthFrame.has(step.id)&&!fitPoints.length&&box.panel.width){
     const ox=-Math.round(Math.min(map3d.width*.14,box.panel.right*.28));
     const oy=Math.round(map3d.height*.50-(box.top+box.bottom)*.48);
     if(cam.view?.offsetX!==ox||cam.view?.offsetY!==oy||cam.view?.width!==map3d.width||cam.view?.height!==map3d.height)
      cam.setViewOffset(map3d.width,map3d.height,ox,oy,map3d.width,map3d.height);
   }else if(cam.view?.enabled)cam.clearViewOffset();
   return;
 }
 const y=Math.max(108,(box.top+box.bottom)*.5);
 const off=Math.round(Math.max(-map3d.height*.12,Math.min(map3d.height*.26,map3d.height*.50-y))+verticalBias*map3d.height);
 const ox=Math.round(horizontalBias*map3d.width);
 if(cam.view?.offsetX!==ox||cam.view?.offsetY!==off||cam.view?.width!==map3d.width||cam.view?.height!==map3d.height)
  cam.setViewOffset(map3d.width,map3d.height,ox,off,map3d.width,map3d.height);
}
function updateGuidePin(){
 $('#guided-map-pin').hidden=true;
}

const tourStatusLabels={field_reference:'现场参照',reference:'道路或地标参照',observed:'影像可见地貌',candidate:'待核线索',gap:'证据缺口',image_label:'历史影像文件标记',modeled:'地形模型情景',model_candidate:'地形候选剖面'};
function renderRouteDetail(step){
 const view=$('#guided-tour-route-details');
 if(view.dataset.step===step.id)return;
 view.dataset.step=step.id;
 const title=step.detail?.title?.trim()||'';
 const rows=(Array.isArray(step.detail?.sides)?step.detail.sides:[]).filter(x=>typeof x==='string'&&x.trim());
 const chart=$('#guided-tour-route-chart'), chartId=step.detail?.chart;
 const linked=Boolean(chartId&&getProfileData(chartId));
 chart.hidden=!linked;
 chart.removeAttribute('href');
 chart.textContent=linked?'展开本站原剖面':'';
 if(linked)chart.href='?'+new URLSearchParams({view:'main',tray:'profile',prof:chartId});
 view.hidden=!rows.length&&!linked;view.open=false;
 $('#guided-tour-route-summary').textContent=view.hidden?'':title||'本站证据与剖面';
 const body=$('#guided-tour-route-body');
 body.hidden=!rows.length;
 body.replaceChildren(...rows.map(text=>{
    const item=document.createElement('li');item.textContent=text;return item;
 }));
}
function readObserverChoices(step){
 const d=$('#guided-observer-choices');
 if(d.dataset.step===step.id)return;
 d.dataset.step=step.id;
 const views=(guidedTour.observerRecords||[]).filter(row=>row.title&&row.steps?.includes(step.id));
 d.hidden=!views.length;
 d.open=false;
 $('#guided-observer-buttons').replaceChildren(...views.map(row=>{
  const b=document.createElement('button');
  b.className='deck-btn';b.type='button';b.dataset.observerView=String(row.id);
  b.textContent=row.title;b.title=row.note||'对照机位';
  return b;
 }));
}
function showGuideFieldMarks(step){
 const d=$('#guided-field-marks');
 if(d.dataset.step===step.id)return;
 d.dataset.step=step.id;d.open=false;
 const marks=step.detail?.fieldMarks||[];
 d.hidden=!marks.length;
 $('#guided-field-buttons').replaceChildren(...marks.map(mark=>{
  const b=document.createElement('button');b.className='deck-btn';b.type='button';b.dataset.guideFieldMark=mark.id;
  b.textContent=mark.title;b.title=mark.classification;
  return b;
 }));
}
function openGuideFieldMark(id){
 const t=guidedTour, step=guideStep(), m=step?.detail?.fieldMarks?.find(x=>x.id===id);
 const f=m&&provider.analysisById.get(m.id);
 const coords=f?.geometry?.coordinates;
 if(!t.active||!m||f?.geometry?.type!=='Point'||!coords.every((v,i)=>v===m.coord[i]))return;
 cancelGuideHandoff();holdGuidedTour();setGuidePhoto(false);setGuideCameraManual(false);
 if(!t.observer)t.observer={
  fixed:fixedHistory.active,fixedWanted:fixedHistory.wanted,fixedZone:fixedHistory.preferredZone,
  fixedNote:$('#fixed-history-note')?.textContent||'',from:document.activeElement,fov:map3d.camera?.fov
 };
 t.observer.id=id;t.observer.fieldMark=m;clearGuideLocation();
 const number=Number(id.match(/(\d+)$/)?.[1]);
 if(guideKMZProfiles[number])v74SelectProfile(guideKMZProfiles[number]);
 const token=++t.token, head=m.heading, rad=head*Math.PI/180;
 let lon=coords[0]-Math.sin(rad)*570/GUIDE_METERS_PER_DEG_LON,lat=coords[1]-Math.cos(rad)*570/GUIDE_METERS_PER_DEG_LAT;
 if(!map3d.hasWalkGround(lon,lat)){[lon,lat]=coords;}
 const camera={lon,lat,heading:head,pitch:-17,eyeM:245,site:'field-mark'};
 map3d.setTerrainWalkPose(camera,null);t.observer.basePose={...camera};t.observer.baseFov=map3d.camera?.fov;t.cameraPose=camera;moveGuideNavMap(camera);
 $('#guided-observer-active').hidden=false;$('#guided-observer-rotate').hidden=true;
 $('#guided-observer-label').textContent=m.title+' · 原标记位置';
 $('#guided-tour-play').disabled=true;
 const el=$('#guided-map-pin');el.hidden=true;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(t.token!==token||!t.observer)return;
   const at=map3d._projectToScreen(...coords,.002);
   if(!at||at.x<0||at.x>innerWidth||at.y<80||at.y>innerHeight-120)return;
   el.textContent=m.title;
   el.style.left=at.x+'px';el.style.top=at.y+'px';el.hidden=false;
 }));
 readTourHUD('现场位置与照片单独查看；不播放原站讲解。');
 $('#guided-observer-return').focus({preventScroll:true});
}
function setGuideObserverCompact(value){
 const t=guidedTour,compact=Boolean(t.observer&&value);
 $('#guided-tour-panel').classList.toggle('guided-observer-compact',compact);
 $('#observatory').classList.toggle('is-observer-compact',compact);
 const control=$('#guided-observer-fold');
 control.textContent=compact?'展开讲稿':'收起讲稿';
 control.setAttribute('aria-expanded',String(!compact));
}
async function openGuideObserver(id){
 const t=guidedTour,step=guideStep(),row=(t.observerRecords||[]).find(r=>r.id===id&&r.steps?.includes(step?.id));
 if(!t.active||!row)return;
 const p=row.record.camera;
 if(!map3d.hasWalkGround(p.lon,p.lat))return;
 cancelGuideHandoff();holdGuidedTour();setGuidePhoto(false);setGuideCameraManual(false);
 if(!t.observer) t.observer={
   fixed:fixedHistory.active,fixedWanted:fixedHistory.wanted,fixedZone:fixedHistory.preferredZone,
   fixedNote:$('#fixed-history-note')?.textContent||'',from:document.activeElement,fov:map3d.camera?.fov
 };
 const token=++t.token;
 t.observer.id=row.id; t.observer.fieldMark=null;clearGuideLocation();
 $('#guided-observer-rotate').hidden=row.id!==7;
 map3d.setNativeDetail(null);
 const camera={lon:p.lon,lat:p.lat,heading:p.heading,pitch:p.pitch,eyeM:p.eyeM,site:'observed-view'};
 if(map3d.camera){map3d.camera.fov=p.fov;map3d.camera.updateProjectionMatrix();}
 map3d.setTerrainWalkPose(camera,null);t.observer.basePose={...camera};t.observer.baseFov=map3d.camera?.fov;t.cameraPose=camera;moveGuideNavMap(camera);
 $('#guided-map-pin').hidden=true;
 $('#guided-observer-active').hidden=false;
 const meta=row.displayImagery;
 $('#guided-observer-label').textContent=row.title+' · 离地 '+p.eyeM.toFixed(0)+' m · '+(meta.fileLabel||meta.acquisitionDate||'日期未核');
 $('#guided-tour-play').disabled=true;
 readTourHUD(row.note+' 对照时暂停原站语音；底图文件标记与水面月份各自独立。');
 $('#guided-observer-return').focus({preventScroll:true});
 if(meta.id!==fixedHistory.active?.id){
  const ok=await fixedHistory.openScene?.(meta.id);
  if(t.active&&t.token===token&&!ok)readTourHUD('对照机位已定位；对应底图未载入。');
 }
}
function closeGuideObserver({restorePosition=true,focus=true}={}){
 const t=guidedTour,saved=t.observer;
 if(!saved)return;
 t.observer=null;++t.token;
 setGuideCameraManual(false);
 setGuideObserverCompact(false);
 $('#guided-observer-rotate').hidden=true;
 $('#guided-observer-active').hidden=true;
 $('#guided-tour-play').disabled=false;
 restoreGuidedImagery(saved);
 if(map3d.camera&&Number.isFinite(saved.fov)){map3d.camera.fov=saved.fov;map3d.camera.updateProjectionMatrix();}
 if(restorePosition&&guideStep()){
   const step=guideStep();
   showTourPose(step,step.duration?t.elapsed/step.duration:0);
   readTourHUD();
 }
 if(focus&&saved.from?.isConnected)saved.from.focus({preventScroll:true});
}
function readGuideHistory(step){
 const panel=$('#guided-history-review');
 if(panel.dataset.step===step.id)return;
 panel.dataset.step=step.id;panel.hidden=!step.historyCard;panel.open=false;
}
const FIELD_BANDS_STOP='runoff-field-bands-05';
const FIELD_BANDS_CREDIT='2015-07：Google Earth / Image © 2026 CNES / Airbus。2021-07：Google Earth / Image © 2026 Maxar Technologies / Image Landsat / Copernicus。';
const FIELD_BANDS_MEDIA=[
 {src:'./guide-reference/field-bands-2021-04.jpg',title:'2021-04 · 田间深色弯带',caption:'Google Earth · Image © 2026 Maxar Technologies。2021 年 4 月为原文件标记，具体拍摄日未核实。这张影像只用于辨认沟形；颜色深不等于有水，也不能据此确认融雪径流。'},
 ...['2015-07','2021-07'].map((date,i)=>({src:'./guide-reference/field-bands-'+date+'.jpg',title:date+' · 同一处弯折',pairIndex:2-i,caption:'两期完整画幅用于找同一处弯折。日期按原文件标记；色差不能证明沟里有水。'+FIELD_BANDS_CREDIT}))
];
function updateOpeningCue(step){
 const cue=guideOpeningCue(step);if(!cue)return;
 const host=$('#guided-director-board'), ids=cue.anchorIds||[], key=String(cue.startMs??cue.at??0);
 if(host.dataset.openingCue===key)return;
 host.dataset.openingCue=key;renderGuideInset(step);setGuideVisiblePath(step);prepareGuideNavMap(step);
 $('#guided-board-focus').textContent=cue.focus||step.director.focus;
 $('#guided-board-note').textContent=cue.note||step.director.note;
 $('#guided-opening-line').textContent=cue.text||'';$('#guided-opening-line').hidden=false;
 $$('#guided-map-inset [data-anchor-id]').forEach(n=>{
   const id=n.dataset.anchorId, include=ids.includes(id)||(id==='guide-03'&&ids.some(i=>i.startsWith('hjn-03-road-pin-')));
   n.classList.toggle('guide-opening-focus',include);if(n.tagName.toLowerCase()==='polyline')n.classList.toggle('guide-opening-line',include);
 });
}
function preferredGuideMedia(step,mark){
 const items=guidePhotoItems(mark||step);
 return items.length?{items}:null;
}
function directorEvidenceBoard(step,point=0){
 $('#guide-landscape-open').hidden=!['chapter-opening','runoff-main-entrance-context','lake-office-caution','chapter-closing'].includes(step.id);
 const d=step.director,root=$('#guided-director-board'),mb=$('#guided-board-media');
 if(!d){root.hidden=true;return;}
 root.hidden=false;
 const mark=step.detail?.fieldMarks?.[point-1], key=step.id+':'+point;
 if(root.dataset.cue===key)return;
 root.dataset.cue=key;delete root.dataset.openingCue;
 $('#guided-board-kind').textContent=d.kind;
 $('#guided-board-focus').textContent=mark?mark.title:d.focus;
 $('#guided-board-note').textContent=mark?'讲解：由东向西，4 → 1；保留原编号。相机标记不是涵洞口。':d.note;
 mb.replaceChildren();
 const rows=[];
 if(step.id===FIELD_BANDS_STOP){
   for(const [i,label] of [[0,'2021-04 · 看暗带与沟形'],[1,'两张 7 月影像 · 并排对照']]){
     rows.push({src:FIELD_BANDS_MEDIA[i].src,label,action:()=>setGuidePhoto(true,{focus:true,items:FIELD_BANDS_MEDIA,start:i})});
   }
 }
 if(step.id==='runoff-bridge'||step.id==='road-round'||mark){
   const source=mark||step, photo=guidePhotoItems(source)[0];
   if(photo)rows.push({src:fieldPhotoThumb(photo.id),label:step.id==='runoff-bridge'?'桥牌 · 定位':step.id==='road-round'?'管口与透光 · 原图局部':'原现场照片',action:()=>setGuidePhoto(true,{source,focus:true})});
 }
 for(const row of rows){const b=document.createElement('button'),im=document.createElement('img'),c=document.createElement('small');
  b.type='button';b.onclick=row.action;b.setAttribute('aria-label','展开：'+row.label);
  im.src=row.src;im.alt='';im.decoding='async';c.textContent=row.label;const frame=document.createElement('span');frame.className='guide-board-frame';frame.append(im);b.append(frame,c);mb.append(b);}
 mb.hidden=!rows.length;
 // Phone keeps the map + narration visible; its existing 原图 tab opens the same gallery.
 const media=!isMobileViewport()&&!guidedTour.observer?preferredGuideMedia(step,mark):null;
 if(media)setGuidePhoto(true,media);
 else if(!$('#guided-photo-preview').hidden)setGuidePhoto(false);
 root.dataset.layout=rows.length&&!['runoff-shore-separate','chapter-opening'].includes(step.id)?'picture':'map';root.dataset.step=step.id;
 $('#observatory').dataset.guideEvidence=step.kind;
}
function waitGuideFrame(ms){
 return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,ms))));
}
function readTourHUD(note=''){
 const t=guidedTour, s=guideStep();
 if(!s)return;
 readObserverChoices(s);showGuideFieldMarks(s);readGuideHistory(s);renderEastGuideControls(s);
 directorEvidenceBoard(s,Number($('#guided-location-card').dataset.point)||0);
 renderRouteDetail(s);
 const sides=$('#guided-sides-caption');
 sides.hidden=!s.detail?.features?.length;
 sides.textContent=sides.hidden?'':'西侧地表较高　｜　'+(s.id==='runoff-bridge'?'桥位':'道路')+'　｜　东侧地表较低';
 const mark=t.observer?.fieldMark;
 $('#guided-tour-title').textContent=mark?.title||s.title;
 $('#guided-tour-caption').textContent=mark?.note||s.body;
 const nwFoot=$('#nw-guide-context');
 if(!isGuideOpening(s))$('#guided-opening-line').hidden=true;
 const nwText=s.id==='runoff-main-entrance-context'?'同屏回看中桥、03 道路、东部泥沼、东池与西长湖候选；南侧分区从下一站起显示。':
 s.id==='lake-office-caution'?'合看已讲过的水路和主湖分区，不代表实测分流。':
 NW_UP.has(s.id)?'灰蓝面：两处桥西候选上游范围；桥口接续按原证据分段。':
 s.id==='lake-west'?'白色点线：落在 E18 内的沟段。主湖 E18 原边界和面积保留。':
 s.id==='east-marsh-source'?'这一站只显示泥沼低地；下一站再显示东池。':
 NW_EAST.has(s.id)&&guideVisitStage(s,'east-pool-source')>=0?'泥沼低地与东池分别显示；没有把中间缺口补成通水线。':'';
 nwFoot.textContent=mark||!nwForGuide(s).length?'':nwText;
 nwFoot.hidden=!nwFoot.textContent;
 const screenHost=$('#guide-catchment-screen');
 if(SCREEN_REACHES.has(s.id)||[...CATCHMENT_SCREEN.keys()].some(k=>t.extraLayers?.has(k)))renderCatchmentScreen(screenHost,t.extraLayers,true);
 else if(screenHost)screenHost.hidden=true;
 $('#guided-tour-source').textContent=mark?(mark.source+' · '+mark.classification):(tourStatusLabels[s.status]||'已登记证据')+' · '+s.source+(currentGuideCatchment(s)?'｜黄色半透明面＝模型汇水分区。':'')+((isGuideSouth(s)||guideRoadRoute(t.route)&&s.id!=='road-nw-gully')?'｜黄线＝OSM 道路；不是水线。青色和紫色区分影像沟形与模型候选。':'');
 const section=t.book.indexOf(t.route);
 const total=t.book.reduce((n,b)=>n+b.steps.length,0);
 const current=t.book.slice(0,section).reduce((n,b)=>n+b.steps.length,0)+t.index+1;
 $('#guided-tour-progress').textContent='全章 '+current+'/'+total;
 $('#guided-tour-chapter-status').textContent='第 '+(section+1)+'/'+t.book.length+' 段 · '+t.route.title;
 const play=$('#guided-tour-play');
 play.textContent=guideWantsPlayback(t)?'暂停':t.elapsed>0?'继续播放':'开始连播';
 const next=$('#guided-tour-next');
 next.textContent=guideFollowing(1)?'下一站':'返回地图';
 next.title=guideFollowing(1)?.step.title||'全章结束，返回普通地图';
 $('#guided-tour-prev').disabled=section===0&&t.index===0;
 const phase=$('#guided-tour-phase');
 const status=note||guideProgressNote(s)||(isGuideOverview(s)?'全景暂隐月度水面叠层，便于辨认湖形与周边地形。':guideReduced()?'减少动态效果：本站保持定位。':s.kind==='station'?'本站保持固定视角。':'同段按画面平滑行进；观察点互不推断连通。');
 if(phase.textContent!==status)phase.textContent=status;
 $('#guided-tour-elevation').textContent=(s.kind==='gap'?'固定斜视 · 白色标尺只量端点直距':(Number.isFinite(t.cameraPose?.guideOriginM)?'镜头高于边缘参考地面 ':'镜头离地 ')+Math.round(t.cameraPose?.eyeM||s.eyeM)+' m · 地形 '+guidedScale(t.route)+'×（垂向夸张）');
 const photo=$('#guided-tour-photo'), link=$('#guided-tour-photo-link'), book=guidePhotoItems(mark||s), src=fieldPhotoThumb(book[0]?.id);
 $('#guided-photo-trigger-text').textContent=book.length>1?'看 '+book.length+' 张现场照':'放大现场照片';
 link.hidden=!src||['runoff-bridge','road-round'].includes(s.id);
 if(src){if(photo.getAttribute('src')!==src)photo.src=src;photo.alt='本段归档现场照片，点击同页放大';}
 else {photo.removeAttribute('src');}
 v93NotifySync();
}
function fieldPhotoThumb(fid){
 const m=/^field-photo-(\d{4})$/.exec(fid||'');
 return m&&["2007","2008","2017","2018","2020","2022","2028","2031"].includes(m[1])?'./field-photo-thumbs/'+fid+'.jpg':null;
}
function holdGuidedTour(){
 const t=guidedTour;t.playing=false;t.stamp=0;++t.playEpoch;t.endSince=null;
 if(t.frame)cancelAnimationFrame(t.frame);
 t.frame=0;t.voice?.pause();
}
function navGuideMapCoords([x,y]){
 const b=provider.dem.bounds_wgs84;
 return [4+146*(x-b[0])/(b[2]-b[0]),5+90*(b[3]-y)/(b[3]-b[1])];
}
function prepareGuideNavMap(step=guideStep()){
 const grp=$('#guided-nav-base');
 const svg=grp.ownerSVGElement;
 grp.replaceChildren();
 const paths=(coords,style,closed=false)=>{
  if(!Array.isArray(coords)||coords.length<2)return;
  const node=document.createElementNS('http://www.w3.org/2000/svg',closed?'polygon':'polyline');
  node.setAttribute('points',coords.map(p=>navGuideMapCoords(p).map(n=>n.toFixed(2)).join(',')).join(' '));
  for(const [key,val] of Object.entries(style))node.setAttribute(key,val);
  grp.append(node);
 };
 const windowFeatures=state.waterMonth?.lakes?.MAIN?.boundary?.features||[];
 for(const f of windowFeatures){
   const g=f.geometry;
   if(!g)continue;
   const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
   for(const poly of polys)paths(poly[0],{fill:'#365e7b',stroke:'#a4cce9','stroke-width':.8},true);
 }
 if(!step)return;
 const active=activeCatchmentScreen(guidedTour.extraLayers);
 const network=nwForGuide(step);
 const fills=[...network.filter(f=>f.geometry.type.includes('Polygon')),...(active&&active!==NW_NETWORK ?
   (provider.analysis?.features||[]).filter(f=>f.properties?.layer===active&&f.geometry.type.includes('Polygon')) : [guideCatchmentFeature(step)].filter(Boolean))];
 for(const f of fills)for(const poly of f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates){
   const node=document.createElementNS('http://www.w3.org/2000/svg','path');
   node.setAttribute('d',poly.map(ring=>'M'+ring.map(p=>navGuideMapCoords(p).map(n=>n.toFixed(2)).join(',')).join(' L')+' Z').join(' '));
   for(const [k,v] of Object.entries({fill:f.properties.layer===NW_NETWORK?getFeatureVisualSpec(f).stroke:active?'#c69de1':'#f4d378','fill-opacity':.26,'fill-rule':'evenodd',stroke:f.properties.layer===NW_NETWORK?getFeatureVisualSpec(f).stroke:active?'#c69de1':'#f4d378','stroke-width':1,'data-catchment-id':f.id}))node.setAttribute(k,v);
   grp.append(node);
 }
 for(const ref of guidePriorRefs(step))paths(ref.coords,{fill:'none',stroke:guideEastModelIds.has(ref.id)?eastModelStroke:ref.mode==='model'?GUIDE_MAIN_MODEL_STROKE:'#8cb8c7','stroke-dasharray':guideEastModelIds.has(ref.id)?eastDash(ref).svg:ref.mode==='model'?guideModelDash(ref).svg:'none','stroke-width':guideEastModelIds.has(ref.id)?1.5:1,'stroke-opacity':guideEastModelIds.has(ref.id)?.86:.52,'data-prior-evidence':ref.id});
 for(const r of (guidedTour.contextPaths||[]))paths(r.coords,{fill:'none',stroke:'#ef757a','stroke-width':1.4,'stroke-opacity':.8,'data-national-road':r.id});
 for(const f of allGuideSecondary())paths(f.geometry.coordinates,{fill:'none',stroke:'#f8d374','stroke-width':1,'stroke-opacity':.72,'data-actual-road':f.id});
 for(const ref of guideStepLineRefs(step).filter(r=>!step.id.startsWith('east-')||guideVisibleEastRef(step,r)))paths(ref.coords,{fill:'none',stroke:guideInsetStroke(step,ref),'stroke-dasharray':guideDashStyle(step,ref),'stroke-width':1.5,'stroke-opacity':1,'data-current-evidence':ref.id});
 for(const f of network.filter(f=>f.geometry.type.includes('LineString'))){
   const spec=getFeatureVisualSpec(f);
   const parts=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;
   for(const coords of parts)paths(coords,{fill:'none',stroke:spec.stroke,'stroke-dasharray':spec.dash?.map(n=>n*.55).join(' ')||'none','stroke-width':f.properties.group==='overlap'?2:1.35,'data-network-line':f.id});
 }
 for(const r of guidePointRefs(step)){
   const [cx,cy]=navGuideMapCoords(r.point), node=document.createElementNS('http://www.w3.org/2000/svg','circle');
   node.setAttribute('cx',cx);node.setAttribute('cy',cy);node.setAttribute('r',r.current?2.8:1.7);node.setAttribute('fill',guideLabelTone(r.id)||(r.current?'#e5f9fb':'#a7c7d6'));node.setAttribute('stroke','#142333');node.dataset.placeTone=guideLabelTone(r.id)||'';node.setAttribute('data-place-id',r.id);node.dataset.placeLabel=r.label;node.dataset.placeCurrent=String(Boolean(r.current));grp.append(node);
 }
 svg.dispatchEvent(new Event('hjn-reference-content'));
}
function moveGuideNavMap(camera){
 const [px,py]=navGuideMapCoords([camera.lon,camera.lat]);
 const el=$('#guided-nav-marker');
 el.setAttribute('transform','translate('+px.toFixed(2)+' '+py.toFixed(2)+') rotate('+camera.heading.toFixed(1)+')');
 el.dataset.lon=String(camera.lon);el.dataset.lat=String(camera.lat);el.dataset.heading=String(camera.heading);
}
const guideSplineHeights=new WeakMap();
const guideGround=(lon,lat)=>sampleDemElevation(provider.dem,lon,lat);
function applyPortraitPhotoLift(){
 const t=guidedTour, cam=map3d.camera,w=map3d.width,h=map3d.height;
 if(!isMobileViewport()||!cam||!w||!h)return;
 const pane=$('#guided-photo-preview'),b=pane.getBoundingClientRect();
 const lift=pane.hidden?0:Math.round(Math.min(h*.15,Math.max(0,(h*.67-b.top)*.53)));
 const delta=lift-(t.portraitPhotoLift||0);
 if(!delta)return;
 const old=cam.view?.enabled?cam.view:null;
 const x=old?.offsetX??0,y=(old?.offsetY??0)+delta;
 if(!x&&!y)cam.clearViewOffset();else cam.setViewOffset(w,h,x,y,w,h);
 t.portraitPhotoLift=lift;
 map3d._invalidate();
}
function blendPortraitPose(a,b,t){
 if(t<=0)return {...a};if(t>=1)return {...b};
 const q=blendGuidePose(a,b,t);
 const datum=p=>p.guideOriginM??(map3d.hasWalkGround(p.lon,p.lat)?guideGround(p.lon,p.lat):null);
 const z1=datum(a),z2=datum(b);
 if(Number.isFinite(z1)&&Number.isFinite(z2))q.guideOriginM=z1+(z2-z1)*t;
 q.site='guided';
 q.portraitOffset=[0,1].map(i=>(a.portraitOffset?.[i]??0)*(1-t)+(b.portraitOffset?.[i]??0)*t);
 return q;
}
// Interpolate altitude in the scene's datum, staying just above the real
// terrain. Ease in/out smoothly and take the shorter heading arc at north.
function blendPortraitHandoff(a,b,t){
 const p=blendPortraitPose(a,b,t);
 if(t<=0||t>=1)return p;
 const ground=map3d.hasWalkGround(p.lon,p.lat)?guideGround(p.lon,p.lat):null;
 if(Number.isFinite(ground)&&Number.isFinite(p.guideOriginM))
   p.eyeM=Math.max(p.eyeM,(ground-p.guideOriginM)*map3d.exag+8);
 return p;
}
function phoneRecordedPose(id,seconds){
 const pair=portraitGuidePair(id,seconds);
 return pair?blendPortraitPose(...pair):null;
}
const guideDistance=(a,b)=>Math.hypot((a[0]-b[0])*GUIDE_METERS_PER_DEG_LON,(a[1]-b[1])*GUIDE_METERS_PER_DEG_LAT);
function stationGuideCamera(step,p,scenic){
 const steer=step.camera||{};
 if(step.id==='road-nw-gully'){
   const a=step.detail.fieldMarks[0].coord,b=step.detail.fieldMarks[3].coord;
   const lon=(a[0]+b[0])/2,lat=(a[1]+b[1])/2;
   const cameraLat=lat-(isMobileViewport()?.0104:.0082);
   const drop=318+(guideGround(lon,cameraLat)-guideGround(lon,lat))*map3d.exag;
   if(map3d.hasWalkGround(lon,cameraLat))return {...p,lon,lat:cameraLat,heading:0,pitch:-Math.atan2(Math.max(140,drop),GUIDE_METERS_PER_DEG_LAT*(lat-cameraLat))*180/Math.PI,eyeM:318};
 }

 const recorded=guidedTour.observerRecords?.find(r=>r.id===steer.observerId)?.record?.camera;
 const exact=steer.absolute||recorded;
 if(exact&&[exact.lon,exact.lat,exact.heading,exact.pitch,exact.eyeM].every(Number.isFinite)&&map3d.hasWalkGround(exact.lon,exact.lat))
  return {...p,lon:exact.lon,lat:exact.lat,heading:exact.heading,pitch:exact.pitch,eyeM:exact.eyeM};
 const heading=Number.isFinite(steer.heading)?steer.heading:p.heading;
 const rad=heading*Math.PI/180,look=steer.lookCenter;
 const pitch=p.pitch, back=steer.standOffM??(p.eyeM/Math.tan(-pitch*Math.PI/180));
 const aimLon=look?.[0]??p.lon;
 const aimLat=look?.[1]??(p.lat-(isGuideOverview(step)?(isMobileViewport()?.014:.007)
   :step.detail?.features?.length?(isMobileViewport()?.0014:.00082):0));
 const lon=aimLon-Math.sin(rad)*back/GUIDE_METERS_PER_DEG_LON;
 const lat=Math.max(provider.dem.bounds_wgs84[1]+.001, aimLat-Math.cos(rad)*back/GUIDE_METERS_PER_DEG_LAT);
 if(!map3d.hasWalkGround(lon,lat))return {...p,heading,pitch:scenic?-24:-76};
 if(steer.landscape||steer.standOffM) return {...p,lon,lat,heading,pitch};
 const depth=Math.hypot((lon-aimLon)*GUIDE_METERS_PER_DEG_LON,(lat-aimLat)*GUIDE_METERS_PER_DEG_LAT);
 const drop=p.eyeM+(guideGround(lon,lat)-guideGround(aimLon,aimLat))*map3d.exag;
 return {...p,lon,lat,heading,pitch:-Math.atan2(Math.max(.65*p.eyeM,drop),depth)*180/Math.PI};
}
const ROAD_ENTRY_END=.24;
const ROAD_EXIT_START=.75;
const roadTravelProgress=(fraction,hasJoins)=>hasJoins
 ?Math.max(0,Math.min(1,(fraction-ROAD_ENTRY_END)/(ROAD_EXIT_START-ROAD_ENTRY_END)))
 :fraction;
const GUIDE_ROAD_ENDPOINTS=Object.freeze({
 'road-c-approach':['road-b-southeast','road-c-south-central'],
 'road-round-approach':['road-c-south-central','road-round']
});
// Lens variants for portrait screens. The authored desktop poses stay unchanged.
const PORTRAIT_GUIDE_SHOTS=Object.freeze({
 'chapter-opening':{wide:20,shift:0},
 'runoff-upper-slope':{wide:12,shift:.035},
 'runoff-main-entrance-context':{wide:24,shift:.025},
 'road-b-southeast':{wide:34,shift:.105,pan:-.18},
 'road-c-south-central':{wide:34,shift:.105,pan:-.18},
 'road-round':{wide:12,shift:0},
});
const portraitShot=id=>PORTRAIT_GUIDE_SHOTS[id]??{wide:guideNorthFrame.has(id)?20:12,shift:0};
const portraitFov=(id,fov)=>Math.min(88,(fov??42)+portraitShot(id).wide);
const GUIDE_LENS_LIMIT=60;
function distanceMatchedGuideLens(p,wide,natural=GUIDE_LENS_LIMIT){
 if(!Number.isFinite(wide)||wide<=natural)return p;
 const angle=(p.pitch??-22)*Math.PI/180, head=p.heading*Math.PI/180;
 const datum=p.guideOriginM??guideGround(p.lon,p.lat);
 const ratio=Math.tan(wide*Math.PI/360)/Math.tan(natural*Math.PI/360);
 const depth=Math.max(80,Math.min(11000,p.eyeM/Math.max(.20,-Math.sin(angle))));
 const back=depth*(ratio-1);
 const b=provider.dem?.bounds_wgs84;
 if(!Number.isFinite(datum)||!b)return {...p,directorFov:natural};
 for(const scale of [1,.72,.45,0]){
   const d=back*scale, horizontal=d*Math.cos(angle);
   const lon=p.lon-Math.sin(head)*horizontal/GUIDE_METERS_PER_DEG_LON;
   const lat=p.lat-Math.cos(head)*horizontal/GUIDE_METERS_PER_DEG_LAT;
   const ground=guideGround(lon,lat);
   if(lon<b[0]-.12||lon>b[2]+.12||lat<b[1]-.07||lat>b[3]+.07)continue;
   if(!Number.isFinite(ground)&&p.site!=='guided')continue;
   const ref=Number.isFinite(ground)?ground:datum;
   const eyeM=p.eyeM-d*Math.sin(angle)+(datum-ref)*map3d.exag;
   if(eyeM<10)continue;
   return {...p,lon,lat,eyeM,guideOriginM:Number.isFinite(ground)?undefined:ref,directorFov:natural};
 }
 return {...p,directorFov:natural};
}
function portraitShift(step,fraction,axis){
 const pair=GUIDE_ROAD_ENDPOINTS[step.id];
 const value=id=>portraitShot(id)[axis]??0;
 if(!pair)return value(step.id);
 if(fraction<=ROAD_ENTRY_END)return value(pair[0])*(1-easeGuide(fraction/ROAD_ENTRY_END));
 if(fraction>=ROAD_EXIT_START)return value(pair[1])*easeGuide((fraction-ROAD_EXIT_START)/(1-ROAD_EXIT_START));
 return 0;
}
function moveGuideCamera(step,fraction,p,road){
 const track=step.cameraTrack;
 if(!track)return p;
 const joins=GUIDE_ROAD_ENDPOINTS[step.id];
 const lane=roadTravelProgress(fraction,joins);
 const eased=road?softenedTravelProgress(lane):Math.max(0,Math.min(1,lane));
 const m=track.length*eased, xyz=track.position(m);
 if(!map3d.hasWalkGround(xyz.lon,xyz.lat))return p;
 if(!guideSplineHeights.has(step)){
   const low=step.id==='road-nw-approach';
   guideSplineHeights.set(step,buildCinematicHeightProfile(track,guideGround,{scale:8,eyeM:low?40:p.eyeM,clearanceM:low?34:road?76:125}));
 }
 const z=guideGround(xyz.lon,xyz.lat), modeledEye=guideSplineHeights.get(step)?.(m,z)??p.eyeM;
 const eyeM=step.id==='road-nw-approach'?Math.min(48,modeledEye):modeledEye;
 let camera={...p,...xyz,eyeM,pitch:road?-9.5:p.pitch};
 if(joins){
   const [entryId,exitId]=joins;
   const at=id=>{
     const mobile=isMobileViewport()?phoneRecordedPose(id,0):null;
     if(mobile)return {...p,...mobile};
     const q=recordedGuidePose(id,0);
     return {...p,...q,directorFov:isMobileViewport()?portraitFov(id,q.directorFov):q.directorFov};
   };
   camera.directorFov=isMobileViewport()?51:42;
   const moveBetween=(from,to,w)=>{
     if(isMobileViewport()){
       const box=guideSafeBox(), h=map3d.height;
       const offset=Math.max(-.12,Math.min(.26,.50-Math.max(108,(box.top+box.bottom)*.5)/h));
       const fill=p=>({...p,portraitOffset:p.portraitOffset??[0,offset]});
       return blendPortraitPose(fill(from),fill(to),w);
     }
     const q=blendGuidePose(from,to,w);
     if(w>0&&w<1){
       const alt=p=>guideGround(p.lon,p.lat)*map3d.exag+p.eyeM;
       const surface=guideGround(q.lon,q.lat);
       if(Number.isFinite(surface))q.eyeM=Math.max(28,alt(from)+(alt(to)-alt(from))*w-surface*map3d.exag);
     }
     return q;
   };
   if(fraction<=ROAD_ENTRY_END)return moveBetween(at(entryId),camera,easeGuide(fraction/ROAD_ENTRY_END));
   if(fraction>=ROAD_EXIT_START)return moveBetween(camera,at(exitId),easeGuide((fraction-ROAD_EXIT_START)/(1-ROAD_EXIT_START)));
 }
 return camera;
}
function showTourPose(step,fraction){
 const p=sampleGuidedTour(step,fraction)||{site:'guided'};
 if(!Number.isFinite(p.lon)&&!guideMeasurements(step).length)return true;
 const road=guideRoadRoute(guidedTour.route);
 const scenic=road||step.id==='runoff-bridge'||Boolean(step.camera?.landscape);
 if(isGuideOverview(step))p.eyeM = Math.round(p.eyeM*Math.max(1,1.02*innerHeight/innerWidth));
 const seconds=guideSpokenSeconds();
 const phone=isMobileViewport();
 const authored=phone?phoneRecordedPose(step.id,seconds):desktopRecordedGuidePose(step.id);
 const recorded=authored||(step.id==='chapter-opening'?OPENING_NW_POSE:recordedGuidePose(step.id,seconds));
 const linkedRoad=Object.hasOwn(GUIDE_ROAD_ENDPOINTS,step.id);
 const lead=authored?null:recordedTravelLead(step.id,fraction);
 const framePoints=recorded||lead||linkedRoad||guideNorthFrame.has(step.id)?[]:guideFitPoints(step);
 let camera=recorded?{...p,...recorded}:guideFocusCamera(step,p,framePoints)??(step.kind==='station'?stationGuideCamera(step,p,scenic)
    : step.kind==='travel'?moveGuideCamera(step,fraction,p,road):p);
 if(lead)camera=blendGuidePose({...camera,...lead.start},{...camera,directorFov:camera.directorFov??42},lead.weight);

 if((recorded||lead)&&phone&&!authored)camera.directorFov=portraitFov(step.id,camera.directorFov);
 if(authored&&step.id==='road-nw-approach'&&step.cameraTrack){
   const track=step.cameraTrack, start=track.position(0), hold=1.3/Math.max(1,step.duration);
   const end=track.position(track.length*softenedTravelProgress(Math.max(0,Math.min(1,(fraction-hold)/(1-hold)))));
   const lon=authored.lon+end.lon-start.lon,lat=authored.lat+end.lat-start.lat;
   if(map3d.hasWalkGround(lon,lat))camera={...camera,lon,lat};
 }

 if(guidedTour.manualCamera){
   if(phone)applyPortraitPhotoLift();
   if(!$('#guided-photo-preview').hidden)syncGuidePhotoLocation(guidedTour.photoBook?.[guidedTour.photoIndex]?.id);
   guidedTour.pose={...p,eyeM:guidedTour.cameraPose?.eyeM,pitch:guidedTour.cameraPose?.pitch};
   refreshGuideLocation(step,fraction);showGuideMeasures(step);updateArchivedGuideMarkers(step);updateOpeningCue(step);
   return true;
 }
 if(!Number.isFinite(camera.lon))return true;
 const glide=guidedTour.poseHandoff;
 if(glide?.to===step.id){
    const now=performance.now();
    glide.elapsed=(glide.elapsed||0)+Math.max(0,Math.min(105,now-(glide.last??now)));
    glide.last=now;
    const u=Math.min(1,glide.elapsed/(glide.duration||850)), f=easeGuide(u);
    if(u===1)guidedTour.poseHandoff=null;
    if(glide.destination)camera=(glide.portraitItinerary||glide.desktopGlide)
      ?blendPortraitHandoff(glide.from,glide.destination,u*u*u*(10+u*(-15+6*u)))
      :blendPortraitPose(glide.from,glide.destination,f);
    else if(u<1){
      const from=glide.from;
      camera=blendGuidePose(from,camera,f);
      if(!map3d.hasWalkGround(camera.lon,camera.lat))camera.guideOriginM??=from.guideOriginM;
    }
 }
 if(!glide?.destination&&!recorded&&!framePoints.length&&step.director?.tiltLift)camera={...camera,pitch:camera.pitch+step.director.tiltLift};
 camera=distanceMatchedGuideLens(camera,camera.directorFov);
 if(!map3d.setTerrainWalkPose(camera,null))return false;
 guidedTour.portraitPhotoLift=0;
 const customView=phone||glide?.destination?camera.portraitOffset:camera.desktopOffset;
 const verticalBias=phone?portraitShift(step,fraction,'shift'):0;
 const horizontalBias=isMobileViewport()?portraitShift(step,fraction,'pan'):0;
 if(customView){
   const w=map3d.width,h=map3d.height,cam=map3d.camera;
   const x=Math.round(w*customView[0]),y=Math.round(h*customView[1]), changed=cam.fov!==camera.directorFov;
   cam.fov=camera.directorFov;
   if(changed||cam.view?.offsetX!==x||cam.view?.offsetY!==y||cam.view?.width!==w||cam.view?.height!==h)
     cam.setViewOffset(w,h,x,y,w,h);
 }else guidePortraitLens(step,camera.directorFov,framePoints,verticalBias,horizontalBias);
 if(!customView&&(recorded||lead||linkedRoad)&&!isMobileViewport()&&map3d.camera.view?.enabled)map3d.camera.clearViewOffset();
 if(!customView&&guideNorthFrame.has(step.id)&&!['road-b-southeast','road-c-south-central'].includes(step.id)){
   const cam=map3d.camera,w=map3d.width,h=map3d.height;
   const box=guideSafeBox();
   if(isMobileViewport()){
     const middle=(box.top+box.bottom)*.5-box.m.top;
     const shift=Math.round(h*(.50+verticalBias)-middle);
     if(cam.view?.offsetX!==0||cam.view?.offsetY!==shift||cam.view?.width!==w||cam.view?.height!==h)cam.setViewOffset(w,h,0,shift,w,h);
   }else if(cam.view?.enabled){cam.clearViewOffset();}
 }
 map3d._updateCameraAndCompass();
 const fitted=customView||recorded||lead||framePoints.length?camera:nudgePortraitStation(camera,step);
 if(fitted!==camera&&map3d.setTerrainWalkPose(fitted,null)){camera=fitted;map3d._updateCameraAndCompass();}
 // Keep the approved world-space camera, but fit the measured endpoints to the narrow display.
 const portraitMeasures=phone&&!customView?guideMeasurements(step).flatMap(([,a,b])=>[a,b]):[];
 const guideFitted=portraitMeasures.length?portraitMeasures:framePoints;
 if(camera.directorFov&&map3d.camera.fov!==camera.directorFov){map3d.camera.fov=camera.directorFov;map3d.camera.updateProjectionMatrix();}
 if(!customView&&guideFitted.length&&!guidedTour.observer){
   const cam=map3d.camera,w=map3d.width,h=map3d.height,box=guideSafeBox();
   const portrait=isMobileViewport();
   const isMeasure=guideMeasurements(step).length>0;
   const safeTop=isMeasure?Math.max(box.top,portrait?68:96):box.top+10;
   const profileBlocking=!portrait&&box.deck?.height>40&&$('#observatory').classList.contains('v74-tour-profile-open');
   const safeBottom=Math.max(safeTop+108,profileBlocking?Math.min(box.bottom,box.deck.top-16):box.bottom-10);
   const leftEdge=portrait?Math.round(w*.10):Math.max(Math.round(w*.12),box.panel.width&&!$('#guided-tour-panel').classList.contains('v74-custom-panel')?Math.round(box.panel.right-box.m.left)+24:0);
   const rightEdge=!portrait&&box.n.width?Math.min(Math.round(w*.95),Math.max(leftEdge+w*.38,Math.round(box.n.left-box.m.left)-20)):Math.round(w*(portrait?.90:.95));
   const safeWidth=Math.max(w*.40,rightEdge-leftEdge);
   const safeHeight=Math.max(80,safeBottom-safeTop-36);
   const getProj=()=>guideFitted.map(q=>map3d._projectToScreen(...q,.008)).filter(Boolean);
   const stats=pts=>{const b=k=>[Math.min(...pts.map(q=>q[k])),Math.max(...pts.map(q=>q[k]))];return [...b('x'),...b('y')];};
   let proj=getProj();
   if(proj.length){
    let [x0,x1,y0,y1]=stats(proj);
    const ratio=Math.max((x1-x0)/safeWidth,(y1-y0)/safeHeight);
    if(ratio>1.012){
      const framing=Math.min(86,2*Math.atan(Math.tan(cam.fov*Math.PI/360)*ratio*1.06)*180/Math.PI);
      const limit=step.id==='lake-west'?54:GUIDE_LENS_LIMIT;
      const target=distanceMatchedGuideLens(camera,framing,limit);
      if(target!==camera&&map3d.setTerrainWalkPose(target,null)){camera=target;map3d._updateCameraAndCompass();}
      cam.fov=Math.min(limit,framing);cam.updateProjectionMatrix();
      proj=getProj();[x0,x1,y0,y1]=stats(proj);
    }
    const wideBasin=['chapter-opening','chapter-closing','runoff-main-entrance-context'].includes(step.id);
    const sx=wideBasin&&!portrait?Math.min((leftEdge+rightEdge)*.5,w*.57):(leftEdge+rightEdge)*.5;
    const sy=(safeTop+safeBottom)*.5-box.m.top;
    const oldX=cam.view?.enabled?cam.view.offsetX:0,oldY=cam.view?.enabled?cam.view.offsetY:0;
    const rawX=Math.round(oldX+(x0+x1)*.5-sx),rawY=Math.round(oldY+(y0+y1)*.5-sy);
    const x=wideBasin&&!portrait?Math.max(-Math.round(w*.13),Math.min(Math.round(w*.13),rawX)):rawX;
    const y=rawY;
    if(x!==oldX||y!==oldY)cam.setViewOffset(w,h,x,y,w,h);
    camera={...camera,directorFov:cam.fov};
    const final=getProj();
    if(final.length)$('#map-3d-stage').dataset.guideFit=stats(final).map(v=>Math.round(v)).join(',');

   }
 }
 if(phone)applyPortraitPhotoLift();
 if(!$('#guided-photo-preview').hidden)syncGuidePhotoLocation(guidedTour.photoBook?.[guidedTour.photoIndex]?.id);
 showGuideMeasures(step);
 moveGuideNavMap(camera);
 guidedTour.pose={...p,eyeM:camera.eyeM,pitch:camera.pitch};
 guidedTour.cameraPose={...camera};
 $('#map-3d-stage').dataset.guideCamera=[camera.heading,camera.pitch,map3d.camera.fov,camera.lon,camera.lat].map(x=>Number(x.toFixed(4))).join(',');
 updateGuidePin(step,p);
 refreshGuideLocation(step,fraction);updateArchivedGuideMarkers(step);updateOpeningCue(step);
 if(guideRoadRoute(guidedTour.route)){
   const real=sampleDemElevation(provider.dem,p.lon,p.lat);
   const done=step.kind==='travel'?softenedTravelProgress(roadTravelProgress(fraction,GUIDE_ROAD_ENDPOINTS[step.id]))*step.length:0;
   const offset=step.distanceOriginM||0;
   const at=' · 本段道路里程 '+((offset+done*(step.distanceDirection||1))/1000).toFixed(2)+' km';
   const label=Number.isFinite(real)?'脚下地表高程约 '+Math.round(real)+' m'+at+'（30 m DEM，非路面测量）':'';
   const el=$('#guided-tour-ground');if(el.textContent!==label)el.textContent=label;
 }
 return true;
}
function prepareTourStep(i){
 const t=guidedTour;
 if(!t.active||!t.route.steps[i])return;
 if(!$('#guided-photo-preview').hidden)setGuidePhoto(false);
 holdGuidedTour();t.voice?.removeAttribute('src');t.voice?.load();t.voice=null;t.audioFailed=false;
 t.index=i;t.elapsed=0;t.readyStep=false;t.endSince=null;
 $('#guided-tour-panel .guided-tour-scroll').scrollTop=0;
 const s=guideStep(), token=++t.token;
 $('#guided-kmz-profiles').hidden=!['road-nw-gully','kmz-north-to-crossings'].includes(s.id);
 delete t.v74Point;
 $('#observatory').classList.toggle('guide-catchment-stop',Boolean(GUIDE_CATCHMENTS[s.id]));
 v74SelectProfile(GUIDE_CATCHMENTS[s.id]&&isMobileViewport()?null:v74StopProfiles[s.id]);
 ++fixedHistory.request; fixedHistory.controller?.abort();
 $('#guided-tour-ground').textContent='';
 map3d.setExaggeration(guidedScale(t.route));
 if(!t.poseHandoff&&!showTourPose(s,0)){readTourHUD('这处超出本机有效地形，镜头未移动。');return;}
 const photoIsOpen=!$('#guided-photo-preview').hidden;
 if(photoIsOpen)syncGuidePhotoLocation(t.photoBook?.[t.photoIndex]?.id);
 else if(!s.detail?.spokenPoints)syncGuidePhotoLocation(guidePhotoItems(s)[0]?.id);
 readTourHUD();syncMapsState();setGuideVisiblePath(s);renderGuideInset(s);prepareGuideNavMap(s);delete $('#guided-director-board').dataset.openingCue;updateOpeningCue(s);if(s.kind==='gap')updateArchivedGuideMarkers(s);
 requestAnimationFrame(()=>{if(t.active&&t.token===token&&!t.playing&&!t.observer&&!t.poseHandoff)showTourPose(s,0);});
 if(s.kind==='gap'){for(const n of ['guided-map-pin','guided-location-card','guided-four-map'])document.getElementById(n).hidden=true;$('#guided-nav-target').setAttribute('hidden','');}
 // The public edition has only approved online imagery, not the local Google Earth archive.
 state.basemap=publicEsri?ESRI_PUBLIC_ID:PUBLIC_GUIDE_BASEMAP;
 updateHeaderPills();
 state.timelineBasemapStatus=null;
 if(fixedHistory.wanted)fixedHistory.disable();
 if(!publicEsriAdaptive)map3d?.setNativeDetail(null);
 readTourHUD();
 syncMapsState();
}
function frameGuidedTour(now){
 const t=guidedTour,s=guideStep();
 t.frame=0;if(!t.active||!t.playing||!s)return;
 if(!t.stamp)t.stamp=now;
 t.elapsed+=Math.min(.14,(now-t.stamp)/1000);t.stamp=now;
 const reduced=guideReduced();
 if(!reduced&&!showTourPose(s,s.duration?t.elapsed/s.duration:0)){
   holdGuidedTour();readTourHUD('超出可用地形。本段已暂停。');return;
 }
 if(reduced){refreshGuideLocation(s);updateArchivedGuideMarkers(s);updateOpeningCue(s);showGuideMeasures(s);}
 const clipDone=!t.voice||t.audioFailed||t.voice.ended||!$('#guided-tour-voice').checked;
 if(!clipDone)t.endSince=null;
 if(t.elapsed>=Math.max(s.duration,s.kind==='gap'?5:0)&&clipDone){
    t.endSince??=now;
    if(now-t.endSince<(s.kind==='gap'?1100:820)){t.frame=requestAnimationFrame(frameGuidedTour);return;}
    if(!guideFollowing(1)){
      holdGuidedTour();readTourHUD('全章播完。上一站可回看；或返回地图。');return;
    }
    moveGuidedChapter(1,{resume:true});
    return;
 }
 t.frame=requestAnimationFrame(frameGuidedTour);
}
async function playGuidedTour(){
 const t=guidedTour,s=guideStep();
 if(t.poseHandoff){t.poseHandoff.resume=true;return;}
 if(!t.active||t.playing||t.handoff||t.observer||!s)return;
 const token=t.token, run=++t.playEpoch;
 t.playing=true;readTourHUD(t.readyStep?'':'先定位本段画面…');
 if(!t.readyStep){
   const proof=[...$('#guided-board-media').querySelectorAll('img')];
   if(proof.length)await Promise.race([Promise.allSettled(proof.map(x=>x.decode())),new Promise(r=>setTimeout(r,1800))]);
   await waitGuideFrame(s.kind==='travel'?470:620);
   if(token!==t.token||run!==t.playEpoch||!t.active||!t.playing)return;
   t.readyStep=true;readTourHUD();
 }
 if($('#guided-tour-voice').checked&&t.audioManifest?.[s.id]){
   if(!t.voice){
     t.voice=new Audio(`./guided-tour-audio/${s.id}.wav?v=${t.audioManifest[s.id].sha256.slice(0,12)}`);
     for(const evt of ['timeupdate','seeking','seeked','pause','play'])t.voice.addEventListener(evt,()=>{if(t.active&&t.token===token&&(s.detail?.spokenPoints||s.director?.cues)){if(!t.playing&&s.director?.cues)showTourPose(s,0);else{refreshGuideLocation(s);updateArchivedGuideMarkers(s);updateOpeningCue(s);}}});
     t.voice.addEventListener('error',()=>{if(token===t.token){t.audioFailed=true;readTourHUD('语音不可用，继续显示文字。');}},{once:true});
   }
   t.voice.play().catch(()=>{if(token===t.token){t.audioFailed=true;readTourHUD('语音不可用，继续显示文字。');}});
 }
 if(!t.frame)t.frame=requestAnimationFrame(frameGuidedTour);
}
function setGuidedDateControls(active){
 const t=guidedTour;
 if(active){
   t.scopeLocks=new Map();
   const controls=$$('#btn-basemap-pop,#pill-water-month,#btn-scope-pop,#focus-scope-bar button,#btn-export-menu,#btn-open-walk, [data-guide-launch]');
   for(const ctrl of controls){
     if(!(ctrl instanceof HTMLButtonElement))continue;
     t.scopeLocks.set(ctrl,ctrl.disabled);ctrl.disabled=true;
   }
   for(const id of ['basemap-popover','scope-popover','export-menu'])closePopover(document.getElementById(id));
 }else{
   for(const [node,disabled] of t.scopeLocks||[])node.disabled=disabled;
   t.scopeLocks=null;
 }
}
function closeGuidedTour({lost=false,stay3d=false}={}){
 const guideOptions=$('#guide-play-toggles');
 if(guideOptions.matches(':popover-open'))guideOptions.hidePopover();
 const t=guidedTour;if(!t.active)return;
 cancelGuideHandoff();
 closeGuideObserver({restorePosition:false,focus:false});
 holdGuidedTour();t.voice=null;++t.token;t.active=false;setGuideCameraManual(false);if(map3d.camera&&t.originalGuideFov){map3d.camera.fov=t.originalGuideFov;map3d.camera.updateProjectionMatrix();}updateArchivedGuideMarkers(null);clearGuideLocation();$('#guided-director-board').dataset.cue='';syncGuidePhotoLocation(null);setGuideScriptShown(true);
 map3d?.setNativeDetail(null);
 showGuideMeasures(null);
 v74SelectProfile(null);
 if(t.v74SavedChart){const c=t.v74SavedChart;state.bottomTab=c.tab;state.activeProfileId=c.id;state.profileCursorIdx=c.idx;renderChartDeck();setDeckExpanded(c.expanded);t.v74SavedChart=null;}
 setGuidePhoto(false);
 for(const n of ['guided-map-pin'])document.getElementById(n).hidden=true;
 setGuidedDateControls(false);
 const saved=t.saved;
 if(publicEsri&&saved.publicFallback){
   state.basemap=ESRI_PUBLIC_ID;state.timelineBasemapStatus=null;
 }
 restoreGuidedImagery(saved);updateHeaderPills();syncMapsState();
 try{map3d.leaveTerrainWalk();}catch{}
 $('#guided-tour-panel').hidden=true;
 $('#guided-tour-nav-strip').hidden=true;
 $('#guided-nav-map').hidden=true;
 setTourReferenceDock(false);
 $('#observatory')?.classList.remove('guided-tour-active','guide-catchment-stop');delete $('#observatory').dataset.guideEvidence;
 v93NotifySync();
 if(!lost&&!stay3d&&!saved.view3d){
   setDimension('2d');map2d.flyTo({...saved.focus2d,duration:0,exactFocus:true});
 }
 if(!lost&&!stay3d&&saved.trigger?.isConnected)saved.trigger.focus({preventScroll:true});
 updateLayoutOffsets();
}
function restoreGuidedImagery(saved){
 ++fixedHistory.request;fixedHistory.controller?.abort();
 if(fixedHistory.active!==saved.fixed||fixedHistory.wanted!==saved.fixedWanted){
   fixedHistory.active=saved.fixed;fixedHistory.wanted=saved.fixedWanted;fixedHistory.preferredZone=saved.fixedZone;
   const clear=$('#fixed-history-clear'); if(clear)clear.disabled=!saved.fixedWanted;
   const note=$('#fixed-history-note');if(note)note.textContent=saved.fixedNote;
   updateHeaderPills();syncMapsState();
 }
}
function openGuidedTour(trigger,stepId){
 const t=guidedTour;
 if(t.active||!t.book.length)return;
 if(walkMode.active)closeTerrainWalk();
 if(!map3d||map3d.failed){$('#guided-tour-unavailable').hidden=false;return;}
 t.saved={publicFallback:[ESRI_PUBLIC_ID,PUBLIC_GUIDE_BASEMAP].includes(state.basemap)&&!state.timelineBasemapStatus,view3d:state.view3d,focus2d:{...map2d.getCameraFocus(),pixelsPerMeter:map2d.getCameraScale()},fixed:fixedHistory.active,fixedWanted:fixedHistory.wanted,
  fixedZone:fixedHistory.preferredZone,fixedNote:$('#fixed-history-note')?.textContent||'',trigger};
 if(state.studioOpen)closeStudioDrawer();
 const tools=$('#export-menu');if(tools){tools.hidden=true;$('#btn-export-menu')?.setAttribute('aria-expanded','false');}
 hideInspectorSurface();stopPlay();

 setDimension('3d');
 if(!map3d.enterTerrainWalk())return;
 t.active=true;void startPublicEsri();t.eastHidden=new Map();delete $('#guided-east-legend').dataset.step;$('#guided-east-legend').open=false;t.route=null;t.pose=null;t.cameraPose=null;setGuideCameraManual(false);t.originalGuideFov=map3d.camera.fov;t.manualScriptChoice=false;
 setGuideScriptShown(true);
 t.contours=true;t.contourInterval=contourInterval;t.extraLayers=new Set();applyGuideContourChoice();
 t.v74SavedChart={tab:state.bottomTab,id:state.activeProfileId,idx:state.profileCursorIdx,expanded:state.deckExpanded};
 setGuidedDateControls(true);
 $('#guided-tour-select').value=t.book[0].id;
 $('#guided-tour-panel').hidden=false;
 $('#guided-tour-nav-strip').hidden=false;
 $('#guided-nav-map').hidden=false;
 setTourReferenceDock(true);
 $('#observatory')?.classList.add('guided-tour-active');
 map3d.resize();
 $('#guided-tour-voice').checked=Boolean(t.audioManifest);
 $('#guided-tour-voice').disabled=!t.audioManifest;
 const route=stepId?t.book.find(r=>r.steps.some(s=>s.id===stepId)):null;
 setGuidedRoute(route||t.book[0],route?route.steps.findIndex(s=>s.id===stepId):0);$('#guided-tour-play').focus({preventScroll:true});
}
function setGuidedRoute(route,index=0){
 const t=guidedTour;
 closeGuideObserver({restorePosition:false,focus:false});
 // Keep the current imagery until the next frame's tiles are decoded.
 t.route=route;
 $('#guided-tour-select').value=route.id;
 prepareTourStep(index);
}

function setGuideCameraManual(on){
 if(on&&guidedTour.poseHandoff){
   const resume=guidedTour.poseHandoff.resume;
   guidedTour.poseHandoff=null;
   if(resume)queueMicrotask(()=>void playGuidedTour());
 }
 guidedTour.manualCamera=on;
 const b=$('#guided-camera-follow');
 if(!b)return;
 b.setAttribute('aria-pressed',String(!on));
 b.textContent=on?(guidedTour.observer?'回到观测机位':'回到导览镜头'):'跟随镜头';
}
function followGuideCamera(){
 const t=guidedTour,s=guideStep();if(!t.active||!s)return;
 if(t.observer){
   const q=t.observer.basePose;if(!q)return;
   setGuideCameraManual(false);
   if(Number.isFinite(t.observer.baseFov)){map3d.camera.fov=t.observer.baseFov;map3d.camera.updateProjectionMatrix();}
   map3d.setTerrainWalkPose(q,null);map3d._updateCameraAndCompass();t.cameraPose=q;moveGuideNavMap(q);
   readTourHUD('已回到观测机位。');return;
 }
 setGuideCameraManual(false);
 showTourPose(s,s.duration?t.elapsed/s.duration:0);
 readTourHUD('已回到当前导览镜头。');
}
function wireGuideCameraInput(){
 const host=$('#map-3d-stage'),t=guidedTour, points=new Map();
 const allowed=()=>t.active&&t.cameraPose;
 const limit=(v,a,b)=>Math.min(b,Math.max(a,v));
 const wrap=v=>((v%360)+360)%360;
 let dollyDepth=null;
 const dolly=(p,delta)=>{
   const angle=(p.pitch??-22)*Math.PI/180, head=p.heading*Math.PI/180;
   const ref=p.guideOriginM??guideGround(p.lon,p.lat);
   if(!Number.isFinite(ref))return p;
   const depth=dollyDepth??limit(p.eyeM/Math.max(.12,-Math.sin(angle)),60,19000);
   const target=limit(depth*Math.exp(delta),25,45000);
   const candidate=t=>{
     const d=(target-depth)*t, h=d*Math.cos(angle);
     const lon=p.lon-Math.sin(head)*h/GUIDE_METERS_PER_DEG_LON;
     const lat=p.lat-Math.cos(head)*h/GUIDE_METERS_PER_DEG_LAT;
     if(!map3d.hasAerialFramingRoom(lon,lat))return null;
     const local=guideGround(lon,lat), outside=!map3d.hasWalkGround(lon,lat);
     const datum=outside?ref:local;
     const eyeM=p.eyeM-d*Math.sin(angle)+(ref-datum)*map3d.exag;
     if(!Number.isFinite(eyeM)||eyeM<8||eyeM>42000)return null;
     return {...p,lon,lat,eyeM,guideOriginM:outside?datum:undefined,outsideTerrain:outside,framingDepthM:depth+d};
   };
   let q=candidate(1);
   if(!q){let lo=0,hi=1;for(let i=0;i<12;i++){
     const mid=(lo+hi)/2, valid=candidate(mid);
     if(valid){lo=mid;q=valid;}else hi=mid;
   }}
   return q??p;
 };
 const captureCamera=()=>{
  const current=t.cameraPose;if(!current)return null;
  if(!t.manualCamera){
   t.manualFov=map3d.camera.fov;
   dollyDepth=null;
   setGuideCameraManual(true);
   readTourHUD(t.observer?'可自由调整观察角度；复位可重看原机位。':'自由看地形，讲解继续。可点「回到导览镜头」。');
  }
  return current;
 };
 const move=(dx,dy,kind)=>{
  const p=captureCamera();if(!p)return;
  let q={...p};
  if(kind!=='zoom')dollyDepth=null;
  if(kind==='zoom')q=dolly(p,dy);
  else if(kind==='height'){q.eyeM=limit(p.eyeM+dy,8,42000);}
  else if(kind==='look'){q.heading=wrap(p.heading+dx*.22);q.pitch=limit(p.pitch-dy*.2,-82,70);}
  else {
   const a=p.heading*Math.PI/180, meters=Math.max(.34,p.eyeM*.0029);
   const sideways=kind==='pan'?-dx*meters:0, forward=kind==='pan'?dy*meters:0;
   const lon=p.lon+(Math.cos(a)*sideways+Math.sin(a)*forward)/GUIDE_METERS_PER_DEG_LON;
   const lat=p.lat+(-Math.sin(a)*sideways+Math.cos(a)*forward)/GUIDE_METERS_PER_DEG_LAT;
   if(kind==='pan')q=manualAerialPosition(p,{...p,lon,lat});
  }
  if(!map3d.setTerrainWalkPose(q,null))return;
  if(kind==='zoom')dollyDepth=q.framingDepthM??null;
  const cam=map3d.camera;
  if(cam.fov!==t.manualFov){cam.fov=t.manualFov;cam.updateProjectionMatrix();}
  map3d._updateCameraAndCompass();t.cameraPose=q;moveGuideNavMap(q);
  const s=guideStep();if(s){refreshGuideLocation(s);updateArchivedGuideMarkers(s);showGuideMeasures(s);updateOpeningCue(s);}
  if(q.outsideTerrain&&!p.outsideTerrain)readTourHUD('取景已越过地形数据边缘；范围外无地形，镜头高度参照边缘。');
  if(p.outsideTerrain&&!q.outsideTerrain)readTourHUD('已回到地形数据范围；可继续自由查看。');
 };
 $('#guide-play-toggles').addEventListener('click',e=>{
   const b=e.target.closest('[data-guide-camera-adjust]');
   if(!b||!allowed())return;
   const [kind,value]=b.dataset.guideCameraAdjust.split(':');
   if(kind==='reset')followGuideCamera();else move(0,Number(value),kind);
 });
 const guideKeyMotion={
   KeyW:[0,36,'pan'],KeyS:[0,-36,'pan'],KeyA:[36,0,'pan'],KeyD:[-36,0,'pan'],
   KeyQ:[0,-10,'height'],KeyE:[0,10,'height'],
   BracketLeft:[0,-10,'height'],BracketRight:[0,10,'height'],
 };
 window.addEventListener('keydown',e=>{
   const motion=guideKeyMotion[e.code];
   if(!motion||!allowed()||e.altKey||e.ctrlKey||e.metaKey||
      e.target?.closest?.('input, textarea, select, [contenteditable], .v83-photo-frame.is-lens'))return;
   const [x,y,kind]=motion,boost=e.shiftKey?3:1;
   e.preventDefault();move(x*boost,y*boost,kind);
 },{capture:true});
 $('#guided-camera-follow').onclick=()=>{if(t.manualCamera)followGuideCamera();else if(allowed())captureCamera();};
 host.addEventListener('contextmenu',e=>{if(allowed())e.preventDefault();});
 host.addEventListener('wheel',e=>{
  if(!allowed()||!e.target.closest('canvas'))return;
  e.preventDefault();
  const unit=e.deltaMode===1?16:e.deltaMode===2?200:1;
  if(e.deltaY)move(0,limit(e.deltaY*unit*.0014,-.28,.28),'zoom');
 },{passive:false});
 host.addEventListener('pointerdown',e=>{
  if(!allowed()||!e.target.closest('canvas')||![0,1,2].includes(e.button))return;
  points.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:e.button!==0||e.shiftKey});
  host.setPointerCapture(e.pointerId);
 });
 host.addEventListener('pointermove',e=>{
  const p=points.get(e.pointerId);if(!p||!allowed())return;
  const x=e.clientX,y=e.clientY,dx=x-p.x,dy=y-p.y;
  const other=[...points].find(([id])=>id!==e.pointerId)?.[1];
  if(Math.hypot(dx,dy)<(t.manualCamera?1:4))return;
  if(other){
   const before=Math.hypot(p.x-other.x,p.y-other.y), after=Math.hypot(x-other.x,y-other.y);
   if(before>10&&after>10&&Math.abs(after-before)>.6)move(0,Math.log(before/after),'zoom');
   move(dx*.5,dy*.5,'pan');
  }else move(dx,dy,p.pan||e.shiftKey?'pan':'look');
  p.x=x;p.y=y;
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(event,e=>points.delete(e.pointerId));
 const root=$('#observatory');
 new MutationObserver(()=>{if(!t.active)points.clear();}).observe(root,{attributes:true,attributeFilter:['class']});
}

function setTourReferenceDock(active){
 const dock=$('#guided-reference-dock'),credit=$('#fixed-history-credit');
 const slot=active?$('#guided-credit-slot'):document.querySelector('#hud-top-left .hud-meta-pills');
 slot.append(credit);dock.hidden=!active;
 if(active){
   $('#guided-reference-credit').open=false;
   $('#guide-map-overview').click();
 }
}
function wireGuideReferenceTabs(){
 const pane=$('#guided-map-pane'), local=$('#guided-location-card'), fine=$('#guided-map-inset'), whole=$('#guide-map-overview'), here=$('#guide-map-local');
 const available=()=>!local.hidden||(!fine.hasAttribute('hidden')&&fine.childElementCount>0);
 const select=view=>{
   const show=view==='local'&&available();
   pane.dataset.view=show?'local':'overview';
   whole.setAttribute('aria-pressed',String(!show));here.setAttribute('aria-pressed',String(show));
 };
 whole.onclick=()=>select('overview');here.onclick=()=>select('local');
 const sync=()=>{here.disabled=!available();if(here.disabled&&pane.dataset.view==='local')select('overview');};
 const observer=new MutationObserver(sync);
 observer.observe(local,{attributes:true,attributeFilter:['hidden']});
 observer.observe(fine,{attributes:true,attributeFilter:['hidden'],childList:true});
 sync();
 $('#guided-kmz-profiles').onclick=e=>{
   const button=e.target.closest('[data-guide-kmz-profile]');
   if(button)v74SelectProfile(guideKMZProfiles[button.dataset.guideKmzProfile]);
 };
}
function wireGuidedTour(){
 wireGuideReferenceTabs();wireReferenceZoom();
 let pendingFit=0;
 window.addEventListener('hjn-v74-panel-change',()=>{cancelAnimationFrame(pendingFit);pendingFit=requestAnimationFrame(()=>{
  const s=guideStep();if(guidedTour.active&&s&&!guidedTour.playing&&!guidedTour.observer&&!guidedTour.manualCamera){showTourPose(s,s.duration?guidedTour.elapsed/s.duration:0);}
 });});
 wireGuideCameraInput();
 const t=guidedTour,p=$('#guided-tour-select');
 p.replaceChildren(...t.book.map(r=>new Option(r.title,r.id)));
 const btn=$('#btn-open-guided-tour');btn.disabled=!t.book.length;btn.onclick=()=>openGuidedTour($('#btn-export-menu'));
 for(const launch of $$('#btn-guide-chapter-one,[data-guide-launch]')){launch.disabled=!t.book.length;launch.onclick=()=>openGuidedTour(launch);}
 p.onchange=()=>{const route=t.book.find(r=>r.id===p.value);if(route){if(!isMobileViewport()&&route!==t.route)moveGuidedChapter(1,{resume:false,destination:{route,index:0,step:route.steps[0]}});else{cancelGuideHandoff();setGuidedRoute(route);}}};
 $('#guided-tour-close').onclick=()=>closeGuidedTour();
 $('#guided-observer-return').onclick=()=>closeGuideObserver();
 $('#guided-observer-fold').onclick=e=>setGuideObserverCompact(e.currentTarget.getAttribute('aria-expanded')==='true');
 $('#guided-field-buttons').onclick=e=>{const b=e.target.closest('button[data-guide-field-mark]');if(b)openGuideFieldMark(b.dataset.guideFieldMark);};
 $('#guided-observer-buttons').onclick=e=>{const b=e.target.closest('button[data-observer-view]');if(b)void openGuideObserver(Number(b.dataset.observerView));};
 $('#guided-tour-photo-link').onclick=()=>setGuidePhoto($('#guided-photo-preview').hidden,{focus:true});
 $('#guided-photo-close').onclick=()=>setGuidePhoto(false,{focus:true});
 const guideOptions=$('#guide-play-toggles');
 guideOptions.addEventListener('beforetoggle',event=>{
   if(event.newState!=='open')return;
   const r=$('#guided-play-options').getBoundingClientRect();
   const strip=$('#guided-tour-nav-strip').getBoundingClientRect();
   guideOptions.style.setProperty('--guide-options-right',Math.round(innerWidth-r.right)+'px');
   guideOptions.style.setProperty('--guide-options-bottom',Math.round(innerHeight-strip.top+6)+'px');
 });
 $('#guided-photo-prev').onclick=()=>selectGuidePhoto(t.photoIndex-1);
 $('#guided-photo-next').onclick=()=>selectGuidePhoto(t.photoIndex+1);
 $('#guided-photo-thumbs').onclick=e=>{const b=e.target.closest('button[data-guide-photo-index]');if(b)selectGuidePhoto(Number(b.dataset.guidePhotoIndex));};
 $('#guided-photo-preview').addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();selectGuidePhoto(t.photoIndex+(e.key==='ArrowLeft'?-1:1));}
 });

 $('#guided-tour-contours').onchange=e=>setContoursEnabled(e.target.checked);
 $('#guided-tour-prev').onclick=()=>moveGuidedChapter(-1);
 $('#guided-tour-next').onclick=()=>moveGuidedChapter(1);
 window.addEventListener('resize',()=>requestAnimationFrame(()=>{const s=guideStep();if(guidedTour.active&&!guidedTour.observer&&!guidedTour.playing&&!guidedTour.poseHandoff&&s)showTourPose(s,s.duration?guidedTour.elapsed/s.duration:0);}));
 $('#guided-toggle-script').onclick=()=>{t.manualScriptChoice=true;const d=$('#guided-observer-script');setGuideScriptShown(d.hidden);const s=guideStep();if(s&&!guidedTour.playing&&!guidedTour.observer)requestAnimationFrame(()=>showTourPose(s,s.duration?guidedTour.elapsed/s.duration:0));};
 $('#guided-tour-play').onclick=()=>{if(guideWantsPlayback(t))pauseGuidePlayback('已暂停；不会自动继续。');else if(t.handoff){t.handoff.resume=true;readTourHUD();}else {void playGuidedTour();readTourHUD();}};
 $('#guided-tour-voice').onchange=e=>{if(!e.target.checked)t.voice?.pause();else if(t.playing){holdGuidedTour();void playGuidedTour();}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&t.active&&(guideWantsPlayback(t)||t.handoff||t.poseHandoff))pauseGuidePlayback('切离页面，已暂停。',{stopMotion:true});});
 window.addEventListener('keydown',e=>{if(e.code==='Escape'&&t.active){const options=$('#guide-play-toggles');if(options.matches(':popover-open')){options.hidePopover();$('#guided-play-options').focus({preventScroll:true});e.preventDefault();e.stopImmediatePropagation();return;}if($('#landscape-dialog')?.open||e.target?.closest?.('.v83-photo-frame.is-lens'))return;e.preventDefault();e.stopImmediatePropagation();const idxDrawer=document.getElementById('v93-index-drawer');if(idxDrawer&&!idxDrawer.hidden){idxDrawer.hidden=true;document.getElementById('v93-index-toggle')?.setAttribute('aria-expanded','false');return;}if(!$('#guided-photo-preview').hidden){setGuidePhoto(false,{focus:true});return;}if(state.studioOpen){closeStudioDrawer();return;}if(t.observer){closeGuideObserver();return;}if(t.manualCamera){followGuideCamera();return;}if(guideWantsPlayback(t)||t.handoff||t.poseHandoff)pauseGuidePlayback('已暂停。',{stopMotion:true});else closeGuidedTour();}},{capture:true});
 installV93Bridge();
}
const v93SyncCallbacks=new Set();
function v93NotifySync(){for(const fn of v93SyncCallbacks)try{fn();}catch{}}
function installV93Bridge(){
 window.__HJN_V93_BRIDGE__={
  isReady:()=>Boolean(guidedTour.book?.length),
  getBook:()=>guidedTour.book,
  hasStopProfile:stepId=>Boolean(v74StopProfiles[stepId]||['road-nw-gully','kmz-north-to-crossings'].includes(stepId)),
  onSync:fn=>{if(typeof fn==='function')v93SyncCallbacks.add(fn);},
  getSnapshot:()=>{
   const t=guidedTour, s=guideStep();
   if(!t.active||!s||!t.route)return {active:false};
   const section=t.book.indexOf(t.route);
   const totalStops=t.book.reduce((n,b)=>n+b.steps.length,0);
   const globalIdx=t.book.slice(0,section).reduce((n,b)=>n+b.steps.length,0)+t.index+1;
   const basemapDate=provider.getImagerySpec(state.basemap)?.time_utc?.slice(0,10);
   const imageryLabel=state.basemap===ESRI_PUBLIC_ID?'Esri · 在线参考':basemapDate?'Sentinel-2 · '+basemapDate:'公开位置底图';
   const voiceOn=Boolean(t.voice&&!t.audioFailed&&$('#guided-tour-voice')?.checked&&Number.isFinite(t.voice.duration)&&t.voice.duration>0);
   const progressRatio=voiceOn?Math.min(1,t.voice.currentTime/t.voice.duration):(s.duration?Math.min(1,t.elapsed/s.duration):0);
   const hasProfile=Boolean(t.v74Profile||v74StopProfiles[s.id]||['road-nw-gully','kmz-north-to-crossings'].includes(s.id)||(s.detail?.chart&&getProfileData(s.detail.chart)));
   const hasMedia=Boolean((!$('#guided-board-media').hidden&&$('#guided-board-media').childElementCount>0)||!$('#guided-tour-photo-link').hidden);
   return {active:true,step:s,route:t.route,globalIdx,totalStops,waterMonth:state.month,imageryLabel,isOverview:isGuideOverview(s),progressRatio,hasProfile,hasMedia};
  },
  openAtRoute:(routeId,stepIdx=0,{autoPlay=false}={})=>{
   const t=guidedTour;
   const route=t.book.find(r=>r.id===routeId)||t.book[0];
   const index=route?.steps[stepIdx]?stepIdx:0;
   const step=route?.steps[index];
   if(!step)return;
   if(!t.active)openGuidedTour($('#btn-guide-chapter-one'),step.id);
   else if(!isMobileViewport()&&guideStep()?.id!==step.id){moveGuidedChapter(1,{resume:autoPlay,destination:{route,index,step}});return;}
   else {cancelGuideHandoff();setGuidedRoute(route,index);}
   if(autoPlay)requestAnimationFrame(()=>void playGuidedTour());
  },
  jumpTo:(routeId,stepIdx=0)=>{
   const t=guidedTour, route=t.book.find(r=>r.id===routeId);
   if(!route?.steps[stepIdx])return;
   const shouldPlay=guideWantsPlayback(t);
   if(!t.active)openGuidedTour($('#btn-guide-chapter-one'),route.steps[stepIdx]?.id);
   else if(!isMobileViewport()&&guideStep()?.id!==route.steps[stepIdx].id)moveGuidedChapter(1,{resume:shouldPlay,destination:{route,index:stepIdx,step:route.steps[stepIdx]}});
   else{
    cancelGuideHandoff();
    closeGuideObserver({restorePosition:false,focus:false});
    holdGuidedTour();
    if(t.route===route)prepareTourStep(stepIdx);
    else setGuidedRoute(route,stepIdx);
    if(shouldPlay)void playGuidedTour();
   }
  },
  ensureStopProfileOpen:()=>{
   const s=guideStep();if(!s)return;
   const id=guidedTour.v74Profile||v74StopProfiles[s.id]||(s.detail?.chart&&getProfileData(s.detail.chart)?s.detail.chart:null);
   if(id)v74SelectProfile(id);
  },
  openCurrentMedia:()=>{
   if(!$('#guided-photo-preview').hidden){setGuidePhoto(false,{focus:true});return;}
   const firstBtn=$('#guided-board-media button');
   if(!$('#guided-board-media').hidden&&firstBtn){firstBtn.click();return;}
   const link=$('#guided-tour-photo-link');
   if(link&&!link.hidden)link.click();
  },
  refitCurrentPose:()=>{
   const s=guideStep();
   if(guidedTour.active&&s&&!guidedTour.playing&&!guidedTour.observer&&!guidedTour.manualCamera){
    showTourPose(s,s.duration?guidedTour.elapsed/s.duration:0);
   }
  }
 };
 v93NotifySync();
}

async function boot() {
  const hero=$('#atlas-hero-card'),head=$('#hud-top-left');
  new ResizeObserver(()=>head.style.setProperty('--atlas-home-card-width',hero.getBoundingClientRect().width+'px')).observe(hero);

  const coreData=provider.boot();
  // Attach rejection immediately while other startup requests are being scheduled.
  void coreData.catch(()=>{});
  const optionalGuide=async (url)=>{
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await fetch(url,{signal:AbortSignal.timeout?.(attempt?28000:12000)});
        if(r.ok)return await r.json();
        if(r.status<500&&r.status!==408&&r.status!==429)return null;
      }catch{/* Temporary connection failure; retry independently of the map. */}
    }
    return null;
  };
  const tourFetch=optionalGuide('./guided-tours.json?v=105.18.14');
  const nwNetworkFetch=fetch('./nw-bridge-network-v96.geojson').then(r=>r.ok?r.json():null).catch(()=>null);
  const catchmentScreenFetch=fetch('./catchment-screen-v94.geojson?v=95',{signal:AbortSignal.timeout?.(4000)}).then(r=>r.ok?r.json():null).catch(()=>null);
  const owner75Fetch=optionalGuide('./owner-water-network-v75.geojson?v=75');
 const guideAudioFetch=optionalGuide('./guided-tour-audio/audio-manifest.json?v=105.18.14');
  const urlPatch = decodeAtlasUrl(location.search);
  const routeParams=new URLSearchParams(location.search);
  const firstOpen=routeParams.size===0;
  const nwDeepLink=routeParams.get('nw')==='all';
  const requestedView=routeParams.get('view');
  state.timelineCalendarFull=routeParams.get('calendar')==='full';
  const requestedContour=Number(routeParams.get('ctr'));
  state.visibleLayers.add('secondary-roads');
  if(routeParams.get('panel')===ROUTE_DEEP_LINK){
    state.waterwayNav=true;
    state.waterwayBranch=routeParams.get('branch');
    state.waterwayItem=routeParams.get('node');
  }
  Object.assign(state, urlPatch);
  if(firstOpen)state.view3d=!isMobileViewport();
  if(nwDeepLink){state.view3d=false;for(const id of CATCHMENT_SCREEN.keys())state.visibleLayers.delete(id);state.visibleLayers.add(NW_NETWORK);}
  if(requestedView&&Object.hasOwn(VIEW_SCOPES,requestedView))chooseScenePreset(requestedView,{boot:true});
  else if(urlPatch.lakeView)state.scenePreset='custom';

  const f1WaterwayPromise=fetch(new URL('./f1-waterway.geojson?v=67',location.href),{
    signal:AbortSignal.timeout?.(3500)
  }).then(r=>r.ok?r.json():null).catch(()=>null);
  const wcrossUpstreamUrl='./wcross-upstream.geojson?v=33';
  const wcrossUpstreamPromise=fetch(new URL(wcrossUpstreamUrl,location.href),{signal:AbortSignal.timeout?.(3500)})
    .then(r=>r.ok?r.json():null).catch(()=>null);
  const slopeCluePromise=fetch(new URL('./slope-road-clues.geojson?v=48',location.href),{signal:AbortSignal.timeout?.(3500)}).then(r=>r.ok?r.json():null).catch(()=>null);
  const ownerBluePromise=fetch(new URL('./owner-blue-201909.geojson?v=33',location.href),{signal:AbortSignal.timeout?.(3500)})
    .then(r=>r.ok?r.json():null).catch(()=>null);
  const waterwayOverviewPromise=fetch(new URL('./route-narrative.json?v=71',location.href),{signal:AbortSignal.timeout?.(3500)})
    .then(r=>r.ok?r.json():null).catch(()=>null);
  const nativeTrackPromise=fetch(new URL('./model-line-profiles.json?v=30',location.href),{signal:AbortSignal.timeout?.(3500)})
    .then(r=>r.ok?r.json():null).catch(()=>null);
  const seasonalPromise=fetch(new URL('./seasonal-network.geojson?v=48',location.href),{
    signal:AbortSignal.timeout?.(3500)
  }).then(r=>r.ok?r.json():null).catch(()=>null);
  const officeEvidence = fetch(new URL('./office-corridor.geojson?v=7', location.href), {
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined,
  }).then(async r => {
    if (!r.ok) throw new Error('未载入办公院专题');
    return r.json();
  }).catch(()=>null);
  const mainProfileEvidence = fetch(new URL('./main-lake-profiles.geojson', location.href), {
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined,
  }).then(async r => {
    if (!r.ok) throw new Error('未载入主湖剖面');
    return r.json();
  }).catch(()=>null);
  const fieldPhotosPromise = Promise.resolve(null);
  const julyPayloadPromise = fetch(new URL('./july2023-review-windows.geojson', location.href), {
    signal: AbortSignal.timeout?.(4500),
  }).then(r => r.ok ? r.json() : null).catch(() => null);
  const northBoundaryPromise = fetch(new URL('./north-boundary-checks.geojson', location.href), {
    signal: AbortSignal.timeout?.(4500),
  }).then(r => r.ok ? r.json() : null).catch(() => null);
  const southeastFixturePromise=Promise.resolve(null);
  const diagnosticBranchesPromise = fetch(new URL('./diagnostic-branches.geojson', location.href), {
    signal: AbortSignal.timeout?.(5500),
  }).then(r => r.ok ? r.json() : null).catch(() => null);
  await coreData;
  const initialHistory=fixedHistoryInventory().catch(()=>null);
  registerStudyFeatures(provider);
  const catchmentData=await catchmentScreenFetch;
  if(catchmentData?.type==='FeatureCollection'&&Array.isArray(catchmentData.features)){
    const f=catchmentData.features.filter(x=>typeof x.id==='string'&&CATCHMENT_SCREEN.has(x.properties?.layer)&&['Polygon','MultiPolygon'].includes(x.geometry?.type));
    provider.analysis={...provider.analysis,features:[...provider.analysis.features,...f]};
    for(const row of f)provider.analysisById.set(row.id,row);
  }
  const officePayload = await officeEvidence;
  if (officePayload) {
    const features = validateOfficeCompanion(officePayload, provider.analysisById);
    provider.analysis = { ...provider.analysis, features: [...provider.analysis.features, ...features] };
    for (const f of features) provider.analysisById.set(f.id, f);
    if (provider.analysisById.has('wc2-review-fringe')) provider.evidence = [{
      id:'wc2-downstream-review',title:'圆涵下游：水类只在主湖边缘重复检出',classification:'遥感观测与地形模型',
      judgment:'圆涵有照片证据，但相机位置不是洞口。四期 20 米样带在前 1 公里均未分类出水，水类只见于末段；约 420 米是不填洼模型停点，值得现场看地表。',
      boundary:'各段按历史模型里程组织，既不是实测水路，也不能用未判为水排除浅流；主湖末段的水和上游涵洞不自动连成一路。',
      feature_ids:['wc2-review-near','wc2-review-gap','wc2-review-stop','wc2-review-middle','wc2-review-fringe'],
    },...provider.evidence];
    if (['office-service','office-field-of_a','office-field-of_b','office-field-of_c',
      'atlas-office-trace-main_raw','atlas-office-trace-main_historical_filled','audit-main-office-historic-terminal'].every(id=>provider.analysisById.has(id))) {
      provider.evidence = [
        {id:'office-drainage-current',title:'办公院排水情景 ① 现状证据',classification:'现状证据与现场待核',
          judgment:'办公院真正的出水口还未定位。院东南的三个点是核查参照，不是已知排水设施。未经填洼的 30 米地表模型从参考起点推至约 627 米就停下；这不是现场观察到的水路或断点。',
          boundary:'先核实实际院边出水位置，再查途中支口、低处与岸边。未判定不等于无来水。',
          outcome_rows:[['主湖（优先）','现状能否到湖尚未证实；原地表模型未到历史主湖西侧终点。'],
            ['西长湖','影响尚未判定。'],['东部泥沼','影响尚未判定。']],
          feature_ids:['office-service','office-field-of_a','office-field-of_b','office-field-of_c','atlas-office-trace-main_raw']},
        {id:'office-drainage-sensitivity',title:'办公院排水情景 ② 模型减阻敏感性',classification:'条件地形模型 · 非工程方案',
          judgment:'仅对同一份 30 米地表模型进行条件填洼，让水越过模型中的低点，推演线约 1.664 公里才抵达历史设定的主湖西侧终点。对比说明模型对低处如何处理很敏感。',
          boundary:'填洼是计算假设，不是建议挖沟、改坡或分流。尚无实测连续通路、流量或分配比例；不把圆涵下游接到这条线上。',
          outcome_rows:[['主湖（优先）','只有条件填洼的这一组推演到达；不代表真实出水或新方案可达。'],
            ['西长湖','影响尚未判定。'],['东部泥沼','影响尚未判定。']],
          feature_ids:['office-service','atlas-office-trace-main_raw','atlas-office-trace-main_historical_filled','audit-main-office-historic-terminal']},
        ...provider.evidence,
      ];
    }
    state.officeEvidenceReady = true;
  }
  function registerMainProfiles(mainProfilePayload){
    if (mainProfilePayload) {
      const features = validateMainProfiles(mainProfilePayload, provider.analysisById);
      provider.analysis = { ...provider.analysis, features: [...provider.analysis.features, ...features] };
      for (const f of features) provider.analysisById.set(f.id, f);
      state.mainProfilesReady = features.length;
      if (!urlPatch.activeProfileId) state.activeProfileId = features[0].id;
    }
  }
  registerMainProfiles(await mainProfileEvidence);

  try {
    const field = validateFieldPhotos(await fieldPhotosPromise, provider.analysisById);
    state.fieldPhotos = field;
    provider.analysis = {...provider.analysis, features:[...provider.analysis.features,...field]};
    for (const f of field) provider.analysisById.set(f.id,f);
  } catch { /* optional private layer */ }
  const julyPayload = await julyPayloadPromise;
  if (julyPayload) {
    try {
      const features = validateJulyWindows(julyPayload, provider.analysisById);
      provider.analysis = { ...provider.analysis, features: [...provider.analysis.features, ...features] };
      for (const f of features) provider.analysisById.set(f.id, f);
      provider.evidence = [...julyEvidence(), ...provider.evidence];
      state.julyWindowsReady = features.length;
    } catch {
      // An invalid optional layer never disables the frozen atlas.
    }
  }
  const northPayload = await northBoundaryPromise;
  if (northPayload) {
    try {
      const features = validateNorthBoundaryChecks(northPayload, provider.analysisById);
      provider.analysis = { ...provider.analysis, features: [...provider.analysis.features, ...features] };
      for (const f of features) provider.analysisById.set(f.id, f);
      state.northBoundaryReady = features.length;
    } catch {
      // Optional wall boundary points stay isolated from frozen atlas.
    }
  }
  const sePayload = await southeastFixturePromise;
  if (sePayload) {
    try {
      state.southeastFixture = validateSoutheastFixture(sePayload);
    } catch {
      state.southeastFixture = null;
    }
  }
  const diagBranchesPayload = await diagnosticBranchesPromise;
  if (diagBranchesPayload) {
    try {
      const features = validateDiagnosticBranches(diagBranchesPayload, provider.analysisById);
      provider.analysis = { ...provider.analysis, features: [...provider.analysis.features, ...features] };
      for (const f of features) provider.analysisById.set(f.id, f);
      state.diagnosticBranchesReady = features.length;
    } catch {
      // Optional 2026-11-23 bridge/culvert diagnostic lines never block frozen atlas.
    }
  }
  function registerSeasonal(seasonalPayload){
    if (seasonalPayload) {
      try {
        const features=validateSeasonalNetwork(seasonalPayload,provider.analysisById);
        provider.analysis={...provider.analysis,features:[...provider.analysis.features,...features]};
        for(const f of features) provider.analysisById.set(f.id,f);
        state.seasonalNetwork=features;
      } catch(err) { console.warn('季节性线索图层未载入',err.message); }
    }
  }
  registerSeasonal(await seasonalPromise);
  function registerF1(f1WaterwayPayload){
    if(f1WaterwayPayload){
      try {
        const {features,evidence}=validateF1Waterway(f1WaterwayPayload,provider.analysisById);
        provider.analysis={...provider.analysis,features:[...provider.analysis.features,...features]};
        for(const f of features)provider.analysisById.set(f.id,f);
        provider.evidence=[evidence,...provider.evidence];
        state.f1Waterway=features;
      }catch(err){console.warn('桥上下游图层未载入',err.message);}
    }
  }
  registerF1(await f1WaterwayPromise);
  function registerWcrossUpstream(payload){
    if(payload)try {
      const features=validateWcrossUpstream(payload,provider.analysisById);
      provider.analysis={...provider.analysis,features:[...provider.analysis.features,...features]};
      for(const f of features)provider.analysisById.set(f.id,f);
      state.wcrossUpstream=features;
    }catch(err){console.warn('地方道路路西专题未载入',err.message);}
  }
  registerWcrossUpstream(await wcrossUpstreamPromise);
  const ownerBlueData=await ownerBluePromise;
  if(ownerBlueData)try {
    const features=validateOwnerBlue(ownerBlueData,provider.analysisById);
    provider.analysis={...provider.analysis,features:[...provider.analysis.features,...features]};
    for(const f of features)provider.analysisById.set(f.id,f);
    state.ownerBlue=features;
  }catch(err){console.warn('用户蓝线专题未载入',err.message);}
  const slopeDoc=await slopeCluePromise;
  if(slopeDoc)try{
    const features=parseSlopeClues(slopeDoc);
    provider.analysis={...provider.analysis,features:[...provider.analysis.features,...features]};
    for(const f of features)provider.analysisById.set(f.id,f);
    state.slopeRoadClues=features;
    provider.evidence=[...provider.evidence,{
      id:'slope-road-clues',title:'右圈浅斑、手绘蓝笔与地方路',classification:'影像判读 · 地形对照 · 现场待核',
      judgment:'2004-05 标记影像的浅色范围之后变暗；植被变化是可能解释，不能判断是否人工种植，也不能据白色判断冲刷。蓝笔占位和地方路是独立线索。',
      boundary:'浅斑到蓝笔上端约 306 米，隔着 G332；两套地形对过国道结果不一致，图上不画连线。蓝尾旁是另一条地方路，拟查点不是圆涵、出水口或新入湖口。',
      feature_ids:[SLOPE_FEATURES[4],SLOPE_FEATURES[0],SLOPE_FEATURES[2]]
    }];
  }catch(err){console.warn('右圈与地方路核查图层未载入',err.message);}
  nativePickedProfiles=nativeTrackProfiles(await nativeTrackPromise,provider.analysisById);
  const routePayload=await waterwayOverviewPromise;
  if(routePayload)try {
    state.waterwayOverview=validateWaterwayOverview(routePayload);
    // Data sources use raw diagnostics IDs; the live picker registers the
    // same immutable lines with a reserved namespace.
    const routeId=id=>provider.analysisById.has(id)?id:provider.analysisById.has('diag-branch-'+id)?'diag-branch-'+id:id;
    for(const s of state.waterwayOverview.sections)for(const it of s.items){
      it.featureIds=it.featureIds.map(routeId);
      it.profileIds=it.profileIds.map(routeId);
    }
    const active=state.waterwayOverview.sections.find(x=>x.id===state.waterwayBranch);
    if(!active){state.waterwayBranch=null;state.waterwayItem=null;}
    else if(!active.items.some(x=>x.id===state.waterwayItem))state.waterwayItem=null;
  }catch(err){console.warn('水路总览未载入',err.message);}
  const nwNetworkDoc=await nwNetworkFetch;
  nwNetworkFeatures=(nwNetworkDoc?.features||[]).filter(f=>f.id?.startsWith('nw96-')&&f.properties?.layer===NW_NETWORK);
  if(nwNetworkFeatures.length){
    provider.analysis={...provider.analysis,features:[...provider.analysis.features,...nwNetworkFeatures]};
    for(const f of nwNetworkFeatures)provider.analysisById.set(f.id,f);
  }
  if ($('#evidence-count-badge')) {
    $('#evidence-count-badge').textContent = String(provider.evidence.length);
  }

  const extraBridgeScenes = BRIDGE_CARD_IMAGERY.filter(sc => Boolean(sc.url));
  const validBasemaps = new Set([
    'dem-relief',
    TIMELINE_REFERENCE_SCENE.id,
    ...(provider.terrainManifest?.imagery || []).map(i => i.id),
    ...extraBridgeScenes.map(sc => sc.basemapId),
  ]);
  if (!validBasemaps.has(state.basemap)) state.basemap = 'sentinel2-2026-08-08';

  lastManualBasemap = state.basemap;
  const imageryById = { [TIMELINE_REFERENCE_SCENE.id]: TIMELINE_REFERENCE_SCENE };
  for (const im of provider.terrainManifest?.imagery || []) {
    imageryById[im.id] = { ...im, url: provider.url(im.id===PUBLIC_GUIDE_BASEMAP ? 'terrain/satellite-2026-08-08-display.webp' : `terrain/${im.path}`) };
  }
  for (const sc of extraBridgeScenes) {
    imageryById[sc.basemapId] = {
      id: sc.basemapId,
      scene_id: sc.scene_id,
      title_zh: `${sc.date} · ${sc.sensor}`,
      bounds_wgs84: sc.bounds_wgs84,
      url: sc.url,
    };
  }

  timelineScenes = [
    TIMELINE_REFERENCE_SCENE,
    ...(provider.terrainManifest?.imagery || []).map(im => ({
      id:im.id, date:im.time_utc?.slice(0,10), url:provider.url(`terrain/${im.path}`),
      broad: im.bounds_wgs84?.length === 4 && provider.terrainManifest?.bounds_wgs84?.length === 4
        && im.bounds_wgs84.every((v, i) => i < 2 ? v <= provider.terrainManifest.bounds_wgs84[i] + 1e-6 : v >= provider.terrainManifest.bounds_wgs84[i] - 1e-6),
    })),
    ...extraBridgeScenes.map(sc => ({
      id:sc.basemapId, date:sc.date, url:sc.url, broad:sc.eligibleForBranchCard === true && sc.validFraction >= 0.95
        && sc.bounds_wgs84[0] <= 119.61 && sc.bounds_wgs84[1] <= 49.101
        && sc.bounds_wgs84[2] >= 119.77 && sc.bounds_wgs84[3] >= 49.175,
    })),
  ];

  if(!firstOpen)await initialHistory;
  if(!timelineCalendar().fullSet.has(state.month))state.month='2024-07';

  $('#timeline-imagery-priority').onchange=ev=>{
    stopPlay();
    state.timelineImageryPriority=ev.target.value;
    if(!state.timelineSceneSync || fixedHistory.wanted)return;
    seekTimelineBasemap(state.month);
    updateHeaderPills();syncMapsState();
  };
  $('#timeline-imagery-sync').onchange = ev => {
    stopPlay();
    state.timelineSceneSync = ev.target.checked;
    timelineImageRequest?.abort();
    timelineImageRequest = null;
    if (state.timelineSceneSync) seekTimelineBasemap(state.month);
    else if (state.timelineBasemapStatus) {
      state.timelineBasemapStatus = null;
      state.basemap = lastManualBasemap;
    }
    updateHeaderPills();
    syncMapsState();
    syncUrl();
  };

  registeredImagery=imageryById;
  wireFixedHistory();

  const onCursor = ({ lon, lat, elev }) => {
    const zTxt = elev !== null ? `GLO-30 ${elev.toFixed(1)}m` : '超出 DEM 范围';
    const el = $('#cursor-readout');
    if (el) el.textContent = `${lat.toFixed(5)}°N, ${lon.toFixed(5)}°E · ${zTxt}`;
  };
  const onCam = ({ px, label }) => {
    if ($('#scale-bar')) $('#scale-bar').style.width = `${Math.max(36, Math.min(130, px))}px`;
    if ($('#scale-label')) $('#scale-label').textContent = label;
  };
  const onSelect = feat => selectFeature(feat,{showData:true});

  map2d = new AtlasMap2D($('#map-2d-canvas'), {
    onCursorMove: onCursor,
    onCameraChange: onCam,
    onViewChange: syncAdaptiveEsriDetail,
    onSelectFeature: onSelect,
  });

  map3d = new AtlasMap3D($('#map-3d-stage'), $('#map-3d-labels'), {
    onCursorMove: onCursor,
    onCameraChange: onCam,
    onViewChange: syncAdaptiveEsriDetail,
    onSelectFeature: onSelect,
    onNorthChange: deg => setCompassAngle(deg),
    onContextLost: info => handleWebGLContextLost(info),
  });
  map3d.setExaggeration(state.exag3d);
  $$('[data-exag]').forEach(b=>b.classList.toggle('active',Number(b.dataset.exag)===state.exag3d));
  const dimResolution = resolveEffectiveView3d(state.view3d, Boolean(map3d && !map3d.failed));
  const wantInitial3d = dimResolution.view3d;
  state.view3d = false;
  state.webglFallbackNotice = dimResolution.fallbackFrom3d ? 'startup' : false;
  if (dimResolution.fallbackFrom3d) {
    $('#render-engine-badge').textContent = '2D Canvas（WebGL 不可用已回退）';
    $('#btn-3d').title = '当前环境 WebGL 不可用，已自动回退 2D Canvas';
  }

  const initPayload = {
    dem: provider.dem,
    imageryById,
    analysisFeatures: provider.analysis.features,
  };
  map2d.setState(initPayload);
  map3d.setState(initPayload);

  bindEvents();
  wireTerrainWalk();
  const guideButtons=$$('#btn-guide-chapter-one,#btn-open-guided-tour,[data-guide-launch]');
  for(const button of guideButtons){button.disabled=true;button.setAttribute('aria-busy','true');}
  const finishGuide=async()=>{
    const tourDoc=await tourFetch;
    if(tourDoc)try{
      // The main map can start before these companions, but the guide needs their exact evidence IDs.
      const [seasonal,f1,profiles,wcross]=await Promise.all([
        state.seasonalNetwork?.length?null:optionalGuide('./seasonal-network.geojson?v=48'),
        state.f1Waterway?.length?null:optionalGuide('./f1-waterway.geojson?v=67'),
        state.mainProfilesReady?null:optionalGuide('./main-lake-profiles.geojson'),
        state.wcrossUpstream?.length?null:optionalGuide(wcrossUpstreamUrl),
      ]);
      if(seasonal)registerSeasonal(seasonal);
      if(f1)registerF1(f1);
      if(profiles)registerMainProfiles(profiles);
      if(wcross)registerWcrossUpstream(wcross);
      guidedTour.book=normalizeGuidedTours(tourDoc,provider.analysisById);
     for(const f of tourDoc.localEvidence||[])if(f.type==='Feature'){
      if(f.geometry?.type==='LineString'&&f.id?.startsWith('hjn-v74-'))guideV74Lines.set(f.id,f);
      if((f.id?.startsWith('east-guide-')||/^owner-05-(band|label)-[1-4]$/.test(f.id))&&['Point','LineString'].includes(f.geometry?.type))provider.analysisById.set(f.id,f);
     }
     const owner75=await owner75Fetch;
     const owner=Array.isArray(owner75?.features)?owner75.features.filter(f=>f.id?.startsWith('hjn-v75-kmz-')&&f.geometry?.type==='LineString'&&f.geometry.coordinates.length>=2&&f.geometry.coordinates.every(c=>c.length===2&&c.every(Number.isFinite)&&c[0]>119.60&&c[0]<119.78&&c[1]>49.10&&c[1]<49.18)):[];
     for(const f of owner){
      f.properties.layer=OWNER75_LAYER;
      f.properties.guideMode=f.id.includes('potential')||f.id.includes('seepage')?'candidate':'owner';
      provider.analysis.features.push(f);provider.analysisById.set(f.id,f);guideV74Lines.set(f.id,f);
     }
     guidedTour.ownerLines=owner;
     state.visibleLayers.add(OWNER75_LAYER);
     v74BuildProfiles();
      guidedTour.contextPaths=guideContextPaths(tourDoc.contextPaths);
      const context=guidedTour.contextPaths.map(r=>({type:'Feature',id:'guide-road-'+r.id,properties:{layer:GUIDE_G332_LAYER,name:r.label||'国道 G332 参考线',source:'冻结 OSM 路网，非水流'},geometry:{type:'LineString',coordinates:r.coords}}));
      provider.analysis.features.push(...context);
      for(const f of context)provider.analysisById.set(f.id,f);
      const applyAudio=guideAudio=>{
        if(!guideAudio?.steps)return;
        guidedTour.audioManifest=Object.fromEntries(guidedTour.book.flatMap(r=>r.steps).filter(s=>guideAudio.steps[s.id]?.body===s.body).map(s=>[s.id,guideAudio.steps[s.id]]));
        if(guidedTour.active)$('#guided-tour-voice').disabled=false;
      };
      if(firstOpen)void guideAudioFetch.then(applyAudio);
      else applyAudio(await guideAudioFetch);
    }catch(err){console.warn('本机三维导览未载入',err.message)}
    wireGuidedTour();
    for(const button of guideButtons)button.removeAttribute('aria-busy');
  };
  if(firstOpen)void finishGuide().catch(err=>console.warn('Guide setup unavailable',err));
  else await finishGuide();
  try {
    const savedTheme = localStorage.getItem('hujiernuoer-atlas-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') applyTheme(savedTheme, { persist: false });
    else applyTheme('dark', { persist: false });
  } catch {
    applyTheme('dark', { persist: false });
  }
  if ($('#deck-body') && 'inert' in $('#deck-body')) {
    $('#deck-body').inert = !state.deckExpanded;
  }
  updateHeaderPills();
  updateActiveLayerBadge();
  renderAlerts();

  const initialMonth=selectMonth(state.month,{timeline:routeParams.has('month')&&!routeParams.has('bm')});
  if(!firstOpen)await initialMonth;
  else void initialMonth.catch(err=>console.warn('Initial water geometry unavailable',err));

  if (isHistoricalId(state.selectedFeatureId)) {
    await ensureHistoricalContext();
    if (!provider.analysisById.has(state.selectedFeatureId)) state.selectedFeatureId = null;
  }

  if (isWaybackId(state.selectedFeatureId)) {
    const requested = state.selectedFeatureId;
    pendingWaybackId = requested;
    const items = await waybackLoader.ensure();
    if (items) pendingWaybackId = null;
    if (state.selectedFeatureId === requested && !provider.analysisById.has(requested)) state.selectedFeatureId = null;
    if (!items) openStudioDrawer('layers');
  }

  if(CONTOUR_CHOICES.includes(requestedContour)){setContourInterval(requestedContour,{persist:false});setContoursEnabled(true,{persist:false});await loadContours();}
  const linkedProfile = state.bottomTab === 'profile' && state.activeProfileId && Boolean(urlPatch.activeProfileId);
  const hasExplicitViewOverride = Boolean(
    state.selectedFeatureId ||
    requestedView ||
    urlPatch.lakeView ||
    linkedProfile ||
    state.waterwayNav
  );
  if(nwDeepLink&&nwNetworkBounds()){
    map2d.fitBounds(nwNetworkBounds(),1.18,0);
  } else if (state.selectedFeatureId && provider.analysisById.has(state.selectedFeatureId)) {
    selectFeature(state.selectedFeatureId,{fly:true,showData:state.pickedDataId===state.selectedFeatureId&&state.bottomTab!=='time'});
  } else if (!hasExplicitViewOverride && state.scenePreset === 'home' && provider.waterIndex?.lakes?.MAIN?.bounds_wgs84) {
    // Clean first-open framing adapted to the unobstructed portrait/landscape map window
    if(firstOpen&&isMobileViewport()){
      // Fit the whole study area to the narrow opening, not a cropped desktop camera.
      map2d.resize();
      map2d.fitBounds(AOI_BOUNDS,1,0,{fillWidth:true});
    }else fitMainLakeFirstOpen(0);
  } else if (requestedView === 'west' && provider.waterIndex?.lakes?.WF1?.bounds_wgs84) {
    map2d.fitBounds(provider.waterIndex.lakes.WF1.bounds_wgs84, 1.75, 0);
  } else if ((requestedView === 'north' || requestedView === 'east') && VIEW_SCOPES[requestedView]?.featureIds?.length) {
    const firstFeat = VIEW_SCOPES[requestedView].featureIds.map(fid => provider.analysisById.get(fid)).find(Boolean);
    if (firstFeat) map2d.fitBounds(geometryBounds(firstFeat.geometry), 1.85, 0);
    else map2d.fitBounds(AOI_BOUNDS, 1.06, 0);
  } else {
    map2d.fitBounds(AOI_BOUNDS, 1.06, 0);
  }
  updateScopeBar();

  if (state.profileCursorIdx >= 0) {
    setProfileSample(state.activeProfileId, state.profileCursorIdx);
  }

  if (wantInitial3d && !isWayback2dOnly(provider.analysisById.get(state.selectedFeatureId))) {
    setDimension('3d');
    const wide=innerWidth>=761&&innerWidth/Math.max(1,innerHeight)>=1.15;
    if(wide&&!hasExplicitViewOverride&&state.scenePreset==='home'&&is3DActive()){
      // Desktop first-open only: lake above center, a shallower oblique scroll of the site.
      map3d.flyTo({lon:119.6894,lat:49.1256,spanKm:6.5,pitchDeg:38.5,azimuthDeg:-3.3,duration:0});
    }
  }

  // Read-only state snapshot hook for verification
  if(linkedProfile)openLinkedProfile(state.activeProfileId,{sample:state.profileCursorIdx<0?null:state.profileCursorIdx});
  else if(state.waterwayNav)openWaterwayOverview();
  window.__ATLAS_STATE__ = () => ({
    guidedTour:{active:guidedTour.active,route:guidedTour.route?.id??null,step:guideStep()?.id??null,handoff:Boolean(guidedTour.handoff),kind:guideStep()?.kind??null,playing:guidedTour.playing,elapsed:guidedTour.elapsed,pose:guidedTour.pose,cameraPose:guidedTour.cameraPose??null,observer:guidedTour.observer?.id??null,manualCamera:Boolean(guidedTour.manualCamera),audioTime:guidedTour.voice?.currentTime??null,audioPaused:guidedTour.voice?.paused??null,contours:guidedTour.active?guideContourFeatures().length:0,exag:guidedTour.active?map3d.terrainWalkSnapshot()?.exag:null},
    walk:{active:walkMode.active,mode:walkMode.mode||null,locked:hasWalkLock(),held:Object.keys(currentWalkControls()).sort(),playing:Boolean(walkMode.playing),site:walkMode.site||null,station:walkMode.station??null,
      verticalMps:walkMode.active&&walkMode.mode==='fly'?walkVerticalMps(walkMode.mode,walkMode.speedLevels[walkMode.mode],currentWalkControls().fast):null,
      horizontalMps:walkMode.active&&walkMode.mode!=='guide'?walkHorizontalMps(walkMode.mode,walkMode.speedLevels[walkMode.mode],currentWalkControls().fast):null,
      visibleLayerIds:walkMode.active?[...state.visibleLayers]:null,
      route:walkMode.road?{id:walkMode.road.sourceId,lengthM:walkMode.road.lengthM,distanceToPhotoM:walkMode.road.distanceToPhotoM}:null,
      sunKey:walkMode.sunKey||null,camera:map3d?.terrainWalkSnapshot()||null},
    waterwayMap:{groupsOn:WATERWAY_MAP_GROUPS.filter(g=>state.visibleLayers.has(g.id)).map(g=>g.id),hiddenAliases:[...hiddenWaterwayAliases(state.visibleLayers,provider.analysisById,state.selectedFeatureId,{scope:FEATURE_IDS_BY_SCOPE[visibleSceneProfileScope()],spoken:state.spokenFeatureIds})]},
    mapViewPreset:{id:state.scenePreset,renderLakeView:scenePresetWater(),scopeFeatures:[...FEATURE_IDS_BY_SCOPE[visibleSceneProfileScope()]],layers:[...state.visibleLayers]},
    waterway:{loaded:Boolean(state.waterwayOverview),branch:state.waterwayBranch,item:state.waterwayItem,result:state.waterwayResult,returnRoute:state.waterwayReturn},
    focusScope: state.focusScope,
    ui: 'app-editorial-atlas-v54',
    theme: state.theme,
    officeEvidenceReady: Boolean(state.officeEvidenceReady),
    mainProfilesReady: state.mainProfilesReady || 0,
    northBoundaryReady: state.northBoundaryReady || 0,
    diagnosticBranchesReady: state.diagnosticBranchesReady || 0,
    crossingStructure: state.crossingStructure,
    spokenFeatureIds: [...state.spokenFeatureIds],
    spokenLakeIds: [...state.spokenLakeIds],
    profileGroups: groupProfileIds(provider.analysisById.values()),
    southeast: getActiveSoutheastSnapshot(),
    slopeRoadClues:{count:state.slopeRoadClues?.length||0,visible:state.visibleLayers.has(SLOPE_CLUE_LAYER)},
    ownerBlue:{count:state.ownerBlue?.length||0,visible:state.visibleLayers.has(OWNER_BLUE_LAYER)},
    wcrossUpstream:{count:state.wcrossUpstream?.filter(f=>f.properties.layer===WCROSS_UPSTREAM_LAYER).length||0,visible:state.visibleLayers.has(WCROSS_UPSTREAM_LAYER)},
    wcrossFar:{count:state.wcrossUpstream?.filter(f=>f.properties.layer===WCROSS_FAR_LAYER).length||0,visible:state.visibleLayers.has(WCROSS_FAR_LAYER)},
    f1Waterway: {count:state.f1Waterway?.length||0,visible:state.visibleLayers.has(F1_WATERWAY_LAYER),sensitivity:state.visibleLayers.has(F1_COMPARE_LAYER)},
    seasonalNetwork: {count:state.seasonalNetwork?.length||0,visible:state.visibleLayers.has(SEASONAL_LAYER)},
    julyWindows: { count: state.julyWindowsReady || 0, visible: state.visibleLayers.has(JULY_LAYER) },
    wayback: { phase: waybackLoader.phase, featureCount: waybackLoader.value?.length || 0 },
    month: state.month,
    basemap: state.basemap,
    view3d: is3DActive(),
    webglFallbackNotice: state.webglFallbackNotice,
    exag3d: state.exag3d,
    pickedDataId:state.pickedDataId,pickedProfileSource:getProfileData(state.pickedDataId)?.sampleOrigin||null,nativeProfileCount:nativePickedProfiles.size,
    lakeView: state.lakeView,
    compareAxis: state.compareAxis,
    bottomTab: state.bottomTab,
    deckExpanded: state.deckExpanded,
    studioOpen: state.studioOpen,
    studioTab: state.studioTab,
    contoursEnabled,
    slopeAspect:{on:slopeEnabled,density:slopeDensity,count:activeSlope()?.arrows.length||0,spacingM:activeSlope()?.spacing_m||0,renderedCount:mapStateSent.slopeAspect?.arrows.length||0,batches:map3d?.slopeGroup?.children.length||0},
    secondaryRoadsVisible:state.visibleLayers.has('secondary-roads'),
    contoursLoaded: Boolean(contourFeatures?.length), contourInterval, contourCount:contourFeatures.length,
    historicalEnabled: historicalLayers.filter(l => state.visibleLayers.has(l)),
    selectedFeatureId: state.selectedFeatureId,
    activeProfileId: state.activeProfileId,
    profileCursor: getActiveProfileCursor(),
    waterMonthDate: state.waterMonth?.date || null,
    waterGeometryFeatureCount:Object.fromEntries(Object.entries(state.waterMonth?.lakes||{}).map(([id,l])=>[id,{water:l.water?.features?.length||0,nodata:l.nodata?.features?.length||0,status:l.row?.status||null}])),
    waterLoading: Boolean(state.waterMonth?.loading),
    monthPlayback: { running: monthPlayback.running, preparingDate: monthPlayback.preparingDate, eligibleCount: playSequence().length },
    fixedHistory: {active:fixedHistory.active?.id||null,sourceDate:fixedHistory.active?.sourceDate||null,wanted:fixedHistory.wanted},
    timelineCalendar:{full:state.timelineCalendarFull,visibleDates:navigableDates(),playDates:playSequence(),imageMonths:[...timelineCalendar().images].sort()},
    catchmentScreen:{ mainPartitionVisible:Boolean(mapStateSent.visibleLayers?.has('main-catchments')||mapStateSent.spokenFeatureIds?.size&&guidedTour.active&&currentGuideCatchment()), layers:[...(guidedTour.active?(guidedTour.extraLayers||[]):state.visibleLayers)].filter(k=>CATCHMENT_SCREEN.has(k)),featureCount:provider.analysis?.features.filter(f=>CATCHMENT_SCREEN.has(f.properties?.layer)&&f.properties.layer!==NW_NETWORK).length||0,networkCount:nwNetworkFeatures.length,networkDrawn:(mapStateSent.visibleLayers?.has(NW_NETWORK)?(guidedTour.active?nwForGuide(guideStep()):nwNetworkFeatures):[]).map(f=>f.id) },
    guideDisplay:{catchment:guidedTour.active?currentGuideCatchment():null,profile:guidedTour.active&&$('#chart-deck').dataset.tourProfile?{id:$('#chart-deck').dataset.tourProfile,samples:getProfileData($('#chart-deck').dataset.tourProfile)?.samples?.length||0,gaps:getProfileData($('#chart-deck').dataset.tourProfile)?.gaps?.length||0}:null,contourInterval:guidedTour.contourInterval||10,layerIds:[...(guidedTour.extraLayers||[])]},
    timelineBasemap: {enabled:state.timelineSceneSync, priority:state.timelineImageryPriority, broadMonths:knownBroadMonths(), status:state.timelineBasemapStatus},
    esriOverviewZoom:publicEsri?.zoom??null,
    esriViewportDetail:map2d?._nativeDetail?.image.naturalWidth?map2d._nativeDetail.spec.key:
      map3d?._nativeDetails?.find(item=>item.texture&&item.spec.key)?.spec.key??null,
    esriBridgeDetail:Boolean(map3d?._nativeDetails?.some(item=>item.spec.id==='esri-public-bridge-detail'&&item.texture)),
    waterErrors: state.monthLoadErrors.length,
    camera2d: map2d?.getCameraFocus(),
    camera3d: map3d && !map3d.failed ? map3d.getCameraFocus() : null,
    webglReady: Boolean(map3d && !map3d.failed),
  });
  window.__ATLAS_DEBUG__ = {
    openSoutheastInspection,
    openCrossingsWorkspace,
    applyTheme,
  };
  if(firstOpen)void startPublicEsri();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const preview=$('#atlas-start-preview');if(preview)preview.hidden=true;
  }));
}

const bootLabel=$('#atlas-start-note'), bootReload=$('#atlas-start-reload');
if(bootReload)bootReload.onclick=()=>location.reload();
const slowStartNotice=setTimeout(()=>{
 if(bootLabel)bootLabel.textContent='底图预览 · 数据仍在加载，慢网下会自动重试';
},5000);
boot().catch(err => {
 console.error('Atlas UI boot failed:', err);
 if(bootLabel)bootLabel.textContent=location.protocol==='file:'
   ?'数据未加载 · 本机文件请通过 HTTP 服务打开'
   :'底图预览 · 图谱数据暂未载入，可以重新加载';
 if(bootReload&&location.protocol!=='file:')bootReload.hidden=false;
}).finally(()=>clearTimeout(slowStartNotice));





