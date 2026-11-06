import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduceOpening,openingMessage} from '../site/opening-state.mjs';
const step=(s,type,data={})=>reduceOpening(s,{type,at:100,...data});
test('dormant is the entire initial experience; unauthorized transitions are inert',()=>{
 assert.equal(initialState.phase,'dormant');
 assert.equal(openingMessage(initialState),'');
 assert.equal(step(initialState,'GIVE_NAME',{name:'Alex'}),initialState);
 assert.equal(step(initialState,'NEXT'),initialState);
});
test('clicking Violet asks the exact approved question',()=>{
 const s=step(initialState,'ACTIVATE');
 assert.equal(s.phase,'asking-name');
 assert.equal(openingMessage(s),"Hello, I'm Violet. What is your name?");
 assert.equal(step(s,'ACTIVATE'),s);
});
test('visitor name optional and never invented; invalid blank name does not proceed',()=>{
 const s=step(initialState,'ACTIVATE');
 assert.equal(step(s,'GIVE_NAME',{name:'  '}),s);
 const named=step(s,'GIVE_NAME',{name:'  Morgan  '});
 assert.equal(named.visitorName,'Morgan');assert.equal(named.nameDecision,'provided');
 assert.equal(named.phase,'welcome');
 assert.match(openingMessage(named),/^Welcome, Morgan\./);
 const skipped=step(s,'SKIP_NAME');
 assert.equal(skipped.visitorName,null);assert.equal(skipped.nameDecision,'skipped');
 assert.match(openingMessage(skipped),/^Welcome\./);
 assert.equal(step(skipped,'SKIP_NAME'),skipped);
});
test('welcome describes three distinct products without biographical focus',()=>{
 const s=step(step(initialState,'ACTIVATE'),'SKIP_NAME');
 const msg=openingMessage(s);
 assert.match(msg,/Tranquility Neuro Operating System/);
 assert.match(msg,/Workbench/);
 assert.match(msg,/separate MCP server/);
 assert.doesNotMatch(msg,/Jubi|Andrew|invented|placeholders/i);
});
test('actual voice events are scoped to the current cue',()=>{
 const s=step(initialState,'ACTIVATE');
 assert.equal(step(s,'SPEECH_STARTED',{token:-1}),s);
 const speaking=step(s,'SPEECH_STARTED',{token:s.speechToken});
 assert.equal(speaking.speaking,true);
 assert.equal(step(speaking,'SPEECH_ENDED',{token:-1}),speaking);
 assert.equal(step(speaking,'SPEECH_ENDED',{token:s.speechToken}).speaking,false);
});
