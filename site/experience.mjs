import {createOpeningStore,openingMessage,nameChoiceReady} from './opening-state.mjs?v=20261109-language-fallback-29';
import {VISITOR_NAME_SLOT} from './opening-script.mjs?v=20261108-name-slot-21';
import {createVioletVoiceEngine} from './violet-voice.mjs?v=20261109-metadata-seek-25';
import {resolveVioletOpeningAudio,validateHeartTimeline,cueAtObservedPosition,
  VIOLET_TIMELINE_URL,VIOLET_HEART_CONTINUATION} from './violet-selected-voice.mjs?v=20261106-name-05';
import {synthesizeHeartName,sampleGeneratedViseme} from './violet-dynamic-name.mjs?v=20261109-kokoro-singlethread-01';
import {HEART_ENVELOPE_URL,validateHeartEnvelope,sampleMeasuredHeartEnvelope}
  from './violet-heart-envelope.mjs';

import {prepareQualifiedTranslator,localizeApprovedOpening}
  from './violet-localization.mjs?v=20261109-multilingual-1';
import {createBrowserKokoroAdapter}
  from './violet-kokoro-multilingual.mjs?v=20261109-kokoro-singlethread-01';
import {OPENING_TRACKS,VISITOR_NAME_SLOT as NAME_SLOT}
  from './opening-script.mjs?v=20261108-name-slot-21';

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
let preparedName=null,nameSynthesisError=null,pendingNameBoundary=null;
let localizedPresentation=null,localizedAdapter=null,localizedFailure=null;
let observeAuthoredPosition=null;
let localizedFrameObserver=null;
const store=createOpeningStore(render);
const observedBrowserLocale=(navigator.languages||[])
  .find(value=>typeof value==='string'&&value.trim())||
  navigator.language||'en-US';
const canonicalBrowserLocale=observedBrowserLocale.split('@')[0].replace(/_/g,'-');
store.dispatch({type:'BROWSER_LANGUAGE_OBSERVED',
  evidence:{type:'browser-language-observed',locale:canonicalBrowserLocale}});
const voice=createVioletVoiceEngine();
activate.disabled=true;

