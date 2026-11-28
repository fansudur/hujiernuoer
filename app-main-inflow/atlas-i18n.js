let english=Object.create(null), keyedEnglish=Object.create(null), englishLoad;
function ensureEnglish(){
  englishLoad??=import('./atlas-en.js?v=41').then(dict=>{
    english=dict.english;
    keyedEnglish=dict.keyedEnglish;
    return true;
  }).catch(error=>{
    console.warn('Atlas English dictionary unavailable',error);
    englishLoad=null;
    return false;
  });
  return englishLoad;
}

const STORAGE_KEY = 'hjn.atlas.language.v1';
const options = new Set(['system', 'zh', 'en']);
const valid = value => options.has(value) ? value : null;
const initialParams = new URLSearchParams(globalThis.location?.search);
let urlLanguage = valid(initialParams.get('lang'));
let saved = null;
try { saved = valid(localStorage.getItem(STORAGE_KEY)); } catch {}
let preference = urlLanguage || saved || 'system';

export const isPristineAtlasEntry = [...initialParams.keys()].every(key => key === 'lang');
export const applyLanguageQuery = params => {
  if (urlLanguage) params.set('lang', urlLanguage);
};
export const atlasLanguage = () => preference === 'system'
  ? (/^zh(?:-|$)/i.test(globalThis.navigator?.languages?.[0] || globalThis.navigator?.language || 'zh') ? 'zh' : 'en')
  : preference;

if(atlasLanguage()==='en')await ensureEnglish();

