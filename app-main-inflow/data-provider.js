/* ==========================================================================
   app/data-provider.js
   Clean data-only loader reading frozen JSON/GeoJSON/DEM/PNG assets directly
   from ../hujiernuoer-handoff-v2/ without parsing any HTML or modifying data.
   Failed water-part fetches are NEVER cached and remain retryable.
   ========================================================================== */

export class HandoffDataProvider {
  constructor(basePath = '../hujiernuoer-handoff-v2/', options = {}) {
    this.basePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    this.fetchTimeoutMs = Number.isFinite(options.fetchTimeoutMs) ? options.fetchTimeoutMs : 10000;
    this.waterIndex = null;
    this.analysis = null;
    this.analysisById = new Map();
    this.analysisManifest = null;
    this.evidence = [];
    this.coverage = null;
    this.acceptance = null;
    this.terrainManifest = null;
    this.dem = null;
    this.hotspotMay = null;
    this.nwScenarios = null;
    this.yiminSummary = null;
    this.waterParts = Object.create(null); // path -> GeoJSON FeatureCollection (only successful loads cached)
  }

  url(rel) {
    return `${this.basePath}${rel}`;
  }

  async _fetchJson(rel, { timeoutMs = this.fetchTimeoutMs, signal = null, priority } = {}) {
    const ctrl = new AbortController();
    let timedOut = false;
    let timer = null;
    const onParentAbort = () => ctrl.abort();

    if (signal) {
      if (signal.aborted) {
        const err = new Error(`请求已取消 (${rel})`);
        err.isAborted = true;
        throw err;
      }
      signal.addEventListener('abort', onParentAbort, { once: true });
    }
    if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
      timer = setTimeout(() => {
        timedOut = true;
        ctrl.abort();
      }, timeoutMs);
    }