async function playLocalizedTrack(state){
  const token=state.speechToken,track=state.track;
  const segments=localizedPresentation.tracks[track];
  const visitorName=state.visitorName;
  try{
    for(let i=0;i<segments.length;i++){
      if(store.getState().speechToken!==token||document.hidden)return;
      // The name is a separate synthesized line at the approved seam.
      if(track==='after-name'&&i===NAME_SLOT.beforeCueIndex&&visitorName){
        const line=localizedPresentation.nameLine(visitorName);
        store.dispatch({type:'LOCALIZED_NAME_LINE_READY',token,text:line});
        store.dispatch({type:'NAME_SYNTHESIS_STARTED',token});
        // Synthesis readiness is observed after actual PCM generation.
        // Playback evidence is established independently. The
        // localized name slot is observed only when the generated PCM plays.
        await playLocalizedClip(line,token,{name:true,nameCueIndex:i});
      }
      await playLocalizedClip(segments[i].text,token,{cueIndex:i});
    }
    if(store.getState().speechToken===token&&
       store.getState().speechStatus==='speaking')
      store.dispatch({type:'SPEECH_ENDED',token});
  }catch(error){
    if(store.getState().speechToken!==token)return;
    localizedFailure=String(error?.message||error);
    localizedFrameObserver=null;
    voice.cancel('localized-narration-failed');
    store.dispatch({type:'SPEECH_FAILED',token,reason:localizedFailure});
  }
}
async function playLocalizedClip(text,token,{cueIndex=null,name=false,nameCueIndex=null}={}){
  const generated=await localizedAdapter.synthesize(text);
  if(store.getState().speechToken!==token||document.hidden)
    throw new Error('Localized narration session interrupted');
  if(name)store.dispatch({type:'NAME_SYNTHESIS_READY',token});
  await new Promise((resolve,reject)=>{
    let started=false,cueObserved=false;
    const onPosition=observation=>{
      if(!observation?.playing||observation.source!=='observed-generated-heart-audio')return;
      if(!cueObserved&&Number.isInteger(cueIndex)){
        cueObserved=true;
        store.dispatch({type:'LOCALIZED_CUE_OBSERVED',token,
          evidence:{type:'localized-pcm-cue-playing',cueIndex}});
      }
      const start=Math.min(generated.pcm.length-1,
        Math.floor(observation.elapsedMs*generated.sampleRate/1000));
      const end=Math.min(generated.pcm.length,start+
        Math.max(1,Math.floor(generated.sampleRate*.02)));
      let sum=0;
      for(let i=start;i<end;i++)sum+=generated.pcm[i]*generated.pcm[i];
      const level=Math.min(255,Math.round(Math.sqrt(sum/(end-start))*255));
      const current=store.getState();
      if(current.localizedAudioPositionMs===observation.elapsedMs&&
         current.observedAudioLevel===level)return;
      store.dispatch({type:'LOCALIZED_AUDIO_FRAME_OBSERVED',token,
        evidence:{type:'localized-pcm-clock-observed',playing:true,
          elapsedMs:observation.elapsedMs,level}});
    };
    localizedFrameObserver=onPosition;
    const session=voice.playGenerated({
      wav:generated.wav,token,
      emit:event=>{
        if(event.type==='SPEECH_STARTED'){
          started=true;
          store.dispatch(event);
          if(Number.isInteger(cueIndex)){
            cueObserved=true;
            store.dispatch({type:'LOCALIZED_CUE_OBSERVED',token,
              evidence:{type:'localized-pcm-cue-playing',cueIndex}});
          }
          if(name){
            store.dispatch({type:'LOCALIZED_CUE_OBSERVED',token,
              evidence:{type:'localized-pcm-cue-playing',cueIndex:nameCueIndex}});
            store.dispatch({type:'NAME_SLOT_OBSERVED',token,
              evidence:{type:'authored-name-slot-boundary-observed',cueIndex:nameCueIndex}});
            store.dispatch({type:'NAME_INSERTION_REQUESTED',token,
              evidence:{type:'authored-paragraph-boundary-observed'}});
            store.dispatch({type:'NAME_AUDIO_STARTED',token,
              evidence:{type:'observed-generated-heart-playing'}});
          }
        }else if(['SPEECH_FAILED','SPEECH_UNAVAILABLE'].includes(event.type)){
          reject(new Error(event.reason||'Localized audio unavailable'));
        }
      },
      onPosition,
      onEnded:()=>{
        if(localizedFrameObserver===onPosition)localizedFrameObserver=null;
        if(name)store.dispatch({type:'NAME_AUDIO_ENDED',token,
          evidence:{type:'observed-generated-heart-ended',assetId:'generated-heart:'+token}});
        started?resolve():reject(new Error('Localized audio ended without playing'));
      }
    });
    if(!session){
      if(localizedFrameObserver===onPosition)localizedFrameObserver=null;
      reject(new Error('Localized audio playback unavailable'));
    }
  });
}

