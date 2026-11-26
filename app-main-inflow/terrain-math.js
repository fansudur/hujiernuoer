/* ==========================================================================
   app/terrain-math.js
   Exact geographic projection and triangle-plane barycentric DEM math for
   hujiernuoer-handoff-v2/terrain/dem.json (392 x 276 point-node lattice where
   first/last row & column centers lie EXACTLY on bounds_wgs84, north-to-south,
   west-to-east).
   ========================================================================== */

export const AOI_BOUNDS = [119.61, 49.101, 119.77, 49.175];
export const REF_LAT_DEG = 49.138;
export const METERS_PER_DEG_LAT = 111320;
export const METERS_PER_DEG_LON = METERS_PER_DEG_LAT * Math.cos((REF_LAT_DEG * Math.PI) / 180);

export function lonLatToLocalKm(lon, lat, bounds = AOI_BOUNDS) {
  const [w, s, e, n] = bounds;
  const cx = (w + e) * 0.5;
  const cy = (s + n) * 0.5;
  const xKm = ((lon - cx) * METERS_PER_DEG_LON) / 1000;
  const zKm = -((lat - cy) * METERS_PER_DEG_LAT) / 1000; // -Z = North, +Z = South
  return [xKm, zKm];
}

export function localKmToLonLat(xKm, zKm, bounds = AOI_BOUNDS) {
  const [w, s, e, n] = bounds;
  const cx = (w + e) * 0.5;
  const cy = (s + n) * 0.5;
  const lon = cx + (xKm * 1000) / METERS_PER_DEG_LON;
  const lat = cy - (zKm * 1000) / METERS_PER_DEG_LAT;
  return [lon, lat];
}

/**
 * Sample elevation on the EXACT triangle surface of the 392x276 point-node DEM.
 * Node (c, r) sits at:
 *   lon = w + (c / (width - 1)) * (e - w)
 *   lat = n - (r / (height - 1)) * (n - s)
 * Quad triangulation matches buildDemMeshData:
 *   tri 1 (fx + fy <= 1): (TL, BL, TR)
 *   tri 2 (fx + fy >  1): (TR, BL, BR)
 */
export function sampleDemElevation(dem, lon, lat) {
  if (!dem || !dem.elevations_m || !dem.bounds_wgs84) return null;
  const [w, s, e, n] = dem.bounds_wgs84;
  const cols = dem.width;
  const rows = dem.height;
  if (lon < w - 1e-9 || lon > e + 1e-9 || lat < s - 1e-9 || lat > n + 1e-9) return null;

  const u = Math.max(0, Math.min(cols - 1, ((lon - w) / (e - w)) * (cols - 1)));
  const v = Math.max(0, Math.min(rows - 1, ((n - lat) / (n - s)) * (rows - 1)));

  const c0 = Math.min(cols - 2, Math.floor(u));
  const r0 = Math.min(rows - 2, Math.floor(v));
  const fx = u - c0;
  const fy = v - r0;

  const el = dem.elevations_m;
  const zTL = el[r0 * cols + c0];
  const zTR = el[r0 * cols + (c0 + 1)];
  const zBL = el[(r0 + 1) * cols + c0];
  const zBR = el[(r0 + 1) * cols + (c0 + 1)];

  if (fx + fy <= 1) {
    return zTL + (zTR - zTL) * fx + (zBL - zTL) * fy;
  }
  return zBR + (zBL - zBR) * (1 - fx) + (zTR - zBR) * (1 - fy);
}

/**
 * Build flat typed arrays for Three.js BufferGeometry on the exact point-node lattice.
 * Satellite PNG outer edges sit on bounds_wgs84 (north-up), so:
 *   uvU = c / (cols - 1)   (0 at W, 1 at E)
 *   uvV = 1 - r / (rows - 1) (1 at N, 0 at S; matches WebGL flipY = true)
 */
export function buildDemMeshData(dem, { baseElev, exag = 4 } = {}) {
  const [w, s, e, n] = dem.bounds_wgs84;
  const cols = dem.width;
  const rows = dem.height;
  const el = dem.elevations_m;
  const minZ = Number.isFinite(baseElev) ? baseElev : Math.min(...el);

  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);

  for (let r = 0; r < rows; r++) {
    const ty = r / (rows - 1);
    const lat = n - ty * (n - s);
    const uvV = 1 - ty;
    for (let c = 0; c < cols; c++) {
      const tx = c / (cols - 1);
      const lon = w + tx * (e - w);
      const k = r * cols + c;
      const [xKm, zKm] = lonLatToLocalKm(lon, lat, dem.bounds_wgs84);
      const yKm = ((el[k] - minZ) / 1000) * exag;
      positions[k * 3] = xKm;
      positions[k * 3 + 1] = yKm;
      positions[k * 3 + 2] = zKm;
      uvs[k * 2] = tx;
      uvs[k * 2 + 1] = uvV;
    }
  }

  let ptr = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = r * cols + c;
      const tr = tl + 1;
      const bl = (r + 1) * cols + c;
      const br = bl + 1;
      indices[ptr++] = tl;
      indices[ptr++] = bl;
      indices[ptr++] = tr;
      indices[ptr++] = tr;
      indices[ptr++] = bl;
      indices[ptr++] = br;
    }
  }

  return { positions, uvs, indices, baseElev: minZ };
}

export function geometryBounds(geom) {
  if (!geom) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = c => {
    if (!Array.isArray(c) || !c.length) return;
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
    } else {
      for (const item of c) visit(item);
    }
  };
  visit(geom.coordinates);
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

export function geometryCenter(geom) {
  const b = geometryBounds(geom);
  if (!b) return null;
  return [(b[0] + b[2]) * 0.5, (b[1] + b[3]) * 0.5];
}
