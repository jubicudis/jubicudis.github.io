// Browser-language localization capability. No server translation, invented
// translations or prerecorded language-specific audio assets.
// The browser must actually expose an on-device Translator implementation.
export function observeBrowserLanguage(browser=globalThis.navigator){
  const value=(browser?.languages||[]).find(x=>typeof x==='string'&&x.trim())||
    browser?.language||'en-US';
  return Intl.getCanonicalLocales(value)[0];
}
export function languageTag(locale){
  return Intl.getCanonicalLocales(locale)[0].split('-')[0].toLowerCase();
}
export const TRANSFORMERS_MODULE='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';
export const LOCAL_TRANSLATION_MODELS=Object.freeze({
  es:'Xenova/opus-mt-en-es',
  fr:'Xenova/opus-mt-en-fr',
  it:'Xenova/opus-mt-en-it',
  pt:'Xenova/opus-mt-en-ROMANCE'
});
export async function prepareTransformersTranslator(locale,{
  loadModule=()=>import(TRANSFORMERS_MODULE)
}={}){
  const language=languageTag(locale);
  const model=LOCAL_TRANSLATION_MODELS[language];
  if(!model)throw new Error('No qualified browser translation model for '+locale);
  const {pipeline}=await loadModule();
  if(typeof pipeline!=='function')throw new Error('Transformers.js translation unavailable');
  const translate=await pipeline('translation',model,{device:'wasm'});
  return Object.freeze({locale,language,kind:'transformers-wasm',model,
    translate:async text=>{
      const result=await translate(text);
      const output=Array.isArray(result)?result[0]?.translation_text:null;
      if(typeof output!=='string'||!output.trim())
        throw new Error('Transformers.js translation returned no text');
      return output.trim();
    }
  });
}
export async function prepareQualifiedTranslator(locale,options={}){
  if(languageTag(locale)==='en')
    return Object.freeze({locale,language:'en',kind:'approved-english',
      translate:async text=>text});
  try{return await prepareDeviceTranslator(locale,options);}
  catch(error){
    if(error?.message?.includes('does not provide on-device translation')||
       error?.message?.includes('translation model unavailable'))
      return prepareTransformersTranslator(locale,options);
    throw error;
  }
}
export async function prepareDeviceTranslator(locale,{
  TranslatorAPI=globalThis.Translator
}={}){
  const target=languageTag(locale);
  if(target==='en')return Object.freeze({
    locale,language:target,translate:async text=>text,kind:'approved-english'
  });
  if(!TranslatorAPI||typeof TranslatorAPI.availability!=='function'||
     typeof TranslatorAPI.create!=='function')
    throw new Error('This browser does not provide on-device translation for '+locale);
  const config={sourceLanguage:'en',targetLanguage:target};
  const available=await TranslatorAPI.availability(config);
  if(available==='unavailable'||available===false)
    throw new Error('On-device translation model unavailable for '+locale);
  const translator=await TranslatorAPI.create(config);
  if(!translator||typeof translator.translate!=='function')
    throw new Error('On-device translation could not be initialized for '+locale);
  return Object.freeze({
    locale,language:target,kind:'device-translator',
    translate:async text=>{
      const output=await translator.translate(text);
      if(typeof output!=='string'||!output.trim())
        throw new Error('On-device translation produced no text');
      return output.trim();
    }
  });
}
export async function localizeApprovedOpening(openingTracks,nameSlot,translator){
  const tracks={};
  for(const [track,segments] of Object.entries(openingTracks)){
    const translated=[];
    // Mobile Safari cannot safely run 21 concurrent translation inferences.
    // One model and one sequential queue bound memory usage.
    for(const segment of segments){
      translated.push(Object.freeze({
        phase:segment.phase,text:await translator.translate(segment.text)
      }));
    }
    tracks[track]=Object.freeze(translated);
  }
  const template='Now, {visitor}, let\'s take a closer look.';
  const named=await translator.translate(template);
  if(!named.includes('{visitor}'))
    throw new Error('Translated name invitation must retain the visitor placeholder');
  return Object.freeze({
    locale:translator.locale,tracks:Object.freeze(tracks),
    nameLine:visitorName=>named.replace('{visitor}',visitorName),
    slot:Object.freeze({...nameSlot,locale:translator.locale})
  });
}
