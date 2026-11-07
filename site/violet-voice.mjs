// Violet narration capability. The experience owns WHEN to speak;
// this module owns HOW an explicitly requested audio source is played.
// No provider is silently substituted after failure, and requested
// narration is not mistaken for observed playback.
const cleanLang=value=>String(value||'').trim().toLowerCase().replace(/_/g,'-');
const toneTag=voice=>/\b(enhanced|premium|natural|high[\s-]?quality|neural)\b/i.test(String(voice?.name||''));
export const BROWSER_VOICE_PROFILE=Object.freeze({
  lang:'en-US',rate:1,pitch:1,volume:1
});

// A name suggesting better quality is only a preference, not proof of it.
// The selected voice must be an actual object provided by this browser.
export function chooseAvailableVoice(voices,locale='en-US'){
  if(!Array.isArray(voices))return null;
  const target=cleanLang(locale),language=target.split('-')[0];
  const candidates=voices.filter(voice=>voice&&typeof voice.lang==='string' &&
    (cleanLang(voice.lang)===target||cleanLang(voice.lang).split('-')[0]===language));
  if(!candidates.length)return null;
  const score=v=>
    (cleanLang(v.lang)===target?40:0)+
    (toneTag(v)?15:0)+
    (v.default?3:0);
  return candidates.map((voice,index)=>({voice,index,score:score(voice)}))
    .sort((a,b)=>b.score-a.score||a.index-b.index)[0].voice;
}
export function voiceDescriptor(voice){
  return voice ? Object.freeze({
    name:String(voice.name||''),lang:String(voice.lang||''),
    voiceURI:String(voice.voiceURI||''),
    qualityLabel:toneTag(voice)?'label-suggests-enhanced':'quality-unverified'
  }):null;
}
function emitSafely(callback,event){if(typeof callback==='function')callback(event);}
export function createVioletVoiceEngine({
  synthesis=typeof window!=='undefined'?window.speechSynthesis:null,
  Utterance=typeof window!=='undefined'?window.SpeechSynthesisUtterance:null,
  AudioCtor=typeof window!=='undefined'?window.Audio:null,
  baseURL=typeof window!=='undefined'?window.location.href:null
}={}){
  let active=null,media=null;
  // One HTMLAudioElement owns every approved Heart segment. Its first play
  // occurs synchronously within Violet's activation click; WebKit grants
  // subsequent source changes to that same element, not to new Audio objects.
  // Playback events, not assignment or play() resolution, establish speech.
  function sharedMedia(){
    if(media)return media;
    const audio=new AudioCtor();
    audio.preload='auto';
    audio.addEventListener('playing',()=>{
      const session=active;
      if(!session||session.audio!==audio||session.playing)return;
      session.playing=true;
      emitSafely(session.emit,{type:'SPEECH_STARTED',token:session.token});
      const sample=session.kind==='generated'
        ?sampleGeneratedClock(session.token):sampleAuthoredClock(session.token);
      if(sample)emitSafely(session.onPosition,sample);
    });
    audio.addEventListener('timeupdate',()=>{
      const session=active;
      if(!session||session.audio!==audio||!session.playing)return;
      const sample=session.kind==='generated'
        ?sampleGeneratedClock(session.token):sampleAuthoredClock(session.token);
      if(sample)emitSafely(session.onPosition,sample);
    });
    audio.addEventListener('ended',()=>{
      const session=active;
      if(!session||session.audio!==audio)return;
      session.playing=false;active=null;session.revoke?.();
      if(session.kind==='generated'&&typeof session.onEnded==='function'){
        try{session.onEnded();}catch(error){
          emitSafely(session.emit,{type:'SPEECH_FAILED',token:session.token,
            reason:String(error?.message||error)});
        }
      }else emitSafely(session.emit,{type:'SPEECH_ENDED',token:session.token});
    });
    audio.addEventListener('error',()=>{
      const session=active;
      if(!session||session.audio!==audio)return;
      active=null;session.playing=false;session.revoke?.();
      emitSafely(session.emit,{type:'SPEECH_FAILED',token:session.token,
        reason:session.kind==='generated'
          ?'generated Heart audio could not be decoded or played'
          :'authored audio failed to load'});
    });
    media=audio;
    return media;
  }
  function cancel(reason='interrupted'){
    const session=active;active=null;
    if(!session)return false;
    try{
      if(session.kind==='browser')synthesis?.cancel?.();
      else {session.audio.pause();session.audio.removeAttribute?.('src');session.audio.load?.();}
    }catch{/* cancellation cannot manufacture completed speech */}
    if(session.kind==='generated')session.revoke?.();
    emitSafely(session.emit,{type:'SPEECH_INTERRUPTED',token:session.token,reason});
    return true;
  }
  function speakBrowser({text,token,emit}){
    cancel('replaced');
    if(typeof text!=='string'||!text.trim()||!Number.isSafeInteger(token))
      throw new TypeError('Browser narration requires nonempty text and a valid state token');
    if(!synthesis||!Utterance||typeof synthesis.speak!=='function'){
      emitSafely(emit,{type:'SPEECH_UNAVAILABLE',token});return null;
    }
    let utterance;
    try{
      utterance=new Utterance(text);
      Object.assign(utterance,BROWSER_VOICE_PROFILE);
      const voices=typeof synthesis.getVoices==='function'?synthesis.getVoices():[];
      const selected=chooseAvailableVoice(voices,BROWSER_VOICE_PROFILE.lang);
      if(selected)utterance.voice=selected;
      const session={kind:'browser',token,emit,utterance,voice:voiceDescriptor(selected)};
      active=session;
      utterance.onstart=()=>{if(active===session)emitSafely(emit,{type:'SPEECH_STARTED',token});};
      utterance.onend=()=>{if(active===session){active=null;emitSafely(emit,{type:'SPEECH_ENDED',token});}};
      utterance.onerror=event=>{
        if(active===session){active=null;emitSafely(emit,{
          type:'SPEECH_FAILED',token,reason:String(event?.error||'speech synthesis error')
        });}
      };
      synthesis.speak(utterance);
      return Object.freeze({source:'browser',token,voice:session.voice});
    }catch(error){
      active=null;
      emitSafely(emit,{type:'SPEECH_FAILED',token,reason:String(error?.message||error)});
      return null;
    }
  }

  // Premium recorded narration may be supplied as approved audio assets later.
  // The caller must explicitly request this transport; a missing or broken
  // file NEVER triggers silent substitution by browser text-to-speech.
  function playAuthored({src,token,emit,onPosition,startAtMs=0}){
    cancel('replaced');
    if(typeof src!=='string'||!src||!Number.isSafeInteger(token))
      throw new TypeError('Authored narration requires an actual file URL and state token');
    if(!AudioCtor||!baseURL){
      emitSafely(emit,{type:'SPEECH_UNAVAILABLE',token});return null;
    }
    let url;
    try{
      url=new URL(src,baseURL);
      if(url.origin!==new URL(baseURL).origin || !/\.(mp3|m4a|ogg|wav)(?:$)/i.test(url.pathname))
        throw new Error('Authored narration must be a same-origin audio asset');
    }catch(error){
      emitSafely(emit,{type:'SPEECH_FAILED',token,reason:String(error.message)});return null;
    }
    try{
      const audio=sharedMedia();
      audio.src=url.href;
      audio.preservesPitch=true;
      audio.playbackRate=1;
      const session={kind:'authored',audio,token,emit,src:url.pathname,
        playing:false,onPosition};
      active=session;
      if(startAtMs>0){
        const seek=()=>{if(active===session)audio.currentTime=startAtMs/1000;};
        if(audio.readyState>=1)seek();
        else audio.addEventListener('loadedmetadata',seek,{once:true});
      }
      const promise=audio.play();
      if(promise&&typeof promise.catch==='function')promise.catch(error=>{
        if(active===session){active=null;emitSafely(emit,{type:'SPEECH_FAILED',token,reason:String(error?.message||error)});}
      });
      return Object.freeze({source:'authored',token,src:url.pathname});
    }catch(error){
      active=null;
      emitSafely(emit,{type:'SPEECH_FAILED',token,reason:String(error?.message||error)});
      return null;
    }
  }
  // Same-Heart generated name audio comes from a validated real PCM synthesis.
  // The full presentation completes only after the separate approved Heart
  // continuation has actually played; generated welcome completion alone
  // must never manufacture the final SPEECH_ENDED state.
  function playGenerated({wav,token,emit,onPosition,onEnded,insertAfterAuthored=false}){
    if(insertAfterAuthored&&active?.kind==='authored'&&active.token===token){
      active=null;media.pause();
    }else cancel('replaced');
    if(!(wav instanceof ArrayBuffer)||wav.byteLength<=44||!Number.isSafeInteger(token))
      throw new TypeError('Generated speech requires qualified WAV and current token');
    if(!AudioCtor||typeof URL==='undefined'||typeof URL.createObjectURL!=='function'){
      emitSafely(emit,{type:'SPEECH_UNAVAILABLE',token});return null;
    }
    const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));
    let released=false;
    const revoke=()=>{
      if(!released){released=true;URL.revokeObjectURL(url);}
    };
    try{
      const audio=sharedMedia();
      audio.src=url;
      // The dynamic visitor-name line receives the same subtle character
      // pitch lift as the recorded Heart narration. WebKit uses
      // preservesPitch=false for actual sample-rate pitch movement.
      audio.preservesPitch=false;
      audio.playbackRate=1.08;
      const session={kind:'generated',audio,token,emit,
        src:'generated-heart:'+token,playing:false,revoke,onPosition,onEnded};
      active=session;
      const request=audio.play();
      if(request&&typeof request.catch==='function')request.catch(error=>{
        if(active!==session)return;
        active=null;revoke();
        emitSafely(emit,{type:'SPEECH_FAILED',token,
          reason:String(error?.message||error)});
      });
      return Object.freeze({source:'generated-heart',token,assetId:session.src});
    }catch(error){
      active=null;revoke();
      emitSafely(emit,{type:'SPEECH_FAILED',token,reason:String(error?.message||error)});
      return null;
    }
  }
  function sampleGeneratedClock(token){
    if(!active||active.kind!=='generated'||active.token!==token||
       !active.playing||active.audio.paused===true||active.audio.ended===true)
      return null;
    const seconds=active.audio.currentTime;
    if(!Number.isFinite(seconds)||seconds<0)return null;
    return Object.freeze({type:'generated-playback-position-observed',
      source:'observed-generated-heart-audio',
      assetId:active.src,token,playing:true,elapsedMs:seconds*1000});
  }
  // This reads a qualified browser audio clock; no timer guesses how far
  // speech progressed, and browser TTS has no fabricated phoneme timestamps.
  function sampleAuthoredClock(token){
    if(!active||active.kind!=='authored'||active.token!==token||
      !active.playing||active.audio.paused===true||active.audio.ended===true)
      return null;
    const seconds=active.audio.currentTime;
    if(!Number.isFinite(seconds)||seconds<0)return null;
    return Object.freeze({type:'authored-playback-position-observed',
      source:'observed-authored-audio',assetId:active.src,
      token,playing:true,elapsedMs:Math.floor(seconds*1000)});
  }
  return Object.freeze({
    speakBrowser,playAuthored,playGenerated,cancel,
    sampleAuthoredClock,sampleGeneratedClock,
    availableVoices:()=>typeof synthesis?.getVoices==='function'
      ?synthesis.getVoices().map(voiceDescriptor):[],
    selectedBrowserVoice:()=>voiceDescriptor(
      chooseAvailableVoice(typeof synthesis?.getVoices==='function'?synthesis.getVoices():[],BROWSER_VOICE_PROFILE.lang)
    ),
    activeSource:()=>active?active.kind:null
  });
}
