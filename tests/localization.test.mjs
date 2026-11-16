function advanceLocalized(state,to,step){
  for(let cue=0;cue<=to;cue++){
    const token=state.speechToken;
    state=step(state,'LOCALIZED_CUE_OBSERVED',{token,
      evidence:{type:'localized-pcm-cue-playing',cueIndex:cue}});
    state=step(state,'LOCALIZED_CLIP_ENDED',{token,evidence:{
      type:'localized-pcm-ended-observed',source:'observed-generated-piper-audio',
      assetId:'generated-piper:'+token,cueIndex:cue}});
  }
  return state;
}
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
    create:async()=>({translate:async text=>{
      if(text==='Now,')return 'Ahora,';
      if(text==="let's take a closer look.")return 'veamos más de cerca.';
      return 'ES: '+text;
    }})
  };
  const translator=await prepareDeviceTranslator('es-VE',{TranslatorAPI:api});
  const localized=await localizeApprovedOpening(OPENING_TRACKS,VISITOR_NAME_SLOT,translator);
  assert.equal(localized.tracks['asking-name'].length,OPENING_TRACKS['asking-name'].length);
  assert.equal(localized.tracks['after-name'].length,OPENING_TRACKS['after-name'].length);
  assert.equal(localized.tracks['after-name'][8].phase,'presentation');
  assert.equal(localized.nameLine('María'),'Ahora, María, veamos más de cerca.');
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
    type:'localized-pcm-cue-playing',cueIndex:0
  }});
  state=dispatch(state,'LOCALIZED_CLIP_ENDED',{token,evidence:{
    type:'localized-pcm-ended-observed',source:'observed-generated-piper-audio',
    assetId:'generated-piper:'+token,cueIndex:0
  }});
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

test('Portuguese multilingual translation requests explicit model target and releases resources',async()=>{
  const {prepareTransformersTranslator}=await import('../site/violet-localization.mjs');
  const calls=[];
  let disposed=false;
  const translator=await prepareTransformersTranslator('pt-BR',{
    loadModule:async()=>({pipeline:async(kind,model)=>{
      assert.equal(kind,'translation');
      assert.equal(model,'Xenova/opus-mt-en-ROMANCE');
      const translate=async input=>{calls.push(input);return [{translation_text:input}];};
      translate.dispose=async()=>{disposed=true;};
      return translate;
    }})
  });
  assert.equal(await translator.translate('Hello'), '>>pt_BR<< Hello');
  await translator.dispose();
  assert.equal(disposed,true);
  assert.deepEqual(calls,['>>pt_BR<< Hello']);
});

test('localized name enters only after observed paragraph seven end and verified named PCM',async()=>{
  const {initialState,reduceOpening}=await import('../site/opening-state.mjs');
  const send=(state,type,rest={})=>reduceOpening(state,{type,...rest});
  const translated=Object.fromEntries(Object.entries(OPENING_TRACKS).map(([key,segments])=>
    [key,segments.map(segment=>({...segment,text:'ES: '+segment.text}))]));
  let state=send(initialState,'BROWSER_LANGUAGE_OBSERVED',{
    evidence:{type:'browser-language-observed',locale:'es-VE'}});
  state=send(state,'LOCALIZED_NARRATION_READY',{
    locale:'es-VE',tracks:translated,nameLine:name=>'Ahora, '+name+', veamos más de cerca.'});
  state=send(state,'RENDER_STARTED');
  state=send(state,'RENDER_OBSERVED',{
    evidence:{type:'webgl-pixel-observed',nonBackgroundPixel:true,drawCalls:3}});
  state=send(state,'VOICE_AVAILABLE',{value:true});
  state=send(state,'ACTIVATE');
  state=send(state,'SPEECH_STARTED',{token:state.speechToken});
  state=advanceLocalized(state,3,send);
  state=send(state,'SPEECH_ENDED',{token:state.speechToken});
  state=send(state,'GIVE_NAME',{name:'María'});
  const token=state.speechToken;
  state=send(state,'SPEECH_STARTED',{token});
  state=advanceLocalized(state,7,send);
  state=send(state,'LOCALIZED_NAME_LINE_READY',{token,text:'Ahora, María, veamos más de cerca.'});
  // No observed ending yet: name insertion is forbidden.
  state=send(state,'NAME_SYNTHESIS_STARTED',{token});
  assert.equal(state.nameInsertionStatus,'waiting');
  assert.equal(send(state,'NAME_INSERTION_REQUESTED',{token,
    evidence:{type:'localized-paragraph-ended-observed'}}),state);
  state=send(state,'NAME_SLOT_OBSERVED',{token,
    evidence:{type:'localized-name-slot-boundary-observed',cueIndex:8}});
  assert.equal(state.nameSlotObserved,true);
  state=send(state,'NAME_SYNTHESIS_READY',{token});
  state=send(state,'NAME_INSERTION_REQUESTED',{token,
    evidence:{type:'localized-paragraph-ended-observed'}});
  assert.equal(state.nameInsertionStatus,'requested');
  state=send(state,'NAME_AUDIO_STARTED',{token,
    evidence:{type:'observed-generated-piper-playing'}});
  assert.equal(state.nameAudioPlaying,true);
  state=send(state,'NAME_AUDIO_ENDED',{token,
    evidence:{type:'observed-generated-piper-ended',assetId:'generated-piper:'+token}});
  assert.equal(state.nameAudioCompleted,true);
  assert.equal(state.nameAudioPlaying,false);
});
