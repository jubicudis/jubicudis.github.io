import {createOpeningStore,openingMessage,nameChoiceReady} from './opening-state.mjs';
import {createVioletVoiceEngine} from './violet-voice.mjs';
import {resolveVioletOpeningAudio,validateHeartTimeline,cueAtObservedPosition,
  VIOLET_TIMELINE_URL,VIOLET_HEART_CONTINUATION} from './violet-selected-voice.mjs';
import {synthesizeHeartName,sampleGeneratedViseme} from './violet-dynamic-name.mjs';
import {HEART_ENVELOPE_URL,validateHeartEnvelope,sampleMeasuredHeartEnvelope}
  from './violet-heart-envelope.mjs';

const stage=document.getElementById('environment');
const activate=document.getElementById('violet-activate');
const dialogue=document.getElementById('visitor-dialogue');
const caption=document.getElementById('violet-caption');
const form=document.getElementById('name-form');
const nameInput=document.getElementById('visitor-name');
const skip=document.getElementById('name-skip');
const failure=document.getElementById('render-failure');
const audioFailure=document.getElementById('audio-failure');
let scene=null,timeline=null,envelope=null,narrationLoadFailure=null,activeNameAudio=null;
let preparedName=null,nameSynthesisError=null,nameInsertionActive=false,nameInsertionDone=false;
const store=createOpeningStore(render);
const voice=createVioletVoiceEngine();
activate.disabled=true;

function playApprovedTrack(state,{resumeAtMs=0}={}){
  const selected=resolveVioletOpeningAudio(state);
  if(!selected||!timeline)throw new Error('No qualified Heart audio for authorized state');
  const source=selected.src;
  const offset=0;
  voice.playAuthored({
    src:source,
    token:state.speechToken,startAtMs:resumeAtMs,
    emit:event=>store.dispatch(event),
    onPosition:observation=>{
      if(observation.assetId!==source||
         observation.source!=='observed-authored-audio'||!observation.playing)
        return;
      const cue=cueAtObservedPosition(timeline,selected.track,observation.elapsedMs+offset);
      if(!cue)return;
      const previousCueIndex=store.getState().cueIndex;
      store.dispatch({
        type:'SPEECH_CUE_OBSERVED',token:state.speechToken,
        evidence:{...observation,track:selected.track,cueIndex:cue.index,
          elapsedMs:observation.elapsedMs+offset}
      });
      if(state.nameDecision==='provided'&&!nameInsertionDone&&
         !nameInsertionActive&&preparedName&&cue.index>=4&&
         cue.index>previousCueIndex)
        insertPreparedName(state,observation.elapsedMs);

    }
  });
}

function insertPreparedName(state,resumeAtMs){
  const generated=preparedName;
  if(!generated||nameInsertionActive||nameInsertionDone)return;
  nameInsertionActive=true;
  preparedName=null;
  const token=state.speechToken;
  activeNameAudio={token,generated};
  const session=voice.playGenerated({
    wav:generated.wav,token,insertAfterAuthored:true,
    emit:event=>store.dispatch(event),
    onEnded:()=>{
      const observed=store.getState();
      if(observed.speechToken!==token)return;
      store.dispatch({type:'NAME_AUDIO_ENDED',token,
        evidence:{type:'observed-generated-heart-ended',assetId:'generated-heart:'+token}});
      nameInsertionActive=false;
      nameInsertionDone=true;
      activeNameAudio=null;
      if(observed.speechStatus==='speaking')
        playApprovedTrack(store.getState(),{resumeAtMs});
    }
  });
  if(!session)nameInsertionActive=false;
}

async function beginSpeech(state){
  // The selected recorded Heart narration begins immediately after the
  // name decision. Synthesis is concurrent, not a silent prerequisite.
  nameInsertionActive=false;
  nameInsertionDone=false;
  preparedName=null;
  nameSynthesisError=null;
  playApprovedTrack(state);
  if(state.nameDecision!=='provided')return;
  const token=state.speechToken;
  try{
    const generated=await synthesizeHeartName(state.visitorName);
    const current=store.getState();
    if(current.speechToken!==token||current.nameDecision!=='provided'||
       ['failed','interrupted','completed'].includes(current.speechStatus)||
       document.hidden)return;
    preparedName=generated;
  }catch(error){
    // Do not interrupt an actual Heart recording because optional
    // personalization failed; do not pretend the name was spoken.
    nameSynthesisError=String(error?.message||error);
    console.error('Optional Heart name synthesis failed',error);
  }
}

