import { translateAtlas } from './atlas-i18n.js?v=40';
import { detailUvBounds, applyNativeDetailSet } from './native-detail-3d.js';
import { walkClipForHeight } from './terrain-walk.js';
/* ==========================================================================
   app/map-3d.js
   Three.js r160.1 WebGL 3D Terrain & Spatial Evidence Engine.
   - Exact 392x276 point-node DEM lattice (boundaries aligned to bounds_wgs84).
   - Barycentric triangle-exact surface sampling for draped vectors & profile pin.
   - Live projected geographic North azimuth callback for dynamic compass rose.
   - Explicit surface-anchored 3D profile cursor (ring flush on ground + stem).
   - Screen-projected picking preserving exact feature.id across 2D <-> 3D.
   ========================================================================== */

import {
  AOI_BOUNDS,
  lonLatToLocalKm,
  localKmToLonLat,
  sampleDemElevation,
  buildDemMeshData,
  geometryBounds,
} from './terrain-math.js';
import { getFeatureVisualSpec, describeWaterMonth, describeProfileCursorElevation } from './view-model.js';
import { datedWaterMapLabel } from './waterway-map-policy.js';
import { ANALYSIS_PALETTE, MAP_CONTRAST, PROFILE_CURSOR_RING } from './atlas-visual-policy.js';
import {nearbyContours} from './contour-controls.js';
import { pickFeatureUnified, densifyLineCoords } from './geo-pick.js';

const MAX_ORBIT_RADIUS_KM = 65;

