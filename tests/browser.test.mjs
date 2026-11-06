import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{stdio:'ignore'});
const base='http://127.0.0.1:4173/';
const errors=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ready=false;
for(let i=0;i<40;i++){
  try{const response=await fetch(base);if(response.ok){ready=true;break;}}catch{}
  await pause(250);
}
assert.ok(ready,'local static website must serve a real index');
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const desktop=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  desktop.on('pageerror',error=>errors.push('desktop: '+error.message));
  await desktop.goto(base,{waitUntil:'networkidle'});
  assert.ok(await desktop.locator('#violet').isVisible(),'Violet is immediately visible');
  assert.equal(await desktop.locator('#story').isVisible(),false,'no talk placeholder on initial load');
  assert.equal(await desktop.locator('#conversation').isVisible(),false,'no prompt before activating Violet');
  await desktop.screenshot({path:'artifacts/initial-desktop.png',fullPage:true});
  await desktop.locator('#violet').click();
  assert.match(await desktop.locator('#violet-message').innerText(),/Hello, I.m Violet. What is your name/i);
  await desktop.locator('#visitor-name').fill('Morgan');
  await desktop.locator('#name-form button[type=submit]').click();
  assert.match(await desktop.locator('#violet-message').innerText(),/Welcome, Morgan/);
  assert.match(await desktop.locator('#violet-message').innerText(),/Workbench/);
  await desktop.locator('#begin').click();
  assert.equal(await desktop.locator('#story-title').innerText(),'Meet TNOS');
  assert.ok(await desktop.locator('#story-visual svg').count(),'an actual SVG is rendered for the first cue');
  await desktop.screenshot({path:'artifacts/presentation-desktop.png',fullPage:true});
  await desktop.locator('#next').click();
  const expectedTitle=await desktop.locator('#story-title').innerText();
  await desktop.locator('#explore').click();
  await desktop.getByRole('button',{name:'The MCP server'}).click();
  assert.match(await desktop.locator('#explore-title').innerText(),/MCP/);
  await desktop.locator('#return').click();
  assert.equal(await desktop.locator('#story-title').innerText(),expectedTitle,'resume saved passage');
  await desktop.locator('#presence-toggle').click();
  await desktop.waitForFunction(()=>document.querySelector('#violet').dataset.presence==='marker',undefined,{timeout:4000});
  const hidden=await desktop.evaluate(()=>{
    const s=document.querySelector('.strand');
    const f=document.querySelector('.features');
    return {strand:Number(getComputedStyle(s).opacity),features:Number(getComputedStyle(f).opacity)};
  });
  assert.ok(hidden.strand<=.015,'the four strands recede completely');
  assert.ok(hidden.features<=.015,'the face closes into a featureless marker');
  await desktop.screenshot({path:'artifacts/recall-marker-desktop.png',fullPage:true});
  await desktop.locator('#violet').click();
  await desktop.waitForFunction(()=>document.querySelector('#violet').dataset.presence==='full',undefined,{timeout:4000});
  assert.ok(await desktop.locator('#violet').isVisible(),'Violet can be recalled');
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
  mobile.on('pageerror',error=>errors.push('mobile: '+error.message));
  await mobile.goto(base,{waitUntil:'networkidle'});
  await mobile.screenshot({path:'artifacts/initial-mobile.png',fullPage:true});
  await mobile.locator('#violet').click();
  await mobile.locator('#skip-name').click();
  assert.match(await mobile.locator('#violet-message').innerText(),/Welcome/);
  await mobile.locator('#begin').click();
  assert.ok(await mobile.locator('#story-copy').isVisible());
  await mobile.screenshot({path:'artifacts/presentation-mobile.png',fullPage:true});
  const width=await mobile.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  assert.ok(width.scroll<=width.viewport+2,'mobile viewport has no horizontal overflow: '+JSON.stringify(width));
  assert.deepEqual(errors,[], 'no uncaught browser errors');
  console.log(JSON.stringify({result:'browser interaction verified',desktop:{initial:true,name:true,checkpoint:true,recall:true},mobile:{initial:true,skip:true,story:true,layout:width},screenshots:5},null,2));
}finally{
  await browser.close();
  server.kill();
}
