import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const server=spawn('python3',['-m','http.server','4174','--bind','127.0.0.1'],{stdio:'ignore'});
const base='http://127.0.0.1:4174/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
mkdirSync('artifacts',{recursive:true});
let response;
for(let i=0;i<50;i++){
  try{response=await fetch(base);if(response.ok)break;}catch{}
  await sleep(200);
}
assert.equal(response?.ok,true,'Static website must serve its index');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
  for(const [label,width,height,named] of [['desktop',1440,900,true],['mobile',390,844,false]]){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    const errors=[];
    await page.addInitScript(()=>{
      window.__unexpectedBrowserTTS=0;
      const synthesizer=window.speechSynthesis;
      if(synthesizer&&typeof synthesizer.speak==='function'){
        const nativeSpeak=synthesizer.speak.bind(synthesizer);
        synthesizer.speak=function(...args){
          window.__unexpectedBrowserTTS++;
          return nativeSpeak(...args);
        };
      }
    });
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>['observed','failed'].includes(document.querySelector('#environment').dataset.renderStatus),null,{timeout:20000});
    const actualStatus=await page.evaluate(()=>({status:document.querySelector('#environment').dataset.renderStatus,error:document.querySelector('#render-failure').textContent,canvas:{width:document.querySelector('#world').width,height:document.querySelector('#world').height}}));
    assert.equal(actualStatus.status,'observed','Violet renderer must produce evidence: '+JSON.stringify(actualStatus)+' console: '+JSON.stringify(errors));
    assert.equal(await page.locator('#render-failure').isVisible(),false);
    assert.equal(await page.locator('#violet-activate').isEnabled(),true);
    assert.equal(await page.locator('#violet-activate').isVisible(),true);
    assert.equal(await page.locator('#visitor-dialogue').isVisible(),false);
    assert.equal(await page.locator('button:visible').count(),1);
    assert.equal(await page.locator('nav, select, [role="tablist"], .card, .panel').count(),0);
    const rendering=await page.evaluate(()=>{
      const c=document.querySelector('#world'),gl=c.getContext('webgl2');
      return {webgl:!!gl&&!gl.isContextLost(),width:c.width,height:c.height};
    });
    assert.equal(rendering.webgl,true,'Real Three.js WebGL2 instead of a fallback');
    assert.ok(rendering.width>0&&rendering.height>0);
    await page.screenshot({path:'artifacts/'+label+'-initial.png'});
    const greetingMedia=page.waitForResponse(r=>
      r.url().endsWith('/site/audio/violet-heart-asking-name.m4a')&&r.status()>=200&&r.status()<300,
      {timeout:15000});
    await page.locator('#violet-activate').click();
    await greetingMedia;
    assert.equal(await page.locator('#violet-caption').innerText(),"Hello, I'm Violet. What is your name?");
    assert.ok(await page.locator('#name-form').isVisible());
    await page.screenshot({path:'artifacts/'+label+'-greeting.png'});
    const welcomeMedia=page.waitForResponse(r=>
      r.url().endsWith('/site/audio/violet-heart-welcome.m4a')&&r.status()>=200&&r.status()<300,
      {timeout:15000});
    if(named){
      await page.locator('#visitor-name').fill('Morgan');
      await page.locator('#name-confirm').click();
      assert.match(await page.locator('#violet-caption').innerText(),/^Welcome, Morgan\./);
    }else{
      await page.locator('#name-skip').click();
      assert.match(await page.locator('#violet-caption').innerText(),/^Welcome\./);
    }
    await welcomeMedia;
    assert.equal(await page.evaluate(()=>window.__unexpectedBrowserTTS),0,
      'Violet must not silently substitute a different device voice');
    const welcome=await page.locator('#violet-caption').innerText();
    assert.match(welcome,/Tranquility Neuro Operating System/);
    assert.match(welcome,/Workbench/);
    assert.match(welcome,/separate MCP server/);
    assert.equal(await page.locator('#name-form').isVisible(),false);
    assert.equal(await page.locator('nav, select, .card, .panel').count(),0);
    const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
    assert.ok(bounds.scroll<=bounds.viewport+2,'horizontal overflow: '+JSON.stringify(bounds));
    // The delivered engine is available on both viewports; the established
    // opening still selects when to speak, not the voice renderer.
    const voiceAudit=await page.evaluate(async()=>{
      const m=await import('./site/violet-voice.mjs');
      return {profile:m.BROWSER_VOICE_PROFILE,
        chosen:m.chooseAvailableVoice([{name:'Enhanced demo',lang:'en-US',voiceURI:'en-test',default:false}])?.voiceURI};
    });
    assert.equal(voiceAudit.profile.pitch,1);
    assert.equal(voiceAudit.chosen,'en-test');
    assert.deepEqual(errors,[],'browser errors on '+label);
    await page.screenshot({path:'artifacts/'+label+'-welcome.png'});
    await page.close();
  }
  // A missing required SVG must not be silently replaced with another face or renderer.
  const failedPage=await browser.newPage({viewport:{width:390,height:844}});
  await failedPage.route('**/site/violet-face.svg',route=>route.abort('failed'));
  await failedPage.goto(base,{waitUntil:'domcontentloaded'});
  await failedPage.waitForFunction(()=>document.querySelector('#environment').dataset.renderStatus==='failed',null,{timeout:12000});
  assert.equal(await failedPage.locator('#violet-activate').isEnabled(),false);
  assert.equal(await failedPage.locator('#visitor-dialogue').isVisible(),false);
  assert.equal(await failedPage.locator('#render-failure').isVisible(),true);
  assert.match(await failedPage.locator('#render-failure').innerText(),/Violet could not be rendered/);
  assert.equal(await failedPage.locator('#environment').getAttribute('data-phase'),'dormant');
  await failedPage.close();
  const failedArt=await browser.newPage({viewport:{width:390,height:844}});
  await failedArt.route('**/site/violet-a2-art.webp',route=>route.abort('failed'));
  await failedArt.goto(base,{waitUntil:'domcontentloaded'});
  await failedArt.waitForFunction(()=>document.querySelector('#environment').dataset.renderStatus==='failed',null,{timeout:12000});
  assert.equal(await failedArt.locator('#violet-activate').isEnabled(),false);
  assert.equal(await failedArt.locator('#visitor-dialogue').isVisible(),false);
  assert.equal(await failedArt.locator('#render-failure').isVisible(),true);
  assert.equal(await failedArt.locator('#environment').getAttribute('data-phase'),'dormant');
  await failedArt.close();
  // Renderer-only capability probe. This test deliberately requests appearance
  // channels without changing presentation state, creating visitor controls,
  // choosing a trigger, or scripting animation duration.
  const probe=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'});
  const probeErrors=[];
  probe.on('pageerror',error=>probeErrors.push(error.message));
  await probe.goto(base,{waitUntil:'domcontentloaded'});
  const accepted=await probe.evaluate(async()=>{
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:50;pointer-events:none';
    document.body.append(canvas);
    const {createVioletEnvironment}=await import('./site/violet-environment.mjs');
    window.__visualProbe=await createVioletEnvironment(canvas);
    return window.__visualProbe.visualCapabilities.readRequested();
  });
  assert.deepEqual(accepted,{structure:1,center:1,environment:1,features:1});
  await probe.waitForTimeout(200);
  const baseline=await probe.screenshot({path:'artifacts/renderer-capability-approved-a2.png'});
  const requested=await probe.evaluate(()=>{
    const v=window.__visualProbe.visualCapabilities;
    v.apply({structure:0,center:1,environment:1,features:0});
    return v.readRequested();
  });
  assert.deepEqual(requested,{structure:0,center:1,environment:1,features:0});
  assert.equal(await probe.locator('#environment').getAttribute('data-phase'),'dormant',
    'capability calls must never advance website behavior');
  await probe.waitForTimeout(200);
  const separated=await probe.screenshot({path:'artifacts/renderer-capability-separated-center.png'});
  assert.equal(baseline.equals(separated),false,
    'the actual rendered scene must change under an explicit channel request');
  // Renderer-only material selection; no user control or timing/behavior is assigned.
  await probe.evaluate(()=>window.__visualProbe.visualCapabilities.apply({
    structure:0,center:0,environment:1,features:0
  }));
  await probe.waitForTimeout(250);
  const environmentOnly=await probe.screenshot({path:'artifacts/renderer-capability-environment-only.png'});
  await probe.evaluate(()=>window.__visualProbe.visualCapabilities.apply({
    structure:0,center:0,environment:0,features:0
  }));
  await probe.waitForTimeout(250);
  const allOff=await probe.screenshot({path:'artifacts/renderer-capability-all-materials-hidden.png'});
  assert.equal(environmentOnly.equals(allOff),false,
    'visible environmental artwork and lights require a separate render channel');
  await probe.evaluate(()=>window.__visualProbe.visualCapabilities.apply({
    structure:1,center:1,environment:0,features:1
  }));
  await probe.waitForTimeout(250);
  const withoutEnvironment=await probe.screenshot({
    path:'artifacts/renderer-capability-character-without-floor.png'
  });
  assert.equal(withoutEnvironment.equals(baseline),false,
    'floor lighting must actually disappear without removing Violet');
  assert.equal(withoutEnvironment.equals(allOff),false,
    'character remains on screen independently of floor lighting');
  assert.equal(await probe.locator('#environment').getAttribute('data-phase'),'dormant',
    'direct renderer changes must not advance presentation state');
  await probe.evaluate(()=>{
    window.__visualProbe.visualCapabilities.apply({
      structure:1,center:1,environment:1,features:1
    });
  });
  await probe.waitForTimeout(200);
  const restored=await probe.screenshot({path:'artifacts/renderer-capability-restored-a2.png'});
  assert.equal(restored.equals(baseline),true,
    'A2 full presence must remain unchanged pixel-for-pixel');

  // Explicit renderer capability requests. No presentation event, mood, or
  // visitor action may be created by these calls.
  const baselineObserved=await probe.evaluate(async()=>{
    const sample=await window.__visualProbe.visualObservation.captureNextFrame({
      token:1001,columns:32,rows:32
    });
    window.__captureBeforeMotion=sample;
    return {type:sample.type,saturatedSamples:sample.saturatedSamples};
  });
  assert.equal(baselineObserved.type,'bounded-webgl-pixels');
  assert.ok(baselineObserved.saturatedSamples>1);

  const deformed=await probe.evaluate(()=>{
    const rig=window.__visualProbe.motionCapabilities;
    const result=rig.apply([
      {x:.19,y:-.06},{x:0,y:.16},{x:-.07,y:0},{x:.02,y:-.10}
    ]);
    return {active:result.active,length:rig.readRequested().length};
  });
  assert.deepEqual(deformed,{active:true,length:4});
  await probe.waitForTimeout(200);
  const deformedScreenshot=await probe.screenshot({
    path:'artifacts/renderer-capability-quad-deformation.png'});
  assert.equal(deformedScreenshot.equals(restored),false,
    'coupled four-strand deformation must alter actual rendered geometry');

  const evidence=await probe.evaluate(async()=>{
    const obs=window.__visualProbe.visualObservation;
    const moved=await obs.captureNextFrame({token:1002,columns:32,rows:32});
    return obs.compare(window.__captureBeforeMotion,moved,{
      threshold:6,minimumDifferent:2
    });
  });
  assert.equal(evidence.type,'webgl-change-observed');
  assert.equal(evidence.qualified,true,'observed pixels must differ after geometry deformation');
  assert.equal(evidence.fromToken,1001);
  assert.equal(evidence.toToken,1002);

  await probe.evaluate(()=>window.__visualProbe.motionCapabilities.reset());
  await probe.waitForTimeout(200);
  const rigReset=await probe.screenshot({path:'artifacts/renderer-capability-rig-restored.png'});
  assert.equal(rigReset.equals(restored),true,
    'resetting the four-strand rig must preserve the approved A2 appearance');

  await probe.evaluate(()=>window.__visualProbe.visualCapabilities.setExpressionOverride('viseme-round'));
  await probe.waitForTimeout(200);
  const viseme=await probe.screenshot({path:'artifacts/renderer-capability-authored-viseme.png'});
  assert.equal(viseme.equals(restored),false,'real authored viseme SVG must render');
  await probe.evaluate(()=>window.__visualProbe.visualCapabilities.setExpressionOverride(null));
  await probe.waitForTimeout(200);
  assert.equal((await probe.screenshot()).equals(restored),true,
    'removing the viseme request must restore the approved original expression');
  assert.equal(await probe.locator('#environment').getAttribute('data-phase'),'dormant',
    'capabilities may not select presentation behaviors');
  assert.deepEqual(probeErrors,[],'capability renderer must not throw browser errors');
  await probe.evaluate(()=>window.__visualProbe.dispose());
  await probe.close();
  console.log('Verified A2 opening and independent render capabilities without any user trigger or scheduled behavior.');
}finally{await browser.close();server.kill();}
