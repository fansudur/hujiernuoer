import {bindEntryLink} from './entry-links.js';
// The previous homepage stays independent and links back to the formal homepage.
function addHomepageLinks(){
 const guide=window.lakeSimpleGuide;if(!guide)return;
 for(const [selector,mode] of [['.sg-eyebrow','simple'],['.px-header nav','expert']]){
  const parent=document.querySelector(selector);if(!parent||parent.querySelector('[data-homepage-link]'))continue;
  const link=document.createElement('a');link.dataset.homepageLink='true';link.textContent='返回新版首页';link.style.cssText='margin-left:12px;color:#176b9b;text-underline-offset:3px;letter-spacing:0';
  bindEntryLink(link,'index.html',()=>({mode,index:guide.getState().index,chapter:window.lakeStory?.getState().stage,month:window.lakeProcess?.state.date}));
  parent.append(link);
 }
}
if(document.documentElement.dataset.lakeReady==='true')addHomepageLinks();else window.addEventListener('lake-ready',addHomepageLinks,{once:true});
