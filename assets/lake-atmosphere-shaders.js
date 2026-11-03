// Shared atmosphere in sky and water. This is procedural visual lighting,
// not a cloud observation, wave measurement, reflection capture or water-depth model.
export const skyVertex=`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const atmosphere=`
float lakeHash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
float lakeNoise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(lakeHash21(i),lakeHash21(i+vec2(1.,0.)),f.x),mix(lakeHash21(i+vec2(0.,1.)),lakeHash21(i+vec2(1.,1.)),f.x),f.y);}
float lakeFbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*lakeNoise2(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
vec3 atmosphereColor(vec3 d){float h=clamp(d.y,0.,1.);float dusk=pow(1.-max(0.,sunDir.y),3.)*daylight;vec3 horizon=mix(vec3(.018,.026,.043),vec3(.69,.79,.83),daylight);vec3 zenith=mix(vec3(.004,.009,.027),vec3(.11,.30,.51),daylight);vec3 c=mix(horizon,zenith,pow(h,.38));float facing=max(0.,dot(d,sunDir));c+=vec3(.36,.13,.035)*dusk*pow(facing,5.)*(1.-h);float halo=pow(facing,110.);float disc=smoothstep(.99977,.99996,facing);c+=vec3(1.,.83,.56)*(halo*.26+disc*2.6)*daylight*step(0.,sunDir.y);vec2 cp=d.xz/max(.16,d.y+.1)*1.6+windDir*time*.003;float n=lakeFbm(cp),coverage=smoothstep(.72-cloud*.5,.91-cloud*.48,n)*smoothstep(.025,.22,d.y);vec3 cloudColor=mix(vec3(.075,.085,.11),mix(vec3(.48,.54,.58),vec3(.92,.92,.87),n),daylight);c=mix(c,cloudColor,coverage*.9);return max(c,vec3(0.));}
`;
export const skyFragment=`uniform vec3 sunDir;uniform float daylight;uniform float cloud;uniform float time;uniform vec2 windDir;varying vec3 vDirection;${atmosphere}void main(){gl_FragColor=vec4(atmosphereColor(normalize(vDirection)),1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include');
export const waterVertex=`varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
// A quiet classification tint, deliberately without reflections, waves or fake depth.
export const waterFragment=`uniform float alpha;uniform float attention;varying vec3 vWorld;
void main(){gl_FragColor=vec4(vec3(.018,.27,.65),alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
