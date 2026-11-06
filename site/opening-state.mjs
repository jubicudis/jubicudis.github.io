// Public website presentation state (not native TNOS/TranquilSpeak execution).
// Approved Revision 2 is the only authority for text and sequential subjects.
// The rendered scene and audio are qualified independently; no narration timer
// can advance the presentation without a real audio playback observation.
import {OPENING_TRACKS,openingTrackForPhase,visibleOpeningSegment}
  from './opening-script.mjs';

export const initialState=Object.freeze({
  phase:'dormant',track:null,cueIndex:0,visitorName:null,nameDecision:null,
  renderStatus:'uninitialized',renderEvidence:null,renderFailure:null,
  speaking:false,speechToken:0,voiceSupported:null,speechStatus:'not-requested',
  playbackPositionMs:null,generatedPositionMs:null,envelopePositionMs:null,
  observedSpeechPose:null,nameAudioCompleted:false,nameAudioPlaying:false,enteredAt:0,
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
    return state.visitorName+", let's continue.";
  return visibleOpeningSegment(track,state.cueIndex,null);
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
      if(state.phase==='dormant'&&state.renderStatus==='observed'&&state.voiceSupported===true)
        patch={phase:'asking-name',track:'asking-name',cueIndex:0,enteredAt:when,
          speaking:false,speechStatus:'pending',speechToken:state.speechToken+1,
          playbackPositionMs:null,generatedPositionMs:null,envelopePositionMs:null,
          observedSpeechPose:null,nameAudioCompleted:false,nameAudioPlaying:false};
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
          observedSpeechPose:null,nameAudioCompleted:false};
      }
      break;
    case 'SKIP_NAME':
      if(nameChoiceReady(state))
        patch={phase:'welcome',track:'after-name',cueIndex:0,
          visitorName:null,nameDecision:'skipped',enteredAt:when,
          speaking:false,speechStatus:'pending',speechToken:state.speechToken+1,
          playbackPositionMs:null,generatedPositionMs:null,envelopePositionMs:null,
          observedSpeechPose:null,nameAudioCompleted:false};
      break;
    case 'SPEECH_STARTED':
      if(event.token===state.speechToken&&state.phase!=='dormant'&&
          state.speechStatus==='pending')
        patch={speaking:true,speechStatus:'speaking'};
      break;
    case 'GENERATED_VISEME_OBSERVED':
      {
        const proof=event.evidence;
        if(state.nameDecision!=='provided'||state.phase!=='welcome'||
          state.speechStatus!=='speaking'||event.token!==state.speechToken||
          proof?.type!=='generated-viseme-audio-observed'||
          proof.source!=='observed-generated-heart-audio'||
          proof.voiceId!=='af_heart'||proof.playing!==true||
          proof.assetId!=='generated-heart:'+state.speechToken||
          !Number.isFinite(proof.elapsedMs)||proof.elapsedMs<0||
          (state.generatedPositionMs!==null&&proof.elapsedMs<state.generatedPositionMs)||
          !['viseme-closed','viseme-open','viseme-wide','viseme-round'].includes(proof.pose))
          break;
        patch={observedSpeechPose:proof.pose,generatedPositionMs:proof.elapsedMs};
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
        patch={observedSpeechPose:proof.pose,envelopePositionMs:proof.elapsedMs};
      }
      break;
    case 'NAME_AUDIO_STARTED':
      if(state.nameDecision==='provided'&&state.speechStatus==='speaking'&&
         event.token===state.speechToken&&event.evidence?.type==='observed-generated-heart-playing')
        patch={nameAudioPlaying:true};
      break;
    case 'NAME_AUDIO_ENDED':
      if(state.nameDecision==='provided'&&
        state.speechStatus==='speaking'&&!state.nameAudioCompleted&&
        event.token===state.speechToken&&
        event.evidence?.type==='observed-generated-heart-ended'&&
        event.evidence.assetId==='generated-heart:'+state.speechToken)
        patch={nameAudioCompleted:true,nameAudioPlaying:false,observedSpeechPose:null};
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
