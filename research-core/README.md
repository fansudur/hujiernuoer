# 从研究数据重新设计，而不是给现有界面换皮

此目录是**与框架无关的数据入口**。允许新项目完全不用现有的页面、CSS、Three.js 场景和菜单。无需把旧版本同时重写。

## 四层边界

1. **研究数据**：`../data/` 内的冻结记录、GeoJSON、影像索引、地形网格。`catalog.json` 为逻辑目录，逐项给出路径、SHA256、分类、时序粒度、单位和解释限制。
2. **数据查询**：`index.js` 是不依赖 DOM、Three.js 或本页面状态的 ES 模块。可以在浏览器、Node.js、测试程序或另一个框架中使用。
3. **叙事与镜头**：`../data/story/stages.json` 给出语义章节与结论；`../data/narrative/attention-recipes.json` 给出展示重点和镜头配方。后者是可替换的表达层，不是科学观测。
4. **渲染与排版**：`../assets/`、`../custom/` 是当前实现。重做界面时可以全部不用，不能据此修改研究值、有效覆盖、来源和证据等级。

`blank-app-example.html` 是一个单独的空白页面范例：只加载本目录的查询模块和数据，不加载当前地图程序。它用相同真实数据独立绘图，证明新前端不必继承旧版结构。

## 建议交给其他 AI 的任务

“从空白应用开始设计。先读取 research-core/catalog.json、README.md 和 REBUILD_BRIEF.md。保留数据层与证据约束，重新设计信息架构、空间叙事、交互和渲染。不要导入 assets/canonical-entry.js、process-explorer.js 或旧版 app.js，不要仅覆盖现有 CSS。请先交付全新页面结构及一条完整叙事，再扩充其他内容。使用数据查询模块，或以相同约束自行实现适配器。报告你采用了哪些数据、哪些仍未转成原生表达，勿把截图或虚构几何冒充数据重建。”

## 查询 API

```js
import { createResearchClient, selectSameMonthPoints, compareExactDates } from './research-core/index.js';
const client = createResearchClient({baseUrl: new URL('./', location.href)});
const {data, descriptor} = await client.dataset('anchored-series');
const lake = data.series.find(s => s.id === 'water-local_KMZ');
const july = selectSameMonthPoints(lake.points, 7, {startYear:2000,endYear:2024});
// july 保留 null 和显式0；不补值、不自动排除争议年份。
```

相对基准 `baseUrl` 必须指向包含 `data/` 的发布根目录。默认值由模块位置推导，不依赖页面 URL。Node.js 可注入 `fetchImpl` 读取本地文件，或使用 HTTP 服务。不要双击 file:// 当成正常部署测试。

`client.dataset(id)` 返回 `{descriptor,data}`，便于把时间窗、单位、来源和数据一同传给任何渲染器。`findPixelSeason` 与 `pixelSeasonDifference` 保持同像元、同季节；`compareExactDates` 只做相同日期配对，不进行插值。所有函数不改写输入；调用方也应把返回记录视作只读。

## 不是完整原始数据档案

此网站包含的是**公开的研究摘录、派生数据和必要素材**，不等于全部原始卫星波段、测站记录、调查原表或完整场地测绘。大栅格及部分上游输入只在来源清单或已有复算包中提供索引。目录中 `original_upstream_raw_complete:false` 是有意的边界，不能删除后宣称材料已完整。

当前网站是参考渲染器，不是数据的唯一合法组织方式。已有下载复算包的路径列在 catalog.json 的 existing_reproduction_bundles，是否可完全离线复算须分别阅读各包说明。此次未新制作下载 ZIP。

## 不可丢失的语义

