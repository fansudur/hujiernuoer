/* Independent wall-boundary check points (S1 / S2) kept separate from eastern marsh & east pool. */
export const NORTH_BOUNDARY_LAYER = 'north-boundary-checks';
export const NORTH_BOUNDARY_DEF = Object.freeze({
  id: NORTH_BOUNDARY_LAYER,
  name: '院墙调查控制点 · S1 与 S2（独立对照）',
  count: 2,
});

export function validateNorthBoundaryChecks(fc, existingIds = new Map()) {
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features) || fc.features.length !== 2) {
    throw new Error('院墙调查控制点格式不匹配');
  }
  const ids = new Set();
  for (const f of fc.features) {
    const c = f?.geometry?.coordinates;
    const p = f?.properties;
    if (f?.type !== 'Feature' || !/^wall-check-s[12]$/.test(f.id) || ids.has(f.id) || existingIds.has(f.id) ||
        f.geometry?.type !== 'Point' || !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite) ||
        c[0] < 119.65 || c[0] > 119.72 || c[1] < 49.14 || c[1] > 49.16 ||
        p?.layer !== NORTH_BOUNDARY_LAYER || p?.status !== 'candidate' || typeof p?.name !== 'string') {
      throw new Error(`无效的院墙调查控制点: ${f?.id}`);
    }
    ids.add(f.id);
  }
  return fc.features;
}
