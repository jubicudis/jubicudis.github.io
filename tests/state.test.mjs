import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduceOpening,openingMessage,nameChoiceReady}
  from '../site/opening-state.mjs';
import {OPENING_TRACKS,VISITOR_NAME_SLOT,NAMED_VISITOR_SCRIPT} from '../site/opening-script.mjs';

const step=(state,type,data={})=>reduceOpening(state,{type,at:100,...data});
function ready(){
  let state=step(initialState,'BROWSER_LANGUAGE_OBSERVED',{evidence:{
    type:'browser-language-observed',locale:'en-US'
  }});
  state=step(state,'RENDER_STARTED');
  state=step(state,'RENDER_OBSERVED',{evidence:{
    type:'webgl-pixel-observed',drawCalls:24,nonBackgroundPixel:true
  }});
  return step(state,'VOICE_AVAILABLE',{value:true});
}
function progress(state,index,elapsedMs,indexToken=state.speechToken,track=state.track){
  return step(state,'SPEECH_CUE_OBSERVED',{
    token:indexToken,
    evidence:{type:'authored-playback-position-observed',
      source:'observed-authored-audio',playing:true,track,
      token:indexToken,elapsedMs,cueIndex:index}
  });
}
function finishQuestion(){
  let s=step(ready(),'ACTIVATE');
  s=step(s,'SPEECH_STARTED',{token:s.speechToken});
  s=progress(s,3,21000);
  return step(s,'SPEECH_ENDED',{token:s.speechToken});
}

test('browser language is observed as authoritative context, not silently replaced',()=>{
  const spanish=step(initialState,'BROWSER_LANGUAGE_OBSERVED',{evidence:{
    type:'browser-language-observed',locale:'es-VE'
  }});
  assert.equal(spanish.browserLocale,'es-VE');
  assert.equal(spanish.languageStatus,'unavailable');
  assert.equal(spanish.presentationLocale,null);
  assert.equal(step(spanish,'ACTIVATE'),spanish);
  const english=step(initialState,'BROWSER_LANGUAGE_OBSERVED',{evidence:{
    type:'browser-language-observed',locale:'en-US'
  }});
  assert.equal(english.languageStatus,'qualified');
  assert.equal(english.presentationLocale,'en-US');
});
test('no activation without genuine rendered evidence and qualified audio',()=>{
  assert.equal(step(initialState,'ACTIVATE'),initialState);
  const started=step(initialState,'RENDER_STARTED');
  assert.equal(step(started,'ACTIVATE'),started);
  const bad=step(started,'RENDER_OBSERVED',{evidence:{
    type:'webgl-pixel-observed',drawCalls:0,nonBackgroundPixel:true
  }});
  assert.equal(bad,started);
  const rendered=step(started,'RENDER_OBSERVED',{evidence:{
    type:'webgl-pixel-observed',drawCalls:24,nonBackgroundPixel:true
  }});
  assert.equal(step(rendered,'ACTIVATE'),rendered);
  assert.equal(step(ready(),'ACTIVATE').phase,'asking-name');
});

test('Violet expression propagates only from authorized reducer events',()=>{
  let s=ready();
  assert.equal(s.visualExpression,'rest');
  assert.equal(s.bodyMotionMode,'flow');
  const observedIdle=step(s,'IDLE_FRAME_OBSERVED',{evidence:{
    type:'observed-animation-frame',elapsedMs:1800,reducedMotion:false
  }});
  assert.ok(observedIdle.bloomMotion.some(point=>point.x!==0||point.y!==0),
    'reducer must calculate real structural motion from observed idle frames');
  assert.equal(step(s,'IDLE_FRAME_OBSERVED',{evidence:{
    type:'unobserved-timer',elapsedMs:1800,reducedMotion:false
  }}),s,'unqualified animation timing must not affect presentation state');
  s=step(s,'ACTIVATE');
  assert.equal(s.visualExpression,'ask');
  s=step(s,'SPEECH_STARTED',{token:s.speechToken});
  assert.equal(s.visualExpression,'talk');
  assert.equal(s.bodyMotionMode,'flow');
  s=step(s,'SPEECH_ENDED',{token:s.speechToken});
  assert.equal(s.visualExpression,'ask');
  assert.equal(s.bodyMotionMode,'flow');
  assert.equal(step(s,'NEXT'),s,'an unapproved action cannot change the face');
});

