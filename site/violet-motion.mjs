// Quad-influence deformation capability for the accepted A2 sculptural body.
// Every input is explicit. No default animation, gait, mood, timer or trigger.
// Four influences act independently but share a bounded coupling constraint.
// This controls one continuous material, not four disconnected ropes.
export const ZERO_BLOOM_MOTION=Object.freeze([
  Object.freeze({x:0,y:0}),Object.freeze({x:0,y:0}),
  Object.freeze({x:0,y:0}),Object.freeze({x:0,y:0})
]);
const MAX=.28;
const COUPLING=.18;
const ANCHOR_PIXELS=Object.freeze([
  Object.freeze({x:280,y:178}), // upper-left flowing structure
  Object.freeze({x:696,y:179}), // upper-right flowing structure
  Object.freeze({x:701,y:511}), // lower-right flowing structure
  Object.freeze({x:271,y:502})  // lower-left flowing structure
]);
export function validateBloomMotion(input){
  if(!Array.isArray(input)||input.length!==4)throw new TypeError('Exactly four coupled structural influences required');
  return Object.freeze(input.map((point,i)=>{
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)
      ||Math.abs(point.x)>MAX||Math.abs(point.y)>MAX||
      Object.keys(point).some(key=>key!=='x'&&key!=='y'))
      throw new RangeError('Invalid structural influence '+i);
    return Object.freeze({x:point.x,y:point.y});
  }));
}
export function solveCoupledMotion(input){
  const validated=validateBloomMotion(input);
  // Linked forces: each element retains most of its requested movement,
  // with the aggregate body exerting a smaller stabilizing influence.
  const mean={x:validated.reduce((n,p)=>n+p.x,0)/4,
    y:validated.reduce((n,p)=>n+p.y,0)/4};
  return Object.freeze(validated.map(p=>Object.freeze({
    x:p.x*(1-COUPLING)+mean.x*COUPLING,
    y:p.y*(1-COUPLING)+mean.y*COUPLING
  })));
}
export function createBloomMotionCapabilities({structureSurface,artWidth,artHeight,onActiveChange}){
  if(!structureSurface?.geometry?.getAttribute||typeof onActiveChange!=='function')
    throw new TypeError('Motion rig requires the actual structural geometry and a rendering-mode authority');
  const geo=structureSurface.geometry,attr=geo.getAttribute('position');
  if(attr.count<100)throw new Error('Structural geometry is not sufficiently subdivided to deform');
  const base=new Float32Array(attr.array);
  const widthPx=970,heightPx=687;
  const anchors=ANCHOR_PIXELS.map(p=>({
    x:(p.x/widthPx-.5)*artWidth,
    y:(.5-p.y/heightPx)*artHeight
  }));
  let requested=ZERO_BLOOM_MOTION;
  function apply(influences){
    const input=validateBloomMotion(influences);
    const solved=solveCoupledMotion(input);
    const active=input.some(p=>p.x!==0||p.y!==0);
    const radius=Math.min(artWidth,artHeight)*.27;
    const radiusSq=radius*radius;
    if(!active){
      // Bit-exact restoration matters: preserve source vertex signs and
      // -0 coordinates, rather than recomputing x + 0 for a neutral pose.
      attr.array.set(base);
    }else for(let i=0;i<attr.count;i++){
      const x=base[i*3],y=base[i*3+1];
      let dx=0,dy=0,sum=0;
      for(let j=0;j<4;j++){
        const anchor=anchors[j];
        const d2=(x-anchor.x)**2+(y-anchor.y)**2;
        const w=Math.exp(-d2/(2*radiusSq));
        dx+=w*solved[j].x;dy+=w*solved[j].y;sum+=w;
      }
      // Locally weighted deformation remains a single connected surface.
      const normalization=Math.max(1,sum);
      attr.array[i*3]=x+dx/normalization;
      attr.array[i*3+1]=y+dy/normalization;
      attr.array[i*3+2]=base[i*3+2];
    }
    attr.needsUpdate=true;geo.computeBoundingSphere();
    requested=input;
    onActiveChange(active);
    return Object.freeze({type:'deformation-requested',active,
      influenceCount:4,solved});
  }
  return Object.freeze({
    apply,readRequested:()=>requested,readGeometry:()=>structureSurface.geometry,
    reset:()=>apply(ZERO_BLOOM_MOTION)
  });
}
