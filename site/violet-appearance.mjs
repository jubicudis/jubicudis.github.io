// Violet: independently addressable visual materials, not a behavior engine.
// This module does not choose intent, timing, transitions, or presentation states.
// The unmodified approved A2 image is used for full presence, pixel for pixel.
import * as THREE from './vendor/three.module.js';

export const FULL_A2_APPEARANCE=Object.freeze({
  structure:1,
  center:1,
  environment:1,
  features:1
});
const CHANNELS=Object.freeze(Object.keys(FULL_A2_APPEARANCE));
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const SOURCE_SIZE=Object.freeze({width:970,height:687});

// Authored material boundary, traced around the lower contour of the A2
// sculptural body. Source floor rings pass behind this contour. The original
// flat artwork contains both; these masks recover independently addressable
// material channels without substituting a new illustration.
const BODY_LOWER_CONTOUR=Object.freeze([
  [0,535],[70,535],[120,550],[160,564],[210,589],
  [280,610],[360,630],[480,644],[550,646],
  [650,633],[730,608],[800,585],[850,552],
  [920,538],[970,536]
]);
function bodyEdge(x){
  for(let i=1;i<BODY_LOWER_CONTOUR.length;i++){
    const right=BODY_LOWER_CONTOUR[i],left=BODY_LOWER_CONTOUR[i-1];
    if(x<=right[0]){
      const t=clamp((x-left[0])/(right[0]-left[0]),0,1);
      return left[1]+(right[1]-left[1])*t;
    }
  }
  return BODY_LOWER_CONTOUR.at(-1)[1];
}
function faceCoverage(x,y){
  const cx=517,cy=320,rx=232,ry=144,tilt=-.09;
  const dx=x-cx,dy=y-cy,cos=Math.cos(tilt),sin=Math.sin(tilt);
  const u=(dx*cos+dy*sin)/rx,v=(-dx*sin+dy*cos)/ry;
  const radius=Math.sqrt(u*u+v*v);
  // Small feather keeps the expression plane and the underlying face seamless.
  return clamp((1-radius)*90+.5,0,1);
}

export function validateAppearanceSnapshot(request){
  if(!request||typeof request!=='object'||Array.isArray(request))
    throw new TypeError('Explicit visual-channel snapshot required');
  const keys=Object.keys(request);
  if(keys.length!==CHANNELS.length||keys.some(key=>!CHANNELS.includes(key)))
    throw new TypeError('Snapshot requires exactly structure, center, environment, features');
  for(const key of CHANNELS){
    if(!Number.isFinite(request[key])||request[key]<0||request[key]>1)
      throw new RangeError('Invalid '+key+': requires a finite opacity from 0 through 1');
  }
  return Object.freeze(Object.fromEntries(CHANNELS.map(key=>[key,request[key]])));
}

// One source raster is divided into the three actual authorable materials.
// The stage is no longer discarded just because it was embedded in the art.
// This process preserves original source pixels and the source alpha channel.
function makeMaterialTextures(art){
  if(art.naturalWidth!==SOURCE_SIZE.width||art.naturalHeight!==SOURCE_SIZE.height)
    throw new Error('A2 approved source dimensions changed; material partition needs verification');
  const canvas=document.createElement('canvas');
  canvas.width=SOURCE_SIZE.width;canvas.height=SOURCE_SIZE.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('A2 source material partition requires 2D pixel access');
  ctx.drawImage(art,0,0);
  const source=ctx.getImageData(0,0,canvas.width,canvas.height);
  const layers={};
  for(const name of ['environment','structure','center']){
    const pixels=ctx.createImageData(canvas.width,canvas.height);
    layers[name]=pixels;
  }
  const edges=Array.from({length:canvas.width},(_,x)=>bodyEdge(x));
  for(let y=0;y<canvas.height;y++){
    for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4;
      // A 16-pixel transition avoids visible material seams at the lower
      // silhouette while retaining the actual floor arcs and ribbon ends.
      const floor=clamp((y-edges[x]+8)/16,0,1);
      const body=1-floor,face=faceCoverage(x,y);
      const weights={
        environment:floor,
        structure:body*(1-face),
        center:body*face
      };
      for(const name of ['environment','structure','center']){
        const p=layers[name].data;
        p[i]=source.data[i];p[i+1]=source.data[i+1];p[i+2]=source.data[i+2];
        p[i+3]=Math.round(source.data[i+3]*weights[name]);
      }
    }
  }
  const maps={};
  for(const name of ['environment','structure','center']){
    ctx.putImageData(layers[name],0,0);
    const separate=document.createElement('canvas');
    separate.width=canvas.width;separate.height=canvas.height;
    const sc=separate.getContext('2d');
    if(!sc)throw new Error('Cannot create '+name+' material');
    sc.drawImage(canvas,0,0);
    const texture=new THREE.CanvasTexture(separate);
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    maps[name]=texture;
  }
  return maps;
}

// Background glow and stars are genuine environmental materials as well.
// Their initial values are retained, not guessed from a fallback.
function environmentMaterials(group){
  if(!group||group.children.length<2)throw new Error('A2 environmental material group is missing');
  return group.children.map(child=>{
    if(!child.material||!Number.isFinite(child.material.opacity))
      throw new Error('A2 environment material lacks explicit opacity');
    return {material:child.material,originalOpacity:child.material.opacity};
  });
}

/**
 * Creates only a rendering capability. The site does not invoke it automatically.
 * apply() changes requested material values and never asserts observed pixels.
 */
export function createVioletAppearanceCapabilities({
  character,main,expression,art,artWidth,faceMaps,backgroundGroup
}){
  const width=artWidth,height=artWidth*art.naturalHeight/art.naturalWidth;
  const textureMaps=makeMaterialTextures(art);
  const surfaces={};
  for(const [i,part] of ['environment','structure','center'].entries()){
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(width,height),
      new THREE.MeshBasicMaterial({
        map:textureMaps[part],transparent:true,opacity:1,depthWrite:false,
        toneMapped:false,side:THREE.DoubleSide
      }));
    surface.position.z=(i+1)*.009;
    surface.visible=false;
    character.add(surface);
    surfaces[part]=surface;
  }
  const lighting=environmentMaterials(backgroundGroup);
  let requested=FULL_A2_APPEARANCE;
  let expressionOverride=null;

  function apply(snapshot){
    const next=validateAppearanceSnapshot(snapshot);
    const full=CHANNELS.every(key=>next[key]===1);
    // Untouched full rendering uses the exact approved art asset.
    main.visible=full;
    for(const part of ['environment','structure','center']){
      surfaces[part].visible=!full&&next[part]>0;
      surfaces[part].material.opacity=next[part];
    }
    expression.visible=next.features>0;
    expression.material.opacity=next.features;
    for(const {material,originalOpacity} of lighting){
      material.opacity=originalOpacity*next.environment;
    }
    requested=next; // Requested state only. Render evidence belongs to the scene.
  }
  function setExpressionOverride(mode){
    if(mode!==null&&!(typeof mode==='string'&&Object.prototype.hasOwnProperty.call(faceMaps,mode)))
      throw new TypeError('Unrecognized authored Violet expression');
    expressionOverride=mode;
  }
  function dispose(){
    for(const surface of Object.values(surfaces)){
      surface.geometry.dispose();surface.material.map.dispose();surface.material.dispose();
    }
  }
  return Object.freeze({
    apply,setExpressionOverride,
    desiredExpression:defaultMode=>expressionOverride??defaultMode,
    readRequested:()=>requested,
    readExpressionOverride:()=>expressionOverride,
    dispose
  });
}
