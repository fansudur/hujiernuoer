// Presentation controls only. They never modify observations, water elevation,
// terrain, solar geometry, measured units, or the analysis time window.
export const SCENE_QUALITY = Object.freeze({
 low: {pixelRatio:1, rainCount:180, splashCount:24, cloudOctaves:3},
 balanced: {pixelRatio:1.5, rainCount:480, splashCount:64, cloudOctaves:4},
 high: {pixelRatio:1.8, rainCount:900, splashCount:100, cloudOctaves:4}
});
export const RENDER_DEMO_NOTICE = '天空、雨滴和水流箭头为过程示意；水面仅用淡色分类与岸线，不添加反射波纹。它们不是当年天气复原、实测水位、流量或CFD。';
export function qualityName(value){return Object.hasOwn(SCENE_QUALITY,value)?value:'balanced';}
export function demoWeather(input={}){const clamp=(v,fallback)=>Number.isFinite(Number(v))?Math.min(1,Math.max(0,Number(v))):fallback;return {rainIntensity:clamp(input.rainIntensity,.55),cloudCover:clamp(input.cloudCover,.82),windGust:clamp(input.windGust,.25)};}
