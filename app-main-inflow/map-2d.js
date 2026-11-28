import { atlasLanguage, translateAtlas } from './atlas-i18n.js?v=40';
/* ==========================================================================
   app/map-2d.js
   High-DPI 2D Cartographic Canvas Engine for Hujiernuoer Spatial Evidence Atlas.
   Exact WGS84 projection, color+hatch+dash+symbol evidence vocabulary,
   separate fixed lake windows vs monthly water/nodata, pinned profile cursor,
   point/line/polygon exact feature.id hit-testing, mouse + multi-touch pinch.
   ========================================================================== */

import {
  AOI_BOUNDS,
  METERS_PER_DEG_LAT,
  METERS_PER_DEG_LON,
  sampleDemElevation,
  geometryBounds,
} from './terrain-math.js';
import { getFeatureVisualSpec, describeWaterMonth, describeProfileCursorElevation } from './view-model.js';
import { datedWaterMapLabel } from './waterway-map-policy.js';
import { ANALYSIS_PALETTE, MAP_CONTRAST, PROFILE_CURSOR_RING } from './atlas-visual-policy.js';
import {nearbyContours} from './contour-controls.js';
import { pickFeatureUnified } from './geo-pick.js';

import { WAYBACK_IDS } from './wayback.js';

const LAYER_Z_ORDER = [
  'main-catchments',
  'catchment-screen-nw', 'catchment-screen-nw-overview', 'catchment-screen-raw', 'catchment-screen-east-only', 'catchment-screen-compete',
  'f1-waterway-sensitivity',
  'f1-waterway',
  'landsat-2013-quality',
  's7-green-controls',
  'snow-2026',
  'nearby-pools',
  's7-repeat-green',
  'road-review',
  'secondary-roads',
  'yimin-reference',
  'roads',
  'g332-opening-road',
  'catchment-screen-nw-network',
  'archive-routing',
  'wcross-upstream',
  'wcross-far-west',
  'owner-blue-201909',
  'owner-water-network-v75',
  'office-flow-tests',
  'office-corridor',
  'ring-model-test-points',
  'seasonal-network',
  'west-slope-user-sketch',
  'bridge-f1-diag-raw',
  'bridge-f1-ne-branch',
  'bridge-f1-se-branch',
  'culvert-diag-branches',
  'west-slope-review',
  'slope-road-clues',
  'bridge-f1-anchors',
  'office-nw-audit',
  'roadside-terrain-check',
  'wc2-optical-review',
  'field-photos-20261122',
  'marsh-review',
  'north-boundary-checks',
  'july-2023-review',
  'main-lake-profiles',
  'yimin-probes',
  'yimin-profile',
  'east-profiles',
  'historic-water',
  'historic-roads',
  'historic-landmarks',
  'snow-sites',
  'regional-reference',
  ...WAYBACK_IDS,
];

// This limits display work only. World coordinates, hit tests, and all
// scientific inputs stay in CSS pixels / the original WGS84 and DEM lattice.
function displayPixelRatio(width, height) {
  const mobile = window.matchMedia?.('(max-width: 860px), (pointer: coarse)').matches;
  const native = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  return mobile ? Math.min(native, Math.sqrt(1_000_000 / Math.max(1, width * height))) : native;
}

export class AtlasMap2D {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks;
    this.width = 800;
    this.height = 600;
    this.dpr = displayPixelRatio(this.width, this.height);

    this.cam = {
      lon: 119.688,
      lat: 49.138,
      ppm: 0.082, // pixels per meter
    };
    this._flyAnim = null;
    this._reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.active = true;
    this._needsRender = true;
    this._raf = 0;
    this._cameraDirty = false;
    this._cursorPending = null;

    this._images = new Map();
    this._terrainRaster = null;
    this._patterns = {};

    this.state = {
      basemap: 'sentinel2-2026-08-08',
      imageryById: {},
      dem: null,
      waterMonth: null,
      contourFeatures: [],
      lakeView: 'BOTH',
      analysisFeatures: [],
      visibleLayers: new Set(),
      selectedFeatureId: null,
      relatedFeatureIds: new Set(),
      spokenFeatureIds: new Set(),
      spokenLakeIds: new Set(),
      crossingCompare: null,
      profileCursor: null,
      southeastInspection: null,
      theme: 'dark',
      showLabels: true,
    };

    this._pointers = new Map();
    this._dragStart = null;
    this._pinchStart = null;
    this._didDrag = false;

