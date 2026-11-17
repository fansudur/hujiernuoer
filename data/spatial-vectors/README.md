# 水路空间矢量：可溯源部分交付

本目录只导出既有证据的空间表达，不修改前端，不声称第 3、4 项已全部完成。manifest.json 登记源提交、SHA256、坐标范围、筛选口径和缺失项。坐标为 EPSG:4326，经度在前。

- `profiles.geojson`：T6/T7/T8/P1/P2 五条 LineString，197 个顶点完全取自 `data/water-network/evidence.json` 的剖面采样经纬度，不重新拟合。`station_m` 与顶点逐一对应；`zero_anchor_lonlat` 为源 station=0 的准确数字值。T6/T7/T8 北正南负；P1/P2 从首点向末点为正，负向未采样，不延长。P1/P2 原始定位是截图近似位置，数字精度不代表实测精度。所有线均不是已证实水路。
- `profile_zero_anchors.geojson`：五个源 0m 锚点，非现场测量点。
- `secondary_roads.geojson`：现有 OSM 上下文数据中，具有 highway、ref 不含 G332，且线段与 [119.61,49.105,119.73,49.175] 相交的 75 个对象。保留原始上下文几何，不再次裁剪，因此几何实际范围大于筛选框。没有擅自把未命名道路标成“北路”或“西路”；仍需结合原始命名/定位证据确认对应关系。
- `hotspot_reference_segment.geojson`：院界参考线 2100–2270m 插值段，只是已有参考线，不是 E_S_20_100 统计条带，不是热点像元面。
- `hotspot_may_summary.json`：保留 2025/2026 年 5 月聚合统计 0.56/0.84ha，不能用面积推算像元位置。

## 未恢复部分

未找到 E_S_20_100 原始条带边界及可完整复现其投影/缓冲口径的源文件；未找到两期重复水样像元身份或地理配准掩膜；未找到 C 线分析框及配对控制框的原始四角。近似点不能确定框尺寸，其他 C_ROAD_1/2 路线相交点也不能代替这些窗口。未生成空 GeoJSON 冒充无水或已完成。

## 道路来源与许可

© OpenStreetMap contributors，ODbL 1.0，https://www.openstreetmap.org/copyright 。原始有界 API 数据取得时间为 2026-10-27T03:37Z；osm_timestamp 是对象最后编辑时间，不是实测日期。原始筛选、范围与来源详见 `data/reference/README.md` 和 `data/reference/manifest.json`。社区地图不完备，未标道路/桥梁不等于不存在；道路不能证明通行性、涵洞、泄洪或水力连通。
