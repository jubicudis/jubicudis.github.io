// Explicit, on-device Heart synthesis capability for a visitor-chosen name.
// Only invoked by the actual GIVE_NAME decision; never loaded for skip/initial.
// The returned audio and timed visemes originate from the SAME synthesis.
// No alternate speaker, inferred speech completion, or presentation state.
import {VIOLET_SELECTED_VOICE} from './violet-selected-voice.mjs';
import {VISITOR_NAME_SLOT} from './opening-script.mjs';

export const HEADTTS_MODULE='https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm';
export const HEADTTS_WORKER='https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/modules/worker-tts.mjs';
export const HEADTTS_DICTIONARY='https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/dictionaries/';

// This mapping is an authored rendering of actual Oculus viseme IDs, not
// a claim that the four A2 mouth textures cover every distinct phoneme.
const VISEME_POSE=Object.freeze({
  sil:'viseme-closed',PP:'viseme-closed',FF:'viseme-closed',
  TH:'viseme-wide',DD:'viseme-closed',kk:'viseme-open',
  nn:'viseme-closed',RR:'viseme-open',SS:'viseme-wide',
  CH:'viseme-wide',aa:'viseme-open',E:'viseme-wide',
  I:'viseme-wide',O:'viseme-round',U:'viseme-round'
});
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function pronunciationText(visitorName){
  if(typeof visitorName!=='string'||!visitorName||
    visitorName.length>48||/[\u0000-\u001f\u007f<>]/.test(visitorName)||
    visitorName!==visitorName.trim())
    throw new TypeError('Name must be the authorized, normalized visitor input');
  return VISITOR_NAME_SLOT.text(visitorName);
}

export async function observedInferenceBackend(browser=typeof navigator==='undefined'?null:navigator){
  // Choose ONE backend from actual browser capability; no retry chain and
  // no change to the presentation if a runtime operation fails.
  // iOS WebKit shares GPU resources with Violet's active WebGL scene.
  // Keep the single approved Heart voice, but run its model on CPU/WASM
  // rather than competing for the same GPU and losing Violet's context.
  const agent=String(browser?.userAgent||'');
  const iosWebKit=/iPhone|iPad|iPod/.test(agent)&&/AppleWebKit/.test(agent);
  if(iosWebKit)return 'wasm';
  if(typeof browser?.gpu?.requestAdapter==='function'){
    const adapter=await browser.gpu.requestAdapter();
    if(adapter)return 'webgpu';
  }
  return 'wasm';
}

export function validateHeartAudioResult(messages,spokenText){
  if(!Array.isArray(messages)||!messages.length||
     typeof spokenText!=='string'||!spokenText)
    throw new TypeError('Observed synthesized audio and exact transcript required');
  const chunks=messages.map((message,index)=>{
    if(message?.type!=='audio'||!message.data)
      throw new Error('HeadTTS did not return qualified speech audio');
    const data=message.data,audio=data.audio;
    if(!audio||!finite(audio.sampleRate)||audio.sampleRate<8000||
       !Number.isSafeInteger(audio.length)||audio.length<100||
       !Number.isSafeInteger(audio.numberOfChannels)||audio.numberOfChannels<1||
       typeof audio.getChannelData!=='function'||
       !Array.isArray(data.visemes)||!Array.isArray(data.vtimes)||
       !Array.isArray(data.vdurations)||
       data.visemes.length!==data.vtimes.length||
       data.vtimes.length!==data.vdurations.length)
      throw new Error('Incomplete speech audio or viseme provenance at '+index);
    const channel=audio.getChannelData(0);
    if(channel.length!==audio.length)throw new Error('Generated PCM length mismatch');
    let peak=0;
    for(const sample of channel){
      if(!finite(sample))throw new Error('Non-finite generated audio');
      peak=Math.max(peak,Math.abs(sample));
    }
    if(peak<.005||peak>1.1)throw new Error('Generated audio is silent or clipped');
    const durationMs=audio.length*1000/audio.sampleRate;
    let prev=0;
    const visemes=data.visemes.map((label,i)=>{
      const start=data.vtimes[i],length=data.vdurations[i];
      if(!Object.prototype.hasOwnProperty.call(VISEME_POSE,label)||
        !finite(start)||!finite(length)||start<prev-1||length<0||
        start+length>durationMs+250)
        throw new Error('Unqualified generated viseme at '+i);
      prev=start;
      return Object.freeze({startMs:start,endMs:start+length,
        kind:label,pose:VISEME_POSE[label]});
    });
    return Object.freeze({audio,durationMs,visemes});
  });
  const sampleRate=chunks[0].audio.sampleRate;
  if(chunks.some(chunk=>chunk.audio.sampleRate!==sampleRate))
    throw new Error('Inconsistent generated PCM sample rates');
  const samples=chunks.reduce((sum,chunk)=>sum+chunk.audio.length,0);
  const pcm=new Float32Array(samples);
  const cues=[];
  let cursor=0;
  for(const chunk of chunks){
    pcm.set(chunk.audio.getChannelData(0),cursor);
    const offset=cursor*1000/sampleRate;
    for(const cue of chunk.visemes)
      cues.push(Object.freeze({...cue,startMs:cue.startMs+offset,
        endMs:cue.endMs+offset}));
    cursor+=chunk.audio.length;
  }
  return Object.freeze({
    voiceId:VIOLET_SELECTED_VOICE.voiceId,spokenText,
    sampleRate,pcm,durationMs:samples*1000/sampleRate,
    visemes:Object.freeze(cues)
  });
}