    try {
      const res = await fetch(this.url(rel), { signal: ctrl.signal, ...(priority ? {priority} : {}) });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} (${rel})`),{httpStatus:res.status});
      return await res.json();
    } catch (err) {
      if (timedOut) {
        const secs = timeoutMs >= 1000 ? `${(timeoutMs / 1000).toFixed(timeoutMs % 1000 === 0 ? 0 : 1)}s` : `${timeoutMs}ms`;
        const te = new Error(`请求超时（>${secs}，${rel}）`);
        te.isTimeout = true;
        throw te;
      }
      if (signal?.aborted) {
        const ae = new Error(`请求已取消 (${rel})`);
        ae.isAborted = true;
        throw ae;
      }
      throw err;
    } finally {
      if (timer !== null) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onParentAbort);
    }
  }

  async _bootRequest(load, priority='auto') {
    for(let attempt=0;;attempt++){
      try { return await load({timeoutMs:attempt?24000:16000,priority}); }
      catch(err) {
        const transient=err.isTimeout||err instanceof TypeError||err.httpStatus===408||err.httpStatus===429||err.httpStatus>=500;
        if(attempt||!transient)throw err;
        await new Promise(resolve=>setTimeout(resolve,350));
      }
    }
  }

  async boot() {
    const read=(path,priority)=>this._bootRequest(opts=>this._fetchJson(path,opts),priority);
    const [
      waterIndex,
      analysis,
      analysisManifest,
      evidence,
      coverage,
      acceptance,
      terrainManifest,
      dem,
      hotspotMay,
      nwScenarios,
      yiminSummary,
    ] = await Promise.all([
      read('water-index.json','high'),
      read('analysis.geojson'),
      read('analysis-manifest.json'),
      read('evidence.json'),
      read('coverage.json'),
      read('acceptance-cases.json'),
      read('terrain/manifest.json'),
      read('terrain/dem.json'),
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(null),
    ]);

    this.waterIndex = waterIndex;
    this.analysis = analysis;
    this.analysisById.clear();
    for (const f of analysis.features || []) {
      this.analysisById.set(f.id, f);
    }
    this.analysisManifest = analysisManifest;
    this.evidence = evidence;
    this.coverage = coverage;
    this.acceptance = acceptance;
    this.terrainManifest = terrainManifest;
    this.dem = dem;
    this.hotspotMay = hotspotMay;
    this.nwScenarios = nwScenarios;
    this.yiminSummary = yiminSummary;

    // Preload both fixed statistical window boundary polygons
    const boundaryPaths = Object.values(waterIndex.lakes).map(l => l.boundary).filter(Boolean);
    await Promise.all(boundaryPaths.map(p => this._bootRequest(opts=>this.loadWaterPart(p,opts))));
  }

  async loadWaterPart(relPath, opts = {}) {
    if (!relPath) return null;
    if (this.waterParts[relPath]) return this.waterParts[relPath];
    const data = await this._fetchJson(relPath, opts);
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) ||
        data.features.some(f => f?.type !== 'Feature' || !f.geometry ||
          !['Polygon', 'MultiPolygon'].includes(f.geometry.type) || !Array.isArray(f.geometry.coordinates))) {
      throw new Error(`水面文件格式错误（${relPath}）`);
    }
    this.waterParts[relPath] = data;
    return data;
  }

  /**
   * Check whether boundary + monthly water/nodata parts for `date` are already
   * cached in memory (so switching to an already-cached month renders atomically
   * with zero flicker).
   */
  isMonthCached(date, lakeIds = null) {
    if (!this.waterIndex?.lakes) return false;
    const ids = lakeIds || Object.keys(this.waterIndex.lakes);
    for (const lakeId of ids) {
      const ser = this.waterIndex.lakes[lakeId];
      if (!ser) continue;
      if (ser.boundary && !this.waterParts[ser.boundary]) return false;
      const row = ser.months[date];
      if (row && row.status !== 'invalid') {
        if (row.water && !this.waterParts[row.water]) return false;
        if (row.nodata && !this.waterParts[row.nodata]) return false;
      }
    }
    return true;
  }

  /**
   * Build an immediate pending waterMonth snapshot for `date` so switching
   * months over a slow network clears stale previous-month water polygons
   * immediately (never pairing the new date with the previous month's water).
   */
  buildPendingMonthWater(date, lakeIds = null) {
    const ids = lakeIds || Object.keys(this.waterIndex.lakes);
    const out = { date, loading: false, lakes: {}, errors: [] };
    for (const lakeId of ids) {
      const ser = this.waterIndex.lakes[lakeId];
      const row = ser?.months?.[date] || null;
      const hasBoundary = !ser?.boundary || Boolean(this.waterParts[ser.boundary]);
      const needsWater = Boolean(row && row.status !== 'invalid' && row.water && !this.waterParts[row.water]);
      const needsNodata = Boolean(row && row.status !== 'invalid' && row.nodata && !this.waterParts[row.nodata]);
      const lakeLoading = !hasBoundary || needsWater || needsNodata;
      if (lakeLoading) out.loading = true;
      out.lakes[lakeId] = {
        lakeId,
        row,
        boundary: ser?.boundary ? (this.waterParts[ser.boundary] || null) : null,
        water: !lakeLoading && row && row.status !== 'invalid' && row.water ? (this.waterParts[row.water] || null) : null,
        nodata: !lakeLoading && row && row.status !== 'invalid' && row.nodata ? (this.waterParts[row.nodata] || null) : null,
        loading: lakeLoading,
        error: null,
      };
    }
    return out;
  }

  /**
   * Load boundary, water, and nodata FeatureCollections for a SINGLE lake on
   * `date` with an independent per-lake timeout. Never caches network errors
   * or timeouts, so individual failed lakes can be retried cleanly.
   */
  async loadLakeWater(date, lakeId, { timeoutMs = this.fetchTimeoutMs, signal = null } = {}) {
    const ser = this.waterIndex.lakes[lakeId];
    const row = ser?.months?.[date] || null;
    const entry = {
      lakeId,
      row,
      boundary: ser?.boundary ? (this.waterParts[ser.boundary] || null) : null,
      water: null,
      nodata: null,
      loading: false,
      error: null,
      aborted: false,
    };
    const fetchOpts = { timeoutMs, signal };
    try {
      const [bFc, wFc, nFc] = await Promise.all([
        ser?.boundary ? this.loadWaterPart(ser.boundary, fetchOpts) : null,
        row && row.status !== 'invalid' && row.water ? this.loadWaterPart(row.water, fetchOpts) : null,
        row && row.status !== 'invalid' && row.nodata ? this.loadWaterPart(row.nodata, fetchOpts) : null,
      ]);
      entry.boundary = bFc;
      entry.water = wFc;
      entry.nodata = nFc;
    } catch (err) {
      entry.water = null;
      entry.nodata = null;
      if (err?.isAborted) {
        entry.aborted = true;
      } else {
        entry.error = err?.message || `加载 ${lakeId} ${date} 几何失败`;
      }
    }
    return entry;
  }

  /**
   * Load boundary, water, and nodata FeatureCollections for requested lakes on
   * `date` progressively: each lake runs with its own timeout and invokes
   * `onLakeSettled(snapshot, lakeId, entry)` IMMEDIATELY when it finishes, so
   * a fast lake renders right away even if the other lake hangs or times out.
   */
  async loadMonthWater(date, lakeIds = null, { onLakeSettled = null, timeoutMs = this.fetchTimeoutMs, signal = null } = {}) {
    const ids = lakeIds || Object.keys(this.waterIndex.lakes);
    const current = this.buildPendingMonthWater(date, ids);

    const makeSnapshot = () => {
      const lakes = {};
      const errors = [];
      let loading = false;
      for (const id of ids) {
        const e = current.lakes[id];
        lakes[id] = { ...e };
        if (e.loading) loading = true;
        if (e.error) errors.push({ lakeId: id, date, message: e.error });
      }
      return { date, loading, lakes, errors };
    };

    const tasks = ids.map(async lakeId => {
      if (!current.lakes[lakeId].loading) {
        // Already cached: notify immediately if requested
        if (onLakeSettled) onLakeSettled(makeSnapshot(), lakeId, current.lakes[lakeId]);
        return;
      }
      const entry = await this.loadLakeWater(date, lakeId, { timeoutMs, signal });
      current.lakes[lakeId] = entry;
      if (onLakeSettled && !entry.aborted) {
        onLakeSettled(makeSnapshot(), lakeId, entry);
      }
    });

    await Promise.all(tasks);
    return makeSnapshot();
  }

  /**
   * Load all 384 frozen water-data GeoJSON parts in bounded batches so full
   * spatial-water-export/v2 export (978 month records, 945 canonical IDs)
   * matches exports.js exactly.
   */
  async loadAllWaterParts(onProgress = null) {
    const allPaths = Object.keys(this.waterIndex.part_sha256 || {});
    const missing = allPaths.filter(p => !this.waterParts[p]);
    let done = allPaths.length - missing.length;
    if (onProgress) onProgress(done, allPaths.length);

    const BATCH = 24;
    for (let i = 0; i < missing.length; i += BATCH) {
      const slice = missing.slice(i, i + BATCH);
      await Promise.all(slice.map(p => this.loadWaterPart(p)));
      done += slice.length;
      if (onProgress) onProgress(done, allPaths.length);
    }
    return this.waterParts;
  }

  getImagerySpec(id) {
    return (this.terrainManifest?.imagery || []).find(im => im.id === id) || null;
  }
}