function observeGeneratedSpeechFrame(){
  const state=store.getState();
  if(!activeNameAudio||activeNameAudio.token!==state.speechToken||
    state.nameDecision!=='provided'||
    state.speechStatus!=='speaking'||voice.activeSource()!=='generated')
    return;
  const observation=voice.sampleGeneratedClock(state.speechToken);
  if(!observation)return;
  const sampled=sampleGeneratedViseme(activeNameAudio.generated,observation);
  // A gap in actual viseme metadata carries a closed mouth, not a fabricated
  // phoneme. Only the observed audio playback clock can drive this expression.
  const pose=sampled?.pose??'viseme-closed';
  if(pose===state.observedSpeechPose)return;
  store.dispatch({type:'GENERATED_VISEME_OBSERVED',token:state.speechToken,
    evidence:{type:'generated-viseme-audio-observed',
      source:observation.source,voiceId:activeNameAudio.generated.voiceId,
      assetId:observation.assetId,playing:true,elapsedMs:observation.elapsedMs,
      pose}});
}
function observeApprovedSpeechFrame(){
  const state=store.getState();
  if(!envelope||state.speechStatus!=='speaking'||
    voice.activeSource()!=='authored')return;
  const observation=voice.sampleAuthoredClock(state.speechToken);
  if(!observation)return;
  const source=state.phase==='asking-name'?'asking-name':'after-name';
  const sampled=sampleMeasuredHeartEnvelope(envelope,source,observation);
  if(!sampled)return;
  if(state.observedSpeechPose===sampled.pose)return;
  store.dispatch({
    type:'AUTHORED_ENVELOPE_OBSERVED',
    token:state.speechToken,
    evidence:sampled
  });
}
function observeSpeechFrame(){
  observeGeneratedSpeechFrame();
  observeApprovedSpeechFrame();
}
function render(state,previous){
  scene?.update(state);
  stage.dataset.phase=state.phase;
  stage.dataset.cueIndex=String(state.cueIndex);
  stage.dataset.speechStatus=state.speechStatus;
  stage.dataset.speechPose=state.observedSpeechPose||'';
  stage.dataset.nameAudioCompleted=String(state.nameAudioCompleted);
  stage.dataset.renderStatus=state.renderStatus;
  activate.disabled=state.renderStatus!=='observed'||state.voiceSupported!==true;
  failure.hidden=state.renderStatus!=='failed';
  if(state.renderStatus==='failed')
    failure.textContent='Violet could not be rendered on this device. '+state.renderFailure;
  const speechFailed=['failed','unavailable','interrupted'].includes(state.speechStatus);
  audioFailure.hidden=!narrationLoadFailure&&!speechFailed;
  if(!audioFailure.hidden)
    audioFailure.textContent=narrationLoadFailure
      ?'Heart narration is unavailable. '+narrationLoadFailure
      :'Heart narration '+(state.speechStatus==='interrupted'
        ?'was interrupted.':'could not be played.');
  dialogue.hidden=state.phase==='dormant';
  if(state.phase==='dormant')return;
  // Captions remain inside the shared presentation, not a separate chat UI.
  caption.textContent=openingMessage(state);
  form.hidden=!nameChoiceReady(state);
  if(previous?.speechToken!==state.speechToken&&state.speechStatus==='pending'){
    beginSpeech(state);
    activate.hidden=true;
  }
}
activate.addEventListener('click',()=>{
  const state=store.getState();
  if(state.renderStatus==='observed'&&state.voiceSupported===true)
    store.dispatch({type:'ACTIVATE'});
});
form.addEventListener('submit',event=>{
  event.preventDefault();
  store.dispatch({type:'GIVE_NAME',name:nameInput.value});
});
skip.addEventListener('click',()=>store.dispatch({type:'SKIP_NAME'}));
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)return;
  const current=store.getState();
  if(current.speechStatus==='pending'&&current.nameDecision==='provided')
    store.dispatch({type:'SPEECH_INTERRUPTED',token:current.speechToken});
  activeNameAudio=null;preparedName=null;
  voice.cancel('page-hidden');
});

// Audio media is checked separately from actual WebGL observation. Loading
// a timeline authorizes requesting speech, never claiming that speech played.
const narrationReady=(async()=>{
  try{
    const [timelineResponse,envelopeResponse]=await Promise.all([
      fetch(VIOLET_TIMELINE_URL,{cache:'no-cache'}),
      fetch(HEART_ENVELOPE_URL,{cache:'no-cache'})
    ]);
    if(!timelineResponse.ok||!envelopeResponse.ok)
      throw new Error('approved Heart speech metadata unavailable');
    const parsed=validateHeartTimeline(await timelineResponse.json());
    const measured=validateHeartEnvelope(await envelopeResponse.json());
    for(const track of ['asking-name','after-name']){
      if(Math.abs(parsed.tracks[track].durationMs-
         measured.tracks[track].durationMs)>80)
        throw new Error('Measured Heart audio does not align with approved narration');
    }
    timeline=parsed;
    envelope=measured;
    store.dispatch({type:'VOICE_AVAILABLE',value:true});
  }catch(error){
    narrationLoadFailure=String(error?.message||error);
    store.dispatch({type:'VOICE_AVAILABLE',value:false});
  }
})();
store.dispatch({type:'RENDER_STARTED'});
try{
  const {createVioletEnvironment}=await import('./violet-environment.mjs?v=20261106-face-02');
  scene=await createVioletEnvironment(document.getElementById('world'),{
    onObserved:evidence=>store.dispatch({type:'RENDER_OBSERVED',evidence}),
    onFailure:error=>store.dispatch({type:'RENDER_FAILED',reason:error.message||String(error)}),
    onAudioFrame:observeSpeechFrame
  });
  scene.update(store.getState());
}catch(error){
  store.dispatch({type:'RENDER_FAILED',reason:error?.message||String(error)});
}
await narrationReady;
render(store.getState(),store.getState());
