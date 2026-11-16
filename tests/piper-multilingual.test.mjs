import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserPiperAdapter,piperVoiceForLocale,decodeQualifiedPiperWav}
  from '../site/violet-piper-multilingual.mjs';

function wav({peak=.24,frames=1000,rate=22050}={}){
  const result=new ArrayBuffer(44+frames*2),v=new DataView(result);
  const tag=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));};
  tag(0,'RIFF');v.setUint32(4,36+frames*2,true);tag(8,'WAVE');
  tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,1,true);v.setUint32(24,rate,true);
  v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
  tag(36,'data');v.setUint32(40,frames*2,true);
  for(let i=0;i<frames;i++)v.setInt16(44+i*2,Math.round(peak*32767),true);
  return result;
}
test('each selected locale has one primary language-specific voice, no alternate',()=>{
  assert.equal(piperVoiceForLocale('es-VE').voiceId,'es_MX-ald-medium');
  assert.equal(piperVoiceForLocale('fr-FR').voiceId,'fr_FR-siwis-medium');
  assert.equal(piperVoiceForLocale('hi-IN'),null);
  assert.equal(piperVoiceForLocale('ja-JP'),null);
});
test('Piper adapter produces qualified RIFF PCM from the configured engine',async()=>{
  let spoken=null;
  const adapter=await createBrowserPiperAdapter('es-VE',{loadModule:async()=>({
    voices:async()=>[{key:'es_MX-ald-medium'}],
    predict:async args=>{spoken=args;return new Blob([wav()],{type:'audio/wav'});}
  })});
  assert.equal(adapter.supports('es','es_MX-ald-medium'),true);
  const sample=await adapter.synthesize('Hola, María.');
  assert.deepEqual(spoken,{text:'Hola, María.',voiceId:'es_MX-ald-medium'});
  assert.equal(sample.pcm.length,1000);
  assert.equal(sample.sampleRate,22050);
  assert.ok(sample.durationMs>40);
  assert.equal(sample.spokenText,'Hola, María.');
});
test('missing selected voice fails; no substitute voice',async()=>{
  await assert.rejects(()=>createBrowserPiperAdapter('es-VE',{loadModule:async()=>({
    voices:async()=>[{key:'es_ES-davefx-medium'}],predict:async()=>new Blob([wav()])
  })}),/not in the voice catalogue/);
});
test('silent and invalid model output never qualifies as audio',()=>{
  assert.throws(()=>decodeQualifiedPiperWav(wav({peak:0})),/silent PCM/);
  assert.throws(()=>decodeQualifiedPiperWav(new ArrayBuffer(100)),/RIFF WAV/);
});