test('the approved informative greeting precedes the optional name choice',()=>{
  const s=step(ready(),'ACTIVATE');
  assert.equal(openingMessage(s),"Hello, I'm Violet.");
  assert.equal(s.track,'asking-name');
  assert.equal(nameChoiceReady(s),false);
  assert.equal(step(s,'GIVE_NAME',{name:'Morgan'}),s);
  assert.equal(step(s,'SKIP_NAME'),s);
  let speaking=step(s,'SPEECH_STARTED',{token:s.speechToken});
  speaking=progress(speaking,1,6500);
  assert.match(openingMessage(speaking),/visual representation of the interface/);
  assert.equal(nameChoiceReady(speaking),false);
  speaking=progress(speaking,3,21000);
  assert.match(openingMessage(speaking),/may I ask what to call you/);
  assert.equal(step(speaking,'SKIP_NAME'),speaking);
  const ended=step(speaking,'SPEECH_ENDED',{token:s.speechToken});
  assert.equal(ended.speechStatus,'completed');
  assert.equal(nameChoiceReady(ended),true);
});

test('name exchange retains voluntary identity; same approved Heart voice',()=>{
  const s=finishQuestion();
  assert.equal(step(s,'GIVE_NAME',{name:'   '}),s);
  const named=step(s,'GIVE_NAME',{name:'  Morgan  '});
  assert.equal(named.visitorName,'Morgan');
  assert.equal(named.nameDecision,'provided');
  assert.equal(named.phase,'welcome');
  assert.equal(named.track,'after-name');
  assert.match(openingMessage(named),/^Welcome\. I'm glad you're here\./);
  assert.equal(named.speechStatus,'pending');
  const skipped=step(s,'SKIP_NAME');
  assert.equal(skipped.visitorName,null);
  assert.equal(skipped.nameDecision,'skipped');
  assert.match(openingMessage(skipped),/^Welcome\. I'm glad you're here\./);
  assert.equal(step(named,'SKIP_NAME'),named);
  assert.equal(step(skipped,'SKIP_NAME'),skipped);
});

test('orientation and TED-style opening propagate only from observed audio position',()=>{
  let s=step(finishQuestion(),'SKIP_NAME');
  assert.equal(s.phase,'welcome');
  assert.equal(step(s,'SPEECH_CUE_OBSERVED',{
    token:s.speechToken,
    evidence:{type:'authored-playback-position-observed',source:'observed-authored-audio',
      playing:true,track:'after-name',token:s.speechToken,elapsedMs:10000,cueIndex:2}
  }),s,'requested playback is not observed playback');
  s=step(s,'SPEECH_STARTED',{token:s.speechToken});
  const orientation=progress(s,1,3000);
  assert.equal(orientation.phase,'orientation');
  assert.match(openingMessage(orientation),/experimental operating system/);
  assert.match(openingMessage(progress(orientation,4,37000)),/what the Workbench is/);
  assert.match(openingMessage(progress(orientation,5,46000)),/separate MCP server/);
  const stage=progress(orientation,8,67000);
  assert.equal(stage.phase,'presentation');
  assert.equal(openingMessage(stage),"Let's begin with something familiar.");
  assert.equal(step(stage,'SPEECH_ENDED',{token:-1}),stage);
  const ended=step(stage,'SPEECH_ENDED',{token:stage.speechToken});
  assert.equal(ended.speechStatus,'completed');
  assert.equal(ended.phase,'presentation');
  assert.equal(openingMessage(ended),
    'Because the real difference begins with the operating system itself.');
  assert.equal(step(ended,'SPEECH_ENDED',{token:ended.speechToken}),ended);
  assert.equal(step(ended,'NEXT'),ended,'no unapproved later presentation content');
});