export function encodeSpeechWav({sampleRate,pcm}){
  if(!finite(sampleRate)||sampleRate<8000||
    !(pcm instanceof Float32Array)||!pcm.length)
    throw new TypeError('Qualified generated PCM required for WAV transport');
  const bytes=new ArrayBuffer(44+2*pcm.length),view=new DataView(bytes);
  const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+2*pcm.length,true);
  write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  write(36,'data');view.setUint32(40,2*pcm.length,true);
  for(let i=0;i<pcm.length;i++){
    const v=Math.max(-1,Math.min(1,pcm[i]));
    view.setInt16(44+2*i,Math.round(v<0?v*32768:v*32767),true);
  }
  return bytes;
}

export function sampleGeneratedViseme(result,observation){
  if(!result||observation?.source!=='observed-generated-heart-audio'||
    observation.playing!==true||!finite(observation.elapsedMs)||
    observation.elapsedMs<0||observation.elapsedMs>result.durationMs)
    return null;
  const cue=result.visemes.find(c=>observation.elapsedMs>=c.startMs&&
    observation.elapsedMs<c.endMs);
  return cue?Object.freeze({pose:cue.pose,kind:cue.kind,
    elapsedMs:observation.elapsedMs,source:observation.source}):null;
}

export async function synthesizeHeartName(visitorName,{
  loadModule=()=>import(HEADTTS_MODULE),
  browser=typeof navigator==='undefined'?null:navigator
}={}){
  const text=pronunciationText(visitorName);
  const backend=await observedInferenceBackend(browser);
  const {HeadTTS}=await loadModule();
  if(typeof HeadTTS!=='function')throw new Error('HeadTTS module unavailable');
  const instance=new HeadTTS({
    endpoints:[backend],
    workerModule:HEADTTS_WORKER,
    dictionaryURL:HEADTTS_DICTIONARY,
    languages:['en-us'],voices:[VIOLET_SELECTED_VOICE.voiceId],
    defaultVoice:VIOLET_SELECTED_VOICE.voiceId,
    defaultLanguage:'en-us',defaultSpeed:1,
    defaultAudioEncoding:'wav',
    splitSentences:false,
    dtypeWebgpu:'fp16',dtypeWasm:'q4'
  });
  await instance.connect();
  await instance.setup({voice:VIOLET_SELECTED_VOICE.voiceId,
    language:'en-us',speed:1,audioEncoding:'wav'});
  const messages=await instance.synthesize({input:text});
  const qualified=validateHeartAudioResult(messages,text);
  return Object.freeze({...qualified,wav:encodeSpeechWav(qualified),
    backend});
}
