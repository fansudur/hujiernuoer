/* ==========================================================================
   app/geo-pick.js
   Shared, zero-DOM exact geometry picking for BOTH 2D Canvas and 3D WebGL.
   - Polygons: exact ray-casting against outer ring AND all interior holes
     (never bounding-box only!), choosing smallest actual polygon area.
   - Lines: exact perpendicular distance to EVERY consecutive (optionally
     densified for 3D terrain draping) line segment in screen space.
   - Points: screen-space proximity within tolerance.
   ========================================================================== */

export function pointInRing(lon, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Exact polygon test: point must lie inside outer ring (rings[0]) AND outside
 * EVERY interior hole ring (rings[1..]).
 */
export function pointInPolygonRings(lon, lat, rings) {
  if (!Array.isArray(rings) || !rings.length) return false;
  if (!pointInRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lon, lat, rings[i])) return false;
  }
  return true;
}

export function pointInGeoGeometry(lon, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return pointInPolygonRings(lon, lat, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (pointInPolygonRings(lon, lat, poly)) return true;
    }
    return false;
  }
  return false;
}

function ringAbsAreaDeg2(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(sum) * 0.5;
}

export function geoPolygonAreaDeg2(geometry) {
  if (!geometry) return Infinity;
  const polys =
    geometry.type === 'Polygon' ? [geometry.coordinates] :
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  if (!polys.length) return Infinity;
  let total = 0;
  for (const rings of polys) {
    if (!rings.length) continue;
    let a = ringAbsAreaDeg2(rings[0]);
    for (let h = 1; h < rings.length; h++) a -= ringAbsAreaDeg2(rings[h]);
    total += Math.max(0, a);
  }
  return total;
}

export function distToSegment2D(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Densify polyline segments so 3D terrain-draped lines hug hills and 3D
 * segment hit-testing matches the rendered curve pixel-for-pixel.
 */
export function densifyLineCoords(coords, maxDeg = 0.0008) {
  if (!Array.isArray(coords) || coords.length < 2 || !maxDeg || maxDeg <= 0) return coords || [];
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.min(128, Math.ceil(dist / maxDeg)));
    for (let s = 1; s <= steps; s++) {
      out.push([a[0] + (dx * s) / steps, a[1] + (dy * s) / steps]);
    }
  }
  return out;
}

/**
 * Unified feature picker shared by 2D Canvas and 3D WebGL.
 * Priority: Point -> Line (segment distance) -> Polygon (exact ring + holes, smallest real area).
 *
 * @param {object} opts
 * @param {number} opts.px - pointer X in viewport CSS px
 * @param {number} opts.py - pointer Y in viewport CSS px
 * @param {[number, number] | null} opts.groundLonLat - exact WGS84 ground point under cursor
 * @param {Array} opts.features - currently visible GeoJSON features
 * @param {(lon: number, lat: number, geomType: string) => ({x:number, y:number} | null)} opts.projectPoint
 * @param {number} [opts.densifyMaxDeg=0] - >0 in 3D to match terrain-draped segments
 * @param {number} [opts.pointTolPx=18]
 * @param {number} [opts.lineTolPx=10]
 */
export function pickFeatureUnified({
  px,
  py,
  groundLonLat,
  features,
  projectPoint,
  densifyMaxDeg = 0,
  pointTolPx = 18,
  lineTolPx = 10,
}) {
  if (!Array.isArray(features) || !features.length) return null;

  // 1. Points first
  let bestPt = null;
  let bestPtDist = pointTolPx;
  for (const f of features) {
    if (f.geometry?.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    const sc = projectPoint(lon, lat, 'Point', f);
    if (!sc) continue;
    const d = Math.hypot(sc.x - px, sc.y - py);
    if (d < bestPtDist) {
      bestPtDist = d;
      bestPt = f;
    }
  }
  if (bestPt) return bestPt;

  // 2. Lines second (exact perpendicular distance to EVERY consecutive segment)
  let bestLine = null;
  let bestLineScore = lineTolPx;
  for (const f of features) {
    const t = f.geometry?.type;
    if (t !== 'LineString' && t !== 'MultiLineString') continue;
    const lines = t === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let minD = Infinity;
    for (const rawLine of lines) {
      const line = densifyMaxDeg > 0 ? densifyLineCoords(rawLine, densifyMaxDeg) : rawLine;
      if (line.length < 2) continue;
      let prev = projectPoint(line[0][0], line[0][1], 'LineString', f);
      for (let i = 1; i < line.length; i++) {
        const cur = projectPoint(line[i][0], line[i][1], 'LineString', f);
        if (prev && cur) {
          const d = distToSegment2D(px, py, prev.x, prev.y, cur.x, cur.y);
          if (d < minD) minD = d;
        }
        prev = cur;
      }
    }
    const penalty = f.properties?.layer === 'secondary-roads' ? 3 : 0;
    if (minD + penalty < bestLineScore) {
      bestLineScore = minD + penalty;
      bestLine = f;
    }
  }
  if (bestLine) return bestLine;

  // 3. Polygons third (exact outer ring + interior holes; smallest actual area wins)
  if (!groundLonLat || !Number.isFinite(groundLonLat[0]) || !Number.isFinite(groundLonLat[1])) {
    return null;
  }
  const [gLon, gLat] = groundLonLat;
  let bestPoly = null;
  let bestArea = Infinity;
  for (const f of features) {
    const t = f.geometry?.type;
    if (t !== 'Polygon' && t !== 'MultiPolygon') continue;
    if (!pointInGeoGeometry(gLon, gLat, f.geometry)) continue;
    const area = geoPolygonAreaDeg2(f.geometry);
    if (area < bestArea) {
      bestArea = area;
      bestPoly = f;
    }
  }
  return bestPoly;
}
