// Violet, Structured Bloom A2: the inventor-selected visual design is the authoritative
// appearance. A Three.js scene displays its artwork as a layered, animated material;
// SVGs provide independently changeable facial expressions and micro-detail.
// This opening scene is NOT TNOS cognition or a completed 3D soft-body simulation.
// If any required art or WebGL rendering fails, no replacement character is fabricated.
import * as THREE from './vendor/three.module.js?v=20261106-webkit-precision-01';
import {createVioletAppearanceCapabilities} from './violet-appearance.mjs';
import {A2_FACEPLATE,createA2FaceplateGeometry} from './violet-faceplate.mjs';
import {createBloomMotionCapabilities} from './violet-motion.mjs';
import {captureWebGLRegion,compareWebGLObservations,compareWithOpenCV} from './violet-observation.mjs';

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
// One deterministic facial expression is baked into each authored SVG
// texture before rendering. This avoids relying on WebKit to resolve
// data-attribute stylesheet selectors inside an SVG used as an image.
const EXPRESSION_PARTS=Object.freeze({
  rest:['eye-smile','mouth-smile'],
  ask:['eye-open','mouth-smile'],
  talk:['eye-smile','mouth-speak'],
  blink:['eye-blink','mouth-smile'],
  'viseme-closed':['eye-smile','mouth-viseme-closed'],
  'viseme-open':['eye-smile','mouth-viseme-open'],
  'viseme-wide':['eye-smile','mouth-viseme-wide'],
  'viseme-round':['eye-smile','mouth-viseme-round']
});
function qualifiedExpressionSvg(xml,mode){
  const active=EXPRESSION_PARTS[mode];
  if(!active)throw new Error('Unrecognized required Violet expression: '+mode);
  // The authored SVG is the single source of geometry and expression parts.
  // Match its exact XML id attributes; do not reinterpret the SVG as HTML or
  // depend on Safari's XML DOM selectors to discover authored parts.
  if(!/<svg\b[^>]*\bdata-mode="rest"/.test(xml))
    throw new Error('Required Violet expression SVG root is invalid');
  const all=new Set(Object.values(EXPRESSION_PARTS).flat());
  for(const id of all){
    const opening='<g id="'+id+'"';
    const first=xml.indexOf(opening);
    if(first<0)throw new Error('Required Violet expression part missing: '+id);
    if(xml.indexOf(opening,first+opening.length)>=0)
      throw new Error('Duplicate required Violet expression part: '+id);
  }
  const start=xml.indexOf('#eye-smile'),end=xml.indexOf('.illuminated');
  if(start<0||end<=start)
    throw new Error('Required Violet expression visibility definitions changed');
  // Remove only the source visibility-selector rules. Preserve every path,
  // gradient, glow and other original style declaration unchanged.
  let qualified=xml.slice(0,start)+xml.slice(end);
  qualified=qualified.replace('data-mode="rest"','data-mode="'+mode+'"');
  for(const id of all){
    const opening='<g id="'+id+'"';
    if(!qualified.includes(opening))
      throw new Error('Required Violet expression opening tag missing: '+id);
    qualified=qualified.replace(opening,
      opening+' style="display:'+(active.includes(id)?'inline':'none')+'"');
  }
  return qualified;
}
function assertVisibleExpression(ctx,mode){
  function visibleInk(x,y,width,height){
    const pixels=ctx.getImageData(x,y,width,height).data;
    let count=0;
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i+3]>96&&pixels[i]+pixels[i+1]+pixels[i+2]>230)count++;
    }
    return count>35;
  }
  if(!visibleInk(140,145,360,110)||!visibleInk(260,270,120,100))
    throw new Error('Required Violet '+mode+' expression rendered without eyes or mouth');
}

