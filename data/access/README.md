# 通行与动线比较：最小复算说明

## 本版新增什么
纯数据与图算法 `assets/access-analysis.js` 不依赖 DOM、Three.js 或页面结构。UI 为独立的 `assets/access-ui.js` 和 CSS；参数及来源在本目录。已有道路、参考点、报告未覆盖。

## 实际复算
运行 `node dist/data/access/recompute.mjs`（Node.js 18+，无需安装包、无需联网），生成本目录 `analysis-summary.json`。记录运行时间、Node 版本、输入 SHA-256、两类通行情景 × 两种拓扑假设 × 三个参考终点的最短距离/最少转向结果，包含用于复算的原道路边 ID。文件内 status=actually_executed 表示已执行，不代表现场验证。

球面半径 6371008.8 m；经纬度 EPSG:4326；长度为球面折线长度，不是坡面长度。Dijkstra 距离和角度算法均不使用实测速度、人流、费用或动物行为模型。

## 假设可见，不混为实测
- 308 源要素含 298 道路和 10 水系；只用 highway，道路类别/explicit access 根据规则筛选。
- 原始 OSM node ID 未保留；同坐标端点连通是代理假设，必须保留与严格 layer 分开的敏感性比较；不把没有共同顶点的几何交叉自动连通。
- 办公院近似点与最近现有路网顶点之间的直线约 57 m，仅为用户显式启用的候选接线，不是已存在的通路。
- 终点为已有参考点附近的真实源顶点，显示偏移距离；不是把原参考点伪装为已测路口。
- 示例删段不代表实际雨季封路。水面/岸线月份不改变道路历史；无实测季节性路网，不能回填 1956 年以来的通行状态。
- 累计转向最少为边状态 Dijkstra，转向度数优先、距离同分排序。每个原折线弯折均计入，受道路取点影响；不是标准整合度、选择度、NACH 或人流预测。
- 模型绕行数值只说明这份网络的敏感性，尤其可能受到漏路、草原开放通行、门禁和桥接拓扑影响；不能直接当作经营收益、场地安全或施工依据。

## 人机分工
用户提出结合空间句法进行分析和地图表达、要求看一版原型。AI 在原有冻结地理资料上设计可切换图模型、计算和网页表达；未由此声称用户做过现场通行调查、模型已经专家认证或任何新的采样记录。

空间关系方法背景：https://www.spacesyntax.online/overview-2/analysis-of-spatial-relations/
OSM 道路来源：© OpenStreetMap contributors，ODbL；源要素保留 osm_id 和 osm_timestamp，混合年代不当作单一测绘日。


## Office-to-shore proximity (primary question, 2026-10-28)

The default interface now compares the user-identified office reference point with the closest classified-water boundary in two qualified JRC months. Existing OSM route analysis remains a separate selectable question. These are **distance-measurement lines, not proposed paths**.

Inputs remain `office_reference.geojson`, `linked/shoreline_index.json` and its 72 qualified monthly `water_geojson` files. No new shoreline, road, elevation or permission record was invented. `office-shore-summary.json` retains per-input SHA256 hashes and each date's result. Run from any directory with Node18+:

    node dist/data/access/recompute-office-shore.mjs

Algorithm: project each boundary segment locally around the office into an equirectangular metre plane, find its clamped closest point, measure that candidate with haversine distance, and choose the smallest. Polygon holes are included. If office falls within classified water, suppress the line. A legitimate zero-water month yields null distance/no endpoint, not a fake shore. This is map-plane proximity, not a shortest terrain path. Pixel-scale boundary and approximate office coordinates dominate surveying interpretation; UI rounds metres.

Default comparison: 2021-07 =1417.671m and2024-07 =1296.458m, approximately121m closer. The two nearest endpoints differ, so this does **not** mean one fixed shore point moved121m. The labels display whole-window water area separately; there is no false common-valid area subtraction. Unknown pixels and soft ground are not safe terrain. No fence, land right, access, slope cost, bearing capacity or travel time is inferred.

An existing-data test checks72 saved results,17 legitimate zero-water records, synthetic polygon/hole edge cases, and5500 sample points before the55 valid measurement endpoints. That sampled non-crossing test is not a field-access validation. The interface separately explains seasonal versus same-month cross-year comparisons and flags pre-existing disputed classifications.
