import test from 'node:test';
import assert from 'node:assert/strict';
import {pronunciationText,encodeSpeechWav,sampleGeneratedViseme,
  synthesizeHeartName,requireSingleThreadWasm}
  from '../site/violet-dynamic-name.mjs';

test('authorized name is present in the actual synthesized text; invalid names are not inferred',()=>{
  assert.equal(pronunciationText('Morgan'),"Now, Morgan, let's take a closer look.");
  for(const bad of ['', ' ', '<script>', '\nMorgan', 'A'.repeat(49)])
    assert.throws(()=>pronunciationText(bad));
});

test('single-thread is forced on the Kokoro WASM env when present',()=>{
  const env={backends:{onnx:{wasm:{numThreads:4}}}};
  requireSingleThreadWasm(env);
  assert.equal(env.backends.onnx.wasm.numThreads,1);
  requireSingleThreadWasm(null);
  requireSingleThreadWasm({});
});

test('Kokoro WASM synthesizes the authorized Heart name without a worker',async()=>{
  const calls=[];
  const pcm=Float32Array.from({length:24000},(_,i)=>1.25*Math.sin(i*.1));
  const env={backends:{onnx:{wasm:{numThreads:4}}}};
  const result=await synthesizeHeartName('Morgan',{
    loadModule:async()=>({
      env,
      KokoroTTS:{
        async from_pretrained(model,options){
          calls.push([model,options]);
          return {
            voices:{af_heart:{name:'Heart'}},
            async generate(text,options){
              calls.push([text,options]);
              return {audio:pcm,sampling_rate:24000};
            }
          };
        }
      }
    })
  });
  assert.equal(env.backends.onnx.wasm.numThreads,1);
  assert.equal(result.voiceId,'af_heart');
  assert.equal(result.spokenText,"Now, Morgan, let's take a closer look.");
  assert.equal(result.backend,'wasm');
  assert.equal(result.engine,'kokoro-js');
  assert.equal(result.wav.byteLength,48044);
  assert.equal(result.visemes.length,0);
  assert.equal(calls[0][1].device,'wasm');
  assert.equal(calls[1][1].voice,'af_heart');
  assert.ok(Math.max(...result.pcm)<=1);
});

test('Kokoro synthesis failures remain observable and never substitute another voice',async()=>{
  await assert.rejects(synthesizeHeartName('Morgan',{
    loadModule:async()=>({KokoroTTS:{
      async from_pretrained(){throw Error('actual model init failure');}
    }})
  }),/actual model init failure/);
});

test('missing Heart voice is reported and does not invent audio',async()=>{
  await assert.rejects(synthesizeHeartName('Morgan',{
    loadModule:async()=>({KokoroTTS:{
      async from_pretrained(){return {voices:{af_bella:true}};}
    }})
  }),/Selected Heart voice unavailable/);
});

test('WAV transport requires qualified PCM',()=>{
  const rate=24000,pcm=Float32Array.from({length:100},(_,i)=>Math.sin(i*.2));
  const wav=new DataView(encodeSpeechWav({sampleRate:rate,pcm}));
  assert.equal(String.fromCharCode(...new Uint8Array(wav.buffer.slice(0,4))),'RIFF');
  assert.equal(wav.getUint32(24,true),24000);
  assert.equal(sampleGeneratedViseme({durationMs:10,visemes:[]},
    {source:'observed-generated-heart-audio',playing:true,elapsedMs:0}),null);
});
