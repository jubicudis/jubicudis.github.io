// Real end-to-end Violet name flow with HeadTTS/Kokoro Heart synthesis.
// No mock speech, synthetic state events or alternate browser voices.
// This is Chromium evidence only; iPhone Safari needs separate actual proof.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const server=spawn('python3',['-m','http.server','4179','--bind','127.0.0.1'],{stdio:'ignore'});
const base='http://127.0.0.1:4179/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  let started=false;
  for(let i=0;i<80;i++){
    try{const r=await fetch(base);if(r.ok){started=true;break;}}catch{}
    await sleep(250);
  }
  assert.equal(started,true,'Actual website must be served locally');
  const browser=await chromium.launch({
    headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']
  });
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.setDefaultTimeout(180000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.__realHeartEvents=[];
      window.__spokenByBrowserDevice=0;
      const ActualAudio=window.Audio;
      window.__audioPlayersConstructed=0;
      window.Audio=function(src){
        const media=new ActualAudio(src);
        window.__audioPlayersConstructed++;
        const nativePlay=media.play.bind(media);
        media.play=function(){
          media.playbackRate=String(media.src).startsWith('blob:')?1:12;
          return nativePlay();
        };
        const record=event=>{
          const src=media.currentSrc||media.src;
          const kind=String(src).startsWith('blob:')?'generated-name':'approved-recording';
          window.__realHeartEvents.push({kind,event,src});
        };
        media.addEventListener('playing',()=>record('playing'));
        media.addEventListener('ended',()=>record('ended'));
        return media;
      };
      if(window.speechSynthesis){
        const native=window.speechSynthesis.speak.bind(window.speechSynthesis);
        window.speechSynthesis.speak=function(...args){
          window.__spokenByBrowserDevice++;
          return native(...args);
        };
      }
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{
      const el=document.getElementById('environment');
      return el.dataset.renderStatus==='observed' &&
        !document.getElementById('violet-activate').disabled;
    },null,{timeout:30000});
    await page.evaluate(()=>{
      const stage=document.getElementById('environment');
      window.__posesSeen=[];
      window.__lastPoseSeen='';
      new MutationObserver(()=>{
        const pose=stage.dataset.speechPose;
        if(pose&&pose!==window.__lastPoseSeen){
          window.__posesSeen.push(pose);window.__lastPoseSeen=pose;
        }
      }).observe(stage,{attributes:true,attributeFilter:['data-speech-pose']});
    });
    await page.locator('#violet-activate').click();
    await page.waitForFunction(()=>{
      const s=document.getElementById('environment');
      return s.dataset.phase==='asking-name' &&
        s.dataset.speechStatus==='completed' &&
        !document.getElementById('name-form').hidden;
    },null,{timeout:18000});
    await page.locator('#visitor-name').fill('Morgan');
    await page.locator('#name-confirm').click();
    assert.equal(await page.locator('#violet-caption').innerText(),
      "Welcome. I'm glad you're here.");
    assert.equal(await page.locator('#environment').getAttribute('data-name-audio-completed'),'false');
    const synthesisStarted=performance.now();
    await page.waitForFunction(()=>window.__realHeartEvents.some(e=>
      e.kind==='generated-name'&&e.event==='playing'),null,{timeout:180000});
    const initializationElapsed=performance.now()-synthesisStarted;
    await page.waitForFunction(()=>{
      const e=window.__realHeartEvents;
      const s=document.getElementById('environment');
      return e.some(x=>x.kind==='generated-name'&&x.event==='ended') &&
        s.dataset.nameAudioCompleted==='true';
    },null,{timeout:15000});
    await page.waitForFunction(()=>window.__realHeartEvents.some(x=>
      x.kind==='approved-recording'&&x.src.endsWith('/site/audio/violet-heart-after-name.mp3')&&
      x.event==='playing'),null,{timeout:12000});
    await page.waitForFunction(()=>
      document.getElementById('environment').dataset.phase==='orientation',
      null,{timeout:16000});
    assert.equal(await page.locator('#name-form').isVisible(),false);
    assert.equal(await page.locator('#audio-failure').isVisible(),false);
    await page.screenshot({path:'artifacts/violet-real-heart-named-orientation.png'});
    await page.waitForFunction(()=>
      document.getElementById('environment').dataset.speechStatus==='completed',
      null,{timeout:30000});
    assert.equal(await page.locator('#violet-caption').innerText(),
      'Because the real difference begins with the operating system itself.');
    const result=await page.evaluate(()=>({
      audioEvents:window.__realHeartEvents,
      posesSeen:window.__posesSeen,
      deviceVoiceInvocations:window.__spokenByBrowserDevice,
      phase:document.getElementById('environment').dataset.phase,
      speechStatus:document.getElementById('environment').dataset.speechStatus,
      nameAudioCompleted:document.getElementById('environment').dataset.nameAudioCompleted
    }));
    assert.equal(result.deviceVoiceInvocations,0);
    assert.equal(await page.evaluate(()=>window.__audioPlayersConstructed),1,
      'Heart name and continuation must share the authorized media element');
    assert.equal(result.nameAudioCompleted,'true');
    assert.equal(result.phase,'presentation');
    assert.equal(result.speechStatus,'completed');
    assert.ok(result.posesSeen.length>=2,
      'Actual synthesized Heart audio must produce multiple observed mouth poses');
    assert.ok(result.audioEvents.some(x=>x.kind==='generated-name'&&x.event==='ended'));
    assert.ok(result.audioEvents.some(x=>x.kind==='approved-recording'&&
      x.src.endsWith('/site/audio/violet-heart-after-name.mp3')&&x.event==='ended'));
    assert.deepEqual(errors,[]);
    mkdirSync('artifacts',{recursive:true});
    writeFileSync('artifacts/heart-named-flow-observed.json',
      JSON.stringify({status:'qualified-Chromium-name-route',
        inferenceAndPlaybackDelayMs:Math.round(initializationElapsed),
        ...result},null,2)+'\n');
    console.log('ACTUAL NAMED HEART FLOW:',JSON.stringify({
      status:result.speechStatus,poses:result.posesSeen,
      audioEventCount:result.audioEvents.length,
      deviceTTS:result.deviceVoiceInvocations,
      inferenceAndPlaybackDelayMs:Math.round(initializationElapsed)
    }));
    await page.close();
  }finally{await browser.close();}
}finally{server.kill();}
