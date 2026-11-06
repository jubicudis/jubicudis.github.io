import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const server=spawn('python3',['-m','http.server','4174','--bind','127.0.0.1'],{stdio:'ignore'});
const base='http://127.0.0.1:4174/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const screenshots='artifacts';
mkdirSync(screenshots,{recursive:true});
let response;
for(let i=0;i<50;i++){
  try{response=await fetch(base);if(response.ok)break;}catch{}
  await sleep(200);
}
assert.equal(response?.ok,true,'The real static website must serve its index');
const browser=await chromium.launch({headless:true});
try{
  for(const [label,width,height,named] of [['desktop',1440,900,true],['mobile',390,844,false]]){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#violet-activate').isVisible(),true);
    assert.equal(await page.locator('#visitor-dialogue').isVisible(),false);
    assert.equal(await page.locator('button:visible').count(),1,'Violet alone is the initial control');
    assert.equal(await page.locator('nav, select, [role="tablist"], .card, .panel').count(),0,'no conventional website substitute');
    const initialPixels=await page.evaluate(()=>{
      const c=document.querySelector('#world'),ctx=c.getContext('2d'),w=c.width,h=c.height;
      const region=ctx.getImageData(w*.32,h*.25,w*.36,h*.38).data;
      let vivid=0;
      for(let k=0;k<region.length;k+=4){if(region[k]>80&&region[k+1]>55&&region[k+2]>130)vivid++;}
      return vivid;
    });
    assert.ok(initialPixels>200,'the character is physically drawn into the canvas, not only declared in DOM');
    await page.screenshot({path:`${screenshots}/${label}-initial.png`});
    await page.locator('#violet-activate').click();
    assert.equal(await page.locator('#violet-caption').innerText(),"Hello, I'm Violet. What is your name?");
    assert.ok(await page.locator('#name-form').isVisible());
    assert.ok(await page.locator('#world').isVisible(),'the scene remains present after activation');
    await page.screenshot({path:`${screenshots}/${label}-greeting.png`});
    if(named){
      await page.locator('#visitor-name').fill('Morgan');
      await page.locator('#name-confirm').click();
      assert.match(await page.locator('#violet-caption').innerText(),/^Welcome, Morgan\./);
    }else{
      await page.locator('#name-skip').click();
      assert.match(await page.locator('#violet-caption').innerText(),/^Welcome\./);
    }
    const welcome=await page.locator('#violet-caption').innerText();
    assert.match(welcome,/Tranquility Neuro Operating System/);
    assert.match(welcome,/Workbench/);
    assert.match(welcome,/separate MCP server/);
    assert.equal(await page.locator('#name-form').isVisible(),false);
    assert.equal(await page.locator('nav, select, .card, .panel').count(),0);
    const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
    assert.ok(bounds.scroll<=bounds.viewport+2,`horizontal overflow: ${JSON.stringify(bounds)}`);
    assert.deepEqual(errors,[],`browser errors on ${label}`);
    await page.screenshot({path:`${screenshots}/${label}-welcome.png`});
    await page.close();
  }
  console.log('Verified actual static modules and canvas: Violet-only entry, name/skip, retained stage, welcome, desktop/mobile; screenshots saved.');
}finally{
  await browser.close();
  server.kill();
}
