// Free browser-side Kokoro ONNX inference adapter. The actual generated PCM
// (not a synthetic timestamp) is the authority for audio playback and motion.
// Model download and per-language phonemization must succeed before support
// can be declared. HeadTTS is English-only and is not used for these voices.
import {kokoroVoiceForLocale} from './violet-language-voices.mjs';
import {encodeSpeechWav,requireSingleThreadWasm} from './violet-dynamic-name.mjs';

export const KOKORO_JS_MODULE='https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
export const KOKORO_ONNX_MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';

export async function createBrowserKokoroAdapter(locale,{
  loadModule=()=>import(KOKORO_JS_MODULE),
  modelId=KOKORO_ONNX_MODEL
}={}){
  const voice=kokoroVoiceForLocale(locale);
  if(!voice)throw new Error('Kokoro has no configured voice for '+locale);
  const {KokoroTTS,env}=await loadModule();
  if(typeof KokoroTTS?.from_pretrained!=='function')
    throw new Error('Kokoro browser inference module unavailable');
  requireSingleThreadWasm(env);
  const tts=await KokoroTTS.from_pretrained(modelId,{
    dtype:'q8',device:'wasm'
  });
  // Kokoro's voice catalogue varies across published builds. A missing
  // introspection property is not evidence of an absent voice; the model's
  // actual generate() call establishes whether it can speak with this ID.
  const catalog=tts.voices;
  if(catalog&&typeof catalog==='object'){
    const ids=Array.isArray(catalog)?catalog:Object.keys(catalog);
    if(!ids.includes(voice.voiceId))
      throw new Error('Requested Kokoro voice not available: '+voice.voiceId);
  }
  return Object.freeze({
    locale,voiceId:voice.voiceId,language:voice.language,
    supports:(language,id)=>language===voice.language&&id===voice.voiceId,
    synthesize:async text=>{
      if(typeof text!=='string'||!text.trim())
        throw new TypeError('Nonempty localized narration is required');
      const audio=await tts.generate(text,{voice:voice.voiceId,speed:1});
      const pcm=audio?.audio;
      const sampleRate=audio?.sampling_rate;
      if(!(pcm instanceof Float32Array)||!pcm.length||
         !Number.isFinite(sampleRate)||sampleRate<8000)
        throw new Error('Kokoro did not return qualified PCM audio');
      let peak=0;
      for(const value of pcm){
        if(!Number.isFinite(value))throw new Error('Non-finite Kokoro PCM');
        peak=Math.max(peak,Math.abs(value));
      }
      if(peak<.005)
        throw new Error('Kokoro generated silent PCM');
      const normalized=peak>1?Float32Array.from(pcm,x=>x/peak):pcm;
      return Object.freeze({
        voiceId:voice.voiceId,language:voice.language,
        spokenText:text,sampleRate,pcm:normalized,
        durationMs:normalized.length*1000/sampleRate,
        wav:encodeSpeechWav({sampleRate,pcm:normalized}),
        visemes:Object.freeze([]),
        visemeStatus:'unavailable-without-observed-phoneme-alignment'
      });
    }
  });
}
