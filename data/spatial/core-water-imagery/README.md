# 核心水路区 Sentinel-2 真彩参考底图

两期：2026-08-08（盛夏定位）、2025-05-28（五月对照）。来源 Earth Search Sentinel-2 Collection 1 L2A 原生 10m TCI，不是旧 20m 裁剪升采样。

## 文件用法
- `*_native10m.tif`：EPSG:32650 原生整数像元窗口，903×810，10m，RGB 数值未重采样。第4波段是透明度。真实定位使用 GeoTIFF CRS/仿射变换；四角的 WGS84 坐标和包络见 manifest。UTM 矩形变换到 WGS84 后不是正北向矩形。
- `*_wgs84_nearest.png`：供普通地图叠加的独立最近邻重投影展示图，878×779；`bounds_wgs84=[119.61,49.105,119.73,49.175]`，四角顺序为左上、右上、右下、左下。不是“原生经纬网10m”。未做双线性插值、补洞或多日期拼接。
- `manifest.json`：来源、具体日期、CRS、窗口、精确四角、SHA256、质量规则与解释边界。

## 五月选片
2025年5月16景、2026年5月17景，共33个覆盖研究区的 STAC 候选，逐景读取20m SCL检查窗。按 SCL 保留比例降序，全景云量升序破同分，选2025-05-28；保留类别2/4/5/6/7，剔除0/1/3/8/9/10/11。类别7为未分类，保留比例不等于人工确认的无云率。候选清单与分类像元计数见 `may-scene-quality.json`。不声称这是所有可能源产品中的绝对最优景。

透明度同时排除 TCI任一通道为0、SCL剔除类和请求范围外像元；SCL只做最近邻类别映射，无扩张。透明不是“无水”。TCI是提供方已渲染的真彩，不能当定量反射率，也不能替代2025/2026年5月的月内重复水样统计。五月部分黑值保守剔除，因此局部会有少量透明点。

## 复算
安装 numpy rasterio pyproj Pillow requests，运行 `python export_truecolor.py`。`sources/`保留完整查询结果和用于导出的来源；联网即可重取原始 COG 窗口。重查候选可运行 `query_stac.py`、`evaluate_may_quality.py`，但未来查询可能返回重处理后的不同产品，须作为新版本核查。重导出后重新登记 supporting_files 和许可说明，不覆盖其他研究基线。

Contains modified Copernicus Sentinel data (2025, 2026). 来源与使用条款见 manifest 的 Sentinel Data Legal Notice。全部成果仅为参考底图，不新增水路、岸线或工程定位结论。
