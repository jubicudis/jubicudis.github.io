// Public website presentation state (not native TNOS/TranquilSpeak execution).
// Approved Revision 2 is the only authority for text and sequential subjects.
// The rendered scene and audio are qualified independently; no narration timer
// can advance the presentation without a real audio playback observation.
import {OPENING_TRACKS,VISITOR_NAME_SLOT,openingTrackForPhase,visibleOpeningSegment}
  from './opening-script.mjs';

// Four physical A2 structural influences are derived from actual observed
// Heart sound energy, not an independent animation timer or page phase guess.
const STILL_BLOOM=Object.freeze(Array.from({length:4},()=>Object.freeze({x:0,y:0})));
function bloomFromObservedAudio(state){
  if(!state.speaking||!state.observedSpeechPose)return STILL_BLOOM;
  const pose=state.observedSpeechPose;
  const level=state.observedAudioLevel;
  if(!Number.isFinite(level)||level<=0)return STILL_BLOOM;
  const strength=Math.min(.20,level/255*.20);
  const open=pose==='viseme-open'||pose==='viseme-wide'||pose==='viseme-round';
  const factor=open?1:.55;
  return Object.freeze([
    Object.freeze({x:-strength*factor,y:strength*.50}),
    Object.freeze({x:strength*factor,y:strength*.48}),
    Object.freeze({x:strength*.60,y:-strength*.65}),
    Object.freeze({x:-strength*.60,y:-strength*.62})
  ]);
}
export const initialState=Object.freeze({
  phase:'dormant',track:null,cueIndex:0,visitorName:null,nameDecision:null,
  browserLocale:null,presentationLocale:null,languageStatus:'unobserved',
  localizedTracks:null,localizedNameLine:null,localizedAudioPositionMs:null,
  renderStatus:'uninitialized',renderEvidence:null,renderFailure:null,
  speaking:false,speechToken:0,voiceSupported:null,speechStatus:'not-requested',
  playbackPositionMs:null,generatedPositionMs:null,envelopePositionMs:null,
  observedSpeechPose:null,observedAudioLevel:0,bloomMotion:STILL_BLOOM,bodyMotionMode:'idle',visualExpression:'rest',nameAudioCompleted:false,nameAudioPlaying:false,nameSynthesisStatus:'not-requested',
  nameInsertionStatus:'not-requested',nameSlotObserved:false,authoredAudioEnded:false,enteredAt:0,
  context:Object.freeze({
    who:'unidentified visitor',what:'Violet',when:'unstarted',
    where:'TNOS public introduction',why:'arrival',how:'await activation',
    extent:'not started'
  })
});
const phases=new Set(['dormant','asking-name','welcome','orientation','presentation']);
const finalSpeechStatuses=new Set(['completed','unavailable','failed','interrupted']);

export function openingMessage(state){
  if(state.phase==='dormant')return '';
  const track=state.track||openingTrackForPhase(state.phase);
  if(state.nameAudioPlaying&&state.nameDecision==='provided')
    return state.localizedNameLine||VISITOR_NAME_SLOT.text(state.visitorName);
  return state.localizedTracks?.[track]?.[state.cueIndex]?.text||
    visibleOpeningSegment(track,state.cueIndex,null);
}
export function nameChoiceReady(state){
  return state.phase==='asking-name' && state.speechStatus==='completed'
    && state.cueIndex===OPENING_TRACKS['asking-name'].length-1;
}