test('render failure cannot be overwritten by a fake success',()=>{
  let s=step(initialState,'RENDER_STARTED');
  s=step(s,'RENDER_FAILED',{reason:'WebGL context lost'});
  assert.equal(s.renderStatus,'failed');
  assert.equal(step(s,'ACTIVATE'),s);
  assert.equal(step(s,'RENDER_OBSERVED',{evidence:{
    type:'webgl-pixel-observed',drawCalls:200,nonBackgroundPixel:true
  }}),s);
});

test('stale, nonmonotonic and unqualified speech evidence never changes state',()=>{
  let s=step(ready(),'ACTIVATE');
  s=step(s,'SPEECH_STARTED',{token:s.speechToken});
  const at2=progress(s,2,15500);
  assert.equal(progress(at2,1,16000),at2);
  assert.equal(progress(at2,3,14000),at2);
  assert.equal(progress(at2,3,23000,-1),at2);
  assert.equal(progress(at2,3,23000,at2.speechToken,'after-name'),at2);
  assert.equal(step(at2,'SPEECH_ENDED',{token:-1}),at2);
});

test('observed failure or interruption never invents a spoken name question or permits name choice',()=>{
  let s=step(ready(),'ACTIVATE');
  s=step(s,'SPEECH_STARTED',{token:s.speechToken});
  const interrupted=step(s,'SPEECH_INTERRUPTED',{token:s.speechToken});
  assert.equal(interrupted.speechStatus,'interrupted');
  assert.equal(interrupted.speaking,false);
  assert.equal(nameChoiceReady(interrupted),false);
  assert.equal(interrupted.cueIndex,0);
  assert.equal(step(interrupted,'SKIP_NAME'),interrupted);
  assert.equal(step(interrupted,'GIVE_NAME',{name:'Morgan'}),interrupted);
  assert.equal(step(interrupted,'SPEECH_ENDED',{token:interrupted.speechToken}),interrupted);
  const failed=step(s,'SPEECH_FAILED',{token:s.speechToken});
  assert.equal(failed.speechStatus,'failed');
  assert.equal(failed.cueIndex,0);
  assert.equal(nameChoiceReady(failed),false);
  assert.equal(step(failed,'SKIP_NAME'),failed);
  const unavailable=step(step(ready(),'ACTIVATE'),'SPEECH_UNAVAILABLE',{
    token:s.speechToken
  });
  assert.equal(unavailable.speechStatus,'unavailable');
  assert.equal(unavailable.cueIndex,0);
  assert.equal(nameChoiceReady(unavailable),false);
});

test('approved opening covers all three distinct products without invented claims',()=>{
  const spoken=OPENING_TRACKS['after-name'].map(x=>x.text).join(' ');
  assert.match(spoken,/Tranquility Neuro Operating System|TNOS/);
  assert.match(spoken,/what the Workbench is/);
  assert.match(spoken,/separate MCP server/);
  assert.match(spoken,/intended design/);
  assert.match(spoken,/what has actually been demonstrated/);
  assert.match(spoken,/not actually running TNOS in your browser/);
  assert.doesNotMatch(spoken,/Jubi created everything|done developing|guarantee/i);
  assert.equal(OPENING_TRACKS['asking-name'].length,4);
  assert.equal(OPENING_TRACKS['after-name'].length,17);
});