function playApprovedTrack(state,{resumeAtMs=0,continueAfterGenerated=false}={}){
  observeAuthoredPosition=null;
  const selected=resolveVioletOpeningAudio(state);
  if(!selected||!timeline)throw new Error('No qualified Heart audio for authorized state');
  const source=selected.src;
  const onPosition=observation=>{
    if(observation.assetId!==source||
       observation.source!=='observed-authored-audio'||!observation.playing)return;
    const cue=cueAtObservedPosition(timeline,selected.track,observation.elapsedMs);
    if(!cue)return;
    const currentBefore=store.getState();
    if(cue.index!==currentBefore.cueIndex||
       observation.elapsedMs!==currentBefore.playbackPositionMs)
      store.dispatch({type:'SPEECH_CUE_OBSERVED',token:state.speechToken,
        evidence:{...observation,track:selected.track,cueIndex:cue.index,
          elapsedMs:observation.elapsedMs}});
    // Only the approved paragraph boundary can interrupt the recording.
    // A later cue cannot masquerade as a second name insertion seam.
    if(state.nameDecision!=='provided'||
       cue.index<VISITOR_NAME_SLOT.beforeCueIndex||
       store.getState().nameInsertionStatus!=='waiting')return;
    if(!store.getState().nameSlotObserved)
      store.dispatch({type:'NAME_SLOT_OBSERVED',token:state.speechToken,
        evidence:{type:'authored-name-slot-boundary-observed',
          cueIndex:VISITOR_NAME_SLOT.beforeCueIndex}});
    if(cue.index!==VISITOR_NAME_SLOT.beforeCueIndex)return;
    const seamMs=timeline.tracks[selected.track].cues[cue.index].startMs;
    // The authored timeline, not a coarse Safari sampling instant, owns
    // the insertion point. A late observation authorizes holding the real
    // player, but must never shift the approved line or its continuation.
    if(observation.elapsedMs<seamMs)return;
    const resumeAtMs=seamMs;
    if(voice.holdAuthoredForName(state.speechToken,resumeAtMs)){
      // The first sound after the generated name is exactly cue 8,
      // regardless of how late WebKit delivered its playback observation.
      pendingNameBoundary=resumeAtMs;
      store.dispatch({type:'NAME_SEAM_HELD',token:state.speechToken,
        evidence:{type:'authored-media-paused-at-name-seam'}});
      const current=store.getState();
      if(current.nameSynthesisStatus==='ready')
        requestNameInsertion(current,resumeAtMs,
          'authored-paragraph-boundary-observed');
    }
  };
  observeAuthoredPosition=onPosition;
  voice.playAuthored({
    src:source+'?voice=heart-character-tnos-01',
    token:state.speechToken,startAtMs:resumeAtMs,
    continueAfterGenerated,
    emit:event=>{
      if(event.type==='SPEECH_ENDED'&&state.nameDecision==='provided'&&
         !store.getState().nameAudioCompleted&&
         store.getState().nameSynthesisStatus!=='failed'){
        // Reaching the end is not an alternative insertion location.
        // The approved 62.352s seam is the only valid place for the name.
        store.dispatch({type:'AUTHORED_TRACK_ENDED',token:state.speechToken,
          evidence:{type:'authored-track-ended-observed'}});
        store.dispatch({type:'SPEECH_FAILED',token:state.speechToken,
          reason:'Approved visitor-name seam was missed before narration ended'});
        return;
      }
      store.dispatch(event);
    },
    onPosition  });
}

function requestNameInsertion(state,resumeAtMs,evidenceType){
  if(!preparedName||state.nameInsertionStatus!=='waiting'||
     state.nameSynthesisStatus!=='ready')return;
  store.dispatch({type:'NAME_INSERTION_REQUESTED',token:state.speechToken,
    evidence:{type:evidenceType}});
  const authorized=store.getState();
  if(authorized.nameInsertionStatus!=='requested')return;
  const generated=preparedName;
  preparedName=null;
  pendingNameBoundary=null;
  const token=authorized.speechToken;
  activeNameAudio={token,generated};
  const session=voice.playGenerated({
    wav:generated.wav,token,insertAfterAuthored:true,
    emit:event=>store.dispatch(event),
    onPosition:observation=>{
      if(observation?.source==='observed-generated-heart-audio'&&
         observation.playing===true)
        store.dispatch({type:'NAME_AUDIO_STARTED',token,
          evidence:{type:'observed-generated-heart-playing'}});
    },
    onEnded:()=>{
      const observed=store.getState();
      if(observed.speechToken!==token)return;
      store.dispatch({type:'NAME_AUDIO_ENDED',token,
        evidence:{type:'observed-generated-heart-ended',assetId:'generated-heart:'+token}});
      activeNameAudio=null;
      if(observed.speechStatus==='speaking'){
        if(resumeAtMs===null)
          store.dispatch({type:'SPEECH_ENDED',token});
        else playApprovedTrack(store.getState(),{
          resumeAtMs,continueAfterGenerated:true});
      }
    }
  });
  if(!session){
    store.dispatch({type:'SPEECH_FAILED',token,reason:'required generated Heart playback unavailable'});
  }
}

