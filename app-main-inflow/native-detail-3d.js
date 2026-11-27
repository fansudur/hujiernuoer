const cleanBox = value => Array.isArray(value) && value.length===4 &&
  value.every(Number.isFinite) && value[0]>=-180 && value[2]<=180 &&
  value[1]>=-90 && value[3]<=90 && value[0]<value[2] && value[1]<value[3];

export function detailUvBounds(terrain, tile){
  if(!cleanBox(terrain)||!cleanBox(tile)||tile[2]<=terrain[0]||tile[0]>=terrain[2]||
      tile[3]<=terrain[1]||tile[1]>=terrain[3])return null;
  const [w,s,e,n]=terrain, [x0,y0,x1,y1]=tile;
  return [(x0-w)/(e-w),(y0-s)/(n-s),(x1-w)/(e-w),(y1-s)/(n-s)];
}

export function applyNativeDetail(T, material, uv, texture){
  const extents=new T.Vector4(...uv);
  const feather=new T.Vector2(8/texture.image.width,8/texture.image.height);
  material.customProgramCacheKey=()=> 'atlas-native-detail-v1';
  material.onBeforeCompile=shader=>{
    shader.uniforms.atlasDetailTexture={value:texture};
    shader.uniforms.atlasDetailExtents={value:extents};
    shader.uniforms.atlasDetailFeather={value:feather};
    shader.vertexShader=shader.vertexShader.replace('#include <uv_pars_vertex>',
        '#include <uv_pars_vertex>\nvarying vec2 vAtlasDetailTerrainUv;')
      .replace('#include <uv_vertex>','#include <uv_vertex>\nvAtlasDetailTerrainUv = uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>',
        '#include <map_pars_fragment>\nuniform sampler2D atlasDetailTexture;\nuniform vec4 atlasDetailExtents;\nuniform vec2 atlasDetailFeather;\nvarying vec2 vAtlasDetailTerrainUv;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          #ifdef DECODE_VIDEO_TEXTURE
            sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
          #endif
          vec2 atlasDetailUv=(vAtlasDetailTerrainUv-atlasDetailExtents.xy)/(atlasDetailExtents.zw-atlasDetailExtents.xy);
          vec2 atlasEdge=min(atlasDetailUv,vec2(1.0)-atlasDetailUv);
          vec2 atlasBlend=smoothstep(vec2(0.0),atlasDetailFeather,atlasEdge);
          vec4 atlasDetailColor=texture2D(atlasDetailTexture,clamp(atlasDetailUv,vec2(0.0),vec2(1.0)));
          sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,atlasDetailColor.rgb,atlasBlend.x*atlasBlend.y*atlasDetailColor.a);
          diffuseColor *= sampledDiffuseColor;
        #endif
      `);
  };
  return material;
}


export function applyNativeDetailSet(T,material,layers) {
  if(layers.length===1)return applyNativeDetail(T,material,layers[0].uv,layers[0].texture);
  const uniformDecl=layers.map((_,i)=>'uniform sampler2D ndT'+i+'; uniform vec4 ndB'+i+'; uniform vec2 ndF'+i+';').join('\n');
  const gl=layers.map((_,i)=>[
    'vec2 ndUv'+i+'=(vAtlasDetailTerrainUv-ndB'+i+'.xy)/(ndB'+i+'.zw-ndB'+i+'.xy);',
    'vec2 ndEdge'+i+'=min(ndUv'+i+',vec2(1.)-ndUv'+i+');',
    'vec2 ndAlpha'+i+'=smoothstep(vec2(0.),ndF'+i+',ndEdge'+i+');',
    'vec4 ndColor'+i+'=texture2D(ndT'+i+',clamp(ndUv'+i+',vec2(0.),vec2(1.)));',
    'sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,ndColor'+i+'.rgb,ndAlpha'+i+'.x*ndAlpha'+i+'.y*ndColor'+i+'.a);'
  ].join('\n')).join('\n');
  material.customProgramCacheKey=()=> 'atlas-native-detail-set-v74-'+layers.length;
  material.onBeforeCompile=shader=>{
    for(const [i,l] of layers.entries()){
      shader.uniforms['ndT'+i]={value:l.texture};
      shader.uniforms['ndB'+i]={value:new T.Vector4(...l.uv)};
      shader.uniforms['ndF'+i]={value:new T.Vector2(8/l.texture.image.width,8/l.texture.image.height)};
    }
    shader.vertexShader=shader.vertexShader.replace('#include <uv_pars_vertex>','#include <uv_pars_vertex>\nvarying vec2 vAtlasDetailTerrainUv;')
      .replace('#include <uv_vertex>','#include <uv_vertex>\nvAtlasDetailTerrainUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>','#include <map_pars_fragment>\nvarying vec2 vAtlasDetailTerrainUv;\n'+uniformDecl)
      .replace('#include <map_fragment>','#ifdef USE_MAP\nvec4 sampledDiffuseColor=texture2D(map,vMapUv);\n'+gl+'\ndiffuseColor *= sampledDiffuseColor;\n#endif');
  };
  return material;
}
