# 同地理画布卫星影像补充

本包只补齐地图展示，不修改湖面、NDVI、气象或其他科研统计。旧 imagery-v11 与原始缓存均保留。

## 新增与覆盖

- 38 期真彩色影像：35 期 Sentinel-2、3 期 Landsat；另保留 4 期历史红波段灰阶。
- 31 期 Sentinel 使用 5.4 × 3.8 km 办公院及草地区域。已有红色/SCL，33 日期新补同原景绿色和蓝色，共 66 个小窗口波段；其中 3 日期随后使用下述全范围。
- 2024-07-02、2024-07-30、2025-07-24 补取与近邻地形相同显示范围的同日 RGB/SCL，共 12 波段。20 米平均 RGB、最近邻 SCL；不插值时间。
- 1992-07-05、2007-07-31、2021-07-21 恢复已有 24 × 27 km Landsat 区域原片覆盖，避免只截湖边。
- 2026-08-08 此包仍使用此前核验的参考窗口；更广参考背景由独立 reference-v13 包提供。
- 所有显示画布与 terrain_expanded 一致，1400 × 1510 像素。统一画布不增加原始精度，透明区域没有该期影像；它可以显示明确另标日期的参考底图，不可算作当期观测。

## 质量规则

Sentinel 真彩色沿用旧版显示规则：RGB DN > 0、SCL != 0；真实云、阴影和积雪可见，不隐瞒或补造。该显示有效范围不等于科学质量合格范围，NDVI 和水面严格筛选并未改变。2024-07-30 全源窗口 SCL 初筛清晰比例约 75.84%，2024-07-02 为 100%，2025-07-24 约 99.79%；没有据此变更结论。Landsat 沿用既有云、影、雪、饱和掩膜，空白不补填。

## 核验与复现

checks.json 对 42 图各做 4000 个确定性随机输出像素的逆坐标最近邻 RGBA 比对，合计 168000 点零差异。source_checks.json 对 3 个扩大窗口的红色波段与已有草地窗口逐像素比较，153900 像素零差异。office-coverage-check.json 检查实际办公院参考点的输出 alpha，不能替代地面控制点校准。

build.py、fetch_missing.py、fetch_full.py 与 check_sources.py 保留原步骤。原始大数据留本地，仅分发路径、公开来源 URL、校验值。使用 /usr/bin/python3，依赖 GDAL、NumPy、Pillow。通过 Earth Search 的公共 Sentinel COG 取原景，不使用商业地图截图；Contains modified Copernicus Sentinel data (2017–2026)，Landsat imagery courtesy USGS。波段元数据中的 scale/offset 及 legacy boa_offset_applied 区别保留。

并非所有历史年份都有完整区域真彩色，远处呼和诺尔不能凭这些小窗口制造历史影像。

## 本地路径设置

脚本支持 LAKE_SITE_DIST（网站 dist 目录）和 LAKE_DATA_WORKSPACE（数据缓存根目录）环境变量，不要求保留本次机器绝对路径。先按 manifest/source 路径索引准备旧 imagery-v11、原 STAC source_manifest 和已有草地/Landsat缓存，再运行 fetch_missing.py、fetch_full.py、check_sources.py、build.py。这不是自包含原始遥感数据下载包；缺少旧缓存时不能宣称已离线复算。依赖见 requirements.txt，GDAL 使用与系统版本匹配的 Python 绑定。脚本改成可配置根目录后做语法核验，生成图像与数值核验来自相同算法的实际执行结果。
