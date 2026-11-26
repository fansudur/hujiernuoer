/* New generated profiles supplement, not mutate, the frozen evidence package. */
export const MAIN_PROFILE_LAYER = 'main-lake-profiles';
const MIN_LON=119.61,MAX_LON=119.77,MIN_LAT=49.10,MAX_LAT=49.175;
const pointValid = p => Array.isArray(p) && p.length===2 && p.every(Number.isFinite) &&
  p[0]>=MIN_LON-1e-9 && p[0]<=MAX_LON+1e-9 && p[1]>=MIN_LAT-1e-9 && p[1]<=MAX_LAT+1e-9;

export function validateMainProfiles(fc, existingIds) {
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features) ||
      fc.features.length < 5 || fc.features.length > 12) throw new Error('主湖剖面包不完整');
  const ids=new Set();
  for (const feature of fc.features) {
    const { id, geometry:g, properties:p } = feature;
    const prof=p?.profile;
    const hasAw=prof?.columns?.[4]==='aw3d30_m';
    if (feature.type!=='Feature' || typeof id!=='string' || existingIds.has(id) || ids.has(id) ||
        p?.layer !== MAIN_PROFILE_LAYER || p?.profile_group!=='main-lake' ||
        typeof p?.name !== 'string' || g?.type !== 'LineString' || !Array.isArray(g.coordinates) ||
        g.coordinates.length<2 || !g.coordinates.every(pointValid) ||
        !Array.isArray(prof?.samples) || prof.samples.length < 2 ||
        prof.columns?.slice(0,4)?.join(',') !== 'distance_m,lon,lat,glo30_m' ||
        !Array.isArray(prof.water_mask) || prof.water_mask.length !== prof.samples.length ||
        prof.water_mask.some(v=>typeof v!=='boolean') || !pointValid(p.zero_anchor_lonlat)) throw new Error(id);
    ids.add(id);
    let anchor=false;
    for (let i=0;i<prof.samples.length;i++) {
      const r=prof.samples[i];
      if (!Array.isArray(r) || r.length!==(hasAw?5:4) || !r.slice(0,4).every(Number.isFinite) ||
          !pointValid(r.slice(1,3)) ||
          (hasAw && r[4]!==null && !Number.isFinite(r[4])) ||
          (i>0 && !(r[0]>prof.samples[i-1][0]))) throw new Error(id+' 样点 '+i);
      if (Math.abs(r[0])<1e-6 && Math.abs(r[1]-p.zero_anchor_lonlat[0])<1e-7 &&
          Math.abs(r[2]-p.zero_anchor_lonlat[1])<1e-7) anchor=true;
    }
    if (!anchor) throw new Error(id+' 缺 0 米锚点');
  }
  return fc.features;
}
