// Reader context is explicitly opt-in; the standalone technical entry is retained.
const params=new URLSearchParams(location.search);
if(params.get('theme')==='atlas'){
 document.documentElement.classList.add('research-atlas');
 const css=document.createElement('link');css.rel='stylesheet';css.href='../assets/research-atlas.css';document.head.append(css);
 const raw=params.get('return')||'index.html?mode=expert';
 // No arbitrary redirects, protocols, fragments or off-site destinations.
 const back=/^(?:index|design-preview)\.html(?:\?[a-zA-Z0-9%=&_.-]*)?$/.test(raw)?raw:'index.html?mode=expert';
 const link=document.querySelector('header a');link.href='../'+back;link.textContent='返回刚才的地图 →';
 document.title='呼吉尔诺尔 · 数据来源与复算方法';
 document.querySelector('.eyebrow').textContent='研究资料 · 技术依据';
 document.querySelector('h1').textContent='查数据来源，了解复算边界。';
 document.querySelector('.lede').textContent='这里收录地图使用的研究数据、派生结果、来源索引与复算接口。一般阅读请先在地图中选择章节，再查看对应原图或研究报告；需要核对文件和计算方法时，可使用下方目录。';
 // Preserve all original technical instructions and links, progressively disclosed.
 const details=document.createElement('details');details.className='research-technical';
 const summary=document.createElement('summary');summary.textContent='开发与独立重设计接口';details.append(summary);
 const intro=document.createElement('p');intro.textContent='可从空白应用开始重新组织地图与表达，不必继承当前界面，也不必修改历史版本。以下接口和约定面向重建与复算使用者。';details.append(intro);
 for(const selector of ['.links','.grid']){const el=document.querySelector(selector);if(el)details.append(el);}
 document.querySelector('.lede').after(details);
 const original=document.createElement('a');original.href='index.html';original.textContent='查看原技术入口';document.querySelector('footer').append(' · ',original);
}