const patterns = [
  [/^([\d.]+) \/ ([\d.]+) 米 · 加速示意$/, (m,a,b)=>a+' / '+b+' m · Accelerated demonstration'],
  [/^当前锁定 ([\d-]+)（(MAIN|WF1|BOTH)）· 保留争议与缺测$/, (m,d,k)=>'Locked to '+d+' ('+({MAIN:'Main Lake',WF1:'West Changhu',BOTH:'both lakes'})[k]+') · Includes disputed and missing observations'],

  [/^水面图层加载失败，请重试（(.+)）$/, (m,s)=>'The water layer failed to load. Please try again.'+(/[\u3400-\u9fff]/u.test(s)?'':' ('+s+')')],

  [/^湖底未测。蓝色斜纹为(.+?)，不表示水位或水深。$/, (m,s)=>'The lakebed was not surveyed. Blue hatching shows '+translateAtlas(s)+', not water level or depth.'],
  [/^(.+?); lakebed not surveyed$/, (m,s)=>translateAtlas(s)+'; lakebed not surveyed'],
  [/^(.+?) \(lakebed not surveyed\)$/, (m,s)=>translateAtlas(s)+' (lakebed not surveyed)'],
  [/^相对当前所选线 0 m 起点最高抬升[：:](.+)$/, (m,s)=>'Maximum rise above the selected line’s 0 m start: '+s],

  [/^Image (\d+):\s*(.+)$/, (m,n,s)=>'Image '+n+': '+translateAtlas(s)],
  [/^Direction:\s*(.+)$/, (m,s)=>'Direction: '+translateAtlas(s)],
  [/^(.+?) · Terrain profile \(drag or click to locate on the map\)$/, (m,s)=>translateAtlas(s)+' · Terrain profile (drag or click to locate on the map)'],
  [/^(.+?) 单项试算开启时暂隐主湖分区；关闭即恢复。未指定涵洞通行。$/, (m,s)=>translateAtlas(s)+' '+translateAtlas('单项试算开启时暂隐主湖分区；关闭即恢复。未指定涵洞通行。')],
  [/^(\d+) 米等高距(，每 10 米加粗)?；30 米地表模型生成，不代表测量精度。$/, (m,n,b)=>'Contours every '+n+' m'+(b?', emphasized every 10 m':'')+'. Derived from 30 m terrain; not a statement of survey accuracy.'],
  [/^缺测 (\d+) 要素$/, (m,n)=>n+' missing '+(n==='1'?'feature':'features')],
  [/^Google Earth 同月文件参考（(按采集日|实际采集日未核)；(覆盖图谱范围|仅覆盖局部)），不是当月水面$/, (m,d,c)=>'Google Earth reference for the same month ('+(d==='按采集日'?'by acquisition date':'actual acquisition date unverified')+'; '+(c==='覆盖图谱范围'?'atlas-wide':'local coverage')+'); not the monthly water layer.'],

  [/^(剖面点|剖面游标)\s+([+\-−]?\d+(?:\.\d+)?)\s*m · (.+)$/u, (m,p,x,s)=>'Profile point '+x.replace(/^-/,'−')+' m · '+translateAtlas(s)],

  [/^(.+?)（当前在筛选之外）$/, (m,s)=>translateAtlas(s)+' (outside the current filter)'],
  [/^0水·(\d+)有效·(\d+)缺测$/, (m,a,b)=>'0 water cells · '+a+' valid · '+b+' missing'],
  [/^((?:剖面 B · 60 m（E20 主试例）|入口簇 7 · 37 m（独立核查窗）)) · (\d{4}-\d{2}) · (.+)$/, (m,s,d,h)=>[translateAtlas(s),d,translateAtlas(h)].join(' · ')],

  [/^(\d+)月（当前）$/, (m,n)=>translateAtlas(n+'月')+' (current)'],

  [/^(\d{4}-\d{2}) · 覆盖不足（留空）$/, (m,d)=>d+' · Insufficient coverage (blank)'],

  [/^同帧核查读数 · (\d{4}-\d{2})$/, (m,d)=>'Same-frame readings · '+d],
  [/^请点选 ([\d /-]+) 查看已复核的原生格水斑关系$/, (m,d)=>'Select '+d+' to see the reviewed water-patch relationships on the native grid.'],
  [/^整湖(合格|争议正值)，([\d.]+)公顷（(固定窗)?有效覆盖 ([\d.]+%|—)）$/, (m,s,a,w,p)=>'Whole lake: '+(s==='合格'?'Valid':'Disputed positive value')+', '+a+' ha ('+p+' valid '+(w?'fixed-window ':'')+'coverage)'],
  [/^整湖覆盖不足（有效覆盖 ([\d.]+%|—)，留空不补零）$/, (m,p)=>'Insufficient whole-lake coverage ('+p+' valid; blank, not zero)'],
  [/^整湖(争议零值|合格零检出)（0\.00公顷，有效覆盖 ([\d.]+%|—)）$/, (m,s,p)=>'Whole lake: '+(s==='争议零值'?'Disputed zero':'Valid, no water detected')+' (0.00 ha; '+p+' valid coverage)'],
  [/^(\d{4}-\d{2}) · 缺测$/, (m,d)=>d+' · Missing cells'],
  [/^(\[\d+,\d+\]) (明水|缺测)$/, (m,c,s)=>c+' '+(s==='明水'?'Open water':'Missing')],
  [/^(\d+)格检出明水（(\d+\/\d+)格有效）$/, (m,a,b)=>(a==='0'?'No open water detected':'Open water detected in '+a+' cells')+' ('+b+' valid)'],
  [/^0格检出明水（(\d+)格有观测，(\d+)格缺测）$/, (m,a,b)=>'No open water detected ('+a+' observed, '+b+' missing)'],
  [/^与主盆同一分类水斑（(\d+\/\d+)格同属主盆分类像元组，4\/8邻接一致）$/, (m,n)=>'Same classified water patch as the main basin ('+n+' cells; consistent with 4- and 8-neighbor tests)'],
  [/^本期未与主盆分类水斑连片（本地同样 (\d+) 格见水，与主盆水斑分开，4\/8邻接一致）$/, (m,n)=>'Separate from the main classified patch this month ('+n+' local water cells; consistent with 4- and 8-neighbor tests)'],
  [/^外窗主分量 ([\d—]+) 格 · 固定 KMZ 主分量 ([\d—]+) 格$/, (m,a,b)=>'Main component: '+a+' outer-window cells · '+b+' fixed-KMZ cells'],
  [/^外窗东南独立分量 (\d+) 格 · 固定 KMZ 东南独立分量 (\d+) 格 · 最近格心距约 ([\d.]+) m$/, (m,a,b,c)=>'Separate southeast patch: '+a+' outer-window cells · '+b+' fixed-KMZ cells · Nearest cell centers about '+c+' m apart'],
  [/^局部 (\d+) 格缺测（(.+)）单独以缺测样式保留，与其余 (\d+) 格观测非水分开；无水样检出，整湖仍合格$/, (m,a,b,c)=>a+' missing cells ('+b+') shown separately from '+c+' observed nonwater cells. No water detected locally; the whole lake still meets the coverage threshold.'],
  [/^局部有效率 ([\d.]+%)（(\d+\/\d+)）；整湖 2131 格分类明水，固定 KMZ 有效率 97\.2%$/, (m,a,b)=>'Local coverage: '+a+' ('+b+'). Whole lake: 2,131 classified open-water cells; 97.2% valid coverage in the fixed KMZ.'],
  [/^当月数据加载失败（(.+)），不渲染为观测为零或旧月水面$/, ()=>'This month’s data failed to load. No zero or previous-month water extent is shown.'],

  [/^第\s*(\d+)\s*张[：:]\s*(.+)$/, (m,n,s)=>'Image '+n+': '+translateAtlas(s)],
  [/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})（当地）$/, (m,s)=>s+' (local time)'],
  [/^([\d.]+°)（真北为 0°；(.+)）$/, (m,d,s)=>d+' (0° true north; '+translateAtlas(s)+')'],
  [/^备选画幅\s*(\d+)$/, (m,n)=>'Alternate frame '+n],
  [/^(.+?)[：:]位置参照，模型与核查区不是证实水道$/, (m,s)=>translateAtlas(s)+' · Location reference; waterways are unconfirmed'],

  [/^水面 (\d+) 要素$/, (m,n)=>n+' water '+(n==='1'?'feature':'features')],
  [/^点击定位至(.+?)（有效覆盖 ([\d.]+%)）$/, (m,s,x)=>'Locate '+translateAtlas(s)+' ('+x+' valid coverage)'],
  [/^03 道路同位 Google Earth 原截图 (\d{4}-\d{2}-\d{2})；日期与来源见原截图。$/, (m,d)=>'Original Google Earth image of Road 03 at the same location ('+d+'). See the original for date and source.'],

  [/^已打开(照片|剖面)\s*[：:]\s*(.+)$/, (m,k,s)=>'Opened '+(k==='照片'?'photo':'profile')+': '+translateAtlas(s)],
  [/^正在载入\s+(.+)$/, (m,s)=>'Loading '+translateAtlas(s)],

  [/^已定位\s*[：:]\s*(.+)$/, (m,s)=>'Located: '+translateAtlas(s)],
  [/^当前所选线[：:]\s*(.+?)。高程为未垂向夸张的地表值；该线没有独立时间序列，双湖观测请切回「时序」。$/, (m,s)=>'Selected profile: '+translateAtlas(s)+'. Elevations are not vertically exaggerated. For lake observations, switch to Timeline.'],
  [/^(\d+ \/ \d+)（(\d+) 米）$/, (m,x,y)=>x+' ('+y+' m)'],
  [/^(◌|□|◈|■|◇|●|→)\s+(.+)$/, (m,p,s)=>p+' '+translateAtlas(s)],
  [/^≍ 所属水路[：:]\s*(.+)$/, (m,s)=>'≍ Related waterway: '+translateAtlas(s)],
  [/^(遥感观测|外围参考|待核候选) \(([\w-]+)\)$/, (m,s,k)=>translateAtlas(s)+' ('+k+')'],

  [/^中段较湖端最高抬升[：:](.+)$/, (m,s)=>'Maximum rise above lake endpoint: '+translateAtlas(s)],
  [/^相对 0 m 起点最大高差[：:]([+\-\d.]+ m)（历史 30m DSM）$/, (m,s)=>'Maximum rise above the 0 m start: '+s+' (historical 30 m DSM)'],
  [/^(.+?)；湖底未测$/, (m,s)=>translateAtlas(s)+'; lakebed not surveyed'],
  [/^▨\s*(.+)$/, (m,s)=>'▨ '+translateAtlas(s)],

  [/^(?:19|20)\d{2}\s*年$/, m=>m.replace(/\s*年$/,'')],
  [/^七组中只看[：:](.+)$/, (m,s)=>'Show only: '+translateAtlas(s)],
  [/^展开[：:](.+)$/, (m,s)=>'Expand: '+translateAtlas(s)],
  [/^(?:照片拍摄方向)\s*([\d.]+°)$/, (m,d)=>'Camera bearing '+d],
  [/^(主湖|办公院|外围|道路) (\d+)$/, (m,s,n)=>translateAtlas(s)+' ('+n+')'],
  [/^点\s*(#\d+\/\d+)$/, (m,s)=>'Sample '+s],
  [/^里程\s*([\d.-]+ (?:m|km))$/, (m,d)=>'Distance '+d],
  [/^独立纵轴 (\S+) ha$/, (m,s)=>'Separate scale: '+s+' ha'],
  [/^合格 (\d+\/\d+)(\s*·)?$/, (m,n,b)=>n+' valid'+(b||'')],
  [/^争议 (\d+)$/, (m,n)=>n+' disputed'],
  [/^同月跨年自动播放[：:](\d+) 期（始终跳过无资料月份）$/, (m,n)=>'Same-month playback: '+n+' dates (skips months without records)'],
  [/^同年跨月自动播放[：:](\d+) 期（始终跳过无资料月份）$/, (m,n)=>'Playback within the year: '+n+' dates (skips months without records)'],
  [/^同月跨年（固定 (\d+) 月 · (\d+) 年）：对比不同年份同一季节的丰枯变化，非逐月连续序列。([\s\S]*)$/, (m,d,n,s)=>'Same month across years ('+translateAtlas(d+'月')+', '+n+' years): compare the same season, not a continuous monthly series. '+translateAtlas(s)],
  [/^同年跨月（(\d+) 年 · (\d+) 期）：查看年内季节涨落与两湖同期表现，覆盖不足处留空不插值。([\s\S]*)$/, (m,y,n,s)=>'Months within '+y+' ('+n+' dates): compare seasonal changes in both lakes. Insufficient coverage is left blank, without interpolation. '+translateAtlas(s)],
  [/^(.+?) (同月跨年|同年跨月) 水面面积图（独立纵轴 0 至 ([\d.]+) 公顷）$/, (m,l,a,n)=>translateAtlas(l)+' · Water extent · '+translateAtlas(a)+' (separate scale: 0–'+n+' ha)'],
  [/^(.+?) 地形剖面图（拖动或点击在地图上联动定位）$/, (m,l)=>translateAtlas(l)+' · Terrain profile (drag or click to locate on the map)'],
  [/^(.+?) (\d{4}-\d{2})：覆盖不足（有效覆盖 ([\d.]+%)，留空不补零）$/, (m,l,d,x)=>translateAtlas(l)+' '+d+': Insufficient coverage ('+x+' valid; blank, not zero)'],
  [/^(.+?) (\d{4}-\d{2})：● 合格正值（([\d.]+ ha)）（覆盖 ([\d.]+%)）$/, (m,l,d,a,x)=>translateAtlas(l)+' '+d+': ● Water detected ('+a+'; '+x+' coverage)'],
  [/^(.+?) (\d{4}-\d{2})：○ 合格零值（观测为零）（覆盖 ([\d.]+%)）$/, (m,l,d,x)=>translateAtlas(l)+' '+d+': ○ Observed zero ('+x+' coverage)'],
  [/^(.+?) (\d{4}-\d{2})：⊗ 争议零值（归档为 0 · 有分歧）（覆盖 ([\d.]+%)）$/, (m,l,d,x)=>translateAtlas(l)+' '+d+': ⊗ Disputed archived zero ('+x+' coverage)'],
  [/^(.+?) (\d{4}-\d{2})：⚠ 争议正值（([\d.]+ ha) · 有分类争议）（覆盖 ([\d.]+%)）$/, (m,l,d,a,x)=>translateAtlas(l)+' '+d+': ⚠ Disputed positive value ('+a+'; '+x+' coverage)'],

  [/^(.+?)；不是月度水面。$/, (m,s)=>translateAtlas(s)+'; not a monthly water observation.'],
  [/^(\d{4}-\d{2}(?:-\d{2})?) · 备选画幅\s*(\d+)$/, (m,d,n)=>d+' · Alternate frame '+n],
  [/^拍摄 (\d{4}-\d{2}-\d{2})$/, (m,d)=>'Acquired '+d],

  [/^⚠\s*争议\s*(.+)$/, (m,v)=>'⚠ Disputed '+translateAtlas(v)],
  [/^⚠\s*存在争议$/, ()=> '⚠ Disputed'],
  [/^方向[：:]\s*(.+)$/, (m,s)=>'Direction: '+translateAtlas(s)],
  [/^(.+?)（湖底未测）$/, (m,s)=>translateAtlas(s)+' (lakebed not surveyed)'],
  [/^空白间隔约 (\d+) m；不补高程$/, (m,d)=>'Unfilled interval about '+d+' m; no elevations inferred'],
  [/^· (陆段地表高程|历史地表高程采样)，非水位、实测水头或流向（鼠标悬停或拖动实时联动 2D\/3D 地表）$/, (m,s)=>'· '+translateAtlas(s)+'. Not water level, measured head or flow direction. Hover or drag to update both maps.'],

  [/^(\d{4}-\d{2}) · (\d+) 历史$/, (m,d,i)=>d+' · Historical alternate '+i],
  [/^([\d.]+)\s*公顷$/, (m,x)=>x+' ha'],
  [/^有效覆盖 ([\d.]+%)$/, (m,x)=>x+' valid coverage'],
  [/^([\d.]+)\s*格$/, (m,x)=>x+' cells'],
  [/^(.+?)\s*↔\s*(.+) · 约\s*([\d.]+)\s*m$/, (m,a,b,x)=>translateAtlas(a)+' ↔ '+translateAtlas(b)+' · About '+x+' m'],
  [/^(\d{4}-\d{2}-\d{2}) (待核|对照)$/, (m,d,s)=>d+' · '+(s==='待核'?'Unverified':'Comparison')],

  [/^([●◆◎↗📄×⊘✓✕◇◉◷┄★═○━├⋯┤]\s+)(.+)$/u, (m,p,s)=>p+translateAtlas(s)],
  [/^另行定位[：:](.+) · 不连画未证路线$/, (m,s)=>'Separate viewpoint: '+translateAtlas(s)+' · No line across unverified gaps'],
  [/^切换观察位[：:](.+)$/, (m,s)=>'Change viewpoint: '+translateAtlas(s)],
  [/^覆盖\s*([\d.]+%)$/, (m,x)=>x+' coverage'],
  [/^当前锁定 ([\d-]+)（双湖）· 保留争议与缺测$/, (m,x)=>'Locked to '+x+' (both lakes) · Includes disputed and missing observations'],
  [/^(?:镜头离地|镜头高于边缘参考地面) ([\d.]+) m · 地形 ([\d.]+)×（垂向夸张）$/, (m,h,x)=>'Camera '+h+' m '+(m.startsWith('镜头离地')?'above ground':'above reference terrain')+' · '+x+'× vertical exaggeration'],
  [/^(飞行|步行)\s*·\s*范围外\s*·\s*边缘参考高度\s*([\d.]+)\s*米\s*·\s*朝向\s*([\d.]+°)$/, (m,mode,h,heading)=>translateAtlas(mode)+' · Outside terrain · '+h+' m above edge · Heading '+heading],
  [/^离地\s*([\d.]+)\s*米$/, (m,x)=>x+' m above ground'],
  [/^朝向\s*([\d.]+°)$/, (m,x)=>'Heading '+x],
  [/^(飞行|步行) ([\d.]+) 米\/秒$/, (m,mode,x)=>translateAtlas(mode)+' '+x+' m/s'],
  [/^真北方位 ([\d.]+°)$/, (m,x)=>'True bearing '+x],
  [/^太阳高度 ([\d.]+°)$/, (m,x)=>'Sun elevation '+x],
  [/^约\s*([\d.]+)\s*(米|m|km)$/, (m,x,u)=>'About '+x+' '+(u==='米'?'m':u)],
  [/^([\d.]+ m) 锚点$/, (m,x)=>x+' anchor'],
  [/^相机 (IMG_[\d]+)$/, (m,x)=>'Camera '+x],
  [/^小地图相机标记＝原照 GPS，非涵洞口；拍向约 ([\d.]+°)(?:；定位误差约 ([\d.]+) 米)?$/, (m,x,y)=>'Photo GPS, not a culvert opening · Bearing about '+x+(y?' · GPS uncertainty about '+y+' m':'')],
  [/^脚下地表高程约 ([\d.]+) m · 本段道路里程 ([\d.]+) km（30 m DEM，非路面测量）$/, (m,h,x)=>'Terrain elevation about '+h+' m · Road section '+x+' km (30 m DEM, not a road survey)'],
  [/^(\d{4}-\d{2})（全景暂隐叠层）$/, (m,x)=>x+' (overlay hidden in overview)'],
  [/^(西低带末端|中桥桥位) ↔ (中桥桥位|东低带起点) · 约 ([\d.]+) m$/, (m,a,b,x)=>translateAtlas(a)+' ↔ '+translateAtlas(b)+' · About '+x+' m'],
  [/^(剖面点|剖面游标) ([\d.]+)\s*m · (.+)$/, (m,p,x,s)=>'Profile point '+x+' m · '+translateAtlas(s)],
  [/^缺测 (\[\d+,\d+\])$/, (m,x)=>'No observation '+x],
  [/^月 (\d{4}-\d{2})$/, (m,x)=>'Month '+x],
  [/^([\d.]+) 条$/, (m,x)=>x+' entries'],
  [/^查看内部档案与来源路径（(\d+)）$/, (m,x)=>'View source records ('+x+')'],
  [/^(\d+) 分支 · (\d+) 节点$/, (m,x,y)=>x+' branches · '+y+' stops'],
  [/^(\d+)／(\d+) 已开启$/, (m,x,y)=>x+'/'+y+' enabled'],
  [/^(\d{4}-\d{2}(?:-\d{2})?)\s+(历史|盛夏|春末|残雪|退雪)$/, (m,x,s)=>x+' '+translateAtlas(s)],
  [/^(?:切到|切换到)\s*(.+)$/, (m,s)=>'Switch to '+translateAtlas(s)],
  [/^([①②③④⑤⑥⑦⑧━◉◷┄├⋯┤═◇★✓✕○]+\s*)(.+)$/u, (m, prefix, rest) => prefix + (english[rest] || rest)],
  [/^第\s*(\d+(?:[–/]\d+)?)\s*站(?:\s*·\s*(.+))?$/, (m, n, title) => 'Stop ' + n + (title ? ' · ' + (english[title] || title) : '')],
  [/^第\s*(\d+\/\d+)\s*段 · (.+)$/, (m, n, title) => 'Section ' + n + ' · ' + (english[title] || title)],
  [/^全章\s*(\d+\/\d+)$/, (m, n) => 'Chapter ' + n],
  [/^看\s*(\d+)\s*张现场照$/, (m, n) => 'View ' + n + ' field photos'],
  [/^(\d+)\s*米等高线$/, (m, n) => n + ' m contours'],
  [/^第 ([1-4]) 点$/, (m, n) => 'Site 0' + n],
  [/^(\d{4})年$/, (m, y) => y],
  [/^(1[0-2]|[1-9])\s*月$/, (m, month) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]],
  [/^(.+?)（文件标记）$/, (m, name) => translateAtlas(name) + ' (file label)'],
  [/^当前视窗内其余标注[：:](.+)。（?拉高参照图或放大查看。）?$/, (m, s) => 'Additional labels in this view: ' + s.split('、').map(translateAtlas).join(', ') + '. Expand or zoom the reference map to see them.'],
];
export function translateAtlasEnglish(source) {
  if (typeof source !== 'string') return source;
  const key=source.trim();
  return Object.hasOwn(english,key)?source.slice(0,source.indexOf(key))+english[key]+source.slice(source.indexOf(key)+key.length):source;
}
export function translateAtlas(source) {
  if (typeof source !== 'string' || atlasLanguage() !== 'en') return source;
  const plain = source.trim();
  if (!/[\u3400-\u9fff]/u.test(plain)) return source;
  let en = Object.hasOwn(english, plain) ? english[plain] : undefined;
  if (en === undefined) {
    for (const [pattern, fn] of patterns) {
      if (pattern.test(plain)) { en = plain.replace(pattern, fn); break; }
    }
  }
  if (en === undefined && plain.includes('｜')) {
    const parts=plain.split('｜');
    const localized=parts.map(translateAtlas);
    if(localized.some((part,i)=>part!==parts[i])) en=localized.join(' · ');
  }
  if (en === undefined && plain.includes(' · ')) {
    const parts=plain.split(' · '), out=[];
    for (let i=0;i<parts.length;) {
      let last=parts.length, match;
      for (;last>i;last--){
        const key=parts.slice(i,last).join(' · ');
        if(Object.hasOwn(english,key)){ match=english[key]; break; }
      }
      if(match===undefined){ match=translateAtlas(parts[i]); last=i+1; }
      out.push(match); i=last;
    }
    const combined=out.join(' · ');
    if(combined!==plain)en=combined;
  }
  if (en === undefined) return source;
  return source.slice(0, source.indexOf(plain)) + en + source.slice(source.indexOf(plain) + plain.length);
}

