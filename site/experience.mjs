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
const store=createOpeningStore(render);
const voice=createVioletVoiceEngine();
activate.disabled=true;

function playApprovedTrack(state,{afterObservedName=false}={}){
  const selected=resolveVioletOpeningAudio(state);
  if(!selected||!timeline)throw new Error('No qualified Heart audio for authorized state');
  const source=afterObservedName?VIOLET_HEART_CONTINUATION:selected.src;
  const offset=afterObservedName?timeline.tracks['after-name'].cues[0].endMs:0;
  voice.playAuthored({
    src:source,
    token:state.speechToken,
    emit:event=>store.dispatch(event),
    onPosition:observation=>{
      if(observation.assetId!==source||
         observation.source!=='observed-authored-audio'||!observation.playing)
        return;
      const cue=cueAtObservedPosition(timeline,selected.track,observation.elapsedMs+offset);
      if(!cue)return;
      store.dispatch({
        type:'SPEECH_CUE_OBSERVED',token:state.speechToken,
        evidence:{...observation,track:selected.track,cueIndex:cue.index,
          elapsedMs:observation.elapsedMs+offset}
      });
    }
  });
}

async function beginSpeech(state){
  // A real name decision authorizes on-device Heart synthesis. The skipped
  // path needs no model download and continues with the approved recording.
  if(state.nameDecision!=='provided'){
    playApprovedTrack(state);
    return;
  }
  const token=state.speechToken;
  try{
    const generated=await synthesizeHeartName(state.visitorName);
    const current=store.getState();
    if(current.speechToken!==token||current.nameDecision!=='provided'||
      current.speechStatus!=='pending'||document.hidden)return;
    activeNameAudio={token,generated};
    const session=voice.playGenerated({
      wav:generated.wav,token,
      emit:event=>store.dispatch(event),
      onEnded:()=>{
        const observed=store.getState();
        if(observed.speechToken!==token||observed.speechStatus!=='speaking')return;
        store.dispatch({type:'NAME_AUDIO_ENDED',token,
          evidence:{type:'observed-generated-heart-ended',assetId:'generated-heart:'+token}});
        activeNameAudio=null;
        const continuing=store.getState();
        if(continuing.nameAudioCompleted&&continuing.speechStatus==='speaking')
          playApprovedTrack(continuing,{afterObservedName:true});
      }
    });
    if(!session&&store.getState().speechToken===token &&
       store.getState().speechStatus==='pending')
      store.dispatch({type:'SPEECH_FAILED',token,
        reason:'Qualified generated Heart audio could not be played'});
  }catch(error){
    activeNameAudio=null;
    const current=store.getState();
    if(current.speechToken===token&&current.speechStatus==='pending')
      store.dispatch({type:'SPEECH_FAILED',token,
        reason:String(error?.message||error)});
  }
}

function observeGeneratedSpeechFrame(){
  const state=store.getState();
  if(!activeNameAudio||activeNameAudio.token!==state.speechToken||
    state.nameDecision!=='provided'||state.phase!=='welcome'||
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
  const source=state.phase==='asking-name'?'asking-name':
    state.nameDecision==='provided'?'post-welcome':'after-name';
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
  activeNameAudio=null;
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
  const {createVioletEnvironment}=await import('./violet-environment.mjs');
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
