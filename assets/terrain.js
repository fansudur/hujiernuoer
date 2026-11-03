import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export class TerrainView{
 constructor(el,data,onStatus){this.el=el;this.data=data;this.exag=4;this.date='2024-08';this.waterVisible=true;this.boundaryVisible=true;this.context=false;this.onStatus=onStatus;this.setup();}
 setup(){try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor('#dee6d7');this.el.append(this.renderer.domElement);this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog('#dee6d7',18,45);this.camera=new THREE.PerspectiveCamera(37,1,.01,150);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=false;this.controls.minDistance=1;this.controls.maxDistance=28;this.controls.maxPolarAngle=Math.PI*.485;this.controls.addEventListener('change',()=>this.render());this.scene.add(new THREE.HemisphereLight(0xffffed,0x748563,2.6));let sun=new THREE.DirectionalLight(0xfff5db,3.1);sun.position.set(-4,8,3);this.scene.add(sun);this.build();this.reset();this.resize=new ResizeObserver(()=>{this.renderer.setSize(this.el.clientWidth,this.el.clientHeight);this.camera.aspect=this.el.clientWidth/this.el.clientHeight;if(this.camera.isOrthographicCamera){const span=this.context?9:4.6;this.camera.left=-span*this.camera.aspect;this.camera.right=span*this.camera.aspect;}this.camera.updateProjectionMatrix();if(this.layerPresentation?.exploded&&this.mode!=='2d')this.showExplodedPresentation({selected:this.layerPresentation.selected,animate:false});else this.render();});this.resize.observe(this.el);this.onStatus('三维地形已就绪');}catch(e){console.warn('WebGL unavailable: 2D fallback',e);this.fallback=true;this.el.innerHTML='<canvas aria-label="真实地形二维替代视图"></canvas>';this.canvas=this.el.querySelector('canvas');this.resize=new ResizeObserver(()=>this.draw2d());this.resize.observe(this.el);this.draw2d();this.onStatus('当前设备使用二维地形替代视图');}}
 terrain(){return this.context?this.data.context:this.data.local;}
 project(lon,lat){let b=this.terrain().bounds;return [(lon-(b[0]+b[2])/2)*111.32*Math.cos(49.14*Math.PI/180),-(lat-(b[1]+b[3])/2)*111.32];}
 sample(lon,lat){let t=this.terrain(),[w,s,e,n]=t.bounds,x=Math.max(0,Math.min(t.width-1,(lon-w)/(e-w)*t.width-.5)),y=Math.max(0,Math.min(t.height-1,(n-lat)/(n-s)*t.height-.5));let i=Math.floor(x),j=Math.floor(y),i1=Math.min(i+1,t.width-1),j1=Math.min(j+1,t.height-1),a=x-i,b=y-j;return (t.elevations[j*t.width+i]*(1-a)+t.elevations[j*t.width+i1]*a)*(1-b)+(t.elevations[j1*t.width+i]*(1-a)+t.elevations[j1*t.width+i1]*a)*b;}
 point(c,lift=.004){let p=this.project(c[0],c[1]);return new THREE.Vector3(p[0],(this.sample(...c)-this.base)/1000*this.exag+lift,p[1]);}
 disposeGroup(g){if(!g)return;g.traverse(o=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.map?.dispose();m.dispose();});}});this.scene.remove(g);}
 build(){if(this.fallback){this.draw2d();return;}this.disposeGroup(this.land);this.disposeGroup(this.static);this.land=new THREE.Group();this.static=new THREE.Group();this.scene.add(this.land,this.static);let t=this.terrain(),[w,s,e,n]=t.bounds;this.base=Math.min(...t.elevations);let max=Math.max(...t.elevations),pos=[],colors=[],idx=[];for(let r=0;r<t.height;r++)for(let c=0;c<t.width;c++){let h=t.elevations[r*t.width+c],p=this.point([w+(c+.5)/t.width*(e-w),n-(r+.5)/t.height*(n-s)],0);pos.push(...p.toArray());let color=new THREE.Color().lerpColors(new THREE.Color('#beca9c'),new THREE.Color('#7d9868'),(h-this.base)/(max-this.base));colors.push(color.r,color.g,color.b);if(c<t.width-1&&r<t.height-1){let i=r*t.width+c;idx.push(i,i+t.width,i+1,i+1,i+t.width,i+t.width+1);}}
 let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide});this.land.add(new THREE.Mesh(g,mat));if(this.useRelief){const uv=[];for(let r=0;r<t.height;r++)for(let c=0;c<t.width;c++)uv.push((c+.5)/t.width,1-(r+.5)/t.height);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));new THREE.TextureLoader().load('data/reference/terrain_relief_'+(this.context?'context':'local')+'.png',texture=>{texture.colorSpace=THREE.SRGBColorSpace;mat.map=texture;mat.vertexColors=false;mat.needsUpdate=true;this.render();});}this.boundary=new THREE.Group();this.static.add(this.boundary);this.polygons(this.data.boundary).forEach(p=>this.line(p[0],0xad6044,this.boundary));this.boundary.visible=this.boundaryVisible;
 if(this.context){this.polygons(this.data.buildings).forEach(p=>this.line(p[0],0x6c6b61,this.static,.015));}
 let office=this.data.office.features[0];if(office){let q=this.point(office.geometry.coordinates,.02);let marker=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),new THREE.MeshBasicMaterial({color:'#a45f36',depthTest:false}));marker.position.copy(q);this.static.add(marker);this.label('办公楼院参考点',q.clone().add(new THREE.Vector3(0,.1,0)),this.static);}
 let pn=this.point([(w+e)/2,n],.03);this.label('北 N',pn,this.static);this.waterUpdate();this.windUpdate();this.render();}
 polygons(fc){return fc.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[]);}
 line(coords,color,target,lift=.012){let points=coords.map(c=>this.point(c,lift));let line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.9}));line.renderOrder=5;target.add(line);}
 fill(poly,color,target){let shape=new THREE.Shape(poly[0].map(c=>{let p=this.project(...c);return new THREE.Vector2(p[0],-p[1]);}));poly.slice(1).forEach(r=>shape.holes.push(new THREE.Path(r.map(c=>{let p=this.project(...c);return new THREE.Vector2(p[0],-p[1]);}))));let g=new THREE.ShapeGeometry(shape);let p=g.attributes.position;let b=this.terrain().bounds;for(let i=0;i<p.count;i++){let x=p.getX(i),z=-p.getY(i),lon=x/(111.32*Math.cos(49.14*Math.PI/180))+(b[0]+b[2])/2,lat=-z/111.32+(b[1]+b[3])/2;p.setXYZ(i,x,(this.sample(lon,lat)-this.base)/1000*this.exag+.009,z);}g.computeVertexNormals();let mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.89}));mesh.renderOrder=3;target.add(mesh);}
 waterUpdate(){if(this.fallback){this.draw2d();return;}this.disposeGroup(this.water);this.water=new THREE.Group();this.scene.add(this.water);for(let [fc,color] of [[this.data.water,0x288fa6],[this.data.nodata,0x8b9495]])this.polygons({features:fc.features.filter(f=>f.properties.date===this.date)}).forEach(p=>this.fill(p,color,this.water));this.water.visible=this.waterVisible;this.render();}
 label(text,p,target){const cv=document.createElement('canvas'),measure=cv.getContext('2d');measure.font='28px sans-serif';const lines=[];let line='';for(const char of String(text)){if(char==='\n'||measure.measureText(line+char).width>440){lines.push(line);line=char==='\n'?'':char;}else line+=char;}if(line)lines.push(line);cv.width=480;cv.height=Math.max(66,lines.length*37+24);const c=cv.getContext('2d');c.fillStyle='#fffef9ee';c.fillRect(0,0,cv.width,cv.height);c.font='28px sans-serif';c.fillStyle='#294844';c.textAlign='center';lines.forEach((value,i)=>c.fillText(value,240,37+i*37));const texture=new THREE.CanvasTexture(cv),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.position.copy(p);sprite.scale.set(1.05,1.05*cv.height/cv.width,1);sprite.renderOrder=10;target.add(sprite);return sprite;}

 windUpdate(){if(this.fallback){this.draw2d();return;}this.disposeGroup(this.wind);this.wind=new THREE.Group();this.scene.add(this.wind);if(this.windVisible){this.label(this.windText||'区域10m风 · 非现场',new THREE.Vector3(-1.3,.65,1),this.wind);}this.render();}
 setDate(d){this.date=d;this.waterUpdate();} setExag(v){this.exag=v;this.build();}setContext(v){this.context=v;this.build();this.reset();}setWater(v){this.waterVisible=v;this.fallback?this.draw2d():(this.water.visible=v,this.render());}setBoundary(v){this.boundaryVisible=v;this.fallback?this.draw2d():(this.boundary.visible=v,this.render());}setWind(v){this.windVisible=v;this.windUpdate();}
 reset(top=false){if(this.fallback){this.draw2d();return;}let scale=this.context?2.1:1;this.camera.position.set(top?0:3.7*scale,top?8.5*scale:4.5*scale,top?.001:6.1*scale);this.controls.target.set(0,.06,0);this.controls.update();this.render();}zoom(f){if(this.fallback)return;if(this.camera.isOrthographicCamera){this.camera.zoom/=f;this.camera.updateProjectionMatrix();this.render();return;}this.camera.position.sub(this.controls.target).multiplyScalar(f).add(this.controls.target);this.controls.update();this.render();}render(){if(this.renderer&&this.scene)this.renderer.render(this.scene,this.camera);this.onRender?.();}
 draw2d(){if(!this.canvas)return;let t=this.terrain(),canvas=this.canvas,w=this.el.clientWidth,h=this.el.clientHeight;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;let ctx=canvas.getContext('2d');ctx.scale(devicePixelRatio,devicePixelRatio);ctx.fillStyle='#dee6d7';ctx.fillRect(0,0,w,h);let min=Math.min(...t.elevations),max=Math.max(...t.elevations),[west,south,east,north]=t.bounds,ratio=(east-west)*Math.cos(49.14*Math.PI/180)/(north-south),dh=Math.min(h*.75,w*.85/ratio),dw=dh*ratio,ox=(w-dw)/2,oy=(h-dh)/2;let xy=c=>[ox+(c[0]-west)/(east-west)*dw,oy+(north-c[1])/(north-south)*dh];for(let r=0;r<t.height;r++)for(let c=0;c<t.width;c++){let v=(t.elevations[r*t.width+c]-min)/(max-min);ctx.fillStyle=`rgb(${190-v*65},${202-v*50},${156-v*52})`;ctx.fillRect(ox+c/t.width*dw,oy+r/t.height*dh,dw/t.width+1,dh/t.height+1);}if(this.satelliteImage&&this.satelliteSpec&&this.layerPresentation?.layers?.satellite?.visible!==false){ctx.globalAlpha=this.presentationOpacity('satellite');const [ww,ss,ee,nn]=this.satelliteSpec.bounds,a=xy([ww,nn]),b=xy([ee,ss]);ctx.drawImage(this.satelliteImage,a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.globalAlpha=1;}let path=p=>{ctx.beginPath();p.forEach(r=>r.forEach((c,i)=>{let a=xy(c);i?ctx.lineTo(...a):ctx.moveTo(...a);}));ctx.closePath();};if(this.waterVisible&&this.layerPresentation?.layers?.water?.visible!==false)for(let [fc,color] of [[this.data.water,'#288fa6'],[this.data.nodata,'#8b9495']])for(let p of this.polygons({features:fc.features.filter(f=>f.properties.date===this.date)})){path(p);ctx.fillStyle=color;ctx.globalAlpha=this.presentationOpacity('water');ctx.fill('evenodd');ctx.globalAlpha=1;}if(this.boundaryVisible){ctx.strokeStyle='#ad6044';ctx.lineWidth=2;for(let p of this.polygons(this.data.boundary)){path(p);ctx.stroke();}}if(this.reference&&this.layerPresentation?.layers?.references?.visible!==false){ctx.globalAlpha=this.presentationOpacity('references');ctx.strokeStyle='#ab9777';ctx.lineWidth=1;for(const f of this.reference.roads?.features||[]){if(f.geometry.type!=='LineString')continue;ctx.beginPath();f.geometry.coordinates.forEach((c,i)=>{const p=xy(c);i?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.stroke();}ctx.globalAlpha=1;}if(this.context){ctx.strokeStyle='#6c6b61';ctx.lineWidth=1;for(let p of this.polygons(this.data.buildings)){path(p);ctx.stroke();}}let office=xy(this.data.office.features[0].geometry.coordinates);ctx.fillStyle='#a45f36';ctx.beginPath();ctx.arc(...office,4,0,7);ctx.fill();ctx.font='11px sans-serif';ctx.fillText('办公院参考点',office[0]+7,office[1]);ctx.fillStyle='#294844';ctx.fillText('二维地形替代视图 · 北 ↑',20,h-115);}
}
// Presentation camera and georeferenced reference layers. No fabricated water geometry.
TerrainView.prototype.setMode=function(mode){this.mode=mode;if(mode==='2d'&&this.layerPresentation?.exploded)this.setLayerPresentation({exploded:false,selected:null});if(this.fallback){this.draw2d();return;}this.controls.enabled=mode!=='2d';if(mode==='2d'){if(!this.perspectiveCamera)this.perspectiveCamera=this.camera;let aspect=this.el.clientWidth/this.el.clientHeight,span=this.context?9:4.6;this.camera=new THREE.OrthographicCamera(-span*aspect,span*aspect,span,-span,.01,150);this.camera.position.set(0,20,.001);this.camera.lookAt(0,0,0);this.controls.object=this.camera;}else{this.camera=this.perspectiveCamera||this.camera;this.controls.object=this.camera;this.reset();}this.render();};
TerrainView.prototype.fly=function(step,anchor){if(this.fallback)return;const top=this.mode==='2d';if(top){this.setMode('2d');return;}const target=anchor?this.point(anchor,.06):new THREE.Vector3((step%3-1)*.22,.06,0),end=new THREE.Vector3(3.7+(step%3)*.5,4.5,6.1-(step%2)*.7).multiplyScalar(this.context?2.1:1).add(target);let start=this.camera.position.clone(),a=this.controls.target.clone(),time=performance.now(),token=++this.flyToken||1;this.flyToken=token;const tick=()=>{if(this.flyToken!==token)return;let t=Math.min(1,(performance.now()-time)/(matchMedia('(prefers-reduced-motion: reduce)').matches?1:700)),e=t*t*(3-2*t);this.camera.position.lerpVectors(start,end,e);this.controls.target.lerpVectors(a,target,e);this.controls.update();this.render();if(t<1)requestAnimationFrame(tick);};tick();};
TerrainView.prototype.setReference=function(ref){this.reference=ref;this.drawReference();};
TerrainView.prototype.drawReference=function(){if(this.fallback)return;this.disposeGroup(this.references);this.references=new THREE.Group();this.scene.add(this.references);const r=this.reference;if(!r)return;const [w,s,e,n]=this.terrain().bounds,inside=c=>c[0]>=w&&c[0]<=e&&c[1]>=s&&c[1]<=n;for(const f of r.roads?.features||[]){const g=f.geometry;for(const c of g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]){const cc=c.filter(inside);if(cc.length>1)this.line(cc,f.properties.waterway?0x86a4a3:0xb6a17d,this.references,.019);}}for(const f of r.contours?.features||[]){const g=f.geometry;for(const c of g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]){const cc=c.filter(inside);if(cc.length>1)this.line(cc,0x8c9675,this.references,.001);}}for(const f of (r.places?.features||[]).filter(f=>f.properties.place).slice(0,20)){if(f.geometry.type==='Point'&&inside(f.geometry.coordinates))this.label(f.properties.name||'地名',this.point(f.geometry.coordinates,.07),this.references);}this.render();};
TerrainView.prototype.beginSatelliteReadiness=function(){
 if(this.satelliteResolve)this.satelliteResolve({loaded:false,cancelled:true});
 const token=this.satelliteRequest=(this.satelliteRequest||0)+1;
 this.satelliteReady=new Promise(resolve=>{this.satelliteResolve=resolve;});
 return {token,finish:result=>{if(this.satelliteRequest!==token)return;const resolve=this.satelliteResolve;this.satelliteResolve=null;resolve?.(result);}};
};
TerrainView.prototype.setSatellite=function(src,bounds){
 this.satelliteSpec=src?{src,bounds}:null;
 if(this.fallback){
  const request=this.beginSatelliteReadiness();this.satelliteImage=null;
  if(!src){this.draw2d();request.finish({loaded:true});return this.satelliteReady;}
  const spec=this.satelliteSpec,img=new Image();
  img.onload=()=>{if(this.satelliteSpec!==spec||this.satelliteRequest!==request.token)return;this.satelliteImage=img;this.draw2d();request.finish({loaded:true});};
  img.onerror=()=>{if(this.satelliteSpec!==spec||this.satelliteRequest!==request.token)return;this.draw2d();this.onStatus('卫星底图载入失败 · 保留真实地形');request.finish({loaded:false});};
  img.src=src;return this.satelliteReady;
 }
 return this.drawSatellite();
};
TerrainView.prototype.drawSatellite=function(){
 if(this.fallback)return this.satelliteReady||Promise.resolve({loaded:true});
 const request=this.beginSatelliteReadiness();this.disposeGroup(this.satellite);this.satellite=null;const spec=this.satelliteSpec;
 if(!spec){this.render();request.finish({loaded:true});return this.satelliteReady;}
 new THREE.TextureLoader().load(spec.src,texture=>{
  if(this.satelliteSpec!==spec||this.satelliteRequest!==request.token){texture.dispose();return;}
  texture.colorSpace=THREE.SRGBColorSpace;const [w,s,e,n]=spec.bounds,pos=[],uv=[],idx=[],nx=60,ny=40;
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){pos.push(...this.point([w+x/nx*(e-w),n-y/ny*(n-s)],.002).toArray());uv.push(x/nx,1-y/ny);if(x<nx&&y<ny){const i=y*(nx+1)+x;idx.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  this.satellite=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:true}));this.scene.add(this.satellite);this.render();request.finish({loaded:true});
 },undefined,()=>{if(this.satelliteSpec!==spec||this.satelliteRequest!==request.token)return;this.onStatus('卫星底图载入失败 · 保留真实地形');this.render();request.finish({loaded:false});});
 return this.satelliteReady;
};
const originalBuild=TerrainView.prototype.build;TerrainView.prototype.build=function(){originalBuild.call(this);if(this.reference)this.drawReference();if(this.satelliteSpec)this.drawSatellite();};

