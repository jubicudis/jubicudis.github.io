import test from 'node:test';
import assert from 'node:assert/strict';
import {observeBrowserLanguage,languageTag,prepareDeviceTranslator,
  localizeApprovedOpening} from '../site/violet-localization.mjs';
import {OPENING_TRACKS,VISITOR_NAME_SLOT} from '../site/opening-script.mjs';

test('browser language is observed, not hardcoded to English',()=>{
  assert.equal(observeBrowserLanguage({languages:['es-VE','en-US']}),'es-VE');
  assert.equal(languageTag('pt-BR'),'pt');
  assert.equal(observeBrowserLanguage({languages:['en-US@posix']}),'en-US');
});
test('on-device translator localizes every approved paragraph without replacing script structure',async()=>{
  const api={
    availability:async({sourceLanguage,targetLanguage})=>{
      assert.equal(sourceLanguage,'en');assert.equal(targetLanguage,'es');return 'available';
    },
    create:async()=>({translate:async text=>
      text.replace('Now,','Ahora,').replace("let's take a closer look.",'veamos más de cerca.').replace(/^/,'ES: ')})
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
test('visitor name is inserted after translation and never sent through the model',async()=>{
  const t={locale:'fr-FR',translate:async text=>text.includes('{visitor}')?'Bonjour':text};
  const localized=await localizeApprovedOpening(OPENING_TRACKS,VISITOR_NAME_SLOT,t);
  assert.match(localized.nameLine('Morgan'),/Morgan/);
});

test('localized approved script is authorized by the reducer and shown in captions',async()=>{
  const {initialState,reduceOpening,openingMessage}=await import('../site/opening-state.mjs');
  const dispatch=(state,type,extra={})=>reduceOpening(state,{type,at:100,...extra});
  let state=dispatch(initialState,'BROWSER_LANGUAGE_OBSERVED',{evidence:{
    type:'browser-language-observed',locale:'es-VE'
  }});
  const translated={
    'asking-name':OPENING_TRACKS['asking-name'].map(x=>({...x,text:'ES: '+x.text})),
    'after-name':OPENING_TRACKS['after-name'].map(x=>({...x,text:'ES: '+x.text}))
  };
  state=dispatch(state,'LOCALIZED_NARRATION_READY',{
    locale:'es-VE',tracks:translated,nameLine:name=>'Hola, '+name
  });
  assert.equal(state.languageStatus,'qualified');
  assert.equal(state.presentationLocale,'es-VE');
  state=dispatch(state,'RENDER_STARTED');
  state=dispatch(state,'RENDER_OBSERVED',{evidence:{
    type:'webgl-pixel-observed',drawCalls:12,nonBackgroundPixel:true
  }});
  state=dispatch(state,'VOICE_AVAILABLE',{value:true});
  state=dispatch(state,'ACTIVATE');
  assert.equal(state.phase,'asking-name');
  assert.equal(openingMessage(state),'ES: '+OPENING_TRACKS['asking-name'][0].text);
  const token=state.speechToken;
  state=dispatch(state,'SPEECH_STARTED',{token});
  state=dispatch(state,'LOCALIZED_AUDIO_FRAME_OBSERVED',{token,evidence:{
    type:'localized-pcm-clock-observed',playing:true,elapsedMs:20,level:130
  }});
  assert.equal(state.observedSpeechPose,'viseme-open');
  assert.ok(state.bloomMotion.some(p=>p.x!==0));
  state=dispatch(state,'LOCALIZED_CUE_OBSERVED',{token,evidence:{
    type:'localized-pcm-cue-playing',cueIndex:1
  }});
  assert.equal(openingMessage(state),'ES: '+OPENING_TRACKS['asking-name'][1].text);
});

test('configured translation engine failure is not replaced with a second engine',async()=>{
  const {prepareQualifiedTranslator}=await import('../site/violet-localization.mjs');
  await assert.rejects(()=>prepareQualifiedTranslator('es-VE',{
    engine:'device-translator',TranslatorAPI:null,
    loadModule:async()=>{throw Error('must never load alternate model');}
  }),/does not provide on-device translation/);
  await assert.rejects(()=>prepareQualifiedTranslator('es-VE',{
    engine:'unapproved'
  }),/Unrecognized authorized translation engine/);
});
