import {createOpeningStore,openingMessage} from './opening-state.mjs';
import {createVioletEnvironment} from './violet-environment.mjs';

const stage=document.getElementById('environment');
const activate=document.getElementById('violet-activate');
const dialogue=document.getElementById('visitor-dialogue');
const caption=document.getElementById('violet-caption');
const form=document.getElementById('name-form');
const nameInput=document.getElementById('visitor-name');
const skip=document.getElementById('name-skip');
const scene=createVioletEnvironment(document.getElementById('world'));
const store=createOpeningStore(render);
let currentUtterance=null;

function beginSpeech(state){
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return;
  try{
    speechSynthesis.cancel();
    const token=state.speechToken;
    const u=new SpeechSynthesisUtterance(openingMessage(state));
    u.lang='en-US';u.rate=.95;u.pitch=1.12;u.volume=1;
    u.onstart=()=>{if(currentUtterance===u)store.dispatch({type:'SPEECH_STARTED',token});};
    const ended=()=>{if(currentUtterance===u){currentUtterance=null;store.dispatch({type:'SPEECH_ENDED',token});}};
    u.onend=ended;u.onerror=ended;
    currentUtterance=u;
    speechSynthesis.speak(u);
  }catch{
    currentUtterance=null; // Captions remain independently available.
  }
}
function render(state,previous){
  scene.update(state);
  stage.dataset.phase=state.phase;
  dialogue.hidden=state.phase==='dormant';
  if(state.phase==='dormant')return;
  caption.textContent=openingMessage(state);
  form.hidden=state.phase!=='asking-name';
  if(previous?.phase!==state.phase){
    beginSpeech(state);
    if(state.phase==='asking-name'){
      // Do not autofocus immediately: preserve the opening shot, especially on mobile.
      activate.hidden=true;
    }else if(state.phase==='welcome'){
      activate.hidden=true;
      // Do not invent a tour, navigation, or next action: the approved opening ends here.
    }
  }
}
activate.addEventListener('click',()=>store.dispatch({type:'ACTIVATE'}));
form.addEventListener('submit',event=>{event.preventDefault();store.dispatch({type:'GIVE_NAME',name:nameInput.value});});
skip.addEventListener('click',()=>store.dispatch({type:'SKIP_NAME'}));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&'speechSynthesis' in window)speechSynthesis.cancel();});
scene.update(store.getState());
