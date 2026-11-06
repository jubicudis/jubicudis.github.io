import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduceOpening,openingMessage,nameChoiceReady}
  from '../site/opening-state.mjs';
import {OPENING_TRACKS} from '../site/opening-script.mjs';

const step=(state,type,data={})=>reduceOpening(state,{type,at:100,...data});
function ready(){
  let state=step(initialState,'RENDER_STARTED');
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
  assert.match(openingMessage(named),/^Welcome, Morgan\. I'm glad you're here\./);
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

test('genuine failure or interruption permits the name choice without falsely completing audio',()=>{
  let s=step(ready(),'ACTIVATE');
  s=step(s,'SPEECH_STARTED',{token:s.speechToken});
  const interrupted=step(s,'SPEECH_INTERRUPTED',{token:s.speechToken});
  assert.equal(interrupted.speechStatus,'interrupted');
  assert.equal(interrupted.speaking,false);
  assert.equal(nameChoiceReady(interrupted),true);
  assert.equal(step(interrupted,'SPEECH_ENDED',{token:interrupted.speechToken}),interrupted);
  const failed=step(s,'SPEECH_FAILED',{token:s.speechToken});
  assert.equal(failed.speechStatus,'failed');
  assert.equal(nameChoiceReady(failed),true);
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
