// 仅显示效果；修改后刷新网页。不是观测参数，不改变光照方向或数据。
export const visualConfig = Object.freeze({
  exposure: 1.05,             // 原版曝光
  sunIntensityMultiplier: 1, // 日照几何计算得到的光强的显示倍率
  ambientIntensityMultiplier: 1 // 环境补光显示倍率
});
