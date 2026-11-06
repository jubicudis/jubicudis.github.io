// State-to-asset selection only; not an animation or sequencing engine.
// Heart is the inventor-approved free voice. One uninterrupted recording per
// visitor-initiated step; the approved speech and cue text have a single owner.
import {OPENING_TRACKS,openingTrackForPhase,visibleOpeningSegment}
  from './opening-script.mjs';

export const VIOLET_SELECTED_VOICE=Object.freeze({
  engine:'Kokoro-82M v1.0',voiceId:'af_heart',name:'Heart',
  locale:'en-US',playback:'authored-same-origin'
});
export const VIOLET_HEART_CLIPS=Object.freeze({
  'asking-name':'/site/audio/violet-heart-asking-name.m4a',
  'after-name':'/site/audio/violet-heart-after-name.m4a'
});
export const VIOLET_TIMELINE_URL='/site/audio/heart-timeline.json';

export function resolveVioletOpeningAudio(state){
  const track=openingTrackForPhase(state?.phase);
  if(!track)return null;
  return Object.freeze({
    track,phase:state.phase,voiceId:VIOLET_SELECTED_VOICE.voiceId,
    src:VIOLET_HEART_CLIPS[track],
    spokenText:OPENING_TRACKS[track].map(x=>x.text).join(' '),
    visibleText:visibleOpeningSegment(track,state.cueIndex||0,
      state.nameDecision==='provided'?state.visitorName:null),
    visitorNameSpoken:false
  });
}

export function validateHeartTimeline(data){
  if(data?.version!==2||data.voiceId!==VIOLET_SELECTED_VOICE.voiceId||
      data.source!=='approved-revision-2'||!data.tracks||
      Object.keys(data.tracks).sort().join(',')!=='after-name,asking-name')
    throw new Error('Heart timeline does not match approved Revision 2');
  const tracks={};
  for(const [name,approved] of Object.entries(OPENING_TRACKS)){
    const track=data.tracks[name];
    if(track?.file!==VIOLET_HEART_CLIPS[name]||
      !Number.isFinite(track.durationMs)||track.durationMs<=0||
      !Array.isArray(track.cues)||track.cues.length!==approved.length)
      throw new Error('Heart track is incomplete: '+name);
    let lastEnd=0;
    const cues=track.cues.map((cue,i)=>{
      if(cue?.index!==i||cue.phase!==approved[i].phase||
        cue.text!==approved[i].text||
        !Number.isFinite(cue.startMs)||!Number.isFinite(cue.endMs)||
        cue.startMs<lastEnd||cue.endMs<=cue.startMs||
        cue.endMs>track.durationMs||(i===0&&cue.startMs!==0))
        throw new Error('Unqualified Heart cue '+name+' '+i);
      lastEnd=cue.endMs;
      return Object.freeze({index:i,phase:cue.phase,text:cue.text,
        startMs:cue.startMs,endMs:cue.endMs});
    });
    tracks[name]=Object.freeze({
      file:track.file,durationMs:track.durationMs,cues:Object.freeze(cues)
    });
  }
  return Object.freeze({version:2,voiceId:data.voiceId,
    source:data.source,tracks:Object.freeze(tracks)});
}
export function cueAtObservedPosition(timeline,track,elapsedMs){
  const data=timeline?.tracks?.[track];
  if(!data||!Number.isFinite(elapsedMs)||elapsedMs<0||
      elapsedMs>data.durationMs+1500)
    return null;
  let index=0;
  for(let i=1;i<data.cues.length;i++){
    if(elapsedMs>=data.cues[i].startMs)index=i;
    else break;
  }
  return data.cues[index];
}
