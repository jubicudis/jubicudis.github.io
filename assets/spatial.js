/* Violet • TNOS browser experience study.
   A visual model of the future interface, NOT TNOS native cognition.
   The narration is provisional and source-aligned with public Part I of the TNOS working master.
   Persistent scene, explicit intent, contextual explanation, outcome-qualified demonstration.
   Zero user analytics, cookies, backend, microphone or webcam. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const atmosphere = $('atmosphere'), spatial = $('spatial');
  const ctx = atmosphere.getContext('2d', {alpha:true});
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = [
    {id:'tnos', zone:'THE INVENTION',title:'An operating system that begins deeper.',
     brief:'TNOS is Jubi’s experimental effort to build intelligent computation into an operating system’s foundations—not simply install an AI assistant on top of an existing desktop.',
     detail:'The proposed architecture treats the physical machine and its running computational environment as related reference frames. Measured conditions and contextual relationships are intended to constrain the calculations that follow. This website is a visualization of the idea, not that native computation.',
     visual:'frames',status:'INTENDED ARCHITECTURE'},
    {id:'origin',zone:'THE REASON',title:'It began with a problem that kept repeating.',
     brief:'While building a Minecraft and Discord universe, Jubi repeatedly lost important context when AI conversations became too long. Models also filled missing information with guesses. That practical problem led to TranquilSpeak, then TNOS.',
     detail:'A model could understand a message without possessing all the details from the original conversation. Jubi’s response was to investigate how established state, causality and contextual relationships could become part of the underlying computing architecture.',
     visual:'timeline',status:'INVENTOR’S ACCOUNT'},
    {id:'context',zone:'CONTEXT / SEVEN DIMENSIONS',title:'A response should depend on its context.',
     brief:'Who. What. When. Where. Why. How. To what extent. TNOS uses these seven contextual questions as part of its proposed computational approach. Here, the surrounding relationships move with the subject being discussed.',
     detail:'On this website, those seven questions guide which explanation is shown, at what depth, and how the visual environment responds. That is presentation logic, not a claim that the browser is executing native TranquilSpeak mathematics.',
     visual:'seven',status:'DESIGN PRINCIPLE'},
    {id:'architecture',zone:'PHYSICAL / COMPUTATIONAL',title:'The computer has a physical state.',
     brief:'TNOS is designed to connect information about a machine’s actual operating conditions with the calculations it performs. Collecting a measurement, interpreting it and establishing the resulting state are different responsibilities.',
     detail:'The intended nine-stage cognitive architecture preserves dependencies across grounding, thought, action, observation and feedback. Targeted software relationships have been exercised, but complete native-kernel-to-cognition execution remains unverified.',
     visual:'frames',status:'ARCHITECTURE / NOT END-TO-END VERIFIED'},
    {id:'workbench',zone:'THE ENGINEERING ENVIRONMENT',title:'A command is not the same as a result.',
     brief:'Jubi is also building the TNOS Workbench: a separate engineering environment for constructing, observing and investigating the system. Its spatial apparatus and observation mechanisms are under active development.',
     detail:'Try the browser-only carriage illustration. Request a movement, then see whether the rendered model reached the specified position. It illustrates the distinction between requested and observed outcomes; it is not connected to the real Workbench.',
     visual:'workbench',status:'WORKBENCH PARTIALLY IMPLEMENTED'},
    {id:'mcp',zone:'CONNECTIONS / SEPARATE PRODUCT',title:'A different way to connect external tools.',
     brief:'TNOS also has a separate MCP-server effort for communication with external systems and development tools. It should not be confused with the native operating system or the Workbench.',
     detail:'The connections in this environment depict product relationships. They are explanatory geometry, not live connections to external programs and not evidence that the three products are fully integrated.',
     visual:'network',status:'SEPARATE DEVELOPMENT EFFORT'},
    {id:'support',zone:'WHAT CONTINUED WORK REQUIRES',title:'The invention is still being built.',
     brief:'Jubi has built native operating-system components and a bootable kernel and ISO, alongside ongoing Workbench development. The comprehensive TNOS vision remains in progress. Sponsorship would help with equipment, AI programming tools and development time.',
     detail:'Supporting the project is not purchasing a finished operating system. It is a voluntary way to help continue investigation, construction, verification and integration. You can explore the work here before deciding whether to sponsor.',
     visual:'progress',status:'DEVELOPMENT IN PROGRESS'}
  ];
  const chapterById = new Map(chapters.map(c=>[c.id,c]));
  const state = {mode:'greeting',index:0,topic:'tnos',checkpoint:null,name:null,depth:'overview',intent:'arrived',
    sceneVersion:0,sceneStarted:performance.now(),qualified:false,requested:false,observed:false,
    mechanics:0,mechanicsTarget:0,mechanicsResult:null,motion:!motionPreference.matches, threeReady:false};
  const positions = {};
  const text = {heading:$('headline'),caption:$('caption'),speaker:$('speaker-name'),zone:$('zone-id'),count:$('scene-count'),
    note:$('state-note'),phase:$('phase-readout'),clarify:$('clarification'),action:$('continue'),explore:$('explore'),
    returning:$('return'),depth:$('depth'),sponsor:$('sponsor'),observe:$('observe'),name:$('name-prompt'),interaction:$('interaction')};
  const palette = {a:'#bda6ff',b:'#7ddbef',c:'#d6e8ff'};
  let W=1,H=1,DPR=1,world=null,hotspots=[];
  let pointerX=0,pointerY=0;
  const mobile=()=>W<800;
  const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
  const now=()=>performance.now();
  const active=()=>chapterById.get(state.topic)||chapters[0];
  function updateContext(intent) { state.intent=intent; state.sceneVersion++; state.sceneStarted=now(); state.qualified=false;
    const key=state.sceneVersion;
    requestAnimationFrame(()=>requestAnimationFrame(()=> {
      // A DOM/layout observation, not a claim of human comprehension.
      if(key!==state.sceneVersion || (state.mode==='explore' && state.topic===null)) return;
      const rect=text.caption.getBoundingClientRect();
      if(rect.width>0 && rect.height>0 && text.caption.textContent.trim()) {
        state.qualified=true; if(state.mode==='talk') text.action.disabled=false;
      }
    }));
  }
  function context7(){return {
    who:state.name||'visitor', what:state.topic||'subject chooser', when:state.mode,
    where:'this unified visual environment', why:state.intent,
    how:state.motion?'animated visual + text':'still visual + text',extent:state.depth
  };}
  function isVisibleControl(element) {
    return element && element.isConnected && !element.disabled &&
      element.getClientRects().length > 0 &&
      !element.closest('[hidden]');
  }
  function restoreFocus(previous) {
    // Preserve keyboard focus when a scene replaces or hides the active control.
    if (!previous || previous===document.body || previous===document.documentElement) return;
    if (isVisibleControl(previous)) return;
    const previousTopic=previous.dataset?.topic;
    if (previousTopic) {
      const matching=[...$('node-field').querySelectorAll('button')].find(b=>b.dataset.topic===previousTopic);
      if (isVisibleControl(matching)) { matching.focus({preventScroll:true}); return; }
    }
    if (state.mode==='explore' && state.topic===null) {
      const first=$('node-field').querySelector('button');
      if (isVisibleControl(first)) { first.focus({preventScroll:true}); return; }
    }
    // The transcript is a stable, visible reading and keyboard-navigation anchor.
    $('transcript').focus({preventScroll:true});
  }
  function switchScene(topic,intent){
    if(topic!==null && !chapterById.has(topic))return;
    const previous=document.activeElement;
    state.topic=topic;state.mechanicsResult=null;state.requested=false;state.observed=false;
    updateContext(intent);
    renderText();renderNodes();
    restoreFocus(previous);
  }
  function renderText(){
    const chapter=active(); const greeting=state.mode==='greeting';
    text.name.hidden=!greeting;text.interaction.hidden=greeting;
    if(greeting){
      text.heading.textContent='A computer that meets you here.';
      text.caption.textContent="Hello. I'm Violet—the proposed AI interface to Jubi’s Tranquility Neuro Operating System. What should I call you?";
      text.zone.textContent='SYSTEM / ARRIVAL';text.count.textContent='01 — 07';
      text.clarify.textContent='This is a visual design study, not a functioning TNOS AI.';
      text.phase.textContent='ESTABLISHING COMMUNICATION';
      text.note.textContent='Your name stays in this browser tab and is never transmitted to us.';
    }else if(state.mode==='explore' && state.topic===null){
      text.heading.textContent='Where would you like to look?';
      text.caption.textContent='Choose one of the subjects around Violet. You can follow a connection, examine an explanation, or return to the introduction without losing your place.';
      text.zone.textContent='SYSTEM / SUBJECT EXPLORATION';
      text.count.textContent='FREE EXPLORATION';
      text.clarify.textContent='The surrounding geometry represents available subjects; it is not a claim of working native TNOS cognition.';
      text.phase.textContent='AWAITING A SUBJECT';
      text.note.textContent='Select a subject to examine. No earlier result is being presented as a new observation.';
    }else{
      const personal=state.name&&state.index===0&&state.mode==='talk'?' '+state.name+',': '';
      text.heading.textContent=chapter.title;
      text.caption.textContent=chapter.brief;
      if(personal && state.mode==='talk' && state.index===0) text.caption.textContent=`${state.name}, `+chapter.brief;
      if(state.depth==='detail' && state.mode==='explore') text.caption.textContent=chapter.brief+' '+chapter.detail;
      text.zone.textContent=chapter.zone;
      text.count.textContent=state.mode==='explore'?'FREE EXPLORATION':String(state.index+1).padStart(2,'0')+' — 07';
      text.clarify.textContent=chapter.status+' · 3D/2D visualizations are explanatory models, not evidence of native TNOS execution.';
      text.phase.textContent=state.mode==='talk'?'GUIDED PRESENTATION':'OPEN EXPLORATION';
      text.note.textContent=state.mechanicsResult||'';
    }
    text.action.hidden=state.mode==='explore';
    text.action.disabled=state.mode==='talk'&&!state.qualified;
    text.action.innerHTML=(state.index===chapters.length-1?'ENTER EXPLORATION':'CONTINUE')+' <span aria-hidden="true">↗</span>';
    text.explore.hidden=state.mode==='explore';
    text.returning.hidden=state.mode!=='explore'||state.checkpoint===null;
    text.depth.hidden=state.mode!=='explore'||state.topic===null;
    text.depth.textContent=state.depth==='overview'?'GO DEEPER ＋':'BACK TO OVERVIEW −';
    text.observe.hidden=state.mode==='greeting'||state.topic===null||chapter.id!=='workbench';
    text.observe.textContent=state.requested?'MOVEMENT REQUESTED…':'TEST REQUESTED RESULT ⟶';
    text.observe.disabled=state.requested;
    text.sponsor.hidden=state.mode==='greeting'||state.topic===null||chapter.id!=='support';
    $('previous').hidden=state.mode!=='talk'||state.index===0;
    const pct=state.mode==='greeting'?0:(state.index+1)/chapters.length*100;
    document.querySelector('.progress').style.setProperty('--pct',pct+'%');
    document.querySelector('.progress').setAttribute('aria-valuenow',state.mode==='greeting'?0:state.index+1);
  }
  function start(name){state.name=(typeof name==='string'&&name.trim())?name.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,48):null;
    state.mode='talk';state.index=0;state.depth='overview';state.checkpoint=null;
    switchScene(chapters[0].id,'accepted the introduction');}
  function next(){if(state.mode!=='talk'||!state.qualified)return;
    if(state.index+1>=chapters.length){state.mode='explore';state.checkpoint=null;state.depth='overview';
      switchScene(null,'completed the introduction');return;}
    state.index++;switchScene(chapters[state.index].id,'continued the introduction');}
  function prev(){if(state.mode!=='talk'||state.index<=0)return;state.index--;
    switchScene(chapters[state.index].id,'returned to an earlier passage');}
  function explore(){if(state.mode==='greeting'){start(null);}
    if(state.mode==='talk'){state.checkpoint=state.index;}
    state.mode='explore';state.depth='overview';
    switchScene(null,'chose to explore');}
  function returnToTalk(){if(state.mode!=='explore'||state.checkpoint===null)return;
    state.index=state.checkpoint;state.checkpoint=null;state.mode='talk';state.depth='overview';
    switchScene(chapters[state.index].id,'returned to the presentation');}
  function chooseTopic(id){if(state.mode==='greeting')start(null);
    if(state.mode==='talk')state.checkpoint=state.index;
    state.mode='explore';state.depth='overview';
    switchScene(id,'explicitly selected '+id);}
  // The optional name is never submitted as a native GET form or placed in history.
  function isNameSubmissionKey(e, composing) {
    // Enter is also used to confirm IME candidates, not just to submit a name.
    // keyCode 229 covers IMEs (notably Safari) that end composition before
    // reporting the Enter keydown as no longer composing.
    return e.key==='Enter' && !composing && !e.isComposing && e.keyCode!==229;
  }
  const nameInput=$('preferred-name');
  let nameCompositionActive=false;
  nameInput.addEventListener('compositionstart',()=>{nameCompositionActive=true;});
  nameInput.addEventListener('compositionend',()=>{nameCompositionActive=false;});
  $('submit-name').addEventListener('click',()=>start(nameInput.value));
  nameInput.addEventListener('keydown',e=>{
    if(!isNameSubmissionKey(e,nameCompositionActive))return;
    e.preventDefault();
    start(nameInput.value);
  });
  $('skip-name').addEventListener('click',()=>start(null));
  text.action.addEventListener('click',next);
  $('previous').addEventListener('click',prev);
  text.explore.addEventListener('click',explore);
  text.returning.addEventListener('click',returnToTalk);
  text.depth.addEventListener('click',()=>{state.depth=state.depth==='overview'?'detail':'overview';switchScene(state.topic,'requested '+state.depth+' depth');});
  $('brand').addEventListener('click',e=>{e.preventDefault();state.mode='greeting';state.name=null;state.index=0;state.checkpoint=null;state.depth='overview';state.topic='tnos';updateContext('restarted');renderText();renderNodes();$('preferred-name').focus({preventScroll:true});});
  function syncMotionControl(){
    $('motion').textContent='MOTION / '+(state.motion?'ON':'OFF');
    $('motion').setAttribute('aria-pressed',String(state.motion));
  }
  syncMotionControl();
  $('motion').addEventListener('click',()=>{state.motion=!state.motion;syncMotionControl();});
  const help=$('help-sheet');$('help').addEventListener('click',()=>{help.hidden=!help.hidden;$('help').setAttribute('aria-expanded',String(!help.hidden));});
  $('close-help').addEventListener('click',()=>{help.hidden=true;$('help').setAttribute('aria-expanded','false');});
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||!help.hidden)return;
    if(e.key==='Escape'&&state.mode==='explore'){returnToTalk();}
    if(e.key==='ArrowRight'&&state.mode==='talk'&&state.qualified){next();}
    if(e.key==='ArrowLeft'&&state.mode==='talk'){prev();}
  });
  $('observe').addEventListener('click',()=>{
    if(active().id!=='workbench'||state.requested)return;
    state.mechanics=0;state.mechanicsTarget=1;state.mechanicsResult='Movement requested. Awaiting the model reaching the target position.';
    state.requested=true;state.observed=false;renderText();
  });
  window.addEventListener('pointermove',e=>{pointerX=clamp((e.clientX/innerWidth-.5)*2,-1,1);pointerY=clamp((e.clientY/innerHeight-.5)*2,-1,1);},{passive:true});

  // Subject choices are spatial anchors within the same environment, not site sections or pages.
  const polar=[[-.76,-.35],[-.38,-.72],[.12,-.88],[.66,-.66],[.85,.10],[.52,.73],[-.15,.84]];
  function anchorPositions(){
    if(mobile())return [[.15,.215],[.50,.175],[.85,.215],[.14,.32],[.86,.32],[.25,.41],[.75,.41]];
    return polar.map(([x,y])=>[.67+x*.245,.43+y*.245]);
  }
  function renderNodes(){
    const previouslyFocused=document.activeElement;
    const focusedTopic=previouslyFocused?.dataset?.topic;
    const container=$('node-field');container.hidden=state.mode!=='explore'||state.depth==='detail';container.classList.toggle('exploring',state.mode==='explore'&&state.depth!=='detail');
    container.replaceChildren();hotspots=[];
    if(state.mode!=='explore'||state.depth==='detail')return;
    anchorPositions().forEach(([x,y],i)=>{
      const chapter=chapters[i],b=document.createElement('button');
      b.className='constellation-node';b.type='button';b.dataset.topic=chapter.id;b.style.left=(x*100)+'%';b.style.top=(y*100)+'%';
      b.textContent=chapter.id==='tnos'?'TNOS':chapter.id==='mcp'?'MCP':chapter.id;
      b.setAttribute('aria-label','Explore '+chapter.id);b.setAttribute('aria-pressed',String(state.topic===chapter.id));
      b.addEventListener('click',()=>chooseTopic(chapter.id));container.append(b);hotspots.push([x,y]);
    });
    if (focusedTopic) {
      const replacement=[...container.querySelectorAll('button')].find(b=>b.dataset.topic===focusedTopic);
      if (isVisibleControl(replacement)) replacement.focus({preventScroll:true});
    }
  }
  function resize(){W=window.innerWidth;H=window.innerHeight;DPR=Math.min(window.devicePixelRatio||1,mobile()?1.4:1.8);
    atmosphere.width=Math.round(W*DPR);atmosphere.height=Math.round(H*DPR);
    atmosphere.style.width=W+'px';atmosphere.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);
    if(world)world.resize();renderNodes();}
  window.addEventListener('resize',resize,{passive:true});
  const stars=Array.from({length:130},(_,i)=>({x:fract(i*0.618033989+0.23),y:fract(i*0.754877666+.17),r:.35+fract(i*.43)*1.2,p:i*.27}));
  function fract(x){return x-Math.floor(x);}
  function line(a,b,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
  function dot(x,y,r,color,glow=0){ctx.save();if(glow){ctx.shadowBlur=glow;ctx.shadowColor=color;}ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();}
  function ellipse(cx,cy,rx,ry,rotation,color,width=1,dash=[]){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,rotation,0,Math.PI*2);ctx.stroke();ctx.restore();}
  function path(points,color,width=1,closed=false){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);if(closed)ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function txt(str,x,y,size=10,color='#b9d3e9',align='center'){ctx.font=`500 ${size}px system-ui, sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(str,x,y);}
  function drawAmbient(t){
    ctx.clearRect(0,0,W,H);
    const cx=mobile()?W*.50:W*.72,cy=mobile()?H*.3:H*.51;
    const grd=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*.58);
    grd.addColorStop(0,'rgba(81,55,146,.23)');grd.addColorStop(.4,'rgba(17,67,112,.12)');grd.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);
    for(const s of stars){const x=s.x*W,y=s.y*H;dot(x,y,s.r,`rgba(194,211,254,${.13+Math.sin(t*.55+s.p)*.07})`);}
    const floor=mobile()?H*.64:H*.77;
    for(let i=-11;i<=11;i++){
      const endx=W*.5+i*W*.14;
      line([W*.52,floor],[endx,H*1.02],'rgba(104,145,220,.11)',.7);
    }
    for(let i=1;i<16;i++){
      const sy=floor+Math.pow(i/16,2)*(H-floor);
      line([0,sy],[W,sy],`rgba(118,158,230,${.14*(1-i/20)})`,.8);
    }
    const pulse=state.motion?Math.sin(t*.38)*.035:0;
    for(let j=0;j<4;j++)ellipse(cx,cy,W*(mobile()?.41:.28)*(1+j*.17+pulse),H*(mobile()?.22:.37)*(1+j*.09),-.3,
      `rgba(${j%2?'131,210,248':'178,132,255'},${.22-j*.04})`,j===0?1.2:.65);
    // Spatial rails imply one continuous computing environment rather than separate panels.
    for(let i=0;i<5;i++){
      const angle=t*.08+i*Math.PI*2/5,x=cx+Math.cos(angle)*W*.26,y=cy+Math.sin(angle)*H*.29;
      line([cx,cy],[x,y],'rgba(135,151,236,.09)',.8);
    }
    return [cx,cy];
  }
  const violet2D={x:null,y:null,scale:null};
  function drawViolet2D(t,cx,cy){
    const explaining=state.mode!=='greeting';
    const targetX=mobile()?(explaining?W*.81:cx):(explaining?W*.89:cx);
    const targetY=mobile()?(explaining?H*.25:cy):(explaining?H*.47:cy);
    const base=mobile()?Math.min(W/390,.92)*.8:clamp(W/1330,.77,1.2);
    const targetScale=base*(explaining?.53:1);
    if(violet2D.x===null){violet2D.x=cx;violet2D.y=cy;violet2D.scale=base;}
    const easing=state.motion?.06:1;
    violet2D.x+=(targetX-violet2D.x)*easing;
    violet2D.y+=(targetY-violet2D.y)*easing;
    violet2D.scale+=(targetScale-violet2D.scale)*easing;
    ctx.save();ctx.translate(violet2D.x,violet2D.y);ctx.scale(violet2D.scale,violet2D.scale);
    const sway=state.motion?Math.sin(t*.72)*6:0;
    ctx.translate(0,sway);
    // An articulated interface presence: a face-like lattice growing from the environment, not a body or orb.
    const outer=[[-104,-122],[-128,-67],[-119,6],[-84,82],[-24,132],[23,132],[87,80],[120,7],[126,-66],[100,-124]];
    ctx.shadowColor='#a787ff';ctx.shadowBlur=20;
    path(outer,'rgba(181,153,255,.76)',2.5);
    const inner=[[-82,-102],[-96,-49],[-84,19],[-48,66],[0,89],[47,66],[85,20],[98,-45],[81,-102]];
    path(inner,'rgba(107,220,250,.58)',1.8);
    ctx.shadowBlur=0;
    path([[-124,-22],[-180,26],[-163,89],[-108,115],[-47,134]],'rgba(112,181,255,.38)',1.6);
    path([[124,-22],[180,26],[163,89],[108,115],[47,134]],'rgba(187,125,255,.35)',1.6);
    for(let i=0;i<12;i++){
      const a=t*.32+i*.52,rx=150+Math.sin(i*1.77)*19,ry=114+Math.cos(i*2.13)*20;
      const x=Math.sin(a)*rx,y=Math.cos(a)*ry;
      dot(x,y,1.5,'rgba(157,187,255,.65)',6);
    }
    const eyeY=state.mode==='explore'?-17:-23;
    for(let side of [-1,1]){
      ctx.save();ctx.translate(side*46,eyeY);
      ctx.rotate(side*.1);ellipse(0,0,34,16,0,'rgba(154,216,255,.85)',2);
      dot(pointerX*5,0,6,'rgba(226,239,255,.95)',15);
      ctx.restore();
    }
    path([[-19,39],[-8,43],[0,44],[8,43],[19,39]],'rgba(193,171,255,.7)',2);
    const energy=state.motion?Math.sin(t*2)*7:0;
    ellipse(0,0,162+energy,176+energy,-.18,'rgba(144,169,252,.25)',.8,[3,8]);
    ctx.restore();
  }
  function drawRelations(t,cx,cy){
    const c=active(),m=mobile(),anchor=[m?W*.5:W*.67,m?H*.31:H*.49];
    if(state.mode==='greeting'||state.topic===null)return;
    if(state.mode==='explore' && state.depth==='overview'){
      const pts=anchorPositions().map(([x,y])=>[x*W,y*H]);
      ctx.save();
      for(let i=0;i<pts.length;i++){
        const a=pts[i],b=pts[(i+1)%pts.length];
        line(a,b,'rgba(140,182,244,.22)',.85);
        if(i%2===0)line(a,pts[(i+3)%pts.length],'rgba(176,145,240,.10)',.7);
      }
      const selected=chapters.findIndex(c=>c.id===state.topic);
      if(selected>=0){
        const p=pts[selected];
        pts.forEach((to,i)=>{if(i!==selected)line(p,to,'rgba(167,185,255,.12)',.7);});
        ellipse(p[0],p[1],13,13,0,'rgba(216,200,255,.62)',1);
      }
      ctx.restore();return;
    }
    const alpha=clamp((now()-state.sceneStarted)/850,0,1);ctx.save();ctx.globalAlpha=alpha;
    const radius=Math.min(m?W*.33:W*.19,H*.23);
    switch(c.visual){
      case 'seven':{
        const labels=['WHO','WHAT','WHEN','WHERE','WHY','HOW','EXTENT'];const ce=[m?W*.50:W*.69,m?H*.28:H*.44];
        labels.forEach((label,i)=>{
          const a=i*2*Math.PI/7-Math.PI/2+(state.motion?Math.sin(t*.12)*.03:0);
          const x=ce[0]+Math.cos(a)*radius*1.35,y=ce[1]+Math.sin(a)*radius*.93;
          line(ce,[x,y],'rgba(168,183,255,.28)');dot(x,y,3.5,'#c5b3ff',9);
          txt(label,x,y-15,m?9:11,'rgba(223,233,255,.95)');
        });
        ellipse(...ce,radius*.45,radius*.40,0,'rgba(142,228,240,.68)',2);
        txt('ESTABLISHED STATE',ce[0],ce[1]+radius*.55,m?8:10,'#a1d4ee');break;
      }
      case 'timeline':{
        const labs=['TRANQUILITY','CONTEXT LOST','TRANQUILSPEAK'];const x0=m?W*.20:W*.49,step=m?W*.30:W*.15,yy=m?H*.28:H*.36;
        const ps=[];
        for(let i=0;i<3;i++){
          const x=x0+i*step,y=yy+Math.sin(i*2)*23;ps.push([x,y]);dot(x,y,5,'#c4b2ff',13);
          txt(labs[i],x,y-23,m?8:10,'#d4d9fa');
        }
        for(let i=1;i<3;i++)line(ps[i-1],ps[i],'rgba(160,205,252,.72)',2);
        break;
      }
      case 'frames':{
        const x0=m?W*.30:W*.58, x1=m?W*.70:W*.84, y=m?H*.34:H*.44;
        ellipse(x0,y,radius*.64,radius*.57,-.3,'rgba(97,210,237,.68)',1.7);
        ellipse(x1,y,radius*.64,radius*.57,.3,'rgba(193,161,255,.68)',1.7);
        for(let i=-2;i<=2;i++){line([x0+radius*.55,y+i*8],[x1-radius*.55,y-i*8],'rgba(173,172,252,.32)',.7)}
        txt('PHYSICAL STATE',x0,y+radius*.75,m?8:10,'#9cddef');
        txt('COMPUTATION',x1,y+radius*.75,m?8:10,'#d3b8ff');break;
      }
      case 'workbench':{
        const x=m?W*.5:W*.74,y=m?H*.29:H*.46,unit=m?W*.23:W*.115;
        const a=[x-unit,y-unit*.44],b=[x+unit,y-unit*.44],d=[x-unit,y+unit*.44],e=[x+unit,y+unit*.44];
        path([a,b,e,d], '#9bcde8',1.1,true);
        line([x,y-unit*.78],[x,y+unit*.78],'rgba(171,144,255,.4)',1);
        const xx=x-unit*.74+state.mechanics*unit*1.48;
        path([[xx-12,y-17],[xx+12,y-17],[xx+12,y+17],[xx-12,y+17]], '#c4a3ff',2,true);
        txt('REQUEST',x-unit*.64,y-unit*.74,m?9:10,'#a5c7e6');
        txt('OBSERVE',x+unit*.65,y-unit*.74,m?9:10,'#d8c3ff');
        line([x+unit*.62,y-unit*.47],[x+unit*.62,y+unit*.47], 'rgba(219,192,255,.48)',1,[2,4]);
        break;
      }
      case 'network':{
        const ce=[m?W*.5:W*.73,m?H*.30:H*.45];
        const labs=['EXTERNAL TOOLS','MCP SERVER','TNOS'];
        const pts=[[ce[0]-radius*.8,ce[1]-radius*.65],[ce[0],ce[1]+radius*.38],[ce[0]+radius*.8,ce[1]-radius*.65]];
        line(pts[0],pts[1],'rgba(131,211,243,.73)',1.8);line(pts[1],pts[2],'rgba(194,162,255,.76)',1.8);
        pts.forEach((p,i)=>{dot(...p,7,i===1?'#cbb1ff':'#97d6ee',13);txt(labs[i],p[0],p[1]-24,m?8:10,'#d4e1fb')});break;
      }
      case 'progress':{
        const ce=[m?W*.5:W*.73,m?H*.31:H*.47],items=['KERNEL + ISO','WORKBENCH','FULL INTEGRATION'];
        for(let i=0;i<3;i++){
          const rr=radius*(.48+i*.36);
          ellipse(...ce,rr,rr*.67,.18,`rgba(156,185,245,${.6-i*.15})`,2,i===2?[7,8]:[]);
          txt(items[i],ce[0]+rr*.83,ce[1]-rr*.52,m?8:10,i===2?'#d5b2e9':'#b6d9f0');
        }
        break;
      }
    }
    ctx.restore();
  }
  function buildWorld(){
    // Use Three.js when the pinned ES module is reachable; the semantic canvas version is always available.
    import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js').then(THREE=>{
      if(!spatial.isConnected)return;
      const renderer=new THREE.WebGLRenderer({canvas:spatial,alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
      renderer.setClearColor(0,0);
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.z=12;
      scene.add(new THREE.AmbientLight(0x9fb4ff,1.45));
      const light=new THREE.PointLight(0xa28cff,35,20);light.position.set(2.5,3.8,4);scene.add(light);
      const cyan=new THREE.PointLight(0x7fe3ef,14,14);cyan.position.set(-3,-2,2);scene.add(cyan);
      const violet=new THREE.Group();scene.add(violet);
      function tube(pts,color,r=.015,opacity=.7,closed=false){
        const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),closed);
        const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(40,pts.length*13),r,7,closed),
          new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));violet.add(mesh);return mesh;
      }
      const outline=[[-1.05,1.05,.1],[-1.2,.65,.1],[-1.12,-.1,.05],[-.79,-.96,.04],[0,-1.32,0],[.79,-.96,.04],[1.12,-.1,.05],[1.2,.65,.1],[1.05,1.05,.1],[.3,1.40,0],[-.3,1.40,0]];
      tube(outline,0xc19aff,.021,.86,true);
      tube(outline.map(p=>[p[0]*.82,p[1]*.8,p[2]-.16]),0x84e5ed,.012,.63,true);
      tube([[-1.05,-.55,0],[-1.7,-.1,-.5],[-1.65,-1.1,-.3],[-.5,-1.65,-.2]],0x85c5ec,.012,.58);
      tube([[1.05,-.55,0],[1.7,-.1,-.5],[1.65,-1.1,-.3],[.5,-1.65,-.2]],0x9679dc,.012,.58);
      for(const sx of [-1,1]){
        tube([[sx*.31,.22,.29],[sx*.44,.32,.29],[sx*.68,.30,.28],[sx*.78,.20,.23],[sx*.68,.12,.3],[sx*.44,.14,.33],[sx*.31,.22,.29]],0xaedfff,.027,.9,true);
        const eye=new THREE.Mesh(new THREE.SphereGeometry(.055,14,10),new THREE.MeshBasicMaterial({color:0xedfaff}));eye.position.set(sx*.55,.23,.35);violet.add(eye);
      }
      tube([[-.24,-.38,.25],[-.10,-.44,.3],[0,-.45,.35],[.1,-.44,.3],[.24,-.38,.25]],0xa6bcff,.018,.9);
      const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.83,2),new THREE.MeshPhongMaterial({color:0x2e3a9f,emissive:0x372c81,emissiveIntensity:.2,transparent:true,opacity:.17,wireframe:true,side:THREE.DoubleSide,depthWrite:false}));violet.add(core);
      const orbit=[];
      for(let i=0;i<4;i++){const torus=new THREE.Mesh(new THREE.TorusGeometry(1.6+i*.20,.009,5,95),
        new THREE.MeshBasicMaterial({color:i%2?0x75cbe7:0xab89ed,transparent:true,opacity:.13,depthWrite:false}));
        torus.rotation.set(i*.29,i*.62,i*.18);violet.add(torus);orbit.push(torus);}
      const pData=new Float32Array(260*3);
      for(let i=0;i<260;i++){const a=i*2.399963,b=i/260*Math.PI*2;pData[i*3]=Math.cos(a)*(.5+b*.23);pData[i*3+1]=Math.sin(a)*(.5+b*.19);pData[i*3+2]=(Math.sin(i*9.3))*.5}
      const particlesGeo=new THREE.BufferGeometry();particlesGeo.setAttribute('position',new THREE.BufferAttribute(pData,3));
      const particles=new THREE.Points(particlesGeo,new THREE.PointsMaterial({size:.025,color:0xb9b3ff,transparent:true,opacity:.6,depthWrite:false}));violet.add(particles);
      violet.position.set(mobile()?0:2.4,mobile()?1.95:.1,0);
      violet.scale.setScalar(mobile()?.70:1.0);
      function resizeWorld(){renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();}
      world={resize:resizeWorld,render(t){
        const explaining=state.mode!=='greeting';
        const targetX=mobile()?(explaining?2.0:0):(explaining?4.2:2.4);
        const targetY=mobile()?(explaining?2.25:1.95):(explaining?.2:.1);
        const base=mobile()?.70:1.0;
        const targetScale=base*(explaining?.58:1);
        const eased=state.motion?.09:1;
        violet.position.x+=(targetX-violet.position.x)*eased;
        violet.position.y+=(targetY-violet.position.y)*eased;
        const oldScale=violet.scale.x;
        violet.scale.setScalar(oldScale+(targetScale-oldScale)*eased);
        violet.rotation.y=state.motion?Math.sin(t*.44)*.13+pointerX*.045:pointerX*.045;
        violet.rotation.x=state.motion?Math.sin(t*.38)*.045-pointerY*.022:0;
        violet.position.y+=(state.motion?Math.sin(t*.78)*.08:0);
        orbit.forEach((mesh,i)=>{mesh.rotation.z=state.motion?t*(i%2?-.07:.08)+i*.25:i*.25;});
        core.rotation.y=state.motion?t*.16:0;
        particles.rotation.z=state.motion?t*.04:0;
        renderer.render(scene,camera);
      }};
      state.threeReady=true;resizeWorld();
    }).catch(error=>{state.threeReady=false;console.info('Three.js unavailable; locally rendered spatial scene remains active.',error.message);});
  }
  let last=now();
  function frame(timestamp){
    const delta=Math.min(.1,(timestamp-last)/1000);last=timestamp;
    const t=state.motion?timestamp/1000:0;
    const [cx,cy]=drawAmbient(t);
    if(!state.threeReady)drawViolet2D(t,cx,cy);
    drawRelations(t,cx,cy);
    if(world)world.render(t);
    if(state.requested&&active().id==='workbench'){
      state.mechanics=state.motion?clamp(state.mechanics+delta*.48,0,1):state.mechanicsTarget;
      if(state.mechanics>=1){
        // Qualify the actual current simulated carriage position, not just the request.
        const correct=Math.abs(state.mechanics-state.mechanicsTarget)<.003;
        state.mechanicsResult=correct?'MODEL OBSERVATION: TARGET REACHED · browser illustration only':'MODEL OBSERVATION: TARGET NOT CONFIRMED';
        state.requested=false;state.observed=correct;renderText();
      }
    }
    requestAnimationFrame(frame);
  }
  renderText();resize();buildWorld();requestAnimationFrame(frame);
  // Small, intentionally inspectable test contract for browser-based acceptance checks.
  Object.defineProperty(window,'__violetStudy',{value:Object.freeze({snapshot:()=>({mode:state.mode,topic:state.topic,index:state.index,name:state.name,
    depth:state.depth,checkpoint:state.checkpoint,qualified:state.qualified,threeReady:state.threeReady,
    mechanics:state.mechanics,mechanicsResult:state.mechanicsResult,context:context7()})})});
})();