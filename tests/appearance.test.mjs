import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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


test('production SVG expression qualifier accepts every original face group without substitutes',()=>{
  const source=readFileSync(new URL('../site/violet-environment.mjs',import.meta.url),'utf8');
  const svg=readFileSync(new URL('../site/violet-face.svg',import.meta.url),'utf8');
  const begin=source.indexOf('const EXPRESSION_PARTS=');
  const end=source.indexOf('\nfunction assertVisibleExpression(',begin);
  assert.ok(begin>=0&&end>begin,'actual production expression qualifier must exist');
  const qualify=vm.runInNewContext(source.slice(begin,end)+'\nqualifiedExpressionSvg');
  const modes=['rest','ask','talk','blink','viseme-closed','viseme-open','viseme-wide','viseme-round'];
  const eye={rest:'eye-smile',ask:'eye-open',talk:'eye-smile',blink:'eye-blink'};
  const mouth={rest:'mouth-smile',ask:'mouth-smile',talk:'mouth-speak',blink:'mouth-smile'};
  for(const mode of modes){
    const output=qualify(svg,mode);
    const expectedEye=eye[mode]||'eye-smile';
    const expectedMouth=mouth[mode]||'mouth-'+mode;
    assert.match(output,new RegExp('<g id="'+expectedEye+'" style="display:inline"'));
    assert.match(output,new RegExp('<g id="'+expectedMouth+'" style="display:inline"'));
    assert.equal((output.match(/style="display:inline"/g)||[]).length,2);
    assert.match(output,/<linearGradient id="lumen"/);
    assert.match(output,/<filter id="bloom"/);
  }
  assert.throws(()=>qualify(svg.replace('<g id="mouth-viseme-closed"','<g id="removed"'),'rest'),
    /Required Violet expression part missing: mouth-viseme-closed/);
  assert.throws(()=>qualify(svg.replace('<g id="mouth-viseme-closed"',
    '<g id="mouth-viseme-closed"></g><g id="mouth-viseme-closed"'),'rest'),
    /Duplicate required Violet expression part: mouth-viseme-closed/);
});
