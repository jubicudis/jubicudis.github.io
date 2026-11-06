// Bounded visual observation of the site's own WebGL output.
// Never uses a visitor camera. A material command does not imply observation.
// Captures a sampled visual region and qualifies differences against evidence.
const bound=(x,min,max)=>Math.max(min,Math.min(max,x));
export function captureWebGLRegion({renderer,canvas,region={
  left:.28,top:.25,right:.73,bottom:.78
},columns=20,rows=16,token}){
  if(!renderer?.getContext||!canvas||!Number.isSafeInteger(token))
    throw new TypeError('WebGL observation requires renderer, canvas and request token');
  if(!Number.isInteger(columns)||!Number.isInteger(rows)||
    columns<2||rows<2||columns*rows>1024)
    throw new RangeError('Unbounded or invalid region sampling');
  if(!region||!['left','top','right','bottom'].every(k=>Number.isFinite(region[k]))||
     region.left<0||region.top<0||region.right>1||region.bottom>1||
     region.left>=region.right||region.top>=region.bottom)
    throw new RangeError('Observation region must be a normalized rectangle');
  const gl=renderer.getContext();
  if(gl.isContextLost())throw new Error('WebGL context lost; no observable frame');
  if(renderer.info.render.calls<1||canvas.width<1||canvas.height<1)
    throw new Error('No qualified rendered frame');
  const pixels=new Uint8Array(columns*rows*4),single=new Uint8Array(4);
  let saturation=0,brightness=0;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const nx=region.left+(col+.5)/columns*(region.right-region.left);
    const ny=region.top+(row+.5)/rows*(region.bottom-region.top);
    const x=bound(Math.floor(nx*canvas.width),0,canvas.width-1);
    const y=bound(Math.floor((1-ny)*canvas.height),0,canvas.height-1);
    gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,single);
    const k=(row*columns+col)*4;
    pixels.set(single,k);
    const high=Math.max(single[0],single[1],single[2]);
    const low=Math.min(single[0],single[1],single[2]);
    if(high>55&&high-low>23)saturation++;
    brightness+=(single[0]+single[1]+single[2])/3;
  }
  return Object.freeze({
    type:'bounded-webgl-pixels',token,width:columns,height:rows,
    region:Object.freeze({...region}),
    drawCalls:renderer.info.render.calls,
    saturatedSamples:saturation,meanBrightness:brightness/(columns*rows),
    pixels // Raw sampled RGBA for local comparison; never included in app state.
  });
}
export function compareWebGLObservations(before,after,{minimumDifferent=2,threshold=18}={}){
  if(before?.type!=='bounded-webgl-pixels'||after?.type!=='bounded-webgl-pixels'||
    before.width!==after.width||before.height!==after.height||
    before.pixels.length!==after.pixels.length)
    throw new TypeError('Two compatible, actually sampled WebGL frames required');
  if(!Number.isInteger(minimumDifferent)||minimumDifferent<1||
     !Number.isFinite(threshold)||threshold<0||threshold>255)
    throw new RangeError('Invalid visual qualification thresholds');
  let different=0,total=0;
  for(let i=0;i<before.pixels.length;i+=4){
    const delta=(Math.abs(before.pixels[i]-after.pixels[i])+
      Math.abs(before.pixels[i+1]-after.pixels[i+1])+
      Math.abs(before.pixels[i+2]-after.pixels[i+2]))/3;
    if(delta>=threshold)different++;
    total+=delta;
  }
  return Object.freeze({type:'webgl-change-observed',fromToken:before.token,
    toToken:after.token,qualified:different>=minimumDifferent,
    differentSamples:different,meanAbsoluteDifference:total/(before.width*before.height),
    region:after.region});
}
// Genuine OpenCV specialist. Explicitly requires a loaded OpenCV.js engine;
// failure is explicit, not secretly replaced by another algorithm.
export function compareWithOpenCV(cv,before,after){
  if(!cv||typeof cv.matFromArray!=='function'||typeof cv.absdiff!=='function'||
    typeof cv.mean!=='function'||!cv.CV_8UC4)
    throw new Error('OpenCV.js must be initialized before qualified CV inspection');
  if(before?.width!==after?.width||before?.height!==after?.height||
    before?.type!=='bounded-webgl-pixels'||after?.type!=='bounded-webgl-pixels')
    throw new TypeError('Compatible sampled frames required for OpenCV');
  const mats=[];
  try{
    const a=cv.matFromArray(before.height,before.width,cv.CV_8UC4,before.pixels);
    const b=cv.matFromArray(after.height,after.width,cv.CV_8UC4,after.pixels);
    const difference=new cv.Mat();
    mats.push(a,b,difference);
    cv.absdiff(a,b,difference);
    const channels=cv.mean(difference);
    const meanRgb=(channels[0]+channels[1]+channels[2])/3;
    return Object.freeze({type:'opencv-region-comparison',fromToken:before.token,
      toToken:after.token,meanRgbDifference:meanRgb,
      changed:meanRgb>0,source:'opencv-absdiff-mean'});
  }finally{for(const mat of mats)mat?.delete?.();}
}
