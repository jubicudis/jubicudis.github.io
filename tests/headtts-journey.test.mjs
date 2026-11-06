// Real user journey: Chromium loads HeadTTS, synthesizes the visitor's
// voluntary name with selected Heart, observes actual audio and facial cue
// changes, then plays the approved Heart orientation. No mocked synthesis,
// manually dispatched presentation events, fallback audio, or fake timers.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';

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
  const browser=process.env.VIOLET_BROWSER==='webkit'
    ?await webkit.launch({headless:true})
    :await chromium.launch({headless:true,
      args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},
      reducedMotion:'reduce',
      ...(process.env.VIOLET_BROWSER==='webkit'?{
        userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
      }:{})});
    page.setDefaultTimeout(120000);
    const errors=[];
    const nameCaptionObservations=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.__heartEvents=[];
      window.__heartPoses=[];
      window.__unexpectedBrowserTTS=0;
      const OriginalAudio=window.Audio;
      window.__audioPlayersConstructed=0;
      window.Audio=function(src){
        const media=new OriginalAudio(src);
        window.__audioPlayersConstructed++;
        // The app retains one gesture-authorized audio element. Rate and
        // source identity must be evaluated at playback, not construction.
        const nativePlay=media.play.bind(media);
        media.play=function(){
          media.playbackRate=String(media.src).startsWith('blob:')?1:(String(media.src).includes('asking-name')?12:1);
          return nativePlay();
        };
        for(const event of ['playing','ended','error']){
          media.addEventListener(event,()=>window.__heartEvents.push({
            event,src:media.currentSrc||media.src,
            currentTime:media.currentTime,duration:media.duration
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
    assert.match(await page.locator('#violet-caption').innerText(),/^Welcome\. I'm glad you're here/);
    // The approved Heart track begins immediately while the name is
    // synthesized in parallel; no blank waiting screen is authorized.
    await page.waitForFunction(()=>window.__heartEvents.some(x=>
      x.src.endsWith('/site/audio/violet-heart-after-name.mp3')&&
      x.event==='playing'),null,{timeout:15000});
    assert.equal(await page.locator('#violet-caption').innerText(),
      "Welcome. I'm glad you're here.");
    await page.waitForFunction(()=>window.__heartEvents.some(x=>
      x.src.startsWith('blob:')&&x.event==='playing'),null,{timeout:220000});
    nameCaptionObservations.push(await page.locator('#violet-caption').innerText());
    assert.equal(nameCaptionObservations[0],"Morgan, let's continue.");
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
      x.src.endsWith('/site/audio/violet-heart-after-name.mp3')&&x.event==='playing'),
      null,{timeout:15000});
    await page.waitForFunction(()=>
      document.querySelector('#environment').dataset.phase==='orientation',
      null,{timeout:25000});
    await page.waitForFunction(()=>
      document.querySelector('#environment').dataset.phase==='presentation',
      null,{timeout:30000});
    await page.waitForFunction(()=>
      document.querySelector('#environment').dataset.speechStatus==='completed',
      null,{timeout:180000});
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
    assert.equal(await page.evaluate(()=>window.__audioPlayersConstructed),1,
      'real named visitor journey must reuse the already authorized media element');
    assert.ok(result.events.filter(x=>
      x.src.includes('violet-heart-after-name.mp3')).length>0);
    assert.ok(result.events.some(x=>x.src.startsWith('blob:')&&x.event==='ended'));
    assert.ok(result.events.some(x=>x.src.endsWith('violet-heart-after-name.mp3')&&x.event==='ended'));
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
