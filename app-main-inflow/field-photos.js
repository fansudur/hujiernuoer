export const FIELD_LAYER = 'field-photos-20261122';
export const FIELD_LABEL = '11 月 22 日现场照片';
export function validateFieldPhotos(data, known) {
  if (data?.type !== 'FeatureCollection' || data.features?.length !== 34) throw Error('field photos');
  const ids = new Set();
  for (const f of data.features) {
    const p = f?.properties, c = f?.geometry?.coordinates;
    if (f?.type !== 'Feature' || !/^field-photo-20[0-4][0-9]$/.test(f.id) || ids.has(f.id) || Number(f.id.slice(-4)) > 2041 || known.has(f.id) ||
      f.geometry?.type !== 'Point' || c?.length !== 2 || !c.every(Number.isFinite) || c[0]<119.55 || c[0]>119.83 || c[1]<49.04 || c[1]>49.22 ||
      p?.layer !== FIELD_LAYER || !/^\d{2}:\d{2}:\d{2}$/.test(p.capture_time) ||
      !(Number.isFinite(p.heading_deg) && p.heading_deg>=0 && p.heading_deg<360) ||
      !(Number.isFinite(p.accuracy_m) && p.accuracy_m>0) || !Array.isArray(p.nearby_ids)) throw Error('invalid field photo');
    ids.add(f.id);
  }
  if (data.features.some(f=>f.properties.nearby_ids.some(id=>id===f.id || !ids.has(id)))) throw Error('field photo references');
  return data.features;
}