test('continuous A2 flow persists during speech and ignores changing audio energy',()=>{
  let state=step(ready(),'ACTIVATE');
  const token=state.speechToken;
  state=step(state,'SPEECH_STARTED',{token});
  state=step(state,'IDLE_FRAME_OBSERVED',{evidence:{
    type:'observed-animation-frame',elapsedMs:2100,reducedMotion:false
  }});
  const first=state.bloomMotion;
  const firstPhase=state.flowPhase;
  state=step(state,'AUTHORED_ENVELOPE_OBSERVED',{token,evidence:{
    type:'authored-heart-envelope-observed',source:'observed-authored-audio',
    playing:true,elapsedMs:2100,pose:'viseme-wide',level:220
  }});
  assert.deepEqual(state.bloomMotion,first,
    'a spoken syllable must not pulse Violet ribbons');
  assert.equal(state.flowPhase,firstPhase,
    'audio must not advance the independent ribbon highlight phase');
  state=step(state,'IDLE_FRAME_OBSERVED',{evidence:{
    type:'observed-animation-frame',elapsedMs:3100,reducedMotion:false
  }});
  assert.notDeepEqual(state.bloomMotion,first,
    'ribbon flow must continue on its own during speech');
  assert.ok(state.flowPhase>firstPhase,
    'scene observation alone advances the outward highlight');
  assert.equal(state.bodyMotionMode,'flow');
});

test('A2 idle motion articulates independently without synchronized breathing',()=>{
  let state=step(initialState,'RENDER_STARTED');
  state=step(state,'RENDER_OBSERVED',{evidence:{
    type:'webgl-pixel-observed',nonBackgroundPixel:true,drawCalls:4
  }});
  state=step(state,'IDLE_FRAME_OBSERVED',{evidence:{
    type:'observed-animation-frame',elapsedMs:1800,reducedMotion:false
  }});
  const points=state.bloomMotion;
  assert.equal(points.length,4);
  assert.ok(points.some(p=>p.x!==0||p.y!==0));
  assert.ok(points[0].y!==points[1].y&&points[1].y!==points[2].y,
    'all ribbons must not expand and contract as a single breathing body');
  state=step(state,'IDLE_FRAME_OBSERVED',{evidence:{
    type:'observed-animation-frame',elapsedMs:2300,reducedMotion:true
  }});
  assert.ok(state.bloomMotion.every(p=>p.x===0&&p.y===0),
    'reduced-motion preference must disable ornamental articulation');
});

test('real media failure permits only visitor-authorized replay of the approved track',()=>{
  let state=step(finishQuestion(),'SKIP_NAME');
  const token=state.speechToken;
  state=step(state,'SPEECH_STARTED',{token});
  state=progress(state,1,3900);
  state=step(state,'SPEECH_FAILED',{token,
    reason:'NotAllowedError: playback denied'});
  assert.equal(state.speechStatus,'failed');
  assert.match(state.speechFailureReason,/NotAllowedError/);
  const previous=state;
  state=step(state,'RETRY_SPEECH');
  assert.equal(state.speechToken,token+1);
  assert.equal(state.track,'after-name');
  assert.equal(state.cueIndex,0);
  assert.equal(state.speechStatus,'pending');
  assert.equal(state.speechFailureReason,null);
  assert.equal(state.visitorName,previous.visitorName);
  const duplicate=step(state,'RETRY_SPEECH');
  assert.equal(duplicate,state,'a second replay cannot be requested during playback');
  state=step(state,'SPEECH_STARTED',{token:state.speechToken});
  assert.equal(state.speechStatus,'speaking');
});

