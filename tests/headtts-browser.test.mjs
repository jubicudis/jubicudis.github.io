// Actual HeadTTS synthesis probe; NOT a mocked TTS engine or a website state.
// It qualifies whether the selected Heart model can render a name locally in
// Chromium on a static site. iPhone Safari still requires its own test.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const server=spawn('python3',['-m','http.server','4179','--bind','127.0.0.1'],{stdio:'ignore'});
const base='http://127.0.0.1:4179/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  for(let i=0;i<80;i++){
    try{const r=await fetch(base);if(r.ok)break;}catch{}
    await sleep(250);
  }
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    page.setDefaultTimeout(270000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
      const {synthesizeHeartName}=await import('/site/violet-dynamic-name.mjs');
      const t0=performance.now();
      const audio=await synthesizeHeartName('Morgan',{browser:null});
      return {
        elapsedMs:Math.round(performance.now()-t0),
        voice:audio.voiceId,spokenText:audio.spokenText,
        backend:audio.backend,durationMs:audio.durationMs,
        visemeCount:audio.visemes.length,wavBytes:audio.wav.byteLength,
        phoneticCues:audio.visemes.slice(0,8).map(x=>({kind:x.kind,startMs:x.startMs}))
      };
    });
    assert.equal(result.voice,'af_heart');
    assert.equal(result.backend,'wasm');
    assert.equal(result.spokenText,"Welcome, Morgan. I'm glad you're here.");
    assert.ok(result.durationMs>700);
    assert.ok(result.visemeCount>3);
    assert.ok(result.wavBytes>30000);
    assert.deepEqual(errors,[]);
    mkdirSync('artifacts',{recursive:true});
    writeFileSync('artifacts/headtts-heart-name-actual.json',
      JSON.stringify({status:'actual-browser-synthesis',...result},null,2)+'\n');
    console.log('ACTUAL HEART NAME GENERATED:',JSON.stringify(result));
    await page.close();
  }finally{await browser.close();}
}finally{server.kill();}
