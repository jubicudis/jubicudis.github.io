// Violet — Structured Bloom (A2). Persistent, animated, source-grounded website character.
// Three.js renders interwoven volumetric structural bands and a shallow inset visor.
// Authored SVGs render expressions and small inlaid accents. This does not execute TNOS.
// No replacement avatar, fake draw-success state, or automatic presentation is provided.
import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const DARK = new THREE.Color(0x0b0c27);
const WHITE = new THREE.Color(0xf7edff);
const FRONT = new THREE.Vector3(0, 0, 1);

// Four deliberately different closed, three-dimensional paths. They share a center,
// but are not concentric tilted ellipses. Control points preserve the A2 composition:
// cyan high at the back and below the face, purple sweeping across the forehead,
// amber behind and to the right, and a deep-violet structural loop behind them.
const FORMS = [
  {name:'azure', base:0x159af5, light:0xa4f5ff, edge:0x56e4ff, shadow:0x102f9b, width:.32, seed:.14,
    knots:[[-2.22,.46,-.38],[-2.35,1.46,-.32],[-1.56,2.08,-.39],[-.28,2.19,-.43],[1.03,1.75,-.16],[1.74,.66,-.35],[1.31,-.58,-.33],[.88,-1.55,1.00],[.12,-2.05,1.20],[-.87,-1.90,.72],[-1.42,-.91,-.34],[-1.65,-.08,-.45]]},
  {name:'violet-crown', base:0x9540ed, light:0xf0a9ff, edge:0xe29cff, shadow:0x4313a3, width:.34, seed:1.22,
    knots:[[-2.56,-1.16,1.40],[-2.45,-.13,1.53],[-1.73,.92,1.60],[-.63,1.57,1.36],[.65,1.70,1.10],[1.72,1.42,.77],[2.29,.64,.12],[2.13,-.55,-.47],[1.12,-1.43,-.69],[-.38,-1.86,-.79],[-1.64,-1.75,-.25]]},
  {name:'amber', base:0xf9a43d, light:0xfff0a1, edge:0xffcc6c, shadow:0x8d3576, width:.295, seed:2.30,
    knots:[[-2.47,-.13,-.78],[-2.52,.82,-.82],[-1.88,1.69,-.86],[-.66,1.69,-1.10],[.65,1.17,-1.13],[1.79,.54,-.77],[2.52,-.18,-.09],[2.43,-1.10,.47],[1.35,-1.34,.56],[.17,-1.05,-.45],[-1.25,-.70,-.91]]},
  {name:'violet-chassis', base:0x733bd1, light:0xdab0ff, edge:0xb077ff, shadow:0x25115f, width:.27, seed:3.47,
    knots:[[1.43,2.01,-.87],[2.22,1.50,-.63],[2.45,.42,-.96],[2.08,-.61,-1.12],[.78,-1.58,-1.12],[-.61,-1.75,-.91],[-1.87,-1.24,-.77],[-2.18,-.23,-.77],[-1.53,.89,-1.0],[-.19,1.58,-1.12]]}
];

