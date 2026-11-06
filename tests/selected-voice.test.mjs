import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,openingMessage} from '../site/opening-state.mjs';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VIOLET_SELECTED_VOICE,VIOLET_HEART_CLIPS,resolveVioletOpeningAudio}
  from '../site/violet-selected-voice.mjs';

test('approved Violet voice is Heart and uses actual state-specific authored assets',()=>{
  assert.equal(VIOLET_SELECTED_VOICE.voiceId,'af_heart');
  assert.equal(VIOLET_SELECTED_VOICE.playback,'authored-same-origin');
  assert.equal(resolveVioletOpeningAudio(initialState),null);
  for(const phase of ['asking-name','welcome']){
    const selection=resolveVioletOpeningAudio({...initialState,phase});
    assert.equal(selection.src,VIOLET_HEART_CLIPS[phase]);
    assert.equal(selection.spokenText,openingMessage({...initialState,phase}));
    assert.equal(selection.voiceId,'af_heart');
  }
});

test('a visitor name is displayed without falsely claiming the recording spoke it',()=>{
  const state={...initialState,phase:'welcome',
    visitorName:'Morgan',nameDecision:'provided'};
  const selection=resolveVioletOpeningAudio(state);
  assert.match(selection.visibleText,/Welcome, Morgan\./);
  assert.match(selection.spokenText,/^Welcome\./);
  assert.doesNotMatch(selection.spokenText,/\bMorgan\b/);
  assert.equal(selection.visitorNameSpoken,false);
  assert.equal(selection.src,'/site/audio/violet-heart-welcome.m4a');
});

test('selected Heart assets exist, match the authoritative spoken text and recorded checksums',()=>{
  const provenance=JSON.parse(readFileSync(new URL('../site/audio/heart-provenance.json',import.meta.url),'utf8'));
  assert.equal(provenance.voice_id,'af_heart');
  for(const phase of ['asking-name','welcome']){
    const selected=resolveVioletOpeningAudio({...initialState,phase,nameDecision:'skipped'});
    assert.equal(provenance.clips[phase].spoken_text,selected.spokenText);
    const audioURL=new URL('..'+selected.src,import.meta.url);
    assert.ok(statSync(audioURL).size>10000);
  }
  const hashes=readFileSync(new URL('../site/audio/heart-sha256.txt',import.meta.url),'utf8').trim().split('\n');
  assert.equal(hashes.length,2);
  for(const line of hashes){
    const [sha,path]=line.trim().split(/\s+/);
    const bytes=readFileSync(new URL('../'+path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
  }
});
