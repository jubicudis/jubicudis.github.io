import test from 'node:test';
import assert from 'node:assert/strict';
import {pronunciationText,observedInferenceBackend,validateHeartAudioResult,
  encodeSpeechWav,sampleGeneratedViseme,synthesizeHeartName}
  from '../site/violet-dynamic-name.mjs';

function observedChunk(){
  const rate=24000,samples=new Float32Array(rate);
  for(let i=0;i<samples.length;i++)samples[i]=.28*Math.sin(i*2*Math.PI*180/rate);
  return {type:'audio',data:{
    audio:{sampleRate:rate,length:rate,numberOfChannels:1,
      getChannelData:index=>{if(index!==0)throw Error('channel');return samples;}},
    visemes:['sil','PP','aa','E','O','sil'],
    vtimes:[0,80,180,430,680,910],
    vdurations:[80,100,250,250,220,90],
    words:['Welcome','Morgan'],wtimes:[0,320]
  }};
}
test('authorized name is present in the actual synthesized text; invalid names are not inferred',()=>{
  assert.equal(pronunciationText('Morgan'),"Now, Morgan, let's take a closer look.");
  for(const bad of ['', ' ', '<script>', '\nMorgan', 'A'.repeat(49)])
    assert.throws(()=>pronunciationText(bad));
});
test('inference backend derives from observed browser support; one runtime is selected',async()=>{
  assert.equal(await observedInferenceBackend(null),'wasm');
  let requested=0;
  assert.equal(await observedInferenceBackend({gpu:{async requestAdapter(){requested++;return {device:true};}}}),'webgpu');
  assert.equal(requested,1);
  assert.equal(await observedInferenceBackend({gpu:{async requestAdapter(){return null;}}}),'wasm');
  let iosGpuRequested=0;
  assert.equal(await observedInferenceBackend({
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    gpu:{async requestAdapter(){iosGpuRequested++;return {device:true};}}
  }),'wasm');
  assert.equal(iosGpuRequested,0,'iPhone must not allocate a competing WebGPU adapter');
});
test('qualified synthesized speech has real PCM and timed visemes bound to the same output',()=>{
  const text=pronunciationText('Morgan');
  const result=validateHeartAudioResult([observedChunk()],text);
  assert.equal(result.voiceId,'af_heart');
  assert.equal(result.durationMs,1000);
  assert.equal(result.pcm.length,24000);
  assert.equal(result.visemes.length,6);
  assert.deepEqual(sampleGeneratedViseme(result,{source:'observed-generated-heart-audio',playing:true,elapsedMs:220}),
    {pose:'viseme-open',kind:'aa',elapsedMs:220,source:'observed-generated-heart-audio'});
  assert.equal(sampleGeneratedViseme(result,{source:'observed-generated-heart-audio',playing:false,elapsedMs:220}),null);
  assert.equal(sampleGeneratedViseme(result,{source:'guessed-timeline',playing:true,elapsedMs:220}),null);
  assert.equal(sampleGeneratedViseme(result,{source:'observed-generated-heart-audio',playing:true,elapsedMs:2000}),null);
  const wav=new DataView(encodeSpeechWav(result));
  assert.equal(String.fromCharCode(...new Uint8Array(wav.buffer.slice(0,4))),'RIFF');
  assert.equal(wav.getUint32(24,true),24000);
  assert.equal(wav.getUint32(40,true),48000);
  assert.equal(wav.getInt16(44+240*2,true)!==0,true);
});
test('unqualified outputs cannot masquerade as generated voice',()=>{
  const base=observedChunk();
  assert.throws(()=>validateHeartAudioResult([{...base,type:'error'}],'Welcome'),/qualified/);
  assert.throws(()=>validateHeartAudioResult([{...base,data:{...base.data,vtimes:[0]}}],'Welcome'),/Incomplete/);
  const quiet=observedChunk();
  quiet.data.audio.getChannelData=()=>new Float32Array(24000);
  assert.throws(()=>validateHeartAudioResult([quiet],'Welcome'),/silent/);
  const unknown=observedChunk();
  unknown.data.visemes[2]='not-a-real-viseme';
  assert.throws(()=>validateHeartAudioResult([unknown],'Welcome'),/viseme/);
});
test('a single observed synthesis result selects Heart only; no alternate provider or invented narration',async()=>{
  const calls=[],chunk=observedChunk();
  class Runtime{
    constructor(options){calls.push(['construct',options]);}
    async connect(){calls.push(['connect']);}
    async setup(config){calls.push(['setup',config]);}
    async synthesize(data){calls.push(['synthesize',data]);return [chunk];}
  }
  const result=await synthesizeHeartName('Morgan',{
    loadModule:async()=>({HeadTTS:Runtime}),browser:null
  });
  assert.equal(result.voiceId,'af_heart');
  assert.equal(result.spokenText,"Now, Morgan, let's take a closer look.");
  assert.equal(result.backend,'wasm');
  assert.equal(result.wav.byteLength,48044);
  assert.deepEqual(calls[0][1].endpoints,['wasm']);
  assert.deepEqual(calls[0][1].voices,['af_heart']);
  assert.equal(calls[2][1].voice,'af_heart');
  assert.equal(calls[3][1].input,result.spokenText);
});
test('synthesis refusal is preserved as an error, not an alternate spoken message',async()=>{
  class Refuses{
    async connect(){throw Error('actual model init failure');}
  }
  await assert.rejects(synthesizeHeartName('Morgan',{
    loadModule:async()=>({HeadTTS:Refuses}),browser:null
  }),/actual model init failure/);
});
