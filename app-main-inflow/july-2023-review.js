/* Satellite sampling geometry independent of the monthly water series. */
export const JULY_LAYER = 'july-2023-review';
export const JULY_DEF = { id: JULY_LAYER, name: '2023 年 7 月 · 三期影像对照窗', count: 14 };
export const JULY_DATES = Object.freeze(['2023-07-11', '2023-07-16', '2023-07-18']);
const id = suffix => 'july2023-' + suffix;
const notes = {
  office_vicinity: '办公院附近的影像采样，不是院区边界。实际出口还没有定位。',
  office_low_near_alos: '两套地形模型给出的东南停点之一，三期都没在采样格中辨认出明水。实际出水还要沿院边核查。',
  office_low_far_cop: '另一个东南模型停点。三期都没在采样格中辨认出明水，不排除短时浅流。',
  f1_w: '和桥东的变化方向一致，7 月 16 日地表光谱变化较强，18 日接近此前状态。',
  f1_e: '和桥西变化相近，优先核查桥两侧。影像没有拍到过桥水流。',
  north_w: '北侧候选过路点的西肩样本。两侧地表变化的幅度不同，北点的过路位置仍待核查。',
  north_e: '北侧候选过路点的东肩样本。该窗变化比西肩弱。',
  main_inlet_cop: '候选入湖位置。7 月 16 日的两个判水格位于岸边明暗过渡，影像不能确认是明水。',
};
export function validateJulyWindows(collection, existing = new Map()) {
  const { type, features, review } = collection || {};
  if (type !== 'FeatureCollection' || !Array.isArray(features) || features.length !== JULY_DEF.count ||
      !Array.isArray(review?.scenes) || review.scenes.map(s => s.local_time?.slice(0, 10)).join() !== JULY_DATES.join()) {
    throw Error('三期影像对照窗格式不匹配');
  }
  const ids = new Set();
  const point = a => Array.isArray(a) && a.length === 2 && a.every(Number.isFinite) &&
    a[0] >= 119.61 && a[0] <= 119.73 && a[1] >= 49.105 && a[1] <= 49.175;
  const ring = r => Array.isArray(r) && r.length >= 4 && r.every(point) &&
    r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1];
  const polygon = p => Array.isArray(p) && p.length > 0 && p.every(ring);
  const finiteArray = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
  const out = features.map(f => {
    const p = f?.properties;
    const g = f?.geometry;
    const n = f?.id;
    if (f?.type !== 'Feature' || typeof n !== 'string' || !/^july2023-[a-z0-9_-]+$/.test(n) ||
        ids.has(n) || existing.has(n) || !p || typeof p.label !== 'string' || !p.label ||
        p.status !== 'satellite_observation' || p.geometry_role !== 'common_sample_cells_not_water_extent' ||
        p.nominal_cell_m !== 20 || p.native_grid_epsg !== 32650 || !point(p.center_lonlat) ||
        !Number.isInteger(p.common_cells) || !Number.isInteger(p.total_cells) ||
        p.common_cells < 15 || p.common_cells > p.total_cells ||
        p.common_cells / p.total_cells < 0.70 ||
        !finiteArray(p.scene_scl_water_pixels, 3) ||
        p.scene_scl_water_pixels.some(v => !Number.isInteger(v) || v < 0 || v > p.common_cells) ||
        !finiteArray(p.paired_mndwi_median_delta, 2) || !finiteArray(p.ring_paired_mndwi_median_delta, 2) ||
        g?.type !== 'MultiPolygon' || !Array.isArray(g.coordinates) || !g.coordinates.length ||
        !g.coordinates.every(polygon)) throw Error('三期影像对照对象无效');
    ids.add(n);
    return { ...f, properties: { ...p, provenance_status: p.status, status: 'observed', layer: JULY_LAYER,
      name: p.label, dates: JULY_DATES, description: notes[n.slice('july2023-'.length)] ||
      '同一位置的三期有效像元。用于对照地表变化，不代表水路。',
      placement_caveat: '边框只标出共同有效的影像像元，不是水面、湿地边界或水路。' } };
  });
  for (const item of julyEvidence()) if (!item.feature_ids.every(k => ids.has(k))) throw Error('三期对照缺少关联位置');
  return out;
}

export function julyEvidence() {
  return [
    { id: 'july-2023-office-review', title: '办公院来水：先找院边实际出口',
      classification: '遥感观测与地形模型',
      judgment: '三期影像都没在院东南两个候选低点辨认出明水。八个方向的 80 个起点，用两套 30 米地形复算，都在到湖前停住；假设洼地蓄满外溢，两套模型才一致指向主湖西北岸。',
      boundary: '实际出口还没定位。先查院边哪一段出水，再逐段核两个低点与湖岸之间是否相接。',
      feature_ids: ['office_low_near_alos','office_low_far_cop','office_vicinity','main_inlet_cop'].map(id) },
    { id: 'july-2023-f1-review', title: '西坡过路：F1 桥优先于北侧候选点',
      classification: '遥感观测与现场待核',
      judgment: '7 月 11、16、18 日影像中，F1 两肩 16 日同时出现与地表变湿相符的变化，18 日接近此前状态。北侧候选点两肩反应较弱，也不对称。',
      boundary: '框内是影像对照样本。三景都没有拍到水穿桥，东部泥沼周边的本地来水另查。',
      feature_ids: ['f1_w','f1_e','north_w','north_e','bridge_east_old_turn','mud_south_local_entry'].map(id),
      source_refs: [{ label: '7 月中旬区域降雨过程', url: 'https://www.weather.com.cn/neimenggu/sy/tqyw/07/3636091.shtml' }] },
  ];
}
