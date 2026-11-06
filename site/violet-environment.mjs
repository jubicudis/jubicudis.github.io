// One continuous Violet environment. Three.js owns depth, materials and illumination;
// authored SVGs supply the vector face and precise surface markings.
// No synthetic renderer, stand-in character, or success-shaped fallback is permitted.
import * as THREE from './vendor/three.module.js';

const PI2=Math.PI*2;
const BASE=[
  {color:0x19baf5,edge:0x80ecff,angle:-.49,tilt:.19,turn:-.23,a:2.26,b:1.42,z:-.18,phase:0},
  {color:0x934cf0,edge:0xf0aaff,angle:.44,tilt:-.28,turn:.28,a:2.19,b:1.49,z:-.13,phase:1.1},
  {color:0xf0a744,edge:0xffe29b,angle:-.11,tilt:.36,turn:.16,a:2.25,b:.82,z:-.12,phase:2.3},
  {color:0x7945dc,edge:0xe4b2ff,angle:.73,tilt:-.22,turn:-.32,a:1.75,b:1.91,z:.14,phase:3.4}
];
const LIMIT=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const TEMP_Z=new THREE.Vector3(0,0,1);
const EASE=x=>1-Math.pow(1-LIMIT(x,0,1),3);

function buildParam(def){
  const rot=new THREE.Euler(def.tilt,def.turn,def.angle,'XYZ');
  return t=>{
    const u=t*PI2;
    const point=new THREE.Vector3(
      Math.cos(u)*def.a,
      Math.sin(u)*def.b,
      .095*Math.sin(u*2+def.phase)
    );
    point.applyEuler(rot);point.z+=def.z;return point;
  };
}
function axes(curve,t){
  const delta=.0004;
  const tangent=curve((t+delta)%1).sub(curve((t-delta+1)%1)).normalize();
  // Broad structural material is oriented across the strand, not round rope.
  const across=new THREE.Vector3().crossVectors(TEMP_Z,tangent).normalize();
  const facing=new THREE.Vector3().crossVectors(tangent,across).normalize();
  return {tangent,across,facing};
}
function surfacePoint(curve,t,u,v){
  const p=curve(t),basis=axes(curve,t);
  return p.addScaledVector(basis.across,u).addScaledVector(basis.facing,v);
}
function makeRibbonGeometry(curve){
  const samples=196,w=.195,profile=[
    [-w+.042,.064],[w-.042,.064],[w,.028],[w,-.031],
    [w-.044,-.08],[-w+.044,-.08],[-w,-.031],[-w,.028]
  ];
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=samples;i++){
    const t=(i%samples)/samples;
    for(let j=0;j<profile.length;j++){
      const [u,v]=profile[j],p=surfacePoint(curve,t,u,v);
      positions.push(p.x,p.y,p.z);uv.push(t,j/profile.length);
    }
  }
  const ring=profile.length;
  for(let i=0;i<samples;i++)for(let j=0;j<ring;j++){
    const a=i*ring+j,b=i*ring+(j+1)%ring,c=(i+1)*ring+j,d=(i+1)*ring+(j+1)%ring;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function lineAt(curve,u,v,segments=240){
  const points=[];
  for(let i=0;i<=segments;i++)points.push(surfacePoint(curve,i/segments,u,v));
  return new THREE.BufferGeometry().setFromPoints(points);
}
function addBand(threeScene,def,index,markTexture){
  const movement=new THREE.Group();
  const curve=buildParam(def);
  const material=new THREE.MeshPhysicalMaterial({
    color:def.color,metalness:.38,roughness:.27,clearcoat:.9,
    clearcoatRoughness:.13,side:THREE.DoubleSide,
    emissive:def.color,emissiveIntensity:.115
  });
  const mesh=new THREE.Mesh(makeRibbonGeometry(curve),material);
  movement.add(mesh);
  const edgeMat=new THREE.LineBasicMaterial({color:def.edge,transparent:true,opacity:.86,depthTest:true});
  for(const u of [-.153,.153]){
    const edge=new THREE.Line(lineAt(curve,u,.077),edgeMat);
    movement.add(edge);
  }
  const innerMat=new THREE.LineBasicMaterial({color:0x201a59,transparent:true,opacity:.63});
  const seamMat=new THREE.LineBasicMaterial({color:0xd7b8ff,transparent:true,opacity:.42});
  for(let n=0;n<13;n++){
    const t=(n+.4)/13;
    const points=[];
    for(let j=0;j<=8;j++)points.push(surfacePoint(curve,t,-.154+.308*j/8,.076));
    movement.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),n%4===0?seamMat:innerMat));
  }
  const markMaterial=new THREE.MeshBasicMaterial({
    map:markTexture,color:def.edge,transparent:true,opacity:.88,
    depthWrite:false,side:THREE.DoubleSide,toneMapped:false
  });
  const patternPositions=index===2?[.09,.59]:[.12,.63,.87];
  for(const t of patternPositions){
    const {tangent,across,facing}=axes(curve,t);
    const p=surfacePoint(curve,t,0,.086);
    const m=new THREE.Matrix4().makeBasis(tangent,across,facing);
    const decal=new THREE.Mesh(new THREE.PlaneGeometry(.28,.108),markMaterial);
    decal.position.copy(p);decal.quaternion.setFromRotationMatrix(m);
    movement.add(decal);
  }
  threeScene.add(movement);
  return {movement,curve,material};
}
function radialTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');
  if(!ctx)throw new Error('Unable to create Violet illumination texture');
  const g=ctx.createRadialGradient(128,128,8,128,128,127);
  g.addColorStop(0,'rgba(198,115,255,.45)');
  g.addColorStop(.28,'rgba(113,62,210,.21)');
  g.addColorStop(1,'rgba(55,36,155,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;return tx;
}
async function svgTexture(url,mode){
  const response=await fetch(url,{cache:'force-cache'});
  if(!response.ok)throw new Error('Required Violet SVG unavailable: '+response.status+' '+url);
  let xml=await response.text();
  if(!xml.includes('<svg'))throw new Error('Invalid Violet SVG source: '+url);
  if(mode)xml=xml.replace('data-mode="rest"','data-mode="'+mode+'"');
  const blob=new Blob([xml],{type:'image/svg+xml'});
  const objectUrl=URL.createObjectURL(blob);
  const image=new Image();
  try{
    image.src=objectUrl;
    await new Promise((resolve,reject)=>{
      image.onload=resolve;
      image.onerror=()=>reject(new Error('Violet SVG decoding failed: '+url));
    });
    const canvas=document.createElement('canvas');
    canvas.width=640;canvas.height=String(url).includes('markings')?250:440;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('SVG vector texture canvas unavailable');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    return texture;
  }finally{URL.revokeObjectURL(objectUrl);}
}
function makeVisor(group,expressions){
  const shell=new THREE.Mesh(
    new THREE.SphereGeometry(1,80,56),
    new THREE.MeshPhysicalMaterial({
      color:0x10112a,metalness:.12,roughness:.38,
      clearcoat:.78,clearcoatRoughness:.29
    })
  );
  shell.position.z=.18;shell.scale.set(1.59,1.01,.46);
  group.add(shell);

  // Separate structural edge and light-catching contour.
  const contour=[];
  for(let i=0;i<=160;i++){
    const t=i/160*PI2;
    contour.push(new THREE.Vector3(1.565*Math.cos(t),.985*Math.sin(t),.54));
  }
  const bevel=new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(contour,true),160,.026,8,true),
    new THREE.MeshPhysicalMaterial({
      color:0x9456ec,emissive:0x8c3be1,emissiveIntensity:.36,
      metalness:.45,roughness:.19,clearcoat:1
    })
  );
  group.add(bevel);
  const face=new THREE.Mesh(
    new THREE.PlaneGeometry(3.05,2.08),
    new THREE.MeshBasicMaterial({
      map:expressions.rest,transparent:true,depthWrite:false,
      side:THREE.DoubleSide,toneMapped:false
    })
  );
  face.position.z=.676;
  group.add(face);
  const edgeLight=new THREE.PointLight(0xc183ff,1.5,4.4);
  edgeLight.position.set(-.45,-.34,1.32);group.add(edgeLight);
  const shadowGlow=new THREE.Mesh(
    new THREE.PlaneGeometry(3.8,2.65),
    new THREE.MeshBasicMaterial({map:radialTexture(),transparent:true,opacity:.17,depthWrite:false,blending:THREE.AdditiveBlending})
  );
  shadowGlow.position.z=-.3;group.add(shadowGlow);
  return {face,shell,bevel};
}
function makeStage(scene){
  const ground=new THREE.Group();
  ground.position.set(0,-2.43,-.82);scene.add(ground);
  const rings=[
    {a:2.35,b:.41,color:0x4c61d4,opacity:.35},
    {a:1.95,b:.315,color:0x35b9ff,opacity:.44},
    {a:1.34,b:.215,color:0xbe75fc,opacity:.37}
  ];
  for(const ring of rings){
    const points=[];
    for(let i=0;i<=160;i++){
      const t=i/160*PI2;
      points.push(new THREE.Vector3(ring.a*Math.cos(t),ring.b*Math.sin(t),0));
    }
    const geo=new THREE.BufferGeometry().setFromPoints(points);
    ground.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:ring.color,transparent:true,opacity:ring.opacity})));
  }
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({
    map:radialTexture(),transparent:true,opacity:.33,depthWrite:false,
    blending:THREE.AdditiveBlending
  }));
  halo.position.set(0,-2.35,-1.65);halo.scale.set(6.4,2.3,1);scene.add(halo);
  // Sparse stage points: environmental depth, not fake TNOS telemetry.
  const dots=[];
  for(let i=0;i<54;i++){
    const a=Math.sin((i+1)*83.194)*218.72;
    const b=Math.sin((i+1)*117.441)*94.83;
    const x=(a-Math.floor(a))*11-5.5;
    const y=(b-Math.floor(b))*10-5;
    dots.push(x,y,-5.5);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(dots,3));
  scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({
    color:0x8384da,size:.027,transparent:true,opacity:.32,depthWrite:false
  })));
}

