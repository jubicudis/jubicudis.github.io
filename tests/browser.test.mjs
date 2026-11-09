import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

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
const browserName=process.env.VIOLET_BROWSER||'chromium';
const browser=browserName==='webkit'
  ?await webkit.launch({headless:true})
  :await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
  for(const [label,width,height,named] of [
    ['desktop',1440,900,false],['mobile',390,844,false]
  ]){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    const errors=[];
    // Base QA verifies the real prerecorded skip path. Actual dynamic-name
    // synthesis is separately verified against the full HeadTTS model.
    // Browser QA uses real recorded Heart audio but a faster playback clock.
    // This changes TEST TIME only; production delivery remains natural speed.
    await page.addInitScript(()=>{
      window.__unexpectedBrowserTTS=0;
      window.__heartAudioSessions=[];
      window.__heartAudioEvents=[];
      window.__observedHeartPoses=[];
      document.addEventListener('DOMContentLoaded',()=>{
        const stage=document.getElementById('environment');
        if(!stage)return;
        const capture=()=>{
          const pose=stage.dataset.speechPose;
          if(pose&&!window.__observedHeartPoses.includes(pose))
            window.__observedHeartPoses.push(pose);
        };
        new MutationObserver(capture).observe(stage,{
          attributes:true,attributeFilter:['data-speech-pose']
        });
      },{once:true});
      const OriginalAudio=window.Audio;
      window.Audio=function(src){
        const audio=new OriginalAudio(src);
        // QA accelerates actual media playback; completion remains an actual
        // HTMLMediaElement ended event, never a synthetic success or timer.
        // Set accelerated test playback on each play after source assignment.
        // Replacing src can reset a media element's effective playback rate.
        const nativePlay=audio.play.bind(audio);
        audio.play=function(){
          audio.playbackRate=12;
          return nativePlay();
        };
        // Heart uses one persistent player; classify the active asset at
        // the actual media event, not at its constructor.
        const record=type=>window.__heartAudioEvents.push({
          track:audio.currentSrc||audio.src,type
        });
        audio.addEventListener('playing',()=>record('playing'));
        audio.addEventListener('ended',()=>record('ended'));
        window.__heartAudioSessions.push(audio);
        return audio;
      };
      const synthesis=window.speechSynthesis;
      if(synthesis&&typeof synthesis.speak==='function'){
        const original=synthesis.speak.bind(synthesis);
        synthesis.speak=function(...args){
          window.__unexpectedBrowserTTS++;
          return original(...args);
        };
      }
    });
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',message=>{
      if(message.type()==='error')errors.push(message.text());
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>
      ['observed','failed'].includes(document.querySelector('#environment').dataset.renderStatus),
      null,{timeout:20000});
    const status=await page.locator('#environment').getAttribute('data-render-status');
    assert.equal(status,'observed',JSON.stringify(errors));
    // The exact authored SVG contains all required expression parts.
    // Safari-safe XML attribute lookup must not report an existing part missing.
    const faceParts=await page.evaluate(async()=>{
      const xml=await (await fetch('/site/violet-face.svg')).text();
      const doc=new DOMParser().parseFromString(xml,'image/svg+xml');
      return Array.from(doc.getElementsByTagName('*'))
        .map(element=>element.getAttribute('id')).filter(Boolean);
    });
    for(const part of ['eye-smile','eye-open','eye-blink','mouth-smile',
      'mouth-speak','mouth-viseme-closed','mouth-viseme-open',
      'mouth-viseme-wide','mouth-viseme-round'])
      assert.ok(faceParts.includes(part),'authored Violet SVG part missing: '+part);
    try{
      await page.waitForFunction(()=>!document.querySelector('#violet-activate').disabled,null,{timeout:15000});
    }catch(error){
      const diagnostics=await page.evaluate(()=>({
        locale:navigator.language,
        languages:navigator.languages,
        renderStatus:document.querySelector('#environment')?.dataset.renderStatus,
        renderFailure:document.querySelector('#render-failure')?.textContent,
        audioFailure:document.querySelector('#audio-failure')?.textContent,
        activateDisabled:document.querySelector('#violet-activate')?.disabled
      }));
      throw new Error('Violet activation qualification failed: '+JSON.stringify({diagnostics,errors}),{cause:error});
    }
    assert.equal(await page.locator('#render-failure').isVisible(),false);
    assert.equal(await page.locator('#audio-failure').isVisible(),false);
    assert.equal(await page.locator('#violet-activate').isVisible(),true);
    assert.equal(await page.locator('#visitor-dialogue').isVisible(),false);
    assert.equal(await page.locator('button:visible').count(),1);
    assert.equal(await page.locator('nav, select, [role="tablist"], .card, .panel').count(),0);
    const rendering=await page.evaluate(()=>{
      const c=document.querySelector('#world'),gl=c.getContext('webgl2');
      return {webgl:!!gl&&!gl.isContextLost(),width:c.width,height:c.height};
    });
    assert.equal(rendering.webgl,true);
    assert.ok(rendering.width>0&&rendering.height>0);
    await page.screenshot({path:'artifacts/'+label+'-initial.png'});

    const greetingMedia=page.waitForResponse(response=>
      new URL(response.url()).pathname.endsWith('/site/audio/violet-heart-asking-name.mp3') &&
      [200,206].includes(response.status()),{timeout:15000});
    await page.locator('#violet-activate').click();
    await greetingMedia;
    assert.equal(await page.locator('#violet-caption').innerText(),"Hello, I'm Violet.");
    assert.equal(await page.locator('#name-form').isVisible(),false,
      'the visitor is not asked for a name before Violet has explained her role');
    await page.screenshot({path:'artifacts/'+label+'-greeting.png'});

    await page.waitForFunction(()=>{
      const stage=document.querySelector('#environment');
      const events=window.__heartAudioEvents;
      return stage.dataset.phase==='asking-name' &&
        stage.dataset.speechStatus==='completed' &&
        !document.querySelector('#name-form').hidden &&
        events.some(x=>new URL(x.track).pathname.endsWith('/violet-heart-asking-name.mp3')&&x.type==='playing') &&
        events.some(x=>new URL(x.track).pathname.endsWith('/violet-heart-asking-name.mp3')&&x.type==='ended');
    },null,{timeout:15000});
    assert.match(await page.locator('#violet-caption').innerText(),
      /may I ask what to call you\?/);
    assert.equal(await page.locator('#name-form').isVisible(),true);
    await page.screenshot({path:'artifacts/'+label+'-name-question.png'});

    const afterMedia=page.waitForResponse(response=>
      new URL(response.url()).pathname.endsWith('/site/audio/violet-heart-after-name.mp3')&&
      [200,206].includes(response.status()),{timeout:15000});
    if(named){
      await page.locator('#visitor-name').fill('Morgan');
      await page.locator('#name-confirm').click();
      assert.match(await page.locator('#violet-caption').innerText(),
        /^Welcome\. I'm glad you're here\./);
    }else{
      await page.locator('#name-skip').click();
      assert.match(await page.locator('#violet-caption').innerText(),
        /^Welcome\. I'm glad you're here\./);
    }
    await afterMedia;
    assert.equal(await page.locator('#name-form').isVisible(),false);
    await page.screenshot({path:'artifacts/'+label+'-welcome.png'});
    await page.waitForFunction(()=>{
      const a=window.__heartAudioSessions.at(-1);
      return a && !a.paused && Number.isFinite(a.duration) && a.duration>70;
    },null,{timeout:12000});
    await page.waitForFunction(()=>document.querySelector('#environment').dataset.phase==='orientation',
      null,{timeout:20000});
    const orientation=await page.locator('#violet-caption').innerText();
    assert.match(orientation,/TNOS|physical state|I'll begin|Workbench|MCP server|intended design|explain each part/);
    await page.screenshot({path:'artifacts/'+label+'-orientation.png'});
    await page.waitForFunction(()=>document.querySelector('#environment').dataset.phase==='presentation',
      null,{timeout:20000});
    const presentation=await page.locator('#violet-caption').innerText();
    assert.match(presentation,/begin|Imagine|desktop|interface|experience|representation|TNOS|difference|operating system/);
    await page.screenshot({path:'artifacts/'+label+'-presentation.png'});
    await page.waitForFunction(()=>document.querySelector('#environment').dataset.speechStatus==='completed',
      null,{timeout:24000});
    assert.equal(await page.locator('#violet-caption').innerText(),
      'Because the real difference begins with the operating system itself.');
    assert.equal(await page.locator('#audio-failure').isVisible(),false);
    assert.equal(await page.evaluate(()=>window.__unexpectedBrowserTTS),0);
    assert.equal(await page.evaluate(()=>window.__heartAudioSessions.length),1,
      'all prerecorded Heart segments must reuse the visitor-authorized media element');
    const acousticPoses=await page.evaluate(()=>window.__observedHeartPoses);
    assert.ok(acousticPoses.includes('viseme-closed'),
      'approved Heart narration must return to a closed mouth between real words');
    assert.ok(acousticPoses.some(p=>p==='viseme-open'||p==='viseme-wide'),
      'approved prerecorded Heart narration must visibly articulate from observed acoustic energy');
    assert.equal(await page.locator('nav, select, .card, .panel').count(),0);
    const bounds=await page.evaluate(()=>
      ({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
    assert.ok(bounds.scroll<=bounds.viewport+2,'horizontal overflow: '+JSON.stringify(bounds));
    assert.deepEqual(errors,[],'actual browser errors on '+label);
    await page.screenshot({path:'artifacts/'+label+'-presentation-end.png'});
    await page.close();
  }
  // A broken selected voice timeline does not invent narration success.
  const noTimeline=await browser.newPage({viewport:{width:390,height:844}});
  await noTimeline.route('**/site/audio/heart-timeline.json',route=>route.abort('failed'));
  await noTimeline.goto(base,{waitUntil:'domcontentloaded'});
  await noTimeline.waitForFunction(()=>document.querySelector('#environment').dataset.renderStatus==='observed',null,{timeout:20000});
  await noTimeline.waitForFunction(()=>!document.querySelector('#audio-failure').hidden,null,{timeout:12000});
  assert.equal(await noTimeline.locator('#violet-activate').isEnabled(),false);
  assert.equal(await noTimeline.locator('#audio-failure').isVisible(),true);
  await noTimeline.close();
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
  // A nonplanar vertex buffer alone did not make the A2 face look 3D.
  // Verify the actual live face uses normal-dependent shading and a rotated
  // curved assembly, not another flat unlit image projection.
  // Required renderer loss is a real failed state, not a hidden recovery.
  const recoverySource=await readFile(new URL('../site/violet-environment.mjs',import.meta.url),'utf8');
  assert.match(recoverySource,/onFailure\?\.\(error\)/);
  assert.match(recoverySource,/failed=true;live=false;observed=false/);
  assert.doesNotMatch(recoverySource,/addEventListener\('webglcontextrestored'/);
  assert.ok(recoverySource.includes("antialias:false,alpha:false,powerPreference:'low-power'"));
  assert.ok(recoverySource.includes('renderer.setPixelRatio(1)'));
  assert.ok(recoverySource.includes('canvas.width=320;canvas.height=220'));
  assert.ok(recoverySource.includes('texture.generateMipmaps=false'));
  const controllerSource=await readFile(new URL('../site/experience.mjs',import.meta.url),'utf8');
  const reducerSource=await readFile(new URL('../site/opening-state.mjs',import.meta.url),'utf8');
  const voiceSource=await readFile(new URL('../site/violet-voice.mjs',import.meta.url),'utf8');
  assert.match(controllerSource,/NAME_SYNTHESIS_READY/);
  assert.match(controllerSource,/NAME_INSERTION_REQUESTED/);
  assert.doesNotMatch(controllerSource,/nameInsertionActive|nameInsertionDone|authoredNarrationEnded/);
  assert.match(reducerSource,/next\.visualExpression=/);
  assert.match(recoverySource,/const mode=state\.visualExpression/);
  assert.doesNotMatch(recoverySource,/Promise\.all\(\[\s*loadRequiredImage/,
    'iOS must not perform simultaneous A2 SVG image decodes');
  assert.match(recoverySource,/const faceXml=await faceResponse\.text\(\)/);
  assert.match(recoverySource,/const visemeWide=await svgTexture\(faceXml,'viseme-wide'\)/);

  assert.match(recoverySource,/motionCapabilities\.apply\(smoothed\)/,
    'observed Heart body motion must reach the real structural rig through continuous coupling');
  assert.match(recoverySource,/motionTarget=next\.bloomMotion/,
    'renderer must use reducer-authorized motion as its only target');
  assert.match(recoverySource,/faceAssembly\.position\.set\(cx\+center\.x,cy\+center\.y/,
    'faceplate must follow the same material displacement as the body');
  assert.match(recoverySource,/centerSurface:visualCapabilities\.getCenterSurface\(\)/,
    'the actual A2 center material must share the ribbon deformation field');
  assert.match(recoverySource,/updateFaceAttachments\(\)/,
    'physical junctions must follow the same deformed body and faceplate');
  assert.match(recoverySource,/ribbonVertex:nearestRibbonVertex\(spec\.body\)/,
    'face junctions must bind to vertices of the actual structural ribbon mesh');
  assert.match(recoverySource,/ribbonPositions\.getX\(attachment\.ribbonVertex\)/,
    'junctions must read observed deformed ribbon geometry, not independent approximations');
  assert.match(recoverySource,/attr\.needsUpdate=true;\s*mesh\.geometry\.computeBoundingSphere\(\)/,
    'outward ribbon material must propagate through its existing geometry buffer');
  assert.match(recoverySource,/rim\.set\(rx\*\.87\*Math\.cos\(angle\)/,
    'ribbon root must originate underneath the actual faceplate perimeter');
  assert.match(recoverySource,/const width=\.035\+\.13\*t/,
    'ribbon connection must broaden outward into the body, not pull a thin rod inward');
  assert.doesNotMatch(recoverySource,/new THREE\.TubeGeometry\(curve,18/,
    'old competing inward tube connectors must not return');
  assert.doesNotMatch(recoverySource,/mesh\.geometry\.dispose\(\);\s*mesh\.geometry=next/,
    'no GPU mesh replacement on every propagated motion update');
  assert.match(recoverySource,/character\.position\.y=lift\*\.12/,
    'whole-body lift must derive from the qualified four-point field');
  assert.match(recoverySource,/character\.rotation\.z=\(smoothed\[1\]\.y-smoothed\[0\]\.y\)\*\.025/,
    'whole-body tilt must derive from the same field');
  assert.doesNotMatch(recoverySource,/character\.position\.y=reduced\.matches/,
    'an independent renderer clock must not drive character floating');
  assert.match(recoverySource,/onAnimationFrame\(Object\.freeze\(/,
    'renderer must report observed frame evidence rather than invent idle motion');
  assert.doesNotMatch(recoverySource,/motionCapabilities\.apply\(\[/,
    'renderer must not independently calculate idle A2 deformation');
  assert.match(controllerSource,/type:'IDLE_FRAME_OBSERVED'/);
  assert.match(controllerSource,/voice\.holdAuthoredForName\(state\.speechToken\)/,
    'the approved name seam must hold the actual Heart player until synthesized speech is ready');
  assert.match(controllerSource,/pendingNameBoundary!==null&&ready\.nameSlotObserved/,
    'name generation completion must use an observed insertion boundary');
  assert.match(controllerSource,/if\(current\.nameSynthesisStatus==='ready'\)/,
    'only qualified synthesis can start the generated line after the seam is held');
  assert.match(controllerSource,/pendingNameBoundary=resumeAtMs/,
    'the exact observed hold position is retained for continuation');
  assert.doesNotMatch(controllerSource,/state\.nameSynthesisStatus==='ready'\)\{/,
    'frame observation must not wait for synthesis readiness to notice the seam');
  assert.match(controllerSource,/cue\.index!==VISITOR_NAME_SLOT\.beforeCueIndex\)return/,
    'later narration cues must never become substitute name seams');
  assert.doesNotMatch(controllerSource,/observation\.elapsedMs-seamMs>250/,
    'Safari coarse playback clocks must not silently discard the only approved name seam');
  assert.match(controllerSource,/if\(observation\.elapsedMs<seamMs\)return/,
    'only observed media position at the authorized cue can hold the name seam');
  assert.match(controllerSource,/continueAfterGenerated:true/,
    'return to recorded Heart must preserve the current narration session');
  assert.match(controllerSource,/if\(observedClock\)observeAuthoredPosition\(observedClock\)/,
    'sample the actual Heart audio clock during the existing scene frame');
  assert.match(controllerSource,/if\(observation\)localizedFrameObserver\(observation\)/,
    'localized PCM expression must follow the same observed scene-frame clock');
  assert.match(controllerSource,/localizedFrameObserver=onPosition/,
    'localized clip must own its active audio observation callback');
  assert.match(controllerSource,/const resumeAtMs=observation\.elapsedMs/,
    'Heart narration must resume at its observed position, not replay the cue');
  assert.match(controllerSource,/cueIndex:VISITOR_NAME_SLOT\.beforeCueIndex/,
    'coarse WebKit clock updates must not lose the authorized name seam');
  assert.match(reducerSource,/case 'NAME_SLOT_OBSERVED':/,
    'the name slot must be a qualified state observation');
  assert.match(voiceSource,/function holdAuthoredForName\(token\)/);
  assert.match(reducerSource,/case 'IDLE_FRAME_OBSERVED':/);
  assert.match(reducerSource,/next\.bodyMotionMode=/);
  assert.match(reducerSource,/next\.bloomMotion=event\.type==='IDLE_FRAME_OBSERVED'/,
    'only scene-frame flow is authorized to change the ribbon field');
  assert.doesNotMatch(reducerSource,/bloomFromObservedAudio/,
    'audio energy must not control the ribbon geometry');
  assert.match(recoverySource,/const mouthFrames=Object\.freeze\(\[0,\.22,\.5,\.78,1\]\)/,
    'speech mouth changes must render intermediate opening and closing frames');
  assert.match(recoverySource,/const opening1=await svgTexture\(faceXml,'viseme-opening-1'\)/,
    'first intermediate mouth aperture must be authored and decoded');
  assert.match(recoverySource,/const opening2=await svgTexture\(faceXml,'viseme-opening-2'\)/,
    'second intermediate mouth aperture must be authored and decoded');
  assert.match(recoverySource,/\['viseme-closed','viseme-opening-1','viseme-opening-2',visualMode\]/,
    'opening must progress from closed through intermediate apertures');
  assert.match(recoverySource,/\[previousExpression,'viseme-opening-2','viseme-opening-1','viseme-closed'\]/,
    'closing must progress through intermediate apertures in reverse');
  assert.match(recoverySource,/expressionBlend\.material\.opacity=alpha/,
    'intermediate mouth frames must be applied to the curved A2 faceplate');
  assert.match(recoverySource,/state\.bodyMotionMode==='flow'/,
    'ribbon flow must remain active during narration');
  const faceVolume=await probe.evaluate(()=>{
    const scene=window.__visualProbe.visualCapabilities.readFaceplateEvidence();
    return scene;
  });
  assert.equal(faceVolume.material,'MeshPhongMaterial');
  assert.ok(faceVolume.depth>.5);
  assert.ok(faceVolume.rotationY>.1);
  assert.ok(faceVolume.normalZRange>.2);

  await probe.waitForTimeout(200);
  const baseline=await probe.screenshot({path:'artifacts/renderer-capability-approved-a2.png'});
  await probe.evaluate(async()=>{
    window.__baselinePixels=await window.__visualProbe.visualObservation.captureNextFrame({
      token:3001,columns:32,rows:32
    });
  });
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
  if(process.env.VIOLET_BROWSER==='webkit'){
    // WebKit can produce different compositor screenshots for the same
    // WebGL frame. Compare actual observed WebGL pixels instead of a
    // screenshot's unrelated browser-compositor bytes.
    await probe.evaluate(async()=>{
      window.__restoredPixels=await window.__visualProbe.visualObservation.captureNextFrame({
        token:3002,columns:32,rows:32
      });
    });
    const comparison=await probe.evaluate(()=>
      window.__visualProbe.visualObservation.compare(
        window.__baselinePixels,window.__restoredPixels,{
          threshold:8,minimumDifferent:2
        }
      ));
    assert.equal(comparison.qualified,false,
      'A2 full presence must restore the actual WebGL image in WebKit');
  }else{
    assert.equal(restored.equals(baseline),true,
      'A2 full presence must remain unchanged pixel-for-pixel');
  }

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
  if(process.env.VIOLET_BROWSER==='webkit'){
    await probe.evaluate(async()=>{
      window.__rigResetPixels=await window.__visualProbe.visualObservation.captureNextFrame({
        token:3003,columns:32,rows:32
      });
    });
    const resetChange=await probe.evaluate(()=>
      window.__visualProbe.visualObservation.compare(
        window.__restoredPixels,window.__rigResetPixels,{threshold:8,minimumDifferent:2}
      ));
    assert.equal(resetChange.qualified,false,
      'four-strand reset must restore observed WebGL geometry in WebKit');
  }else{
    assert.equal(rigReset.equals(restored),true,
      'resetting the four-strand rig must preserve the approved A2 appearance');
  }

  await probe.evaluate(()=>window.__visualProbe.visualCapabilities.setExpressionOverride('viseme-round'));
  await probe.waitForTimeout(200);
  const viseme=await probe.screenshot({path:'artifacts/renderer-capability-authored-viseme.png'});
  assert.equal(viseme.equals(restored),false,'real authored viseme SVG must render');
  await probe.evaluate(()=>window.__visualProbe.visualCapabilities.setExpressionOverride(null));
  await probe.waitForTimeout(200);
  if(process.env.VIOLET_BROWSER==='webkit'){
    await probe.evaluate(async()=>{
      window.__expressionResetPixels=await window.__visualProbe.visualObservation.captureNextFrame({
        token:3004,columns:32,rows:32
      });
    });
    const expressionChange=await probe.evaluate(()=>
      window.__visualProbe.visualObservation.compare(
        window.__restoredPixels,window.__expressionResetPixels,{
          threshold:8,minimumDifferent:2
        }
      ));
    assert.equal(expressionChange.qualified,false,
      'removing viseme must restore actual approved A2 WebGL expression');
  }else{
    assert.equal((await probe.screenshot()).equals(restored),true,
      'removing the viseme request must restore the approved original expression');
  }
  assert.equal(await probe.locator('#environment').getAttribute('data-phase'),'dormant',
    'capabilities may not select presentation behaviors');
  assert.deepEqual(probeErrors,[],'capability renderer must not throw browser errors');
  await probe.evaluate(()=>window.__visualProbe.dispose());
  await probe.close();
  console.log('Verified A2 opening and independent render capabilities without any user trigger or scheduled behavior.');
}finally{await browser.close();server.kill();}
