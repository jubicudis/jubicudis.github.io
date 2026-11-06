import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BROWSER_VOICE_PROFILE,chooseAvailableVoice,voiceDescriptor,createVioletVoiceEngine
} from '../site/violet-voice.mjs';

const voices=[
  {name:'Ordinary US voice',lang:'en-US',voiceURI:'local-us',default:true},
  {name:'Enhanced US voice',lang:'en-US',voiceURI:'enhanced-us',default:false},
  {name:'Other language',lang:'fr-FR',voiceURI:'fr',default:false}
];
test('prefers an actually available voice marked enhanced in the requested language',()=>{
  assert.equal(chooseAvailableVoice(voices)?.voiceURI,'enhanced-us');
  assert.equal(chooseAvailableVoice([voices[0]])?.voiceURI,'local-us');
  assert.equal(chooseAvailableVoice(voices,'ja-JP'),null);
  assert.equal(voiceDescriptor(voices[1]).qualityLabel,'label-suggests-enhanced');
  assert.equal(voiceDescriptor(voices[0]).qualityLabel,'quality-unverified');
  assert.equal(BROWSER_VOICE_PROFILE.pitch,1);
});
test('browser speech state follows actual start, end and failure callbacks, not a request',()=>{
  let utterance=null,cancels=0;
  class FakeUtterance{constructor(text){this.text=text;}}
  const synth={
    getVoices:()=>voices,
    speak:u=>{utterance=u;},
    cancel:()=>{cancels++;}
  };
  const events=[];
  const v=createVioletVoiceEngine({synthesis:synth,Utterance:FakeUtterance,AudioCtor:null,baseURL:'https://jubicudis.github.io/'});
  const request=v.speakBrowser({text:'Hello, I am Violet.',token:1,emit:x=>events.push(x)});
  assert.equal(request.source,'browser');
  assert.equal(request.voice.voiceURI,'enhanced-us');
  assert.equal(utterance.pitch,1);
  assert.equal(utterance.voice.voiceURI,'enhanced-us');
  assert.equal(events.length,0,'a request is not evidence of playback');
  utterance.onstart();assert.deepEqual(events.map(x=>x.type),['SPEECH_STARTED']);
  utterance.onend();assert.deepEqual(events.map(x=>x.type),['SPEECH_STARTED','SPEECH_ENDED']);
  assert.equal(v.activeSource(),null);
  v.speakBrowser({text:'Again',token:2,emit:x=>events.push(x)});
  utterance.onerror({error:'network'});
  assert.equal(events.at(-1).type,'SPEECH_FAILED');
  assert.equal(v.activeSource(),null);
  assert.ok(cancels>=0);
});
test('interruption never becomes successful completion, and stale callbacks are ignored',()=>{
  let utterance;
  class Utterance{constructor(text){this.text=text;}}
  const s={speak:u=>{utterance=u;},cancel(){},getVoices:()=>voices};
  const events=[],engine=createVioletVoiceEngine({synthesis:s,Utterance,baseURL:'https://jubicudis.github.io/'});
  engine.speakBrowser({text:'Testing',token:9,emit:e=>events.push(e)});
  const prior=utterance;
  prior.onstart();
  assert.equal(engine.cancel('page-hidden'),true);
  prior.onend();
  assert.deepEqual(events.map(e=>e.type),['SPEECH_STARTED','SPEECH_INTERRUPTED']);
  assert.equal(engine.cancel(),false);
  assert.equal(engine.activeSource(),null);
});
test('authored audio is an explicit asset transport and never silently falls back to TTS',async()=>{
  const calls={spoken:0,playing:0,paused:0};
  class FakeAudio{
    constructor(src){this.src=src;this.handlers={};}
    addEventListener(name,cb){this.handlers[name]=cb;}
    play(){calls.playing++;return Promise.resolve();}
    pause(){calls.paused++;}
    removeAttribute(){}
    load(){}
    fire(name){this.handlers[name]?.();}
  }
  const s={getVoices:()=>voices,speak(){calls.spoken++;},cancel(){}};
  const events=[],engine=createVioletVoiceEngine({
    synthesis:s,Utterance:class {},AudioCtor:FakeAudio,baseURL:'https://jubicudis.github.io/'
  });
  let a=engine.playAuthored({src:'/site/audio/approved-greeting.mp3',token:4,emit:e=>events.push(e)});
  assert.equal(a.source,'authored');
  assert.equal(calls.spoken,0);
  assert.equal(events.length,0,'play request itself is not observed playback');
  assert.equal(engine.activeSource(),'authored');
  engine.cancel('explicit-stop');
  assert.deepEqual(events.map(e=>e.type),['SPEECH_INTERRUPTED']);
  const missing=engine.playAuthored({src:'https://other.example/voice.mp3',token:5,emit:e=>events.push(e)});
  assert.equal(missing,null);
  assert.equal(events.at(-1).type,'SPEECH_FAILED');
  assert.equal(calls.spoken,0,'never substituted device speech after failed authored request');
});

test('authored speech timing derives from observed playback clock, never a guessed timer',()=>{
  let audioInstance=null;
  class Playback{
    constructor(url){this.src=url;this.currentTime=0;this.paused=true;this.ended=false;
      this.handlers={};audioInstance=this;}
    addEventListener(name,fn){this.handlers[name]=fn;}
    play(){return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(){}load(){}
    observePlay(){this.paused=false;this.handlers.playing?.();}
    finish(){this.ended=true;this.handlers.ended?.();}
  }
  const events=[];
  const engine=createVioletVoiceEngine({
    synthesis:{speak(){},cancel(){},getVoices:()=>[]},
    Utterance:class {},AudioCtor:Playback,
    baseURL:'https://jubicudis.github.io/'
  });
  engine.playAuthored({src:'/site/audio/selected-opening.mp3',
    token:12,emit:e=>events.push(e)});
  assert.equal(engine.sampleAuthoredClock(12),null,'play request has no playback evidence');
  audioInstance.observePlay();
  audioInstance.currentTime=.24;
  const observed=engine.sampleAuthoredClock(12);
  assert.equal(observed.elapsedMs,240);
  assert.equal(observed.type,'authored-playback-position-observed');
  assert.equal(observed.assetId,'/site/audio/selected-opening.mp3');
  assert.equal(engine.sampleAuthoredClock(11),null);
  audioInstance.finish();
  assert.equal(engine.sampleAuthoredClock(12),null);
  assert.deepEqual(events.map(x=>x.type),['SPEECH_STARTED','SPEECH_ENDED']);
});