function sampleFrame(renderer,canvas){
  const gl=renderer.getContext();
  if(gl.isContextLost())return null;
  const pixels=new Uint8Array(4);
  let bright=false;
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
    // The local, pinned Three.js module must initialize. No canvas imitation is substituted.
    renderer=new THREE.WebGLRenderer({
      canvas,antialias:true,alpha:false,powerPreference:'high-performance',
      preserveDrawingBuffer:false
    });
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.24;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    const expressions={};
    const faceURL=new URL('./violet-face.svg',import.meta.url);
    const markURL=new URL('./violet-markings.svg',import.meta.url);
    const [rest,ask,talk,blink,mark]=await Promise.all([
      svgTexture(faceURL,'rest'),svgTexture(faceURL,'ask'),svgTexture(faceURL,'talk'),
      svgTexture(faceURL,'blink'),svgTexture(markURL)
    ]);
    Object.assign(expressions,{rest,ask,talk,blink});

    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x080c1e);
    const camera=new THREE.OrthographicCamera(-3,3,6,-6,.1,50);
    camera.position.set(0,0,15);camera.lookAt(0,0,0);
    scene.add(new THREE.AmbientLight(0xaaa5e9,.92));
    const key=new THREE.DirectionalLight(0xf1e9ff,2.5);key.position.set(-4,5,8);scene.add(key);
    const cyan=new THREE.PointLight(0x31baff,34,12);cyan.position.set(-4,1.7,3.8);scene.add(cyan);
    const pink=new THREE.PointLight(0xd46dff,29,12);pink.position.set(3,1.1,3.9);scene.add(pink);
    const gold=new THREE.PointLight(0xffad55,25,10);gold.position.set(1.8,-2.2,3.2);scene.add(gold);

    makeStage(scene);
    const body=new THREE.Group();scene.add(body);body.position.y=.53;
    const bands=BASE.map((def,i)=>addBand(body,def,i,mark));
    const visor=makeVisor(body,expressions);
    let state={phase:'dormant',speaking:false};
    let observed=false,failed=false,live=true,frames=0;
    let previousExpression='';
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const clock=performance.now();
    const resize=()=>{
      const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
      const aspect=w/h,worldWidth=w<=620?5.72:LIMIT(aspect*7.1,7.1,11.1);
      const worldHeight=worldWidth/aspect;
      camera.left=-worldWidth/2;camera.right=worldWidth/2;
      camera.top=worldHeight/2;camera.bottom=-worldHeight/2;
      camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    };
    resize();
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
    const loss=event=>{
      event.preventDefault();
      if(!failed){failed=true;live=false;onFailure?.(new Error('Violet WebGL context lost'));}
    };
    canvas.addEventListener('webglcontextlost',loss);
    function tick(now){
      if(!live)return;
      const t=(now-clock)/1000,phase=reduced.matches?0:t;
      for(let i=0;i<bands.length;i++){
        const band=bands[i],def=BASE[i];
        // Elements remain coupled: common breathing with smaller independent responses.
        const breathe=.012*Math.sin(phase*.65);
        const individual=.019*Math.sin(phase*(.42+i*.045)+def.phase);
        band.movement.rotation.z=breathe+individual;
        band.movement.rotation.x=.008*Math.sin(phase*.51+i);
        const scale=1+.006*Math.sin(phase*.73+i*.9);
        band.movement.scale.setScalar(scale);
      }
      body.position.y=.53+(reduced.matches?0:.035*Math.sin(phase*.73));
      body.rotation.z=reduced.matches?0:.011*Math.sin(phase*.4);
      const expression=state.speaking&&Math.sin(phase*8)>-.12?'talk':
        !reduced.matches&&Math.sin(phase*.47+1.1)>.997?'blink':
        state.phase==='asking-name'&&!state.speaking?'ask':'rest';
      if(expression!==previousExpression){
        visor.face.material.map=expressions[expression];
        visor.face.material.needsUpdate=true;previousExpression=expression;
      }
      renderer.render(scene,camera);
      frames++;
      if(!observed&&frames>1){
        const proof=sampleFrame(renderer,canvas);
        if(proof){observed=true;onObserved?.({type:'webgl-pixel-observed',...proof});}
      }
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
