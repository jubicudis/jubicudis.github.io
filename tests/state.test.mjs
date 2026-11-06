import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition} from '../site/state.mjs';
import {CUES,TOPICS} from '../site/content.mjs';
import {DRAWINGS} from '../site/visuals.mjs';

const send=(state,type,extra={})=>transition(state,{type,at:12345,...extra});
test('initial page has a single intentional entry, no automatic biography or presentation',()=>{
  assert.equal(initialState.phase,'idle');
  assert.equal(initialState.name,null);
  assert.equal(initialState.presence,'full');
  assert.equal(initialState.visualObservedGeneration,-1);
  assert.equal(send(initialState,'BEGIN'),initialState);
});
test('Violet asks for a name and permits skipping without invented identity',()=>{
  const asking=send(initialState,'ACTIVATE');
  assert.equal(asking.phase,'name');
  assert.equal(send(asking,'NAME',{value:'   '}),asking);
  const anonymous=send(asking,'SKIP_NAME');
  assert.equal(anonymous.phase,'welcome');
  assert.equal(anonymous.name,null);
  assert.equal(anonymous.nameChoice,'skipped');
  const named=send(asking,'NAME',{value:'  Morgan  '});
  assert.equal(named.phase,'welcome');
  assert.equal(named.name,'Morgan');
  assert.equal(named.context.who,'Morgan');
  assert.equal(send(named,'SKIP_NAME'),named);
});
test('guided sequence follows actual source-based passages, without Jubi-centering or missing diagrams',()=>{
  let s=send(send(initialState,'ACTIVATE'),'SKIP_NAME');
  s=send(s,'BEGIN');
  assert.equal(s.phase,'talk');
  assert.equal(s.index,0);
  assert.ok(CUES.length>=10);
  for(const cue of CUES){
    assert.ok(cue.speech.length>80, 'substantive narration: '+cue.key);
    assert.ok(cue.status.length>15);
    assert.ok(DRAWINGS[cue.figure], 'actual diagram drawing: '+cue.figure);
    assert.doesNotMatch(cue.speech,/\bjubi\b|\bjubicudis\b/i);
  }
  for(const topic of TOPICS){
    assert.ok(topic.detail.length>=3);
    assert.ok(DRAWINGS[topic.figure]);
  }
  assert.equal(send(s,'PREVIOUS'),s);
  assert.equal(send(s,'NEXT').index,1);
});
test('interrupt, select related subject, resume at exact saved passage index',()=>{
  let s=send(send(send(initialState,'ACTIVATE'),'SKIP_NAME'),'BEGIN');
  s=send(send(send(s,'NEXT'),'NEXT'),'NEXT');
  const checkpoint=s.index;
  s=send(s,'EXPLORE');
  assert.equal(s.phase,'explore');
  s=send(s,'SELECT_TOPIC',{id:'mcp'});
  assert.equal(s.topicId,'mcp');
  assert.equal(send(s,'SELECT_TOPIC',{id:'not-known'}),s);
  s=send(s,'RETURN');
  assert.equal(s.phase,'talk');
  assert.equal(s.index,checkpoint);
});
test('no invented transition: speech completion does not advance the explanation',()=>{
  const s=send(send(send(initialState,'ACTIVATE'),'SKIP_NAME'),'BEGIN');
  assert.equal(send(s,'SPEECH_ENDED',{key:'anything'}),s);
  assert.equal(s.index,0);
});
test('Violet presence requires matching observation generation; stale events are rejected',()=>{
  let s=send(initialState,'HIDE');
  assert.equal(s.presence,'receding');
  assert.equal(send(s,'PRESENCE_SETTLED',{generation:-1,target:'marker'}),s);
  s=send(s,'PRESENCE_SETTLED',{generation:s.presenceGeneration,target:'marker'});
  assert.equal(s.presence,'marker');
  s=send(s,'RECALL');
  assert.equal(s.presence,'returning');
  s=send(s,'PRESENCE_SETTLED',{generation:s.presenceGeneration,target:'full'});
  assert.equal(s.presence,'full');
});
test('layout qualification cannot pretend to be newer than current scene',()=>{
  let s=send(initialState,'ACTIVATE');
  assert.equal(send(s,'VISUAL_OBSERVED',{generation:0,isVisible:true}),s);
  const g=s.visualGeneration;
  s=send(s,'VISUAL_OBSERVED',{generation:g,isVisible:true});
  assert.equal(s.visualObservedGeneration,g);
  assert.equal(send(s,'VISUAL_OBSERVED',{generation:g,isVisible:true}),s);
});
test('presentation finishes and enters real exploration without losing the closing',()=>{
  let s=send(send(send(initialState,'ACTIVATE'),'SKIP_NAME'),'BEGIN');
  for(let i=0;i<CUES.length;i++)s=send(s,'NEXT');
  assert.equal(s.phase,'complete');
  s=send(s,'EXPLORE_ALL');
  assert.equal(s.phase,'explore');
  s=send(s,'RETURN');
  assert.equal(s.phase,'complete');
});
