import {createStateStudy} from './state.mjs';

// One visual explanation of a TNOS architectural principle, not a TNOS emulator.
const $ = id => document.getElementById(id);
const experience = $('experience'), canvas = $('world'), ctx = canvas.getContext('2d');
const engine = createStateStudy();
let sceneWidth=1,sceneHeight=1,dpr=1,last=performance.now(),engaged=false;
let displayAngle=0,visitorProgress=0,three=null,shownContext=false;
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
let motion=!reduce.matches;
const soft = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
const lerp=(a,b,ratio)=>a+(b-a)*ratio;
const coordinates=[['step-event','physical'],['step-observation','evidence'],['step-grounded','runtime'],['step-decision','runtime'],['step-feedback','feedback']];
function say(message) { $('outcome').textContent=message; }
function describe(state,type) {
  const e=state.evidence, r=state.runtime, a=state.passage;
  let story,headline;
  if(!engaged){
    headline='An answer must have a foundation.';
    story='I’m Violet, a proposed interface to TNOS. Jubi began this project after AI models understood his instructions but lost established circumstances between conversations. Here, changing a simulated room state must change what the system is allowed to conclude—even without another question. Open the doorway to see why.';
  }else if(type==='ENVIRONMENT_CHANGED' || e.status==='pending'){
    headline='The room changes first.';
    story='The doorway is changing in the simulated environment. The computational side has no admitted reading for this revision. It must not reuse an earlier permission or invent a new one.';
  }else if(a.status==='observed'){
    headline='Now there is an observed result.';
    story='The browser-model traveler reached the other side. The result was admitted only after its modeled position reached the target. Feedback updates the next computation. This demonstrates a design relationship, not native TNOS cognition.';
  }else if(a.status==='requested'){
    headline='A command is not a result.';
    story='A passage has been requested because the currently admitted reading permits it. The traveler is moving, but the model has not yet observed completion. The feedback record must remain unchanged until then.';
  }else if(r.access==='permitted'){
    headline='The next decision has changed.';
    story='The room changed without a new conversational question. Once the browser model measured the open doorway and admitted that reading, its computation derived permission for passage. Now request a crossing to see how results are qualified.';
  }else{
    headline='The state constrains the action.';
    story='The latest admitted browser-model measurement describes a closed doorway. A crossing request is blocked. Simply wanting an action is insufficient to establish that it can happen.';
  }
  $('headline').textContent=headline;
  $('narrative').textContent=story;
  $('runtime-label').textContent=r.access==='permitted'?'Passage permitted':r.access==='blocked'?'Passage blocked':'Awaiting observation';
  $('source-line').textContent=e.status==='admitted'?'ADMITTED MEASUREMENT → COMPUTED PERMISSION':'PHYSICAL EVENT → AWAITING A MEASUREMENT';
  $('door-event').innerHTML=(state.physical.targetAngle>.2?'Close the doorway':'Open the doorway')+' <span aria-hidden="true">↗</span>';
  $('physical-value').textContent='Door '+(state.physical.targetAngle>.2?'opening':'closing')+' · target '+Math.round(state.physical.targetAngle*180/Math.PI)+'°';
  $('evidence-value').textContent=e.status==='admitted'?'Admitted · revision '+e.revision+' · '+Math.round(e.measuredAngle*180/Math.PI)+'°':'Pending · revision '+state.revision;
  $('decision-value').textContent=r.access==='permitted'?'Permitted from admitted revision '+r.revision:r.access==='blocked'?'Blocked by admitted revision '+r.revision:'Not established for current event';
  $('feedback-value').textContent='Observed crossings: '+state.feedback.successfulPassages+(a.status==='requested'?' · current request pending':'');
  $('crossing').disabled=a.status==='requested';
  $('crossing').setAttribute('aria-describedby','causal-status');
  ['step-event','step-observation','step-grounded','step-decision','step-feedback'].forEach((id,index)=>{
    const on=[true,e.status==='admitted',r.status==='grounded-in-simulation',r.access!=='unestablished',a.status==='observed'][index];
    $(id).classList.toggle('active',on);
  });
  if(shownContext && r.context) {
    const c=r.context;
    $('causal-status').textContent='Context: '+c.what+' · '+c.when+' · '+c.how+' · '+c.extent+'. Source is simulated, not native.';
  } else if(shownContext) {
    $('causal-status').textContent='No current admitted context: the simulated scene is still awaiting a reading.';
  } else {
    $('causal-status').textContent=e.status==='pending'?'No new computational result can be admitted yet.':'Every current permission is traceable to the admitted measurement above.';
  }
}
engine.subscribe((state,type)=> {
  describe(state,type);
  if(type==='PASSAGE_HELD')say('Held: no current qualified measurement.');
  else if(type==='PASSAGE_BLOCKED')say('Blocked: established door state is closed. The traveler has not moved.');
  else if(type==='PASSAGE_REQUESTED')say('Requested: waiting for the traveler to cross before admitting success.');
  else if(type==='OUTCOME_OBSERVED')say('Observed in the browser model: target reached. Feedback record updated.');
  else if(type==='ENVIRONMENT_CHANGED')say('External model event: awaiting measurement before any new decision.');
  else if(type==='MEASUREMENT_ADMITTED')say('Measurement admitted from the scene model: the runtime decision has changed.');
});
$('door-event').addEventListener('click',()=> {
  const s=engine.snapshot();
  engaged=true;
  engine.changeEnvironment(s.physical.targetAngle<.5);
  visitorProgress=0;
});
$('crossing').addEventListener('click',()=> {
  engaged=true;
  const result=engine.requestPassage();
  if(result.accepted)visitorProgress=0;
});
$('explain-more').addEventListener('click',()=>{
  shownContext=!shownContext;
  $('explain-more').textContent=shownContext?'Hide contextual grounding −':'Explain this relationship ↗';
  describe(engine.snapshot(),'DETAIL');
});
function syncMotion(){
  $('motion-toggle').textContent=motion?'MOTION ON':'MOTION OFF';
  $('motion-toggle').setAttribute('aria-pressed',String(motion));
}
$('motion-toggle').addEventListener('click',()=>{motion=!motion;syncMotion()});
syncMotion();

