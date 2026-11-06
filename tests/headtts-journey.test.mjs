// Real user journey: Chromium loads HeadTTS, synthesizes the visitor's
// voluntary name with selected Heart, observes actual audio and facial cue
// changes, then plays the approved Heart orientation. No mocked synthesis,
// manually dispatched presentation events, fallback audio, or fake timers.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const server=spawn('python3',['-m','http.server','4179','--bind','127.0.0.1'],{stdio:'ignore'});
const base='http://127.0.0.1:4179/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  let responding=false;
  for(let i=0;i<80;i++){
    try{const r=await fetch(base);if(r.ok){responding=true;break;}}catch{}
    await sleep(200);
  }
  assert.equal(responding,true,'static site must serve actual files');
  const browser=await chromium.launch({headless:true,
    args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},
      reducedMotion:'reduce'});
    page.setDefaultTimeout(120000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.__heartEvents=[];
      window.__heartPoses=[];
      window.__unexpectedBrowserTTS=0;
      const OriginalAudio=window.Audio;
      window.Audio=function(src){
        const media=new OriginalAudio(src);
        // Accelerate only static authored files, preserving actual browser
        // ended events. Play the real synthesized name at natural speed.
        if(!String(src).startsWith('blob:'))media.playbackRate=12;
        for(const event of ['playing','ended','error']){
          media.addEventListener(event,()=>window.__heartEvents.push({
            event,src:String(src),currentTime:media.currentTime,
            duration:media.duration
          }));
        }
        return media;
      };
      const synthesis=window.speechSynthesis;
      if(synthesis&&typeof synthesis.speak==='function'){
        const nativeSpeak=synthesis.speak.bind(synthesis);
        synthesis.speak=(...args)=>{
          window.__unexpectedBrowserTTS++;
          return nativeSpeak(...args);
        };
      }
      document.addEventListener('DOMContentLoaded',()=>{
        const stage=document.getElementById('environment');
        if(!stage)return;
        const capture=()=>{
          const pose=stage.dataset.speechPose;
          if(pose&&!window.__heartPoses.some(x=>x.pose===pose)){
            window.__heartPoses.push({pose,time:performance.now()});
          }
        };
        new MutationObserver(capture).observe(stage,{
          attributes:true,attributeFilter:['data-speech-pose']
        });
      },{once:true});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{
      const stage=document.querySelector('#environment');
      return stage?.dataset.renderStatus==='observed' &&
        !document.getElementById('violet-activate').disabled;
    },null,{timeout:30000});
    await page.locator('#violet-activate').click();
    await page.waitForFunction(()=>document.querySelector('#environment')?.dataset.speechStatus==='completed' &&
      !document.getElementById('name-form').hidden,null,{timeout:30000});
    const caption=await page.locator('#violet-caption').innerText();
    assert.match(caption,/may I ask what to call you/);
    await page.locator('#visitor-name').fill('Morgan');
    await page.locator('#name-confirm').click();
    assert.match(await page.locator('#violet-caption').innerText(),/^Welcome, Morgan/);
    // While generation is pending, the presentation must not move ahead to
    // orientation and the generic prerecording cannot be substituted.
    const pending=await page.evaluate(()=>({
      speech:document.querySelector('#environment').dataset.speechStatus,
      phase:document.querySelector('#environment').dataset.phase,
      events:window.__heartEvents.filter(x=>x.src.includes('after-name.mp3'))
    }));
    assert.equal(pending.phase,'welcome');
    assert.equal(pending.speech,'pending');
    assert.equal(pending.events.length,0);
    await page.waitForFunction(()=>window.__heartEvents.some(x=>
      x.src.startsWith('blob:')&&x.event==='playing'),null,{timeout:220000});
    await page.waitForFunction(()=>window.__heartEvents.some(x=>
      x.src.startsWith('blob:')&&x.event==='ended'),null,{timeout:30000});
    const generatedEnd=await page.evaluate(()=>({
      nameComplete:document.querySelector('#environment').dataset.nameAudioCompleted,
      poseCount:window.__heartPoses.length,
      poses:window.__heartPoses,
      media:window.__heartEvents.filter(x=>x.src.startsWith('blob:'))
    }));
    assert.equal(generatedEnd.nameComplete,'true');
    assert.ok(generatedEnd.poses.length>=2,
      'actual synthesized speech must change facial poses');
    assert.ok(generatedEnd.poses.some(x=>x.pose==='viseme-open'||x.pose==='viseme-wide'||x.pose==='viseme-round'),
      'real generated phonemes should produce articulated mouth expressions');
    await page.waitForFunction(()=>window.__heartEvents.some(x=>
      x.src.endsWith('/site/audio/violet-heart-post-welcome.mp3')&&x.event==='playing'),
      null,{timeout:15000});
    await page.waitForFunction(()=>
      document.querySelector('#environment').dataset.phase==='orientation',
      null,{timeout:25000});
    await page.waitForFunction(()=>
      document.querySelector('#environment').dataset.phase==='presentation',
      null,{timeout:30000});
    await page.waitForFunction(()=>
      document.querySelector('#environment').dataset.speechStatus==='completed',
      null,{timeout:25000});
    const result=await page.evaluate(()=>({
      nameCompleted:document.querySelector('#environment').dataset.nameAudioCompleted,
      speechStatus:document.querySelector('#environment').dataset.speechStatus,
      phase:document.querySelector('#environment').dataset.phase,
      caption:document.getElementById('violet-caption').textContent,
      poses:window.__heartPoses,
      events:window.__heartEvents,
      unexpectedBrowserTTS:window.__unexpectedBrowserTTS
    }));
    assert.equal(result.nameCompleted,'true');
    assert.equal(result.speechStatus,'completed');
    assert.equal(result.phase,'presentation');
    assert.equal(result.caption,
      'Because the real difference begins with the operating system itself.');
    assert.equal(result.unexpectedBrowserTTS,0);
    assert.equal(result.events.filter(x=>
      x.src.includes('violet-heart-after-name.mp3')).length,0);
    assert.ok(result.events.some(x=>x.src.startsWith('blob:')&&x.event==='ended'));
    assert.ok(result.events.some(x=>x.src.endsWith('violet-heart-post-welcome.mp3')&&x.event==='ended'));
    assert.deepEqual(errors,[]);
    mkdirSync('artifacts',{recursive:true});
    writeFileSync('artifacts/violet-name-real-journey.json',
      JSON.stringify({status:'observed-real-named-Heart-journey',
        ...result},null,2)+'\n');
    await page.screenshot({path:'artifacts/violet-name-real-journey.png'});
    console.log('CONFIRMED NAMED HEART JOURNEY',
      JSON.stringify({poses:result.poses.map(x=>x.pose),
        eventCount:result.events.length,status:result.speechStatus}));
  }finally{await browser.close();}
}finally{server.kill();}
