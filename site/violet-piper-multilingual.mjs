// Non-English primary narration engine. Piper produces actual on-device WAV.
// This module never substitutes browser speech, English, or another model.
export const PIPER_MODULE='https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm';
export const PIPER_LANGUAGE_VOICES=Object.freeze({
  es:'es_MX-ald-medium',
  fr:'fr_FR-siwis-medium',
  it:'it_IT-paola-medium',
  pt:'pt_BR-faber-medium',
  hi:'hi_IN-priyamvada-medium',
  zh:'zh_CN-huayan-medium'
});
export function piperVoiceForLocale(locale){
  const language=Intl.getCanonicalLocales(locale)[0].split('-')[0].toLowerCase();
  const voiceId=PIPER_LANGUAGE_VOICES[language];
  return voiceId?Object.freeze({language,voiceId}):null;
}
export function decodeQualifiedPiperWav(wav){
  if(!(wav instanceof ArrayBuffer)||wav.byteLength<46)
    throw new Error('Piper returned no WAV data');
  const v=new DataView(wav),tag=(i)=>String.fromCharCode(...new Uint8Array(wav,i,4));
  if(tag(0)!=='RIFF'||tag(8)!=='WAVE')throw new Error('Piper audio has no RIFF WAV header');
  let fmt=null,data=null;
  for(let i=12;i+8<=wav.byteLength;){
    const size=v.getUint32(i+4,true),start=i+8,next=start+size+(size%2);
    if(next>wav.byteLength)throw new Error('Piper WAV contains an incomplete chunk');
    const id=tag(i);
    if(id==='fmt '){
      if(size<16)throw new Error('Piper WAV format chunk too short');
      fmt={format:v.getUint16(start,true),channels:v.getUint16(start+2,true),
        sampleRate:v.getUint32(start+4,true),bits:v.getUint16(start+14,true)};
    }
    if(id==='data')data={start,size};
    i=next;
  }
  if(!fmt||!data||!Number.isFinite(fmt.sampleRate)||fmt.sampleRate<8000||
     fmt.channels!==1||fmt.format!==1||fmt.bits!==16||data.size<200||data.size%2)
    throw new Error('Piper WAV must contain mono 16-bit PCM');
  const pcm=new Float32Array(data.size/2);
  let peak=0;
  for(let i=0;i<pcm.length;i++){
    const sample=v.getInt16(data.start+i*2,true)/32768;
    pcm[i]=sample;peak=Math.max(peak,Math.abs(sample));
  }
  if(peak<.005)throw new Error('Piper WAV contains silent PCM');
  return Object.freeze({sampleRate:fmt.sampleRate,pcm,
    durationMs:pcm.length*1000/fmt.sampleRate,wav});
}
export async function createBrowserPiperAdapter(locale,{
  loadModule=()=>import(PIPER_MODULE)
}={}){
  const voice=piperVoiceForLocale(locale);
  if(!voice)throw new Error('No authorized Piper voice for '+locale);
  const tts=await loadModule();
  if(typeof tts?.predict!=='function'||typeof tts?.voices!=='function')
    throw new Error('Piper browser speech module unavailable');
  const catalog=await tts.voices();
  if(!catalog||!Object.prototype.hasOwnProperty.call(catalog,voice.voiceId))
    throw new Error('Configured Piper voice is not in the voice catalogue: '+voice.voiceId);
  return Object.freeze({locale,language:voice.language,voiceId:voice.voiceId,
    supports:(language,id)=>language===voice.language&&id===voice.voiceId,
    synthesize:async text=>{
      if(typeof text!=='string'||!text.trim())
        throw new TypeError('Localized narration text is required');
      const result=await tts.predict({text,voiceId:voice.voiceId});
      if(!(result instanceof Blob)||result.size<46)
        throw new Error('Piper returned no generated WAV');
      const observed=decodeQualifiedPiperWav(await result.arrayBuffer());
      return Object.freeze({...observed,spokenText:text,language:voice.language,
        voiceId:voice.voiceId,visemes:Object.freeze([]),
        visemeStatus:'unavailable-without-observed-phoneme-alignment'});
    }
  });
}
