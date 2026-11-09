import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserKokoroAdapter} from '../site/violet-kokoro-multilingual.mjs';
import {kokoroVoiceForLocale,qualifyMultilingualSpeechAdapter}
  from '../site/violet-language-voices.mjs';

test('browser locale selects a real language-specific Kokoro voice',()=>{
  assert.equal(kokoroVoiceForLocale('es-VE').voiceId,'ef_dora');
  assert.equal(kokoroVoiceForLocale('fr-FR').voiceId,'ff_siwis');
  assert.equal(kokoroVoiceForLocale('en-US').voiceId,'af_heart');
  assert.equal(kokoroVoiceForLocale('de-DE'),null);
});
test('unloaded adapter cannot claim language support',()=>{
  assert.equal(qualifyMultilingualSpeechAdapter(null,'es-VE').available,false);
});
test('WASM Kokoro adapter verifies available voice and real generated PCM',async()=>{
  let requested;
  const adapter=await createBrowserKokoroAdapter('es-VE',{loadModule:async()=>({
    KokoroTTS:{from_pretrained:async(model,options)=>{
      requested={model,options};
      return {
        list_voices:()=>['af_heart','ef_dora'],
        generate:async(text,{voice})=>{
          assert.equal(voice,'ef_dora');
          assert.equal(text,'Hola');
          return {audio:new Float32Array(2400).fill(.2),sampling_rate:24000};
        }
      };
    }}
  })});
  assert.equal(requested.options.device,'wasm');
  assert.equal(qualifyMultilingualSpeechAdapter(adapter,'es-VE').available,true);
  const audio=await adapter.synthesize('Hola');
  assert.equal(audio.voiceId,'ef_dora');
  assert.equal(audio.durationMs,100);
  assert.equal(audio.wav.byteLength,4844);
  assert.equal(audio.visemeStatus,'unavailable-without-observed-phoneme-alignment');
});
test('model must actually expose the requested voice',async()=>{
  await assert.rejects(()=>createBrowserKokoroAdapter('fr-FR',{loadModule:async()=>({
    KokoroTTS:{from_pretrained:async()=>({list_voices:()=>['af_heart']})}
  })}),/voice not available/);
});
