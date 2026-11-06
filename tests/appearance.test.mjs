import test from 'node:test';
import assert from 'node:assert/strict';
import {FULL_A2_APPEARANCE,validateAppearanceSnapshot} from '../site/violet-appearance.mjs';

test('accepted A2 has independently addressable structure, face, environment and features',()=>{
  assert.deepEqual(FULL_A2_APPEARANCE,{
    structure:1,center:1,environment:1,features:1
  });
  assert.ok(Object.isFrozen(FULL_A2_APPEARANCE));
});
test('visual request describes materials only, not behavior or timing',()=>{
  const request=validateAppearanceSnapshot({
    structure:.3,center:1,environment:.4,features:0
  });
  assert.deepEqual(request,{structure:.3,center:1,environment:.4,features:0});
  assert.ok(Object.isFrozen(request));
  assert.equal(FULL_A2_APPEARANCE.environment,1);
});
test('invalid visual requests cannot be reported as valid',()=>{
  for(const request of [
    null,{},[],{structure:1,center:1,features:1},
    {structure:1,center:1,environment:1,features:1,schedule:'after greeting'},
    {structure:NaN,center:1,environment:1,features:1},
    {structure:-.1,center:1,environment:1,features:1},
    {structure:1,center:2,environment:1,features:1},
    {structure:1,center:1,environment:Infinity,features:1},
    {structure:1,center:1,environment:1,features:undefined}
  ])assert.throws(()=>validateAppearanceSnapshot(request));
});
