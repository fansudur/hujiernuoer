/* Optional private imagery evidence, independent of the monthly science contract. */
export const WAYBACK_LAYERS = Object.freeze({
  'wayback-roads': { name: '道路时序', color: '#f8c770', symbol: '┄', count: 2 },
  'wayback-main': { name: '主湖岸线对照', color: '#67e8f9', symbol: '◈', count: 13 },
  'wayback-nw': { name: '西北坡及西长湖', color: '#fda4af', symbol: '◇', count: 3 },
  'wayback-context': { name: '参照水域与场院', color: '#bef264', symbol: '◇', count: 5 },
  'wayback-source-catalog': { name: '源景目录（抽样点）', color: '#c4b5fd', symbol: '＋', count: 8 },
});
export const WAYBACK_IDS = Object.freeze(Object.keys(WAYBACK_LAYERS));
export const isWaybackLayer = layer => Object.hasOwn(WAYBACK_LAYERS, layer);
export const isWaybackId = id => typeof id === 'string' && /^wayback-[a-z0-9][a-z0-9._-]*$/.test(id);
export const isWayback2dOnly = feature => feature?.properties?.map_scope === '2d-only' &&
  isWaybackLayer(feature.properties.layer);

export function safeWaybackUrl(input) {
  try {
    const u = new URL(input);
    if (u.origin === 'https://livingatlas.arcgis.com' && u.pathname === '/wayback/' &&
        !u.username && !u.password) return u.href;
  } catch { /* Absent or invalid source link. */ }
  return null;
}

export function validateWayback(payload, existingIds, demBounds) {
  const fail = () => { throw new Error('Invalid Wayback evidence layer'); };
  if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features) ||
      payload.features.length !== 31 || !Array.isArray(demBounds) || demBounds.length !== 4 ||
      !demBounds.every(Number.isFinite)) fail();
  const counts = Object.fromEntries(WAYBACK_IDS.map(id => [id, 0]));
  const ids = new Set();
  let twoDOnly = 0;
  for (const f of payload.features) {
    const p = f?.properties, g = f?.geometry;
    if (f?.type !== 'Feature' || !isWaybackId(f.id) || ids.has(f.id) || existingIds.has(f.id) ||
        !isWaybackLayer(p?.layer) || !p.name || p.status !== 'context' || !p.wayback_role ||
        !Array.isArray(p.dates) || !p.dates.every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))) fail();
    ids.add(f.id);
    counts[p.layer]++;
    const c = g?.coordinates;
    let vertices;
    if (g?.type === 'Point') vertices = [c];
    else if (g?.type === 'LineString' && Array.isArray(c) && c.length >= 2) vertices = c;
    else if (g?.type === 'Polygon' && Array.isArray(c) && c.length &&
             c.every(ring => Array.isArray(ring) && ring.length >= 4)) vertices = c.flat();
    else fail();
    if (!vertices.every(v => Array.isArray(v) && v.length === 2 &&
        v.every(Number.isFinite) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90)) fail();
    if (g.type === 'Polygon' && !c.every(r => r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1])) fail();
    const [west, south, east, north] = demBounds;
    const within = vertices.every(([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north);
    if (p.map_scope !== (within ? '2d-3d' : '2d-only')) fail();
    if (!within) {
      if (f.id !== 'wayback-modern-far-north-wetland-review') fail();
      twoDOnly++;
    }
  }
  if (twoDOnly !== 1 || !WAYBACK_IDS.every(id => counts[id] === WAYBACK_LAYERS[id].count)) fail();
  return payload.features;
}

export function createWaybackLoader(fetcher, validate, onState) {
  let phase = 'idle', active = null, value = null;
  const notify = () => onState?.(phase);
  return {
    get phase() { return phase; },
    get value() { return value; },
    ensure() {
      if (value) return Promise.resolve(value);
      if (active) return active;
      phase = 'pending';
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10000);
      active = Promise.resolve().then(() => fetcher(ctrl.signal)).then(validate).then(features => {
        value = features;
        phase = 'ready';
        return features;
      }, () => {
        phase = 'error';
        return null;
      }).finally(() => {
        clearTimeout(timeout);
        active = null;
        notify();
      });
      notify();
      return active;
    },
  };
}

export function waybackVisualSpec(feature) {
  const p = feature.properties, d = WAYBACK_LAYERS[p.layer];
  return {
    roleKey: p.layer, roleLabel: p.wayback_role || '多期影像判读',
    symbol: d.symbol, stroke: d.color, fill: d.color + '24',
    hatch: null, dash: [3, 4], lineWidth: 2.1, color3d: parseInt(d.color.slice(1), 16),
  };
}

export function sourceRows(p) {
  const r = p.wayback_record || {};
  const rows = r.scene_catalog || r.carriageway_timeline || r.observations || [];
  if (!rows.length) {
    const browse = safeWaybackUrl(r.browse_url);
    return browse ? [{ label: '打开影像定位', url: browse }] : [];
  }
  const mapped = rows.map(row => ({
    label: row.capture,
    note: row.observed || row.use || '',
    url: safeWaybackUrl(row.browse_url),
  }));
  const browse = safeWaybackUrl(r.browse_url);
  if (browse && !mapped.some(row => row.url)) mapped.push({ label: '打开影像定位', url: browse });
  return mapped;
}