function resize(){
  const bounds=canvas.getBoundingClientRect();
  sceneWidth=Math.max(1,Math.round(bounds.width));
  sceneHeight=Math.max(1,Math.round(bounds.height));
  dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(sceneWidth*dpr);canvas.height=Math.round(sceneHeight*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(three)three.resize();
}
window.addEventListener('resize',resize,{passive:true});
function fallbackRoom(t,state){
  const W=sceneWidth,H=sceneHeight,mobile=W<701;
  const px=W*(mobile?.34:.43), py=H*(mobile?.55:.51), size=Math.min(W,H)*(mobile?.24:.20);
  const rx=W*(mobile?.77:.73),ry=py-18;
  ctx.clearRect(0,0,W,H);
  const glow=ctx.createRadialGradient(W*.53,H*.48,5,W*.53,H*.48,Math.max(W,H)*.53);
  glow.addColorStop(0,'#21435955');glow.addColorStop(1,'#080f1c00');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  // The floor, corridor and hinge all belong to ONE room model.
  ctx.strokeStyle='#8ba6ce65';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(px-size*.9,py+size*.8);ctx.lineTo(px+size*2,py+size*.8);
  ctx.moveTo(px-size*.9,py+size*.8);ctx.lineTo(px-size*1.85,py+size*1.5);
  ctx.moveTo(px+size*2,py+size*.8);ctx.lineTo(px+size*2.6,py+size*1.5);ctx.stroke();
  ctx.lineWidth=8;ctx.strokeStyle='#9fc4e7aa';
  ctx.beginPath();ctx.moveTo(px-size*.75,py-size*.95);ctx.lineTo(px-size*.75,py+size*.8);
  ctx.lineTo(px+size*.45,py+size*.8);ctx.lineTo(px+size*.45,py-size*.95);
  ctx.lineTo(px-size*.75,py-size*.95);ctx.stroke();
  const hingeX=px-size*.75, hingeY=py+size*.8;
  const angle=displayAngle;
  ctx.save();ctx.translate(hingeX,hingeY);ctx.transform(1,0,Math.sin(angle)*.53,1,0,0);
  ctx.fillStyle=state.evidence.status==='admitted'&&state.runtime.doorOpen?'#4c9aaf66':'#6d7eacbb';
  ctx.strokeStyle='#c9e1ff';ctx.lineWidth=2;ctx.fillRect(0,-size*1.7,size*1.17,size*1.7);
  ctx.strokeRect(0,-size*1.7,size*1.17,size*1.7);ctx.restore();
  // The luminous connection is enabled by ADMITTED evidence, not an animation timer.
  const admitted=state.evidence.status==='admitted',color=state.runtime.doorOpen?'#88e9d8':'#ffd49c';
  ctx.strokeStyle=admitted?color:'#9d849455';ctx.lineWidth=admitted?3:1;
  ctx.setLineDash(admitted?[]:[6,8]);
  ctx.beginPath();ctx.moveTo(px+size*.48,py-size*.4);ctx.lineTo(rx-size*.4,ry);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle=admitted?color:'#63748c8a';
  ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(rx,ry,size*.6,size*.95,-.1,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=admitted?color:'#566d83';ctx.lineWidth=1;
  ctx.beginPath();ctx.ellipse(rx,ry,size*.78,size*1.16,-.1,0,Math.PI*2);ctx.stroke();
  // A passage marker moves only after the gate accepted a request.
  const zx=px-size*.42+visitorProgress*size*1.65,zy=py+size*.65-visitorProgress*size*.12;
  ctx.fillStyle='#dcecff';ctx.shadowColor='#b7daff';ctx.shadowBlur=16;
  ctx.beginPath();ctx.arc(zx,zy,Math.max(3,size*.07),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  const status=admitted?(state.runtime.doorOpen?'OPEN / AUTHORIZED':'CLOSED / BLOCKED'):'UNVERIFIED';
  ctx.fillStyle='#c7d9ef';ctx.textAlign='center';ctx.font='600 '+(mobile?10:13)+'px system-ui';
  ctx.fillText(status,rx,ry+size*1.55);
}
function makeThree(THREE) {
  const layer=document.createElement('canvas');
  layer.setAttribute('aria-hidden','true');
  layer.className='scene-3d';
  Object.assign(layer.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'1',pointerEvents:'auto'});
  experience.insertBefore(layer,experience.querySelector('.environment-light'));
  const renderer=new THREE.WebGLRenderer({canvas:layer,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(39,1,.1,90);
  const root=new THREE.Group();scene.add(root);
  scene.add(new THREE.AmbientLight(0x9aafda,1.3));
  const key=new THREE.PointLight(0x86c7f0,32,18);key.position.set(-2,5,5);scene.add(key);
  const rightLight=new THREE.PointLight(0x9874d6,18,15);rightLight.position.set(3,3,3);scene.add(rightLight);
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,metalness:.46,roughness:.34,...extra});
  function box(w,h,d,x,y,z,mat,parent=root){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  const floorMat=material(0x182a40,{roughness:.65});
  box(8.8,.09,5.5,0,-.065,0,floorMat);
  // Room frame and hinge, not an arbitrary connected network.
  const frameMat=material(0x88b4c9,{emissive:0x1d3b5d,emissiveIntensity:.6});
  box(.11,2.65,.20,-2.27,1.3,-.05,frameMat);
  box(.11,2.65,.20,-.57,1.3,-.05,frameMat);
  box(1.8,.11,.20,-1.42,2.63,-.05,frameMat);
  const hinge=new THREE.Group();hinge.position.set(-2.21,0,0);root.add(hinge);
  const door=box(1.57,2.48,.085,.79,1.25,0,material(0x536b95,{transparent:true,opacity:.82}),hinge);
  const edge=box(.05,2.37,.1,1.54,1.25,.025,material(0xc4def1),hinge);
  const traveler=new THREE.Mesh(new THREE.SphereGeometry(.115,18,14),
    new THREE.MeshBasicMaterial({color:0xdcecff}));root.add(traveler);
  const gateMat=new THREE.MeshBasicMaterial({color:0x96dfdb,transparent:true,opacity:0.28});
  const gate=new THREE.Mesh(new THREE.TorusGeometry(1.23,.028,6,90),gateMat);
  gate.position.set(2.08,1.47,0);gate.rotation.y=.15;root.add(gate);
  const gate2=gate.clone();gate2.scale.setScalar(1.18);gate2.material=gateMat.clone();gate2.material.opacity=.15;root.add(gate2);
  const railMat=new THREE.MeshBasicMaterial({color:0x85e5df,transparent:true,opacity:0});
  const rail=new THREE.Mesh(new THREE.CylinderGeometry(.021,.021,3.1,9),railMat);
  rail.rotation.z=Math.PI/2;rail.position.set(.55,1.49,0);root.add(rail);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  renderer.domElement.addEventListener('click',event=>{
    const bounds=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    if(raycaster.intersectObjects([door,edge],false).length){
      const s=engine.snapshot();engaged=true;engine.changeEnvironment(s.physical.targetAngle<.5);visitorProgress=0;
    }
  });
  function resize3d(){
    const r=canvas.getBoundingClientRect();
    renderer.setSize(r.width,r.height,false);
    camera.aspect=r.width/r.height;
    camera.position.set(0,r.width<701?4.0:3.3,r.width<701?13.8:11.0);
    camera.lookAt(0,1.4,0);camera.updateProjectionMatrix();
    root.scale.setScalar(r.width<701?.74:1);
  }
  resize3d();
  return {
    resize:resize3d,
    angle:()=>hinge.rotation.y,
    render(state){
      hinge.rotation.y=displayAngle;
      traveler.position.set(-1.45, .26, 1.8-visitorProgress*3.55);
      railMat.opacity=state.evidence.status==='admitted'?.92:.11;
      railMat.color.setHex(state.runtime.access==='blocked'?0xffd49c:0x85e5df);
      gateMat.color.setHex(state.runtime.access==='blocked'?0xffd49c:0x85e5df);
      gateMat.opacity=state.evidence.status==='admitted'?.68:.15;
      gate2.material.color.copy(gateMat.color);
      rightLight.color.setHex(state.runtime.access==='blocked'?0xffb47d:0x8fe9dd);
      renderer.render(scene,camera);
    }
  };
}
async function startThree(){
  try {
    const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    three=makeThree(THREE);
  } catch (e) {
    // The canvas-based causal rendering remains usable without WebGL/CDN access.
    console.info('Three.js unavailable; using the semantic 2D room renderer.');
  }
}
function loop(timestamp){
  const dt=Math.min(.06,Math.max(0,(timestamp-last)/1000));last=timestamp;
  const current=engine.snapshot();
  const target=current.physical.targetAngle;
  if(!motion)displayAngle=target;
  else displayAngle=lerp(displayAngle,target,soft(dt*3.5,0,1));
  if(Math.abs(displayAngle-target)<.017){
    displayAngle=target;
    if(current.evidence.status==='pending'){
      // Observation reads the angle realized by the current visual model, not the command.
      const renderedAngle=three?three.angle():displayAngle;
      // The Three.js render happens below: qualification uses this model's pose
      // after the scene updates, on a subsequent frame.
      if(Math.abs(renderedAngle-target)<.035) engine.observeDoor({
        revision:current.revision, angle:renderedAngle, source:'browser-scene-model'
      });
    }
  }
  const latest=engine.snapshot();
  if(latest.passage.status==='requested'){
    visitorProgress=motion?soft(visitorProgress+dt*.38,0,1):1;
    if(visitorProgress>=.985){
      engine.observePassage({revision:latest.revision,position:visitorProgress});
    }
  }
  if(three) {
    ctx.clearRect(0,0,sceneWidth,sceneHeight);
    three.render(engine.snapshot());
  } else {
    fallbackRoom(timestamp/1000,engine.snapshot());
  }
  requestAnimationFrame(loop);
}
resize();
describe(engine.snapshot(),'ARRIVAL');
say('Watch the door change, then follow the admitted state to a permitted or blocked action.');
startThree();
requestAnimationFrame(loop);
Object.defineProperty(window,'__tnosStateStudy',{
  value:Object.freeze({snapshot:()=>engine.snapshot(),changeEnvironment:open=>engine.changeEnvironment(open),
    requestPassage:()=>engine.requestPassage(),observeDoor:observation=>engine.observeDoor(observation)})
});
