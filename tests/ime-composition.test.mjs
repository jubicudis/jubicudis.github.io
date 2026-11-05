import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../assets/spatial.js', import.meta.url), 'utf8');
const start = source.indexOf('  function isNameSubmissionKey(e, composing) {');
const end = source.indexOf("\n  $('skip-name').addEventListener", start);
assert.ok(start >= 0 && end > start, 'Name interaction code must remain discoverable');

function mount() {
  const listeners = new Map();
  const preferredName = {
    value:'仮', // Composition in progress, not necessarily the chosen name
    addEventListener(type, handler) {listeners.set('input:'+type, handler);}
  };
  const submitButton = {
    addEventListener(type, handler) {listeners.set('submit:'+type, handler);}
  };
  const accepted = [];
  const $ = id => id === 'preferred-name' ? preferredName : id === 'submit-name' ? submitButton : null;
  const body = source.slice(start, end);
  runInNewContext(body, {$, start:name => accepted.push(name)});
  const send = (type, event = {}) => {
    const handler = listeners.get('input:'+type);
    assert.equal(typeof handler, 'function', 'Expected handler for '+type);
    let prevented = false;
    handler({
      key:'Enter', keyCode:13, isComposing:false,
      preventDefault(){prevented=true;}, ...event
    });
    return prevented;
  };
  return {send, accepted, preferredName, click:()=>listeners.get('submit:click')()};
}

test('IME composition Enter confirms a candidate without starting the introduction',()=>{
  const ui=mount();
  ui.send('compositionstart');
  const prevented=ui.send('keydown',{key:'Enter',keyCode:13,isComposing:true});
  assert.equal(prevented,false);
  assert.deepEqual(ui.accepted,[]);
});

test('composition guard works when a browser reports isComposing incorrectly',()=>{
  const ui=mount();
  ui.send('compositionstart');
  assert.equal(ui.send('keydown',{key:'Enter',keyCode:13,isComposing:false}),false);
  assert.deepEqual(ui.accepted,[]);
});

test('legacy IME keyCode 229 after compositionend does not accept early',()=>{
  const ui=mount();
  ui.send('compositionstart');
  ui.send('compositionend');
  assert.equal(ui.send('keydown',{key:'Enter',keyCode:229,isComposing:false}),false);
  assert.deepEqual(ui.accepted,[]);
});

test('a separate Enter after composition ends accepts the finalized name',()=>{
  const ui=mount();
  ui.send('compositionstart');
  ui.send('compositionend');
  ui.preferredName.value='仮名';
  assert.equal(ui.send('keydown',{key:'Enter',keyCode:229}),false);
  assert.equal(ui.send('keydown',{key:'Enter',keyCode:13}),true);
  assert.deepEqual(ui.accepted,['仮名']);
});

test('normal Enter works and non-Enter keys do not submit',()=>{
  const ui=mount();
  assert.equal(ui.send('keydown',{key:'ArrowDown',keyCode:40}),false);
  assert.equal(ui.send('keydown',{key:'Enter',keyCode:13}),true);
  assert.deepEqual(ui.accepted,['仮']);
});

test('explicit button remains available to submit a completed preferred name',()=>{
  const ui=mount();
  ui.preferredName.value='Jubi';
  ui.click();
  assert.deepEqual(ui.accepted,['Jubi']);
});
