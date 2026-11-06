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
    await page.locator('#violet-activate').click();
    assert.equal(await page.locator('#violet-caption').innerText(),"Hello, I'm Violet. What is your name?");
    assert.ok(await page.locator('#name-form').isVisible());
    await page.screenshot({path:'artifacts/'+label+'-greeting.png'});
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
    assert.ok(bounds.scroll<=bounds.viewport+2,'horizontal overflow: '+JSON.stringify(bounds));
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
  console.log('Verified Three.js/WebGL+SVG appearance, opening interaction, and explicit failure with missing required SVG (no successful fallback).');
}finally{await browser.close();server.kill();}
