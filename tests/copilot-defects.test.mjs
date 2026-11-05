import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPublicCatalog} from '../src/core/content.mjs';
import {createExperience} from '../src/core/experience.mjs';

function fixture() {
  const catalog=createPublicCatalog({
    claims:[
      {id:'tnosClaim',approvedForPublic:true,product:'tnos',kind:'intended',basis:'inventor_design',statement:'Test intent.',source:'Synthetic test fixture'},
      {id:'workClaim',approvedForPublic:true,product:'workbench',kind:'intended',basis:'inventor_design',statement:'Test Workbench intent.',source:'Synthetic test fixture'}
    ],
    topics:[
      {id:'tnos',title:'TNOS',approvedForPublic:true,claimIds:['tnosClaim']},
      {id:'workbench',title:'Workbench',approvedForPublic:true,claimIds:['workClaim']}
    ],
    cues:[{id:'opening',topicId:'tnos',approvedForPublic:true,text:'Test cue.',claimIds:['tnosClaim'],requiredOutputs:['caption']}]
  });
  return createExperience(catalog);
}

test('entering subject chooser clears the old selected topic and output state',()=>{
  const engine=fixture();
  assert.equal(engine.dispatch({type:'START'}).accepted,true);
  const prior=engine.snapshot().generation;
  assert.equal(engine.snapshot().topicId,'tnos');
  const entered=engine.dispatch({type:'SKIP_TO_EXPLORATION'});
  assert.equal(entered.accepted,true);
  assert.equal(entered.state.mode,'explore');
  assert.equal(entered.state.topicId,null);
  assert.deepEqual(entered.state.outputs,{});
  assert.equal(entered.effects[0].topicId,null);
  assert.equal(engine.observe({generation:prior,output:'caption',status:'confirmed'}).accepted,false);
});

test('choosing a subject after the chooser starts fresh observation qualification',()=>{
  const engine=fixture();
  engine.dispatch({type:'START'});
  engine.dispatch({type:'SKIP_TO_EXPLORATION'});
  const oldGen=engine.snapshot().generation;
  const selected=engine.dispatch({type:'EXPLORE',topicId:'workbench'});
  assert.equal(selected.accepted,true);
  assert.equal(engine.snapshot().topicId,'workbench');
  assert.equal(engine.snapshot().outputs.caption,'pending');
  assert.equal(engine.observe({generation:oldGen,output:'caption',status:'confirmed'}).accepted,false);
  const observed=engine.observe({generation:engine.snapshot().generation,output:'caption',status:'confirmed'});
  assert.equal(observed.accepted,true);
  assert.equal(observed.effects[0].type,'TOPIC_READY');
  assert.equal(observed.effects[0].topicId,'workbench');
});

test('pause/resume never advances the cue and preserves its observation state',()=>{
  const engine=fixture();
  engine.dispatch({type:'START'});
  const initial=engine.snapshot();
  assert.equal(engine.dispatch({type:'PAUSE'}).accepted,true);
  assert.equal(engine.dispatch({type:'NEXT'}).accepted,false);
  engine.observe({generation:initial.generation,output:'caption',status:'confirmed'});
  assert.equal(engine.dispatch({type:'NEXT'}).accepted,false);
  const resumed=engine.dispatch({type:'RESUME'});
  assert.equal(resumed.accepted,true);
  assert.equal(resumed.state.paused,false);
  assert.equal(resumed.state.position,0);
  assert.equal(resumed.effects.some(x=>x.type==='CUE_READY'),true);
});

test('preferred-name prompt cannot submit a GET request with JavaScript unavailable',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<div id="name-prompt" role="group"/);
  assert.match(html,/id="submit-name" type="button"/);
  assert.match(html,/<meta name="referrer" content="no-referrer">/);
  assert.doesNotMatch(html,/<form[^>]*id="name-prompt"/);
});

test('spatial UI restores focus and nulls the chooser topic',()=>{
  const js=readFileSync(new URL('../assets/spatial.js',import.meta.url),'utf8');
  assert.match(js,/function restoreFocus\(previous\)/);
  assert.match(js, /switchScene\(null,'chose to explore'\)/);
  assert.match(js,/state\.topic===null/);
  assert.match(js,/document\.activeElement/);
  assert.match(js,/\$\('transcript'\)\.focus/);
});
