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
    tracks[track]=Object.freeze(await Promise.all(segments.map(async segment=>
      Object.freeze({phase:segment.phase,text:await translator.translate(segment.text)}))));
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
