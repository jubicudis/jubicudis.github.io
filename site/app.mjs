import {CUES,TOPICS,topicById} from './content.mjs';
import {createStore} from './state.mjs';
import {renderFigure} from './visuals.mjs';

const get=id=>document.getElementById(id);
const ui=Object.fromEntries([
  'experience','story','story-kicker','story-title','story-visual','story-copy','story-evidence',
  'previous','next','progress','explore','violet','conversation','violet-message',
  'name-form','visitor-name','skip-name','welcome-actions','begin','exploration',
  'explore-title','explore-description','explore-visual','explore-detail','explore-actions',
  'return','ending','explore-all','utility','voice-toggle','presence-toggle'
].map(id=>[id,get(id)]));
let lastFigureKey='',lastSpeechKey='';
let currentUtterance=null;
let lastFocusPhase='idle';

const store=createStore((state,previous,event)=>render(state,previous,event));
function welcomeMessage(state){
  const address=state.nameChoice==='named'?', '+state.name:'';
  return 'Welcome'+address+'. This website introduces TNOS, the Workbench used to help develop it, and the separate MCP server. We will explore what is intended, what has been developed, and what still needs to be done. You can interrupt the presentation to explore a subject and return to your place.';
}
function spokenFor(state){
  switch(state.phase){
    case 'name':return 'Hello, I’m Violet. What is your name?';
    case 'welcome':return welcomeMessage(state);
    case 'talk':return CUES[state.index].speech;
    default:return '';
  }
}
function speechIdentity(state){
  if(!['name','welcome','talk'].includes(state.phase))return '';
  return state.phase==='talk'?'talk:'+CUES[state.index].key:state.phase+':'+(state.name||'anonymous');
}
function cancelSpeech(){
  if('speechSynthesis' in window){window.speechSynthesis.cancel();}
  currentUtterance=null;
}
function narrate(state){
  const identity=speechIdentity(state);
  if(!identity || identity===lastSpeechKey || !state.voiceEnabled)return;
  lastSpeechKey=identity;
  if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window))return;
  cancelSpeech();
  const utterance=new SpeechSynthesisUtterance(spokenFor(state));
  utterance.lang='en-US';utterance.rate=.95;utterance.pitch=1.06;
  currentUtterance=utterance;
  utterance.onstart=()=>{if(currentUtterance===utterance)store.dispatch({type:'SPEECH_STARTED',key:identity});};
  utterance.onend=()=>{if(currentUtterance===utterance){currentUtterance=null;store.dispatch({type:'SPEECH_ENDED',key:identity});}};
  utterance.onerror=()=>{if(currentUtterance===utterance){currentUtterance=null;store.dispatch({type:'SPEECH_ENDED',key:identity});}};
  window.speechSynthesis.speak(utterance);
}
function renderTopicChoices(state){
  ui['explore-actions'].replaceChildren();
  for(const topic of TOPICS){
    const button=document.createElement('button');
    button.type='button';button.textContent=topic.title;
    button.setAttribute('aria-current',String(state.topicId===topic.id));
    button.addEventListener('click',()=>store.dispatch({type:'SELECT_TOPIC',id:topic.id}));
    ui['explore-actions'].append(button);
  }
}
function render(state,previous,event){
  ui.experience.dataset.phase=state.phase;
  ui.experience.dataset.presence=state.presence;
  ui.violet.dataset.presence=state.presence;
  ui.violet.setAttribute('aria-label',state.phase==='idle'?'Activate Violet':state.presence==='marker'||state.presence==='receding'?'Recall Violet':'Violet: reduce visible presence');
  const hasStarted=state.phase!=='idle';
  ui.utility.hidden=!hasStarted;
  ui['voice-toggle'].textContent=state.voiceEnabled?'Voice on':'Voice off';
  ui['voice-toggle'].setAttribute('aria-pressed',String(state.voiceEnabled));
  if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)){
    ui['voice-toggle'].textContent='Voice unavailable';ui['voice-toggle'].disabled=true;
  }
  ui['presence-toggle'].textContent=state.presence==='marker'||state.presence==='receding'?'Recall Violet':'Let Violet step back';
  ui.conversation.hidden=!['name','welcome'].includes(state.phase);
  ui['name-form'].hidden=state.phase!=='name';
  ui['welcome-actions'].hidden=state.phase!=='welcome';
  ui.story.hidden=state.phase!=='talk';
  ui.exploration.hidden=state.phase!=='explore';
  ui.ending.hidden=state.phase!=='complete';
  if(state.phase==='name'){
    ui['violet-message'].textContent='Hello, I’m Violet. What is your name?';
  }else if(state.phase==='welcome'){
    ui['violet-message'].textContent=welcomeMessage(state);
  }
  if(state.phase==='talk'){
    const cue=CUES[state.index];
    ui['story-kicker'].textContent='TNOS · '+TOPICS.find(t=>t.id===cue.chapter).title;
    ui['story-title'].textContent=cue.title;
    ui['story-copy'].textContent=cue.speech;
    ui['story-evidence'].textContent=cue.status;
    ui['previous'].disabled=state.index===0;
    ui['next'].textContent=state.index===CUES.length-1?'Finish presentation':'Continue';
    ui.progress.textContent=(state.index+1)+' / '+CUES.length;
    const figureKey='talk:'+cue.key;
    if(figureKey!==lastFigureKey){renderFigure(ui['story-visual'],cue.figure);lastFigureKey=figureKey;}
  }
  if(state.phase==='explore'){
    const topic=topicById(state.topicId);
    if(!topic)throw new Error('No project subject available for the chosen id');
    ui['explore-title'].textContent=topic.title;
    ui['explore-description'].textContent='Examine the established relationships and development status, then return to the guided presentation.';
    const figureKey='explore:'+topic.id;
    if(figureKey!==lastFigureKey){renderFigure(ui['explore-visual'],topic.figure);lastFigureKey=figureKey;}
    ui['explore-detail'].replaceChildren();
    for(const paragraph of topic.detail){
      const p=document.createElement('p');p.textContent=paragraph;ui['explore-detail'].append(p);
    }
    renderTopicChoices(state);
    ui['return'].textContent=state.checkpointPhase==='complete'?'Return to the closing':'Return to the presentation';
  }
  if(state.phase!==previous?.phase && lastFocusPhase!==state.phase){
    lastFocusPhase=state.phase;
    if(state.phase==='name')requestAnimationFrame(()=>ui['visitor-name'].focus({preventScroll:true}));
    if(state.phase==='welcome')requestAnimationFrame(()=>ui.begin.focus({preventScroll:true}));
    if(state.phase==='talk')requestAnimationFrame(()=>ui['story-title'].setAttribute('tabindex','-1'));
  }
  if(event?.type==='VOICE_TOGGLE'&&!state.voiceEnabled){cancelSpeech();lastSpeechKey='';}
  if(event && state.phase!==previous?.phase && state.phase==='explore')cancelSpeech();
  if(event && (event.type==='NEXT'||event.type==='PREVIOUS'||event.type==='BEGIN'||event.type==='ACTIVATE'||event.type==='NAME'||event.type==='SKIP_NAME')){cancelSpeech();}
  if(event?.type==='VOICE_TOGGLE'&&state.voiceEnabled)lastSpeechKey='';
  narrate(state);
  if(state.visualObservedGeneration!==state.visualGeneration){
    const generation=state.visualGeneration;
    requestAnimationFrame(()=>{
      if(store.getState().visualGeneration!==generation)return;
      const target=state.phase==='talk'?ui['story-visual']:state.phase==='explore'?ui['explore-visual']:state.phase==='complete'?ui.ending:state.phase==='idle'?ui.violet:ui.conversation;
      const rect=target.getBoundingClientRect();
      const style=getComputedStyle(target);
      // Layout-only observation. This is not OpenCV pixel evidence or a TNOS runtime observation.
      const visible=target.isConnected&&!target.hidden&&rect.width>0&&rect.height>0&&style.visibility!=='hidden';
      if(visible)store.dispatch({type:'VISUAL_OBSERVED',generation,isVisible:true});
    });
  }
  if(matchMedia('(prefers-reduced-motion: reduce)').matches&&['receding','returning'].includes(state.presence)){
    const generation=state.presenceGeneration;
    requestAnimationFrame(()=>store.dispatch({type:'PRESENCE_SETTLED',generation,target:state.presence==='receding'?'marker':'full'}));
  }
}
ui.violet.addEventListener('click',()=>{
  const state=store.getState();
  if(state.phase==='idle')store.dispatch({type:'ACTIVATE'});
  else if(['marker','receding'].includes(state.presence))store.dispatch({type:'RECALL'});
  else store.dispatch({type:'HIDE'});
});
ui.violet.addEventListener('transitionend',event=>{
  if(event.propertyName!=='opacity'||!event.target.classList?.contains('strand'))return;
  const state=store.getState();
  if(state.presence==='receding'||state.presence==='returning'){
    store.dispatch({type:'PRESENCE_SETTLED',generation:state.presenceGeneration,target:state.presence==='receding'?'marker':'full'});
  }
});
ui['name-form'].addEventListener('submit',event=>{event.preventDefault();store.dispatch({type:'NAME',value:ui['visitor-name'].value});});
ui['skip-name'].addEventListener('click',()=>store.dispatch({type:'SKIP_NAME'}));
ui.begin.addEventListener('click',()=>store.dispatch({type:'BEGIN'}));
ui.next.addEventListener('click',()=>store.dispatch({type:'NEXT'}));
ui.previous.addEventListener('click',()=>store.dispatch({type:'PREVIOUS'}));
ui.explore.addEventListener('click',()=>store.dispatch({type:'EXPLORE'}));
ui['explore-all'].addEventListener('click',()=>store.dispatch({type:'EXPLORE_ALL'}));
ui['return'].addEventListener('click',()=>store.dispatch({type:'RETURN'}));
ui['voice-toggle'].addEventListener('click',()=>store.dispatch({type:'VOICE_TOGGLE'}));
ui['presence-toggle'].addEventListener('click',()=>{
  const s=store.getState();
  store.dispatch({type:['marker','receding'].includes(s.presence)?'RECALL':'HIDE'});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelSpeech();});
render(store.getState());