test('failed optional iPhone name inference does not invalidate observed recorded Heart playback',()=>{
  let state=step(finishQuestion(),'GIVE_NAME',{name:'Morgan'});
  const token=state.speechToken;
  state=step(state,'SPEECH_STARTED',{token});
  state=step(state,'NAME_SYNTHESIS_STARTED',{token});
  state=progress(state,1,2100);
  state=step(state,'NAME_SYNTHESIS_FAILED',{token,
    reason:'WebAssembly.Memory allocation failed'});
  assert.equal(state.speechStatus,'speaking');
  assert.equal(state.nameSynthesisStatus,'failed');
  assert.equal(state.nameInsertionStatus,'unavailable');
  assert.equal(state.nameAudioCompleted,false);
  state=progress(state,2,11000);
  assert.equal(state.cueIndex,2,'qualified authored narration continues');
  state=step(state,'SPEECH_ENDED',{token});
  assert.equal(state.speechStatus,'completed');
  assert.equal(state.nameAudioCompleted,false,
    'narration ending must not fabricate successful name pronunciation');
  let late=step(finishQuestion(),'GIVE_NAME',{name:'Morgan'});
  const lateToken=late.speechToken;
  late=step(late,'SPEECH_STARTED',{token:lateToken});
  late=step(late,'NAME_SYNTHESIS_STARTED',{token:lateToken});
  late=step(late,'AUTHORED_TRACK_ENDED',{token:lateToken,
    evidence:{type:'authored-track-ended-observed'}});
  late=step(late,'NAME_SYNTHESIS_FAILED',{token:lateToken,
    reason:'HeadTTS unavailable'});
  assert.equal(late.authoredAudioEnded,true);
  assert.equal(late.nameSynthesisStatus,'failed');
  late=step(late,'SPEECH_ENDED',{token:lateToken});
  assert.equal(late.speechStatus,'completed');
  assert.equal(late.nameAudioCompleted,false);
});

test('held approved name seam keeps captions and expression aligned until Heart actually plays',()=>{
  let state=step(finishQuestion(),'GIVE_NAME',{name:'Morgan'});
  const token=state.speechToken;
  state=step(state,'SPEECH_STARTED',{token});
  state=step(state,'NAME_SYNTHESIS_STARTED',{token});
  state=progress(state,VISITOR_NAME_SLOT.beforeCueIndex,62352);
  state=step(state,'NAME_SLOT_OBSERVED',{token,evidence:{
    type:'authored-name-slot-boundary-observed',
    cueIndex:VISITOR_NAME_SLOT.beforeCueIndex
  }});
  const unobserved=step(state,'NAME_SEAM_HELD',{token,evidence:{
    type:'fabricated-pause'
  }});
  assert.equal(unobserved,state);
  state=step(state,'NAME_SEAM_HELD',{token,evidence:{
    type:'authored-media-paused-at-name-seam'
  }});
  assert.equal(state.nameSeamHeld,true);
  assert.equal(state.nameInsertionStatus,'waiting');
  assert.equal(state.observedSpeechPose,null);
  assert.equal(state.visualExpression,'viseme-closed',
    'Violet cannot appear to keep talking while the Heart player is paused');
  assert.equal(openingMessage(state),OPENING_TRACKS['after-name'][7].text);
  state=step(state,'NAME_SYNTHESIS_READY',{token});
  state=step(state,'NAME_INSERTION_REQUESTED',{token,evidence:{
    type:'authored-paragraph-boundary-observed'
  }});
  assert.equal(state.nameInsertionStatus,'requested');
  state=step(state,'NAME_AUDIO_STARTED',{token,evidence:{
    type:'observed-generated-heart-playing'
  }});
  assert.equal(state.nameSeamHeld,false);
  assert.equal(openingMessage(state),VISITOR_NAME_SLOT.text('Morgan'));
});

