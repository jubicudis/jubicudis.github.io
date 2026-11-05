// Presentation media are consumers of the established browser state.
// This module never claims to operate TNOS or observe anything beyond this page.
export function attachPresentationMedia({state,cues,explanationForCue}) {
 const $=id=>document.getElementById(id);
 const studies={
  architecture:{
   desktop:'./site/studies/architecture-desktop.svg',
   mobile:'./site/studies/architecture-mobile.svg',
   title:'Two reference frames, metrics and TranquilSpeak',
   alt:'Design study: physical machine measurements and acquisition, TranquilSpeak and mathematics, computing runtime. Not a verified native end-to-end result.'
  },
  cognition:{
   desktop:'./site/studies/cognition-desktop.svg',
   mobile:'./site/studies/cognition-mobile.svg',
   title:'Foundation and continuing nine-stage cognition',
   alt:'Design study: stages 1 to 3 provide foundation; stages 4 to 9 form continuing cognition with feedback from stage 9 to stage 4.'
  }
 };
 const studyImage=$('study-image');
 const setIfDifferent=(el,attribute,value)=>{
  if(el.getAttribute(attribute)!==value)el.setAttribute(attribute,value);
 };
 const showStage=(s,cue)=>{
  const study=studies[s.topic]||null,container=$('study-display');
  container.hidden=!study;
  if(!study)return;
  setIfDifferent($('study-mobile'),'srcset',study.mobile);
  setIfDifferent($('study-dialog-mobile'),'srcset',study.mobile);
  setIfDifferent(studyImage,'src',study.desktop);
  setIfDifferent($('study-dialog-image'),'src',study.desktop);
  studyImage.alt=study.alt;
  $('study-dialog-image').alt=study.alt;
  $('study-dialog-heading').textContent=study.title+' · design study';
  $('study-caption').textContent=(cue?.label||study.title)+' · NOT END-TO-END VERIFIED';
  $('study-explanation').textContent=explanationForCue[cue?.id]||study.title;
 };
 function qualifyDiagram(generation) {
  const current=state.snapshot();
  if(current.generation!==generation||current.paused||current.outputs.spatial!=='pending'||
     !studies[current.topic]||$('study-display').hidden)return false;
  const image=studyImage,rect=image.getBoundingClientRect();
  if(image.complete&&image.naturalWidth>0&&rect.width>0&&rect.height>0){
   // The browser actually loaded the source diagram and laid it out.
   // This is qualified website output; NOT native TNOS cognition or a camera observation.
   state.observe(generation,'spatial','confirmed');
   return true;
  }
  return false;
 }
 studyImage.addEventListener('load',()=>{
  const generation=state.snapshot().generation;
  requestAnimationFrame(()=>qualifyDiagram(generation));
 });
 studyImage.addEventListener('error',()=>{
  const s=state.snapshot();
  if(studies[s.topic]&&s.outputs.spatial==='pending'&&!s.paused)
   state.observe(s.generation,'spatial','unavailable');
 });
 $('inspect-study').addEventListener('click',()=>{
  const s=state.snapshot();
  if(studies[s.topic])$('study-dialog').showModal();
 });
 $('close-study').addEventListener('click',()=>$('study-dialog').close());
 $('study-dialog').addEventListener('close',()=>{
  if(!$('study-display').hidden)$('inspect-study').focus({preventScroll:true});
 });
 $('depth').addEventListener('click',()=>{
  const s=state.snapshot();
  state.dispatch({type:'SET_DEPTH',depth:s.depth==='detail'?'overview':'detail'});
 });
 function update(s){
  const arrival=s.mode==='arrival',chooser=s.mode==='explore'&&!s.topic;
  const cue=cues[s.position]||null,detail=!arrival&&!chooser&&s.depth==='detail';
  $('deep-speech').hidden=!detail;
  $('deep-speech').textContent=detail?(explanationForCue[cue?.id]||''):'';
  const depthButton=$('depth');
  depthButton.hidden=arrival||chooser;
  depthButton.disabled=s.paused;
  depthButton.textContent=detail?'BACK TO OVERVIEW −':'EXPLAIN FURTHER +';
  depthButton.setAttribute('aria-expanded',String(detail));
  $('experience').dataset.depth=s.depth||'overview';
  const currentStudy=studies[s.topic]||null;
  showStage(s,cue);
  const figure=$('violet-presenter');
  figure.dataset.mode=s.mode;
  const failed=Object.values(s.outputs).some(x=>x==='failed'||x==='unavailable');
  const phase=arrival?'ready':s.paused?'paused':failed?'failed':
   chooser?'exploring':s.qualified?'presenting':'observing';
  figure.dataset.phase=phase;
  const phaseNames={ready:'PRESENTER READY',paused:'PRESENTATION PAUSED',
   failed:'PRESENTATION NEEDS RECOVERY',exploring:'EXPLORATION ACTIVE',
   observing:'AWAITING QUALIFIED OUTPUT',presenting:'CURRENT SUBJECT ESTABLISHED'};
  $('violet-condition').textContent=phaseNames[phase];
  const status=s.outputs||{};
  const phases=chooser?[
   [$('prop-requested'),'AWAITING SUBJECT',''],
   [$('prop-caption'),'NO CAPTION REQUEST',''],
   [$('prop-spatial'),'NO VISUAL REQUEST','']
  ]:[
   [$('prop-requested'),arrival?'NOT REQUESTED':'CUE REQUESTED',arrival?'':'confirmed'],
   [$('prop-caption'),status.caption==='confirmed'?'CAPTION OBSERVED':
      status.caption==='failed'?'CAPTION FAILED':'CAPTION PENDING',status.caption||''],
   [$('prop-spatial'),status.spatial==='confirmed'?'VISUAL OBSERVED':
      status.spatial==='failed'||status.spatial==='unavailable'?'VISUAL UNAVAILABLE':'VISUAL PENDING',status.spatial||'']
  ];
  for(const [element,label,result] of phases){
   element.textContent=label;
   element.classList.remove('confirmed','pending','failed');
   if(result)element.classList.add(result==='unavailable'?'failed':result);
  }
  if(currentStudy && s.outputs.spatial==='pending' && !s.paused){
   const generation=s.generation;
   requestAnimationFrame(()=>qualifyDiagram(generation));
  }
 }
 state.subscribe(update);
 update(state.snapshot());
 return Object.freeze({qualifyDiagram});
}
