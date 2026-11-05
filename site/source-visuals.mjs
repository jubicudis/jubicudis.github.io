// Source-specific illustrations for the remaining TNOS presentation subjects.
// These draw documented relations, not invented TNOS machine output.
// Part I of TNOS Sponsors Introduction v3.9 (2026-11-05) is the authority.
const ink='#dfefff',muted='#98b9cf',cyan='#7fe1df',violet='#c4a9ee',background='#071322';
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const t=(x,y,value,size=18,color=ink,weight=450,anchor='start')=>
 '<text x="'+x+'" y="'+y+'" fill="'+color+'" font-family="Arial,Helvetica,sans-serif" font-size="'+size+'" font-weight="'+weight+'" text-anchor="'+anchor+'">'+xml(value)+'</text>';
const lines=(x,y,strings,size=16,color=muted,leading=23)=>strings.map((line,i)=>t(x,y+i*leading,line,size,color)).join('');
const panel=(x,y,width,height,active=false)=>{
 const c=active?cyan:'#48647b';
 return '<rect x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" rx="4" fill="'+(active?'#153444':'#0d2031')+'" stroke="'+c+'" stroke-width="'+(active?2.2:1)+'"/>';
};
const arrow=(x1,y1,x2,y2,color=cyan,dashed=false)=>{
 const d=dashed?' stroke-dasharray="6 8"':'';
 const dx=x2-x1,dy=y2-y1,angle=Math.atan2(dy,dx);
 const ax=x2-12*Math.cos(angle-.46),ay=y2-12*Math.sin(angle-.46);
 const bx=x2-12*Math.cos(angle+.46),by=y2-12*Math.sin(angle+.46);
 return '<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" stroke="'+color+'" stroke-width="2" fill="none"'+d+'/>'+
 '<path d="M'+ax+' '+ay+' L'+x2+' '+y2+' L'+bx+' '+by+'" stroke="'+color+'" stroke-width="2" fill="none"/>';
};
function frame(title,sub,body,footer){
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 610" role="img" aria-label="'+xml(title)+'">'+
 '<rect width="1040" height="610" fill="'+background+'"/>'+
 '<path d="M24 29 H1018" stroke="#4e8399" stroke-width="2"/>'+
 t(28,80,title,29,ink,720)+t(28,117,sub,16,muted)+body+
 '<path d="M24 553 H1018" stroke="#496176"/>'+
 t(28,584,footer,15,muted)+'</svg>';
}
function origin(cue){
 const steps=[
  {label:'TRANQUILITY',details:['Minecraft + Discord','Zeno and interactive stories']},
  {label:'PRACTICAL PROBLEM',details:['Long AI chats lost context','Missing facts were inferred']},
  {label:'TRANQUILSPEAK',details:['Structured communication','Between AI systems']},
  {label:'TNOS',details:['Contextual mathematics','State-dependent OS work']}
 ];
 const current=cue==='begin'?0:2;
 let body=arrow(115,279,930,279,'#6da6ad');
 steps.forEach((step,i)=>{
  const x=50+i*251;
  body+='<circle cx="'+(x+100)+'" cy="279" r="'+(i===current?20:14)+'" fill="'+(i===current?'#80d5d7':'#102c3a')+'" stroke="'+cyan+'" stroke-width="2"/>';
  body+=panel(x,331,218,130,i===current);
  body+=t(x+13,363,step.label,17,i===current?cyan:ink,650);
  body+=lines(x+13,397,step.details,15,muted,24);
 });
 body+=t(30,212,'The invention emerged through troubleshooting, not a predetermined OS plan.',18,ink,550);
 return frame('FROM TRANQUILITY TO TNOS','Documented invention chronology · inventor account',body,
  'An understood TranquilSpeak expression cannot recover information that was never supplied.');
}
function experience(cue){
 let body='';
 body+=panel(39,172,610,315,true);
 body+=t(64,205,'INTENDED TNOS FIRST-BOOT EXPERIENCE',19,cyan,700);
 body+='<rect x="66" y="228" width="558" height="220" rx="8" fill="#071321" stroke="#53718b"/>';
 body+='<path d="M66 257 H624" stroke="#344f64"/>';
 body+=t(91,249,'TNOS / OWNER SESSION',13,muted,600);
 body+='<path d="M114 289 Q155 339 196 289 Q157 381 114 289" stroke="'+violet+'" stroke-width="4" fill="none"/>';
 body+=t(244,305,'PERSONAL AI INTERFACE',20,ink,640);
 body+=lines(245,341,['Introduces the OS and guides the owner','Customizable appearance and interaction','Continued assistance during computing'],16);
 body+=panel(694,175,308,96,false)+t(715,208,'ORDINARY COMPUTING',19,ink,640)+lines(715,235,['Windows, apps and internet'],15);
 body+=panel(694,298,308,162, cue==='experience')+
  t(715,334,'PERMISSIONS MATTER',18,cyan,640)+
  lines(715,368,['Authorized owner controls','differ from conversation-only','visitor access.'],15);
 body+=arrow(651,267,694,223,cyan)+arrow(651,343,694,375,violet);
 return frame('THE INTENDED TNOS USER EXPERIENCE','Illustrative product concept · this website is not the native first boot',body,
  'The character is an interface to the system, not a claim of artificial personhood.');
}
function workbench(cue){
 let body='';
 const steps=[
  {x:33,w:221,title:'TNOS DEVELOPMENT',details:['Multiple languages','and components']},
  {x:292,w:221,title:'WORKBENCH',details:['Separate engineering','environment']},
  {x:551,w:221,title:'SCENE + MACHINE',details:['Spatial construction','Defined constraints']},
  {x:810,w:197,title:'OBSERVATION',details:['Frame comparison','Partially implemented']}
 ];
 const active=cue==='observation'?3:1;
 steps.forEach((x,i)=>{
  body+=panel(x.x,230,x.w,172,i===active);
  body+=t(x.x+12,267,x.title,18,i===active?cyan:ink,650);
  body+=lines(x.x+12,304,x.details,15,muted,25);
  if(i<3)body+=arrow(x.x+x.w+4,316,steps[i+1].x-7,316,cyan);
 });
 body+=t(55,183,'ENGINEERING FLOW',19,cyan,700);
 body+=t(305,449,'VS CODE: CURRENT PARTIAL INTEGRATION',17,violet,650);
 body+=t(305,480,'Standalone / cross-IDE operation: intended, not yet established.',15,muted);
 return frame('BUILDING THE TOOLS TO BUILD TNOS','The Workbench is a separate engineering environment, not the native OS',body,
  'Requesting a visual action is not evidence that the specified result was observed.');
}
function mcp(){
 let body='';
 body+=panel(35,216,250,210,true);
 body+=t(52,252,'EXTERNAL CLIENT',21,cyan,680);
 body+=lines(52,291,['Compatible AI client','or development tool'],17);
 body+=panel(330,198,283,243,true);
 body+=t(348,231,'MCP INTERFACE',20,cyan,680);
 body+=t(349,264,'tell   ask   do   feedback',17,ink,600);
 body+=lines(350,311,['Provides selected access,','not cognitive ownership.','A request is not a result.'],16);
 body+=panel(662,197,342,245,false);
 body+=t(681,231,'INDEPENDENT COGNITION',18,ink,680);
 body+=lines(682,267,['Stage 8 admits qualified input','Stage 4 computes in its own system','Stage 6 exposes established results','Stage 9 feeds later computations'],15,muted,31);
 body+=arrow(285,316,330,316,cyan);
 body+=arrow(613,284,662,284,cyan,true);
 body+=arrow(662,387,613,387,violet,true);
 return frame('THE MCP SERVER IS AN INTERFACE','Four tools · separate access boundary, not an autonomous cognitive owner',body,
  'Existing tool handling is not proof of completed integration or causation of a new result.');
}
function progress(cue){
 const rows=[
  {y:174,title:'NATIVE TNOS OS',a:'Kernel + ISO built; QEMU boot reported',b:'Full cognitive integration still open'},
  {y:275,title:'TNOS WORKBENCH',a:'Partial visual environment and state logic',b:'Observation / construction still underway'},
  {y:376,title:'TNOS MCP SERVER',a:'Four tools and historical request handling',b:'Interface integration requires updating'}
 ];
 let body='';
 rows.forEach((r,i)=>{
  body+='<path d="M40 '+(r.y+78)+' H1000" stroke="#3f566b"/>';
  body+=t(45,r.y+8,r.title,20,i===1?cyan:ink,650);
  body+=t(360,r.y+8,r.a,16,muted);
  body+=t(360,r.y+43,r.b,15,violet);
 });
 body+=t(40,522,'SPONSORSHIP: EQUIPMENT   •   SUSTAINABLE AI PROGRAMMING HELP   •   DEVELOPMENT TIME',17,cyan,600);
 return frame('THREE DISTINCT DEVELOPMENT EFFORTS','Established progress and outstanding work are not interchangeable',body,
  'Current priority: Workbench · No claim of a complete integrated native OS.');
}
const descriptors={
 origin:{title:'Tranquility and the origin of TranquilSpeak and TNOS',alt:'Source-based chronology from the Tranquility Minecraft and Discord project through the context problem and TranquilSpeak to TNOS.'},
 experience:{title:'The intended TNOS owner experience',alt:'Source-based concept of AI onboarding, custom interface, ordinary computing and owner permissions.'},
 workbench:{title:'Workbench engineering and observation relationships',alt:'Source-based engineering flow from TNOS development to Workbench spatial construction and observation.'},
 mcp:{title:'MCP interface and the independent cognitive pipeline',alt:'External client connects to four MCP tools; Stage 8 input and Stage 6 existing results remain owned by separate cognition.'},
 progress:{title:'Distinct TNOS project status and sponsorship purposes',alt:'Development evidence for native TNOS, Workbench and MCP independently, with sponsorship needs.'}
};
export function semanticVisual(topic,cueId){
 const descriptor=descriptors[topic];
 if(!descriptor)return null;
 const svg=topic==='origin'?origin(cueId):
 topic==='experience'?experience(cueId):
 topic==='workbench'?workbench(cueId):
 topic==='mcp'?mcp():progress(cueId);
 return {...descriptor,
   desktop:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),
   mobile:''};
}