test('approved Heart orientation advances during name generation without invented name completion',()=>{
  let named=step(finishQuestion(),'GIVE_NAME',{name:'Morgan'});
  assert.equal(named.nameDecision,'provided');
  assert.equal(named.speechStatus,'pending');
  assert.equal(named.nameAudioCompleted,false);
  assert.equal(named.observedSpeechPose,null);
  const token=named.speechToken;
  named=step(named,'SPEECH_STARTED',{token});
  assert.equal(named.speechStatus,'speaking');
  const before=progress(named,1,2400);
  assert.equal(before.phase,'orientation','approved narration must continue while name generates');
  assert.equal(before.nameAudioCompleted,false,'narration must not fabricate spoken name');
  const noProof=step(named,'GENERATED_VISEME_OBSERVED',{token,evidence:{
    type:'generated-viseme-audio-observed',source:'fabricated',
    assetId:'generated-heart:'+token,voiceId:'af_heart',
    playing:true,elapsedMs:300,pose:'viseme-open',level:130
  }});
  assert.equal(noProof,named);
  named=step(named,'NAME_SYNTHESIS_STARTED',{token});
  assert.equal(named.nameSynthesisStatus,'generating');
  assert.equal(step(named,'NAME_INSERTION_REQUESTED',{token,
    evidence:{type:'authored-paragraph-boundary-observed'}}),named);
  named=step(named,'NAME_SYNTHESIS_READY',{token});
  assert.equal(named.nameSynthesisStatus,'ready');
  named=progress(named,VISITOR_NAME_SLOT.beforeCueIndex,62352);
  named=step(named,'NAME_SLOT_OBSERVED',{token,evidence:{
    type:'authored-name-slot-boundary-observed',
    cueIndex:VISITOR_NAME_SLOT.beforeCueIndex
  }});
  named=step(named,'NAME_INSERTION_REQUESTED',{token,
    evidence:{type:'authored-paragraph-boundary-observed'}});
  assert.equal(named.nameInsertionStatus,'requested');
  named=step(named,'NAME_AUDIO_STARTED',{token,
    evidence:{type:'observed-generated-heart-playing'}});
  assert.equal(named.nameInsertionStatus,'playing');
  const speaking=step(named,'GENERATED_VISEME_OBSERVED',{token,evidence:{
    type:'generated-viseme-audio-observed',source:'observed-generated-heart-audio',
    assetId:'generated-heart:'+token,voiceId:'af_heart',
    playing:true,elapsedMs:300,pose:'viseme-open',level:130
  }});
  assert.equal(speaking.observedSpeechPose,'viseme-open');
  assert.equal(speaking.generatedPositionMs,300);
  assert.equal(speaking.observedAudioLevel,130);
  assert.deepEqual(speaking.bloomMotion,named.bloomMotion,
    'speech changes the mouth only and cannot drive ribbon motion');
  const samePoseMoreEnergy=step(speaking,'GENERATED_VISEME_OBSERVED',{token,evidence:{
    type:'generated-viseme-audio-observed',source:'observed-generated-heart-audio',
    assetId:'generated-heart:'+token,voiceId:'af_heart',
    playing:true,elapsedMs:340,pose:'viseme-open',level:200
  }});
  assert.equal(samePoseMoreEnergy.observedSpeechPose,speaking.observedSpeechPose);
  assert.deepEqual(samePoseMoreEnergy.bloomMotion,speaking.bloomMotion,
    'even changing Heart energy must never pulse the body');
  const stale=step(speaking,'GENERATED_VISEME_OBSERVED',{token,evidence:{
    type:'generated-viseme-audio-observed',source:'observed-generated-heart-audio',
    assetId:'generated-heart:'+token,voiceId:'af_heart',
    playing:true,elapsedMs:250,pose:'viseme-wide',level:130
  }});
  assert.equal(stale,speaking,'backwards audio cannot change face pose');
  const fakeEnd=step(speaking,'NAME_AUDIO_ENDED',{token,evidence:{
    type:'invented-end',assetId:'generated-heart:'+token
  }});
  assert.equal(fakeEnd,speaking);
  assert.equal(step(speaking,'SPEECH_ENDED',{token}).speechStatus,'completed');
  const ended=step(speaking,'NAME_AUDIO_ENDED',{token,evidence:{
    type:'observed-generated-heart-ended',assetId:'generated-heart:'+token
  }});
  assert.equal(ended.nameAudioCompleted,true);
  assert.equal(ended.nameInsertionStatus,'completed');
  assert.equal(ended.observedSpeechPose,null);
  assert.equal(ended.phase,'presentation');
  assert.equal(ended.cueIndex,VISITOR_NAME_SLOT.beforeCueIndex);
  assert.equal(openingMessage(ended),OPENING_TRACKS['after-name'][8].text);
  assert.equal(progress(ended,9,64500).phase,'presentation');
});

