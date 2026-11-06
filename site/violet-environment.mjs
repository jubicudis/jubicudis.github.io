// Violet, Structured Bloom A2: the inventor-selected visual design is the authoritative
// appearance. A Three.js scene displays its artwork as a layered, animated material;
// SVGs provide independently changeable facial expressions and micro-detail.
// This opening scene is NOT TNOS cognition or a completed 3D soft-body simulation.
// If any required art or WebGL rendering fails, no replacement character is fabricated.
import * as THREE from './vendor/three.module.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function createGlowTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Violet glow surface unavailable');
  const gradient=ctx.createRadialGradient(128,128,4,128,128,125);
  gradient.addColorStop(0,'rgba(135,72,235,.35)');
  gradient.addColorStop(.58,'rgba(63,36,173,.10)');
  gradient.addColorStop(1,'rgba(63,36,173,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
async function loadRequiredImage(url,label){
  const response=await fetch(url,{cache:'force-cache'});
  if(!response.ok)throw new Error('Required Violet '+label+' unavailable: '+response.status);
  const blob=await response.blob();
  const objectUrl=URL.createObjectURL(blob);
  const image=new Image();
  try{
    image.src=objectUrl;
    await new Promise((resolve,reject)=>{
      image.onload=resolve;
      image.onerror=()=>reject(new Error('Required Violet '+label+' could not be decoded'));
    });
    if(image.naturalWidth===0||image.naturalHeight===0)throw new Error('Invalid '+label+' dimensions');
    return image;
  }finally{URL.revokeObjectURL(objectUrl);}
}
async function svgTexture(url,mode){
  const response=await fetch(url,{cache:'force-cache'});
  if(!response.ok)throw new Error('Required Violet SVG unavailable: '+response.status+' '+url);
  let xml=await response.text();
  if(!xml.includes('<svg'))throw new Error('Invalid Violet SVG: '+url);
  xml=xml.replace('data-mode="rest"','data-mode="'+mode+'"');
  const blob=new Blob([xml],{type:'image/svg+xml'});
  const objectURL=URL.createObjectURL(blob);
  const image=new Image();
  try{
    image.src=objectURL;
    await new Promise((resolve,reject)=>{
      image.onload=resolve;
      image.onerror=()=>reject(new Error('Violet expression SVG decoding failed'));
    });
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=440;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Violet expression texture canvas unavailable');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    return texture;
  }finally{URL.revokeObjectURL(objectURL);}
}
function textureFromImage(image){
  const texture=new THREE.Texture(image);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  texture.needsUpdate=true;
  return texture;
}
function addBackground(scene){
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({
    map:createGlowTexture(),transparent:true,opacity:.34,depthWrite:false,
    blending:THREE.AdditiveBlending
  }));
  glow.scale.set(9.4,7.0,1);glow.position.set(0,0,-1.2);scene.add(glow);
  const stars=[];
  for(let i=0;i<45;i++){
    const x=Math.sin((i+1)*117.441)*291.82;
    const y=Math.sin((i+1)*91.17)*351.57;
    stars.push((x-Math.floor(x))*13-6.5,(y-Math.floor(y))*14-7,-2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({
    color:0xa18ce7,size:.024,transparent:true,opacity:.20,depthWrite:false
  })));
}
function observedFrame(renderer,canvas){
  const gl=renderer.getContext();
  if(gl.isContextLost())return null;
  const pixel=new Uint8Array(4);
  // Sampling the rendered character area, not an empty corner or a DOM layout declaration.
  let saturated=0;
  for(const [x,y] of [[.50,.50],[.43,.50],[.58,.50],[.48,.57],[.40,.43],[.63,.56],[.54,.38]]){
    gl.readPixels(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    if(Math.max(pixel[0],pixel[1],pixel[2])-Math.min(pixel[0],pixel[1],pixel[2])>24&&Math.max(pixel[0],pixel[1],pixel[2])>50)saturated++;
  }
  if(saturated>=2&&renderer.info.render.calls>=2)
    return {type:'webgl-pixel-observed',drawCalls:renderer.info.render.calls,nonBackgroundPixel:true};
  return null;
}
export async function createVioletEnvironment(canvas,{onObserved,onFailure,onPresenceObserved}={}){
  let renderer;
  try{
    if(!canvas||!(canvas instanceof HTMLCanvasElement))throw new Error('Required Violet WebGL canvas is missing');
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.NoToneMapping; // keep reference artwork colorimetry, no pastel wash-out
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    const artworkURL=new URL('./violet-a2-art.webp',import.meta.url);
    const faceURL=new URL('./violet-face.svg',import.meta.url);
    const [art,rest,ask,talk,blink,close]=await Promise.all([
      loadRequiredImage(artworkURL,'Structured Bloom artwork'),
      svgTexture(faceURL,'rest'),svgTexture(faceURL,'ask'),
      svgTexture(faceURL,'talk'),svgTexture(faceURL,'blink'),svgTexture(faceURL,'close')
    ]);
    // The art is an authored material of the selected character, not a substitute
    // if a procedural renderer fails. Its presence and decoding are required.
    const faces={rest,ask,talk,blink,close};
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b1d);
    const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,50);
    camera.position.set(0,0,8);camera.lookAt(0,0,0);
    addBackground(scene);
    const character=new THREE.Group();scene.add(character);
    const artWidth=6.65,artHeight=artWidth*art.naturalHeight/art.naturalWidth;
    const main=new THREE.Mesh(new THREE.PlaneGeometry(artWidth,artHeight),new THREE.MeshBasicMaterial({
      map:textureFromImage(art),transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide
    }));
    character.add(main);
    // The original A2 body and its lighting remain intact; the SVG layer alone
    // controls the expression, so the character can speak without a separate face.
    const artPixelToWorld=artWidth/art.naturalWidth;
    const faceCenterX=517,faceCenterY=320;
    const expression=new THREE.Mesh(new THREE.PlaneGeometry(475*artPixelToWorld,326*artPixelToWorld),
      new THREE.MeshBasicMaterial({map:rest,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    expression.position.set((faceCenterX-art.naturalWidth/2)*artPixelToWorld,
      (art.naturalHeight/2-faceCenterY)*artPixelToWorld,.05);
    character.add(expression);

    // The approved A2 artwork is never altered: it remains the sole full-presence
    // body. This small, featureless face-shaped node exists ONLY for recall.
    const marker=new THREE.Group();
    marker.position.set(expression.position.x,expression.position.y,.14);
    const markerCore=new THREE.Mesh(
      new THREE.CircleGeometry(1,96),
      new THREE.MeshBasicMaterial({color:0x1e103a,transparent:true,opacity:0,depthWrite:false,toneMapped:false})
    );
    markerCore.scale.set(.87,.57,1);
    marker.add(markerCore);
    const outlinePoints=[];
    for(let i=0;i<=112;i++){
      const a=i/112*Math.PI*2;
      outlinePoints.push(new THREE.Vector3(.88*Math.cos(a),.58*Math.sin(a),.026));
    }
    const markerOutline=new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
      new THREE.LineBasicMaterial({color:0x9d60dc,transparent:true,opacity:0,depthWrite:false})
    );
    marker.add(markerOutline);
    const markerHalo=new THREE.Sprite(new THREE.SpriteMaterial({
      map:createGlowTexture(),transparent:true,opacity:0,depthWrite:false,
      blending:THREE.AdditiveBlending
    }));
    markerHalo.position.z=-.04;markerHalo.scale.set(2.3,1.7,1);
    marker.add(markerHalo);
    character.add(marker);

    let state={phase:'dormant',speaking:false,presence:'full',presenceToken:0},
      live=true,observed=false,failed=false,frameCount=0,previousExpression='';
    let presenceCycle=-1,presenceStarted=0,presenceReported=-1;
    const markerPixel=new Uint8Array(4);
    function markerObserved(){
      const gl=renderer.getContext();
      if(gl.isContextLost()||renderer.info.render.calls<2)return false;
      const p=marker.getWorldPosition(new THREE.Vector3()).project(camera);
      const x=clamp(Math.floor((p.x+1)*canvas.width*.5),0,canvas.width-1);
      const y=clamp(Math.floor((p.y+1)*canvas.height*.5),0,canvas.height-1);
      gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,markerPixel);
      return markerPixel[0]>16&&markerPixel[2]>34;
    }
    const start=performance.now(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const resize=()=>{
      const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight),aspect=width/height;
      const worldWidth=width<=620?7.25:clamp(aspect*7.25,8.0,13.1);
      const worldHeight=worldWidth/aspect;
      camera.left=-worldWidth/2;camera.right=worldWidth/2;
      camera.top=worldHeight/2;camera.bottom=-worldHeight/2;
      camera.updateProjectionMatrix();renderer.setSize(width,height,false);
    };
    resize();const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
    const loss=event=>{event.preventDefault();if(!failed){failed=true;live=false;onFailure?.(new Error('Violet WebGL context lost'));}};
    canvas.addEventListener('webglcontextlost',loss);
    function frame(now){
      if(!live)return;
      const t=reduced.matches?0:(now-start)/1000;
      if(state.presenceToken!==presenceCycle){
        presenceCycle=state.presenceToken;presenceStarted=now;
      }
      const presenceProgress=reduced.matches?1:clamp((now-presenceStarted)/660,0,1);
      let fullOpacity=1,markerOpacity=0;
      if(state.presence==='receding'){
        fullOpacity=1-presenceProgress;markerOpacity=presenceProgress;
      }else if(state.presence==='marker'){
        fullOpacity=0;markerOpacity=1;
      }else if(state.presence==='returning'){
        fullOpacity=presenceProgress;markerOpacity=1-presenceProgress;
      }
      main.material.opacity=fullOpacity;
      expression.material.opacity=fullOpacity;
      markerCore.material.opacity=markerOpacity*.82;
      markerOutline.material.opacity=markerOpacity*.65;
      markerHalo.material.opacity=markerOpacity*.16;
      character.position.y=reduced.matches?0:.038*Math.sin(t*.7);
      character.rotation.z=reduced.matches?0:.008*Math.sin(t*.39);
      const expansion=1+(reduced.matches?0:.004*Math.sin(t*.74));
      character.scale.setScalar(expansion);
      const mode=state.presence==='receding'||state.presence==='marker'?'close':
        state.presence==='returning'&&presenceProgress<.36?'close':
        state.speaking&&Math.sin(t*8.6)>-.16?'talk':
        !reduced.matches&&Math.sin(t*.49+.8)>.998?'blink':
        state.phase==='asking-name'&&!state.speaking?'ask':'rest';
      if(mode!==previousExpression){expression.material.map=faces[mode];expression.material.needsUpdate=true;previousExpression=mode;}
      renderer.render(scene,camera);frameCount++;
      // A requested transition is not a completed one. Observe the actual
      // WebGL frame before acknowledging the settled marker or restored form.
      if(presenceReported!==state.presenceToken&&presenceProgress>=1&&observed){
        const token=state.presenceToken;
        if(state.presence==='receding'&&markerObserved()){
          presenceReported=token;
          onPresenceObserved?.({type:'PRESENCE_RECEDING_OBSERVED',token,
            evidence:{type:'webgl-marker-observed',pixelObserved:true}});
        }else if(state.presence==='returning'&&observedFrame(renderer,canvas)){
          presenceReported=token;
          onPresenceObserved?.({type:'PRESENCE_RETURN_OBSERVED',token,
            evidence:{type:'webgl-character-observed',pixelObserved:true}});
        }
      }
      if(!observed&&frameCount>1){
        const evidence=observedFrame(renderer,canvas);
        if(evidence){observed=true;onObserved?.(evidence);}
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return {
      update(next){state=next;},
      dispose(){live=false;resizeObserver.disconnect();canvas.removeEventListener('webglcontextlost',loss);
        scene.traverse(o=>{o.geometry?.dispose();});renderer.dispose();},
      get observed(){return observed&&!failed;}
    };
  }catch(error){console.error('Violet required render failed',error);renderer?.dispose();onFailure?.(error);throw error;}
}