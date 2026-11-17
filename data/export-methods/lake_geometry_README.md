# 本湖全序列月度几何导出

使用 `data/spatial/lake_geometry_index.json` 作为时序入口，水面与缺测分别在 `lake_water.geojson`、`lake_nodata.geojson`。每条观察以 `water_feature_id`、`nodata_feature_id` 关联要素。文件内地理坐标均为 EPSG:4326。

- 日历覆盖 1984-01 至 2024-12 共 492 槽，其中产品开始于 1984-04。
- 全部 72 个双分母质量合格月均已包含，实际合格日期为 1985–2024；17 个月为合格显式零，55 个水面要素、41 个缺测要素。
- `geometry_available: true` 且 `water_feature_id: null` 表示合格观测零检出；`geometry_available: false` 表示未提供合格几何，不得当成无水。合格月 `nodata_feature_id: null` 表示统计掩膜内没有缺测像元。
- 本次逐坐标无损整理已有 `data/linked/shorelines` 的 72 期原生像元成果，不重新分类或补洞，不改科学基线。原始 NPZ 并未包含在当前仓库，本次没有重新下载或复算原始栅格；其历史来源及 SHA256 随 manifest 保留。
- `monthly.json` 中旧 `has_water_geometry` 字段仅对应早期 11 期抽样，不能据此否定本导出。新界面使用本索引的 `geometry_available`。
- native_grid 的像元为 0.00025 度，不是人为重采样的等面积 30 米网格。`bounds_wgs84` 是源栅格外包矩形，不是实际湖岸或 KMZ 统计掩膜边界。
- published water_area_ha 保留原像元权重统计面积；不得以投影平面多边形面积替换。
- 2008/2010 争议、59 个主样本资格、完整性和季节标签保留。2025/2026 不在该 JRC 序列，不能以 2024 替代。

复现（Python 3、Shapely 2.x）：

```sh
python data/export-methods/export_lake_geometry.py . data/spatial
```

校验：全合格月份集合相等、面积与月度台账一致、坐标逐数组保留、所有顶点落在原生格网边界且不越界、几何有效。校验结果在 `lake_geometry_checks.json`；输入输出文件 SHA256 在 `lake_geometry_manifest.json`。
