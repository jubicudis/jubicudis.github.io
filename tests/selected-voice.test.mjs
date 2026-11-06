import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {initialState,openingMessage} from '../site/opening-state.mjs';
import {OPENING_TRACKS} from '../site/opening-script.mjs';
import {VIOLET_SELECTED_VOICE,VIOLET_HEART_CLIPS,VIOLET_TIMELINE_URL,
  resolveVioletOpeningAudio,validateHeartTimeline,cueAtObservedPosition,
  VIOLET_HEART_CONTINUATION}
  from '../site/violet-selected-voice.mjs';

const raw=JSON.parse(readFileSync(new URL('../site/audio/heart-timeline.json',import.meta.url),'utf8'));

test('Heart identity and exact approved Revision 2 content are the only narration authority',()=>{
  assert.equal(VIOLET_SELECTED_VOICE.voiceId,'af_heart');
  assert.equal(VIOLET_TIMELINE_URL,'/site/audio/heart-timeline.json');
  assert.equal(resolveVioletOpeningAudio(initialState),null);
  for(const phase of ['asking-name','welcome','orientation','presentation']){
    const selected=resolveVioletOpeningAudio({...initialState,phase});
    const track=phase==='asking-name'?'asking-name':'after-name';
    assert.equal(selected.track,track);
    assert.equal(selected.src,VIOLET_HEART_CLIPS[track]);
    assert.equal(selected.spokenText,OPENING_TRACKS[track].map(x=>x.text).join(' '));
    assert.equal(selected.voiceId,'af_heart');
  }
});

test('actual measured audio timeline matches every approved segment and selected Heart source',()=>{
  const validated=validateHeartTimeline(raw);
  assert.equal(validated.voiceId,'af_heart');
  for(const track of ['asking-name','after-name']){
    const entry=validated.tracks[track];
    assert.equal(entry.cues.length,OPENING_TRACKS[track].length);
    assert.ok(entry.durationMs>10000);
    assert.equal(entry.cues[0].startMs,0);
    for(let index=0;index<entry.cues.length;index++){
      const cue=entry.cues[index];
      assert.equal(cue.text,OPENING_TRACKS[track][index].text);
      assert.equal(cue.phase,OPENING_TRACKS[track][index].phase);
      assert.equal(cueAtObservedPosition(validated,track,cue.startMs).index,index);
      assert.equal(cueAtObservedPosition(validated,track,(cue.startMs+cue.endMs)/2).index,index);
    }
    assert.equal(cueAtObservedPosition(validated,track,-1),null);
    assert.equal(cueAtObservedPosition(validated,track,entry.durationMs+2000),null);
  }
  assert.throws(()=>validateHeartTimeline({...raw,voiceId:'af_nicole'}));
  const altered=structuredClone(raw);
  altered.tracks['after-name'].cues[4].text='The Workbench is already finished.';
  assert.throws(()=>validateHeartTimeline(altered),/Unqualified Heart cue/);
});

test('visitor name appears visibly but prerecorded voice does not invent its pronunciation',()=>{
  const s={...initialState,phase:'welcome',track:'after-name',cueIndex:0,
    visitorName:'Morgan',nameDecision:'provided'};
  assert.match(openingMessage(s),/^Welcome\. I'm glad you're here\./);
  const selected=resolveVioletOpeningAudio(s);
  assert.equal(selected.visitorNameSpoken,false);
  assert.equal(selected.visibleText,openingMessage(s));
  assert.match(selected.spokenText,/^Welcome\. I'm glad you're here\./);
  assert.doesNotMatch(selected.spokenText,/Morgan/);
});

test('real published media and exact provenance checksums are verified',()=>{
  const provenance=JSON.parse(readFileSync(new URL('../site/audio/heart-provenance.json',import.meta.url),'utf8'));
  assert.equal(provenance.voice_id,'af_heart');
  for(const track of ['asking-name','after-name']){
    const actual=OPENING_TRACKS[track].map(x=>x.text).join(' ');
    assert.equal(provenance.tracks[track].spoken_text,actual);
    assert.equal(provenance.tracks[track].segments,OPENING_TRACKS[track].length);
    const media=new URL('..'+VIOLET_HEART_CLIPS[track],import.meta.url);
    assert.ok(statSync(media).size>30000);
  }
  const lines=readFileSync(new URL('../site/audio/heart-sha256.txt',import.meta.url),'utf8').trim().split('\n');
  assert.equal(lines.length,2);
  for(const line of lines){
    const [expected,path]=line.trim().split(/\s+/);
    assert.equal(createHash('sha256')
      .update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),expected);
  }
});

test('qualified Heart continuation contains only actual approved post-welcome media',()=>{
  assert.equal(VIOLET_HEART_CONTINUATION,
    '/site/audio/violet-heart-post-welcome.mp3');
  const metadata=JSON.parse(readFileSync(
    new URL('../site/audio/heart-continuation-provenance.json',import.meta.url),'utf8'));
  const actual=readFileSync(
    new URL('../site/audio/violet-heart-post-welcome.mp3',import.meta.url));
  const source=readFileSync(
    new URL('../site/audio/violet-heart-after-name.mp3',import.meta.url));
  assert.equal(metadata.sourceVoice,'af_heart');
  assert.equal(metadata.sourceSha256,createHash('sha256').update(source).digest('hex'));
  assert.equal(metadata.outputSha256,createHash('sha256').update(actual).digest('hex'));
  assert.equal(metadata.cutFromObservedTimelineMs,raw.tracks['after-name'].cues[0].endMs);
  assert.equal(metadata.firstOrientationCueInSourceMs,
    raw.tracks['after-name'].cues[1].startMs);
  assert.ok(actual.length>100000);
});
