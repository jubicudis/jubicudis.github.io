import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduceOpening,openingMessage} from '../site/opening-state.mjs';
const step=(s,type,data={})=>reduceOpening(s,{type,at:100,...data});
function observed(){
  let s=step(initialState,'RENDER_STARTED');
  s=step(s,'RENDER_OBSERVED',{evidence:{type:'webgl-pixel-observed',drawCalls:32,nonBackgroundPixel:true}});
  assert.equal(s.renderStatus,'observed');return s;
}
test('unobserved renderer cannot advance',()=>{
  assert.equal(initialState.phase,'dormant');
  assert.equal(initialState.renderStatus,'uninitialized');
  assert.equal(step(initialState,'ACTIVATE'),initialState);
  const pending=step(initialState,'RENDER_STARTED');
  assert.equal(step(pending,'ACTIVATE'),pending);
  assert.equal(step(pending,'RENDER_OBSERVED',{evidence:{type:'webgl-pixel-observed',drawCalls:0,nonBackgroundPixel:true}}),pending);
  assert.equal(step(pending,'RENDER_OBSERVED',{evidence:{type:'webgl-pixel-observed',drawCalls:50,nonBackgroundPixel:false}}),pending);
  assert.equal(step(initialState,'NEXT'),initialState);
});
test('observed Three.js draw calls and pixels authorize activation',()=>{
  const s=observed();const activated=step(s,'ACTIVATE');
  assert.equal(activated.phase,'asking-name');
  assert.equal(openingMessage(activated),"Hello, I'm Violet. What is your name?");
  assert.equal(step(activated,'ACTIVATE'),activated);
});
test('renderer failure is recorded and never overwritten by fallback success',()=>{
  const failed=step(step(initialState,'RENDER_STARTED'),'RENDER_FAILED',{reason:'WebGL context lost'});
  assert.equal(failed.renderStatus,'failed');assert.equal(failed.renderEvidence,null);
  assert.equal(failed.renderFailure,'WebGL context lost');
  assert.equal(step(failed,'ACTIVATE'),failed);
  assert.equal(step(failed,'RENDER_OBSERVED',{evidence:{type:'webgl-pixel-observed',drawCalls:100,nonBackgroundPixel:true}}),failed);
});
test('name or skip never creates guessed identity',()=>{
  const s=step(observed(),'ACTIVATE');
  assert.equal(step(s,'GIVE_NAME',{name:'  '}),s);
  const named=step(s,'GIVE_NAME',{name:'  Morgan  '});
  assert.equal(named.visitorName,'Morgan');assert.equal(named.nameDecision,'provided');
  assert.equal(named.phase,'welcome');assert.match(openingMessage(named),/^Welcome, Morgan\./);
  const skipped=step(s,'SKIP_NAME');
  assert.equal(skipped.visitorName,null);assert.equal(skipped.nameDecision,'skipped');
  assert.match(openingMessage(skipped),/^Welcome\./);
  assert.equal(step(skipped,'SKIP_NAME'),skipped);
});
test('welcome distinguishes all products without biographical focus',()=>{
  const s=step(step(observed(),'ACTIVATE'),'SKIP_NAME');const msg=openingMessage(s);
  assert.match(msg,/Tranquility Neuro Operating System/);
  assert.match(msg,/Workbench/);assert.match(msg,/separate MCP server/);
  assert.doesNotMatch(msg,/Jubi|Andrew|placeholders/i);
});
test('voice token prevents stale completion',()=>{
  const s=step(observed(),'ACTIVATE');
  assert.equal(step(s,'SPEECH_STARTED',{token:-1}),s);
  const speaking=step(s,'SPEECH_STARTED',{token:s.speechToken});
  assert.equal(speaking.speaking,true);
  assert.equal(step(speaking,'SPEECH_ENDED',{token:-1}),speaking);
  assert.equal(step(speaking,'SPEECH_ENDED',{token:s.speechToken}).speaking,false);
});