TerrainView.prototype.screenPoint=function(c){const p=this.point(c,.03).project(this.camera);return {x:(p.x+1)/2*this.el.clientWidth,y:(1-p.y)/2*this.el.clientHeight};};

// Linked-story overlays. Input is observed GeoJSON, never inferred from area totals.
const storyCollection=value=>value?.type==='Feature'?{type:'FeatureCollection',features:[value]}:{type:'FeatureCollection',features:Array.isArray(value?.features)?value.features:[]};
const storyPolygons=f=>f?.geometry?.type==='Polygon'?[f.geometry.coordinates]:f?.geometry?.type==='MultiPolygon'?f.geometry.coordinates:[];
const storyColors={gain:'#61b983',loss:'#cb7166',overlap:'#528fbb'};
function storyWindSpec(view,wind){
 if(!wind)return null;
 const [w,s,e,n]=view.terrain().bounds;
 const anchor=Array.isArray(wind.anchor)&&wind.anchor.length>=2?wind.anchor:[w+(e-w)*.25,s+(n-s)*.73];
 const hasDirection=typeof wind.from_deg==='number'&&Number.isFinite(wind.from_deg);
 const diffuse=typeof wind.concentration==='number'&&Number.isFinite(wind.concentration)&&wind.concentration<.35;
 // A meteorological bearing is where wind comes FROM; drawing is where it blows TO.
 const directions=!hasDirection?[]:diffuse?[0,45,90,135,180,225,270,315]:[wind.from_deg];
 const speed=typeof wind.speed==='number'&&Number.isFinite(wind.speed)?` ${wind.speed.toFixed(1)} m/s`:'';
 return {anchor,directions,diffuse,label:`${wind.label||'区域风'}${speed} · ${!hasDirection?'方向缺测':diffuse?'来向分散（多向示意）':'箭头表示吹往方向'}`,limit:'区域格点背景 · 非现场风场 / 非CFD'};
}
TerrainView.prototype.setStoryLayers=function(layers={}){
 this.storyLayers={outlines:storyCollection(layers.outlines),changes:storyCollection(layers.changes),scenarios:storyCollection(layers.scenarios),highlight:layers.highlight||'',wind:layers.wind||null};
 this.drawStoryLayers();
};
TerrainView.prototype.drawStoryLayers=function(){
 if(this.fallback){this.draw2d();return;}
 this.disposeGroup(this.storyGroup);this.storyGroup=new THREE.Group();this.scene.add(this.storyGroup);
 const state=this.storyLayers;if(!state){this.render();return;}
 const group=this.storyGroup;
 const planarPositions=[];
 const ring=(coords,color,dashed=false,emphasis=false,semanticScope=null)=>{
  if(!Array.isArray(coords)||coords.length<2)return;
  const planar=semanticScope==='lake'||semanticScope==='stable_grassland';
  const points=coords.map(c=>{if(!planar)return this.point(c,.026);const [x,z]=this.project(c[0],c[1]);const point=new THREE.Vector3(x,.04,z);planarPositions.push(point);return point;});
  const geometry=new THREE.BufferGeometry().setFromPoints(points);
  const opts={color,depthTest:false,transparent:true,opacity:emphasis?1:.85};
  const material=dashed?new THREE.LineDashedMaterial({...opts,dashSize:.035,gapSize:.025}):new THREE.LineBasicMaterial(opts);
  const line=new THREE.Line(geometry,material);if(dashed)line.computeLineDistances();line.renderOrder=emphasis?9:7;if(planar){line.userData={semantic_scope:semanticScope,coordinate_mode:'statistical_support_plane',display_y:.04,elevation_sampled:false};group.userData.statisticalPlane=true;}group.add(line);
 };
 for(const f of state.changes.features){
  const color=storyColors[f.properties?.change]||'#859386';
  for(const poly of storyPolygons(f)){const before=group.children.length;this.fill(poly,color,group);const mesh=group.children[before];mesh.material.opacity=.48;mesh.renderOrder=6;}
 }
 for(const f of state.outlines.features){
  const p=f.properties||{},color=p.color||'#e8c66b',selected=state.highlight&&(state.highlight===p.id||state.highlight===p.date);
  for(const poly of storyPolygons(f))for(const coords of poly)ring(coords,color,false,!!selected,p.semantic_scope);
  if(f.geometry?.type==='LineString')ring(f.geometry.coordinates,color,false,!!selected,p.semantic_scope);
  if(f.geometry?.type==='MultiLineString')for(const c of f.geometry.coordinates)ring(c,color,false,!!selected,p.semantic_scope);
 }
 if(planarPositions.length){const center=planarPositions.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/planarPositions.length);center.y=.12;this.label('统计支持域平面 · 非地形高程',center,group);}
 for(const f of state.scenarios.features){
  const p=f.properties||{},color=p.color||'#ae84b9',selected=state.highlight===p.id;let anchor=null;
  for(const poly of storyPolygons(f)){
   const before=group.children.length;this.fill(poly,color,group);group.children[before].material.opacity=selected ? .28 : .12;group.children[before].renderOrder=6;
   for(const c of poly)ring(c,color,true,selected);
   if(poly[0]?.length){const a=poly[0].slice(0,-1);if(a.length)anchor=a.reduce((v,c)=>[v[0]+c[0]/a.length,v[1]+c[1]/a.length],[0,0]);}
  }
  if(f.geometry?.type==='Point'){
   anchor=f.geometry.coordinates;const marker=new THREE.Mesh(new THREE.RingGeometry(selected ? .065 : .045,selected ? .085 : .06,28),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,depthTest:false}));marker.rotation.x=-Math.PI/2;marker.position.copy(this.point(anchor,.035));marker.renderOrder=8;group.add(marker);
  }
  if(anchor&&p.label)this.label(`${p.label} · 候选，非选址`,this.point(anchor,.12),group);
 }
 const wind=storyWindSpec(this,state.wind);
 if(wind){
  const center=this.point(wind.anchor,.18),scale=this.context?1.6:1;
  for(const from of wind.directions){const rad=from*Math.PI/180,direction=new THREE.Vector3(-Math.sin(rad),0,Math.cos(rad));const origin=center.clone();if(wind.diffuse)origin.addScaledVector(direction,.08*scale);const arrow=new THREE.ArrowHelper(direction,origin,(wind.diffuse ? .32 : .75)*scale,0x365c78,.10*scale,.065*scale);arrow.traverse(o=>{if(o.material){o.material.depthTest=false;o.material.transparent=true;o.material.opacity=wind.diffuse ? .65 : .95;}o.renderOrder=9;});group.add(arrow);}
  this.label(wind.label,center.clone().add(new THREE.Vector3(0,.22,0)),group);
  this.label(wind.limit,center.clone().add(new THREE.Vector3(0,.07,0)),group);
 }
 this.render();
};
const buildBeforeStory=TerrainView.prototype.build;
TerrainView.prototype.build=function(){buildBeforeStory.call(this);if(this.storyLayers&&!this.fallback)this.drawStoryLayers();};
const draw2dBeforeStory=TerrainView.prototype.draw2d;
TerrainView.prototype.draw2d=function(){
 draw2dBeforeStory.call(this);if(!this.canvas||!this.storyLayers||this.layerPresentation?.layers?.story?.visible===false)return;const layerOpacity=this.presentationOpacity('story');
 const t=this.terrain(),[west,south,east,north]=t.bounds,w=this.el.clientWidth,h=this.el.clientHeight,ratio=(east-west)*Math.cos(49.14*Math.PI/180)/(north-south),dh=Math.min(h*.75,w*.85/ratio),dw=dh*ratio,ox=(w-dw)/2,oy=(h-dh)/2;
 const xy=c=>[ox+(c[0]-west)/(east-west)*dw,oy+(north-c[1])/(north-south)*dh],ctx=this.canvas.getContext('2d'),state=this.storyLayers;
 ctx.save();ctx.globalAlpha=layerOpacity; // base renderer already applies devicePixelRatio transform
 const path=poly=>{ctx.beginPath();for(const r of poly){r.forEach((c,i)=>{const p=xy(c);i?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.closePath();}};
 const line=(coords,color,dashed=false,selected=false)=>{ctx.beginPath();coords.forEach((c,i)=>{const p=xy(c);i?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.setLineDash(dashed?[5,4]:[]);ctx.lineWidth=selected?3:1.7;ctx.strokeStyle=color;ctx.stroke();ctx.setLineDash([]);};
 for(const f of state.changes.features){ctx.fillStyle=storyColors[f.properties?.change]||'#859386';ctx.globalAlpha=.48*layerOpacity;for(const poly of storyPolygons(f)){path(poly);ctx.fill('evenodd');}}ctx.globalAlpha=layerOpacity;
 for(const f of state.outlines.features){const p=f.properties||{},selected=state.highlight&&(state.highlight===p.id||state.highlight===p.date);for(const poly of storyPolygons(f))for(const c of poly)line(c,p.color||'#e8c66b',false,selected);if(f.geometry?.type==='LineString')line(f.geometry.coordinates,p.color||'#e8c66b',false,selected);if(f.geometry?.type==='MultiLineString')for(const c of f.geometry.coordinates)line(c,p.color||'#e8c66b',false,selected);}
 ctx.font='11px sans-serif';if(state.outlines.features.some(f=>['lake','stable_grassland'].includes(f.properties?.semantic_scope))){ctx.fillStyle='#3c4357';ctx.fillText('统计支持域平面 · 非地形高程',ox+8,oy+18);}
 for(const f of state.scenarios.features){const p=f.properties||{},color=p.color||'#ae84b9',selected=state.highlight===p.id;let anchor=null;for(const poly of storyPolygons(f)){path(poly);ctx.globalAlpha=(selected ? .28 : .12)*layerOpacity;ctx.fillStyle=color;ctx.fill('evenodd');ctx.globalAlpha=layerOpacity;for(const c of poly)line(c,color,true,selected);anchor=poly[0]?.[0];}if(f.geometry?.type==='Point'){anchor=f.geometry.coordinates;const a=xy(anchor);ctx.beginPath();ctx.arc(...a,selected?8:6,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}if(anchor&&p.label){const a=xy(anchor);ctx.fillStyle='#503e59';ctx.fillText(`${p.label} · 候选，非选址`,a[0]+8,a[1]-8);}}
 const wind=storyWindSpec(this,state.wind);if(wind){const a=xy(wind.anchor);ctx.strokeStyle='#365c78';ctx.fillStyle='#365c78';ctx.lineWidth=2;for(const from of wind.directions){const rad=from*Math.PI/180,dx=-Math.sin(rad),dy=Math.cos(rad),len=wind.diffuse?23:45,x=a[0]+dx*len,y=a[1]+dy*len;ctx.globalAlpha=(wind.diffuse ? .65 : .95)*layerOpacity;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(x,y);ctx.lineTo(x-dx*8-dy*4,y-dy*8+dx*4);ctx.moveTo(x,y);ctx.lineTo(x-dx*8+dy*4,y-dy*8-dx*4);ctx.stroke();}ctx.globalAlpha=layerOpacity;ctx.fillText(wind.label,a[0]-50,a[1]-35);ctx.fillText(wind.limit,a[0]-50,a[1]-20);}
 ctx.restore();
};

// Exploded layers are presentation offsets, never measured elevation or subsurface strata.
TerrainView.prototype.setLayerPresentation=function(options={}){
 const previous=this.layerPresentation||{exploded:false,selected:null,layers:{}};
 const layers={};for(const key of ['satellite','water','references','story']){
  const before=previous.layers[key]||{visible:true,opacity:1},next=options.layers?.[key]||{};
  layers[key]={visible:typeof next.visible==='boolean'?next.visible:before.visible,opacity:typeof next.opacity==='number'&&Number.isFinite(next.opacity)?Math.max(0,Math.min(1,next.opacity)):before.opacity};
 }
 this.layerPresentation={exploded:typeof options.exploded==='boolean'?options.exploded:previous.exploded,selected:options.selected===undefined?previous.selected:options.selected,layers};
 if(!this.layerPresentation.exploded&&!this.fallback){this.camera.clearViewOffset?.();if(this.explodedFog!==undefined){this.scene.fog=this.explodedFog;delete this.explodedFog;}}
 if(this.fallback)this.draw2d();else this.render();
 return {...this.layerPresentation,explodedEffective:!!this.layerPresentation.exploded&&!this.fallback&&this.mode!=='2d'};
};
TerrainView.prototype.applyLayerPresentation=function(){
 if(this.fallback||!this.scene)return;
 const state=this.layerPresentation;if(!state)return;
 const exploded=state.exploded&&this.mode!=='2d',scale=this.presentationSpacing();
 this.layerOpacityBases ||= new WeakMap();
 const rows=[['satellite',this.satellite,1,'卫星照片'],['water',this.water,2,'历史水面'],['references',this.references,3,'道路与地形参照'],['story',this.storyGroup,4,'关系与候选示意']];
 for(const [key,group,lift] of rows){
  if(!group)continue;const cfg=state.layers[key]||{visible:true,opacity:1};
  group.position.y=exploded?lift*scale:0;
  group.visible=cfg.visible&&(key!=='water'||this.waterVisible);
  group.traverse(object=>{if(!object.material)return;for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!this.layerOpacityBases.has(material))this.layerOpacityBases.set(material,{opacity:material.opacity,transparent:material.transparent});
   const base=this.layerOpacityBases.get(material),opacity=base.opacity*cfg.opacity*(state.selected&&state.selected!==key ? .22 : 1);
   material.opacity=opacity;const transparent=base.transparent||opacity<1;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
  }});
 }
 const signature=JSON.stringify([exploded,state.selected,state.layers,this.context,this.exag,this.waterVisible,this.date,this.satelliteSpec?.src,this.el.clientWidth<=700,rows.map(([,g])=>g?(g.children?.length??1):-1)]);
 if(signature===this.layerPresentationSignature)return;this.layerPresentationSignature=signature;
 this.disposeGroup(this.layerPresentationGuide);this.layerPresentationGuide=new THREE.Group();this.scene.add(this.layerPresentationGuide);
 this.explodedLabelAnchors=[];if(!exploded)return;
 const [w,s,e,n]=this.terrain().bounds,anchor=[w,s+(n-s)*.38],ground=this.point(anchor,.03);
 const sourceDates={satellite:(this.satelliteSpec?.src||'').match(/\d{4}-\d{2}-\d{2}/)?.[0]||'日期见底图选择',water:this.date,references:'OSM / 历史DSM',story:this.storyGroup?.userData?.statisticalPlane?'非地形高程':'解释关系，非观测场'};
 for(const [key,group,lift,label] of rows){
  if(!group||!group.visible||(state.selected&&state.selected!==key)||((key==='story'||key==='water'||key==='references')&&!group.children?.length))continue;
  const color=state.selected===key?0xdb9d38:0x526f69,top=ground.clone().add(new THREE.Vector3(0,lift*scale,0)),labelPoint=top.clone().add(new THREE.Vector3(-scale*.85,0,0));
  const bounds=key==='satellite'&&this.satelliteSpec?.bounds?this.satelliteSpec.bounds:[w,s,e,n], [fw,fs,fe,fn]=bounds;
  const corners=[[fw,fs],[fe,fs],[fe,fn],[fw,fn],[fw,fs]].map(c=>this.point(c,.025).add(new THREE.Vector3(0,lift*scale,0)));
  const frame=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners),new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.55}));frame.renderOrder=2;frame.userData.presentationOnly=true;if(key==='story'&&this.storyGroup?.userData?.statisticalPlane){frame.geometry.dispose();frame.material.dispose();}else this.layerPresentationGuide.add(frame);
  const guide=new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.el.clientWidth<=700?[ground,top]:[ground,top,labelPoint]),new THREE.LineDashedMaterial({color,dashSize:.065*scale,gapSize:.04*scale,depthTest:false,transparent:true,opacity:.75}));guide.computeLineDistances();guide.renderOrder=11;this.layerPresentationGuide.add(guide);
  const names={satellite:'照片',water:'水面',references:'道路 / 地形',story:this.storyGroup?.userData?.statisticalPlane?'统计支持域平面':'关系候选'};this.explodedLabelAnchors.push({key,position:top.clone(),text:(state.selected===key?'▶ ':'')+names[key]+' · '+sourceDates[key]});
 }
 // Labels are rendered in screen-space below: never shrink scientific dates to unreadable sprites.

};
const renderBeforeLayerPresentation=TerrainView.prototype.render;
TerrainView.prototype.render=function(){this.applyLayerPresentation();renderBeforeLayerPresentation.call(this);this.updateExplodedLabels();};

