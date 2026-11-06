// Real acoustic intensity measured from the actual approved Heart MP3s.
// These frames drive speech-reactive opening, NEVER claimed as phoneme timings.
// All samples require the observed playback clock and exact source identity.
export const HEART_ENVELOPE_URL='/site/audio/heart-envelope.json';
const sources=Object.freeze({
  'asking-name':'/site/audio/violet-heart-asking-name.mp3',
  'after-name':'/site/audio/violet-heart-after-name.mp3',
  'post-welcome':'/site/audio/violet-heart-post-welcome.mp3'
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function validateHeartEnvelope(raw){
  if(raw?.version!==1||raw.source!=='measured-decoded-approved-heart-audio'||
     raw.voiceId!=='af_heart'||!raw.tracks||
     Object.keys(raw.tracks).sort().join(',')!=='after-name,asking-name,post-welcome')
    throw new Error('Unqualified measured Heart envelope');
  const tracks={};
  for(const [key,src] of Object.entries(sources)){
    const track=raw.tracks[key];
    if(track?.src!==src||track.windowMs!==40||
       !finite(track.durationMs)||track.durationMs<1000||
       !finite(track.maximumRms)||track.maximumRms<=0||
       !/^[0-9a-f]{64}$/i.test(track.sha256||'')||
       !Array.isArray(track.levels)||track.levels.length<15||
       Math.abs(track.levels.length*40-track.durationMs)>45||
       track.levels.some(v=>!Number.isInteger(v)||v<0||v>255)||
       Math.max(...track.levels)!==255)
      throw new Error('Unqualified Heart audio measurement: '+key);
    tracks[key]=Object.freeze({
      src,durationMs:track.durationMs,sha256:track.sha256,
      windowMs:track.windowMs,
      levels:Object.freeze([...track.levels])
    });
  }
  return Object.freeze({
    source:raw.source,voiceId:raw.voiceId,
    tracks:Object.freeze(tracks)
  });
}

export function sampleMeasuredHeartEnvelope(manifest,trackName,observation){
  const track=manifest?.tracks?.[trackName];
  if(!track||observation?.type!=='authored-playback-position-observed'||
     observation.source!=='observed-authored-audio'||
     observation.assetId!==track.src||
     observation.playing!==true||!Number.isSafeInteger(observation.token)||
     !finite(observation.elapsedMs)||observation.elapsedMs<0||
     observation.elapsedMs>track.durationMs)return null;
  const i=Math.min(track.levels.length-1,Math.floor(observation.elapsedMs/track.windowMs));
  // Three-tap smoothing rejects single-sample flicker. This is derived only
  // from actual acoustic measurements, not guessed letters or syllables.
  const a=track.levels[Math.max(0,i-1)],b=track.levels[i],
    c=track.levels[Math.min(track.levels.length-1,i+1)];
  const level=Math.round((a+b+c)/3);
  // Mouth opening magnitude is a rendering interpretation of energy.
  // "Wide" here denotes an opening size, NOT an "ee" phoneme assertion.
  const pose=level<14?'viseme-closed':
    level<110?'viseme-open':'viseme-wide';
  return Object.freeze({
    type:'measured-heart-envelope-observed',
    source:observation.source,
    assetId:observation.assetId,
    token:observation.token,playing:true,elapsedMs:observation.elapsedMs,
    level,pose,trackName,kind:'acoustic-intensity-not-phoneme'
  });
}
