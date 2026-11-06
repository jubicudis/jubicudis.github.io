// Violet / TNOS website: one continuous spatial opening environment.
// Native canvas with projected 3D ribbon geometry. It does not simulate TNOS cognition.
// Structured Bloom derives its visual form from the inventor-selected concept sheet.
const COLORS=[
  {bright:'#f1c1ff',base:'#9657f4',deep:'#32207c',glow:'#ba65f7'},
  {bright:'#a2f8ff',base:'#29a9f5',deep:'#16359b',glow:'#4bd2ff'},
  {bright:'#ffecb1',base:'#f6b454',deep:'#904b92',glow:'#ffcb6a'},
  {bright:'#dbc3ff',base:'#713fdc',deep:'#24216b',glow:'#9b70ff'}
];
const RIBBONS=[
  {major:235,minor:147,rx:.39,ry:.10,rz:-.49,start:.06,bias:.35},
  {major:227,minor:145,rx:-.30,ry:.35,rz:.79,start:1.16,bias:-.29},
  {major:233,minor:130,rx:1.02,ry:-.12,rz:.03,start:2.52,bias:.51},
  {major:221,minor:148,rx:.28,ry:.52,rz:-1.06,start:3.26,bias:-.19}
];
const TWO_PI=Math.PI*2;
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function mix(a,b,t){return a+(b-a)*t;}
function easeOut(t){return 1-Math.pow(1-clamp(t,0,1),3);}
function fillEllipse(ctx,x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TWO_PI);ctx.fillStyle=color;ctx.fill();}
function strokeEllipse(ctx,x,y,rx,ry,color,width){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TWO_PI);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function projectedPoint(ribbon,k,time,i,reducedMotion){
  const phase=reducedMotion?0:time;
  const common=.018*Math.sin(phase*.65);
  const individual=.034*Math.sin(phase*(.48+i*.08)+i*1.4);
  const rx=ribbon.rx+common*.7+individual*.45;
  const ry=ribbon.ry+common*.3-individual*.2;
  const rz=ribbon.rz+individual*.7;
  const u=k+(.014*Math.sin(phase*.85+i*1.4));
  const flux=1+(.012*Math.sin(2*u+phase*.8+i*.8));
  let x=Math.cos(u)*ribbon.major*flux;
  let y=Math.sin(u)*ribbon.minor;
  let z=ribbon.bias*40*Math.sin(u*2+i);
  // 3D orientation: stable identity with coupled, limited independent deformation.
  let yy=y*Math.cos(rx)-z*Math.sin(rx),zz=y*Math.sin(rx)+z*Math.cos(rx);y=yy;z=zz;
  let xx=x*Math.cos(ry)+z*Math.sin(ry);zz=-x*Math.sin(ry)+z*Math.cos(ry);x=xx;z=zz;
  xx=x*Math.cos(rz)-y*Math.sin(rz);yy=x*Math.sin(rz)+y*Math.cos(rz);x=xx;y=yy;
  const perspective=720/(720-z);
  return {x:x*perspective,y:y*perspective,z};
}
function ribbonParts(i,time,reducedMotion,front){
  const r=RIBBONS[i],steps=182,parts=[];
  let part=[];
  for(let j=0;j<=steps;j++){
    const p=projectedPoint(r,r.start+j/steps*TWO_PI,time,i,reducedMotion);
    const appropriate=front?p.z>=0:p.z<0;
    if(appropriate){part.push(p);}else if(part.length>1){parts.push(part);part=[];}else part=[];
  }
  if(part.length>1)parts.push(part);
  return parts;
}
function drawRibbon(ctx,i,part,front,energy){
  if(part.length<2)return;
  const c=COLORS[i];
  ctx.save();
  ctx.beginPath();ctx.moveTo(part[0].x,part[0].y);
  for(let k=1;k<part.length;k++)ctx.lineTo(part[k].x,part[k].y);
  ctx.lineCap='round';ctx.lineJoin='round';
  const width=front?35:31;
  ctx.lineWidth=width+6;
  ctx.strokeStyle=front?c.glow:c.deep;
  ctx.shadowBlur=front?23:17;
  ctx.shadowColor=c.glow;
  ctx.globalAlpha=front?.79:.58;
  ctx.stroke();
  ctx.shadowBlur=0;ctx.globalAlpha=front?1:.71;
  const gradient=ctx.createLinearGradient(-260,-220,270,220);
  gradient.addColorStop(0,c.bright);gradient.addColorStop(.25,c.base);gradient.addColorStop(.56,c.deep);gradient.addColorStop(.83,c.base);gradient.addColorStop(1,c.bright);
  ctx.lineWidth=width;ctx.strokeStyle=gradient;ctx.stroke();
  ctx.globalAlpha=front?.68:.30;ctx.lineWidth=3.6;ctx.strokeStyle='#ffffff';ctx.stroke();
  // Segmented panels follow the same projected ribbon: not independent floating glyphs.
  ctx.globalAlpha=front?.44:.16;
  for(let n=15;n<part.length-10;n+=23){
    const p=part[n],q=part[n+4];
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);
    ctx.strokeStyle=c.bright;ctx.lineWidth=7;ctx.stroke();
  }
  ctx.restore();
}
function drawFace(ctx,time,state,reducedMotion,energy){
  ctx.save();
  const t=reducedMotion?0:time;
  const bob=reducedMotion?0:3.8*Math.sin(t*1.13);
  ctx.translate(0,bob);
  ctx.rotate(-.088+(!reducedMotion?.014*Math.sin(t*.7):0));
  let g=ctx.createRadialGradient(-20,-20,25,0,0,175);
  g.addColorStop(0,'rgba(123,64,232,.14)');g.addColorStop(.65,'rgba(121,60,231,.10)');g.addColorStop(1,'rgba(102,42,210,0)');
  fillEllipse(ctx,0,0,185,135,g);
  ctx.shadowColor='#9e58f8';ctx.shadowBlur=31;
  g=ctx.createLinearGradient(-148,-72,155,108);
  g.addColorStop(0,'#8b59ec');g.addColorStop(.37,'#413487');g.addColorStop(.65,'#54289c');g.addColorStop(1,'#9c5feb');
  fillEllipse(ctx,0,0,154,106,g);
  ctx.shadowBlur=0;
  g=ctx.createRadialGradient(-33,-49,6,7,8,191);
  g.addColorStop(0,'#3e347e');g.addColorStop(.3,'#151639');g.addColorStop(.74,'#0c0e2a');g.addColorStop(1,'#201243');
  fillEllipse(ctx,0,-4,145,99,g);
  strokeEllipse(ctx,0,-4,146,100,'rgba(207,160,255,.8)',2.1);
  ctx.beginPath();ctx.ellipse(-28,-33,106,49,-.11,3.39,5.63);
  ctx.strokeStyle='rgba(214,182,255,.18)';ctx.lineWidth=4;ctx.stroke();

  // No independent head: the expression lives directly on the central structural surface.
  const blink=reducedMotion?0:Math.pow(Math.max(0,1-Math.abs((t+1.8)%5.9-5.55)/.14),2);
  const eyesOpen=state.phase==='asking-name'&&!state.speaking;
  const eyeCenterY=-12;
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const offset of [-56,56]){
    ctx.save();ctx.translate(offset,eyeCenterY);
    ctx.shadowColor='#dca5ff';ctx.shadowBlur=15;ctx.strokeStyle='#f4d6ff';ctx.fillStyle='#f0dcff';
    if(eyesOpen&&blink<.5){
      ctx.beginPath();ctx.ellipse(0,0,9,16,0,0,TWO_PI);ctx.fill();
      fillEllipse(ctx,1,3,3.2,6,'#6246b5');
    }else{
      ctx.beginPath();ctx.moveTo(-25,5);ctx.quadraticCurveTo(0,-24+blink*22,25,5);
      ctx.lineWidth=8.4;ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();ctx.shadowColor='#ce84ff';ctx.shadowBlur=11;ctx.fillStyle='#f2d8ff';
  const mouthOpen=state.speaking ?(7+6*Math.pow(Math.sin(t*8.7),2)):state.phase==='asking-name'?0:6;
  if(state.speaking){
    ctx.beginPath();ctx.moveTo(-22,38);ctx.quadraticCurveTo(0,46+mouthOpen,22,38);ctx.quadraticCurveTo(0,56-mouthOpen*.35,-22,38);ctx.fill();
  }else{
    ctx.beginPath();ctx.moveTo(-22,37);ctx.quadraticCurveTo(0,60+mouthOpen,22,37);
    ctx.quadraticCurveTo(0,48,-22,37);ctx.fill();
  }
  ctx.restore();ctx.restore();
}
function drawStage(ctx,width,height,cx,cy,scale,time,active,reducedMotion){
  ctx.save();
  const back=ctx.createRadialGradient(cx,cy,12,cx,cy,Math.max(width,height)*.8);
  back.addColorStop(0,'#171439');back.addColorStop(.37,'#10132c');back.addColorStop(1,'#060a18');ctx.fillStyle=back;ctx.fillRect(0,0,width,height);
  const light=ctx.createRadialGradient(cx,cy+75*scale,22,cx,cy+75*scale,390*scale);
  light.addColorStop(0,'rgba(110,65,210,.15)');light.addColorStop(.57,'rgba(35,49,116,.075)');light.addColorStop(1,'rgba(40,18,105,0)');ctx.fillStyle=light;ctx.fillRect(0,0,width,height);
  const starCount=54;ctx.globalAlpha=.48;
  for(let i=0;i<starCount;i++){
    const u=(Math.sin(i*129.77+6.63)*179.11)%1;
    const v=(Math.sin(i*78.32+3.07)*224.31)%1;
    const xx=(u<0?u+1:u)*width,yy=(v<0?v+1:v)*height;
    const a=.15+.23*Math.sin((reducedMotion?0:time)*.44+i);
    fillEllipse(ctx,xx,yy,i%6===0?1.4:.7,i%6===0?1.4:.7,`rgba(168,172,247,${Math.max(0,a)})`);
  }
  ctx.globalAlpha=1;
  // A spatial grounding plane. Violet is visibly part of its energy and material.
  ctx.translate(cx,cy+254*scale);ctx.scale(scale,scale);
  const glow=ctx.createRadialGradient(0,0,8,0,0,295);
  glow.addColorStop(0,`rgba(127,65,245,${active?.25:.17})`);
  glow.addColorStop(.55,'rgba(66,48,174,.08)');glow.addColorStop(1,'rgba(52,47,160,0)');
  fillEllipse(ctx,0,0,298,80,glow);
  ctx.shadowBlur=17;ctx.shadowColor='#6152e4';
  strokeEllipse(ctx,0,0,244,42,'rgba(109,90,235,.33)',2.4);
  strokeEllipse(ctx,0,0,194,31,'rgba(67,163,250,.42)',3);
  ctx.shadowBlur=0;strokeEllipse(ctx,0,0,138,20,'rgba(198,114,254,.33)',1.4);
  ctx.restore();
}
export function createVioletEnvironment(canvas){
  const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
  if(!ctx)throw new Error('TNOS opening requires browser canvas rendering');
  let state={phase:'dormant',speaking:false,enteredAt:0};
  let cssW=0,cssH=0,dpr=1,live=true;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const start=performance.now();
  function resize(){
    const rect=canvas.getBoundingClientRect();
    cssW=Math.max(1,rect.width);cssH=Math.max(1,rect.height);
    dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);
  }
  resize();
  window.addEventListener('resize',resize,{passive:true});
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function frame(now){
    if(!live)return;
    const time=reduced.matches?0:(now-start)/1000;
    const active=state.phase!=='dormant';
    const transition=active?easeOut((now-state.enteredAt)/1500):0;
    const scale=Math.min(cssW/680,cssH/750,1.22);
    const cx=cssW/2,cy=cssH*(active?mix(.475,.425,transition):.475);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    drawStage(ctx,cssW,cssH,cx,cy,scale,time,active,reduced.matches);
    ctx.save();ctx.translate(cx,cy);ctx.scale(scale*1.06,scale*1.06);
    // Back-to-front composition produces genuine depth-order changes around Violet's face.
    for(let i=0;i<4;i++)for(const section of ribbonParts(i,time,reduced.matches,false))drawRibbon(ctx,i,section,false,1);
    drawFace(ctx,time,state,reduced.matches,1);
    // Front arcs remain continuous behind the face silhouette: no dangling strand ends.
    ctx.save();ctx.beginPath();ctx.rect(-700,-700,1400,1400);ctx.ellipse(0,-4,151,104,-.088,0,TWO_PI);ctx.clip('evenodd');
    for(let i=0;i<4;i++)for(const section of ribbonParts(i,time,reduced.matches,true))drawRibbon(ctx,i,section,true,1);
    ctx.restore();
    ctx.restore();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {update(next){state=next;},dispose(){live=false;observer.disconnect();window.removeEventListener('resize',resize);}};
}
