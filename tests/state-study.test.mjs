import test from 'node:test';
import assert from 'node:assert/strict';
import {createStateStudy} from '../state-study/state.mjs';

test('a passage is held until the current scene measurement exists', () => {
  const study=createStateStudy();
  assert.equal(study.requestPassage().accepted,false);
  assert.equal(study.snapshot().runtime.access,'unestablished');
});

test('admitted closed measurement blocks passage', () => {
  const study=createStateStudy();
  assert.equal(study.observeDoor({revision:0,angle:0}).accepted,true);
  assert.equal(study.snapshot().runtime.access,'blocked');
  assert.equal(study.requestPassage().reason,'door-closed');
  assert.equal(study.snapshot().feedback.successfulPassages,0);
});

test('external model event invalidates a previously admitted result without a new message', () => {
  const study=createStateStudy();
  study.observeDoor({revision:0,angle:0});
  const changed=study.changeEnvironment(true);
  assert.equal(changed.revision,1);
  assert.equal(changed.evidence.status,'pending');
  assert.equal(changed.runtime.access,'unestablished');
  assert.equal(study.requestPassage().reason,'unestablished-state');
});

test('a stale measurement cannot authorize a later scene revision', () => {
  const study=createStateStudy();
  study.changeEnvironment(true);
  study.changeEnvironment(false);
  assert.equal(study.observeDoor({revision:1,angle:1.33}).accepted,false);
  assert.equal(study.snapshot().runtime.access,'unestablished');
});

test('a command is not an observation', () => {
  const study=createStateStudy();
  study.changeEnvironment(true);
  assert.equal(study.observeDoor({revision:1,angle:.5}).accepted,false);
  assert.equal(study.snapshot().runtime.access,'unestablished');
  assert.equal(study.observeDoor({revision:1,angle:1.33}).accepted,true);
  assert.equal(study.snapshot().runtime.access,'permitted');
  assert.equal(study.requestPassage().accepted,true);
  assert.equal(study.snapshot().passage.status,'requested');
  assert.equal(study.snapshot().feedback.successfulPassages,0);
  assert.equal(study.observePassage({revision:1,position:.3}).accepted,false);
  assert.equal(study.snapshot().feedback.successfulPassages,0);
});

test('observed simulated outcome updates feedback for subsequent computations', () => {
  const study=createStateStudy();
  study.changeEnvironment(true);
  study.observeDoor({revision:1,angle:1.33});
  study.requestPassage();
  assert.equal(study.observePassage({revision:1,position:1}).accepted,true);
  assert.equal(study.snapshot().feedback.successfulPassages,1);
  study.changeEnvironment(false);
  assert.equal(study.requestPassage().accepted,false);
  study.observeDoor({revision:2,angle:0});
  assert.equal(study.snapshot().runtime.access,'blocked');
  assert.equal(study.snapshot().feedback.successfulPassages,1);
});

test('the contextual record has source, revision and seven distinct questions', () => {
  const study=createStateStudy();
  study.observeDoor({revision:0,angle:0});
  const context=study.snapshot().runtime.context;
  for (const field of ['who','what','when','where','why','how','extent'])
    assert.equal(typeof context[field],'string');
  assert.match(context.when,/revision 0/);
  assert.match(study.snapshot().evidence.source,/browser-scene-model/);
});

test('a rejected source can never become an admitted runtime state', () => {
  const study=createStateStudy();
  study.changeEnvironment(true);
  const observation=study.observeDoor({revision:1,angle:1.33,source:'unverified-external-claim'});
  assert.equal(observation.accepted,false);
  assert.equal(study.snapshot().runtime.status,'awaiting-observation');
});