    this._initPatterns();
    this._bindEvents();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._cursorPending = null;
        this._cancelFrame();
      } else if (this.active) {
        this._invalidate();
      }
    });
    this.resize();
  }

  _makeHatch(strokeColor, bg = null, spacing = 10, cross = false) {
    const c = document.createElement('canvas');
    c.width = spacing;
    c.height = spacing;
    const g = c.getContext('2d');
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, spacing, spacing);
    }
    g.strokeStyle = strokeColor;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-2, spacing + 2);
    g.lineTo(spacing + 2, -2);
    if (cross) {
      g.moveTo(-2, -2);
      g.lineTo(spacing + 2, spacing + 2);
    }
    g.stroke();
    return this.ctx.createPattern(c, 'repeat');
  }

  _initPatterns() {
    this._patterns.nodata = this._makeHatch('rgba(148, 163, 184, 0.58)', 'rgba(15, 23, 42, 0.22)', 9, false);
    this._patterns.disputed = this._makeHatch('rgba(239, 68, 68, 0.72)', 'rgba(217, 119, 6, 0.24)', 9, false);
    this._patterns.amber = this._makeHatch('rgba(245, 158, 11, 0.62)', 'rgba(245, 158, 11, 0.10)', 9, false);
    this._patterns.crimson = this._makeHatch('rgba(225, 29, 72, 0.65)', 'rgba(225, 29, 72, 0.10)', 8, true);
    this._patterns.seSeparate = this._makeHatch('rgba(245, 158, 11, 0.85)', 'rgba(14, 165, 233, 0.34)', 8, false);
    this._patterns.seNodata = this._makeHatch('rgba(203, 213, 225, 0.82)', 'rgba(30, 41, 59, 0.45)', 7, true);
  }

  _buildTerrainRaster(dem) {
    if (!dem || !dem.elevations_m) return null;
    const c = document.createElement('canvas');
    c.width = dem.width;
    c.height = dem.height;
    const g = c.getContext('2d');
    const img = g.createImageData(dem.width, dem.height);
    const el = dem.elevations_m;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < el.length; i++) {
      if (el[i] < minZ) minZ = el[i];
      if (el[i] > maxZ) maxZ = el[i];
    }
    const span = Math.max(1, maxZ - minZ);
    const w = dem.width;
    const h = dem.height;
    for (let r = 0; r < h; r++) {
      for (let col = 0; col < w; col++) {
        const k = r * w + col;
        const t = (el[k] - minZ) / span;
        // Directional hillshade (NW light)
        const zL = el[r * w + Math.max(0, col - 1)];
        const zR = el[r * w + Math.min(w - 1, col + 1)];
        const zU = el[Math.max(0, r - 1) * w + col];
        const zD = el[Math.min(h - 1, r + 1) * w + col];
        const shade = Math.max(0.65, Math.min(1.25, 1.0 + ((zL - zR) + (zU - zD)) * 0.045));
        // Swiss-style muted topographic ramp (slate-teal low -> sage -> warm sand high)
        const red = Math.min(255, Math.round((34 + t * 142) * shade));
        const green = Math.min(255, Math.round((56 + t * 118) * shade));
        const blue = Math.min(255, Math.round((72 + t * 62) * shade));
        const p = k * 4;
        img.data[p] = red;
        img.data[p + 1] = green;
        img.data[p + 2] = blue;
        img.data[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  evictFixedImage(url) { this._images.delete(url); }

  _selectedImageSpec() {
    return this.state.imageryById?.[this.state.basemap];
  }

  _getSelectedImage() {
    const spec = this._selectedImageSpec();
    if (!spec?.url) return null;
    if (this._images.has(spec.url)) return this._images.get(spec.url);
    const im = new Image();
    im.decoding = 'async';
    const settled = () => {
      // An image that finished after a map switch must not wake a different
      // basemap or make it show an old scene.
      if (this._selectedImageSpec()?.url === spec.url) this._invalidate();
    };
    im.onload = settled;
    im.onerror = settled;
    this._images.set(spec.url, im);
    im.src = spec.url;
    return im;
  }

  setState(patch) {
    if (Object.hasOwn(patch, 'dem') && patch.dem !== this.state.dem) {
      this._terrainRaster = null;
    }
    Object.assign(this.state, patch);
    this._invalidate();
  }

  setActive(enable) {
    enable = Boolean(enable);
    if (this.active === enable) return;
    this.active = enable;
    if (!enable) {
      this._pointers.clear();
      this._dragStart = null;
      this._pinchStart = null;
      this._cursorPending = null;
      this._flyAnim = null;
      this._cancelFrame();
      return;
    }
    this.resize();
    this._invalidate();
  }

  _cancelFrame() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _requestFrame() {
    if (!this._raf && this.active && !document.hidden) {
      this._raf = requestAnimationFrame(now => this._loop(now));
    }
  }

  _invalidate() {
    this._needsRender = true;
    this._requestFrame();
  }

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect || rect.width < 10 || rect.height < 10) return;
    this.width = Math.round(rect.width);
    this.height = Math.round(rect.height);
    this.dpr = displayPixelRatio(this.width, this.height);
    const pixelWidth = Math.max(1, Math.round(this.width * this.dpr));
    const pixelHeight = Math.max(1, Math.round(this.height * this.dpr));
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    if (this.canvas.style.width !== `${this.width}px`) this.canvas.style.width = `${this.width}px`;
    if (this.canvas.style.height !== `${this.height}px`) this.canvas.style.height = `${this.height}px`;
    this._invalidate();
    this._emitCamera();
  }

  lonToX(lon) {
    return this.width * 0.5 + (lon - this.cam.lon) * METERS_PER_DEG_LON * this.cam.ppm;
  }

  latToY(lat) {
    return this.height * 0.5 - (lat - this.cam.lat) * METERS_PER_DEG_LAT * this.cam.ppm;
  }

  xToLon(x) {
    return this.cam.lon + (x - this.width * 0.5) / (METERS_PER_DEG_LON * this.cam.ppm);
  }

  yToLat(y) {
    return this.cam.lat - (y - this.height * 0.5) / (METERS_PER_DEG_LAT * this.cam.ppm);
  }

  setNativeDetail(spec) {
    if(this._nativeDetail?.spec.id===spec?.id)return;
    this._nativeDetail=spec?{spec,image:new Image()}:null;
    const item=this._nativeDetail;
    if(item){
      item.image.onload=()=>{if(this._nativeDetail===item)this._invalidate();};
      item.image.src=spec.url;
    }
    this._invalidate();
  }

  getCameraFocus() {
    const spanM = Math.min(this.width, this.height) / Math.max(1e-5, this.cam.ppm);
    return { lon: this.cam.lon, lat: this.cam.lat, spanKm: spanM / 1000 };
  }

  _minPpm() {
    const [w, s, e, n] = AOI_BOUNDS;
    const fullFit = Math.min(
      this.width * 0.92 / ((e - w) * METERS_PER_DEG_LON),
      this.height * 0.90 / ((n - s) * METERS_PER_DEG_LAT)
    );
    // Leave room to frame the full study area even after panning.
    return Math.min(0.035, fullFit * 0.24);
  }

  getCameraScale() { return this.cam.ppm; }

  flyTo({ lon, lat, spanKm, duration, exactFocus = false, pixelsPerMeter = null }) {
    const targetPpm = Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0 ? pixelsPerMeter : spanKm
      ? Math.max(this._minPpm(), Math.min(exactFocus ? 4.0 : 3.5,
        (Math.min(this.width, this.height) * (exactFocus ? 1 : 0.78)) / (spanKm * 1000)))
      : this.cam.ppm;
    this._moveCamera(lon, lat, targetPpm, duration);
  }

  fitBounds(bounds, padFactor = 1.12, duration, viewport = null) {
    if (!bounds) return;
    const [w, s, e, n] = bounds;
    const lon = (w + e) * 0.5;
    const lat = (s + n) * 0.5;
    const dxM = Math.max(200, (e - w) * METERS_PER_DEG_LON);
    const dyM = Math.max(200, (n - s) * METERS_PER_DEG_LAT);
    const {left=0,top=0,right=this.width,bottom=this.height,fillWidth=false}=viewport||{};
    const ppmX = ((right-left) * (fillWidth ? 1 : 0.92)) / (dxM * padFactor);
    const ppmY = ((bottom-top) * 0.90) / (dyM * padFactor);
    const targetPpm = Math.max(this._minPpm(), Math.min(3.5, fillWidth ? ppmX : Math.min(ppmX, ppmY)));
    const offsetX=(left+right-this.width)*0.5, offsetY=(top+bottom-this.height)*0.5;
    this._moveCamera(lon-offsetX/(METERS_PER_DEG_LON*targetPpm),lat+offsetY/(METERS_PER_DEG_LAT*targetPpm),targetPpm,duration);
  }

  _moveCamera(lon, lat, ppm, duration) {
    const explicitlyInstant = duration <= 0;
    if (!explicitlyInstant && this._pointers?.size) return; // direct gesture takes precedence
    const instant = explicitlyInstant || this._reducedMotion?.matches;
    if (!instant && this._flyAnim?.eLon === lon && this._flyAnim.eLat === lat &&
        this._flyAnim.ePpm === ppm) return; // don't restart a duplicate request

    const now = performance.now();
    if (!instant && this._flyAnim) this._stepCamera(now);
    const a = this.cam;
    const metres = Math.hypot((lon - a.lon) * METERS_PER_DEG_LON,
      (lat - a.lat) * METERS_PER_DEG_LAT);
    const pixels = metres * Math.sqrt(a.ppm * ppm);
    const logRatio = Math.log(ppm / a.ppm);
    if (instant || (pixels < 0.25 && Math.abs(logRatio) < 0.001)) {
      this._flyAnim = null;
      a.lon = lon;
      a.lat = lat;
      a.ppm = ppm;
      this._invalidate();
      this._emitCamera();
      return;
    }
    const viewportFraction = pixels / Math.max(1, Math.min(this.width, this.height));
    const autoMs = Math.min(560, Math.round(190 + 140 * viewportFraction + 100 * Math.abs(logRatio)));
    this._flyAnim = {
      t0: now, dur: Number.isFinite(duration) ? duration : autoMs,
      sLon: a.lon, sLat: a.lat, sPpm: a.ppm,
      eLon: lon, eLat: lat, ePpm: ppm, logRatio,
    };
    this._invalidate();
  }

  _stepCamera(now) {
    const a = this._flyAnim;
    if (!a) return;
    const t = this._reducedMotion?.matches ? 1 : Math.max(0, Math.min(1, (now - a.t0) / a.dur));
    const ease = t * t * (3 - 2 * t); // smooth acceleration and deceleration
    this.cam.lon = t === 1 ? a.eLon : a.sLon + (a.eLon - a.sLon) * ease;
    this.cam.lat = t === 1 ? a.eLat : a.sLat + (a.eLat - a.sLat) * ease;
    // Equal movement in log scale means equal proportional zoom changes.
    this.cam.ppm = t === 1 ? a.ePpm : a.sPpm * Math.exp(a.logRatio * ease);
    this._needsRender = true;
    this._cameraDirty = true;
    if (t === 1) this._flyAnim = null;
  }

  zoomBy(factor, clientX = null, clientY = null) {
    this._flyAnim = null;
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX !== null ? clientX - rect.left : this.width * 0.5;
    const py = clientY !== null ? clientY - rect.top : this.height * 0.5;
    const beforeLon = this.xToLon(px);
    const beforeLat = this.yToLat(py);
    this.cam.ppm = Math.max(this._minPpm(), Math.min(4.0, this.cam.ppm * factor));
    const afterLon = this.xToLon(px);
    const afterLat = this.yToLat(py);
    this.cam.lon += beforeLon - afterLon;
    this.cam.lat += beforeLat - afterLat;
    this._invalidate();
    this._emitCamera();
  }

  _emitCamera() {
    if (!this.cb.onCameraChange) return;
    this._cameraDirty = true;
    this._requestFrame();
  }

  _flushCamera() {
    if (!this._cameraDirty) return;
    this._cameraDirty = false;
    const targetPx = 92;
    const rawM = targetPx / Math.max(1e-5, this.cam.ppm);
    const nice = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
    let best = nice[0];
    for (const v of nice) {
      if (Math.abs(v - rawM) < Math.abs(best - rawM)) best = v;
    }
    const px = Math.round(best * this.cam.ppm);
    const label = best >= 1000 ? `${best / 1000} km` : `${best} m`;
    this.cb.onCameraChange({ px, label, focus: this.getCameraFocus() });
    this.cb.onViewChange?.();
  }

  _queueCursor(px, py) {
    if (!this.cb.onCursorMove) return;
    this._cursorPending = { px, py };
    this._requestFrame();
  }

  _flushCursor() {
    const point = this._cursorPending;
    if (!point) return;
    this._cursorPending = null;
    const lon = this.xToLon(point.px);
    const lat = this.yToLat(point.py);
    this.cb.onCursorMove({ lon, lat, elev: sampleDemElevation(this.state.dem, lon, lat) });
  }

  _bindEvents() {
    const el = this.canvas;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', e => {
      if (!this.active) return;
      this._cursorPending = null;
      try { el.setPointerCapture(e.pointerId); } catch {}
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._flyAnim = null;
      if (this._pointers.size === 1) {
        this._dragStart = { x: e.clientX, y: e.clientY, lon: this.cam.lon, lat: this.cam.lat };
        this._didDrag = false;
      } else if (this._pointers.size === 2) {
        const rect = el.getBoundingClientRect();
        const pts = [...this._pointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;
        this._pinchStart = {
          dist: Math.max(10, dist),
          ppm: this.cam.ppm,
          anchorLon: this.xToLon(midX - rect.left),
          anchorLat: this.yToLat(midY - rect.top),
        };
        this._didDrag = true;
      }
    });

    el.addEventListener('pointermove', e => {
      const rect = el.getBoundingClientRect();
      if (!this.active) return;
      if (!this._pointers.has(e.pointerId)) {
        if (e.pointerType !== 'touch' && this._pointers.size === 0) {
          this._queueCursor(e.clientX - rect.left, e.clientY - rect.top);
        }
        return;
      }
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this._pointers.size === 2 && this._pinchStart) {
        const pts = [...this._pointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;
        const scale = Math.max(10, dist) / this._pinchStart.dist;
        this.cam.ppm = Math.max(this._minPpm(), Math.min(4.0, this._pinchStart.ppm * scale));
        this.cam.lon = this._pinchStart.anchorLon - ((midX - rect.left) - this.width * 0.5) / (METERS_PER_DEG_LON * this.cam.ppm);
        this.cam.lat = this._pinchStart.anchorLat + ((midY - rect.top) - this.height * 0.5) / (METERS_PER_DEG_LAT * this.cam.ppm);
        this._invalidate();
        this._emitCamera();
        return;
      }

      if (this._pointers.size === 1 && this._dragStart) {
        const dx = e.clientX - this._dragStart.x;
        const dy = e.clientY - this._dragStart.y;
        const tapTol = e.pointerType === 'touch' ? 9 : 4;
        if (Math.hypot(dx, dy) > tapTol) this._didDrag = true;
        if (this._didDrag) {
          this.cam.lon = this._dragStart.lon - dx / (METERS_PER_DEG_LON * this.cam.ppm);
          this.cam.lat = this._dragStart.lat + dy / (METERS_PER_DEG_LAT * this.cam.ppm);
          this._invalidate();
          this._emitCamera();
        }
      }
    });

    const endPtr = e => {
      const wasSingleClick = e.type === 'pointerup' && this._pointers.size === 1 && !this._didDrag;
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) this._pinchStart = null;
      if (this._pointers.size === 1) {
        // Re-anchor remaining finger smoothly after 2-finger pinch (no snap-back jump)
        const [rem] = this._pointers.values();
        this._dragStart = { x: rem.x, y: rem.y, lon: this.cam.lon, lat: this.cam.lat };
        this._didDrag = true;
      } else if (this._pointers.size === 0) {
        this._dragStart = null;
      }
      if (wasSingleClick) {
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        this._queueCursor(px, py);
        const hit = this.pickFeatureAt(px, py);
        if (this.cb.onSelectFeature) this.cb.onSelectFeature(hit);
      }
    };
    el.addEventListener('pointerup', endPtr);
    el.addEventListener('pointercancel', endPtr);

    el.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      this.zoomBy(factor, e.clientX, e.clientY);
    }, { passive: false });
  }

  pickFeatureAt(px, py) {
    const visible = this.state.analysisFeatures.filter(f => !this.state.hiddenFeatureIds?.has(f.id)&&(this.state.visibleLayers.has(f.properties?.layer)||this.state.scopeFeatureIds?.has(f.id)));
    const gd=[this.xToLon(px), this.yToLat(py)];
    const hit=pickFeatureUnified({
      px,
      py,
      groundLonLat: gd,
      features: visible,
      projectPoint: (lon, lat) => ({ x: this.lonToX(lon), y: this.latToY(lat) }),
      densifyMaxDeg: 0,
      pointTolPx: 18,
      lineTolPx: 10,
    });
    if(hit||!this.state.contourFeatures?.length)return hit;
    const tol=6;
    const c=nearbyContours(this.state.contourFeatures,gd,Math.abs(this.xToLon(px+tol)-gd[0]),Math.abs(this.yToLat(py+tol)-gd[1]));
    return pickFeatureUnified({px,py,groundLonLat:gd,features:c,
      projectPoint:(lon,lat)=>({x:this.lonToX(lon),y:this.latToY(lat)}),lineTolPx:tol});
  }

  _traceGeom(ctx, geom) {
    if (!geom) return;
    const t = geom.type;
    if (t === 'LineString') {
      geom.coordinates.forEach((c, i) => {
        const x = this.lonToX(c[0]);
        const y = this.latToY(c[1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    } else if (t === 'MultiLineString') {
      for (const line of geom.coordinates) {
        line.forEach((c, i) => {
          const x = this.lonToX(c[0]);
          const y = this.latToY(c[1]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      }
    } else if (t === 'Polygon') {
      for (const ring of geom.coordinates) {
        ring.forEach((c, i) => {
          const x = this.lonToX(c[0]);
          const y = this.latToY(c[1]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    } else if (t === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        for (const ring of poly) {
          ring.forEach((c, i) => {
            const x = this.lonToX(c[0]);
            const y = this.latToY(c[1]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
      }
    }
  }

  _queueLabel(x, y, text, borderCol, priority = 2, bg = null, textCol = null) {
    const light = this.state.theme === 'light';
    this._labelQueue.push({
      x,
      y,
      text: translateAtlas(text),
      borderCol,
      priority,
      bg: bg || (light ? 'rgba(251, 249, 244, 0.88)' : 'rgba(16, 17, 20, 0.78)'),
      textCol: textCol || (light ? '#181715' : '#F4F1EA'),
    });
  }

  _flushLabels(ctx) {
    if (!this._labelQueue?.length) return;
    this._labelQueue.sort((a, b) => a.priority - b.priority);
    const placed = [];
    const overlaps = (box) => placed.some(p => !(box.x2 < p.x1 || box.x1 > p.x2 || box.y2 < p.y1 || box.y1 > p.y2));
    const light = this.state.theme === 'light';

    ctx.save();
    ctx.font = '500 10.5px "Inter", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';
    for (const item of this._labelQueue) {
      const dotSpace = 11;
      const w = ctx.measureText(item.text).width + 18 + dotSpace;
      const h = 21;
      const offsets = item.priority <= 1 ? [0, -24, 24, -48, 48] : [0, -24, 24];
      let chosen = null;
      for (const dy of offsets) {
        const cy = item.y + dy;
        const box = { x1: item.x - w * 0.5 - 2, y1: cy - h * 0.5 - 2, x2: item.x + w * 0.5 + 2, y2: cy + h * 0.5 + 2 };
        if (box.x1 < 6 || box.x2 > this.width - 6 || box.y1 < 6 || box.y2 > this.height - 6) continue;
        if (!overlaps(box)) {
          chosen = { cy, box };
          break;
        }
      }
      if (!chosen) continue;
      placed.push(chosen.box);
      const rx = item.x - w * 0.5;
      const ry = chosen.cy - h * 0.5;
      ctx.save();
      ctx.shadowColor = light ? 'rgba(24, 22, 18, 0.14)' : 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.roundRect(rx, ry, w, h, h * 0.5);
      ctx.fillStyle = item.bg;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.roundRect(rx, ry, w, h, h * 0.5);
      ctx.strokeStyle = light ? 'rgba(24, 22, 18, 0.12)' : 'rgba(255, 255, 255, 0.10)';
      ctx.lineWidth = 0.85;
      ctx.stroke();

      // Subtle semantic dot instead of loud full-box colored frame
      ctx.beginPath();
      ctx.arc(rx + 10.5, chosen.cy, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = item.borderCol;
      ctx.fill();

      ctx.fillStyle = item.textCol;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.text, rx + 18, chosen.cy + 0.5);
    }
    ctx.restore();
  }

  _drawPointSymbol(ctx, x, y, symbol, stroke, fill, selected) {
    ctx.save();
    const r = selected ? 6.2 : 4.5;
    if (selected) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 241, 234, 0.18)';
      ctx.fill();
      ctx.strokeStyle = '#F4F1EA';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    if (symbol === '×') {
      // Crisp dark badge + delicate X cross so unconfirmed gaps read clearly over imagery
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12, 13, 16, 0.84)';
      ctx.fill();
      ctx.setLineDash([1.8, 2]);
      ctx.strokeStyle = selected ? '#F4F1EA' : stroke;
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.setLineDash([]);
      const cr = r * 0.64;
      ctx.beginPath();
      ctx.moveTo(x - cr, y - cr); ctx.lineTo(x + cr, y + cr);
      ctx.moveTo(x - cr, y + cr); ctx.lineTo(x + cr, y - cr);
      ctx.strokeStyle = selected ? '#F4F1EA' : stroke;
      ctx.lineWidth = selected ? 2.1 : 1.65;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (symbol === '◉') {
      // Field-photo camera lens ring: sleek warm basalt housing + crisp aperture
      ctx.beginPath();
      ctx.arc(x, y, r + 1.0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 15, 18, 0.88)';
      ctx.fill();
      ctx.strokeStyle = selected ? '#F4F1EA' : stroke;
      ctx.lineWidth = selected ? 1.9 : 1.55;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.8, r * 0.38), 0, Math.PI * 2);
      ctx.fillStyle = selected ? '#F4F1EA' : stroke;
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.beginPath();
    if (/^[1-4]$/.test(symbol)) {
      ctx.beginPath();ctx.arc(x,y,r+2.2,0,Math.PI*2);ctx.fillStyle=fill||'#14161B';ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1.25;ctx.stroke();
      ctx.font='650 10.5px "Inter", system-ui, sans-serif';ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle=stroke;ctx.fillText(symbol,x,y+.4);ctx.restore();return;
    }
    if (symbol === '◆' || symbol === '◇') {
      ctx.moveTo(x, y - r - 1.2);
      ctx.lineTo(x + r + 1.2, y);
      ctx.lineTo(x, y + r + 1.2);
      ctx.lineTo(x - r - 1.2, y);
      ctx.closePath();
    } else if (symbol === '▲') {
      ctx.moveTo(x, y - r - 1.2);
      ctx.lineTo(x + r + 1.0, y + r);
      ctx.lineTo(x - r - 1.0, y + r);
      ctx.closePath();
    } else if (symbol === '■') {
      ctx.rect(x - r, y - r, r * 2, r * 2);
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = symbol === '◇' ? 'rgba(14, 15, 18, 0.82)' : (fill || stroke);
    ctx.fill();
    ctx.strokeStyle = selected ? '#F4F1EA' : stroke;
    ctx.save();ctx.strokeStyle=MAP_CONTRAST.casing;ctx.lineWidth=selected?3.6:2.8;ctx.stroke();ctx.restore();
    ctx.lineWidth = selected ? 1.8 : 1.45;
    ctx.stroke();
    if (symbol === '⊘') {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.68, y + r * 0.68);
      ctx.lineTo(x + r * 0.68, y - r * 0.68);
      ctx.strokeStyle = '#F4F1EA';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.restore();
  }

  _getContourPaths(features) {
    if (this._contourCache?.features === features) return this._contourCache;
    if (typeof Path2D !== 'function') return null;
    const cache = { features, thin: new Path2D(), index: new Path2D(), labels: [] };
    const w = AOI_BOUNDS[0], n = AOI_BOUNDS[3];
    for (const feature of features) {
      const geom = feature.geometry;
      const paths = geom?.type === 'LineString' ? [geom.coordinates]
        : geom?.type === 'MultiLineString' ? geom.coordinates : [];
      const isIndex = feature.properties?.index_contour === true;
      const elevation = feature.properties?.elevation_m;
      const path = isIndex ? cache.index : cache.thin;
      for (const line of paths) {
        if (line.length < 2) continue;
        for (let i = 0; i < line.length; i++) {
          const [lon, lat] = line[i];
          const x = (lon - w) * METERS_PER_DEG_LON;
          const y = (n - lat) * METERS_PER_DEG_LAT;
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
        if (isIndex && Number.isFinite(elevation) && line.length >= 5) {
          // Sparse candidates along each longer index line; painted only if
          // visible and away from other contour labels. Major map labels win.
          for (const frac of line.length >= 45 ? [0.25, 0.5, 0.75] : [0.5]) {
            const [lon, lat] = line[Math.floor((line.length - 1) * frac)];
            cache.labels.push({ lon, lat, elevation });
          }
        }
      }
    }
    this._contourCache = cache;
    return cache;
  }

  _renderSlopeAspect(ctx){
    const f=this.state.slopeAspect;if(!f?.arrows.length)return;
    const step=f.spacing_m, occupied=new Set();
    const pxPerM=Math.abs(this.lonToX(AOI_BOUNDS[0]+1/METERS_PER_DEG_LON)-this.lonToX(AOI_BOUNDS[0]));
    const thin=step*pxPerM<17, len=Math.min(step*.44*pxPerM,48);
    if(len<4)return;
    ctx.save();ctx.beginPath();
    for(const [lon,lat,east,north] of f.arrows){
      const x=this.lonToX(lon),y=this.latToY(lat);
      if(x<-len||x>this.width+len||y<-len||y>this.height+len)continue;
      if(thin){
        const hash=Math.floor(x/17)+':'+Math.floor(y/17);if(occupied.has(hash))continue;occupied.add(hash);
      }
      const dx=east*len,dy=-north*len, tx=x+dx*.5,ty=y+dy*.5;
      ctx.moveTo(x-dx*.5,y-dy*.5);ctx.lineTo(tx,ty);
      ctx.moveTo(tx-dx*.31-dy*.19,ty-dy*.31+dx*.19);ctx.lineTo(tx,ty);ctx.lineTo(tx-dx*.31+dy*.19,ty-dy*.31-dx*.19);
    }
    ctx.lineJoin='round';ctx.lineCap='round';
    ctx.lineWidth=2.9;ctx.strokeStyle='rgba(33,15,33,.94)';ctx.stroke();
    ctx.lineWidth=1.45;ctx.strokeStyle='rgba(255,129,232,.98)';ctx.stroke();ctx.restore();
  }

  _renderContours(ctx) {
    const features = this.state.contourFeatures;
    if (!features?.length || !(this.cam.ppm > 0)) return;
    const cache = this._getContourPaths(features);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (cache) {
      ctx.translate(this.lonToX(AOI_BOUNDS[0]), this.latToY(AOI_BOUNDS[3]));
      ctx.scale(this.cam.ppm, this.cam.ppm);
    }
    for (const isIndex of [false, true]) {
      const dense=this.state.contourInterval===2;
      const path=cache?(isIndex?cache.index:cache.thin):null;
      if(!cache){
        ctx.beginPath();
        for(const f of features) if((f.properties?.index_contour===true)===isIndex)this._traceGeom(ctx,f.geometry);
      }
      const stroke=()=>path?ctx.stroke(path):ctx.stroke();
      const scale=cache?this.cam.ppm:1;
      ctx.strokeStyle=MAP_CONTRAST.casing;
      ctx.globalAlpha=isIndex?.76:dense?.44:.56;
      ctx.lineWidth=(isIndex?2.7:dense?1.25:1.65)/scale;stroke();
      ctx.strokeStyle=isIndex?MAP_CONTRAST.contourMajor:MAP_CONTRAST.contourMinor;
      ctx.globalAlpha=isIndex?.93:dense?.57:.75;
      ctx.lineWidth=(isIndex?1.18:dense?.48:.65)/scale;stroke();ctx.globalAlpha=1;
    }
    ctx.restore();
    const selected=features.find(f=>f.id===this.state.selectedFeatureId);
    if(selected){ctx.save();ctx.beginPath();this._traceGeom(ctx,selected.geometry);ctx.strokeStyle=MAP_CONTRAST.casing;ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#fff8e6';ctx.lineWidth=2.4;ctx.stroke();ctx.restore();}

    if (!cache || !this.state.showLabels || this.cam.ppm < 0.07) return;
    const placed = [];
    for (const { lon, lat, elevation } of cache.labels) {
      const x = this.lonToX(lon), y = this.latToY(lat);
      if (x < 46 || y < 24 || x > this.width - 46 || y > this.height - 24) continue;
      if (placed.some(([px, py]) => Math.abs(px - x) < 104 && Math.abs(py - y) < 55)) continue;
      this._queueLabel(x, y, String(elevation) + ' m', '#dec9a4', 7);
      placed.push([x, y]);
      if (placed.length >= 9) break;
    }
  }

  _renderWaterLayer(ctx) {
    const wm = this.state.waterMonth;
    if (!wm) return;
    const lakes = this.state.lakeView === 'BOTH' ? ['MAIN', 'WF1'] : [this.state.lakeView];

    for (const lakeId of lakes) {
      const entry = wm.lakes[lakeId];
      if (!entry) continue;
      const desc = describeWaterMonth(lakeId, wm.date, entry.row);
      const isMain = lakeId === 'MAIN';
      const winColor = ANALYSIS_PALETTE.reference.stroke;
      const isErr = Boolean(entry.error);
      const isLoading = Boolean(entry.loading);

      // Only draw water & nodata when not loading and not errored (never show stale or fake zero)
      if (!isErr && !isLoading) {
        // 1. Nodata polygons (independent diagonal hatch)
        for (const f of entry.nodata?.features || []) {
          ctx.save();
          ctx.beginPath();
          this._traceGeom(ctx, f.geometry);
          ctx.fillStyle = this._patterns.nodata;
          ctx.fill('evenodd');
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
          ctx.lineWidth = 1.0;
          ctx.stroke();
          ctx.restore();
        }

        // 2. Water polygons (normal positive vs disputed positive clearly distinguished!)
        for (const f of entry.water?.features || []) {
          ctx.save();
          ctx.beginPath();
          this._traceGeom(ctx, f.geometry);
          if (desc.disputed) {
            ctx.fillStyle = this._patterns.disputed;
            ctx.fill('evenodd');
            ctx.strokeStyle = ANALYSIS_PALETTE.disputed.stroke;
            ctx.lineWidth = 2.4;
            ctx.setLineDash([6, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = ANALYSIS_PALETTE.disputed.stroke;
            ctx.lineWidth = 1.0;
            ctx.stroke();
          } else {
            ctx.fillStyle = ANALYSIS_PALETTE.water.fill+'80';
            ctx.fill('evenodd');
            ctx.strokeStyle = ANALYSIS_PALETTE.water.stroke;
            ctx.lineWidth = 1.7;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 3. Main-lake frame only. WF1 preserves the coverage fill without a reference outline/label.
      const isSpokenLake = Boolean(this.state.spokenLakeIds?.has(lakeId));
      for (const bf of entry.boundary?.features || []) {
        ctx.save();
        ctx.beginPath();
        this._traceGeom(ctx, bf.geometry);
        if (!isErr && !isLoading && desc.stateKey === 'invalid') {
          ctx.fillStyle = this._patterns.nodata;
          ctx.fill('evenodd');
        }
        if(!isMain){ctx.restore();continue;}
        if (isSpokenLake) {
          ctx.save();
          ctx.strokeStyle = 'rgba(244, 211, 120, 0.42)';
          ctx.lineWidth = 7;
          ctx.stroke();
          ctx.strokeStyle = '#f4d378';
          ctx.lineWidth = 2.4;
          ctx.stroke();
          ctx.restore();
        }
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = isErr ? '#dc2626' : isLoading ? '#94a3b8' : winColor;
        ctx.lineWidth = isSpokenLake ? 2.4 : 1.9;
        ctx.stroke();
        ctx.restore();

        const b = geometryBounds(bf.geometry);
        if (b && this.state.showLabels) {
          const topX = this.lonToX((b[0] + b[2]) * 0.5);
          const topY = this.latToY(b[3]) - 13;
          const baseLbl = '主湖固定统计窗';
          const stateSuffix =
            isErr ? ' · ⚠水面图层加载失败，请重试' :
            isLoading ? ' · 加载中…' :
            desc.stateKey === 'positive_disputed' ? ` · ⚠争议 ${desc.areaText}` :
            desc.stateKey === 'zero_disputed' ? ' · ⊗争议零值' :
            desc.stateKey === 'zero' ? ' · ○观测为零' :
            desc.stateKey === 'invalid' ? ' · ▨覆盖不足(留空)' :
            ` · ${desc.areaText}`;
          const border = isSpokenLake ? '#f4d378' : isErr ? '#dc2626' : isLoading ? '#94a3b8' : desc.tone === 'disputed' ? '#ef4444' : desc.tone === 'nodata' ? '#94a3b8' : winColor;
          this._queueLabel(topX, topY, `${isSpokenLake ? '◉ ' : ''}${baseLbl}${stateSuffix}`, border, isSpokenLake ? 0 : 1);
        }
      }
    }
  }

  _renderAnalysisLayers(ctx) {
    const spokenIds = this.state.spokenFeatureIds;
    const byLayer = new Map();
    for (const f of this.state.analysisFeatures) {
      const ly = f.properties?.layer;
      if(this.state.hiddenFeatureIds?.has(f.id))continue;
      if (!this.state.visibleLayers.has(ly)&&!this.state.scopeFeatureIds?.has(f.id)&&!spokenIds?.has(f.id)) continue;
      if (!byLayer.has(ly)) byLayer.set(ly, []);
      byLayer.get(ly).push(f);
    }

    const selId = this.state.selectedFeatureId;
    const relIds = this.state.relatedFeatureIds;

    for (const ly of LAYER_Z_ORDER) {
      const feats = byLayer.get(ly);
      if (!feats?.length) continue;

      for (const f of feats) {
        if(f.id===this.state.profileHighlightId&&['LineString','MultiLineString'].includes(f.geometry?.type))continue;
        const spec = getFeatureVisualSpec(f);
        const isSel = f.id === selId;
        const isRel = relIds?.has(f.id);
        const isSpoken = Boolean(spokenIds?.has(f.id));
        const gt = f.geometry?.type;

        if (gt === 'Point') {
          const [lon, lat] = f.geometry.coordinates;
          const x = this.lonToX(lon);
          const y = this.latToY(lat);
          if (isSpoken) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(244, 211, 120, 0.22)';
            ctx.fill();
            ctx.strokeStyle = '#f4d378';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
          }
          if (ly === 'field-photos-20261122' && isSel && !f.properties.heading_unverified) {
            const t=f.properties.heading_deg*Math.PI/180, dx=Math.sin(t),dy=-Math.cos(t), l=isSel?28:17;
            ctx.save();ctx.beginPath();ctx.moveTo(x+dx*4,y+dy*4);ctx.lineTo(x+dx*l,y+dy*l);
            ctx.lineTo(x+dx*(l-6)-dy*4,y+dy*(l-6)+dx*4);ctx.moveTo(x+dx*l,y+dy*l);
            ctx.lineTo(x+dx*(l-6)+dy*4,y+dy*(l-6)-dx*4);
            ctx.strokeStyle='#171220';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle=spec.stroke;ctx.lineWidth=2;ctx.stroke();ctx.restore();
          }
          this._drawPointSymbol(ctx, x, y, spec.symbol, isSpoken ? '#f4d378' : spec.stroke, spec.fill, isSel || isSpoken);
          if (f.id === 'office-service') {
            // Explicit visual unconfirmed outfall gap collar around Gacha Office yard
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = '#edb75f';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.setLineDash([]);
            // Small × gap mark on the SE yard exit side
            const gx = x + 11, gy = y + 10;
            ctx.beginPath();
            ctx.arc(gx, gy, 5.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(11, 16, 24, 0.92)';
            ctx.fill();
            ctx.strokeStyle = '#edb75f';
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gx - 2.6, gy - 2.6); ctx.lineTo(gx + 2.6, gy + 2.6);
            ctx.moveTo(gx - 2.6, gy + 2.6); ctx.lineTo(gx + 2.6, gy - 2.6);
            ctx.strokeStyle = '#edb75f';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
            if (this.state.showLabels && !isSpoken) {
              this._queueLabel(x, y - 20, '× 嘎查办公院 · 出水口未确认（保留断口）', isSel ? '#ffffff' : '#edb75f', isSel ? 0 : 1);
            }
          } else if (this.state.showLabels && !isSpoken && (isSel || isRel || ['snow-sites', 'road-review', 'regional-reference', 'west-slope-review', 'bridge-f1-anchors', 'marsh-review'].includes(ly) || (ly==='catchment-screen-nw-network'&&!this.state.guidedTerrain&&!/pin[1-4]$/.test(f.id)) || (ly === 'east-profiles' && this.cam.ppm > 0.14))) {
            const rawName = (f.properties?.name || f.id).split(' · ')[0];
            const shortName = f.id === 'west-slope-f1-bridge' ? '三八水库中桥（F1）'
              : f.id === 'west-slope-old-bend' ? '桥东老转折窗口'
              : f.id === 'west-slope-old-ne-fade' ? '东北暗纹消散端'
              : f.id === 'bridge-f1-se-fade' ? '东南暗纹消散端'
              : f.id === 'west-slope-model-cross' ? '北侧模型跨路点（非桥）'
              : f.id === 'atlas-east-marsh-review' ? '东部泥沼查看点'
              : rawName;
            this._queueLabel(x, y - 16, `${spec.symbol} ${shortName}`, isSel ? '#ffffff' : spec.stroke, isSel ? 0 : 2);
          }
          continue;
        }

        if (gt === 'LineString' || gt === 'MultiLineString') {
          // Preserve explicit visual gap outside office-service so downstream model traces never appear attached to an unconfirmed outfall
          const isOfficeTrace = f.id === 'atlas-office-trace-main_raw' || f.id === 'atlas-office-trace-main_historical_filled';
          const geomToDraw = isOfficeTrace && gt === 'LineString' && f.geometry.coordinates.length > 3
            ? { type: 'LineString', coordinates: f.geometry.coordinates.slice(2) }
            : f.geometry;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          this._traceGeom(ctx, geomToDraw);
          {
            ctx.save();
            const backgroundRoad=ly==='secondary-roads'&&!isSel&&!isSpoken;
            ctx.strokeStyle = spec.casing || MAP_CONTRAST.casing;
            if(spec.dash)ctx.setLineDash(spec.dash);
            if(backgroundRoad)ctx.globalAlpha=.26;
            ctx.lineWidth = (isSel ? spec.lineWidth + 1.8 : spec.lineWidth) + (backgroundRoad?.5:1.5);
            ctx.stroke();ctx.restore();
          }
          if (isSpoken) {
            ctx.save();
            ctx.strokeStyle = 'rgba(212, 175, 106, 0.36)';
            ctx.lineWidth = spec.lineWidth + 4.2;
            ctx.stroke();
            ctx.restore();
          }
          if (isSel) {
            ctx.save();
            ctx.strokeStyle = 'rgba(244, 241, 234, 0.72)';
            if(spec.dash)ctx.setLineDash(spec.dash);
            ctx.lineWidth = spec.lineWidth + 3.0;
            ctx.stroke();
            ctx.restore();
          }
          if (spec.dash) ctx.setLineDash(spec.dash);
          ctx.strokeStyle = isSpoken && !isSel ? '#E7CC96' : spec.stroke;
          ctx.lineWidth = isSel ? spec.lineWidth + 0.9 : isSpoken ? spec.lineWidth + 0.85 : isRel ? spec.lineWidth + 0.4 : spec.lineWidth;
          ctx.stroke();
          ctx.restore();

          // Midpoint × badge on dotted gap lines so connectivity breaks read immediately as ┄ × ┄
          if (spec.semanticTone === 'gap' && gt === 'LineString' && geomToDraw.coordinates.length >= 2) {
            const pts = geomToDraw.coordinates;
            const mid = pts[Math.floor(pts.length / 2)];
            const prev = pts[Math.max(0, Math.floor(pts.length / 2) - 1)];
            const mx = this.lonToX((mid[0] + prev[0]) * 0.5);
            const my = this.latToY((mid[1] + prev[1]) * 0.5);
            this._drawPointSymbol(ctx, mx, my, '×', isSel ? '#F4F1EA' : spec.stroke, null, false);
          }

          // Open-circle endpoints (○···○) on hand-drawn sketch lines (never directional arrows)
          if ((ly === 'owner-blue-201909' || ly === 'west-slope-user-sketch') && gt === 'LineString' && geomToDraw.coordinates.length >= 2) {
            ctx.save();
            for (const endPt of [geomToDraw.coordinates[0], geomToDraw.coordinates[geomToDraw.coordinates.length - 1]]) {
              const ex = this.lonToX(endPt[0]), ey = this.latToY(endPt[1]);
              ctx.beginPath();
              ctx.arc(ex, ey, 2.7, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(14, 15, 18, 0.88)';
              ctx.fill();
              ctx.strokeStyle = isSel ? '#F4F1EA' : spec.stroke;
              ctx.lineWidth = 1.25;
              ctx.stroke();
            }
            ctx.restore();
          }
          continue;
        }

        if (gt === 'Polygon' || gt === 'MultiPolygon') {
          ctx.save();
          ctx.beginPath();
          this._traceGeom(ctx, f.geometry);
          if (spec.hatch && this._patterns[spec.hatch]) {
            ctx.fillStyle = this._patterns[spec.hatch];
            ctx.fill('evenodd');
          } else if (spec.fill) {
            ctx.fillStyle = isSpoken ? 'rgba(244, 211, 120, 0.24)' : spec.fill;
            ctx.fill('evenodd');
          }
          if (isSpoken) {
            ctx.save();
            ctx.strokeStyle = 'rgba(244, 211, 120, 0.45)';
            ctx.lineWidth = spec.lineWidth + 4.5;
            ctx.stroke();
            ctx.restore();
          }
          if (isSel) {
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = spec.lineWidth + 2.4;
            ctx.stroke();
            ctx.restore();
          }
          if (spec.dash) ctx.setLineDash(spec.dash);
          ctx.strokeStyle = isSpoken && !isSel ? '#f4d378' : spec.stroke;
          ctx.lineWidth = isSel || isSpoken ? spec.lineWidth + 1.1 : spec.lineWidth;
          ctx.stroke();
          ctx.restore();

          const datedLabel=datedWaterMapLabel(f);
          if (this.state.showLabels && (datedLabel || isSel || isSpoken || ly === 'road-review')) {
            const b = geometryBounds(f.geometry);
            if (b) {
              const tx = this.lonToX((b[0] + b[2]) * 0.5);
              const ty = this.latToY(b[3]) - 11;
              const lbl = datedLabel || (ly === 'road-review' ? '◇ G332 跨路检查' : `${spec.symbol} ${Array.from(translateAtlas(f.properties?.name || f.id)).slice(0, atlasLanguage() === 'en' ? 42 : 18).join('')}`);
              this._queueLabel(tx, ty, lbl, isSel ? '#ffffff' : isSpoken ? '#f4d378' : spec.stroke, (isSel || isSpoken || datedLabel) ? 0 : 2);
            }
          }
        }
      }
    }
    const f=this.state.profileHighlightId&&this.state.analysisFeatures.find(x=>x.id===this.state.profileHighlightId);
    if(f&&!this.state.hiddenFeatureIds?.has(f.id)&&(this.state.visibleLayers.has(f.properties?.layer)||this.state.scopeFeatureIds?.has(f.id))&&['LineString','MultiLineString'].includes(f.geometry?.type)) {
      const spec=getFeatureVisualSpec(f);
      ctx.save();ctx.beginPath();this._traceGeom(ctx,f.geometry);
      if(spec.dash)ctx.setLineDash(spec.dash);
      ctx.lineJoin='round';ctx.lineCap='round';
      ctx.strokeStyle='rgba(9, 10, 12, .74)';ctx.lineWidth=6.5;ctx.stroke();
      ctx.strokeStyle='#F4F1EA';ctx.lineWidth=3.6;ctx.stroke();
      ctx.strokeStyle=spec.stroke;ctx.lineWidth=1.9;ctx.stroke();
      ctx.restore();
    }
  }

  _renderSoutheastInspection(ctx) {
    const se = this.state.southeastInspection;
    if (!se || !se.enabled || !se.cells?.length) return;
    const light = this.state.theme === 'light';

    // 1. Draw exact native 0.00025° WGS84 grid cells (never interpolated, never connected by flow lines)
    for (const cell of se.cells) {
      ctx.save();
      ctx.beginPath();
      this._traceGeom(ctx, cell.polygon);
      if (cell.state === 'water_main') {
        ctx.fillStyle = 'rgba(14, 165, 233, 0.58)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      } else if (cell.state === 'water_separate') {
        ctx.fillStyle = this._patterns.seSeparate || 'rgba(245, 158, 11, 0.42)';
        ctx.fill();
        ctx.setLineDash([4, 2]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else if (cell.state === 'nodata') {
        ctx.fillStyle = this._patterns.seNodata || 'rgba(148, 163, 184, 0.48)';
        ctx.fill();
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.9;
        ctx.stroke();
      } else if (cell.state === 'error') {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(225, 29, 72, 0.72)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      } else if (cell.state === 'pending') {
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      } else {
        // valid_nonwater or footprint: transparent outline only (NOT dry soil fill!)
        ctx.strokeStyle = light ? 'rgba(30, 41, 59, 0.45)' : 'rgba(226, 232, 240, 0.36)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
      ctx.restore();

      // When zoomed close, show exact 0-based [r,c] tag for nodata cells so [62,127] is unmistakable
      if (cell.state === 'nodata' && this.cam.ppm >= 0.42) {
        const ring = cell.polygon.coordinates[0];
        const cx = this.lonToX((ring[0][0] + ring[2][0]) * 0.5);
        const cy = this.latToY((ring[0][1] + ring[2][1]) * 0.5);
        this._queueLabel(cx, cy, `缺测 [${cell.row},${cell.col}]`, '#94a3b8', 0);
      }
    }

    // 2. Draw frozen historical model anchor crosshair (never moves between months)
    if (Array.isArray(se.anchor) && se.anchor.length === 2) {
      const ax = this.lonToX(se.anchor[0]);
      const ay = this.latToY(se.anchor[1]);
      const radPx = Math.max(8, se.radiusM * this.cam.ppm);
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, radPx, 0, Math.PI * 2);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = se.kind === 'water_separate' ? '#f59e0b' : se.kind === 'error' ? '#e11d48' : '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Diamond crosshair at anchor
      ctx.beginPath();
      ctx.moveTo(ax, ay - 6);
      ctx.lineTo(ax + 6, ay);
      ctx.lineTo(ax, ay + 6);
      ctx.lineTo(ax - 6, ay);
      ctx.closePath();
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();

      const borderCol =
        se.kind === 'water_main' ? '#38bdf8' :
        se.kind === 'water_separate' ? '#f59e0b' :
        se.kind === 'error' ? '#e11d48' : '#94a3b8';
      const relShort =
        se.kind === 'water_main' ? '与主盆同一分类水斑' :
        se.kind === 'water_separate' ? '未与主盆水斑连片' :
        se.kind === 'partial_nodata_zero' ? `0水·${se.validCount}有效·${se.nodataCount}缺测` :
        se.kind === 'valid_zero' ? '未检出明水(全有效)' :
        se.kind === 'loading' ? '加载中…' :
        se.kind === 'error' ? '加载失败' : '验收窗';
      this._queueLabel(ax, ay - radPx - 14, `${se.windowShortLabel} · ${se.date} · ${relShort}`, borderCol, 0);
    }
  }

  _renderProfileCursor(ctx) {
    const cur = this.state.profileCursor;
    if (!cur || !Number.isFinite(cur.lon) || !Number.isFinite(cur.lat)) return;
    const x = this.lonToX(cur.lon);
    const y = this.latToY(cur.lat);
    ctx.save();
    // Soft misty ice-cyan ambient halo + precision ground reticle
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(116, 184, 220, 0.16)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 10.5, 0, Math.PI * 2);
    ctx.strokeStyle = PROFILE_CURSOR_RING.casing;
    ctx.lineWidth = PROFILE_CURSOR_RING.casingWidth2d;
    ctx.stroke();
    ctx.strokeStyle = PROFILE_CURSOR_RING.core;
    ctx.lineWidth = PROFILE_CURSOR_RING.width2d;
    ctx.stroke();

    // Precision 0.85px optical crosshair
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x - 5.5, y);
    ctx.moveTo(x + 5.5, y);
    ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x, y - 5.5);
    ctx.moveTo(x, y + 5.5);
    ctx.lineTo(x, y + 16);
    ctx.strokeStyle = 'rgba(116, 184, 220, 0.90)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = '#F4F1EA';
    ctx.fill();
    ctx.strokeStyle = '#74B8DC';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    this._queueLabel(x, y - 24, `剖面点 ${cur.distance_m.toFixed(0)}m · ${describeProfileCursorElevation(cur)}`, '#74B8DC', 0);
    ctx.restore();
  }

  _render() {
    const ctx = this.ctx;
    this._labelQueue = [];
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Warm basalt dark or museum alabaster paper map well
    const light = this.state.theme === 'light';
    ctx.fillStyle = light ? '#ece8df' : '#090a0c';
    ctx.fillRect(0, 0, this.width, this.height);

    // 1. Basemap raster aligned strictly to each scene's own bounds_wgs84 (fallback AOI_BOUNDS)
    const [w, s, e, n] = AOI_BOUNDS;
    const x0 = this.lonToX(w);
    const y0 = this.latToY(n);
    const rw = this.lonToX(e) - x0;
    const rh = this.latToY(s) - y0;

    const spec = this._selectedImageSpec();
    const im = this._getSelectedImage();
    const ready = im?.complete && im.naturalWidth > 0;
    // Do not rasterize 108k elevations eagerly while a valid image is
    // downloading. Explicit DEM mode and failed/missing imagery retain relief.
    if (!ready && !this._terrainRaster && (!im || im.complete)) {
      this._terrainRaster = this._buildTerrainRaster(this.state.dem);
    }
    if (this.state.basemap === 'dem-relief' && this._terrainRaster) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this._terrainRaster, x0, y0, rw, rh);
    } else {
      if (ready) {
        const [iw, is_, ie, in_] = Array.isArray(spec?.bounds_wgs84) && spec.bounds_wgs84.length === 4
          ? spec.bounds_wgs84 : AOI_BOUNDS;
        const ix0 = this.lonToX(iw);
        const iy0 = this.latToY(in_);
        const irw = this.lonToX(ie) - ix0;
        const irh = this.latToY(is_) - iy0;
        ctx.imageSmoothingEnabled = this.cam.ppm < 0.25;
        ctx.drawImage(im, ix0, iy0, irw, irh);
      } else if (this._terrainRaster) {
        ctx.drawImage(this._terrainRaster, x0, y0, rw, rh);
      }
    }

    const detail=this._nativeDetail;
    if(ready&&detail?.spec.parentSceneId===this.state.basemap&&detail.image.naturalWidth){
      const [dw,ds,de,dn]=detail.spec.bounds_wgs84;
      const x=this.lonToX(dw),y=this.latToY(dn);
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(detail.image,x,y,this.lonToX(de)-x,this.latToY(ds)-y);
    }

    // Subtle AOI frame boundary & graticule
    ctx.save();
    ctx.strokeStyle = light ? 'rgba(24, 22, 18, 0.20)' : 'rgba(244, 241, 234, 0.14)';
    ctx.lineWidth = 0.85;
    ctx.setLineDash([3, 4]);
    ctx.strokeRect(x0, y0, rw, rh);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = light ? 'rgba(24, 22, 18, 0.06)' : 'rgba(244, 241, 234, 0.05)';
    ctx.lineWidth = 0.65;
    for (let lon = 119.62; lon <= 119.761; lon += 0.02) {
      const gx = this.lonToX(lon);
      ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + rh); ctx.stroke();
    }
    for (let lat = 49.11; lat <= 49.171; lat += 0.01) {
      const gy = this.latToY(lat);
      ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + rw, gy); ctx.stroke();
    }
    ctx.restore();

    this._renderContours(ctx);
    this._renderSlopeAspect(ctx);

    // 2. Water monthly layers + separate fixed boundaries
    this._renderWaterLayer(ctx);

    // 2b. Southeast same-location native grid inspection overlay (when active)
    this._renderSoutheastInspection(ctx);

    // 3. Analysis vector overlays
    this._renderAnalysisLayers(ctx);

    // 3b. Field Crossing unconfirmed-gap callout (never draws a flow line!)
    if (this.state.crossingCompare?.mode === 'f1_bridge' && this.state.showLabels && this.cam.ppm >= 0.08) {
      const mx = this.lonToX(119.6543);
      const my = this.latToY(49.14722);
      this._queueLabel(mx, my + 16, '┄ 桥东→老转折约 717 m · 首查连通（不画实线）', '#f4d378', 1);
    }

    // 4. Pinned profile cursor
    this._renderProfileCursor(ctx);

    // 5. Collision-free prioritized pill labels
    this._flushLabels(ctx);

    ctx.restore();
    if (!this._firstBasemapPainted && (ready || this._terrainRaster)) {
      this._firstBasemapPainted = true;
      this.cb.onFirstBasemap?.();
    }
  }

  _loop(now = performance.now()) {
    this._raf = 0;
    if (!this.active || document.hidden) return;
    this._stepCamera(now);
    if (this._needsRender) {
      this._needsRender = false;
      this._render();
    }
    if (this.cb.onCameraChange) this._flushCamera();
    this._flushCursor();
    if (this._flyAnim) this._requestFrame();
  }
}

