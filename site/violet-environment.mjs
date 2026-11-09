// Violet, Structured Bloom A2: the inventor-selected visual design is the authoritative
// appearance. A Three.js scene displays its artwork as a layered, animated material;
// SVGs provide independently changeable facial expressions and micro-detail.
// This opening scene is NOT TNOS cognition or a completed 3D soft-body simulation.
// If any required art or WebGL rendering fails, no replacement character is fabricated.
import * as THREE from './vendor/three.module.js?v=20261106-webkit-precision-01';
import {createVioletAppearanceCapabilities} from './violet-appearance.mjs?v=20261109-connected-center-2';
import {A2_FACEPLATE,createA2FaceplateGeometry,createA2FaceplateSideGeometry} from './violet-faceplate.mjs';
import {createBloomMotionCapabilities} from './violet-motion.mjs?v=20261109-coupled-surfaces-2';
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
  // Blob-backed SVG images need intrinsic dimensions for reliable Safari
  // decoding into Canvas2D; viewBox alone is not sufficient in WebKit.
  qualified=qualified.replace('<svg xmlns="http://www.w3.org/2000/svg"',
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440"');
  for(const id of all){
    const opening='<g id="'+id+'"';
    if(!qualified.includes(opening))
      throw new Error('Required Violet expression opening tag missing: '+id);
    // SVG presentation attributes are honored by WebKit's SVG image
    // decoder; CSS display on nested groups is not consistently applied.
    qualified=qualified.replace(opening,
      opening+' display="'+(active.includes(id)?'inline':'none')+'"');
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

async function svgTexture(sourceXml,mode){
  const xml=qualifiedExpressionSvg(sourceXml,mode);
  const blob=new Blob([xml],{type:'image/svg+xml'});
  const objectURL=URL.createObjectURL(blob);
  const image=new Image();
  try{
    image.src=objectURL;
    await new Promise((resolve,reject)=>{
      image.onload=resolve;
      image.onerror=()=>reject(new Error('Violet expression SVG decoding failed'));
    });
    // onload alone does not guarantee decoded SVG pixels are ready on iOS.
    if(typeof image.decode==='function')await image.decode();
    // Verify the authored expression at its original 640x440 resolution,
    // then upload a compact 320x220 GPU texture. These are the same SVG
    // paths and expression state, not a replacement asset or fallback.
    const verified=document.createElement('canvas');verified.width=640;verified.height=440;
    const ctx=verified.getContext('2d');if(!ctx)throw new Error('Violet expression verification canvas unavailable');
    // WebKit can report an SVG image as loaded/decoded before its first
    // rasterized paint is available to Canvas2D. Require actual pixels,
    // and give the SAME authored image another paint opportunity before
    // treating it as a missing expression. Never replace its artwork.
    let qualified=false;
    for(let attempt=0;attempt<4;attempt++){
      ctx.clearRect(0,0,verified.width,verified.height);
      ctx.drawImage(image,0,0,verified.width,verified.height);
      try{
        assertVisibleExpression(ctx,mode);
        qualified=true;
        break;
      }catch(error){
        if(attempt===3)throw error;
        await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
      }
    }
    if(!qualified)throw new Error('Required Violet '+mode+' expression not observed');
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=220;
    const compact=canvas.getContext('2d');if(!compact)throw new Error('Violet expression texture canvas unavailable');
    compact.drawImage(verified,0,0,canvas.width,canvas.height);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=1;
    texture.generateMipmaps=false;
    texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
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
export async function createVioletEnvironment(canvas,{onObserved,onFailure,onAudioFrame,onAnimationFrame}={}){
  let renderer;
  try{
    if(!canvas||!(canvas instanceof HTMLCanvasElement))throw new Error('Required Violet WebGL canvas is missing');
    // iOS WebKit can terminate a WebGL context under GPU memory pressure.
    // Use the actual required A2 scene at a bounded GPU allocation, rather
    // than trying to restore a lost context or showing substitute artwork.
    const artworkURL=new URL('./violet-a2-art.webp',import.meta.url);
    const faceURL=new URL('./violet-face.svg',import.meta.url);
    // WebKit must not decode eight SVG image documents and eight large
    // verification canvases concurrently. The original asset is fetched
    // once, and each approved expression is decoded and released in order.
    // This preserves every authored face path and avoids the iPhone's
    // intermittent missing-eyes/mouth result under parallel decode pressure.
    const art=await loadRequiredImage(artworkURL,'Structured Bloom artwork');
    const faceResponse=await fetch(faceURL,{cache:'no-cache'});
    if(!faceResponse.ok)throw new Error('Required Violet SVG unavailable: '+faceResponse.status);
    const faceXml=await faceResponse.text();
    const rest=await svgTexture(faceXml,'rest');
    const ask=await svgTexture(faceXml,'ask');
    const talk=await svgTexture(faceXml,'talk');
    const blink=await svgTexture(faceXml,'blink');
    const visemeClosed=await svgTexture(faceXml,'viseme-closed');
    const visemeOpen=await svgTexture(faceXml,'viseme-open');
    const visemeWide=await svgTexture(faceXml,'viseme-wide');
    const visemeRound=await svgTexture(faceXml,'viseme-round');
    // Decode and verify every required A2 asset BEFORE allocating the WebGL
    // context. The prior implementation created an idle GPU context and then
    // performed nine parallel image/SVG decodes; on memory-constrained WebKit
    // that context could be evicted before the first actual scene draw.
    renderer=new THREE.WebGLRenderer({
      canvas,antialias:false,alpha:false,powerPreference:'low-power',
      preserveDrawingBuffer:false,stencil:false,depth:true
    });
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.NoToneMapping; // keep reference artwork colorimetry, no pastel wash-out
    // On touch-sized WebKit surfaces, a 2x framebuffer quadruples GPU memory.
    // Preserve the same authored scene while limiting its framebuffer cost.
    renderer.setPixelRatio(1);
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
    const faceRestPosition=faceAssembly.position.clone();
    character.add(faceAssembly);
    const plate=new THREE.Mesh(faceGeometry,new THREE.MeshPhongMaterial({
      map:createA2FaceplateTexture(art),transparent:true,depthWrite:false,
      color:0xffffff,specular:0x9656dd,shininess:42,
      emissive:0x12051e,emissiveIntensity:.42,
      side:THREE.DoubleSide
    }));
    faceAssembly.add(plate);
    // The physical thickness and luminous contour are visible from a frontal
    // iPhone camera; without these, a curved texture still reads as a 2D decal.
    const side=new THREE.Mesh(createA2FaceplateSideGeometry(artPixelToWorld),
      new THREE.MeshPhongMaterial({
        color:0x230d48,emissive:0x3a126f,emissiveIntensity:.42,
        specular:0xb77bff,shininess:86,side:THREE.DoubleSide
      }));
    faceAssembly.add(side);
    const outline=[];
    for(let i=0;i<=128;i++){
      const angle=i*Math.PI*2/128;
      outline.push(new THREE.Vector3(
        A2_FACEPLATE.widthPixels*artPixelToWorld*.5*Math.cos(angle),
        A2_FACEPLATE.heightPixels*artPixelToWorld*.5*Math.sin(angle),.008));
    }
    const rim=new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline,true),96,.016,5,true),
      new THREE.MeshBasicMaterial({color:0x9d57ef,transparent:true,opacity:.76,
        blending:THREE.AdditiveBlending,depthWrite:false}));
    faceAssembly.add(rim);
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
    // A second copy of the same authored curved expression surface supplies
    // intermediate mouth frames by optical blending. It shares the faceplate
    // geometry and approved SVG poses; no replacement mouth is invented.
    const expressionBlend=new THREE.Mesh(faceGeometry.clone(),
      new THREE.MeshBasicMaterial({map:rest,transparent:true,opacity:0,
        depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    expressionBlend.position.z=.019;
    expressionBlend.visible=false;
    faceAssembly.add(expressionBlend);
    const mouthFrames=Object.freeze([0,.22,.5,.78,1]);
    let mouthTransition=null;
    // Render capabilities are addressable but are NOT scheduled or activated by this opening.
    const visualCapabilities=createVioletAppearanceCapabilities({
      character,main,expression,art,artWidth,faceMaps:faces,backgroundGroup,faceplate:plate,faceAssembly
    });
    const motionCapabilities=createBloomMotionCapabilities({
      structureSurface:visualCapabilities.getStructureSurface(),
      centerSurface:visualCapabilities.getCenterSurface(),
      artWidth,artHeight,
      onActiveChange:visualCapabilities.setStructuralWarpActive
    });
    // Four articulated, luminous junctions bridge the physical faceplate
    // rim to the existing ribbon material. They are not autonomous rings or
    // breathing effects: both endpoints use the same structural displacement
    // as the A2 raster, while the face endpoint follows the curved plate.
    const attachmentSpecs=[
      {angle:2.42,body:{x:-1.63,y:1.12},color:0x4bcaff},
      {angle:.70,body:{x:1.54,y:1.10},color:0xb05bff},
      {angle:-.67,body:{x:1.56,y:-1.07},color:0xffb95c},
      {angle:-2.44,body:{x:-1.65,y:-1.08},color:0xa05aff}
    ];
    const ribbonGeometry=visualCapabilities.getStructureSurface().geometry;
    const ribbonPositions=ribbonGeometry.getAttribute('position');
    function nearestRibbonVertex({x,y}){
      let nearest=-1,distance=Infinity;
      for(let i=0;i<ribbonPositions.count;i++){
        const dx=ribbonPositions.getX(i)-x;
        const dy=ribbonPositions.getY(i)-y;
        const d=dx*dx+dy*dy;
        if(d<distance){distance=d;nearest=i;}
      }
      if(nearest<0)throw new Error('Required A2 ribbon attachment vertex unavailable');
      return nearest;
    }
    // A2 ribbon roots emerge from behind the faceplate and widen toward
    // the authored body. These are broad material continuations, not rods
    // pulled inward from the ribbons or independent glowing ornaments.
    const attachments=attachmentSpecs.map(spec=>{
      const segments=24;
      const geometry=new THREE.BufferGeometry();
      const positions=new Float32Array((segments+1)*2*3);
      const indices=[];
      for(let i=0;i<segments;i++){
        const n=i*2;
        indices.push(n,n+2,n+1,n+1,n+2,n+3);
      }
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      geometry.setIndex(indices);
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
        color:spec.color,transparent:true,opacity:.22,
        side:THREE.DoubleSide,depthWrite:false,
        blending:THREE.NormalBlending,toneMapped:false
      }));
      mesh.frustumCulled=false;
      character.add(mesh);
      return {...spec,mesh,segments,ribbonVertex:nearestRibbonVertex(spec.body)};
    });
    const attachmentScratch={
      rim:new THREE.Vector3(),end:new THREE.Vector3(),
      control:new THREE.Vector3(),point:new THREE.Vector3(),
      tangent:new THREE.Vector3()
    };
    function updateFaceAttachments(){
      const rx=A2_FACEPLATE.widthPixels*artPixelToWorld*.5;
      const ry=A2_FACEPLATE.heightPixels*artPixelToWorld*.5;
      const {rim,end,control,point,tangent}=attachmentScratch;
      for(const attachment of attachments){
        const {angle,mesh,segments}=attachment;
        // Direction is unambiguously FACE -> BODY. The root sits under
        // the existing faceplate edge; the far end is the actual displaced
        // ribbon vertex. The curve never traverses the front of the face.
        rim.set(rx*.87*Math.cos(angle),ry*.87*Math.sin(angle),0);
        rim.applyEuler(faceAssembly.rotation).add(faceAssembly.position);
        end.set(ribbonPositions.getX(attachment.ribbonVertex),
          ribbonPositions.getY(attachment.ribbonVertex),.031);
        rim.z=.039;
        control.copy(rim).lerp(end,.58);
        // Preserve a continuous outward tangent instead of folding back
        // into the faceplate or crossing another ribbon root.
        const outwardX=Math.cos(angle),outwardY=Math.sin(angle);
        control.x+=outwardX*.12;
        control.y+=outwardY*.12;
        control.z=.034;
        const attr=mesh.geometry.getAttribute('position');
        for(let i=0;i<=segments;i++){
          const t=i/segments,u=1-t;
          point.set(
            u*u*rim.x+2*u*t*control.x+t*t*end.x,
            u*u*rim.y+2*u*t*control.y+t*t*end.y,
            u*u*rim.z+2*u*t*control.z+t*t*end.z);
          tangent.set(
            2*u*(control.x-rim.x)+2*t*(end.x-control.x),
            2*u*(control.y-rim.y)+2*t*(end.y-control.y),0).normalize();
          // The attachment is a ribbon surface, tapering under the plate
          // and broadening as it merges with the original A2 ribbon.
          const width=.035+.13*t;
          const nx=-tangent.y*width,ny=tangent.x*width;
          attr.setXYZ(i*2,point.x+nx,point.y+ny,point.z);
          attr.setXYZ(i*2+1,point.x-nx,point.y-ny,point.z);
        }
        attr.needsUpdate=true;
        mesh.geometry.computeBoundingSphere();
      }
    }
    updateFaceAttachments();
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
    // The approved A2 scene does not require 60 GPU submissions per second.
    // Bound actual WebGL work on iOS to 30 Hz while the narration clock
    // continues to be sampled on each animation frame.
    const gpuFrameInterval=1000/30;
    let lastGpuFrame=-Infinity,frameRequest=0,lastBodyFrame=-Infinity;
    let allocatedWidth=0,allocatedHeight=0;
    let inferenceMode=false;
    const resize=()=>{
      const cssWidth=Math.max(1,Math.round(canvas.clientWidth));
      const cssHeight=Math.max(1,Math.round(canvas.clientHeight));
      // Reduce iPhone framebuffer memory while the approved Heart model loads.
      const width=Math.max(1,Math.round(cssWidth*(inferenceMode?0.5:1)));
      const height=Math.max(1,Math.round(cssHeight*(inferenceMode?0.5:1)));
      // ResizeObserver can fire repeatedly for an unchanged CSS box on
      // WebKit. Reallocating an identical WebGL drawing buffer is unnecessary
      // GPU work and can evict the active context during Heart playback.
      if(width===allocatedWidth&&height===allocatedHeight)return;
      allocatedWidth=width;allocatedHeight=height;
      const aspect=width/height;
      const worldWidth=cssWidth<=620?7.25:clamp(aspect*7.25,8.0,13.1);
      const worldHeight=worldWidth/aspect;
      camera.left=-worldWidth/2;camera.right=worldWidth/2;
      camera.top=worldHeight/2;camera.bottom=-worldHeight/2;
      camera.updateProjectionMatrix();renderer.setSize(width,height,false);
    };
    resize();const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
    // Fail closed: WebGL context loss invalidates the required rendered
    // observation. No implicit recovery, substitute renderer or fake state.
    const loss=event=>{
      event.preventDefault();
      if(failed)return;
      failed=true;live=false;observed=false;
      cancelAnimationFrame(frameRequest);
      const error=new Error('Violet WebGL context lost');
      rejectObservations(error);
      onFailure?.(error);
    };
    canvas.addEventListener('webglcontextlost',loss);
    // A single continuous, damped deformation drives ribbons and faceplate.
    // Acoustic observations set targets; the renderer interpolates geometry
    // without inventing additional speech cues.
    const neutral=Array.from({length:4},()=>({x:0,y:0}));
    let smoothed=neutral.map(p=>({...p}));
    let motionTarget=neutral;
    let lastMotionTime=0;
    const faceRestRotation=faceAssembly.rotation.clone();
    function updatePhysicalRig(now){
      const elapsed=lastMotionTime?Math.min(80,now-lastMotionTime):33;
      lastMotionTime=now;
      const blend=1-Math.exp(-elapsed/105);
      let changed=false;
      smoothed=smoothed.map((point,i)=>{
        const target=motionTarget[i]||neutral[i];
        const x=point.x+(target.x-point.x)*blend;
        const y=point.y+(target.y-point.y)*blend;
        if(Math.abs(x-point.x)+Math.abs(y-point.y)>0.00002)changed=true;
        return {x:Math.abs(x)<0.00002?0:x,y:Math.abs(y)<0.00002?0:y};
      });
      if(!changed)return;
      motionCapabilities.apply(smoothed);
      const cx=faceRestPosition.x,cy=faceRestPosition.y;
      const center=motionCapabilities.displacementAt(cx,cy);
      const left=motionCapabilities.displacementAt(cx-.45,cy);
      const right=motionCapabilities.displacementAt(cx+.45,cy);
      const upper=motionCapabilities.displacementAt(cx,cy+.32);
      const lower=motionCapabilities.displacementAt(cx,cy-.32);
      faceAssembly.position.set(cx+center.x,cy+center.y,faceRestPosition.z);
      // Follow local material shear and tilt, not only translation.
      faceAssembly.rotation.set(
        faceRestRotation.x+(upper.y-lower.y)*.12,
        faceRestRotation.y+(upper.x-lower.x)*.18,
        faceRestRotation.z+Math.atan2(right.y-left.y,.9)*.65);
      updateFaceAttachments();
    }
    function frame(now){
      if(!live)return;
      onAudioFrame?.();
      if(now-lastGpuFrame<(inferenceMode?1000/12:gpuFrameInterval)){
        frameRequest=requestAnimationFrame(frame);
        return;
      }
      lastGpuFrame=now;
      updatePhysicalRig(now);
      // The entire presence follows the same reducer-authorized four-point
      // field as its ribbons and faceplate. Independent sine-driven floating
      // and rocking made its movement disagree with the observed state.
      const lift=smoothed.reduce((sum,point)=>sum+point.y,0)/smoothed.length;
      character.position.y=lift*.12;
      character.rotation.z=(smoothed[1].y-smoothed[0].y)*.025;
      character.scale.setScalar(1);
      // The reducer authorizes idle sculptural motion. Time supplies only
      // the physical animation phase, not the choice of presentation mode.
      // During Heart playback the rig follows observed acoustic energy.
      if(state.bodyMotionMode==='flow'&&onAnimationFrame&&
         now-lastBodyFrame>=1000/30){
        lastBodyFrame=now;
        onAnimationFrame(Object.freeze({
          type:'observed-animation-frame',
          elapsedMs:now-start,reducedMotion:reduced.matches
        }));
      }
      // Sample only an actually playing audio clock on the existing renderer
      // cadence. Rendering frames never authorize speech or invent phonemes.
      // Facial expression is authorized by the opening reducer; the
      // renderer only applies that exact state to the approved A2 material.
      const mode=state.visualExpression;
      const visualMode=visualCapabilities.desiredExpression(mode);
      if(visualMode!==previousExpression){
        // Keep the current authored expression visible while stepping through
        // three intermediate mouth frames toward the new observed pose.
        // State selects the target; the renderer only interpolates its display.
        if(mouthTransition&&mouthTransition.frame>=mouthFrames.length-2){
          expression.material.map=faces[mouthTransition.target];
          expression.material.needsUpdate=true;
        }
        expressionBlend.material.map=faces[visualMode];
        expressionBlend.material.needsUpdate=true;
        mouthTransition={target:visualMode,frame:0};
        previousExpression=visualMode;
      }
      if(mouthTransition){
        const alpha=mouthFrames[Math.min(mouthTransition.frame,mouthFrames.length-1)];
        expressionBlend.material.opacity=alpha;
        expressionBlend.visible=expression.visible&&alpha>0;
        mouthTransition.frame++;
        if(mouthTransition.frame>=mouthFrames.length){
          expression.material.map=faces[mouthTransition.target];
          expression.material.needsUpdate=true;
          expressionBlend.visible=false;
          expressionBlend.material.opacity=0;
          mouthTransition=null;
        }
      }else expressionBlend.visible=false;
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
      frameRequest=requestAnimationFrame(frame);
    }
    frameRequest=requestAnimationFrame(frame);
    return {
      update(next){
        state=next;
        // Reducer-observed acoustic or idle influences remain the sole
        // authority for motion. Rendering only smooths their physical response.
        if(next.bloomMotion)motionTarget=next.bloomMotion;
      },
      setInferenceMode(enabled){
        const next=enabled===true;
        if(next===inferenceMode)return;
        inferenceMode=next;
        resize();
      },
      visualCapabilities,motionCapabilities,
      visualObservation:Object.freeze({
        captureNextFrame:observeNextFrame,
        compare:compareWebGLObservations,
        compareWithOpenCV
      }),
      dispose(){
        live=false;
        cancelAnimationFrame(frameRequest);
        rejectObservations(new Error('Violet renderer disposed'));
        resizeObserver.disconnect();canvas.removeEventListener('webglcontextlost',loss);
        visualCapabilities.dispose();scene.traverse(o=>{o.geometry?.dispose();});renderer.dispose();
      },
      get observed(){return observed&&!failed;}
    };
  }catch(error){console.error('Violet required render failed',error);renderer?.dispose();onFailure?.(error);throw error;}
}