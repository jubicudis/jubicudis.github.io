import test from 'node:test';
import assert from 'node:assert/strict';
import {createExperience} from '../src/core/experience.mjs';
import {createVioletGuide} from '../src/core/violet.mjs';
import {previewCatalog, previewPlan} from '../preview/demo-content.mjs';

function site() {
  const engine = createExperience(previewCatalog);
  const violet = createVioletGuide(previewCatalog, engine, previewPlan);
  return {engine, violet};
}
function observeCaption(engine, status = 'confirmed') {
  return engine.observe({generation: engine.snapshot().generation, output:'caption', status});
}

test('preview is isolated, clearly placeholder content', () => {
  assert.ok(previewPlan.greeting.text.includes('preview'));
  assert.equal(previewCatalog.cues.length, 5);
  for (const claim of previewCatalog.claims.values()) {
    assert.match(claim.source, /DEV-ONLY placeholder/);
  }
});
test('arrival offers a name without demanding it', () => {
  const {violet} = site();
  assert.equal(violet.dispatch({type:'ARRIVE'}).effect.nameOptional, true);
  assert.equal(violet.snapshot().visitor.nameStatus, 'unasked');
  assert.equal(violet.dispatch({type:'SKIP_NAME'}).accepted, true);
  assert.equal(violet.dispatch({type:'START_TALK'}).accepted, true);
  assert.equal(violet.snapshot().context.who, null);
});
test('visitor-provided names are sanitized, not used for expertise inferences', () => {
  const {violet} = site();
  violet.dispatch({type:'ARRIVE'});
  assert.equal(violet.dispatch({type:'PROVIDE_NAME',name:'  Jubi\n Example '}).accepted, true);
  assert.equal(violet.snapshot().visitor.preferredName, 'Jubi Example');
  assert.equal(violet.snapshot().context.why, null);
  assert.equal(violet.dispatch({type:'PROVIDE_NAME',name:'Other'}).accepted, false);
});
test('interaction alone does not authorize advancing the talk', () => {
  const {violet,engine} = site();
  violet.dispatch({type:'START_TALK'});
  assert.equal(engine.dispatch({type:'NEXT'}).accepted, false);
  assert.equal(observeCaption(engine).accepted, true);
  assert.equal(engine.dispatch({type:'NEXT'}).accepted, true);
  assert.equal(engine.snapshot().position, 1);
});
test('an old generation cannot prove a later presentation result', () => {
  const {violet,engine} = site();
  violet.dispatch({type:'START_TALK'});
  const old = engine.snapshot().generation;
  violet.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  assert.equal(engine.observe({generation:old,output:'caption',status:'confirmed'}).accepted,false);
  assert.equal(engine.snapshot().outputs.caption,'pending');
});
test('exploration preserves the talk checkpoint', () => {
  const {violet,engine} = site();
  violet.dispatch({type:'START_TALK'});
  observeCaption(engine);
  engine.dispatch({type:'NEXT'});
  violet.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  assert.equal(engine.snapshot().checkpoint.position, 1);
  assert.equal(violet.dispatch({type:'RETURN_TO_TALK'}).accepted,true);
  assert.equal(engine.snapshot().position,1);
});
test('changing detail depth creates a new observation requirement', () => {
  const {violet,engine} = site();
  violet.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  observeCaption(engine);
  const old = engine.snapshot().generation;
  violet.dispatch({type:'SET_DEPTH',depth:'detail'});
  assert.ok(engine.snapshot().generation > old);
  assert.equal(engine.snapshot().outputs.caption,'pending');
  assert.equal(violet.briefing('workbench').claims.length,2);
});
test('communication objectives are based on observed output, never alleged understanding', () => {
  const {violet,engine} = site();
  violet.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  let objective = violet.snapshot().objectives.find(x => x.id === 'explain-workbench');
  assert.equal(objective.status,'not-presented');
  observeCaption(engine);
  objective = violet.snapshot().objectives.find(x => x.id === 'explain-workbench');
  assert.equal(objective.status,'presented');
  assert.ok(!Object.hasOwn(objective,'understood'));
});
test('visitor can explore before accepting the invitation to the talk', () => {
  const {violet,engine} = site();
  violet.dispatch({type:'OPEN_TOPIC',topicId:'mcp'});
  assert.equal(violet.dispatch({type:'START_TALK'}).accepted,true);
  assert.equal(engine.snapshot().mode,'guided');
});
test('all cues can complete and restart from a neutral exploration state', () => {
  const {violet,engine} = site();
  violet.dispatch({type:'START_TALK'});
  for (let i=0;i<previewCatalog.cues.length;i++) {
    assert.equal(engine.snapshot().position,i);
    observeCaption(engine);
    assert.equal(engine.dispatch({type:'NEXT'}).accepted,true);
  }
  assert.equal(engine.snapshot().mode,'explore');
  assert.equal(engine.snapshot().topicId,null);
  assert.equal(violet.dispatch({type:'RESTART_TALK'}).accepted,true);
  assert.equal(engine.snapshot().position,0);
});
test('a new topic can be selected after the talk without restarting it', () => {
  const {violet,engine} = site();
  violet.dispatch({type:'SKIP_TO_EXPLORATION'});
  assert.equal(violet.dispatch({type:'OPEN_TOPIC',topicId:'origin'}).accepted,true);
  assert.equal(engine.snapshot().mode,'explore');
  assert.equal(engine.snapshot().topicId,'origin');
});
