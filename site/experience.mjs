import {createOpeningStore,openingMessage} from './opening-state.mjs';

const stage=document.getElementById('environment');
const activate=document.getElementById('violet-activate');
const dialogue=document.getElementById('visitor-dialogue');
const caption=document.getElementById('violet-caption');
const form=document.getElementById('name-form');
const nameInput=document.getElementById('visitor-name');
const skip=document.getElementById('name-skip');
const failure=document.getElementById('render-failure');
let scene=null,currentUtterance=null;
const store=createOpeningStore(render);
activate.disabled=true;

function beginSpeech(state){
  const token=state.speechToken;
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){
    store.dispatch({type:'SPEECH_UNAVAILABLE',token});return;
  }
  try{
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(openingMessage(state));
    utterance.lang='en-US';utterance.rate=.95;utterance.pitch=1.12;utterance.volume=1;
    utterance.onstart=()=>{
      if(currentUtterance===utterance)store.dispatch({type:'SPEECH_STARTED',token});
    };
    const ended=()=>{
      if(currentUtterance===utterance){
        currentUtterance=null;store.dispatch({type:'SPEECH_ENDED',token});
      }
    };
    utterance.onend=ended;
    utterance.onerror=()=>{
      if(currentUtterance===utterance){
        currentUtterance=null;store.dispatch({type:'SPEECH_FAILED',token});
      }
    };
    currentUtterance=utterance;speechSynthesis.speak(utterance);
  }catch{
    currentUtterance=null;store.dispatch({type:'SPEECH_FAILED',token});
  }
}
function render(state,previous){
  scene?.update(state);
  stage.dataset.phase=state.phase;
  stage.dataset.renderStatus=state.renderStatus;
  stage.dataset.presence=state.presence;
  activate.disabled=state.renderStatus!=='observed'||state.phase==='asking-name'||['receding','returning'].includes(state.presence);
  activate.hidden=state.phase==='asking-name';
  activate.setAttribute('aria-label',state.phase==='dormant'?'Activate Violet':state.presence==='marker'?'Recall Violet':'Let Violet step back');
  failure.hidden=state.renderStatus!=='failed';
  if(state.renderStatus==='failed'){
    // This is an actual renderer failure. No replacement character is drawn.
    failure.textContent='Violet could not be rendered on this device. '+state.renderFailure;
  }
  dialogue.hidden=state.phase==='dormant';
  if(state.phase==='dormant')return;
  caption.textContent=openingMessage(state);
  form.hidden=state.phase!=='asking-name';
  if(previous?.phase!==state.phase){
    beginSpeech(state);

  }
}
activate.addEventListener('click',()=>{
  const state=store.getState();
  if(state.renderStatus!=='observed')return;
  if(state.phase==='dormant')store.dispatch({type:'ACTIVATE'});
  else if(state.phase==='welcome'&&state.presence==='full')store.dispatch({type:'PRESENCE_HIDE'});
  else if(state.phase==='welcome'&&state.presence==='marker')store.dispatch({type:'PRESENCE_RECALL'});
});
form.addEventListener('submit',event=>{
  event.preventDefault();store.dispatch({type:'GIVE_NAME',name:nameInput.value});
});
skip.addEventListener('click',()=>store.dispatch({type:'SKIP_NAME'}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&'speechSynthesis' in window)speechSynthesis.cancel();
});

store.dispatch({type:'RENDER_STARTED'});
try{
  // Loading failures remain failures. There is no alternate 2D stand-in and no false "rendered" event.
  const {createVioletEnvironment}=await import('./violet-environment.mjs');
  scene=await createVioletEnvironment(document.getElementById('world'),{
    onObserved:evidence=>store.dispatch({type:'RENDER_OBSERVED',evidence}),
    onPresenceObserved:event=>store.dispatch(event),
    onFailure:error=>store.dispatch({type:'RENDER_FAILED',reason:error.message||String(error)})
  });
  scene.update(store.getState());
}catch(error){
  store.dispatch({type:'RENDER_FAILED',reason:error?.message||String(error)});
}
