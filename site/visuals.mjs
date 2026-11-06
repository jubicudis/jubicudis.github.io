const NS='http://www.w3.org/2000/svg';
function el(parent,kind,attrs={},value){
  const n=document.createElementNS(NS,kind);
  Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));
  if(value!==undefined)n.textContent=value;
  parent.append(n);return n;
}
function label(svg,x,y,text,small=false){
  return el(svg,'text',{x,y,class:small?'study-small':'study-label'},text);
}
function tiny(svg,x,y,text){return el(svg,'text',{x,y,class:'study-tiny'},text);}
function box(svg,x,y,w,h,title,sub,secondary=false){
  el(svg,'rect',{x,y,width:w,height:h,rx:20,class:secondary?'study-secondary':'study-node'});
  label(svg,x+w/2,y+Math.min(52,h*.45),title);
  if(sub)tiny(svg,x+w/2,y+Math.min(87,h*.68),sub);
}
function line(svg,x1,y1,x2,y2,feedback=false){
  el(svg,'path',{d:'M'+x1+' '+y1+' L'+x2+' '+y2,class:feedback?'study-feedback':'study-line'});
  const a=Math.atan2(y2-y1,x2-x1);const r=12;
  el(svg,'polygon',{points:[[x2,y2],[x2-r*Math.cos(a-.5),y2-r*Math.sin(a-.5)],[x2-r*Math.cos(a+.5),y2-r*Math.sin(a+.5)]].map(p=>p.join(',')).join(' '),fill:feedback?'#e8ba78':'#8b89dd'});
}
function annotate(svg,text){tiny(svg,460,380,text);}
function origin(svg){
  box(svg,25,110,240,128,'Tranquility','Minecraft + Discord');
  line(svg,265,174,339,174);
  box(svg,340,110,240,128,'TranquilSpeak','Context communication',true);
  line(svg,580,174,654,174);
  box(svg,655,110,240,128,'TNOS','OS research + engineering');
  annotate(svg,'Development grew through investigation, not a predetermined OS plan');
}
function experience(svg){
  box(svg,43,98,253,145,'Personal interface','Intended TNOS experience');
  box(svg,335,98,253,145,'Native OS','Mathematics + state',true);
  box(svg,627,98,253,145,'Everyday computing','Apps, browsing, tools');
  line(svg,296,170,335,170);line(svg,588,170,627,170);
  annotate(svg,'This website illustrates the vision; it is not running the TNOS operating system');
}
function frames(svg){
  box(svg,27,85,271,178,'Physical machine','Measured conditions');
  box(svg,347,103,226,142,'TranquilSpeak','Mathematical relationship',true);
  box(svg,622,85,271,178,'Runtime','Computed state');
  line(svg,298,173,347,173);line(svg,573,173,622,173);
  tiny(svg,160,296,'Acquisition');tiny(svg,460,296,'Interpretation');tiny(svg,756,296,'Subsequent computation');
  annotate(svg,'Two reference frames; measurements and mathematical interpretation are distinct');
}
function context(svg){
  const v=[['WHO',42,70],['WHAT',270,70],['WHEN',498,70],['WHERE',726,70],['WHY',155,228],['HOW',384,228],['EXTENT',613,228]];
  for(const [name,x,y] of v)box(svg,x,y,180,90,name,'Context question',name==='EXTENT');
  annotate(svg,'Seven questions organize meaning; this website does not execute native TranquilSpeak');
}
function stages(svg){
  const foundation=[['1','Foundation'],['2','Awareness'],['3','Self']];
  foundation.forEach(([n,t],i)=>box(svg,85+i*265,28,220,97,'Stage '+n,t));
  const names=['Thought','Collapse','Action','Observation','Reality','Metacognition'];
  names.forEach((n,i)=>box(svg,12+i*152,187,136,97,String(i+4),n));
  for(let i=0;i<5;i++)line(svg,148+i*152,236,164+i*152,236);
  el(svg,'path',{d:'M830 285 C827 345 180 350 79 287',class:'study-feedback'});
  tiny(svg,470,338,'Stage 9 feedback to the next Stage 4 cycle');
  annotate(svg,'Targeted stage tests are not proof of a complete native end-to-end OS path');
}
function biosystems(svg){
  box(svg,25,110,244,130,'Acquire','Camera or sensor');
  line(svg,269,175,342,175);
  box(svg,343,110,244,130,'Interpret','Process observation',true);
  line(svg,587,175,660,175);
  box(svg,661,110,235,130,'Use','Context + behavior');
  annotate(svg,'Machine-equivalent functional responsibilities; not an organic computer');
}
function workbench(svg){
  box(svg,34,100,255,144,'Construct','Modeled components');
  line(svg,289,172,333,172);
  box(svg,335,100,251,144,'Observe','Actual rendered result',true);
  line(svg,586,172,632,172);
  box(svg,634,100,251,144,'Troubleshoot','Compare and refine');
  annotate(svg,'Workbench is independent from the native operating system');
}
function projection(svg){
  box(svg,45,97,244,149,'Primitives','Geometry + constraints');
  line(svg,289,171,343,171);
  box(svg,343,97,234,149,'Blueprints','Lawful composition',true);
  line(svg,577,171,631,171);
  box(svg,631,97,244,149,'Instances','Modeled machine');
  annotate(svg,'Software-machine modeling is not evidence of working physical projection hardware');
}
function mcp(svg){
  box(svg,28,100,259,149,'TNOS cognition','Native architecture');
  line(svg,287,172,339,172);
  box(svg,341,100,241,149,'MCP interface','Selected capabilities',true);
  line(svg,582,172,635,172);
  box(svg,637,100,259,149,'External client','Compatible AI tools');
  annotate(svg,'Separate integration; current end-to-end operation is not established');
}
function progress(svg){
  box(svg,18,91,284,175,'Native OS','Kernel + ISO built');
  tiny(svg,160,235,'QEMU boot reported');
  box(svg,318,91,284,175,'Workbench','Partial visual function',true);
  tiny(svg,460,235,'Current main priority');
  box(svg,618,91,284,175,'MCP server','Existing source');
  tiny(svg,760,235,'Integration needs updating');
  annotate(svg,'Progress claims have different verification states and must not be conflated');
}
function support(svg){
  box(svg,35,100,263,144,'Equipment','Better development hardware');
  box(svg,329,100,263,144,'Engineering','Sustainable assistance',true);
  box(svg,623,100,263,144,'Time','Continued development');
  annotate(svg,'Sponsorship supports ongoing work; no invented funding amounts or deadline');
}
export const DRAWINGS=Object.freeze({origin,experience,frames,context,stages,biosystems,workbench,projection,mcp,progress,support});
export function renderFigure(container,type){
  const draw=DRAWINGS[type];
  if(!draw)throw new Error('No grounded presentation figure for '+type);
  container.replaceChildren();
  const svg=el(container,'svg',{xmlns:NS,viewBox:'0 0 920 400',class:'study-svg',role:'img','aria-label':'TNOS: '+type+' explanatory diagram'});
  draw(svg);
  container.dataset.figure=type;
  return svg;
}