async function beginSpeech(state){
  if(localizedPresentation&&state.presentationLocale===localizedPresentation.locale){
    await playLocalizedTrack(state);
    return;
  }
  // The selected recorded Heart narration begins immediately after the
  // name decision. Synthesis is concurrent, not a silent prerequisite.
  preparedName=null;
  pendingNameBoundary=null;
  nameSynthesisError=null;
  playApprovedTrack(state);
  if(state.nameDecision!=='provided')return;
  const token=state.speechToken;
  store.dispatch({type:'NAME_SYNTHESIS_STARTED',token});
  // The iPhone shares GPU memory with the browser's Heart WASM worker.
  const constrained=/iPhone|iPad|iPod/.test(navigator.userAgent)&&/AppleWebKit/.test(navigator.userAgent);
  if(constrained)scene?.setInferenceMode?.(true);
  try{
    const generated=await synthesizeHeartName(state.visitorName);
    const current=store.getState();
    if(current.speechToken!==token||current.nameDecision!=='provided'||
       ['failed','interrupted','completed'].includes(current.speechStatus)||
       document.hidden)return;
    preparedName=generated;
    store.dispatch({type:'NAME_SYNTHESIS_READY',token});
    const ready=store.getState();
    // The approved paragraph seam is held until this synthesis is ready.
    // Only an actually observed track end can authorize the fallback.
    if(pendingNameBoundary!==null&&ready.nameSlotObserved&&
       ready.nameInsertionStatus==='waiting'&&ready.speechStatus==='speaking')
      requestNameInsertion(ready,pendingNameBoundary,
        'authored-paragraph-boundary-observed');
    // Never append the visitor name at the end of the recording.
    // Only the held, timeline-qualified paragraph seam may authorize it.
  }catch(error){
    // The independently observed recorded Heart track must remain audible
    // when the optional on-device pronunciation model cannot initialize.
    // Report the failure; never claim the visitor's name was spoken.
    const current=store.getState();
    if(current.speechToken!==token||current.nameDecision!=='provided')return;
    nameSynthesisError=String(error?.name||'Error')+': '+String(error?.message||error);
    console.error('Selected Heart name synthesis failed',error);
    store.dispatch({type:'NAME_SYNTHESIS_FAILED',token,reason:nameSynthesisError});
    // A named presentation cannot silently become the unnamed recording.
    // Preserve the visitor's WHO and stop the incomplete named path.
    pendingNameBoundary=null;
    preparedName=null;
    store.dispatch({type:'SPEECH_FAILED',token,
      reason:'Named Heart narration unavailable: '+nameSynthesisError});
    voice.cancel('name-synthesis-failed');
  }finally{
    if(constrained)scene?.setInferenceMode?.(false);
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
  // Kokoro supplies real PCM but no aligned phoneme labels. Drive the
  // established A2 mouth from observed audio energy instead of inventing
  // viseme timestamps or holding the mouth closed for the entire name.
  let pose=sampled?.pose??null;
  // Read the actual synthesized PCM at the observed playback position.
  // This is the same audio data driving Heart, not an invented animation.
  const generated=activeNameAudio.generated;
  const start=Math.min(generated.pcm.length-1,
    Math.floor(observation.elapsedMs*generated.sampleRate/1000));
  const end=Math.min(generated.pcm.length,start+Math.max(1,Math.floor(generated.sampleRate*.02)));
  let energy=0;
  for(let i=start;i<end;i++)energy+=generated.pcm[i]*generated.pcm[i];
  const level=Math.min(255,Math.round(Math.sqrt(energy/(end-start))*255));
  if(!pose)pose=level<3?'viseme-closed':level<22?'viseme-open':'viseme-wide';
  if(pose===state.observedSpeechPose&&level===state.observedAudioLevel)return;
  store.dispatch({type:'GENERATED_VISEME_OBSERVED',token:state.speechToken,
    evidence:{type:'generated-viseme-audio-observed',
      source:observation.source,voiceId:generated.voiceId,
      assetId:observation.assetId,playing:true,elapsedMs:observation.elapsedMs,
      pose,level}});
}
function observeApprovedSpeechFrame(){
  const state=store.getState();
  if(observeAuthoredPosition&&voice.activeSource()==='authored'&&
     state.nameDecision==='provided'&&state.nameInsertionStatus==='waiting'){
    const observedClock=voice.sampleAuthoredClock(state.speechToken);
    if(observedClock)observeAuthoredPosition(observedClock);
  }
  if(!envelope||state.speechStatus!=='speaking'||
    voice.activeSource()!=='authored')return;
  const observation=voice.sampleAuthoredClock(state.speechToken);
  if(!observation)return;
  const source=state.phase==='asking-name'?'asking-name':'after-name';
  const sampled=sampleMeasuredHeartEnvelope(envelope,source,observation);
  if(!sampled)return;
  // Acoustic energy changes within the same viseme. Suppressing those
  // observations disconnected the existing four-point motion rig from
  // continuous Heart narration.
  if(state.observedSpeechPose===sampled.pose&&
     state.observedAudioLevel===sampled.level)return;
  store.dispatch({
    type:'AUTHORED_ENVELOPE_OBSERVED',
    token:state.speechToken,
    evidence:sampled
  });
}
function observeSpeechFrame(){
  if(localizedFrameObserver&&voice.activeSource()==='generated'){
    const observation=voice.sampleGeneratedClock(store.getState().speechToken);
    if(observation)localizedFrameObserver(observation);
  }
  observeGeneratedSpeechFrame();
  observeApprovedSpeechFrame();
}
function render(state,previous,event){
  scene?.update(state);
  // Autonomous ribbon-flow frames only propagate the established geometry
  // field. Rewriting captions, forms and accessibility DOM thirty times a
  // second would compete with Safari's WebGL and audio work.
  if(event?.type==='IDLE_FRAME_OBSERVED')return;
  stage.dataset.phase=state.phase;
  stage.dataset.cueIndex=String(state.cueIndex);
  stage.dataset.speechStatus=state.speechStatus;
  stage.dataset.speechPose=state.observedSpeechPose||'';
  stage.dataset.nameAudioCompleted=String(state.nameAudioCompleted);
  stage.dataset.nameSynthesisStatus=state.nameSynthesisStatus;
  stage.dataset.nameInsertionStatus=state.nameInsertionStatus;
  stage.dataset.nameSlotObserved=String(state.nameSlotObserved);
  stage.dataset.nameSeamHeld=String(state.nameSeamHeld);
  stage.dataset.renderStatus=state.renderStatus;
  const recoverable=['failed','unavailable','interrupted'].includes(state.speechStatus);
  activate.disabled=state.renderStatus!=='observed'||state.voiceSupported!==true||
    state.languageStatus!=='qualified';
  activate.hidden=state.phase!=='dormant'&&!recoverable;
  activate.setAttribute('aria-label',recoverable
    ?'Replay Violet’s approved narration':'Activate Violet');
  failure.hidden=state.renderStatus!=='failed';
  if(state.renderStatus==='failed')
    failure.textContent='Violet could not be rendered on this device. '+state.renderFailure;
  const speechFailed=['failed','unavailable','interrupted'].includes(state.speechStatus);
  const englishNarration=state.browserLocale?.split('-')[0]==='en';
  audioFailure.hidden=!(englishNarration&&narrationLoadFailure)&&
    !speechFailed&&!nameSynthesisError&&
    !(localizedFailure&&state.presentationLocale!=='en-US')&&
    state.languageStatus!=='unavailable';
  if(!audioFailure.hidden)
    audioFailure.textContent=state.languageStatus==='unavailable'
      ?'Violet is preparing on-device narration for '+state.browserLocale+'. '+(localizedFailure||'The language model is still loading.')
      :localizedFailure?'Localized narration unavailable. '+localizedFailure
      :englishNarration&&narrationLoadFailure
      ?'Heart narration is unavailable. '+narrationLoadFailure
      :speechFailed?'Heart narration '+(state.speechStatus==='interrupted'
        ?'was interrupted.':'could not be played.')+
        (state.speechFailureReason?' '+state.speechFailureReason:'')
      :nameSynthesisError?'Named Heart narration could not be completed. Your name is retained; use Replay Violet to retry this named path. '+nameSynthesisError
      :'';
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
  if(state.renderStatus!=='observed'||state.voiceSupported!==true||
     state.languageStatus!=='qualified')return;
  if(['failed','unavailable','interrupted'].includes(state.speechStatus))
    store.dispatch({type:'RETRY_SPEECH'});
  else if(state.phase==='dormant')
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
  activeNameAudio=null;preparedName=null;localizedFrameObserver=null;
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
    // The existing approved English recording is playable independently
    // of an optional mobile translation-model download.
    store.dispatch({type:'VOICE_AVAILABLE',value:true});
    if(store.getState().languageStatus==='unavailable')
      store.dispatch({type:'ENGLISH_NARRATION_FALLBACK',
        evidence:{type:'approved-english-audio-qualified'}});
  }catch(error){
    narrationLoadFailure=String(error?.message||error);
    if(store.getState().browserLocale?.split('-')[0]==='en')
      store.dispatch({type:'VOICE_AVAILABLE',value:false});
  }
})();
const localizedReady=(async()=>{
  const locale=store.getState().browserLocale;
  if(!locale||locale.split('-')[0]==='en')return;
  try{
    const translator=await prepareQualifiedTranslator(locale);
    const [presentation,adapter]=await Promise.all([
      localizeApprovedOpening(OPENING_TRACKS,NAME_SLOT,translator),
      createBrowserKokoroAdapter(locale)
    ]);
    localizedPresentation=presentation;
    localizedAdapter=adapter;
    store.dispatch({type:'LOCALIZED_NARRATION_READY',
      locale,tracks:presentation.tracks,nameLine:presentation.nameLine});
    store.dispatch({type:'VOICE_AVAILABLE',value:true});
  }catch(error){
    localizedFailure=String(error?.message||error);
    // Keep the qualified English audio active; translation failure must
    // never disable the only working activation path.
    render(store.getState(),store.getState());
  }
})();
store.dispatch({type:'RENDER_STARTED'});
try{
  const {createVioletEnvironment}=await import('./violet-environment.mjs?v=20261109-authored-mouth-flow-32');
  scene=await createVioletEnvironment(document.getElementById('world'),{
    onObserved:evidence=>store.dispatch({type:'RENDER_OBSERVED',evidence}),
    onFailure:error=>store.dispatch({type:'RENDER_FAILED',reason:error.message||String(error)}),
    onAudioFrame:observeSpeechFrame,
    onAnimationFrame:evidence=>store.dispatch({type:'IDLE_FRAME_OBSERVED',evidence})
  });
  scene.update(store.getState());
}catch(error){
  store.dispatch({type:'RENDER_FAILED',reason:error?.message||String(error)});
}
await narrationReady;
// Language models continue loading independently; activation is gated by
// observed qualified speech capability, not by an assumed model download.
void localizedReady;
render(store.getState(),store.getState());
