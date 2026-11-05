import {subjects,subjectById,cues} from './content.mjs';
import {createPresentation} from './state.mjs';

// A browser presentation, not the TNOS OS. Every visual and caption
// consumes the same qualified presentation state. No fabricated machine inputs.
const $=id=>document.getElementById(id);
const state=createPresentation();
const canvas=$('stage'),ctx=canvas.getContext('2d',{alpha:true});
const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)');
let animate=!prefersReduced.matches,world=null,drawn=-1,sceneKey='',stageButtons=[],speaking=false;
let w=1,h=1,scale=1,cx=0,cy=0,positioned=[];
const color={physical:0x79c6e5,runtime:0xc7a5e9,math:0x83d8c5,origin:0xcfc5ff};
const concepts={
origin:{title:'Tranquility → TranquilSpeak → TNOS',nodes:[
['Tranquility','Minecraft + Discord','origin',-3.4,1],['Context problem','Continuity and knowledge','origin',-1.1,1],['TranquilSpeak','Contextual computation','math',1.1,1],['TNOS','Native OS project','runtime',3.4,1]],edges:[[0,1],[1,2],[2,3]]},
experience:{title:'Intended user experience',nodes:[
['Owner','Authorized device user','physical',-3,1.15],['AI interface','Customizable character','math',-.5,1.15],['Computing','Windows and applications','runtime',2.4,1.15],['Assistance','Learning + guidance','runtime',.75,-.95]],edges:[[0,1],[1,2],[1,3]]},
architecture:{title:'Two reference frames, not three',nodes:[
['PHYSICAL MACHINE','Reference frame 01','physical',-3.55,1.3],['Metric collection','Measured conditions','physical',-3.05,-.65],['TRANQUILSPEAK','Mathematical relationship','math',-.05,.3],['COMPUTING RUNTIME','Reference frame 02','runtime',3.05,1.3],['Established state','Context + computation','runtime',3.25,-.65]],edges:[[0,1],[1,2],[2,3],[3,4]]},
cognition:{title:'Foundation and continuing cognition',nodes:[
['1 Foundation','State','physical',-3.7,1.45],['2 Conscious','Awareness','physical',-1.87,1.45],['3 The Self','Identity','physical',-.05,1.45],['4 Thought','Possibilities','math',1.8,1.45],['5 Collapse','Resolution','math',3.57,1.45],
['6 Action','Output','math',3.57,-.9],['7 Observation','Consequences','runtime',1.8,-.9],['8 Reality','Admitted events','runtime',-.05,-.9],['9 Metacognition','Feedback','runtime',-1.87,-.9]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,3]]},
workbench:{title:'Workbench engineering relationships',nodes:[
['TNOS','System under construction','runtime',-3.3,.95],['WORKBENCH','Separate engineering tool','math',-.95,.95],['Machine state','Modeled constraints','physical',1.45,1.6],['Rendered output','Visual realization','runtime',3.45,.3],['Observation','Partially implemented','math',1.5,-1.25]],edges:[[1,0],[1,2],[2,3],[3,4]]},
mcp:{title:'A separate external tool interface',nodes:[
['TNOS cognition','Native computational owner','runtime',-3.2,.6],['MCP server','Separate external access','math',0,.6],['Compatible clients','Selected capabilities','physical',3.2,.6]],edges:[[0,1],[1,2]],tentative:true},
progress:{title:'Distinct project progress and support priorities',nodes:[
['Native TNOS','Kernel + ISO built','physical',-3.3,1.25],['Workbench','Partial functioning UI','math',0,1.25],['MCP server','Updating required','runtime',3.3,1.25],
['Equipment','Engineering tools','physical',-3.3,-1],['AI coding tools','Sustainable use','math',0,-1],['Development time','Ongoing work','runtime',3.3,-1]],edges:[]},
chooser:{title:'Explore the invention',nodes:[
['Origin','Why it began','origin',-3.2,1.5],['Experience','Intended user interface','math',-.9,1.5],['Architecture','Physical + computational','physical',1.45,1.5],['Cognition','Nine-stage design','runtime',3.65,1.5],
['Workbench','Engineering environment','math',-2.2,-1],['MCP','External interface','runtime',.05,-1],['Progress','Evidence + support','physical',2.45,-1]],edges:[]},
arrival:{title:'Three distinct development efforts',nodes:[
['TNOS','The native invention','runtime',-3,0.6],['Workbench','Engineering environment','math',0,.6],['MCP','External access','physical',3,.6]],edges:[]}
};
const focusId={
 begin:0,problem:1,experience:1,frames:0,metrics:1,tranquilspeak:2,
 stages:3,external:7,workbench:1,observation:4,mcp:1,progress:0,support:4
};
const currentGraph=s=>concepts[s.mode==='arrival'?'arrival':s.mode==='explore'&&!s.topic?'chooser':s.topic]||concepts.arrival;
function size(){
 const rect=canvas.getBoundingClientRect();
 w=Math.max(1,rect.width);h=Math.max(1,rect.height);
 const dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 scale=Math.min(w*(w<850?.115:.069),h*(w<850?.135:.18));
 cx=w*(w<850?.50:.73);cy=h*(w<850?.51:.47);
 if(world)world.resize();
 positioned=[];
 drawScene(state.snapshot());
}
addEventListener('resize',size,{passive:true});
function pt(node){return [cx+node[3]*scale,cy-node[4]*scale];}
function createLabel(node,x,y,active){
 const el=document.createElement('span');
 el.className='stage-label'+(active?' strong':'');
 el.style.left=x+'px';el.style.top=y+'px';
 const top=document.createElement('span');top.textContent=node[0];el.append(top);
 const bottom=document.createElement('small');bottom.textContent=node[1];el.append(bottom);
 $('labels').append(el);
}
function focus(s){
 const cue=cues[s.position];
 return cue?focusId[cue.id]??0:-1;
}
function updateLabels(s,g){
 $('labels').replaceChildren();
 const emphasis=focus(s);
 g.nodes.forEach((node,i)=>{
  const [x,y]=pt(node);
  createLabel(node,x,y-22,i===emphasis&&s.topic!==null);
 });
}
function draw2D(s,g){
 ctx.clearRect(0,0,w,h);
 const alpha=ctx.globalAlpha;
 if(s.topic==='architecture'){
  const a=pt(g.nodes[0]),b=pt(g.nodes[3]);
  ctx.strokeStyle='#79c6e54f';ctx.lineWidth=1.5;
  ctx.strokeRect(a[0]-80,a[1]-55,135,205);
  ctx.strokeStyle='#c7a5e94f';ctx.strokeRect(b[0]-80,b[1]-55,135,205);
 }
 g.edges.forEach(([a,b])=>{
  const p=pt(g.nodes[a]),q=pt(g.nodes[b]);
  ctx.strokeStyle=g.tentative?'#79c6e555':'#83d8c5aa';
  ctx.lineWidth=1.5;ctx.setLineDash(g.tentative?[5,7]:[]);
  ctx.beginPath();ctx.moveTo(...p);
  if(s.topic==='cognition'&&a===8&&b===3)
   ctx.bezierCurveTo(p[0],p[1]+66,q[0]-78,q[1]-140,...q);
  else ctx.lineTo(...q);
  ctx.stroke();ctx.setLineDash([]);
  if(!(s.topic==='cognition'&&a===8&&b===3)){
   const angle=Math.atan2(q[1]-p[1],q[0]-p[0]);
   const x=q[0]-Math.cos(angle)*15,y=q[1]-Math.sin(angle)*15;
   ctx.fillStyle='#83d8c5b0';ctx.beginPath();ctx.moveTo(x,y);
   ctx.lineTo(x-Math.cos(angle-.6)*8,y-Math.sin(angle-.6)*8);
   ctx.lineTo(x-Math.cos(angle+.6)*8,y-Math.sin(angle+.6)*8);ctx.closePath();ctx.fill();
  }
 });
 const selected=focus(s);
 g.nodes.forEach((node,i)=>{
  const [x,y]=pt(node),c=color[node[2]]||color.math,hex='#'+c.toString(16).padStart(6,'0');
  ctx.strokeStyle=hex;ctx.fillStyle=hex;
  ctx.globalAlpha=i===selected?.95:.48;
  ctx.lineWidth=i===selected?3:1.5;
  ctx.beginPath();ctx.arc(x,y,i===selected?20:11,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=alpha;
 });
}
async function createWorld(){
 try{
  const T=await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.domElement.setAttribute('aria-hidden','true');
  Object.assign(renderer.domElement.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1'});
  canvas.parentElement.insertBefore(renderer.domElement,document.querySelector('.stage-overlay'));
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-5,5,3,-3,.1,100);
  const group=new T.Group();scene.add(group);
  scene.add(new T.AmbientLight(0xc4d9ee,1.5));
  const lamp=new T.PointLight(0x83d8c5,30,30);lamp.position.set(0,3,7);scene.add(lamp);
  let lastKey='', animationStart=0, animationScheduled=false;
  function rebuild(s,g){
   while(group.children.length){
    const o=group.children[0];group.remove(o);
    if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();
   }
   const active=focus(s);
   if(s.topic==='architecture'){
    for(const [x,kind] of [[-3.2,'physical'],[3.2,'runtime']]){
     const geo=new T.EdgesGeometry(new T.BoxGeometry(2,3.4,.35));
     const obj=new T.LineSegments(geo,new T.LineBasicMaterial({color:color[kind],transparent:true,opacity:.45}));
     obj.position.set(x,.25,-.3);group.add(obj);
    }
   }
   for(const [a,b] of g.edges){
    const first=g.nodes[a],last=g.nodes[b];
    let path;
    if(s.topic==='cognition'&&a===8&&b===3){
     path=new T.CatmullRomCurve3([new T.Vector3(first[3],first[4],0),
      new T.Vector3(-3.4,-2.2,0),new T.Vector3(1.3,-2.2,0),new T.Vector3(last[3],last[4],0)]);
    } else path=new T.LineCurve3(new T.Vector3(first[3],first[4],0),new T.Vector3(last[3],last[4],0));
    const line=new T.Line(new T.BufferGeometry().setFromPoints(path.getPoints(48)),
      new T.LineBasicMaterial({color:0x83d8c5,transparent:true,opacity:g.tentative?.28:.6}));
    group.add(line);
    if(!g.tentative){
      const points=path.getPoints(48);
      const end=points[47],before=points[44];
      const direction=new T.Vector3().subVectors(end,before).normalize();
      group.add(new T.ArrowHelper(direction,end.clone().addScaledVector(direction,-.39),.22,0x83d8c5,.14,.085));
    }
   }
   for(const [i,n] of g.nodes.entries()){
    const mat=new T.MeshBasicMaterial({color:color[n[2]]||color.math,transparent:true,opacity:i===active?.95:.58,wireframe:true});
    const geometry=new T.IcosahedronGeometry(i===active?.23:.16,1);
    const node=new T.Mesh(geometry,mat);node.position.set(n[3],n[4],.15);group.add(node);
   }
  }
  world={resize(){
    renderer.setSize(w,h,false);
    const ratio=w/h,span=Math.max(5.1,4.5/ratio);
    camera.left=-span*ratio/2;camera.right=span*ratio/2;
    camera.top=span/2;camera.bottom=-span/2;
    // Match the DOM labels/canvas coordinate system, including the stage offset.
    const units=scale;
    const unitWidth=w/units,unitHeight=h/units;
    camera.left=-cx/units;camera.right=(w-cx)/units;
    camera.top=cy/units;camera.bottom=-(h-cy)/units;
    camera.position.set(0,0,12);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  },render(s,g){
    const key=(s.mode+'|'+(s.topic||'')+'|'+(s.position||0));
    if(key!==lastKey){lastKey=key;animationStart=performance.now();rebuild(s,g);}
    const elapsed=animate?Math.min(1,(performance.now()-animationStart)/550):1;
    const ease=elapsed*elapsed*(3-2*elapsed);
    group.scale.setScalar(.94+.06*ease);
    renderer.render(scene,camera);
    if(elapsed<1){
      if(!s.paused&&!animationScheduled){
        const generation=s.generation;animationScheduled=true;
        requestAnimationFrame(()=>{
          animationScheduled=false;
          const current=state.snapshot();
          if(current.generation===generation&&world)world.render(current,currentGraph(current));
        });
      }
      return false;
    }
    drawn=s.generation;
    const current=state.snapshot();
    if(current.generation===s.generation&&!current.paused&&current.outputs.spatial==='pending')
      state.observe(current.generation,'spatial','confirmed');
    return true;
  }};
  world.resize();drawScene(state.snapshot());
 }catch(error){console.info('Three.js unavailable: semantic Canvas scene remains active.',error.message);}
}
function drawScene(s){
 const g=currentGraph(s);
 drawn=-1;
 try{
   draw2D(s,g);
   if(world){world.render(s,g);canvas.style.opacity='0';}else{canvas.style.opacity='1';drawn=s.generation;}
   updateLabels(s,g);
   $('diagram-name').textContent=g.title;
   $('diagram-relation').textContent=s.topic==='architecture'?'Two reference frames; TranquilSpeak is their mathematical relationship, not a third frame.':
      s.topic==='cognition'?'Stage 9 feeds Stage 4. Properly admitted external events can enter at Stage 8.':
      s.topic==='workbench'?'The engineering tool and its observation mechanisms are not the native OS.':
      s.topic==='mcp'?'Intended external interface. The integration is not complete.':
      s.topic==='progress'?'Distinct progress and support needs; no claim of one completed system.':
      s.topic==='origin'?'A documented development history, not simulated machine behavior.':
      s.topic==='experience'?'Intended AI interface and ordinary computing, not a native demo.':
      'Three separate engineering efforts; the website is only a presentation.';
   $('stage').setAttribute('aria-label',g.title+'. '+g.nodes.map(n=>n[0]+': '+n[1]).join('; ')+'. Educational design visualization only.');
 }catch(error){
   console.error('Site stage rendering failed',error);
   if(s.outputs.spatial==='pending')state.observe(s.generation,'spatial','failed');
 }
}
function placeSubjectButtons(){
 const container=$('subject-choices');
 const s=state.snapshot();
 const chooser=s.mode==='explore'&&s.topic===null;
 const focused=document.activeElement?.dataset?.subjectId;
 container.hidden=!chooser;
 container.replaceChildren();
 if(!chooser)return;
 const g=concepts.chooser;
 subjects.forEach((subject,i)=>{
  const node=g.nodes[i],[x,y]=pt(node);
  const b=document.createElement('button');
  b.type='button';b.dataset.subjectId=subject.id;
  b.style.left=x+'px';b.style.top=(y+36)+'px';
  b.textContent=subject.name;
  b.addEventListener('click',()=>state.dispatch({type:'SELECT_SUBJECT',id:subject.id}));
  container.append(b);
 });
 const target=[...container.querySelectorAll('button')].find(b=>b.dataset.subjectId===focused);
 if(target)target.focus({preventScroll:true});
}
function renderUI(s){
 const arrival=s.mode==='arrival',chooser=s.mode==='explore'&&!s.topic,cue=cues[s.position]||cues[0];
 const oldFocus=document.activeElement,wasInput=oldFocus&&oldFocus!==document.body&&oldFocus!==document.documentElement;
 $('headline').textContent=arrival?'Building a different foundation for intelligent computing.':
 chooser?'The invention, its engineering, and the work ahead.':cue.heading;
 $('speech').textContent=arrival?
  "I’m Violet, the proposed TNOS interface. This presentation follows Jubi’s working sponsorship introduction: why the invention began, what it is designed to do, what has been developed, and what remains to be verified.":
  chooser?'Choose a subject within the same environment. You can examine how the project’s parts relate, then return to the exact place you interrupted the talk.':cue.speech;
 $('phase').textContent=arrival?'VIOLET / OPENING':chooser?'FREE EXPLORATION':cue.label;
 $('scene-label').textContent=arrival?'TNOS / PRESENTATION':chooser?'TNOS / EXPLORATION':subjectById.get(cue.topic).name.toUpperCase();
 $('source-line').textContent=arrival?'Working sponsorship introduction · Part I · Pending inventor review':
 chooser?'Working sponsorship introduction · Part I §§2–5':cue.source+' · Inventor review pending';
 $('evidence-type').textContent=arrival||chooser?'SOURCE / DESIGN STUDY':cue.status;
 $('evidence-status').textContent=s.paused?'PAUSED · ESTABLISHED POSITION PRESERVED':
 s.mode==='guided'?(s.qualified?'WEBSITE OUTPUT PRESENTED · NOT TNOS EXECUTION':'AWAITING WEBSITE PRESENTATION OBSERVATION'):
 'CONCEPT PRESENTATION · NOT LIVE TNOS';
 $('advance').hidden=chooser;
 $('advance').disabled=!arrival&&!s.qualified||s.paused;
 const subjectPassages=s.topic?cues.filter(c=>c.topic===s.topic):[];
 const subjectIndex=subjectPassages.findIndex(c=>c.id===cue.id);
 $('advance').textContent=arrival?'BEGIN PRESENTATION ↗':
  s.mode==='explore'?(subjectIndex<subjectPassages.length-1?'NEXT RELATIONSHIP ↗':'ALL SUBJECTS ↗'):
  s.position===cues.length-1?'EXPLORE THE INVENTION ↗':'CONTINUE ↗';
 $('explore').hidden=chooser;
 $('explore').textContent=s.mode==='explore'?'ALL SUBJECTS':'EXPLORE THE INVENTION';
 $('return').hidden=s.mode!=='explore'||!s.returnPoint;
 $('pause').hidden=s.mode!=='guided';$('pause').textContent=s.paused?'RESUME':'PAUSE';
 $('pause').setAttribute('aria-pressed',String(s.paused));
 $('voice').hidden=!("speechSynthesis" in window)||chooser;
 $('voice').textContent=speaking?'STOP VOICE':'HEAR VIOLET';
 $('back').hidden=s.mode==='arrival'||chooser||(s.mode==='guided'&&s.position<=0)||
  (s.mode==='explore'&&subjectIndex<=0);
 $('back').setAttribute('aria-label',s.mode==='explore'?'Previous relationship':'Previous passage');
 $('retry').hidden=!Object.values(s.outputs||{}).some(x=>x==='failed'||x==='unavailable');
 const n=arrival?0:s.mode==='explore'&&s.returnPoint?s.returnPoint.position+1:
 s.mode==='explore'&&s.finished?cues.length:Math.max(0,s.position+1);
 document.querySelector('.progress').setAttribute('aria-valuenow',String(n));
 $('progress-fill').style.width=100*n/cues.length+'%';
 $('progress-label').textContent=arrival?'READY':s.mode==='explore'?'EXPLORING · TALK POSITION RETAINED':n+' / '+cues.length+(s.paused?' · PAUSED':'');
 $('presence').classList.toggle('speaking',s.mode==='guided'&&!s.paused&&s.qualified);
 drawScene(s);placeSubjectButtons();
 if(wasInput && (!oldFocus.isConnected||oldFocus.closest('[hidden]')||oldFocus.hidden)){
  const fallback=s.mode==='explore'&&s.topic===null?$('subject-choices').querySelector('button'):$('presentation');
  fallback?.focus({preventScroll:true});
 }
 // Establish exactly the rendered generation; a timer request is not a result.
 const generation=s.generation;
 requestAnimationFrame(()=>{
  const current=state.snapshot();
  if(current.generation!==generation||current.paused)return;
  if(current.outputs.caption==='pending'){
   const rect=$('speech').getBoundingClientRect();
   if(rect.width>0&&rect.height>0&&$('speech').textContent.trim())state.observe(generation,'caption','confirmed');
  }
  if(current.outputs.spatial==='pending'&&drawn===generation){
   const rect=canvas.getBoundingClientRect();
   if(rect.width>0&&rect.height>0)state.observe(generation,'spatial','confirmed');
  }
 });
}
function stopVoice(){
 if('speechSynthesis' in window)window.speechSynthesis.cancel();
 speaking=false;
}
state.subscribe((s,type)=>{
 if(type!=='OUTPUT_OBSERVED')stopVoice();
 renderUI(s);
});
$('advance').addEventListener('click',()=>{
 const s=state.snapshot();
 state.dispatch({type:s.mode==='arrival'?'START':s.mode==='guided'?'NEXT':'EXPLORE_NEXT'});
});
$('explore').addEventListener('click',()=>state.dispatch({type:'EXPLORE'}));
$('return').addEventListener('click',()=>state.dispatch({type:'RETURN'}));
$('pause').addEventListener('click',()=>{
 const s=state.snapshot();
 state.dispatch({type:s.paused?'RESUME':'PAUSE'});
});
$('back').addEventListener('click',()=>state.dispatch({type:state.snapshot().mode==='explore'?'EXPLORE_PREVIOUS':'PREVIOUS'}));
$('retry').addEventListener('click',()=>state.dispatch({type:'RETRY'}));
$('restart').addEventListener('click',event=>{event.preventDefault();state.dispatch({type:'RESTART'});$('presentation').focus({preventScroll:true});});
$('motion').addEventListener('click',()=>{
 animate=!animate;
 $('motion').setAttribute('aria-pressed',String(animate));
 $('motion').textContent=animate?'MOTION / ON':'MOTION / OFF';
 drawScene(state.snapshot());
});
$('motion').textContent=animate?'MOTION / ON':'MOTION / OFF';
$('motion').setAttribute('aria-pressed',String(animate));
$('voice').addEventListener('click',()=>{
 if(!('speechSynthesis' in window))return;
 if(speaking){stopVoice();$('voice').textContent='HEAR VIOLET';return;}
 const utterance=new SpeechSynthesisUtterance($('speech').textContent);
 utterance.rate=.95;utterance.onend=()=>{speaking=false;$('voice').textContent='HEAR VIOLET';};
 utterance.onerror=utterance.onend;
 speaking=true;$('voice').textContent='STOP VOICE';
 speechSynthesis.speak(utterance);
});
document.addEventListener('keydown',e=>{
 if(e.target.matches('input,textarea')||e.altKey||e.metaKey||e.ctrlKey)return;
 if(e.key==='Escape'&&state.snapshot().mode==='explore'&&state.snapshot().returnPoint)
  state.dispatch({type:'RETURN'});
});
const current=state.snapshot();
renderUI(current);size();createWorld();
Object.defineProperty(window,'__tnosPresentation',{value:Object.freeze({
 snapshot:()=>state.snapshot(),scene:()=>currentGraph(state.snapshot()).title,
 action:event=>state.dispatch(event)
})});
