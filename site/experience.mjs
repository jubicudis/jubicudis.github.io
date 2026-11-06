import {createOpeningStore,openingMessage} from './opening-state.mjs';
import {createVioletVoiceEngine} from './violet-voice.mjs';

const stage=document.getElementById('environment');
const activate=document.getElementById('violet-activate');
const dialogue=document.getElementById('visitor-dialogue');
const caption=document.getElementById('violet-caption');
const form=document.getElementById('name-form');
const nameInput=document.getElementById('visitor-name');
const skip=document.getElementById('name-skip');
const failure=document.getElementById('render-failure');
let scene=null;
const store=createOpeningStore(render);
const voice=createVioletVoiceEngine();
activate.disabled=true;

function beginSpeech(state){
  // The existing opening phase is the sole authority deciding when speech
  // begins. Voice capabilities never choose a moment or presentation route.
  voice.speakBrowser({
    text:openingMessage(state),
    token:state.speechToken,
    emit:event=>store.dispatch(event)
  });
}
function render(state,previous){
  scene?.update(state);
  stage.dataset.phase=state.phase;
  stage.dataset.renderStatus=state.renderStatus;
  activate.disabled=state.renderStatus!=='observed';
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
    if(state.phase==='asking-name'||state.phase==='welcome'){
      activate.hidden=true;
    }
  }
}
activate.addEventListener('click',()=>{
  if(store.getState().renderStatus==='observed')store.dispatch({type:'ACTIVATE'});
});
form.addEventListener('submit',event=>{
  event.preventDefault();store.dispatch({type:'GIVE_NAME',name:nameInput.value});
});
skip.addEventListener('click',()=>store.dispatch({type:'SKIP_NAME'}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)voice.cancel('page-hidden');
});

store.dispatch({type:'RENDER_STARTED'});
try{
  // Loading failures remain failures. There is no alternate 2D stand-in and no false "rendered" event.
  const {createVioletEnvironment}=await import('./violet-environment.mjs');
  scene=await createVioletEnvironment(document.getElementById('world'),{
    onObserved:evidence=>store.dispatch({type:'RENDER_OBSERVED',evidence}),
    onFailure:error=>store.dispatch({type:'RENDER_FAILED',reason:error.message||String(error)})
  });
  scene.update(store.getState());
}catch(error){
  store.dispatch({type:'RENDER_FAILED',reason:error?.message||String(error)});
}