TerrainView.prototype.presentationSpacing=function(){const [w,s,e,n]=this.terrain().bounds;return Math.max(.9,(e-w)*111.32*Math.cos(49.14*Math.PI/180)*.27);};
TerrainView.prototype.showExplodedPresentation=function({selected=null,animate=true}={}){
 if(this.fallback){this.setLayerPresentation({exploded:true,selected});this.onStatus('当前为二维叠合；设备不支持三维分层，可用图层显隐和透明度比较');return {explodedEffective:false,reason:'canvas-fallback'};}
 this.flyToken=(this.flyToken||0)+1;
 if(this.mode==='2d')this.setMode('3d');this.mode='3d';
 if(this.explodedFog===undefined)this.explodedFog=this.scene.fog;this.scene.fog=null;
 this.controls.maxDistance=160;
 this.setLayerPresentation({exploded:true,selected});
 const spacing=this.presentationSpacing(),[w,s,e,n]=this.terrain().bounds;
 const a=this.point([w,n],0),b=this.point([e,s],0),width=Math.abs(b.x-a.x),depth=Math.abs(b.z-a.z),height=spacing*5.2;
 const viewportW=this.el.clientWidth,viewportH=this.el.clientHeight,mobile=viewportW<=700;
 const compact=typeof document!=='undefined'&&document.body?.classList?.contains('exploded-demo');
 const relationshipCompact=compact&&document.body?.classList?.contains('guided')&&document.body?.classList?.contains('relationship-step');
 const safe=mobile?{left:compact?8:16,right:viewportW-(compact?8:16),top:compact?(relationshipCompact?134:90):viewportH<=700?275:Math.min(390,viewportH*.47),bottom:viewportH-(compact?100:viewportH<=700?160:210)}:{left:Math.min(395,viewportW*.32),right:viewportW-30,top:95,bottom:viewportH-150};
 if(safe.bottom-safe.top<110){safe.top=viewportH*.35;safe.bottom=viewportH-110;}
 const centerX=(safe.left+safe.right)/2,centerY=(safe.top+safe.bottom)/2;
 let min=new THREE.Vector3(Math.min(a.x,b.x)-spacing*(mobile ? .08 : 1.65),0,Math.min(a.z,b.z)),max=new THREE.Vector3(Math.max(a.x,b.x)+spacing*(mobile ? .08 : .15),(mobile?spacing*4.4:height)+Math.max(a.y,b.y),Math.max(a.z,b.z));
 let focusAvailable=false;const focusGroup=({satellite:this.satellite,water:this.water,references:this.references,story:this.storyGroup})[selected];
 if(focusGroup&&focusGroup.visible){this.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(focusGroup);if(!box.isEmpty()){min=box.min.clone();max=box.max.clone();const pad=Math.max(.04,max.distanceTo(min)*.045);min.addScalar(-pad);max.addScalar(pad);focusAvailable=true;}else this.onStatus('这一层没有可放大的实际几何，保留分层概览');}
 const target=min.clone().add(max).multiplyScalar(.5),aspect=viewportW/Math.max(1,viewportH),vfov=this.camera.fov*Math.PI/180,hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
 const direction=(focusAvailable?new THREE.Vector3(.25,1.25,1.1):mobile?new THREE.Vector3(1.35,.7,.18):new THREE.Vector3(.72,.7,1.35)).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
 const safeX=Math.max(.2,(safe.right-safe.left)/viewportW)*.92,safeY=Math.max(.15,(safe.bottom-safe.top)/viewportH)*.92;
 let distance=0;for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){const delta=new THREE.Vector3(x,y,z).sub(target),d=delta.dot(direction);distance=Math.max(distance,Math.abs(delta.dot(right))/(Math.tan(hfov/2)*safeX)+d,Math.abs(delta.dot(up))/(Math.tan(vfov/2)*safeY)+d);}
 const radius=min.distanceTo(max)/2,end=target.clone().addScaledVector(direction,distance);this.controls.maxDistance=Math.max(160,distance*1.3);this.camera.far=Math.max(150,distance+radius*3);this.camera.updateProjectionMatrix();
 // Put the entire stack in the map's visible rectangle, not behind the narration card.
 if(this.camera.setViewOffset)this.camera.setViewOffset(viewportW,viewportH,viewportW/2-centerX,viewportH/2-centerY,viewportW,viewportH);
 const start=this.camera.position.clone(),oldTarget=this.controls.target.clone(),begin=performance.now(),token=++this.flyToken;
 const duration=animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches?850:0;
 this.explodedFrame={spacing,distance,selected,focusAvailable,safeViewport:safe,target:target.toArray(),position:end.toArray(),radius};
 const tick=()=>{if(this.flyToken!==token)return;const t=duration?Math.min(1,(performance.now()-begin)/duration):1,ease=t*t*(3-2*t);this.camera.position.lerpVectors(start,end,ease);this.controls.target.lerpVectors(oldTarget,target,ease);this.controls.update();this.render();if(t<1)requestAnimationFrame(tick);};tick();
 this.explodedFrame={spacing,distance,selected,focusAvailable,safeViewport:safe,target:target.toArray(),position:end.toArray(),radius};
 return {explodedEffective:true,...this.explodedFrame};
};
TerrainView.prototype.hideExplodedPresentation=function(){
 this.flyToken=(this.flyToken||0)+1;this.setLayerPresentation({exploded:false,selected:null});
 if(!this.fallback){if(this.explodedFog!==undefined){this.scene.fog=this.explodedFog;delete this.explodedFog;}this.camera.clearViewOffset?.();this.controls.maxDistance=28;this.reset(this.mode==='2d');}
};

