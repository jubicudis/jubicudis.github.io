import test from 'node:test';
import assert from 'node:assert/strict';
import {FULL_A2_APPEARANCE,validateAppearanceSnapshot} from '../site/violet-appearance.mjs';

test('accepted A2 visual channels have the exact neutral render values',()=>{
  assert.deepEqual(FULL_A2_APPEARANCE,{
    structure:1,center:1,features:1
  });
  assert.ok(Object.isFrozen(FULL_A2_APPEARANCE));
});

test('capability input is a complete requested snapshot, not a timed behavior',()=>{
  const requested=validateAppearanceSnapshot({
    structure:.3,center:1,features:0
  });
  assert.deepEqual(requested,{structure:.3,center:1,features:0});
  assert.ok(Object.isFrozen(requested));
  assert.deepEqual(FULL_A2_APPEARANCE,{
    structure:1,center:1,features:1
  });
});

test('invalid, incomplete or nonfinite commands are never promoted to valid state',()=>{
  for(const request of [
    null,{},[],{structure:1,center:1},
    {structure:1,center:1,features:1,schedule:'after greeting'},
    {structure:NaN,center:1,features:1},
    {structure:-.1,center:1,features:1},
    {structure:1,center:2,features:1},
    {structure:1,center:1,features:undefined}
  ])assert.throws(()=>validateAppearanceSnapshot(request));
});
