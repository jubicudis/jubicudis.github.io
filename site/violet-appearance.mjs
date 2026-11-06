// Violet visual capability boundary.
// The presentation will eventually supply the requested visual channels.
// This module never chooses when or why those channels change, never starts
// a transition, and never reports a requested value as an observed outcome.
import * as THREE from './vendor/three.module.js';

export const FULL_A2_APPEARANCE=Object.freeze({
  structure:1,
  center:1,
  features:1
});
const CHANNELS=Object.freeze(Object.keys(FULL_A2_APPEARANCE));

export function validateAppearanceSnapshot(request){
  if(!request||typeof request!=='object'||Array.isArray(request))throw new TypeError('An explicit visual-channel snapshot is required');
  const keys=Object.keys(request);
  if(keys.length!==CHANNELS.length||keys.some(key=>!CHANNELS.includes(key)))throw new TypeError('Visual-channel snapshot must contain only structure, center, features');
  for(const key of CHANNELS){
    if(!Number.isFinite(request[key])||request[key]<0||request[key]>1)
      throw new RangeError('Invalid '+key+' opacity: requires a finite number from 0 through 1');
  }
  return Object.freeze(Object.fromEntries(CHANNELS.map(key=>[key,request[key]])));
}

function filteredArt(image,part){
  const canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Violet visual channel cannot acquire a drawing surface');

  // Partition the actual approved A2 artwork. No invented replacement art.
  // Its image has an intentionally featureless central face beneath the SVG.
  const cx=517,cy=320,rx=232,ry=144,tilt=-.09;
  if(part==='center'){
    ctx.save();
    ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,tilt,0,Math.PI*2);ctx.clip();
    ctx.drawImage(image,0,0);ctx.restore();
  }else if(part==='structure'){
    ctx.drawImage(image,0,0);
    ctx.globalCompositeOperation='destination-out';
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,tilt,0,Math.PI*2);ctx.fill();
  }else throw new TypeError('Unknown artwork region');
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  return map;
}

/**
 * Install concrete, separately addressable render surfaces. Nothing here
 * triggers their use. The initial scene remains the previously approved
 * one-piece A2 artwork, pixel-for-pixel in the original rendering path.
 */
export function createVioletAppearanceCapabilities({character,main,expression,art,artWidth,faceMaps}){
  const width=artWidth,height=artWidth*art.naturalHeight/art.naturalWidth;
  const surfaces={};
  for(const [i,part] of ['structure','center'].entries()){
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({
      map:filteredArt(art,part),transparent:true,opacity:1,depthWrite:false,
      toneMapped:false,side:THREE.DoubleSide
    }));
    surface.position.z=(i+1)*.009;
    surface.visible=false;
    character.add(surface);
    surfaces[part]=surface;
  }

  let requested=FULL_A2_APPEARANCE;
  let expressionOverride=null;

  function apply(snapshot){
    // Validate the entire request before changing any render material.
    const next=validateAppearanceSnapshot(snapshot);
    const untouched=CHANNELS.every(key=>next[key]===1);
    main.visible=untouched;
    for(const part of ['structure','center']){
      const surface=surfaces[part];
      surface.visible=!untouched&&next[part]>0;
      surface.material.opacity=next[part];
    }
    expression.material.opacity=next.features;
    expression.visible=next.features>0;
    requested=next; // Requested values, NOT verified pixels or completed behavior.
  }
  function setExpressionOverride(mode){
    if(mode!==null&&!(typeof mode==='string'&&Object.prototype.hasOwnProperty.call(faceMaps,mode)))
      throw new TypeError('Unknown authored Violet expression');
    expressionOverride=mode;
  }
  function desiredExpression(defaultMode){
    return expressionOverride??defaultMode;
  }
  function dispose(){
    for(const surface of Object.values(surfaces)){
      surface.geometry.dispose();
      surface.material.map.dispose();
      surface.material.dispose();
    }
  }
  return Object.freeze({
    apply,
    setExpressionOverride,
    desiredExpression,
    readRequested:()=>requested,
    readExpressionOverride:()=>expressionOverride,
    dispose
  });
}
