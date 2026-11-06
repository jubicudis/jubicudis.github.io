// The approved Heart voice identity and existing opening-state audio assets.
// Pure state-to-asset resolution only: no timers, autoplay, state mutation,
// browser-voice substitution or claims of observed playback.
import {openingMessage} from './opening-state.mjs';

export const VIOLET_SELECTED_VOICE=Object.freeze({
  engine:'Kokoro-82M v1.0',
  voiceId:'af_heart',
  name:'Heart',
  locale:'en-US',
  playback:'authored-same-origin'
});
export const VIOLET_HEART_CLIPS=Object.freeze({
  'asking-name':'/site/audio/violet-heart-asking-name.m4a',
  'welcome':'/site/audio/violet-heart-welcome.m4a'
});

// A visitor's chosen name remains present in the rendered caption. A fixed
// Heart recording cannot pronounce arbitrary names, so the actual voiced
// welcome uses the established no-name script. Do not report an unspoken
// name as spoken and do not switch to an inconsistent synthetic voice.
export function resolveVioletOpeningAudio(state){
  if(!state||!Object.prototype.hasOwnProperty.call(VIOLET_HEART_CLIPS,state.phase))
    return null;
  const phase=state.phase;
  const speakingState=phase==='welcome'
    ?{...state,nameDecision:'skipped',visitorName:null}
    :state;
  const spokenText=openingMessage(speakingState);
  if(!spokenText)return null;
  return Object.freeze({
    phase,
    voiceId:VIOLET_SELECTED_VOICE.voiceId,
    src:VIOLET_HEART_CLIPS[phase],
    spokenText,
    visibleText:openingMessage(state),
    visitorNameSpoken:false
  });
}
