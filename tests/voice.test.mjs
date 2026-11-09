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

test('a held Heart seam resumes the same qualified media clock after optional synthesis failure',async()=>{
  let player;
  class FakeAudio{
    constructor(){player=this;this.paused=true;this.ended=false;
      this.currentTime=0;this.handlers={};this.playCount=0;}
    addEventListener(type,handler){this.handlers[type]=handler;}
    play(){this.playCount++;this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(){}load(){}
    observe(type){this.handlers[type]?.();}
  }
  const events=[];
  const engine=createVioletVoiceEngine({AudioCtor:FakeAudio,
    baseURL:'https://jubicudis.github.io/'});
  engine.playAuthored({src:'/site/audio/violet-heart-after-name.mp3',
    token:14,emit:e=>events.push(e)});
  player.observe('playing');
  player.currentTime=62.68;
  assert.equal(engine.holdAuthoredForName(14,62352),true);
  assert.equal(player.currentTime,62.352,
    'a late Safari observation must not shift the inventor-approved name seam');
  assert.equal(player.paused,true);
  assert.equal(engine.sampleAuthoredClock(14),null);
  assert.equal(engine.resumeHeldAuthored(14),true);
  player.observe('playing');
  assert.equal(player.playCount,2);
  assert.equal(engine.sampleAuthoredClock(14).elapsedMs,62352);
  assert.equal(events.filter(e=>e.type==='SPEECH_STARTED').length,2);
  assert.equal(engine.activeSource(),'authored');
});

test('observed generated Heart welcome produces actual audio events and does not complete the whole presentation',()=>{
  let audio;
  class FakeAudio{
    constructor(src){
      this.src=src;this.paused=true;this.ended=false;this.currentTime=0;
      this.events=new Map();audio=this;
    }
    addEventListener(name,handler){this.events.set(name,handler);}
    play(){return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(){}load(){}
    fire(type){this.events.get(type)?.();}
  }
  const events=[],positions=[],calls=[];
  const engine=createVioletVoiceEngine({AudioCtor:FakeAudio,
    baseURL:'https://jubicudis.github.io/'});
  const wav=new ArrayBuffer(128);
  const result=engine.playGenerated({wav,token:8,emit:event=>events.push(event),
    onPosition:x=>positions.push(x),
    onEnded:()=>calls.push('next-qualified-audio')});
  assert.equal(result.source,'generated-heart');
  assert.match(audio.src,/^blob:/);
  assert.equal(engine.sampleGeneratedClock(8),null);
  audio.paused=false;audio.currentTime=.11;audio.fire('playing');
  assert.equal(engine.sampleGeneratedClock(8).elapsedMs,110);
  audio.currentTime=.24;audio.fire('timeupdate');
  assert.deepEqual(positions.map(x=>x.elapsedMs),[110,240]);
  assert.deepEqual(events.map(x=>x.type),['SPEECH_STARTED']);
  audio.ended=true;audio.fire('ended');
  assert.deepEqual(calls,['next-qualified-audio']);
  assert.equal(engine.activeSource(),null);
  assert.deepEqual(events.map(x=>x.type),['SPEECH_STARTED'],
    'a name recording ending is not the end of the TNOS presentation');
});
test('generated audio interruption cannot manufacture successful speech completion',()=>{
  let audio;
  class FakeAudio{
    constructor(){this.paused=true;this.ended=false;this.currentTime=0;
      this.events={};audio=this;}
    addEventListener(type,handler){this.events[type]=handler;}
    play(){return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(){}load(){}
  }
  const events=[],engine=createVioletVoiceEngine({AudioCtor:FakeAudio});
  engine.playGenerated({wav:new ArrayBuffer(100),token:16,
    emit:event=>events.push(event)});
  assert.equal(engine.cancel('actual-page-hidden'),true);
  audio.events.ended?.();
  assert.deepEqual(events.map(x=>x.type),['SPEECH_INTERRUPTED']);
  assert.equal(engine.activeSource(),null);
});


test('one gesture-authorized Heart player serves authored, generated, and continued audio without fallback',()=>{
  let constructed=0,player;
  class GesturePolicyAudio{
    constructor(){
      constructed++;player=this;this.src='';
      this.currentTime=0;this.paused=true;this.ended=false;
      this.handlers={};
    }
    addEventListener(type,handler){this.handlers[type]=handler;}
    play(){
      if(constructed!==1)return Promise.reject(new Error('NotAllowedError: new player blocked'));
      return Promise.resolve();
    }
    pause(){this.paused=true;}
    removeAttribute(name){if(name==='src')this.src='';}
    load(){this.paused=true;this.currentTime=0;this.ended=false;}
    observe(type,position=0){
      this.currentTime=position;this.paused=type!=='playing';this.ended=type==='ended';
      this.handlers[type]?.();
    }
  }
  const events=[],positions=[];
  const engine=createVioletVoiceEngine({
    AudioCtor:GesturePolicyAudio,baseURL:'https://jubicudis.github.io/',
    synthesis:{speak(){throw Error('fallback TTS prohibited');},cancel(){}}
  });
  const emit=event=>events.push(event);
  engine.playAuthored({src:'/site/audio/violet-heart-asking-name.mp3',
    token:1,emit,onPosition:sample=>positions.push(sample)});
  assert.equal(constructed,1);
  assert.equal(events.length,0,'media request is not speech observation');
  player.observe('playing',.3);
  assert.equal(events.at(-1).type,'SPEECH_STARTED');
  assert.equal(positions.at(-1).assetId,'/site/audio/violet-heart-asking-name.mp3');
  player.observe('ended',4);
  assert.equal(events.at(-1).type,'SPEECH_ENDED');

  engine.playGenerated({wav:new ArrayBuffer(128),token:2,emit,
    onEnded:()=>engine.playAuthored({
      src:'/site/audio/violet-heart-post-welcome.mp3',token:2,emit,
      onPosition:sample=>positions.push(sample)
    })});
  assert.equal(constructed,1,'async name synthesis must not allocate a new locked media element');
  player.observe('playing',.2);
  assert.equal(engine.activeSource(),'generated');
  player.observe('ended',2);
  assert.equal(engine.activeSource(),'authored',
    'actual generated audio ending authorizes only the approved continuation');
  player.observe('playing',.4);
  assert.equal(positions.at(-1).assetId,'/site/audio/violet-heart-post-welcome.mp3');
  player.observe('ended',3);
  assert.equal(events.at(-1).type,'SPEECH_ENDED');
  assert.equal(constructed,1);
  assert.equal(engine.activeSource(),null);
  assert.equal(events.filter(event=>event.type==='SPEECH_STARTED').length,3);
});

test('visitor-name handoff keeps the same media player and narration token without false interruption',()=>{
  const instances=[],events=[];
  class Playback{
    constructor(){this.handlers={};this.src='';this.currentTime=0;this.paused=true;this.ended=false;this.readyState=1;instances.push(this);}
    addEventListener(type,handler){this.handlers[type]=handler;}
    play(){this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(){}load(){}
    fire(type){this.handlers[type]?.();}
  }
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  URL.createObjectURL=()=> 'blob:https://jubicudis.github.io/name';
  URL.revokeObjectURL=()=>{};
  try{
    const engine=createVioletVoiceEngine({AudioCtor:Playback,
      baseURL:'https://jubicudis.github.io/'});
    const token=41;
    const emit=e=>events.push(e.type);
    engine.playAuthored({src:'/site/audio/violet-heart-after-name.mp3',token,emit});
    const audio=instances[0];
    audio.fire('playing');
    audio.currentTime=62;
    assert.equal(engine.holdAuthoredForName(token,62352),true);
    assert.equal(audio.paused,true);
    engine.playGenerated({wav:new ArrayBuffer(80),token,insertAfterAuthored:true,
      emit,onEnded:()=>{
        engine.playAuthored({src:'/site/audio/violet-heart-after-name.mp3',
          token,startAtMs:62000,continueAfterGenerated:true,emit});
      }});
    audio.fire('playing');
    audio.fire('ended');
    assert.equal(instances.length,1);
    assert.equal(engine.activeSource(),'authored');
    assert.equal(audio.paused,true,
      'resumed Heart must not start until new MP3 metadata is observed');
    audio.fire('loadedmetadata');
    assert.equal(audio.paused,false,
      'metadata-qualified seek precedes continuation playback');
    assert.equal(audio.currentTime,62);
    assert.equal(events.includes('SPEECH_INTERRUPTED'),false,
      'source handoff is not a new visitor command or an interruption');
    audio.fire('playing');
    audio.fire('ended');
    assert.equal(events.at(-1),'SPEECH_ENDED');
  }finally{
    if(originalCreate)URL.createObjectURL=originalCreate;
    else delete URL.createObjectURL;
    if(originalRevoke)URL.revokeObjectURL=originalRevoke;
    else delete URL.revokeObjectURL;
  }
});
