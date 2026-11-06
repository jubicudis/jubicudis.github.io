import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateHeartEnvelope,sampleMeasuredHeartEnvelope}
  from '../site/violet-heart-envelope.mjs';
import {initialState,reduceOpening} from '../site/opening-state.mjs';
import {validateHeartTimeline} from '../site/violet-selected-voice.mjs';

const raw=JSON.parse(readFileSync(new URL('../site/audio/heart-envelope.json',import.meta.url),'utf8'));
const measured=validateHeartEnvelope(raw);
const timeline=validateHeartTimeline(JSON.parse(
  readFileSync(new URL('../site/audio/heart-timeline.json',import.meta.url),'utf8')
));
const sourceFiles={
  'asking-name':'../site/audio/violet-heart-asking-name.mp3',
  'after-name':'../site/audio/violet-heart-after-name.mp3',
  'post-welcome':'../site/audio/violet-heart-post-welcome.mp3'
};
const dispatch=(state,type,extra={})=>reduceOpening(state,{type,at:100,...extra});

test('acoustic envelopes are decoded measurements of exact approved Heart files',()=>{
  assert.equal(measured.voiceId,'af_heart');
  assert.equal(measured.source,'measured-decoded-approved-heart-audio');
  for(const [track,relative] of Object.entries(sourceFiles)){
    const data=measured.tracks[track];
    const digest=createHash('sha256').update(readFileSync(new URL(relative,import.meta.url))).digest('hex');
    assert.equal(data.sha256,digest);
    assert.equal(data.src,'/site/audio/violet-heart-'+track+'.mp3');
    assert.equal(data.windowMs,40);
    assert.equal(data.levels.length,Math.ceil(data.durationMs/40));
  }
  for(const name of ['asking-name','after-name']){
    assert.ok(Math.abs(measured.tracks[name].durationMs-
      timeline.tracks[name].durationMs)<80);
  }
});

test('acoustic mouth positions are calculated only from observed same-asset clock',()=>{
  const track=measured.tracks['asking-name'];
  function proof(elapsedMs,overrides={}){
    return {type:'authored-playback-position-observed',
      source:'observed-authored-audio',assetId:track.src,token:4,
      playing:true,elapsedMs,...overrides};
  }
  const a=sampleMeasuredHeartEnvelope(measured,'asking-name',proof(300));
  assert.equal(a.kind,'acoustic-intensity-not-phoneme');
  assert.ok(['viseme-closed','viseme-open','viseme-wide'].includes(a.pose));
  assert.equal(a.token,4);
  assert.equal(sampleMeasuredHeartEnvelope(measured,'asking-name',proof(300,{playing:false})),null);
  assert.equal(sampleMeasuredHeartEnvelope(measured,'asking-name',proof(300,{assetId:'/elsewhere.mp3'})),null);
  assert.equal(sampleMeasuredHeartEnvelope(measured,'asking-name',proof(-1)),null);
  assert.equal(sampleMeasuredHeartEnvelope(measured,'asking-name',proof(track.durationMs+100)),null);
  assert.equal(sampleMeasuredHeartEnvelope(measured,'post-welcome',proof(300)),null);
  assert.equal(sampleMeasuredHeartEnvelope(measured,'asking-name',proof(300,{source:'guessed'})),null);
  assert.throws(()=>validateHeartEnvelope({...raw,voiceId:'af_nicole'}));
});

test('only real authored speech observations update visible pose; phonemes never invented',()=>{
  let state=dispatch(initialState,'RENDER_STARTED');
  state=dispatch(state,'RENDER_OBSERVED',{evidence:{
    type:'webgl-pixel-observed',nonBackgroundPixel:true,drawCalls:10
  }});
  state=dispatch(state,'VOICE_AVAILABLE',{value:true});
  state=dispatch(state,'ACTIVATE');
  const token=state.speechToken;
  assert.equal(state.speechStatus,'pending');
  const entry=sampleMeasuredHeartEnvelope(measured,'asking-name',{
    type:'authored-playback-position-observed',
    source:'observed-authored-audio',assetId:measured.tracks['asking-name'].src,
    token,playing:true,elapsedMs:300
  });
  assert.equal(dispatch(state,'AUTHORED_ENVELOPE_OBSERVED',{token,evidence:entry}),state,
    'a playback request is not audible playback');
  state=dispatch(state,'SPEECH_STARTED',{token});
  const observed=dispatch(state,'AUTHORED_ENVELOPE_OBSERVED',{token,evidence:entry});
  assert.equal(observed.observedSpeechPose,entry.pose);
  assert.equal(observed.envelopePositionMs,300);
  const stale=dispatch(observed,'AUTHORED_ENVELOPE_OBSERVED',{token,
    evidence:{...entry,elapsedMs:150}});
  assert.equal(stale,observed);
  const wrong=dispatch(observed,'AUTHORED_ENVELOPE_OBSERVED',{token,
    evidence:{...entry,assetId:'/site/audio/other.mp3'}});
  assert.equal(wrong,observed);
  const failed=dispatch(observed,'SPEECH_FAILED',{token});
  assert.equal(failed.observedSpeechPose,null);
  assert.equal(dispatch(failed,'AUTHORED_ENVELOPE_OBSERVED',{token,evidence:entry}),failed);
});
