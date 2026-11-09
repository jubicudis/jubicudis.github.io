// Explicit, on-device Heart synthesis capability for a visitor-chosen name.
// Only invoked by the actual GIVE_NAME decision; never loaded for skip/initial.
// The returned audio originates from the same Kokoro Heart synthesis.
// No alternate speaker, inferred speech completion, or presentation state.
import {VIOLET_SELECTED_VOICE} from './violet-selected-voice.mjs';
import {VISITOR_NAME_SLOT} from './opening-script.mjs';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function pronunciationText(visitorName){
  if(typeof visitorName!=='string'||!visitorName||
    visitorName.length>48||/[\u0000-\u001f\u007f<>]/.test(visitorName)||
    visitorName!==visitorName.trim())
    throw new TypeError('Name must be the authorized, normalized visitor input');
  return VISITOR_NAME_SLOT.text(visitorName);
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
  const cue=result.visemes?.find(c=>observation.elapsedMs>=c.startMs&&
    observation.elapsedMs<c.endMs);
  return cue?Object.freeze({pose:cue.pose,kind:cue.kind,
    elapsedMs:observation.elapsedMs,source:observation.source}):null;
}

// Same Kokoro-82M Heart model used for the approved recordings.
// list_voices() only console.tables and returns undefined; do not treat it as a list.
export const HEART_KOKORO_MODULE='https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
export const HEART_KOKORO_MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';

export async function synthesizeHeartName(visitorName,{
  loadModule=()=>import(HEART_KOKORO_MODULE),
  modelId=HEART_KOKORO_MODEL
}={}){
  const text=pronunciationText(visitorName);
  const voiceId=VIOLET_SELECTED_VOICE.voiceId;
  const {KokoroTTS}=await loadModule();
  if(typeof KokoroTTS?.from_pretrained!=='function')
    throw new Error('Kokoro Heart synthesis module unavailable');
  const tts=await KokoroTTS.from_pretrained(modelId,{
    dtype:'q8',device:'wasm'
  });
  const catalog=tts.voices||{};
  if(!Object.prototype.hasOwnProperty.call(catalog,voiceId))
    throw new Error('Selected Heart voice unavailable: '+voiceId);
  const result=await tts.generate(text,{voice:voiceId,speed:1});
  const source=result?.audio, sampleRate=result?.sampling_rate;
  if(!(source instanceof Float32Array)||source.length<100||
     !finite(sampleRate)||sampleRate<8000)
    throw new Error('Kokoro Heart returned no qualified PCM');
  let peak=0;
  for(const sample of source){
    if(!finite(sample))throw new Error('Non-finite Heart audio');
    peak=Math.max(peak,Math.abs(sample));
  }
  if(peak<.005)throw new Error('Kokoro Heart returned silent audio');
  const gain=peak>1?1/peak:1;
  const pcm=gain===1?source:Float32Array.from(source,x=>x*gain);
  const durationMs=pcm.length*1000/sampleRate;
  const qualified=Object.freeze({
    voiceId,spokenText:text,
    sampleRate,pcm,durationMs,
    visemes:Object.freeze([]),
    visemeStatus:'unavailable-without-observed-phoneme-alignment'
  });
  return Object.freeze({...qualified,wav:encodeSpeechWav(qualified),
    backend:'wasm',engine:'kokoro-js'});
}