- 月分类水面、某日卫星影像、两月合成 NDVI、年度雨量、GHSL 年代点和多年同月统计使用不同的时间轴。统一控件不能把它们改写为同一天观测。
- 水面积是公顷，不能当水位、湖深、可通行面积。画面中水面材质与波浪是视觉层。
- `null`/未提供是缺测，显式 `0` 是记录值。分类质量门槛、争议标记、冬季冰雪限制要保留。
- 区域格网气象不代表湖边实测；不能铺成没有观测支持的精细风速或降雨分布。
- 湖边小池、道路交点和候选联系包含近似定位，须读取 evidence_kind 和 note。不要把关系线变成已验证的水路。
- EGM2008 米制历史 DSM 不是湖底或当前工程测量。默认地形夸张、柱形高度、镜头距离不是地理证据。
- 56 个原始草地参考像元与某个比较窗筛出的 55 个共同像元不是同一个分母。
- GHSL 区域屋顶覆盖总量不是每栋楼的高度；四个时期不是四次独立现场调查。
- 来源署名与第三方素材许可仍需保留；公开网页不自动授予全部素材无限再许可。

## 图件到原生表达

`catalog.json.evidence_bindings` 将 A006/A008/A009/A010/A028/A051/A052/A053/A060 对应到实际 dataset id、空间 feature id 和原生重建程度。其余正文图有显式“尚未逐字段绑定”记录，不等于断言没有原数据，更不能声称已全部变成三维。当前界面原生数据模块已实际使用本目录的加载器、同月筛选和逐像元季节查询，不只是多写一份说明。

## 本地重设计与跨域

最稳妥的方式是下载/复制所需 `data/`、`research-core/` 及被引用的影像素材，在新项目同源 HTTP 服务中读取；不要把某个平台的公开可访问等同于已经允许任意跨域 fetch。服务器是否返回 CORS 许可应由新项目实际测试。若使用新服务器，需配置其路由并保持素材相对路径。`baseUrl` 可显式指定新根目录，不需要使用现有域名。此次没有把数据提交给 Gemini 或其他第三方。

## 独立完整性检查

把本目录与所需完整 `data/` 放在同一根目录下，可运行：

```text
python research-core/verify_contract.py
```

也可用 `--root` 指定包含 data/ 和 research-core/ 的目录。该脚本仅用 Python 标准库，检查目录路径、JSON 可读性和已登记科学数据的哈希；它不等于科学复核、现场验证或渲染验收。若只复制了部分数据，缺项会如实报错，不能改成“完整通过”。

## A028 近邻月分类补齐（2026-10-28）
`neighbor-geometry-index`、`neighbor-water`、`neighbor-nodata` 只从已有冻结 NPZ 和独立 dual95 质量表派生。1467 个历月窗记录中，363 个合格观测：176 个非零水面、187 个明确零值；93 个合格观测同时有无观测像元掩膜。`selectNeighborMonth(index,water,nodata,'2021-07')` 返回每窗 `status`（unavailable / observed_zero / observed_water）、观测与实际几何。不以最近月补洞，不平滑成虚构岸线，不从面积推断水位。来源哈希和逐像元回烧验证分别见 `neighbor-geometry-checks` 与 `independent-geometry-check`。

## 通行与动线探索模块

新增目录项 `access-prototype-config` 和 `access-route-comparisons`。数据及运行说明见 [最小复算说明](../data/access/README.md)，实际执行脚本为 [recompute.mjs](../data/access/recompute.mjs)。纯图算法 [access-analysis.js](../assets/access-analysis.js) 不依赖 DOM 或 Three.js，界面是另一个文件。新前端可直接使用图构建、距离最短、累计转向最少及闭边情景函数，不需要加载现有页面。

这属于空间句法启发的通行网络原型，不输出正式整合度、选择度、客流、收益或安全通行判断。模型缺路、桥隧拓扑和未知通行权限可能放大绕行；使用前应保留相应假设。


## v11 空间叙事补充
新增办公院到月岸边的最近边界距离（不是道路）、呼和诺尔独立固定窗月分类与区域真实DSM、同范围透明缺测影像画布、1951 AMS引用1942图源的原件展示板。均从已有原始资产派生，原有科学资产不覆盖。原始矩阵与所有上游波段仍不全部包含；查看各资产README和来源校验。