// This adapter observes displayed strings, not scene data. Chinese remains the
// source for evidence, audio manifests, map IDs and all guide/camera timing.
const attributes = ['title', 'aria-label', 'aria-valuetext', 'placeholder', 'alt', 'data-v74-profile-label', 'label'];
const textState = new WeakMap();
const attrState = new WeakMap();
const skip = 'script,style,textarea,[data-keep-source]';
function renderText(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(skip)) return;
  const previous = textState.get(node);
  const source = previous?.rendered === node.data ? previous.source : node.data;
  if (!/[\u3400-\u9fff]/u.test(source)) return;
  const key = parent.dataset.i18n;
  const rendered = atlasLanguage() === 'en' && key && Object.hasOwn(keyedEnglish,key)
    ? keyedEnglish[key]
    : translateAtlas(source);
  if (rendered !== source || previous) textState.set(node,{source,rendered});
  if (node.data !== rendered) node.data = rendered;
}
function renderAttributes(el, only) {
  if (el.closest(skip)) return;
  let states = attrState.get(el);
  for (const attr of only ? [only] : attributes) {
    const value = el.getAttribute(attr);
    if (value === null) { states?.delete(attr); continue; }
    const previous = states?.get(attr);
    const source = previous?.rendered === value ? previous.source : value;
    if (!/[\u3400-\u9fff]/u.test(source)) continue;
    const rendered = translateAtlas(source);
    if (rendered !== source || previous) {
      if (!states) attrState.set(el,states=new Map());
      states.set(attr,{source,rendered});
    }
    if (value !== rendered) el.setAttribute(attr,rendered);
  }
}
function renderSubtree(root) {
  if (root.nodeType === Node.TEXT_NODE) { renderText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest(skip)) return;
  renderAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.nodeType === Node.ELEMENT_NODE && node.matches(skip)
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n=walker.nextNode();n;n=walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) renderText(n);
    else renderAttributes(n);
  }
}
function paintLanguage(previous) {
  const lang = atlasLanguage();
  const root = document.documentElement;
  root.lang = lang === 'zh' ? 'zh-CN' : 'en';
  root.dataset.lang = lang;
  root.dataset.langPreference = preference;
  for (const btn of document.querySelectorAll('[data-set-lang]')) {
    const selected = btn.dataset.setLang === preference;
    btn.setAttribute('aria-pressed',String(selected));
    btn.classList.toggle('active', selected);
  }
  if (previous !== lang) {
    renderSubtree(root);
    window.dispatchEvent(new CustomEvent('atlas:languagechange',{detail:{lang,previous}}));
  }
}
if (typeof window !== "undefined" && typeof document !== "undefined") {
  paintLanguage();
  const observer = new MutationObserver(records => {
    if (atlasLanguage() !== 'en') return;
    for (const record of records) {
      if (record.type === 'characterData') renderText(record.target);
      else if (record.type === 'attributes') renderAttributes(record.target,record.attributeName);
      else for (const node of record.addedNodes) if (node.isConnected) renderSubtree(node);
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  let languageIntent=0;
  const effective = choice => choice==='system'
    ? (/^zh(?:-|$)/i.test(navigator.languages?.[0]||navigator.language||'zh')?'zh':'en')
    : choice;
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-set-lang]');
    const next=valid(button?.dataset.setLang);
    if(!next)return;
    const intent=++languageIntent;
    if(effective(next)==='en'){
      button.setAttribute('aria-busy','true');
      const ready=await ensureEnglish();
      button.removeAttribute('aria-busy');
      if(!ready||intent!==languageIntent)return;
    }
    const previous=document.documentElement.dataset.lang;
    preference=next;
    urlLanguage=next==='system'?null:next;
    try { localStorage.setItem(STORAGE_KEY,next); } catch {}
    const url=new URL(location.href);
    if(urlLanguage)url.searchParams.set('lang',urlLanguage);
    else url.searchParams.delete('lang');
    try { history.replaceState(history.state,'',url); } catch {}
    paintLanguage(previous);
  });
  window.addEventListener('languagechange',async ()=>{
    if(preference!=='system')return;
    const intent=++languageIntent;
    if(atlasLanguage()==='en'&&!await ensureEnglish())return;
    if(intent===languageIntent)paintLanguage(document.documentElement.dataset.lang);
  });
}