function colored(r,g,b){return new THREE.Color(r,g,b);}
function pathGeometry(points){return new THREE.BufferGeometry().setFromPoints(points);}
function curveFor(form){return new THREE.CatmullRomCurve3(form.knots.map(p=>new THREE.Vector3(...p)),true,'centripetal');}
function frameAt(curve,t){
  const tangent=curve.getTangentAt(t).normalize();
  // Stabilized camera-facing band frame: the front face has a gentle crown, and
  // actual path Z supplies the depth-order changes, not painter's-order guesses.
  const facing=new THREE.Vector3(-.075*tangent.y,.075*tangent.x,1).normalize();
  const across=new THREE.Vector3().crossVectors(facing,tangent).normalize();
  return {tangent,across,facing};
}
function bandPoint(curve,t,widthAt,normalAt){
  const p=curve.getPointAt((t+1)%1),f=frameAt(curve,t);
  return p.addScaledVector(f.across,widthAt).addScaledVector(f.facing,normalAt);
}
function bandGradient(form,t,u){
  const base=new THREE.Color(form.base), hi=new THREE.Color(form.light), deep=new THREE.Color(form.shadow);
  const rim=Math.pow(Math.abs(u),2.65), shine=Math.pow(Math.max(0,1-Math.abs(u+.56)/.29),2);
  const travel=.12*Math.sin(TAU*(t*1.6+form.seed));
  return base.clone().lerp(deep,.19+.20*(1-rim)).lerp(hi,clamp(.17+rim*.66+shine*.24+travel,0,.87));
}
function ribbonGeometry(curve,form,{widthScale=1,depth=0}={}){
  const n=232,sections=9,positions=[],colors=[],indices=[],half=form.width*widthScale;
  for(let i=0;i<=n;i++){
    const t=i/n, point=curve.getPointAt(t),fr=frameAt(curve,t);
    for(let j=0;j<sections;j++){
      const u=(j/(sections-1)*2-1);
      const width=half*u;
      const crown=(1-u*u)*.075;
      const p=point.clone().addScaledVector(fr.across,width).addScaledVector(fr.facing,crown+depth);
      positions.push(p.x,p.y,p.z);
      const col=bandGradient(form,t,u);colors.push(col.r,col.g,col.b);
    }
  }
  for(let i=0;i<n;i++)for(let j=0;j<sections-1;j++){
    const a=i*sections+j,b=a+1,c=a+sections,d=c+1;
    indices.push(a,b,c,b,d,c);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function lineGeometry(curve,form,fraction=1,height=.07,t0=0,t1=1){
  const points=[],count=Math.ceil(200*(t1-t0));
  for(let i=0;i<=count;i++)points.push(bandPoint(curve,t0+(t1-t0)*i,form.width*fraction,height));
  return pathGeometry(points);
}
function surfacePanel(curve,form,t0,t1){
  const vertices=[],indices=[],colors=[],steps=9,across=5;
  const base=new THREE.Color(form.shadow),accent=new THREE.Color(form.base);
  for(let i=0;i<=steps;i++){
    const t=t0+(t1-t0)*i/steps;
    const endSpace=.17*Math.pow(Math.abs(i/steps*2-1),4);
    for(let j=0;j<=across;j++){
      const u=(j/across*2-1)*(.76-endSpace);
      const p=bandPoint(curve,t,form.width*u,.084-(u*u)*.022);
      vertices.push(p.x,p.y,p.z);
      const col=base.clone().lerp(accent,.20+.24*(1-Math.abs(u)));colors.push(col.r,col.g,col.b);
    }
  }
  for(let i=0;i<steps;i++)for(let j=0;j<across;j++){
    const a=i*(across+1)+j,b=a+1,c=a+across+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function contourPatch(curve,form,t0,t1){
  const a=[],b=[],count=30;
  for(let i=0;i<=count;i++){
    const t=t0+(t1-t0)*i/count;
    const inset=.22*Math.pow(Math.abs(i/count*2-1),6);
    a.push(bandPoint(curve,t,form.width*(.76-inset),.101));
    b.push(bandPoint(curve,t,-form.width*(.76-inset),.101));
  }
  return [...a,...b.reverse(),a[0]];
}
function addRibbon(owner,form,index,markTexture){
  const ribbon=new THREE.Group();owner.add(ribbon);
  const curve=curveFor(form);
  const material=new THREE.MeshPhysicalMaterial({vertexColors:true,metalness:.13,roughness:.28,clearcoat:1,clearcoatRoughness:.11,
    side:THREE.DoubleSide,emissive:new THREE.Color(form.base),emissiveIntensity:.28});
  ribbon.add(new THREE.Mesh(ribbonGeometry(curve,form),material));
  // An actual bevel and translucent light bleed, rather than flat contour strokes.
  const glow=new THREE.Mesh(ribbonGeometry(curve,form,{widthScale:1.26,depth:-.018}),
    new THREE.MeshBasicMaterial({color:form.base,transparent:true,opacity:.16,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
  ribbon.add(glow);
  const shadowedge=new THREE.LineBasicMaterial({color:form.shadow,transparent:true,opacity:.5});
  const rim=new THREE.LineBasicMaterial({color:form.edge,transparent:true,opacity:.94});
  const highlight=new THREE.LineBasicMaterial({color:form.light,transparent:true,opacity:.77});
  for(const sign of [-1,1]){
    ribbon.add(new THREE.Line(lineGeometry(curve,form,sign*.99,-.018),shadowedge));
    ribbon.add(new THREE.Line(lineGeometry(curve,form,sign*.96,.052),rim));
    if(sign<0)ribbon.add(new THREE.Line(lineGeometry(curve,form,sign*.77,.084),highlight));
  }
  // Long contoured inlaid panels, not thirteen evenly spaced transverse notches.
  const panelFill=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.31,side:THREE.DoubleSide,depthWrite:false});
  const panelLine=new THREE.LineBasicMaterial({color:form.light,transparent:true,opacity:.41,depthWrite:false});
  for(let i=0;i<10;i++){
    const t0=(i+.15)/10,t1=(i+.90)/10;
    ribbon.add(new THREE.Mesh(surfacePanel(curve,form,t0,t1),panelFill));
    ribbon.add(new THREE.Line(pathGeometry(contourPatch(curve,form,t0,t1)),panelLine));
  }
  // Authored SVG slashes are an additional material detail; never the body itself.
  const stamps=index===2?[.18,.79]:index===3?[.12,.62]:[.12,.57,.82];
  const markerMaterial=new THREE.MeshBasicMaterial({map:markTexture,transparent:true,opacity:.9,
    depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  for(const t of stamps){
    const {tangent,across,facing}=frameAt(curve,t);
    const m=new THREE.Matrix4().makeBasis(tangent,across,facing);
    const marker=new THREE.Mesh(new THREE.PlaneGeometry(.28,.105),markerMaterial);
    marker.position.copy(bandPoint(curve,t,0,.115));
    marker.quaternion.setFromRotationMatrix(m);ribbon.add(marker);
  }
  return ribbon;
}
function glowTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Violet illumination canvas unavailable');
  const g=ctx.createRadialGradient(128,128,0,128,128,126);
  g.addColorStop(0,'rgba(196,95,255,.45)');g.addColorStop(.4,'rgba(109,41,193,.17)');g.addColorStop(1,'rgba(109,41,193,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;return tx;
}
async function svgTexture(url,mode){
  const response=await fetch(url,{cache:'force-cache'});
  if(!response.ok)throw new Error('Required Violet SVG unavailable: '+response.status+' '+url);
  let xml=await response.text();if(!xml.includes('<svg'))throw new Error('Invalid Violet SVG: '+url);
  if(mode)xml=xml.replace('data-mode="rest"','data-mode="'+mode+'"');
  const blob=new Blob([xml],{type:'image/svg+xml'}),objectURL=URL.createObjectURL(blob);
  const image=new Image();
  try{
    image.src=objectURL;
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Violet SVG decoding failed: '+url));});
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=String(url).includes('markings')?250:440;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Required Violet SVG texture canvas unavailable');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    return texture;
  }finally{URL.revokeObjectURL(objectURL);}
}
function makeVisor(owner,expressions){
  const group=new THREE.Group();group.position.set(.10,.10,.75);group.rotation.z=-.075;owner.add(group);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1,88,64),
    new THREE.MeshPhysicalMaterial({color:0x0b0824,emissive:0x190f3d,emissiveIntensity:.13,
      roughness:.82,metalness:0,clearcoat:.16,clearcoatRoughness:.72}));
  shell.scale.set(1.56,.99,.37);group.add(shell);
  const points=[];for(let i=0;i<=192;i++){
    const t=i/192*TAU;
    points.push(new THREE.Vector3(1.565*Math.cos(t),.985*Math.sin(t),.155+.06*(1+Math.cos(t))));
  }
  const contour=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),192,.020,8,true),
    new THREE.MeshBasicMaterial({color:0xc06bff}));group.add(contour);
  const inset=new THREE.Mesh(new THREE.PlaneGeometry(3.22,2.12),
    new THREE.MeshBasicMaterial({map:expressions.rest,transparent:true,depthWrite:false,
      toneMapped:false,side:THREE.DoubleSide}));
  inset.position.z=.414;group.add(inset);
  const ambient=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,opacity:.26,
    depthWrite:false,blending:THREE.AdditiveBlending}));
  ambient.position.z=-.19;ambient.scale.set(4.0,2.8,1);group.add(ambient);
  return {inset,group};
}
function makeStage(scene){
  const ground=new THREE.Group();ground.position.set(0,-2.58,-.72);scene.add(ground);
  for(const [a,b,col,alpha] of [[2.65,.35,0x5a3dc5,.45],[2.25,.26,0x3dd5ff,.66],[1.67,.19,0xb46cff,.47]]){
    const points=[];for(let i=0;i<=192;i++){const t=i/192*TAU;points.push(new THREE.Vector3(a*Math.cos(t),b*Math.sin(t),0));}
    ground.add(new THREE.Line(pathGeometry(points),new THREE.LineBasicMaterial({color:col,transparent:true,opacity:alpha})));
  }
  const shadow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,opacity:.35,
    depthWrite:false,blending:THREE.AdditiveBlending}));
  shadow.position.set(0,-2.42,-1.5);shadow.scale.set(6.5,2.2,1);scene.add(shadow);
  const coords=[];for(let i=0;i<54;i++){
    const a=Math.sin((i+1)*83.194)*218.72,b=Math.sin((i+1)*117.441)*94.83;
    coords.push((a-Math.floor(a))*11-5.5,(b-Math.floor(b))*10-5,-5.5);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:0x9291d9,size:.023,transparent:true,opacity:.32,depthWrite:false})));
}
function sampleFrame(renderer,canvas){
  const gl=renderer.getContext();if(gl.isContextLost())return null;
  const pixels=new Uint8Array(4);let bright=false;
  for(const [x,y] of [[.5,.5],[.6,.5],[.4,.5],[.5,.6],[.65,.6],[.35,.4]]){
    gl.readPixels(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    if(pixels[0]>30||pixels[1]>48||pixels[2]>85){bright=true;break;}
  }
  return bright&&renderer.info.render.calls>10?{drawCalls:renderer.info.render.calls,nonBackgroundPixel:true}:null;
}
export async function createVioletEnvironment(canvas,{onObserved,onFailure}={}){
  let renderer;
  try{
    if(!canvas||!(canvas instanceof HTMLCanvasElement))throw new Error('Required Violet canvas is missing');
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.28;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    const faceURL=new URL('./violet-face.svg',import.meta.url),markURL=new URL('./violet-markings.svg',import.meta.url);
    const [rest,ask,talk,blink,mark]=await Promise.all([
      svgTexture(faceURL,'rest'),svgTexture(faceURL,'ask'),svgTexture(faceURL,'talk'),svgTexture(faceURL,'blink'),svgTexture(markURL)
    ]);
    const expressions={rest,ask,talk,blink};
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b1d);
    const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,50);
    camera.position.set(0,0,15);camera.lookAt(0,0,0);
    scene.add(new THREE.AmbientLight(0xc5aaf1,1.04));
    const key=new THREE.DirectionalLight(0xece6ff,3.6);key.position.set(-3.1,4.5,6);scene.add(key);
    const cyan=new THREE.PointLight(0x4ad5ff,37,10);cyan.position.set(-3,1.9,3.8);scene.add(cyan);
    const lilac=new THREE.PointLight(0xf286ff,34,10);lilac.position.set(2.6,1.2,3.8);scene.add(lilac);
    const gold=new THREE.PointLight(0xffbb69,28,9);gold.position.set(1.8,-1.5,3);scene.add(gold);
    makeStage(scene);
    const body=new THREE.Group();body.position.y=.38;scene.add(body);
    const bands=FORMS.map((form,i)=>addRibbon(body,form,i,mark));
    const visor=makeVisor(body,expressions);
    let state={phase:'dormant',speaking:false},observed=false,failed=false,live=true,frames=0,previousExpression='';
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),clock=performance.now();
    const resize=()=>{
      const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),aspect=w/h;
      const worldWidth=w<=620?6.9:clamp(aspect*7.35,8.3,12.2),worldHeight=worldWidth/aspect;
      camera.left=-worldWidth/2;camera.right=worldWidth/2;camera.top=worldHeight/2;camera.bottom=-worldHeight/2;
      camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    };
    resize();const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
    const loss=event=>{event.preventDefault();if(!failed){failed=true;live=false;onFailure?.(new Error('Violet WebGL context lost'));}};
    canvas.addEventListener('webglcontextlost',loss);
    function tick(now){
      if(!live)return;
      const t=(now-clock)/1000,phase=reduced.matches?0:t;
      for(let i=0;i<bands.length;i++){
        const form=FORMS[i],band=bands[i];
        // Shared breathing + constrained independent responses; one cohesive body.
        const breathe=.009*Math.sin(phase*.65),individual=.014*Math.sin(phase*(.38+.045*i)+form.seed);
        band.rotation.z=breathe+individual;
        band.rotation.x=.007*Math.sin(phase*.52+i*1.6);
        band.scale.setScalar(1+.005*Math.sin(phase*.72+form.seed));
      }
      body.position.y=.38+(reduced.matches?0:.028*Math.sin(phase*.77));
      body.rotation.z=reduced.matches?0:.009*Math.sin(phase*.43);
      const expression=state.speaking&&Math.sin(phase*8)>-.12?'talk':
        !reduced.matches&&Math.sin(phase*.47+1.1)>.997?'blink':
        state.phase==='asking-name'&&!state.speaking?'ask':'rest';
      if(expression!==previousExpression){visor.inset.material.map=expressions[expression];visor.inset.material.needsUpdate=true;previousExpression=expression;}
      renderer.render(scene,camera);frames++;
      if(!observed&&frames>1){const proof=sampleFrame(renderer,canvas);if(proof){observed=true;onObserved?.({type:'webgl-pixel-observed',...proof});}}
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {
      update(next){state=next;},
      dispose(){live=false;resizeObserver.disconnect();canvas.removeEventListener('webglcontextlost',loss);scene.traverse(o=>{o.geometry?.dispose();});renderer.dispose();},
      get observed(){return observed&&!failed;}
    };
  }catch(error){renderer?.dispose();onFailure?.(error);throw error;}
}