test('actual named audio failure never advances to generic welcome or name-skipped path',()=>{
  let named=step(finishQuestion(),'GIVE_NAME',{name:'Morgan'});
  const token=named.speechToken;
  named=step(named,'SPEECH_FAILED',{token,reason:'actual model error'});
  assert.equal(named.speechStatus,'failed');
  assert.equal(named.nameDecision,'provided');
  assert.equal(named.phase,'welcome');
  assert.equal(named.cueIndex,0);
  assert.equal(named.nameAudioCompleted,false);
  assert.equal(step(named,'SPEECH_ENDED',{token}),named);
  assert.equal(step(named,'SKIP_NAME'),named);
});

test('approved script reserves a later actual spoken-name slot, not the immediate welcome',()=>{
  assert.equal(VISITOR_NAME_SLOT.track,'after-name');
  assert.equal(NAMED_VISITOR_SCRIPT[8],VISITOR_NAME_SLOT);
  assert.equal(NAMED_VISITOR_SCRIPT.length,OPENING_TRACKS['after-name'].length+1);
  assert.equal(VISITOR_NAME_SLOT.afterCueIndex,7);
  assert.equal(VISITOR_NAME_SLOT.beforeCueIndex,8);
  assert.equal(VISITOR_NAME_SLOT.text('Morgan'),"Now, Morgan, let's take a closer look.");
  let named=step(finishQuestion(),'GIVE_NAME',{name:'Morgan'});
  named=step(named,'SPEECH_STARTED',{token:named.speechToken});
  named=progress(named,4,31000);
  assert.equal(named.nameAudioPlaying,false);
  assert.equal(openingMessage(named),OPENING_TRACKS['after-name'][4].text);
  assert.equal(step(named,'NAME_AUDIO_STARTED',{
    token:named.speechToken,evidence:{type:'observed-generated-heart-playing'}
  }),named,'unauthorized generated audio cannot change presentation state');
  named=step(named,'NAME_SYNTHESIS_STARTED',{token:named.speechToken});
  named=step(named,'NAME_SYNTHESIS_READY',{token:named.speechToken});
  named=progress(named,VISITOR_NAME_SLOT.beforeCueIndex,62352);
  named=step(named,'NAME_SLOT_OBSERVED',{token:named.speechToken,evidence:{
    type:'authored-name-slot-boundary-observed',
    cueIndex:VISITOR_NAME_SLOT.beforeCueIndex
  }});
  named=step(named,'NAME_INSERTION_REQUESTED',{token:named.speechToken,
    evidence:{type:'authored-paragraph-boundary-observed'}});
  const started=step(named,'NAME_AUDIO_STARTED',{
    token:named.speechToken,evidence:{type:'observed-generated-heart-playing'}
  });
  assert.equal(openingMessage(started),VISITOR_NAME_SLOT.text('Morgan'));
  assert.equal(started.nameAudioPlaying,true);
  const ended=step(started,'NAME_AUDIO_ENDED',{
    token:named.speechToken,
    evidence:{type:'observed-generated-heart-ended',
      assetId:'generated-heart:'+named.speechToken}
  });
  assert.equal(ended.nameAudioCompleted,true);
  assert.equal(ended.nameAudioPlaying,false);
  assert.equal(openingMessage(ended),OPENING_TRACKS['after-name'][8].text);
  const skipped=step(finishQuestion(),'SKIP_NAME');
  assert.equal(step(skipped,'NAME_AUDIO_STARTED',{
    token:skipped.speechToken,evidence:{type:'observed-generated-heart-playing'}
  }),skipped);
});

