import test from 'node:test';
import assert from 'node:assert/strict';
import {cues,subjects,cuesForSubject,subjectById} from '../site/content.mjs';
import {createPresentation} from '../site/state.mjs';

function confirmAll(p) {
  const s=p.snapshot();
  for(const output of Object.keys(s.outputs))
    assert.equal(p.observe(s.generation,output,'confirmed').accepted,true);
}
test('every published passage is attributed to a source and qualified by status',()=>{
  assert.ok(cues.length>0);
  assert.deepEqual(new Set(subjects.map(s=>s.id)).size,subjects.length);
  for(const c of cues){
    assert.ok(subjectById.has(c.topic));
    assert.ok(c.heading&&c.speech&&c.source.startsWith('Part I')&&c.status);
  }
});
test('guidance does not advance on requested but unobserved output',()=>{
  const p=createPresentation();
  p.dispatch({type:'START'});
  assert.equal(p.snapshot().outputs.caption,'pending');
  assert.equal(p.dispatch({type:'NEXT'}).accepted,false);
  const gen=p.snapshot().generation;
  assert.equal(p.observe(gen,'caption','confirmed').accepted,true);
  assert.equal(p.dispatch({type:'NEXT'}).accepted,false);
  assert.equal(p.observe(gen,'spatial','confirmed').accepted,true);
  assert.equal(p.dispatch({type:'NEXT'}).accepted,true);
});
test('stale observations never qualify a new scene',()=>{
  const p=createPresentation();p.dispatch({type:'START'});
  const old=p.snapshot().generation;
  confirmAll(p);
  p.dispatch({type:'NEXT'});
  assert.equal(p.observe(old,'caption','confirmed').accepted,false);
  assert.equal(p.snapshot().outputs.caption,'pending');
});
test('pause cannot advance and resume preserves the established position',()=>{
  const p=createPresentation();p.dispatch({type:'START'});confirmAll(p);
  p.dispatch({type:'PAUSE'});assert.equal(p.dispatch({type:'NEXT'}).accepted,false);
  assert.equal(p.snapshot().position,0);
  p.dispatch({type:'RESUME'});
  assert.equal(p.snapshot().qualified,true);
  assert.equal(p.dispatch({type:'NEXT'}).accepted,true);
});
test('interrupt saves a checkpoint, exploration does not overwrite it, return restores it',()=>{
  const p=createPresentation();p.dispatch({type:'START'});confirmAll(p);
  p.dispatch({type:'PAUSE'});
  p.dispatch({type:'EXPLORE'});
  assert.equal(p.snapshot().topic,null);
  assert.deepEqual(p.snapshot().returnPoint,{position:0,paused:true});
  p.dispatch({type:'SELECT_SUBJECT',id:'workbench'});
  p.dispatch({type:'SELECT_SUBJECT',id:'architecture'});
  p.dispatch({type:'RETURN'});
  assert.equal(p.snapshot().mode,'guided');
  assert.equal(p.snapshot().position,0);
  assert.equal(p.snapshot().paused,true);
});
test('related explanations can be explored without resetting the guided checkpoint',()=>{
  const p=createPresentation();p.dispatch({type:'START'});
  p.dispatch({type:'EXPLORE'});
  p.dispatch({type:'SELECT_SUBJECT',id:'architecture'});
  assert.equal(cues[p.snapshot().position].id,'frames');
  confirmAll(p);
  p.dispatch({type:'EXPLORE_NEXT'});
  assert.equal(cues[p.snapshot().position].id,'metrics');
  p.dispatch({type:'EXPLORE_PREVIOUS'});
  assert.equal(cues[p.snapshot().position].id,'frames');
  p.dispatch({type:'RETURN'});
  assert.equal(p.snapshot().position,0);
});
test('completed talk enters an unselected subject chooser rather than claiming a topic',()=>{
  const p=createPresentation();p.dispatch({type:'START'});
  for(let i=0;i<cues.length;i++){
    confirmAll(p);
    const next=p.dispatch({type:'NEXT'});
    assert.equal(next.accepted,true);
  }
  assert.equal(p.snapshot().mode,'explore');
  assert.equal(p.snapshot().topic,null);
  assert.equal(p.snapshot().finished,true);
  assert.deepEqual(p.snapshot().outputs,{});
});
test('choosing an unrelated subject cannot authorize invented evidence',()=>{
  const p=createPresentation();p.dispatch({type:'START'});
  p.dispatch({type:'EXPLORE'});
  assert.equal(p.dispatch({type:'SELECT_SUBJECT',id:'imaginary-doorway'}).accepted,false);
  assert.equal(p.snapshot().topic,null);
  assert.equal(cuesForSubject('workbench').every(c=>c.source.startsWith('Part I')),true);
});
