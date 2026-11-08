import test from 'node:test';
import assert from 'node:assert/strict';
import {observeBrowserLanguage,languageTag,prepareDeviceTranslator,
  localizeApprovedOpening} from '../site/violet-localization.mjs';
import {OPENING_TRACKS,VISITOR_NAME_SLOT} from '../site/opening-script.mjs';

test('browser language is observed, not hardcoded to English',()=>{
  assert.equal(observeBrowserLanguage({languages:['es-VE','en-US']}),'es-VE');
  assert.equal(languageTag('pt-BR'),'pt');
});
test('on-device translator localizes every approved paragraph without replacing script structure',async()=>{
  const api={
    availability:async({sourceLanguage,targetLanguage})=>{
      assert.equal(sourceLanguage,'en');assert.equal(targetLanguage,'es');return 'available';
    },
    create:async()=>({translate:async text=>
      text.replace('Now, {visitor}, let\'s take a closer look.',
        'Ahora, {visitor}, veamos más de cerca.').replace(/^/,'ES: ')})
  };
  const translator=await prepareDeviceTranslator('es-VE',{TranslatorAPI:api});
  const localized=await localizeApprovedOpening(OPENING_TRACKS,VISITOR_NAME_SLOT,translator);
  assert.equal(localized.tracks['asking-name'].length,OPENING_TRACKS['asking-name'].length);
  assert.equal(localized.tracks['after-name'].length,OPENING_TRACKS['after-name'].length);
  assert.equal(localized.tracks['after-name'][8].phase,'presentation');
  assert.equal(localized.nameLine('María'),'ES: Ahora, María, veamos más de cerca.');
});
test('unsupported on-device translation is explicit, never fabricated',async()=>{
  await assert.rejects(()=>prepareDeviceTranslator('ja-JP',{TranslatorAPI:null}),
    /does not provide on-device translation/);
});
test('translated invitation cannot drop visitor placeholder',async()=>{
  const t={locale:'fr-FR',translate:async text=>text.includes('{visitor}')?'Bonjour':text};
  await assert.rejects(()=>localizeApprovedOpening(OPENING_TRACKS,VISITOR_NAME_SLOT,t),
    /visitor placeholder/);
});
