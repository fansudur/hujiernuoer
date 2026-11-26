export const ANALYSIS_PALETTE=Object.freeze({
 water:{label:'观测水体',stroke:'#42bafe',fill:'#0d7eb5',note:'实蓝轮廓与填充；月度水面或标明日期的水斑。虚线统计窗不等于水边。'},
 landform:{label:'影像可见地貌',stroke:'#39d3a5',fill:'#157f67',note:'青绿实线／轮廓；不证明通水。'},
 model:{label:'地形模型与剖面',stroke:'#bea6fa',fill:'#6558aa',note:'紫虚线或淡紫面；不代表实测流向。'},
 candidate:{label:'待核线索／草图',stroke:'#edb75f',fill:'#98712e',note:'琥珀虚线与◇；手绘原笔不补线。'},
 gap:{label:'证据缺口／遥感缺测',stroke:'#a6adba',fill:'#525e70',note:'灰点线×为连通证据缺口，灰斜纹为缺测；均不补零。'},
 disputed:{label:'分类争议',stroke:'#f46c77',fill:'#9b343f',note:'红色斜纹与虚边；保留原值。'},
 reference:{label:'城市道路等背景参考',stroke:'#d5deea',fill:'#566574',note:'浅灰参考线；白色高亮为当前选中，不改证据判断。'},
});
export const HOME_FEATURE_IDS=Object.freeze(['main-profile-west-inlet','main-profile-south-central-inlet','main-profile-southeast-inlet','road03-ge-common-reach']);
export const VIEW_SCOPES=Object.freeze({
 home:{label:'主湖首页',waterMode:'MAIN',featureIds:HOME_FEATURE_IDS},
 west:{label:'西长湖',waterMode:'WF1',featureIds:[]},
 north:{label:'北小湖',waterMode:'NONE',featureIds:['archive-north_pool_2025-09-22_scl6']},
 east:{label:'东池',waterMode:'NONE',featureIds:['archive-east_pool_2025-09-22_scl6']},
 custom:{label:'双湖／自选',waterMode:null,featureIds:[]},
});
export const PAINT_BACKGROUND_ROADS=Object.freeze(['roads','secondary-roads']);
export function withSemanticTone(spec,tone){
 const mark=ANALYSIS_PALETTE[tone];if(!mark)return spec;
 const stroke=mark.stroke;
 return {...spec, semanticTone:tone,stroke,color3d:parseInt(stroke.slice(1),16),
   fill:spec.fill?mark.fill+'3d':null};
}

// Independent of UI theme; casing is not an evidence color.
// Profile location: keep the white semantic core readable over snow and dark ground.
export const PROFILE_CURSOR_RING=Object.freeze({
  core:'#ffffff',casing:'#111923',core3d:0xffffff,casing3d:0x111923,
  width2d:2,casingWidth2d:5,innerKm:.032,outerKm:.056,casingKm:.005,segments:20,
});
export const MAP_CONTRAST=Object.freeze({casing:'#111923',casing3d:0x111923,contourMajor:'#f9e0b0',contourMinor:'#e6cca7',contourMajor3d:0xf9e0b0,contourMinor3d:0xe6cca7});