export function reduceOpening(state,event){
  if(!event||typeof event.type!=='string')return state;
  const when=Number.isFinite(event.at)?event.at:null;
  let patch=null;
  switch(event.type){
    case 'IDLE_FRAME_OBSERVED':
      if(state.bodyMotionMode==='idle'&&state.renderStatus==='observed'&&
         event.evidence?.type==='observed-animation-frame'&&
         Number.isFinite(event.evidence.elapsedMs)&&event.evidence.elapsedMs>=0){
        const t=event.evidence.elapsedMs/1000;
        const reduced=event.evidence.reducedMotion===true;
        const sway=reduced?0:Math.sin(t*.83)*.10;
        const breath=reduced?0:Math.sin(t*1.07)*.075;
        patch={bloomMotion:Object.freeze([
          Object.freeze({x:-sway,y:breath}),
          Object.freeze({x:sway,y:breath}),
          Object.freeze({x:sway*.65,y:-breath*.85}),
          Object.freeze({x:-sway*.65,y:-breath*.85})
        ])};
      }
      break;
    case 'BROWSER_LANGUAGE_OBSERVED':
      if(state.phase==='dormant'&&state.languageStatus==='unobserved'&&
         event.evidence?.type==='browser-language-observed'&&
         typeof event.evidence.locale==='string'){
        let locale=null;
        try{locale=Intl.getCanonicalLocales(event.evidence.locale)[0];}catch{}
        if(locale){
          const english=locale.split('-')[0].toLowerCase()==='en';
          patch={browserLocale:locale,presentationLocale:english?locale:null,
            languageStatus:english?'qualified':'unavailable'};
        }
      }
      break;
    case 'LOCALIZED_NARRATION_READY':
      if(state.phase==='dormant'&&state.languageStatus==='unavailable'&&
         event.locale===state.browserLocale&&event.tracks&&
         ['asking-name','after-name'].every(track=>
           Array.isArray(event.tracks[track])&&
           event.tracks[track].length===OPENING_TRACKS[track].length&&
           event.tracks[track].every((segment,i)=>
             typeof segment.text==='string'&&segment.text.trim()&&
             segment.phase===OPENING_TRACKS[track][i].phase))&&
         typeof event.nameLine==='function')
        patch={presentationLocale:event.locale,languageStatus:'qualified',
          localizedTracks:event.tracks,localizedNameLine:null};
      break;
    case 'LOCALIZED_NAME_LINE_READY':
      if(state.nameDecision==='provided'&&
         event.token===state.speechToken&&typeof event.text==='string'&&
         event.text.includes(state.visitorName))
        patch={localizedNameLine:event.text};
      break;
    case 'LOCALIZED_AUDIO_FRAME_OBSERVED':
      if(state.localizedTracks&&state.speechStatus==='speaking'&&
         event.token===state.speechToken&&
         event.evidence?.type==='localized-pcm-clock-observed'&&
         event.evidence.playing===true&&
         Number.isFinite(event.evidence.elapsedMs)&&event.evidence.elapsedMs>=0&&
         (state.localizedAudioPositionMs===null||
          event.evidence.elapsedMs>=state.localizedAudioPositionMs)&&
         Number.isInteger(event.evidence.level)&&
         event.evidence.level>=0&&event.evidence.level<=255)
        patch={localizedAudioPositionMs:event.evidence.elapsedMs,
          observedAudioLevel:event.evidence.level,
          observedSpeechPose:event.evidence.level>20?'viseme-open':'viseme-closed'};
      break;
    case 'LOCALIZED_CUE_OBSERVED':
      if(state.localizedTracks&&state.speechStatus==='speaking'&&
         event.token===state.speechToken&&
         event.evidence?.type==='localized-pcm-cue-playing'&&
         Number.isInteger(event.evidence.cueIndex)&&
         event.evidence.cueIndex>=state.cueIndex&&
         event.evidence.cueIndex<OPENING_TRACKS[state.track].length){
        const segment=OPENING_TRACKS[state.track][event.evidence.cueIndex];
        patch={cueIndex:event.evidence.cueIndex,phase:segment.phase,
          localizedAudioPositionMs:null,observedSpeechPose:null,observedAudioLevel:0};
      }
      break;
    case 'RENDER_STARTED':
      if(state.renderStatus==='uninitialized')patch={renderStatus:'initializing'};
      break;
    case 'RENDER_OBSERVED':
      if(state.renderStatus==='initializing'&&
        event.evidence?.type==='webgl-pixel-observed'&&
        event.evidence.nonBackgroundPixel===true&&
        event.evidence.drawCalls>=2)
        patch={renderStatus:'observed',renderEvidence:Object.freeze({
          type:event.evidence.type,drawCalls:event.evidence.drawCalls,
          nonBackgroundPixel:true
        })};
      break;
    case 'RENDER_FAILED':
      if(state.renderStatus!=='failed'&&typeof event.reason==='string')
        patch={renderStatus:'failed',renderEvidence:null,
          renderFailure:event.reason.slice(0,240)};
      break;
    case 'VOICE_AVAILABLE':
      patch={voiceSupported:event.value===true};
      break;
    case 'ACTIVATE':
      if(state.phase==='dormant'&&state.renderStatus==='observed'&&state.voiceSupported===true&&state.languageStatus==='qualified')
        patch={phase:'asking-name',track:'asking-name',cueIndex:0,enteredAt:when,
          speaking:false,speechStatus:'pending',speechToken:state.speechToken+1,
          playbackPositionMs:null,generatedPositionMs:null,envelopePositionMs:null,localizedAudioPositionMs:null,
          observedSpeechPose:null,observedAudioLevel:0,nameAudioCompleted:false,nameAudioPlaying:false,
          nameSynthesisStatus:'not-requested',nameInsertionStatus:'not-requested',nameSlotObserved:false,authoredAudioEnded:false};
      break;
    case 'GIVE_NAME':
      if(!nameChoiceReady(state)||typeof event.name!=='string')break;
      {
        const name=event.name.replace(/[\u0000-\u001F\u007F<>]/g,'')
          .trim().replace(/\s+/g,' ').slice(0,48);
        if(name)patch={phase:'welcome',track:'after-name',cueIndex:0,
          visitorName:name,nameDecision:'provided',enteredAt:when,
          speaking:false,speechStatus:'pending',speechToken:state.speechToken+1,
          playbackPositionMs:null,generatedPositionMs:null,envelopePositionMs:null,
          observedSpeechPose:null,observedAudioLevel:0,nameAudioCompleted:false,nameAudioPlaying:false,
          nameSynthesisStatus:'not-requested',nameInsertionStatus:'not-requested',nameSlotObserved:false,authoredAudioEnded:false};
      }
      break;
    case 'SKIP_NAME':
      if(nameChoiceReady(state))
        patch={phase:'welcome',track:'after-name',cueIndex:0,
          visitorName:null,nameDecision:'skipped',enteredAt:when,
          speaking:false,speechStatus:'pending',speechToken:state.speechToken+1,
          playbackPositionMs:null,generatedPositionMs:null,envelopePositionMs:null,
          observedSpeechPose:null,observedAudioLevel:0,nameAudioCompleted:false,nameAudioPlaying:false,
          nameSynthesisStatus:'not-requested',nameInsertionStatus:'not-requested',nameSlotObserved:false,authoredAudioEnded:false};
      break;
    case 'SPEECH_STARTED':
      if(event.token===state.speechToken&&state.phase!=='dormant'&&
          state.speechStatus==='pending')
        patch={speaking:true,speechStatus:'speaking'};
      break;
    case 'GENERATED_VISEME_OBSERVED':
      {
        const proof=event.evidence;
        if(state.nameDecision!=='provided'||!state.nameAudioPlaying||
          state.speechStatus!=='speaking'||event.token!==state.speechToken||
          proof?.type!=='generated-viseme-audio-observed'||
          proof.source!=='observed-generated-heart-audio'||
          proof.voiceId!=='af_heart'||proof.playing!==true||
          proof.assetId!=='generated-heart:'+state.speechToken||
          !Number.isFinite(proof.elapsedMs)||proof.elapsedMs<0||
          (state.generatedPositionMs!==null&&proof.elapsedMs<state.generatedPositionMs)||
          !['viseme-closed','viseme-open','viseme-wide','viseme-round'].includes(proof.pose)||
          !Number.isInteger(proof.level)||proof.level<0||proof.level>255)
          break;
        patch={observedSpeechPose:proof.pose,observedAudioLevel:proof.level,generatedPositionMs:proof.elapsedMs};
      }
      break;
    case 'AUTHORED_ENVELOPE_OBSERVED':
      {
        const proof=event.evidence;
        const expectedTrack=state.phase==='asking-name'?'asking-name':'after-name';
        const expectedSrc='/site/audio/violet-heart-'+expectedTrack+'.mp3';
        if(event.token!==state.speechToken||state.phase==='dormant'||
          state.speechStatus!=='speaking'||
          proof?.type!=='measured-heart-envelope-observed'||
          proof.kind!=='acoustic-intensity-not-phoneme'||
          proof.source!=='observed-authored-audio'||
          proof.playing!==true||proof.assetId!==expectedSrc||
          proof.trackName!==expectedTrack||proof.token!==state.speechToken||
          !Number.isFinite(proof.elapsedMs)||proof.elapsedMs<0||
          (state.envelopePositionMs!==null&&proof.elapsedMs<state.envelopePositionMs)||
          !Number.isInteger(proof.level)||proof.level<0||proof.level>255||
          !['viseme-closed','viseme-open','viseme-wide'].includes(proof.pose))
          break;
        patch={observedSpeechPose:proof.pose,observedAudioLevel:proof.level,envelopePositionMs:proof.elapsedMs};
      }
      break;
    case 'NAME_SYNTHESIS_STARTED':
      if(event.token===state.speechToken&&state.nameDecision==='provided'&&
         state.nameSynthesisStatus==='not-requested')
        patch={nameSynthesisStatus:'generating',nameInsertionStatus:'waiting'};
      break;
    case 'NAME_SYNTHESIS_READY':
      if(event.token===state.speechToken&&state.nameDecision==='provided'&&
         state.nameSynthesisStatus==='generating'&&
         ['pending','speaking'].includes(state.speechStatus))
        patch={nameSynthesisStatus:'ready'};
      break;
    case 'NAME_SLOT_OBSERVED':
      if(event.token===state.speechToken&&state.nameDecision==='provided'&&
         state.track===VISITOR_NAME_SLOT.track&&state.speechStatus==='speaking'&&
         state.cueIndex>=VISITOR_NAME_SLOT.beforeCueIndex&&
         event.evidence?.type==='authored-name-slot-boundary-observed'&&
         event.evidence.cueIndex===VISITOR_NAME_SLOT.beforeCueIndex&&
         state.nameInsertionStatus==='waiting')
        patch={nameSlotObserved:true};
      break;
    case 'NAME_INSERTION_REQUESTED':
      if(event.token===state.speechToken&&state.nameDecision==='provided'&&
         state.speechStatus==='speaking'&&state.nameSynthesisStatus==='ready'&&
         state.nameInsertionStatus==='waiting'&&
         ((state.nameSlotObserved&&event.evidence?.type==='authored-paragraph-boundary-observed')||
          (state.authoredAudioEnded&&event.evidence?.type==='authored-track-ended-observed')))
        patch={nameInsertionStatus:'requested'};
      break;
    case 'AUTHORED_TRACK_ENDED':
      if(event.token===state.speechToken&&state.nameDecision==='provided'&&
         state.speechStatus==='speaking'&&!state.authoredAudioEnded&&
         event.evidence?.type==='authored-track-ended-observed')
        patch={authoredAudioEnded:true};
      break;
    case 'NAME_AUDIO_STARTED':
      if(state.nameDecision==='provided'&&state.speechStatus==='speaking'&&
         state.nameInsertionStatus==='requested'&&event.token===state.speechToken&&
         event.evidence?.type==='observed-generated-heart-playing')
        patch={nameAudioPlaying:true,nameInsertionStatus:'playing'};
      break;
    case 'NAME_AUDIO_ENDED':
      if(state.nameDecision==='provided'&&
        state.speechStatus==='speaking'&&state.nameInsertionStatus==='playing'&&
        !state.nameAudioCompleted&&
        event.token===state.speechToken&&
        event.evidence?.type==='observed-generated-heart-ended'&&
        event.evidence.assetId==='generated-heart:'+state.speechToken)
        patch={nameAudioCompleted:true,nameAudioPlaying:false,observedSpeechPose:null,
          nameInsertionStatus:'completed'};
      break;
    case 'SPEECH_CUE_OBSERVED':
      {
        const proof=event.evidence;
        if(event.token!==state.speechToken||state.speechStatus!=='speaking'||
          proof?.type!=='authored-playback-position-observed'||
          proof.source!=='observed-authored-audio'||proof.playing!==true||
          proof.track!==state.track||proof.token!==state.speechToken||
          !Number.isFinite(proof.elapsedMs)||proof.elapsedMs<0||
          (state.playbackPositionMs!==null&&proof.elapsedMs<state.playbackPositionMs)||
          !Number.isSafeInteger(proof.cueIndex)||
          proof.cueIndex<state.cueIndex||
          proof.cueIndex>=OPENING_TRACKS[state.track].length)
          break;
        const segment=OPENING_TRACKS[state.track][proof.cueIndex];
        patch={cueIndex:proof.cueIndex,phase:segment.phase,
          playbackPositionMs:proof.elapsedMs};
      }
      break;
    case 'SPEECH_ENDED':
      if(event.token===state.speechToken&&state.speaking&&
          state.speechStatus==='speaking'){
        const segments=OPENING_TRACKS[state.track];
        const last=segments.length-1;
        patch={speaking:false,speechStatus:'completed',
          observedSpeechPose:null,cueIndex:last,
          phase:segments[last].phase};
      }
      break;
    case 'SPEECH_FAILED':
      if(event.token===state.speechToken&&state.phase!=='dormant'&&
          !finalSpeechStatuses.has(state.speechStatus))
        patch={speaking:false,speechStatus:'failed',observedSpeechPose:null};
      break;
    case 'SPEECH_UNAVAILABLE':
      if(event.token===state.speechToken&&state.phase!=='dormant'&&
          state.speechStatus==='pending')
        patch={speaking:false,speechStatus:'unavailable',observedSpeechPose:null};
      break;
    case 'SPEECH_INTERRUPTED':
      if(event.token===state.speechToken&&state.phase!=='dormant'&&
          ['speaking','pending'].includes(state.speechStatus))
        patch={speaking:false,speechStatus:'interrupted',observedSpeechPose:null};
      break;
  }
  if(!patch)return state;
  const next={...state,...patch};
  // The reducer alone authorizes the facial expression. The WebGL renderer
  // consumes this state; it does not choose an expression from its own clock.
  next.bodyMotionMode=next.speaking?'observed-heart':'idle';
  // Speech articulation belongs to the face; a separate body pulse made the
  // A2 ribbons appear detached from the curved faceplate. Keep the whole
  // sculptural assembly coherent while observed visemes animate normally.
  next.bloomMotion=STILL_BLOOM;
  next.visualExpression=next.speaking
    ?(next.observedSpeechPose||'talk')
    :next.phase==='asking-name'?'ask':'rest';
  if(!phases.has(next.phase))throw new Error('Illegal opening phase');
  const what={
    dormant:'Violet', 'asking-name':'Violet and the optional visitor name',
    welcome:'visitor acknowledgment',orientation:'TNOS and its related engineering',
    presentation:'intended interface leading to the operating system'
  };
  next.context=Object.freeze({
    who:next.nameDecision==='provided'?next.visitorName:'unidentified visitor',
    what:what[next.phase],when,
    where:'TNOS public presentation',
    why:'understand TNOS, Workbench and separate MCP server',
    how:event.type,extent:next.phase+' / cue '+next.cueIndex
  });
  return Object.freeze(next);
}
export function createOpeningStore(listener){
  let state=initialState;
  return Object.freeze({
    getState:()=>state,
    dispatch(event){
      const next=reduceOpening(state,{...event,at:event.at??performance.now()});
      if(next!==state){
        const previous=state;state=next;listener?.(next,previous,event);
      }
      return state;
    }
  });
}