export class AtlasMap3D {
  constructor(stageEl, labelEl, callbacks = {}) {
    this.stageEl = stageEl;
    this.labelEl = labelEl;
    this.cb = callbacks;
    this.failed = false;
    this.active = false;
    this.exag = 8;
    this.baseElev = 607.5;

    // Orbit camera around target (xKm, zKm) with frame-rate-independent damping
    this.orbit = {
      targetX: 0,
      targetZ: 0,
      radius: 10.5,
      pitchDeg: 44,
      azimuthDeg: 0, // 0 = True Geographic North up (-Z)
    };
    this._targetOrbit = { ...this.orbit };
    this._reducedMotion = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
    this._lastFrameTime = 0;
    this._flyAnim = null;
    this._raf = 0;
    this._dirtyMesh = true;
    this._dirtyOverlays = true;
    this._dirtyCursor = true;
    this._dirtyContours = true;
    this._dirtySlope = true;
    this._cursorAnchor = null;
    this._hover = null;
    this._drawPending = false;
    this._drawFrame = now => this._loop(now);
    this._dirtyTexture = true;

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

    this._textures = new Map();
    this._demTexture = null;
    this._labelAnchors = [];
    this._pointers = new Map();
    this._drag = null;
    this._pinch = null;
    this._didDrag = false;

    this._initGL();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this._hover = null;
          this._lastFrameTime = 0;
          if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = 0;
          }
        } else if (this.active && !this.failed) {
          this._invalidate();
        }
      });
    }
  }

  _initGL() {
    const THREE = window.THREE;
    if (!THREE) {
      this.failed = true;
      return;
    }
    try {
      this._touchDisplay = window.matchMedia?.('(pointer: coarse)')?.matches === true;
      this.renderer = new THREE.WebGLRenderer({ antialias: !this._touchDisplay, alpha: true, powerPreference: 'high-performance' });
      const gl = this.renderer.getContext?.();
      if (!gl || (typeof gl.isContextLost === 'function' && gl.isContextLost())) {
        throw new Error('WebGL context unavailable');
      }
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._touchDisplay ? 1.25 : 2));
      this.renderer.setClearColor(0x090a0c, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.04;
      this.stageEl.appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x090a0c, 0.0155);

      this.camera = new THREE.PerspectiveCamera(42, 1.5, 0.04, 120);

      // Soft HemisphereLight + single primary DirectionalLight for calm terrain relief
      this._hemiLight = new THREE.HemisphereLight(0xdce8f4, 0x2b3138, 0.90);
      this._sunLight = new THREE.DirectionalLight(0xfff5e4, 0.80);
      this._sunLight.position.set(-10, 15, -8);
      this.scene.add(this._hemiLight, this._sunLight);

      this.terrainMesh = null;
      this.overlayGroup = new THREE.Group();
      this.cursorGroup = new THREE.Group();
      this.contourGroup = new THREE.Group();
      this.contourGroup.position.y = 0.002;
      this.contourGroup.scale.y = this.exag;
      this.slopeGroup=new THREE.Group();
      this.slopeGroup.position.y=.0016;this.slopeGroup.scale.y=this.exag;
      this.scene.add(this.contourGroup,this.slopeGroup, this.overlayGroup, this.cursorGroup);

      // Runtime WebGL context loss guard: gracefully fall back to operable 2D
      this.renderer.domElement.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        this._handleContextLost('webglcontextlost');
      });

      this._bindEvents();
      this.resize();
    } catch (err) {
      console.warn('WebGL 3D init failed, falling back to 2D:', err);
      if (this.renderer?.domElement?.parentElement === this.stageEl) {
        this.stageEl.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
      this.failed = true;
    }
  }

  _handleContextLost(reason = 'webglcontextlost') {
    if (this.failed) return;
    const focus = this.getCameraFocus();
    this.failed = true;
    this.active = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    this._pointers.clear();
    this._drag = null;
    this._pinch = null;
    if (this.labelEl) this.labelEl.innerHTML = '';
    if (this.cb.onContextLost) {
      this.cb.onContextLost({ reason, focus });
    }
  }

  _applyTheme(theme) {
    const THREE = window.THREE;
    if (!THREE || !this.renderer || !this.scene) return;
    const light = theme === 'light';
    const bgHex = light ? 0xece8df : 0x090a0c;
    // Both themes show the backdrop below the transparent map canvas.
    this.renderer.setClearColor(bgHex, 0);
    if (this.scene.fog) {
      this.scene.fog.color.setHex(bgHex);
      this.scene.fog.density = light ? 0.0095 : 0.0155;
    }
    if (this._hemiLight) {
      this._hemiLight.color.setHex(light ? 0xfffaf0 : 0xedeae2);
      this._hemiLight.groundColor.setHex(light ? 0x9b9284 : 0x24262b);
      if(!this._walkView?.solarLighting)this._hemiLight.intensity = light ? 0.96 : 0.90;
    }
    this._invalidate();
  }

  _invalidate(draw = true) {
    this._drawPending ||= draw;
    if (this.active && !this.failed && !this._raf && !(typeof document !== 'undefined' && document.hidden)) {
      this._raf = requestAnimationFrame(this._drawFrame);
    }
  }

  setActive(enable) {
    if (this.failed) return;
    this.active = Boolean(enable);
    if (this.active) {
      this._lastFrameTime = 0;
      this.resize();
      this._invalidate();
    } else {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      this._lastFrameTime = 0;
      this._hover = null;
      this._flyAnim = null;
      if (this._targetOrbit) Object.assign(this._targetOrbit, this.orbit);
      this._pointers.clear();
      this._drag = this._pinch = null;
    }
  }

  enterTerrainWalk(referenceLine=[]){
    if(this.failed||this._walkView||!this.camera)return false;
    this._walkView={orbit:{...this.orbit},exag:this.exag,near:this.camera.near,far:this.camera.far,
      sunlight:this._sunLight.position.clone(),intensity:this._sunLight.intensity,hemi:this._hemiLight.intensity,theme:this.state.theme,pose:null,referenceLine};
    this._flyAnim=null;this._pointers.clear();this._drag=this._pinch=null;
    this._dirtyTexture=this._dirtyOverlays=this._dirtyCursor=true;
    this.camera.near=.0005;this.camera.far=22;this.camera.updateProjectionMatrix();
    if(this.contourGroup)this.contourGroup.position.y=.00012;
    this._invalidate();
    return true;
  }

  hasAerialFramingRoom(lon,lat){
    const b=this.state.dem?.bounds_wgs84;
    return Boolean(b&&lon>=b[0]-.13&&lon<=b[2]+.13&&lat>=b[1]-.08&&lat<=b[3]+.08);
  }

  hasWalkGround(lon,lat){
    const B=this.state.dem?.bounds_wgs84;
    return Boolean(B&&lon>=B[0]&&lon<=B[2]&&lat>=B[1]&&lat<=B[3]&&Number.isFinite(sampleDemElevation(this.state.dem,lon,lat)));
  }

  setTerrainWalkPose(pose,sun,{simulatedSky=true}={}){
    if(!this._walkView||!pose||![pose.lon,pose.lat,pose.heading,pose.eyeM].every(Number.isFinite))return false;
    if(!this.hasWalkGround(pose.lon,pose.lat)){
      const b=this.state.dem?.bounds_wgs84;
      // A director-only aerial viewpoint may lie outside the map crop. It uses
      // an explicit boundary elevation as datum, never extrapolated terrain.
      if(!b||(pose.site!=='guided'&&!pose.outsideTerrain)||!Number.isFinite(pose.guideOriginM)||
        !this.hasAerialFramingRoom(pose.lon,pose.lat))return false;
    }
    this._walkView.pose={...pose};
    if(this._walkView.marker)this._walkView.marker.visible=pose.site==='road';
    if(sun?.vector){
      this._sunLight.position.set(...sun.vector).multiplyScalar(20);
      this._sunLight.intensity=sun.altitude>0?.65+.4*Math.sin(sun.altitude*Math.PI/180):0;
      this._hemiLight.intensity=sun.altitude>0?.70:.27;
      this._walkView.solarLighting=true;
    }
    if(sun?.vector&&simulatedSky){
      const T=window.THREE;
      (this._walkView.sky??=new T.Color()).set(sun.altitude<=0?0x192436:sun.altitude<18?0xa9b2bd:0x9bbbd2);
      this.scene.background=this._walkView.sky;
    }else this.scene.background=null;
    this._invalidate();
    return true;
  }

  setGuidedRoadPath(paths = [], {color=0xffe68a,dashed=false,context=[]}={}) {
    const walk=this._walkView;
    if(!walk)return;
    if(walk.guidedRoad){
      this.scene.remove(walk.guidedRoad);
      this._disposeGroup(walk.guidedRoad);
      walk.guidedRoad=null;
    }
    if(paths.length||context.length){
      const group=new window.THREE.Group();
      const points=paths.map(path=>densifyLineCoords(path,.00007).map(([lon,lat])=>this.point3(lon,lat,.0018)));
      if(points.length)this._addCasedSegments(group,points,{color,dashed,halfWidth:5,opacity:1});
      for(const ref of context){
        const coords=densifyLineCoords(ref.coords,.00010).map(([lon,lat])=>this.point3(lon,lat,.0015));
        this._addCasedSegments(group,[coords],{color:ref.color,dashed:ref.dashed,dashKm:ref.dashKm,halfWidth:ref.halfWidth??3.1,opacity:ref.opacity??.95});
      }
      this.scene.add(group);walk.guidedRoad=group;
    }
    this._invalidate();
  }

  leaveTerrainWalk(){
    const restore=this._walkView;
    if(!restore)return;
    this.setGuidedRoadPath();
    this._walkView=null;
    Object.assign(this.orbit,restore.orbit);
    if(this._targetOrbit)Object.assign(this._targetOrbit,this.orbit);
    this.setExaggeration(restore.exag);
    this.camera.near=restore.near;this.camera.far=restore.far;this.camera.updateProjectionMatrix();
    this.scene.background=null;
    this._applyTheme(this.state.theme);
    if(restore.marker){this.scene.remove(restore.marker);restore.marker.geometry.dispose();restore.marker.material.dispose();}
    this._sunLight.position.copy(restore.sunlight);
    this._sunLight.intensity=restore.intensity;
    if(restore.theme===this.state.theme)this._hemiLight.intensity=restore.hemi;
    this._dirtyTexture=this._dirtyOverlays=this._dirtyCursor=true;
    if(this.contourGroup)this.contourGroup.position.y=.002;
    this._invalidate();
  }

  terrainWalkSnapshot(){
    if(!this._walkView?.pose)return null;
    const q=this._walkView.pose;
    const T=window.THREE,ground=this.point3(q.lon,q.lat,0);
    const ray=new T.Raycaster(new T.Vector3(ground.x,ground.y+1,ground.z),new T.Vector3(0,-1,0));
    const terrainRayY=this.terrainMesh ? (ray.intersectObject(this.terrainMesh,false)[0]?.point.y??null) : null;
    return {pose:q,exag:this.exag,near:this.camera.near,far:this.camera.far,groundElevation:sampleDemElevation(this.state.dem,q.lon,q.lat),cameraY:this.camera.position.y,groundY:ground.y,terrainRayY,contourBatches:this.contourGroup.children.length,contourExag:this.contourGroup.scale.y,
      light:this._sunLight.position.toArray(),sunIntensity:this._sunLight.intensity,overlaysVisible:this.overlayGroup.visible,overlayObjects:this.overlayGroup.children.length,basemap:this.state.basemap,
      bearing:this.getOrbitBearing()};
  }

  setExaggeration(exag) {
    const value = Number(exag) || 4;
    if (value === this.exag) return;
    this.exag = value;
    if (this.contourGroup) this.contourGroup.scale.y = value;
    if (this.slopeGroup) this.slopeGroup.scale.y=value;
    const marker=this._walkView?.marker;
    if(marker){this.scene.remove(marker);marker.geometry.dispose();marker.material.dispose();this._walkView.marker=null;}
    this._dirtyMesh = this._dirtyOverlays = this._dirtyCursor = true;
    this._invalidate();
  }

  setState(patch) {
    const prev = this.state;
    const next = { ...prev, ...patch };
    const sameSet = (a, b) => a === b || (a?.size === b?.size && a && b && [...a].every(x => b.has(x)));
    const a = prev.profileCursor;
    const b = next.profileCursor;
    const cursorChanged = a !== b && (!a || !b ||
      a.lon !== b.lon || a.lat !== b.lat ||
      a.distance_m !== b.distance_m || a.glo30_m !== b.glo30_m || a.waterMasked !== b.waterMasked);
    this.state = next;
    const demChanged = next.dem && next.dem !== prev.dem;
    if (demChanged) {
      this.baseElev = Math.min(...next.dem.elevations_m);
      this._dirtyMesh = this._dirtyOverlays = this._dirtyCursor = true;
      this._demTexture?.dispose();
      this._demTexture = this._buildDemTexture(next.dem);
    }
    if (next.basemap !== prev.basemap || next.imageryById !== prev.imageryById) {
      this._dirtyTexture = true;
    }
    if (next.waterMonth !== prev.waterMonth ||
        next.lakeView !== prev.lakeView ||
        next.analysisFeatures !== prev.analysisFeatures ||
        next.profileHighlightId !== prev.profileHighlightId ||
        !sameSet(next.visibleLayers, prev.visibleLayers) ||
        next.scopeFeatureIds!==prev.scopeFeatureIds ||
        next.hiddenFeatureIds!==prev.hiddenFeatureIds ||
        !sameSet(next.spokenFeatureIds, prev.spokenFeatureIds) ||
        !sameSet(next.spokenLakeIds, prev.spokenLakeIds) ||
        next.selectedFeatureId !== prev.selectedFeatureId ||
        next.southeastInspection !== prev.southeastInspection ||
        next.crossingCompare !== prev.crossingCompare ||
        next.showLabels !== prev.showLabels) {
      this._dirtyOverlays = true;
    }
    if (next.theme !== prev.theme) {
      this._applyTheme(next.theme);
    }
    if (cursorChanged || next.guidedTerrain!==prev.guidedTerrain) this._dirtyCursor = true;
    if (demChanged || next.guidedTerrain!==prev.guidedTerrain || next.contourFeatures !== prev.contourFeatures) this._dirtyContours = true;
    if(demChanged||next.slopeAspect!==prev.slopeAspect)this._dirtySlope=true;
    if (next.labelLanguage !== prev.labelLanguage) this._invalidate();
    if (this._dirtyMesh || this._dirtyOverlays || this._dirtyTexture || this._dirtyCursor || this._dirtyContours||this._dirtySlope) {
      this._invalidate();
    }
  }

  resize() {
    if (this.failed || !this.renderer) return;
    const rect = this.stageEl.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._touchDisplay ? 1.25 : 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this._invalidate();
  }

  point3(lon, lat, liftKm = 0.014) {
    const THREE = window.THREE;
    const [x, z] = lonLatToLocalKm(lon, lat, this.state.dem?.bounds_wgs84 || AOI_BOUNDS);
    const elev = sampleDemElevation(this.state.dem, lon, lat);
    const y = (((elev ?? this.baseElev) - this.baseElev) / 1000) * this.exag + liftKm;
    return new THREE.Vector3(x, y, z);
  }

  getOrbitBearing() { return ((-this.orbit.azimuthDeg%360)+360)%360; }

  getCameraFocus() {
    const [lon, lat] = localKmToLonLat(this.orbit.targetX, this.orbit.targetZ, this.state.dem?.bounds_wgs84 || AOI_BOUNDS);
    const spanKm = Math.max(0.8, this.orbit.radius * 0.72);
    return { lon, lat, spanKm };
  }

  flyTo({ lon, lat, spanKm = 8, pitchDeg = null, azimuthDeg = null, duration } = {}) {
    if(this._walkView)return;
    const [tx, tz] = lonLatToLocalKm(lon, lat, this.state.dem?.bounds_wgs84 || AOI_BOUNDS);
    const tr = Math.max(1.2, Math.min(26, spanKm / 0.72));
    const tp = pitchDeg !== null ? pitchDeg : this.orbit.pitchDeg;
    const ta = azimuthDeg !== null ? azimuthDeg : this.orbit.azimuthDeg;
    const instant = duration <= 0 || this._reducedMotion?.matches;
    if (instant) {
      this._flyAnim = null;
      this.orbit.targetX = tx;
      this.orbit.targetZ = tz;
      this.orbit.radius = tr;
      this.orbit.pitchDeg = tp;
      this.orbit.azimuthDeg = ta;
      if (this._targetOrbit) Object.assign(this._targetOrbit, this.orbit);
      this._invalidate();
      return;
    }
    const distKm = Math.hypot(tx - this.orbit.targetX, tz - this.orbit.targetZ);
    const logR = Math.log(tr / Math.max(0.5, this.orbit.radius));
    const autoMs = Math.min(540, Math.max(220, Math.round(210 + distKm * 28 + Math.abs(logR) * 115)));
    this._flyAnim = {
      t0: performance.now(),
      dur: Number.isFinite(duration) ? duration : autoMs,
      sx: this.orbit.targetX,
      sz: this.orbit.targetZ,
      sr: this.orbit.radius,
      sp: this.orbit.pitchDeg,
      sa: this.orbit.azimuthDeg,
      ex: tx,
      ez: tz,
      er: tr,
      ep: tp,
      ea: ta,
      logR,
    };
    this._invalidate();
  }

  fitVisibleTracks(coords, rect) {
    if(!coords?.length||!rect||!this.camera||!this.width||!this.height)return;
    const THREE=window.THREE;
    const bounds=this.state.dem?.bounds_wgs84||AOI_BOUNDS;
    const pts=coords.map(([lon,lat])=>this.point3(lon,lat,.034));
    const box=new THREE.Box3().setFromPoints(pts), center=box.getCenter(new THREE.Vector3());
    const cam=this.camera.clone(), pitch=this.orbit.pitchDeg*Math.PI/180, az=this.orbit.azimuthDeg*Math.PI/180;
    const left=rect.left, right=rect.right, top=rect.top, bottom=rect.bottom;
    const cx=(left+right)/2, cy=(top+bottom)/2;
    const vw=Math.max(1,right-left),vh=Math.max(1,bottom-top);
    let x=center.x,z=center.z;
    let radius=Math.max(1.2,Math.max(box.max.x-box.min.x,box.max.z-box.min.z)*1.9);
    const project=(tx,tz,rad)=>{
      const h=rad*Math.cos(pitch);
      cam.position.set(tx+h*Math.sin(az),.06+rad*Math.sin(pitch),tz+h*Math.cos(az));
      cam.lookAt(tx,.06,tz);cam.updateMatrixWorld();
      let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity,behind=false;
      for(const pt of pts){
        const v=pt.clone().project(cam);if(v.z < -1||v.z>1)behind=true;
        const px=(v.x+1)*this.width/2,py=(1-v.y)*this.height/2;
        l=Math.min(l,px);r=Math.max(r,px);t=Math.min(t,py);b=Math.max(b,py);
      }
      return {x:(l+r)/2,y:(t+b)/2,w:r-l,h:b-t,behind};
    };
    for(let i=0;i<16;i++){
      const q=project(x,z,radius);
      if(q.behind||!Number.isFinite(q.x+q.y)){radius=Math.min(26,radius*1.38);continue;}
      const ex=cx-q.x,ey=cy-q.y;
      const moving=Math.abs(ex)+Math.abs(ey)>3;
      if(moving){
        const step=.016, u=project(x+step,z,radius),v=project(x,z+step,radius);
        const a=(u.x-q.x)/step,b=(v.x-q.x)/step,c=(u.y-q.y)/step,d=(v.y-q.y)/step,det=a*d-b*c;
        if(Number.isFinite(det)&&Math.abs(det)>1e-6){
          const limit=radius*.5;
          x+=Math.max(-limit,Math.min(limit,(ex*d-b*ey)/det));
          z+=Math.max(-limit,Math.min(limit,(a*ey-ex*c)/det));
        }
      }
      const ratio=Math.max(q.w/(vw*.87),q.h/(vh*.81));
      if(ratio>1.02)radius=Math.min(26,radius*Math.min(1.65,ratio*1.06));
      else if(!moving)break;
    }
    const [lon,lat]=localKmToLonLat(x,z,bounds);
    if(Number.isFinite(lon+lat))this.flyTo({lon,lat,spanKm:radius*.72});
  }

  resetNorth(duration = 360) {
    const cur = this.getCameraFocus();
    this.flyTo({ ...cur, azimuthDeg: 0, pitchDeg: 44, duration });
  }

  zoomBy(factor) {
    this._flyAnim = null;
    const dst = this._targetOrbit || this.orbit;
    dst.radius = Math.max(1.1, Math.min(MAX_ORBIT_RADIUS_KM, dst.radius / factor));
    if (this._reducedMotion?.matches || !this._targetOrbit) {
      this.orbit.radius = dst.radius;
    }
    this._invalidate();
  }

  _buildDemTexture(dem) {
    const THREE = window.THREE;
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
    for (let i = 0; i < el.length; i++) {
      const t = (el[i] - minZ) / span;
      const p = i * 4;
      img.data[p] = Math.round(38 + t * 148);
      img.data[p + 1] = Math.round(62 + t * 116);
      img.data[p + 2] = Math.round(78 + t * 56);
      img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    return tex;
  }

  evictFixedImage(url) {
    for(const [key,texture] of this._textures){
      if(key.startsWith(url+'|')){
        texture.dispose();
        this._textures.delete(key);
      }
    }
  }

  _getBasemapTexture() {
    const THREE = window.THREE;
    if (this.state.basemap === 'dem-relief') return this._demTexture;
    const spec = this.state.imageryById[this.state.basemap];
    if (!spec?.url) return this._demTexture;
    const demB = this.state.dem?.bounds_wgs84 || AOI_BOUNDS;
    const imgB = Array.isArray(spec.bounds_wgs84) && spec.bounds_wgs84.length === 4 ? spec.bounds_wgs84 : demB;
    const cacheKey = `${spec.url}|${imgB.join(',')}`;
    if (this._textures.has(cacheKey)) {
      const cached = this._textures.get(cacheKey);
      return cached.image?.naturalWidth ? cached : this._demTexture;
    }
    // Leave historical and third-party scenes on the existing texture loader.
    const invalidate = () => { this._dirtyTexture = true; this._invalidate(); };
    const tex = spec.image ? new THREE.Texture(spec.image) : new THREE.TextureLoader().load(spec.url,invalidate);
    if(spec.image){
      const upload = () => { tex.needsUpdate=true; invalidate(); };
      if(spec.image.naturalWidth) upload();
      else{
        spec.image.addEventListener('load',upload,{once:true});
        if(!spec.image.src)spec.image.src=spec.url;
      }
    }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const imgW = imgB[2] - imgB[0];
    const imgH = imgB[3] - imgB[1];
    if (imgW > 0 && imgH > 0) {
      tex.repeat.set((demB[2] - demB[0]) / imgW, (demB[3] - demB[1]) / imgH);
      tex.offset.set((demB[0] - imgB[0]) / imgW, (demB[1] - imgB[1]) / imgH);
    }
    this._textures.set(cacheKey, tex);
    return this._demTexture;
  }

  _attachWalkReference(){
    const walk=this._walkView;
    if(!walk||walk.marker||walk.referenceLine.length<2)return;
    const T=window.THREE;
    const pts=densifyLineCoords(walk.referenceLine,.000035).map(([x,y])=>this.point3(x,y,.00018));
    const l=new T.Line(new T.BufferGeometry().setFromPoints(pts),
      new T.LineDashedMaterial({color:0xffe4a0,dashSize:.0024,gapSize:.0015,transparent:true,opacity:.90}));
    l.computeLineDistances();l.visible=walk.pose?.site==='road';
    walk.marker=l;this.scene.add(l);
  }

  setNativeDetail(input) {
    const specs=(Array.isArray(input)?input:input?[input]:[]).slice(0,2);
    const old=this._nativeDetails||[];
    if(old.length===specs.length&&old.every((x,i)=>x.spec.id===specs[i].id))return;
    if(!this.renderer||this.failed)return;
    const T=window.THREE, limit= Math.min(this.renderer.capabilities.maxTextureSize,innerWidth<=760?2560:8192);
    this._nativeDetails=specs.map(spec=>old.find(i=>i.spec.id===spec.id)||{spec,texture:null,loading:false});
    for(const i of old)if(!this._nativeDetails.includes(i))i.texture?.dispose();
    this._nativeDetail=this._nativeDetails[0]??null;
    for(const item of this._nativeDetails){
      if(item.loading||item.texture)continue;
      const spec=item.spec;item.loading=true;
      const image=new Image();
      image.onload=()=>{
        if(!this._nativeDetails?.includes(item)||image.width!==spec.dimensions[0]||image.height!==spec.dimensions[1])return;
        let source=image;
        const scale=Math.min(1,limit/Math.max(image.width,image.height));
        if(scale<1){
          source=document.createElement('canvas');source.width=Math.round(image.width*scale);source.height=Math.round(image.height*scale);
          const ctx=source.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,source.width,source.height);
        }
        const texture=new T.Texture(source);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;
        texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
        texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
        item.texture=texture;this._dirtyTexture=true;this._invalidate();
      };
      image.onerror=()=>{item.failed=true;};
      image.src=spec.url;
    }
    this._dirtyTexture=true;this._invalidate();
  }

  _terrainMaterial(map) {
    const T=window.THREE;
    // Evidence comparison preserves sRGB with restrained atmospheric horizon fog;
    // only the independent roam simulates sunlight.
    const material = !this._walkView && map && map!==this._demTexture
      ? new T.MeshBasicMaterial({map,toneMapped:false,fog:true,side:T.DoubleSide})
      : new T.MeshStandardMaterial({map,roughness:.92,metalness:.04,fog:true,side:T.DoubleSide});
    if(map&&map!==this._demTexture){
      const layers=(this._nativeDetails||[]).filter(i=>i.texture&&i.spec.parentSceneId===this.state.basemap)
        .map(i=>({texture:i.texture,uv:detailUvBounds(this.state.dem?.bounds_wgs84,i.spec.bounds_wgs84)})).filter(i=>i.uv);
      if(layers.length)return applyNativeDetailSet(T,material,layers);
    }
    return material;
  }

  _rebuildTerrainMesh() {
    const THREE = window.THREE;
    const dem = this.state.dem;
    if (!dem) return;
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      this.terrainMesh.material.dispose();
    }
    const { positions, uvs, indices, baseElev } = buildDemMeshData(dem, { baseElev: this.baseElev, exag: this.exag });
    this.baseElev = baseElev;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();

    const mat = this._terrainMaterial(this._getBasemapTexture());
    this.terrainMesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.terrainMesh);
    this._dirtyMesh = false;
    this._dirtyTexture = false;
  }

  _disposeGroup(group) {
    while (group.children.length) {
      const ch = group.children.pop();
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) {
        if (Array.isArray(ch.material)) ch.material.forEach(m => m.dispose());
        else ch.material.dispose();
      }
    }
  }

  _add3DLine(group, coords, { color = 0x5eb8e6, opacity = 0.94, dashed = false, lift = 0.018, halfWidth=1.15 } = {}) {
    const THREE = window.THREE;
    const dense = densifyLineCoords(coords, 0.0008);
    if (dense.length < 2) return;
    const pts = dense.map(c => this.point3(c[0], c[1], lift));
    return this._addCasedSegments(group,[pts],{color,opacity,dashed,halfWidth});
  }

  _addProfileRibbon(group,coords,{color,dashed,lift=.056}){
    const T=window.THREE;
    const points=densifyLineCoords(coords,.00035).map(c=>this.point3(c[0],c[1],lift));
    return this._addCasedSegments(group,[points],{color,dashed,halfWidth:2.9,profile:true});
  }

  _addCasedSegments(group, paths, {color,dashed=false,dashKm=[.08,.05],opacity=1,halfWidth=1.15,profile=false}){
    const T=window.THREE;
    const vertices=[],others=[],sides=[],edges=[],chain=[];
    function* pathsToPoints() {
      if(typeof paths[0]==='number') {
        for(let j=0;j<paths.length;j+=6)yield [new T.Vector3(paths[j],paths[j+1],paths[j+2]),new T.Vector3(paths[j+3],paths[j+4],paths[j+5])];
      } else yield* paths;
    }
    for(const points of pathsToPoints()){
    let dist=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],next=dist+a.distanceTo(b);
      for(const [p,q,side,edge,d] of [[a,b,1,1,dist],[a,b,-1,-1,dist],[b,a,-1,1,next],[b,a,-1,1,next],[a,b,-1,-1,dist],[b,a,1,-1,next]]){
        vertices.push(p.x,p.y,p.z);others.push(q.x,q.y,q.z);sides.push(side);edges.push(edge);chain.push(d);
      }
      dist=next;
    }}
    if(!vertices.length)return;
    const geom=new T.BufferGeometry();
    for(const [key,values,size] of [['position',vertices,3],['other',others,3],['sideSign',sides,1],['physicalEdge',edges,1],['station',chain,1]])geom.setAttribute(key,new T.Float32BufferAttribute(values,size));
    const mat=new T.ShaderMaterial({
      side:T.DoubleSide,depthTest:true,depthWrite:false,toneMapped:false,transparent:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
      uniforms:{screen:{value:new T.Vector2()},routeColor:{value:new T.Color(color)},isDashed:{value:dashed?1:0},dash:{value:new T.Vector2(...dashKm)},widthPx:{value:halfWidth},alpha:{value:opacity},profile:{value:profile?1:0},casing:{value:new T.Color(MAP_CONTRAST.casing3d)}},
      vertexShader:`uniform vec2 screen; uniform float widthPx;
      attribute vec3 other; attribute float sideSign; attribute float physicalEdge; attribute float station;
      varying float edge; varying float along;
      void main(){
        vec4 a=projectionMatrix*modelViewMatrix*vec4(position,1.);
        vec4 b=projectionMatrix*modelViewMatrix*vec4(other,1.);
        // Clip the comparison endpoint before forming the screen normal.
        // Prevent a road crossing the first-person near plane from exploding.
        float fa=a.z+a.w,fb=b.z+b.w;
        vec4 pa=a,pb=b;
        if(fa>=0.&&fb<0.)pb=mix(a,b,fa/(fa-fb));
        if(fb>=0.&&fa<0.)pa=mix(b,a,fb/(fb-fa));
        vec2 d=(pb.xy/max(.00001,pb.w)-pa.xy/max(.00001,pa.w))*screen;
        vec2 n=vec2(-d.y,d.x)/max(.001,length(d));
        a.xy+=n*sideSign*(widthPx*2.)/screen*a.w;
        gl_Position=a; edge=physicalEdge; along=station;
      }`,
      fragmentShader:`uniform vec3 routeColor; uniform vec3 casing; uniform int isDashed; uniform vec2 dash; uniform int profile; uniform float alpha;
      varying float edge; varying float along;
      void main(){
        if(isDashed==1&&mod(along,dash.x+dash.y)>dash.x)discard;
        float e=abs(edge);
        vec3 c=mix(profile==1?mix(routeColor,vec3(.96,.95,.92),.55):routeColor,casing,smoothstep(.56,.78,e));
        gl_FragColor=vec4(c,alpha*(1.-smoothstep(.82,1.,e)));
        #include <colorspace_fragment>
      }`
    });
    const mesh=new T.Mesh(geom,mat);mesh.renderOrder=profile?10:2;mesh.frustumCulled=false;
    mesh.onBeforeRender=()=>mat.uniforms.screen.value.set(this.width,this.height);
    group.add(mesh);
  }

  _addDrapedPoly(group, geom, { fill = 0x0ea5e9, fillOpacity = 0.42, stroke = 0x38bdf8, strokeOpacity = 0.95, dashed = false, lift = 0.015, halfWidth = 1.4 } = {}) {
    const THREE = window.THREE;
    if (!geom) return;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    const bounds = this.state.dem?.bounds_wgs84 || AOI_BOUNDS;
    for (const poly of polys) {
      if (!poly[0] || poly[0].length < 4) continue;
      if (fillOpacity > 0) {
        const toV2 = ring => {
          const pts = [];
          for (const c of ring) {
            const [x, z] = lonLatToLocalKm(c[0], c[1], bounds);
            const prev = pts[pts.length - 1];
            if (!prev || Math.hypot(x - prev.x, -z - prev.y) > 1e-5) pts.push(new THREE.Vector2(x, -z));
          }
          if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-5) pts.pop();
          return pts;
        };
        const outer = toV2(poly[0]);
        if (outer.length >= 3) {
          const shape = new THREE.Shape(outer);
          for (let h = 1; h < poly.length; h++) {
            const hole = toV2(poly[h]);
            if (hole.length >= 3) shape.holes.push(new THREE.Path(hole));
          }
          const sg = new THREE.ShapeGeometry(shape);
          const pos = sg.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = -pos.getY(i);
            const [lon, lat] = localKmToLonLat(x, z, bounds);
            const p3 = this.point3(lon, lat, lift);
            pos.setXYZ(i, p3.x, p3.y, p3.z);
          }
          pos.needsUpdate = true;
          const mesh = new THREE.Mesh(
            sg,
            new THREE.MeshBasicMaterial({ color: fill, transparent: true, opacity: fillOpacity, side: THREE.DoubleSide, depthWrite: false })
          );
          group.add(mesh);
        }
      }
      if(strokeOpacity>0)for (const ring of poly) {
        this._add3DLine(group, ring, { color: stroke, opacity: strokeOpacity, dashed, halfWidth, lift: lift + 0.004 });
      }
    }
  }

  _rebuildContours() {
    this._dirtyContours = false;
    if (!this.contourGroup) return;
    this._disposeGroup(this.contourGroup);
    const THREE = window.THREE;
    const dem = this.state.dem;
    const bounds = dem?.bounds_wgs84 || AOI_BOUNDS;
    if (!dem || !this.state.contourFeatures?.length) return;
    const batches = [[], []];
    for (const f of this.state.contourFeatures) {
      const elevation = f.properties?.elevation_m;
      if (!Number.isFinite(elevation)) continue;
      const geom = f.geometry;
      const paths = geom?.type === 'LineString' ? [geom.coordinates]
        : geom?.type === 'MultiLineString' ? geom.coordinates : [];
      const out = batches[f.properties?.index_contour === true ? 1 : 0];
      for (const line of paths) {
        let prev = null;
        for (const [lon, lat] of line) {
          const [x, z] = lonLatToLocalKm(lon, lat, bounds);
          // Source contours follow the exact displayed DEM triangles. Keep
          // elevation unexaggerated in the cache; group-scale Y and the
          // 2-m display separation never modify source elevation.
          const y = (elevation - this.baseElev) / 1000;
          if (prev) out.push(prev[0], prev[1], prev[2], x, y, z);
          prev = [x, y, z];
        }
      }
    }
    for (let i = 0; i < batches.length; i++) {
      if (!batches[i].length) continue;
      this._addCasedSegments(this.contourGroup,batches[i],{
        color:this.state.guidedTerrain ? (i?0xd6dce0:0xa5b4bf) : (i?MAP_CONTRAST.contourMajor3d:MAP_CONTRAST.contourMinor3d),
        opacity:this.state.guidedTerrain?.46:i?.78:this.state.contourInterval===2?.42:.56,
        halfWidth:i?1.25:this.state.contourInterval===2?.62:.82,
      });
    }
  }

  _rebuildSlopeAspect(){
    this._dirtySlope=false;
    if(!this.slopeGroup)return;
    this._disposeGroup(this.slopeGroup);
    const f=this.state.slopeAspect,dem=this.state.dem;
    if(!f?.arrows.length||!dem)return;
    const bounds=dem.bounds_wgs84, out=[], l=f.spacing_m*.00044;
    const sample=(x,z)=>{
      const [lon,lat]=localKmToLonLat(x,z,bounds);
      const y=sampleDemElevation(dem,lon,lat);
      return Number.isFinite(y)?[x,(y-this.baseElev)*.001,z]:null;
    };
    const line=(t,x)=>{if(t&&x)out.push(...t,...x);};
    for(const [lon,lat,east,north] of f.arrows){
      const [x,z]=lonLatToLocalKm(lon,lat,bounds), dx=east*l,dz=-north*l;
      const p=(t,r=0)=>sample(x+t*dx-r*dz,z+t*dz+r*dx);
      let prev=p(-.5);
      for(let k=1;k<=6;k++){const curr=p(-.5+k/6);line(prev,curr);prev=curr;}
      for(const sign of [-1,1]){const mid=p(.345,sign*.095);line(prev,mid);line(mid,p(.19,sign*.19));}
    }
    this._addCasedSegments(this.slopeGroup,out,{color:0xff81e8,opacity:.96,halfWidth:1.5});
  }

  _rebuildOverlays() {
    const THREE = window.THREE;
    this._disposeGroup(this.overlayGroup);
    this._adaptivePointHeads=[];
    this._labelAnchors = [];
    const selectedContour=this.state.contourFeatures?.find(f=>f.id===this.state.selectedFeatureId);
    if(selectedContour){
      const b=this.state.dem?.bounds_wgs84||AOI_BOUNDS,e=selectedContour.properties.elevation_m;
      const y=(e-this.baseElev)*this.exag/1000+0.003;
      const line=selectedContour.geometry.coordinates.map(([lon,lat])=>{const [x,z]=lonLatToLocalKm(lon,lat,b);return new THREE.Vector3(x,y,z);});
      const g=new THREE.BufferGeometry().setFromPoints(line);
      this.overlayGroup.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0xfff8e6,depthWrite:false})));
    }

    // 1. Water month layers & separate fixed boundaries
    const wm = this.state.waterMonth;
    if (wm) {
      const lakes = this.state.lakeView === 'BOTH' ? ['MAIN', 'WF1'] : [this.state.lakeView];
      for (const lakeId of lakes) {
        const entry = wm.lakes[lakeId];
        if (!entry) continue;
        const desc = describeWaterMonth(lakeId, wm.date, entry.row);
        const isMain = lakeId === 'MAIN';
        const winCol = parseInt(ANALYSIS_PALETTE.reference.stroke.slice(1),16);
        const isErr = Boolean(entry.error);
        const isLoading = Boolean(entry.loading);

        if (!isErr && !isLoading) {
          for (const f of entry.nodata?.features || []) {
            this._addDrapedPoly(this.overlayGroup, f.geometry, {
              fill: 0x64748b, fillOpacity: 0.34, stroke: 0x94a3b8, strokeOpacity: 0.75, dashed: true, lift: 0.012,
            });
          }
          for (const f of entry.water?.features || []) {
            this._addDrapedPoly(this.overlayGroup, f.geometry, {
              fill: parseInt(ANALYSIS_PALETTE[desc.disputed?'disputed':'water'].fill.slice(1),16),
              fillOpacity: desc.disputed ? 0.42 : 0.48,
              stroke: parseInt(ANALYSIS_PALETTE[desc.disputed?'disputed':'water'].stroke.slice(1),16),
              strokeOpacity: 0.98,
              dashed: desc.disputed,
              lift: 0.017,
            });
          }
        }
        const isSpokenLake = Boolean(this.state.spokenLakeIds?.has(lakeId));
        for (const bf of entry.boundary?.features || []) {
          if(!isMain){
            // Keep the no-coverage fill, but never outline or label the WF1 analysis footprint.
            if(!isErr&&!isLoading&&desc.stateKey==='invalid')
              this._addDrapedPoly(this.overlayGroup,bf.geometry,{fill:0x475569,fillOpacity:.28,strokeOpacity:0,lift:.022});
            continue;
          }
          this._addDrapedPoly(this.overlayGroup, bf.geometry, {
            fill: !isErr && !isLoading && desc.stateKey === 'invalid' ? 0x475569 : winCol,
            fillOpacity: !isErr && !isLoading && desc.stateKey === 'invalid' ? 0.28 : 0,
            stroke: isSpokenLake ? 0xf4d378 : isErr ? 0xdc2626 : isLoading ? 0x94a3b8 : winCol,
            strokeOpacity: 0.98,
            dashed: !isSpokenLake,
            lift: isSpokenLake ? 0.032 : 0.022,
          });
          const b = geometryBounds(bf.geometry);
          if (b && this.state.showLabels) {
            const baseLbl = '主湖固定统计窗';
            const suffix =
              isErr ? ' · ⚠水面图层加载失败，请重试' :
              isLoading ? ' · 加载中…' :
              desc.stateKey === 'positive_disputed' ? ` · ⚠争议 ${desc.areaText}` :
              desc.stateKey === 'zero_disputed' ? ' · ⊗争议零值' :
              desc.stateKey === 'zero' ? ' · ○观测为零' :
              desc.stateKey === 'invalid' ? ' · ▨覆盖不足' : ` · ${desc.areaText}`;
            this._labelAnchors.push({
              lon: (b[0] + b[2]) * 0.5,
              lat: b[3],
              label: `${isSpokenLake ? '◉ ' : ''}${baseLbl}${suffix}`,
              color: isSpokenLake ? '#f4d378' : isErr ? '#dc2626' : isLoading ? '#94a3b8' : desc.tone === 'disputed' ? '#ef4444' : '#38bdf8',
              lift: isSpokenLake ? 0.08 : 0.05,
            });
          }
        }
      }
    }

    // 1b. Southeast same-location native grid inspection (draped cleanly on DEM, no flow lines)
    const se = this.state.southeastInspection;
    if (se?.enabled && se.cells?.length) {
      for (const cell of se.cells) {
        if (cell.state === 'water_main') {
          this._addDrapedPoly(this.overlayGroup, cell.polygon, {
            fill: 0x0ea5e9, fillOpacity: 0.56, stroke: 0x38bdf8, strokeOpacity: 0.98, dashed: false, lift: 0.026,
          });
        } else if (cell.state === 'water_separate') {
          this._addDrapedPoly(this.overlayGroup, cell.polygon, {
            fill: 0xf59e0b, fillOpacity: 0.44, stroke: 0xfbbf24, strokeOpacity: 0.98, dashed: true, lift: 0.026,
          });
        } else if (cell.state === 'nodata') {
          this._addDrapedPoly(this.overlayGroup, cell.polygon, {
            fill: 0x64748b, fillOpacity: 0.52, stroke: 0xcbd5e1, strokeOpacity: 0.95, dashed: true, lift: 0.026,
          });
        } else {
          this._addDrapedPoly(this.overlayGroup, cell.polygon, {
            fill: 0x94a3b8, fillOpacity: 0, stroke: cell.state === 'error' ? 0xe11d48 : 0xcbd5e1, strokeOpacity: 0.72, dashed: cell.state !== 'valid_nonwater', lift: 0.024,
          });
        }
      }
      if (Array.isArray(se.anchor) && se.anchor.length === 2 && this.state.showLabels) {
        this._labelAnchors.push({
          lon: se.anchor[0],
          lat: se.anchor[1],
          label: `${se.windowShortLabel} · ${se.date} · ${se.headline}`,
          color: se.kind === 'water_main' ? '#38bdf8' : se.kind === 'water_separate' ? '#f59e0b' : '#94a3b8',
          lift: 0.09,
        });
      }
    }

    // 2. Enabled analysis.geojson overlays (+ active narration spoken places)
    const selId = this.state.selectedFeatureId;
    const spokenIds = this.state.spokenFeatureIds;
    const roaming=Boolean(this._walkView);
    for (const f of this.state.analysisFeatures) {
      const ly = f.properties?.layer;
      const isSpoken = Boolean(spokenIds?.has(f.id));
      if(this.state.hiddenFeatureIds?.has(f.id)||(!this.state.visibleLayers.has(ly)&&!this.state.scopeFeatureIds?.has(f.id)&&!isSpoken))continue;
      const spec = getFeatureVisualSpec(f);
      const isSel = f.id === selId;
      const gt = f.geometry?.type;
      const col = isSel ? 0xffffff : isSpoken ? 0xf4d378 : spec.color3d;

      if (gt === 'Point') {
        if (ly === 'field-photos-20261122' && f.properties.outside_dem) continue;
        const [lon, lat] = f.geometry.coordinates;
        const pGround = this.point3(lon, lat, roaming?.00035:.01);
        const pTop = this.point3(lon, lat, roaming?((isSel||isSpoken)?.0026:.0015):(isSel||isSpoken)?.115:.064);
        if (ly === 'field-photos-20261122' && isSel && !f.properties.heading_unverified) {
          const t=f.properties.heading_deg*Math.PI/180, dx=Math.sin(t),dy=Math.cos(t), size=isSel?47:28, kx=111320*Math.cos(lat*Math.PI/180), ky=111132;
          const proj=(a,b)=>this.point3(lon+(dx*a-dy*b)/kx,lat+(dy*a+dx*b)/ky,roaming?.0013:.029);
          const end=proj(size,0), color=new THREE.LineBasicMaterial({color:spec.color3d});
          const arrow = new THREE.BufferGeometry().setFromPoints([proj(0,0),end,proj(size-9,-6),end,proj(size-9,6)]);
          this.overlayGroup.add(new THREE.Line(arrow,color));
        }
        if ((ly === 'seasonal-network' || ly === 'f1-waterway') && spec.symbol === '×') {
          const r=roaming?(isSel?.0024:.0016):(isSel?.038:.028);
          const points=[[-r,-r],[r,r],[-r,r],[r,-r]].map(([x,z])=>new THREE.Vector3(pTop.x+x,pTop.y+0.005,pTop.z+z));
          this.overlayGroup.add(new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:col})
          ));
          if (this.state.showLabels && isSel) this._labelAnchors.push({lon,lat,label:`× ${f.properties.name}`,color:'#F4F1EA',lift:0.14});
          continue;
        }
        const stemG = new THREE.BufferGeometry().setFromPoints([pGround, pTop]);
        this.overlayGroup.add(new THREE.Line(stemG, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.72 })));
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(roaming?((isSel||isSpoken)?.0012:.00075):(isSel||isSpoken)?.034:.021, 14, 12),
          new THREE.MeshBasicMaterial({ color: isSpoken ? 0xdfb164 : spec.color3d, toneMapped:false, fog:false })
        );
        head.position.copy(pTop);
        const casing=new THREE.Mesh(head.geometry.clone(),new THREE.MeshBasicMaterial({
          color:MAP_CONTRAST.casing3d,side:THREE.BackSide,toneMapped:false,fog:false,
        }));
        casing.position.copy(pTop);casing.scale.setScalar(1.18);
        this.overlayGroup.add(casing,head);
        if(!roaming)this._adaptivePointHeads.push({head,casing,radius:(isSel||isSpoken)?.034:.021,pixels:(isSel||isSpoken)?5:3});
        if (this.state.showLabels && (f.id === 'office-service' || isSel || isSpoken || ['snow-sites', 'road-review', 'regional-reference', 'west-slope-review', 'bridge-f1-anchors', 'marsh-review'].includes(ly) || (ly==='catchment-screen-nw-network'&&!this.state.guidedTerrain))) {
          const rawName = (f.properties?.name || f.id).split(' · ')[0];
          const shortName = f.id === 'office-service' ? '嘎查办公院 · 出水口未确认（保留断口）'
            : f.id === 'west-slope-f1-bridge' ? '三八水库中桥（F1）'
            : f.id === 'west-slope-old-bend' ? '桥东老转折窗口'
            : f.id === 'west-slope-old-ne-fade' ? '东北暗纹消散端'
            : f.id === 'bridge-f1-se-fade' ? '东南暗纹消散端'
            : f.id === 'atlas-east-marsh-review' ? '东部泥沼查看点'
            : rawName;
          const sym = f.id === 'office-service' ? '×' : spec.symbol;
          this._labelAnchors.push({
            lon,
            lat,
            label: `${sym} ${shortName}`,
            color: isSel ? '#ffffff' : f.id === 'office-service' ? '#edb75f' : isSpoken ? '#f4d378' : spec.stroke,
            lift: (isSel || isSpoken) ? 0.19 : 0.11,
          });
        }
      } else if (gt === 'LineString' || gt === 'MultiLineString') {
        const isOfficeTrace = f.id === 'atlas-office-trace-main_raw' || f.id === 'atlas-office-trace-main_historical_filled';
        const lines = gt === 'LineString'
          ? [isOfficeTrace && f.geometry.coordinates.length > 3 ? f.geometry.coordinates.slice(2) : f.geometry.coordinates]
          : f.geometry.coordinates;
        for (const line of lines) {
          if(this.state.profileHighlightId===f.id){this._addProfileRibbon(this.overlayGroup,line,{color:spec.color3d,dashed:Boolean(spec.dash)});continue;}
          this._add3DLine(this.overlayGroup, line, {
            color: col,
            opacity: ly === 'secondary-roads' && !isSel ? 0.56 : 0.94,
            halfWidth:ly==='secondary-roads'&&!isSel?.65:isSpoken?1.75:1.15,
            dashed: Boolean(spec.dash),
            lift: roaming?((isSel||isSpoken)?.0011:.00055):(isSel||isSpoken)?.034:ly==='roads'?.026:.021,
          });
        }
      } else if (gt === 'Polygon' || gt === 'MultiPolygon') {
        this._addDrapedPoly(this.overlayGroup, f.geometry, {
          fill: isSpoken ? 0xf4d378 : spec.color3d,
          fillOpacity: ly?.startsWith('catchment-screen-') ? 0.19 : ly === 'f1-waterway-sensitivity' ? (isSel ? 0.15 : 0.06) : ly === 'f1-waterway' ? (isSel ? 0.22 : 0.11) : ly === 'seasonal-network' ? (isSel ? 0.22 : 0.11) : ly === 'july-2023-review' ? 0 : ly === 'main-catchments' ? (isSpoken ? 0.26 : 0.10) : (isSel || isSpoken) ? 0.46 : 0.28,
          stroke: col,
          strokeOpacity: 0.96,
          halfWidth:isSpoken?2.45:this.state.guidedTerrain&&['nw96-marsh','nw96-east-pool'].includes(f.id)?2.1:1.4,
          dashed: Boolean(spec.dash),
          lift: roaming?.0006:ly==='july-2023-review'?.034:(isSel||isSpoken)?.03:.016,
        });
        const datedLabel=datedWaterMapLabel(f);
        if(datedLabel&&this.state.showLabels){
          const b=geometryBounds(f.geometry);
          if(b)this._labelAnchors.push({lon:(b[0]+b[2])/2,lat:b[3],label:datedLabel,color:spec.stroke,lift:roaming?.003:.029});
        }
      }
    }

    this._dirtyOverlays = false;
  }

  _rebuildCursor() {
    const THREE = window.THREE;
    this._disposeGroup(this.cursorGroup);
    this._cursorAnchor = null;
    // Guided mode uses the reusable screen-space pin instead of a shrinking mesh.
    if(this.state.guidedTerrain){this._dirtyCursor=false;return;}
    // Ordinary 3D profile cursor: slender luminous optical beam + ground precision reticle.
    const cur = this.state.profileCursor;
    if (cur && Number.isFinite(cur.lon) && Number.isFinite(cur.lat)) {
      const pGround = this.point3(cur.lon, cur.lat, .012);
      const pTop = this.point3(cur.lon, cur.lat, .24);
      const stemH = Math.max(0.05, pTop.y - pGround.y);
      const midY = (pGround.y + pTop.y) * 0.5;

      // Ultra-slender luminous optical core + diffused ice-cyan vertical halo
      const coreBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0026, 0.0042, stemH, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xf4f1ea, transparent: true, opacity: 0.90, depthWrite: false, toneMapped: false, fog: false })
      );
      coreBeam.position.set(pGround.x, midY, pGround.z);
      const haloBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.019, stemH, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x74b8dc, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false })
      );
      haloBeam.position.set(pGround.x, midY, pGround.z);
      this.cursorGroup.add(haloBeam, coreBeam);

      const {innerKm,outerKm,casingKm,segments,casing3d,core3d}=PROFILE_CURSOR_RING;
      // Adjacent annuli at matching radii (no overlapping faces or z-fighting).
      for(const [inner,outer,color] of [
        [innerKm-casingKm,innerKm,casing3d],
        [innerKm,outerKm,core3d],
        [outerKm,outerKm+casingKm,casing3d],
      ]){
        const ring=new THREE.Mesh(new THREE.RingGeometry(inner,outer,segments),
          new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false,fog:false}));
        ring.rotation.x=-Math.PI*.5;
        ring.position.copy(pGround);
        this.cursorGroup.add(ring);
      }

      // Soft outer misty ice-cyan ground glow ring
      const auraRing = new THREE.Mesh(
        new THREE.RingGeometry(outerKm + casingKm, outerKm + casingKm + 0.032, 28),
        new THREE.MeshBasicMaterial({ color: 0x74b8dc, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false })
      );
      auraRing.rotation.x = -Math.PI * 0.5;
      auraRing.position.copy(pGround);
      this.cursorGroup.add(auraRing);

      // Delicate luminous top beacon node + diffused outer halo
      const tipCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.021, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xf4f1ea, toneMapped: false, fog: false })
      );
      tipCore.position.copy(pTop);
      const tipGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.048, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x74b8dc, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })
      );
      tipGlow.position.copy(pTop);
      this.cursorGroup.add(tipGlow, tipCore);

      this._cursorAnchor = {
        lon: cur.lon,
        lat: cur.lat,
        label: `剖面点 ${cur.distance_m.toFixed(0)}m · ${describeProfileCursorElevation(cur)}`,
        color: '#74B8DC',
        lift: .28,
      };
    }

    this._dirtyCursor = false;
  }

  _updateCameraAndCompass() {
    const THREE = window.THREE;
    if(this._walkView?.pose){
      const q=this._walkView.pose, heading=q.heading*Math.PI/180;
      const clip=walkClipForHeight(q.eyeM);
      const framingKm=(q.framingDepthM??0)/1000;
      clip.far=Math.max(clip.far,framingKm+17);
      clip.fogDensity=Math.min(clip.fogDensity,.012/Math.max(1,framingKm/12));
      if(this.camera.near!==clip.near||this.camera.far!==clip.far){
        this.camera.near=clip.near;this.camera.far=clip.far;this.camera.updateProjectionMatrix();
      }
      this.scene.fog.density=clip.fogDensity;
      const eye=Number.isFinite(q.guideOriginM)?(()=>{
        const [x,z]=lonLatToLocalKm(q.lon,q.lat,this.state.dem?.bounds_wgs84||AOI_BOUNDS);
        return new THREE.Vector3(x,((q.guideOriginM-this.baseElev)*this.exag+q.eyeM)/1000,z);
      })():this.point3(q.lon,q.lat,q.eyeM/1000);
      const pitch=(q.pitch??-2.3)*Math.PI/180, horizontal=Math.cos(pitch)*.1;
      this.camera.position.copy(eye);
      this.camera.lookAt(eye.x+Math.sin(heading)*horizontal,eye.y+Math.sin(pitch)*.1,eye.z-Math.cos(heading)*horizontal);
      this.camera.updateMatrixWorld();
      this.cb.onNorthChange?.(-q.heading);
      return;
    }
    this.scene.fog.density=(this.state.theme==='light'?.0095:.0155)/Math.max(1,this.orbit.radius/28);
    const pitchRad = (this.orbit.pitchDeg * Math.PI) / 180;
    const azRad = (this.orbit.azimuthDeg * Math.PI) / 180;
    const targetY = 0.06;
    const horiz = this.orbit.radius * Math.cos(pitchRad);
    const camX = this.orbit.targetX + horiz * Math.sin(azRad);
    const camY = targetY + this.orbit.radius * Math.sin(pitchRad);
    const camZ = this.orbit.targetZ + horiz * Math.cos(azRad);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.orbit.targetX, targetY, this.orbit.targetZ);
    this.camera.updateMatrixWorld();

    // Compute TRUE projected geographic North angle on screen (-Z is North)
    const p0 = new THREE.Vector3(this.orbit.targetX, targetY, this.orbit.targetZ).project(this.camera);
    const pN = new THREE.Vector3(this.orbit.targetX, targetY, this.orbit.targetZ - 0.8).project(this.camera);
    const dx = (pN.x - p0.x) * (this.width * 0.5);
    const dy = -(pN.y - p0.y) * (this.height * 0.5);
    const northAngleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (this.cb.onNorthChange) this.cb.onNorthChange(northAngleDeg);

    // Update scale readout from approximate ground pixel size at target
    if (this.cb.onCameraChange) {
      const vFov = (this.camera.fov * Math.PI) / 180;
      const worldHeightM = 2 * this.orbit.radius * Math.tan(vFov * 0.5) * 1000;
      const ppm = this.height / Math.max(100, worldHeightM);
      const rawM = 92 / ppm;
      const nice = [100, 200, 500, 1000, 2000, 5000];
      let best = nice[0];
      for (const v of nice) if (Math.abs(v - rawM) < Math.abs(best - rawM)) best = v;
      this.cb.onCameraChange({ px: Math.round(best * ppm), label: best >= 1000 ? `${best / 1000} km` : `${best} m`, focus: this.getCameraFocus() });
    }
  }

  _scalePointHeads() {
    if(!this._adaptivePointHeads?.length||!this.height)return;
    const m=this.camera.matrixWorldInverse.elements;
    const yScale=this.camera.projectionMatrix.elements[5]*this.height*.5;
    if(!(yScale>0))return;
    for(const {head,casing,radius,pixels} of this._adaptivePointHeads){
      const {x,y,z}=head.position;
      const depth=-(m[2]*x+m[6]*y+m[10]*z+m[14]);
      const ratio=Math.min(1,Math.max(.001,depth*pixels/yScale)/radius);
      head.scale.setScalar(ratio);
      casing.scale.setScalar(1.18*ratio);
    }
  }

  _projectToScreen(lon, lat, lift = 0.02, contourElevation=null) {
    let p;
    if(Number.isFinite(contourElevation)){
      const [x,z]=lonLatToLocalKm(lon,lat,this.state.dem?.bounds_wgs84||AOI_BOUNDS);
      p=new window.THREE.Vector3(x,(contourElevation-this.baseElev)*this.exag/1000+0.002,z);
    }else p=this.point3(lon,lat,this._walkView?Math.min(lift,.004):lift);
    const inCam = p.clone().applyMatrix4(this.camera.matrixWorldInverse);
    if (inCam.z >= -this.camera.near) return null; // behind camera near plane
    const v = p.project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
    };
  }

  screenGroundPoint(lon,lat,lift=.0015) {
    const p=this._projectToScreen(lon,lat,lift),canvas=this.renderer?.domElement;
    if(!p||!canvas||!this.width||!this.height)return null;
    const r=canvas.getBoundingClientRect();
    return {x:r.left+p.x*r.width/this.width,y:r.top+p.y*r.height/this.height};
  }

  _updateLabels() {
    if (!this.labelEl) return;
    const dot=this._guidedScreenDot??=this.labelEl.parentElement.querySelector('#guided-profile-ground-cursor');
    if(dot){
      const cur=this.state.guidedTerrain?this.state.profileCursor:null;
      const at=cur&&[cur.lon,cur.lat,cur.glo30_m].every(Number.isFinite)?this.screenGroundPoint(cur.lon,cur.lat,.0019):null;
      const box=this.renderer.domElement.getBoundingClientRect();
      const shown=at&&at.x>=box.left&&at.x<box.right&&at.y>=box.top&&at.y<box.bottom;
      if(shown){
        const host=dot.offsetParent?.getBoundingClientRect()??this.labelEl.parentElement.getBoundingClientRect();
        const transform='translate3d('+(at.x-host.left).toFixed(2)+'px,'+(at.y-host.top).toFixed(2)+'px,0) translate(-50%,-50%)';
        if(dot.style.transform!==transform)dot.style.transform=transform;
      }
      if(dot.hidden===Boolean(shown))dot.hidden=!shown;
    }
    const html = [];
    let cursorScreen=null;
    for (const a of this._cursorAnchor ? [...this._labelAnchors, this._cursorAnchor] : this._labelAnchors) {
      const s = this._projectToScreen(a.lon, a.lat, a.lift || 0.05);
      if (!s || s.x < 12 || s.x > this.width - 12 || s.y < 12 || s.y > this.height - 12) continue;
      const cursor=a===this._cursorAnchor;
      if(cursor)cursorScreen=s;
      html.push(
        `<div class="map3d-pill"${cursor?' data-profile-cursor-label':''} style="transform:translate(${s.x.toFixed(0)}px,${s.y.toFixed(0)}px) translate(-50%,-100%)"><i class="map3d-dot" style="background:${a.color};color:${a.color}"></i><span>${translateAtlas(a.label).replace(/[<>&]/g, '')}</span></div>`
      );
    }
    const next = html.join('');
    if (next !== this._labelsHtml) {
      this.labelEl.innerHTML = next;
      this._labelsHtml = next;
      if(cursorScreen){
        const label=this.labelEl.querySelector('[data-profile-cursor-label]');
        if(label){
          // The callout may move a few pixels; the ground ring stays at the real sample.
          const margin=8;
          const xHalf=label.offsetWidth/2;
          const x=Math.max(margin+xHalf, Math.min(this.width-margin-xHalf, cursorScreen.x));
          const y=Math.max(margin+label.offsetHeight,cursorScreen.y);
          label.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
        }
      }
    }
  }

  groundAtScreenPx(px, py) {
    if(!this.terrainMesh||!this.width||!this.height)return null;
    const T=window.THREE;
    const ndc=new T.Vector2(2*px/this.width-1,1-2*py/this.height);
    const ray=new T.Raycaster();
    ray.setFromCamera(ndc,this.camera);
    const hit=ray.intersectObject(this.terrainMesh,false)[0];
    return hit?localKmToLonLat(hit.point.x,hit.point.z,this.state.dem?.bounds_wgs84||AOI_BOUNDS):null;
  }

  _pick3DAt(px, py) {
    const visible = this.state.analysisFeatures.filter(f => !this.state.hiddenFeatureIds?.has(f.id)&&(this.state.visibleLayers.has(f.properties?.layer)||this.state.scopeFeatureIds?.has(f.id)));
    const selId = this.state.selectedFeatureId;

    const groundLonLat = this.groundAtScreenPx(px, py);

    // Shared exact geometry picker (same ring+hole & segment-distance logic as 2D Canvas)
    const hit=pickFeatureUnified({
      px,
      py,
      groundLonLat,
      features: visible,
      projectPoint: (lon, lat, geomType, f) => {
        const isSel = f?.id === selId;
        const lift = geomType === 'Point'
          ? (isSel||this.state.spokenFeatureIds?.has(f?.id) ? 0.115 : 0.064)
          : (isSel ? 0.032 : f?.properties?.layer === 'roads' ? 0.026 : 0.021);
        return this._projectToScreen(lon, lat, lift);
      },
      densifyMaxDeg: 0.0008,
      pointTolPx: 22,
      lineTolPx: 12,
    });
    if(hit||!groundLonLat||!this.state.contourFeatures?.length)return hit;
    const c=nearbyContours(this.state.contourFeatures,groundLonLat,0.003,0.003);
    return pickFeatureUnified({px,py,groundLonLat,features:c,
      projectPoint:(lon,lat,_type,f)=>this._projectToScreen(lon,lat,0,f.properties.elevation_m),lineTolPx:7});
  }

  _bindEvents() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', e => e.preventDefault());

    el.addEventListener('pointerdown', e => {
      if(this._walkView)return;
      this._hover = null;
      try { el.setPointerCapture(e.pointerId); } catch {}
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._flyAnim = null;
      if (this._pointers.size === 1) {
        const isPan = e.button === 2 || e.shiftKey;
        const src = this._targetOrbit || this.orbit;
        this._drag = {
          mode: isPan ? 'pan' : 'orbit',
          x: e.clientX,
          y: e.clientY,
          az: src.azimuthDeg,
          pitch: src.pitchDeg,
          tx: src.targetX,
          tz: src.targetZ,
        };
        this._didDrag = false;
      } else if (this._pointers.size === 2) {
        const pts = [...this._pointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;
        const src = this._targetOrbit || this.orbit;
        this._pinch = { dist: Math.max(10, dist), radius: src.radius, midX, midY, tx: src.targetX, tz: src.targetZ };
        this._didDrag = true;
      }
    });

    el.addEventListener('pointerleave', () => { this._hover = null; });
    el.addEventListener('pointermove', e => {
      if(this._walkView)return;
      if (!this._pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse' && !this._pointers.size && !e.buttons && this.cb.onCursorMove) {
          this._hover = { x: e.clientX, y: e.clientY };
          this._invalidate(false);
        }
        return;
      }
      this._hover = null;
      this._flyAnim = null;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const dst = this._targetOrbit || this.orbit;
      if (this._pointers.size === 2 && this._pinch) {
        const pts = [...this._pointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;
        dst.radius = Math.max(1.1, Math.min(MAX_ORBIT_RADIUS_KM, this._pinch.radius * (this._pinch.dist / Math.max(10, dist))));
        const dx = midX - this._pinch.midX;
        const dy = midY - this._pinch.midY;
        const az = (dst.azimuthDeg * Math.PI) / 180;
        const panScale = dst.radius * 0.0018;
        dst.targetX = this._pinch.tx - (dx * Math.cos(az) + dy * Math.sin(az)) * panScale;
        dst.targetZ = this._pinch.tz - (-dx * Math.sin(az) + dy * Math.cos(az)) * panScale;
        if (this._reducedMotion?.matches) Object.assign(this.orbit, dst);
        this._invalidate();
        return;
      }

      if (this._pointers.size === 1 && this._drag) {
        const dx = e.clientX - this._drag.x;
        const dy = e.clientY - this._drag.y;
        const tapTol = e.pointerType === 'touch' ? 9 : 4;
        if (Math.hypot(dx, dy) > tapTol) this._didDrag = true;
        if (!this._didDrag) return;
        if (this._drag.mode === 'orbit') {
          dst.azimuthDeg = this._drag.az - dx * 0.32;
          dst.pitchDeg = Math.max(16, Math.min(82, this._drag.pitch + dy * 0.25));
        } else {
          const az = (dst.azimuthDeg * Math.PI) / 180;
          const panScale = dst.radius * 0.0018;
          dst.targetX = this._drag.tx - (dx * Math.cos(az) + dy * Math.sin(az)) * panScale;
          dst.targetZ = this._drag.tz - (-dx * Math.sin(az) + dy * Math.cos(az)) * panScale;
        }
        if (this._reducedMotion?.matches) Object.assign(this.orbit, dst);
        this._invalidate();
      }
    });

    const endPtr = e => {
      const wasClick = e.type === 'pointerup' && this._pointers.size === 1 && !this._didDrag;
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) this._pinch = null;
      if (this._pointers.size === 1) {
        // Re-anchor remaining finger cleanly after 2-finger pinch
        const [rem] = this._pointers.values();
        const src = this._targetOrbit || this.orbit;
        this._drag = {
          mode: 'orbit',
          x: rem.x,
          y: rem.y,
          az: src.azimuthDeg,
          pitch: src.pitchDeg,
          tx: src.targetX,
          tz: src.targetZ,
        };
        this._didDrag = true;
      } else if (this._pointers.size === 0) {
        this._drag = null;
      }
      if (wasClick) {
        const rect = el.getBoundingClientRect();
        const hit = this._pick3DAt(e.clientX - rect.left, e.clientY - rect.top);
        if (this.cb.onSelectFeature) this.cb.onSelectFeature(hit);
      }
    };
    el.addEventListener('pointerup', endPtr);
    el.addEventListener('pointercancel', endPtr);

    el.addEventListener('wheel', e => {
      if(this._walkView){e.preventDefault();return;}
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1.16 : 1 / 1.16);
    }, { passive: false });
  }

  _flushHover() {
    const pos = this._hover;
    this._hover = null;
    if (!pos || !this.terrainMesh || !this.cb.onCursorMove || this._pointers.size) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const THREE = window.THREE;
    const ndc = new THREE.Vector2(((pos.x - rect.left) / this.width) * 2 - 1, -((pos.y - rect.top) / this.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObject(this.terrainMesh, false);
    if (hits.length) {
      const [lon, lat] = localKmToLonLat(hits[0].point.x, hits[0].point.z, this.state.dem?.bounds_wgs84 || AOI_BOUNDS);
      const elev = sampleDemElevation(this.state.dem, lon, lat);
      this.cb.onCursorMove({ lon, lat, elev });
    }
  }

  _stepDamping(now) {
    if (!this._targetOrbit) return false;
    const keys = ['targetX', 'targetZ', 'radius', 'pitchDeg', 'azimuthDeg'];
    let maxDiff = 0;
    for (const k of keys) {
      maxDiff = Math.max(maxDiff, Math.abs(this._targetOrbit[k] - this.orbit[k]));
    }
    if (maxDiff < 1e-4) {
      for (const k of keys) this.orbit[k] = this._targetOrbit[k];
      return false;
    }
    const reduced = Boolean(this._reducedMotion?.matches);
    const dt = this._lastFrameTime > 0 ? Math.min(0.05, Math.max(0.001, (now - this._lastFrameTime) / 1000)) : 1 / 60;
    const alpha = reduced ? 1 : 1 - Math.exp(-14 * dt);
    let stillMoving = false;
    for (const k of keys) {
      const nextVal = this.orbit[k] + (this._targetOrbit[k] - this.orbit[k]) * alpha;
      if (Math.abs(this._targetOrbit[k] - nextVal) < 1e-4) {
        this.orbit[k] = this._targetOrbit[k];
      } else {
        this.orbit[k] = nextVal;
        stillMoving = true;
      }
    }
    return stillMoving;
  }

  _loop(now = performance.now()) {
    this._raf = 0;
    if (!this.active || this.failed || (typeof document !== 'undefined' && document.hidden)) return;
    const gl = this.renderer?.getContext?.();
    if (!gl || (typeof gl.isContextLost === 'function' && gl.isContextLost())) {
      this._handleContextLost('context_lost_poll');
      return;
    }

    let dampingMoving = false;
    if (this._flyAnim) {
      const a = this._flyAnim;
      const t = this._reducedMotion?.matches ? 1 : Math.min(1, (now - a.t0) / a.dur);
      const ease = t * t * (3 - 2 * t);
      this.orbit.targetX = t >= 1 ? a.ex : a.sx + (a.ex - a.sx) * ease;
      this.orbit.targetZ = t >= 1 ? a.ez : a.sz + (a.ez - a.sz) * ease;
      this.orbit.radius = t >= 1 ? a.er : a.sr * Math.exp((a.logR ?? Math.log(a.er / Math.max(0.5, a.sr))) * ease);
      this.orbit.pitchDeg = t >= 1 ? a.ep : a.sp + (a.ep - a.sp) * ease;
      this.orbit.azimuthDeg = t >= 1 ? a.ea : a.sa + (a.ea - a.sa) * ease;
      if (this._targetOrbit) Object.assign(this._targetOrbit, this.orbit);
      if (t >= 1) this._flyAnim = null;
    } else {
      dampingMoving = this._stepDamping(now);
    }
    this._lastFrameTime = now;

    const shouldDraw = this._drawPending || Boolean(this._flyAnim) || dampingMoving;
    this._drawPending = false;

    if (shouldDraw) {
      if (this._dirtyMesh) this._rebuildTerrainMesh();
      if(this._walkView)this._attachWalkReference();
      if (this._dirtyTexture && this.terrainMesh?.material) {
        const old=this.terrainMesh.material;
        this.terrainMesh.material=this._terrainMaterial(this._getBasemapTexture());
        old.dispose();
        this._dirtyTexture = false;
      }
      if (this._dirtyContours) this._rebuildContours();
      if (this._dirtySlope) this._rebuildSlopeAspect();
      if (this._dirtyOverlays) this._rebuildOverlays();
      if (this._dirtyCursor) this._rebuildCursor();

      this._updateCameraAndCompass();
      this._scalePointHeads();
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (err) {
        this._handleContextLost(err?.message || 'render_error');
        return;
      }
      this._updateLabels();
      this.cb.onViewChange?.();
    }
    this._flushHover();
    if (this._flyAnim || dampingMoving) this._invalidate();
    else this._lastFrameTime = 0;
  }
}

