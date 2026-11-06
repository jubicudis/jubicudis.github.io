// Violet, Structured Bloom. This is the website's interactive character, not TNOS cognition.
// Four coupled, independently deformable continuous bands are projected and shaded in Canvas 2D.
// The band surface is an actual mesh of wide polygonal panels, not a stack of glowing strokes.
const TWO_PI=Math.PI*2;
const COLORS=[
  {light:'#efbaff',top:'#c47cff',base:'#8844e8',shade:'#3a1c8e',deep:'#160c43',rim:'#f1c1ff',glow:'#b047ff',chips:'#ffb7fa'},
  {light:'#b2faff',top:'#56dcff',base:'#158fee',shade:'#183dba',deep:'#0c245e',rim:'#a6fbff',glow:'#21b9ff',chips:'#a5faff'},
  {light:'#fff2b5',top:'#ffcf68',base:'#f4a641',shade:'#a45c91',deep:'#683668',rim:'#ffdfa1',glow:'#ffb347',chips:'#fff5c6'},
  {light:'#dec1ff',top:'#b476ff',base:'#6736cc',shade:'#301a80',deep:'#170f47',rim:'#dfb8ff',glow:'#974bf5',chips:'#ffe59d'}
];
// The original four-piece chassis is preserved. Each loop can respond separately,
// but all four inherit the same bounded center-of-mass motion.
const BANDS=[
  {major:235,minor:147,rx:.39,ry:.10,rz:-.49,start:.06,bias:.35,width:51},
  {major:227,minor:145,rx:-.30,ry:.35,rz:.79,start:1.16,bias:-.29,width:53},
  {major:233,minor:130,rx:1.02,ry:-.12,rz:.03,start:2.52,bias:.51,width:50},
  {major:221,minor:148,rx:.28,ry:.52,rz:-.73,start:3.26,bias:-.19,width:54}
];
function clamp(value,lo,hi){return Math.min(hi,Math.max(lo,value));}
function mix(a,b,t){return a+(b-a)*t;}
function ease(t){t=clamp(t,0,1);return 1-(1-t)*(1-t)*(1-t);}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TWO_PI);if(fill){ctx.fillStyle=fill;ctx.fill();}else{ctx.stroke();}}
function pathPoints(ctx,points){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);}
function pointOnBand(band,k,t,i,reduced){
  const time=reduced?0:t;
  const shared=.014*Math.sin(time*.63);
  const local=.025*Math.sin(time*(.4+i*.075)+i*1.6);
  const rx=band.rx+shared*.8+local*.35;
  const ry=band.ry+local*.22;
  const rz=band.rz+local*.55;
  const theta=band.start+k*TWO_PI+(reduced?0:.008*Math.sin(time*.8+i*.6));
  const breathe=1+(reduced?0:.010*Math.sin(2*theta+time*.7+i));
  let x=Math.cos(theta)*band.major*breathe;
  let y=Math.sin(theta)*band.minor;
  let z=band.bias*42*Math.sin(theta*2+i);
  let yy=y*Math.cos(rx)-z*Math.sin(rx),zz=y*Math.sin(rx)+z*Math.cos(rx);y=yy;z=zz;
  let xx=x*Math.cos(ry)+z*Math.sin(ry);zz=-x*Math.sin(ry)+z*Math.cos(ry);x=xx;z=zz;
  xx=x*Math.cos(rz)-y*Math.sin(rz);yy=x*Math.sin(rz)+y*Math.cos(rz);x=xx;y=yy;
  const perspective=760/(760-z);
  return {x:x*perspective,y:y*perspective,z,theta,k};
}
function fullBand(index,time,reduced){
 const band=BANDS[index],count=240,points=[];
 for(let j=0;j<=count;j++){const pt=pointOnBand(band,j/count,time,index,reduced);pt.step=j;pt.width=band.width*(.97+.04*Math.cos(pt.theta*2+index));points.push(pt);}
 return points;
}
function sweepParts(index,time,reduced,front){
  const ribbon=BANDS[index],points=[],result=[];
  const count=240;
  for(let j=0;j<=count;j++){
    const pt=pointOnBand(ribbon,j/count,time,index,reduced);pt.step=j;
    pt.width=ribbon.width*(.97+.04*Math.cos(pt.theta*2+index));
    // Interpolate the 3D depth boundary within the polygon, avoiding abrupt ends.
    if(points.length){
      const old=points[points.length-1];
      if((old.z>=0)!==(pt.z>=0)){
        const fraction=clamp(Math.abs(old.z)/(Math.abs(old.z)+Math.abs(pt.z)||1),0,1);
        const crossing={x:mix(old.x,pt.x,fraction),y:mix(old.y,pt.y,fraction),z:0,
          step:mix(old.step,pt.step,fraction),width:mix(old.width,pt.width,fraction)};
        points.push(crossing);result.push(points.splice(0));points.push(crossing);
      }
    }
    points.push(pt);
  }
  if(points.length>1)result.push(points);
  return result.filter(s=>s.length>1 && (s[Math.floor(s.length/2)].z>=0)===front);
}
function edges(points,scale=1){
  return points.map((p,i)=>{
    const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
    const dx=next.x-prev.x,dy=next.y-prev.y;
    const len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    const radius=p.width*.5*scale;
    return {...p,nx,ny,l:{x:p.x+nx*radius,y:p.y+ny*radius},r:{x:p.x-nx*radius,y:p.y-ny*radius}};
  });
}
function strip(ctx,points,left,right){
  if(points.length<2)return;
  ctx.beginPath();
  const first=points[0];
  ctx.moveTo(first.x+first.nx*first.width*left,first.y+first.ny*first.width*left);
  for(let i=1;i<points.length;i++){
    const p=points[i];ctx.lineTo(p.x+p.nx*p.width*left,p.y+p.ny*p.width*left);
  }
  for(let i=points.length-1;i>=0;i--){
    const p=points[i];ctx.lineTo(p.x+p.nx*p.width*right,p.y+p.ny*p.width*right);
  }
  ctx.closePath();
}
function outline(ctx,points){
  ctx.beginPath();ctx.moveTo(points[0].l.x,points[0].l.y);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i].l.x,points[i].l.y);
  for(let i=points.length-1;i>=0;i--)ctx.lineTo(points[i].r.x,points[i].r.y);
  ctx.closePath();
}
function traceEdge(ctx,points,which){
  ctx.beginPath();ctx.moveTo(points[0][which].x,points[0][which].y);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][which].x,points[i][which].y);
}
function surfaceGradient(ctx,palette,p,shadeFactor=1){
  const half=p.width/2;
  const g=ctx.createLinearGradient(p.x+p.nx*half,p.y+p.ny*half,p.x-p.nx*half,p.y-p.ny*half);
  g.addColorStop(0,palette.light);
  g.addColorStop(.075,palette.top);
  g.addColorStop(.19,palette.base);
  g.addColorStop(.43,palette.shade);
  g.addColorStop(.68,palette.base);
  g.addColorStop(.89,palette.deep);
  g.addColorStop(1,palette.top);
  return g;
}
function drawPanelSeam(ctx,points,index,palette,front){
  const p=points[index];if(!p)return;
  ctx.save();ctx.lineCap='round';
  const cx=p.x,cy=p.y,nx=p.nx,ny=p.ny;
  ctx.beginPath();ctx.moveTo(cx+nx*p.width*.43,cy+ny*p.width*.43);
  ctx.lineTo(cx-nx*p.width*.43,cy-ny*p.width*.43);
  ctx.strokeStyle=front?'rgba(25,13,74,.42)':'rgba(21,10,61,.28)';ctx.lineWidth=1.6;ctx.stroke();
  ctx.translate(p.nx*2,p.ny*2);
  ctx.strokeStyle=palette.rim;ctx.globalAlpha=front?.23:.09;ctx.lineWidth=.9;ctx.stroke();
  ctx.restore();
}
function drawBand(ctx,index,raw,front){
  if(raw.length<2)return;
  const points=edges(raw),color=COLORS[index];
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  // Deep contact shadow creates separation where materials cross.
  ctx.shadowBlur=front?25:15;ctx.shadowColor=color.glow;
  outline(ctx,points);ctx.globalAlpha=front?.27:.15;ctx.fillStyle=color.glow;ctx.fill();
  ctx.shadowBlur=0;ctx.globalAlpha=front?1:.86;
  outline(ctx,points);ctx.fillStyle=color.deep;ctx.fill();
  // Dense shaped surfaces rather than linear strokes: each panel has its own
  // tangent-aware cross-band gradient, which rotates naturally around the loop.
  const sectionSize=27;
  for(let start=0;start<points.length-1;start+=sectionSize){
    const end=Math.min(points.length,start+sectionSize+1),panel=points.slice(start,end);
    if(panel.length<2)continue;
    const mid=panel[Math.floor(panel.length/2)];
    strip(ctx,panel,.485,-.485);
    ctx.fillStyle=surfaceGradient(ctx,color,mid);
    ctx.fill();
    // An inset glossy ceramic/enamel panel. Narrow seams retain a solid band silhouette.
    strip(ctx,panel,.32,-.28);
    ctx.globalAlpha=front?.13:.09;ctx.fillStyle=color.rim;ctx.fill();
    ctx.globalAlpha=front?1:.86;
  }
  // Rounded bevel, illuminated outer edge, and a dark inner contour.
  strip(ctx,points,.50,.40);ctx.fillStyle=color.top;ctx.globalAlpha=front?.86:.5;ctx.fill();
  strip(ctx,points,-.40,-.50);ctx.fillStyle=color.deep;ctx.globalAlpha=.84;ctx.fill();
  ctx.globalAlpha=front?.92:.55;
  traceEdge(ctx,points,'l');ctx.strokeStyle=color.rim;ctx.lineWidth=2.5;
  ctx.shadowBlur=front?10:3;ctx.shadowColor=color.rim;ctx.stroke();ctx.shadowBlur=0;
  ctx.globalAlpha=front?.54:.24;
  traceEdge(ctx,points,'r');ctx.strokeStyle=color.top;ctx.lineWidth=1.45;ctx.stroke();
  ctx.globalAlpha=front?1:.8;
  for(let s=27;s<points.length-6;s+=27)drawPanelSeam(ctx,points,s,color,front);
  // Short luminous interface marks sit on their own curved panel and move with it.
  // These are material details, not extra floating strands.
  for(let s=26;s<points.length-16;s+=90){
    const p=points[s];
    if(p.step%240>180)continue;
    const dx=points[Math.min(s+2,points.length-1)].x-points[Math.max(s-2,0)].x;
    const dy=points[Math.min(s+2,points.length-1)].y-points[Math.max(s-2,0)].y;
    const len=Math.hypot(dx,dy)||1,tx=dx/len,ty=dy/len;
    ctx.save();ctx.lineCap='round';ctx.strokeStyle=color.chips;ctx.lineWidth=3.6;ctx.shadowColor=color.chips;ctx.shadowBlur=7;
    for(let j=0;j<3;j++){
      const px=p.x+p.nx*(j-1)*8,py=p.y+p.ny*(j-1)*8;
      ctx.beginPath();ctx.moveTo(px-tx*5,py-ty*5);ctx.lineTo(px+tx*5,py+ty*5);ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
function drawFaceShape(ctx,inset=0){
  // The asymmetric contour reads as a formed surface, not an independent head.
  ctx.beginPath();
  const s=1-inset;
  ctx.moveTo(-146*s,-18*s);
  ctx.bezierCurveTo(-153*s,-78*s,-86*s,-102*s,-5*s,-99*s);
  ctx.bezierCurveTo(96*s,-106*s,149*s,-69*s,151*s,-14*s);
  ctx.bezierCurveTo(158*s,46*s,92*s,99*s,0,100*s);
  ctx.bezierCurveTo(-105*s,105*s,-148*s,58*s,-146*s,-18*s);
  ctx.closePath();
}
function drawEye(ctx,x,y,open,blink){
  ctx.save();ctx.translate(x,y);ctx.shadowBlur=19;ctx.shadowColor='#ca82ff';
  if(open&&blink<.6){
    const g=ctx.createLinearGradient(0,-18,0,17);g.addColorStop(0,'#fff9ff');g.addColorStop(.72,'#f0d2ff');g.addColorStop(1,'#c89dfb');
    ellipse(ctx,0,0,12,19,g);ellipse(ctx,2,4,4.1,8,'#7043c1');
    ellipse(ctx,-3,-7,2.8,4.3,'#fff');
  }else{
    // A filled, tapering crescent has more character and polish than a blunt line.
    ctx.beginPath();ctx.moveTo(-29,11);ctx.bezierCurveTo(-24,-8,-8,-24,2,-24);
    ctx.bezierCurveTo(17,-23,30,-8,31,10);
    ctx.bezierCurveTo(30,18,24,16,19,10);
    ctx.bezierCurveTo(11,-1,-2,-6,-12,2);
    ctx.bezierCurveTo(-19,7,-22,13,-27,15);ctx.quadraticCurveTo(-30,15,-29,11);
    const g=ctx.createLinearGradient(0,-28,0,16);g.addColorStop(0,'#fff7ff');g.addColorStop(.72,'#efceff');g.addColorStop(1,'#bf91ff');
    ctx.fillStyle=g;ctx.fill();
    if(blink>.05){ctx.globalAlpha=1-blink;ctx.fill();}
  }
  ctx.restore();
}
function drawFace(ctx,time,state,reduced){
  const t=reduced?0:time;
  ctx.save();ctx.translate(0,reduced?0:2.6*Math.sin(t*1.0));
  ctx.rotate(-.10+(reduced?0:.012*Math.sin(t*.7)));
  // Neckless integrated OLED-like core, with real rim thickness and reflected light.
  ctx.shadowColor='#a34dff';ctx.shadowBlur=33;
  drawFaceShape(ctx,-.025);
  const bezel=ctx.createLinearGradient(-150,-80,155,105);
  bezel.addColorStop(0,'#f8c6ff');bezel.addColorStop(.22,'#954dff');bezel.addColorStop(.50,'#45248a');bezel.addColorStop(.75,'#52b6ff');bezel.addColorStop(1,'#bc63ff');
  ctx.fillStyle=bezel;ctx.fill();ctx.shadowBlur=0;
  drawFaceShape(ctx,.015);
  let surface=ctx.createRadialGradient(-55,-57,8,9,12,186);
  surface.addColorStop(0,'#433475');surface.addColorStop(.25,'#231c51');surface.addColorStop(.6,'#100f2f');surface.addColorStop(.88,'#0c0c25');surface.addColorStop(1,'#291447');
  ctx.fillStyle=surface;ctx.fill();
  ctx.save();drawFaceShape(ctx,.015);ctx.clip();
  const sheen=ctx.createLinearGradient(-80,-93,72,92);
  sheen.addColorStop(0,'rgba(173,122,254,.18)');sheen.addColorStop(.39,'rgba(133,87,223,.025)');sheen.addColorStop(.61,'rgba(59,39,107,.02)');sheen.addColorStop(1,'rgba(56,137,239,.15)');
  ctx.fillStyle=sheen;ctx.fillRect(-180,-125,360,260);
  ctx.beginPath();ctx.ellipse(-19,-76,125,37,-.095,3.18,5.85);
  ctx.strokeStyle='rgba(251,218,255,.17)';ctx.lineWidth=3.8;ctx.stroke();
  ctx.restore();
  ctx.save();drawFaceShape(ctx,.016);ctx.strokeStyle='rgba(239,196,255,.63)';ctx.lineWidth=2.1;ctx.stroke();ctx.restore();
  const blink=reduced?0:Math.pow(Math.max(0,1-Math.abs(((t+1.6)%6.5)-6.18)/.16),2);
  const open=state.phase==='asking-name'&&!state.speaking;
  drawEye(ctx,-57,-16,open,blink);drawEye(ctx,57,-16,open,blink);
  ctx.save();ctx.shadowColor='#be78ff';ctx.shadowBlur=14;
  if(state.speaking){
    const talk=7+5.5*Math.abs(Math.sin(t*8.2));
    const g=ctx.createLinearGradient(0,35,0,64);g.addColorStop(0,'#ffeaff');g.addColorStop(1,'#dfb1ff');
    ctx.beginPath();ctx.moveTo(-26,38);ctx.quadraticCurveTo(0,42,26,38);
    ctx.quadraticCurveTo(28,48+talk,0,53+talk);
    ctx.quadraticCurveTo(-28,48+talk,-26,38);ctx.fillStyle=g;ctx.fill();
  }else{
    ctx.beginPath();ctx.moveTo(-29,38);ctx.quadraticCurveTo(0,47,29,38);
    ctx.quadraticCurveTo(28,67,0,66);ctx.quadraticCurveTo(-28,67,-29,38);
    const g=ctx.createLinearGradient(0,38,0,66);g.addColorStop(0,'#fff7ff');g.addColorStop(1,'#d89fff');
    ctx.fillStyle=g;ctx.fill();
  }
  ctx.restore();ctx.restore();
}
function drawStage(ctx,w,h,cx,cy,scale,time,active,reduced){
  const background=ctx.createRadialGradient(cx,cy-55*scale,40*scale,cx,cy,Math.max(w,h)*.9);
  background.addColorStop(0,'#1b1642');background.addColorStop(.42,'#0e112b');background.addColorStop(1,'#060917');
  ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
  // Soft central ambient occlusion, not a bright cloud around the silhouette.
  const light=ctx.createRadialGradient(cx,cy+10*scale,20,cx,cy+10*scale,340*scale);
  light.addColorStop(0,'rgba(113,63,228,.13)');light.addColorStop(.6,'rgba(65,34,140,.05)');light.addColorStop(1,'rgba(30,18,85,0)');
  ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
  for(let i=0;i<45;i++){
    const u=(Math.sin(i*129.77+6.63)*179.11)%1,v=(Math.sin(i*78.32+3.07)*224.31)%1;
    const px=(u<0?u+1:u)*w,py=(v<0?v+1:v)*h;
    const alpha=.1+.1*(1+Math.sin((reduced?0:time)*.3+i));
    ellipse(ctx,px,py,i%8===0?1.1:.6,i%8===0?1.1:.6,`rgba(174,184,252,${alpha})`);
  }
  ctx.save();ctx.translate(cx,cy+251*scale);ctx.scale(scale,scale);
  const halo=ctx.createRadialGradient(0,0,4,0,0,280);
  halo.addColorStop(0,active?'rgba(110,78,227,.27)':'rgba(110,78,227,.17)');
  halo.addColorStop(.62,'rgba(73,63,193,.045)');halo.addColorStop(1,'rgba(73,63,193,0)');
  ellipse(ctx,0,0,300,79,halo);
  for(const [rx,ry,color,lineWidth] of [[252,45,'rgba(103,76,229,.38)',2],[204,33,'rgba(49,186,255,.5)',2.6],[144,21,'rgba(185,103,250,.3)',1.3]]){
    ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TWO_PI);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();
  }
  ctx.restore();
}
export function createVioletEnvironment(canvas){
  const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
  if(!ctx)throw new Error('Violet requires Canvas 2D');
  let state={phase:'dormant',speaking:false,enteredAt:0};
  let cssW=1,cssH=1,dpr=1,live=true,lastFrame=-Infinity;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const start=performance.now();
  function resize(){
    const rect=canvas.getBoundingClientRect();
    cssW=Math.max(1,rect.width);cssH=Math.max(1,rect.height);
    // Keep fine bevels on retina displays without rendering gratuitous 4x pixels.
    dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);
  }
  resize();window.addEventListener('resize',resize,{passive:true});
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function frame(now){
    if(!live)return;
    requestAnimationFrame(frame);
    // 30 fps animated rendering / 1 still frame for reduced motion. Saves mobile battery.
    if(now-lastFrame<(reduced.matches?1000:32))return;
    lastFrame=now;
    const time=reduced.matches?0:(now-start)/1000;
    const active=state.phase!=='dormant';
    const reveal=active?ease((now-state.enteredAt)/1500):0;
    const scale=Math.min(cssW/680,cssH/750,1.22);
    const cx=cssW/2,cy=cssH*(active?mix(.475,.425,reveal):.475);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    drawStage(ctx,cssW,cssH,cx,cy,scale,time,active,reduced.matches);
    ctx.save();ctx.translate(cx,cy);ctx.scale(scale*1.06,scale*1.06);
    for(let i=0;i<4;i++)drawBand(ctx,i,fullBand(i,time,reduced.matches),false);
    drawFace(ctx,time,state,reduced.matches);
    // Front structure passes around the face like a continuous framed surface.
    // Clipping excludes only the OLED expression surface, leaving the bevel seated in the frame.
    ctx.save();ctx.beginPath();ctx.rect(-700,-700,1400,1400);
    drawFaceShape(ctx,.002);ctx.clip('evenodd');
    for(let i=0;i<4;i++)for(const part of sweepParts(i,time,reduced.matches,true))drawBand(ctx,i,part,true);
    ctx.restore();
    // Edge reflection joins the expressive glass surface visually to the chassis.
    ctx.save();ctx.rotate(-.1);drawFaceShape(ctx,.009);
    ctx.strokeStyle='rgba(240,182,255,.38)';ctx.lineWidth=1.25;ctx.shadowColor='#aa58fa';ctx.shadowBlur=4;ctx.stroke();ctx.restore();
    ctx.restore();
  }
  requestAnimationFrame(frame);
  return {update(next){state=next;},dispose(){live=false;observer.disconnect();window.removeEventListener('resize',resize);}};
}
