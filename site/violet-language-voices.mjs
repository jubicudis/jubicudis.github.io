// Kokoro language/voice catalogue. These are model capabilities, not a
// claim that the English-only HeadTTS browser adapter can synthesize them.
// A multilingual adapter must provide actual observed PCM before activation.
export const KOKORO_LANGUAGE_VOICES=Object.freeze({
  en:Object.freeze({language:'en-us',voiceId:'af_heart',label:'Heart'}),
  es:Object.freeze({language:'es',voiceId:'ef_dora',label:'Dora'}),
  fr:Object.freeze({language:'fr-fr',voiceId:'ff_siwis',label:'Siwis'}),
  it:Object.freeze({language:'it',voiceId:'if_sara',label:'Sara'}),
  pt:Object.freeze({language:'pt-br',voiceId:'pf_dora',label:'Dora'}),
  hi:Object.freeze({language:'hi',voiceId:'hf_alpha',label:'Alpha'}),
  ja:Object.freeze({language:'ja',voiceId:'jf_alpha',label:'Alpha'}),
  zh:Object.freeze({language:'cmn',voiceId:'zf_xiaoxiao',label:'Xiaoxiao'})
});
export function kokoroVoiceForLocale(locale){
  const language=Intl.getCanonicalLocales(locale)[0].split('-')[0].toLowerCase();
  return KOKORO_LANGUAGE_VOICES[language]||null;
}
export function qualifyMultilingualSpeechAdapter(adapter,locale){
  const voice=kokoroVoiceForLocale(locale);
  if(!voice)return Object.freeze({available:false,reason:'unsupported-language'});
  if(!adapter||typeof adapter.synthesize!=='function'||
     typeof adapter.supports!=='function'||adapter.supports(voice.language,voice.voiceId)!==true)
    return Object.freeze({available:false,reason:'no-verified-multilingual-audio-adapter',voice});
  return Object.freeze({available:true,voice,adapter});
}
