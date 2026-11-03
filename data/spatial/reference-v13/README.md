# 扩展范围卫星定位底图

本补充仅扩大网页定位背景，不替代历史研究观测，不修改水面、草地或气象统计。

- local：2026-08-08 Sentinel-2A，覆盖扩展地形的完整地理画幅。有效像元99.9949%，办公院位置有有效影像。
- regional：2026-07-25 Sentinel-2B，覆盖呼和诺尔、城镇和本湖之间的完整区域画幅。有效像元99.2906%，呼和诺尔固定湖窗有效99.9814%。
- 两张均为真实单日观测，不是跨日拼接、生成图像或云洞填补。少量云/阴影等无效区域保持透明。
- 原始RGB10m、SCL20m。为网页区域定位以30m最近邻采样，不能用于建筑细部、湖岸精测或把显示分辨率当作测量精度。
- 底图日期与上方所选历史观测日期不同，界面须分别显示。
- 精确地理范围以manifest.json为准，WGS84经纬度；EPSG32650裁剪后最近邻重投影，不拉伸小图冒充大范围。

## 复现

依赖：Python3、GDAL Python绑定、NumPy、SciPy；联网可读取Earth Search公开Sentinel COG。运行：

    python3 reproduce.py --cache reference-cache --output reference-output

source_stac.json保存所用两景的原始资产元数据，包括URL和反射率scale/offset。config.json保存两个固定裁剪范围。已有缓存时不重新下载。manifest.json记录原始裁剪的SHA256、显示图SHA256、质量规则和日期。脚本已实际运行，离线缓存复算两图PNG的SHA256完全相同。

## 核验

checks.json记录实际执行结果：两图共10000个随机像元按目标像元中心逆投影到原始裁剪、独立计算质量掩膜和RGB，RGBA不一致0；办公院透明度255；呼和诺尔固定研究窗有效比例与全图比例分开核验。PNG配套世界文件保留17位精度，避免舍入恰在最近邻分界上的像元。

## 来源和许可

Contains modified Copernicus Sentinel data (2026). Earth Search public COG distribution.
https://cds.climate.copernicus.eu/licences/ec-sentinel
https://dataspace.copernicus.eu/terms-and-conditions

原始整景不打包；公开COG索引与必要裁剪复现参数已保留。旧版定位底图与旧历史影像未覆盖。
