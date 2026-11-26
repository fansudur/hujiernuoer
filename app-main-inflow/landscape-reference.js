
const plates={
 '202107':{title:'呼吉尔诺尔场地全景 · 2021-07', size:'38.1 MB'},
 '202109':{title:'第一章导览场地全景 · 2021-09', size:'38.5 MB'}
};
const $=id=>document.getElementById(id);
const dialog=$('landscape-dialog'), img=$('landscape-image'), status=$('landscape-status');
const load=$('landscape-load'), zoom=$('landscape-zoom'), frame=img.parentElement;
const credits='Google Earth · Image © 2026 Maxar Technologies · Image © 2026 CNES / Airbus';
let selected=null, generation=0;
const preview=id=>'./guide-reference/landscape-'+id+'-preview.jpg';
const full=id=>'./guide-reference/landscape-'+id+'.webp';
function resetZoom(){
 frame.classList.remove('zoomed');zoom.setAttribute('aria-pressed','false');zoom.textContent='按原像素查看';
 frame.scrollTo(0,0);
}
document.querySelectorAll('[data-landscape]').forEach(btn=>btn.addEventListener('click',()=>{
 const id=btn.dataset.landscape, entry=plates[id];
 if(!entry)return;
 selected=id;generation++;
 $('landscape-title').textContent=entry.title;$('landscape-credit').textContent=credits;
 img.alt=entry.title+'，静态卫星影像';
 img.src=preview(id);resetZoom();zoom.hidden=true;load.disabled=false;
 load.textContent='加载 8192 px 原尺寸（'+entry.size+'）';status.textContent='';
 if(!dialog.open)dialog.showModal();
}));
dialog.addEventListener('close',()=>{generation++;img.removeAttribute('src');});
load.addEventListener('click',async()=>{
 const token=++generation, id=selected, high=new Image();
 load.disabled=true;status.textContent='正在加载高清图…';
 high.src=full(id);
 try{
  await high.decode();
  if(token!==generation||!dialog.open)return;
  img.src=high.src;zoom.hidden=false;status.textContent='已加载 8192 × 4147';zoom.focus();
 }catch{
  if(token!==generation||!dialog.open)return;
  load.disabled=false;status.textContent='高清图未加载，请重试；预览仍可查看。';
 }
});
zoom.addEventListener('click',()=>{
 if(frame.classList.contains('zoomed')){resetZoom();return;}
 frame.classList.add('zoomed');zoom.setAttribute('aria-pressed','true');zoom.textContent='适合窗口';
 frame.scrollTo((8192-frame.clientWidth)/2,(4147-frame.clientHeight)/2);
});
