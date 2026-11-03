# 可地理配准的地形/路网参照层

交付日 2026-10-27。manifest.json 为接入主清单。**本包没有湖底模型，没有当前水位，没有推测道路或虚构地名。**

## 网页实际需要
- roads_context/local.geojson：含 highway（道路）、waterway（水系）、railway（若有）的线。请按属性分层，不能全部画成道路。名称依次选 name:zh / name:zh-Hans / name / ref；未知为 null。
- places_context/local.geojson：已具名点，不是完整POI目录。local没有点地名属实际OSM结果，不是数据加载失败。
- terrain_relief_context/local.png：高程分色+真实DSM晕渲。hillshade_* 为灰度晕渲，可叠加其它底图。
- contours_context/local.geojson：5米等高线、25米粗线，EGM2008高程，非湖底/工程等高线。
- study_boundary.geojson：用户手绘研究边界，非权属边界或实测水岸。
- office_reference.geojson：用户办公院参照点，119.660938E / 49.140947N。

原始XML、代码和QA截图不需要随网页加载。PNG均900像素级以下，图层应按需加载。

## 配准：不要把经纬PNG当Web Mercator拉伸
GeoJSON坐标为 [lon,lat]、EPSG:4326，PNG第0行为北，bounds为外边缘 [west,south,east,north]。PNG的u=(lon-west)/(east-west)，图像向下v=(north-lat)/(north-south)。本包extent严格等于既有 terrain_context.json / terrain_local.json。若地图库用3857，须先warp PNG至3857，不可直接扭曲套矩形。Three.js地形与道路/边界/水面必须使用同一lon/lat转世界坐标函数；道路高度采样DSM再加微小视觉偏移，不能把道路浮在零高程。北箭头随地图bearing旋转。比例尺应按当前视域纬度计算地面距离。

## 来源、日期、限制
OSM官方API有界map请求：约13×12km，与DSM上下文完全一致。于2026-10-27T03:37Z取得。每对象osm_timestamp仅为最后编辑时间，不是实测日期。来源、查询URL、完整OSM归属、ODbL 1.0在manifest及原始XML中。展示必须有“© OpenStreetMap contributors”及copyright链接。社区地图不完备，未标道路/桥梁不等于不存在；不能据此判断可通行性、涵洞或泄洪路径。

DEM为既有Copernicus GLO-30 2021版，来源雷达覆盖日期2011-07-31 / 2012-07-17；下载/发布日期不是当前地形年代。native WGS84栅格重投影UTM50N 30m做315°方位/45°高度角晕渲，回投影到两种固定经纬extent。图像超采样只为显示不新增精度。等高线基于相同重投影DSM、5m间隔、8m几何简化。极薄重投影边缘的无效晕渲像元用中性亮度180显示，**不会填补高程或创造等高线**。研究范围内43.5%原始像元为湖泊编辑，不能据此反演水深。

必须保留 Copernicus attribution、免责和copernicus_license.txt；manifest给出准确原文。没有使用高德/谷歌未授权瓦片。卫星影像由相邻内容包提供，覆盖范围不同，尤其不能向办公室/上下文强行扩展。

## QA / 复算
/usr/bin/python3 build_reference.py。需系统GDAL、NumPy、Pillow。qa.json记录节点完整性、图层计数、办公点范围检查。qa_overlay.png仅视觉QA（不是底图资产）。所有道路已用真实坐标裁剪；无需GCJ02/WGS84猜测偏移。无需联网即可从原始XML与既有native DSM复算。使用SHA256.json核验。