TerrainView.prototype.presentationOpacity=function(key){const p=this.layerPresentation;return (p?.layers?.[key]?.opacity??1)*(p?.selected&&p.selected!==key ? .22 : 1);};

TerrainView.prototype.updateExplodedLabels=function(){
 if(typeof document==='undefined'||!document.createElement||!this.el?.appendChild)return;
 const active=!!this.layerPresentation?.exploded&&!this.fallback&&this.mode!=='2d';
 if(!active){if(this.explodedLabelOverlay)this.explodedLabelOverlay.hidden=true;return;}
 if(!this.explodedLabelOverlay){const root=document.createElement('div');root.className='terrain-exploded-labels';root.setAttribute('aria-label','展开图层名称与资料日期');Object.assign(root.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'3',overflow:'hidden'});this.el.appendChild(root);this.explodedLabelOverlay=root;}
 const root=this.explodedLabelOverlay;root.hidden=false;root.replaceChildren();
 const w=this.el.clientWidth,h=this.el.clientHeight,mobile=w<=700,short=mobile&&h<=700;
 const safe=this.explodedFrame?.safeViewport||{left:mobile?16:Math.min(395,w*.32),right:w-25,top:mobile?220:95,bottom:h-160};
 if(mobile){
  const strip=document.createElement('div');Object.assign(strip.style,{position:'absolute',left:'8px',right:'8px',top:'61px',display:'flex',gap:'4px',justifyContent:'center'});root.appendChild(strip);
  const shortNames={satellite:'照片',water:'水面',references:'道路 / 地形',story:this.storyGroup?.userData?.statisticalPlane?'统计域平面':'候选解释'};const selected=this.layerPresentation?.selected;
  for(const a of this.explodedLabelAnchors||[]){const label=document.createElement('div');label.textContent=selected?a.text:shortNames[a.key];label.title=a.text;label.dataset.layer=a.key;Object.assign(label.style,{font:'12px/20px sans-serif',fontWeight:'600',color:'#173d32',background:'#fffef5',border:'1px solid #486f5e',borderRadius:'4px',padding:'1px 7px',whiteSpace:'nowrap'});strip.appendChild(label);}
  const note=document.createElement('div');note.textContent=selected?'单层放大 · 仍是原始图层；可返回概览':'分层仅为讲解，非真实高程；选一层可放大';Object.assign(note.style,{position:'absolute',left:'8px',right:'8px',bottom:'81px',textAlign:'center',font:'11px/16px sans-serif',color:'#173d32',background:'#fffef5',padding:'3px 5px',borderRadius:'3px'});root.appendChild(note);
  this.screenLabelSpec={fontPx:12,color:'#173d32',background:'#fffef5',safeViewport:safe,count:this.explodedLabelAnchors?.length||0,layout:'edge-strip'};return;
 }
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});root.appendChild(svg);
 const anchors=(this.explodedLabelAnchors||[]).map(a=>{const p=a.position.clone().project(this.camera);return {...a,x:(p.x+1)/2*w,y:(1-p.y)/2*h};}).sort((a,b)=>a.y-b.y);
 let previousY=safe.top-30;const gap=short?25:30;
 for(let i=0;i<anchors.length;i++){
  const a=anchors[i],y=Math.max(previousY+gap,Math.min(a.y,safe.bottom-45-(anchors.length-1-i)*gap));previousY=y;
  const label=document.createElement('div');label.textContent=a.text;label.title=a.text;label.dataset.layer=a.key;
  const x=safe.left+3;Object.assign(label.style,{position:'absolute',left:x+'px',top:(y-12)+'px',font:`${mobile?11:12}px/20px sans-serif`,fontWeight:'600',color:'#173d32',background:'#fffef5',border:'1px solid #486f5e',borderRadius:'4px',padding:'1px 7px',whiteSpace:'nowrap',boxShadow:'0 2px 5px #193a3026'});root.appendChild(label);
  const width=label.getBoundingClientRect().width||Math.min(160,a.text.length*8+14),endX=a.x<x?x:x+width;
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [k,v] of Object.entries({x1:endX,y1:y,x2:a.x,y2:a.y,stroke:'#365a4c','stroke-width':1.4,'stroke-dasharray':'4 3'}))line.setAttribute(k,String(v));svg.appendChild(line);
 }
 const note=document.createElement('div');note.textContent='层间距仅为讲解，不是真实高程或地下剖面';Object.assign(note.style,{position:'absolute',left:(safe.left+3)+'px',bottom:(h-safe.bottom+3)+'px',maxWidth:(safe.right-safe.left-6)+'px',font:'11px/16px sans-serif',color:'#173d32',background:'#fffef5',borderRadius:'3px',padding:'3px 6px'});root.appendChild(note);
 this.screenLabelSpec={fontPx:mobile?11:12,color:'#173d32',background:'#fffef5',safeViewport:safe,count:anchors.length};
};