async function svgTexture(url,mode){
  const response=await fetch(url,{cache:'no-cache'});
  if(!response.ok)throw new Error('Required Violet SVG unavailable: '+response.status+' '+url);
  const xml=qualifiedExpressionSvg(await response.text(),mode);
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
    assertVisibleExpression(ctx,mode);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=1;
    return texture;
  }finally{URL.revokeObjectURL(objectURL);}
}
// Lift the actual approved A2 faceplate pixels onto the curved mesh. This
// preserves the reference's face material instead of substituting a flat
// painted disc. The feathered perimeter merges into the original ribbons.
function createA2FaceplateTexture(art){
  const {centerX,centerY,widthPixels,heightPixels}=A2_FACEPLATE;
  const canvas=document.createElement('canvas');
  canvas.width=widthPixels;canvas.height=heightPixels;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('A2 faceplate texture requires 2D pixel access');
  ctx.drawImage(art,centerX-widthPixels/2,centerY-heightPixels/2,
    widthPixels,heightPixels,0,0,widthPixels,heightPixels);
  const pixels=ctx.getImageData(0,0,widthPixels,heightPixels);
  for(let y=0;y<heightPixels;y++)for(let x=0;x<widthPixels;x++){
    const u=(x-widthPixels/2)/(widthPixels*.5);
    const v=(y-heightPixels/2)/(heightPixels*.5);
    const radius=Math.sqrt(u*u+v*v);
    const feather=clamp((1-radius)*24,0,1);
    pixels.data[(y*widthPixels+x)*4+3]=Math.round(
      pixels.data[(y*widthPixels+x)*4+3]*feather);
  }
  ctx.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
function textureFromImage(image){
  const texture=new THREE.Texture(image);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=1;
  texture.needsUpdate=true;
  return texture;
}
function addBackground(scene){
  const layer=new THREE.Group();scene.add(layer);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({
    map:createGlowTexture(),transparent:true,opacity:.34,depthWrite:false,
    blending:THREE.AdditiveBlending
  }));
  glow.scale.set(9.4,7.0,1);glow.position.set(0,0,-1.2);layer.add(glow);
  const stars=[];
  for(let i=0;i<45;i++){
    const x=Math.sin((i+1)*117.441)*291.82;
    const y=Math.sin((i+1)*91.17)*351.57;
    stars.push((x-Math.floor(x))*13-6.5,(y-Math.floor(y))*14-7,-2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  layer.add(new THREE.Points(geometry,new THREE.PointsMaterial({
    color:0xa18ce7,size:.024,transparent:true,opacity:.20,depthWrite:false
  })));
  return layer;
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
export async function createVioletEnvironment(canvas,{onObserved,onFailure,onAudioFrame}={}){
  let renderer;
  try{
    if(!canvas||!(canvas instanceof HTMLCanvasElement))throw new Error('Required Violet WebGL canvas is missing');
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.NoToneMapping; // keep reference artwork colorimetry, no pastel wash-out
    // On touch-sized WebKit surfaces, a 2x framebuffer quadruples GPU memory.
    // Preserve the same authored scene while limiting its framebuffer cost.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,
      window.innerWidth<=620?1:2));
    const artworkURL=new URL('./violet-a2-art.webp',import.meta.url);
    const faceURL=new URL('./violet-face.svg',import.meta.url);
    const [art,rest,ask,talk,blink,visemeClosed,visemeOpen,visemeWide,visemeRound]=await Promise.all([
      loadRequiredImage(artworkURL,'Structured Bloom artwork'),
      svgTexture(faceURL,'rest'),svgTexture(faceURL,'ask'),
      svgTexture(faceURL,'talk'),svgTexture(faceURL,'blink'),
      svgTexture(faceURL,'viseme-closed'),svgTexture(faceURL,'viseme-open'),
      svgTexture(faceURL,'viseme-wide'),svgTexture(faceURL,'viseme-round')
    ]);
    // The art is an authored material of the selected character, not a substitute
    // if a procedural renderer fails. Its presence and decoding are required.
    const faces={rest,ask,talk,blink,
      'viseme-closed':visemeClosed,'viseme-open':visemeOpen,
      'viseme-wide':visemeWide,'viseme-round':visemeRound};
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b1d);
    const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,50);
    camera.position.set(0,0,8);camera.lookAt(0,0,0);
    const backgroundGroup=addBackground(scene);
    const character=new THREE.Group();scene.add(character);
    const artWidth=6.65,artHeight=artWidth*art.naturalHeight/art.naturalWidth;
    const main=new THREE.Mesh(new THREE.PlaneGeometry(artWidth,artHeight),new THREE.MeshBasicMaterial({
      map:textureFromImage(art),transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide
    }));
    character.add(main);
    // Preserve approved A2 body and lighting while lifting the source faceplate
    // into a real curved surface; speech expressions conform to its geometry.
    const artPixelToWorld=artWidth/art.naturalWidth;
    const faceCenterX=517,faceCenterY=320;
    const faceGeometry=createA2FaceplateGeometry(artPixelToWorld);
    // The approved face material needs actual normal-dependent light to
    // reveal its convexity. A BasicMaterial on an orthographic front-facing
    // cap merely reprojects the same flat pixels (the prior regression).
    const faceAssembly=new THREE.Group();
    faceAssembly.position.set((faceCenterX-art.naturalWidth/2)*artPixelToWorld,
      (art.naturalHeight/2-faceCenterY)*artPixelToWorld,.11);
    faceAssembly.rotation.set(-.055,.16,-.065);
    character.add(faceAssembly);
    const plate=new THREE.Mesh(faceGeometry,new THREE.MeshPhongMaterial({
      map:createA2FaceplateTexture(art),transparent:true,depthWrite:false,
      color:0xffffff,specular:0x9656dd,shininess:42,
      emissive:0x12051e,emissiveIntensity:.42,
      side:THREE.DoubleSide
    }));
    faceAssembly.add(plate);
    const faceAmbient=new THREE.AmbientLight(0xb6a0f8,1.05);
    const faceKey=new THREE.DirectionalLight(0xe7c9ff,1.5);
    faceKey.position.set(-2.8,3.8,5);
    const faceRim=new THREE.DirectionalLight(0x7854ed,.75);
    faceRim.position.set(3,-1,2);
    scene.add(faceAmbient,faceKey,faceRim);
    // Expressions follow the same cap normals and assembly orientation;
    // their self-illuminated strokes retain the approved A2 expression art.
    const expression=new THREE.Mesh(faceGeometry.clone(),
      new THREE.MeshBasicMaterial({map:rest,transparent:true,depthWrite:false,
        toneMapped:false,side:THREE.DoubleSide}));
    expression.position.z=.018;
    faceAssembly.add(expression);
    // Render capabilities are addressable but are NOT scheduled or activated by this opening.
    const visualCapabilities=createVioletAppearanceCapabilities({
      character,main,expression,art,artWidth,faceMaps:faces,backgroundGroup
    });
    const motionCapabilities=createBloomMotionCapabilities({
      structureSurface:visualCapabilities.getStructureSurface(),
      artWidth,artHeight,
      onActiveChange:visualCapabilities.setStructuralWarpActive
    });
    // Explicit observation requests are served after a real WebGL draw.
    // No independent timer decides when to inspect the scene.
    const pendingObservations=[];
    function observeNextFrame(options){
      if(!live||failed)return Promise.reject(new Error('Violet renderer is not rendering'));
      return new Promise((resolve,reject)=>pendingObservations.push({options,resolve,reject}));
    }
    function rejectObservations(reason){
      for(const item of pendingObservations.splice(0))item.reject(reason);
    }
    let state={phase:'dormant',speaking:false},live=true,observed=false,failed=false,frameCount=0,previousExpression='';
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
    const loss=event=>{event.preventDefault();if(!failed){
      failed=true;live=false;
      rejectObservations(new Error('Violet WebGL context lost'));
      onFailure?.(new Error('Violet WebGL context lost'));
    }};
    canvas.addEventListener('webglcontextlost',loss);
    function frame(now){
      if(!live)return;
      const t=reduced.matches?0:(now-start)/1000;
      character.position.y=reduced.matches?0:.038*Math.sin(t*.7);
      character.rotation.z=reduced.matches?0:.008*Math.sin(t*.39);
      const expansion=1+(reduced.matches?0:.004*Math.sin(t*.74));
      character.scale.setScalar(expansion);
      // Sample only an actually playing audio clock on the existing renderer
      // cadence. Rendering frames never authorize speech or invent phonemes.
      onAudioFrame?.();
      const mode=state.speaking&&state.observedSpeechPose
        ?state.observedSpeechPose:state.speaking?'talk':
        !reduced.matches&&Math.sin(t*.49+.8)>.998?'blink':
        state.phase==='asking-name'&&!state.speaking?'ask':'rest';
      const visualMode=visualCapabilities.desiredExpression(mode);
      if(visualMode!==previousExpression){expression.material.map=faces[visualMode];expression.material.needsUpdate=true;previousExpression=visualMode;}
      renderer.render(scene,camera);frameCount++;
      for(const observation of pendingObservations.splice(0)){
        try{observation.resolve(captureWebGLRegion({
          renderer,canvas,...observation.options
        }));}catch(error){observation.reject(error);}
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
      // The caller may explicitly propagate a visual snapshot in a later approved pass.
      // No visitor control, state transition or automatic time-based trigger invokes it now.
      visualCapabilities,motionCapabilities,
      visualObservation:Object.freeze({
        captureNextFrame:observeNextFrame,
        compare:compareWebGLObservations,
        compareWithOpenCV
      }),
      dispose(){
        live=false;
        rejectObservations(new Error('Violet renderer disposed'));
        resizeObserver.disconnect();canvas.removeEventListener('webglcontextlost',loss);
        visualCapabilities.dispose();scene.traverse(o=>{o.geometry?.dispose();});renderer.dispose();
      },
      get observed(){return observed&&!failed;}
    };
  }catch(error){console.error('Violet required render failed',error);renderer?.dispose();onFailure?.(error);throw error;}
}