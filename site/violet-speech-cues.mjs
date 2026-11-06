// Speech/face alignment capability. An external, qualified audio timeline
// supplies the cues. Neither elapsed time nor phonemes are invented here.
export const AUTHORABLE_MOUTH_POSES=Object.freeze([
  'viseme-closed','viseme-open','viseme-wide','viseme-round'
]);
export function compileSpeechCueTrack({assetId, transcript, durationMs, cues}){
  if(typeof assetId!=='string'||!assetId.trim()||typeof transcript!=='string'||!transcript.trim())
    throw new TypeError('Speech cues require a named, authored audio asset and transcript');
  if(!Number.isFinite(durationMs)||durationMs<=0||!Array.isArray(cues)||!cues.length)
    throw new TypeError('Speech cues require positive measured duration and actual cue entries');
  let previousEnd=0;
  const frames=cues.map((cue,i)=>{
    if(!cue||!Number.isFinite(cue.startMs)||!Number.isFinite(cue.endMs)||
      cue.startMs<previousEnd||cue.endMs<=cue.startMs||cue.endMs>durationMs ||
      !AUTHORABLE_MOUTH_POSES.includes(cue.pose))
      throw new RangeError('Invalid or overlapping authored speech cue '+i);
    previousEnd=cue.endMs;
    return Object.freeze({startMs:cue.startMs,endMs:cue.endMs,pose:cue.pose});
  });
  return Object.freeze({assetId,transcript,durationMs,cues:Object.freeze(frames)});
}
export function sampleSpeechCue(track,{source,token,elapsedMs,playing,assetId}={}){
  if(!track||!Array.isArray(track.cues)||source!=='observed-authored-audio'||
    assetId!==track.assetId||!Number.isSafeInteger(token)||
    playing!==true||!Number.isFinite(elapsedMs)||elapsedMs<0||
    elapsedMs>track.durationMs)return null;
  const cue=track.cues.find(x=>elapsedMs>=x.startMs && elapsedMs<x.endMs);
  if(!cue)return null;
  return Object.freeze({
    type:'audio-cue-observed',source,token,assetId,elapsedMs,
    pose:cue.pose,startMs:cue.startMs,endMs:cue.endMs
  });
}
