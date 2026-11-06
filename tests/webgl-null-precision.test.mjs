import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';

// Regression for the exact iPhone Safari error:
// getShaderPrecisionFormat(...) may return null while WebGL exists.
// Only a real drawn Violet scene qualifies as success.
const server=spawn('python3',['-m','http.server','4183','--bind','127.0.0.1'],{stdio:'ignore'});
const base='http://127.0.0.1:4183/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let available=false;
  for(let i=0;i<60;i++){
    try{if((await fetch(base)).ok){available=true;break;}}catch{}
    await sleep(150);
  }
  assert.equal(available,true);
  const engine=process.env.VIOLET_BROWSER==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true,...(engine===chromium?{
    args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']
  }:{})});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.__nullPrecisionQueries=0;
      for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
        if(!type?.prototype?.getShaderPrecisionFormat)continue;
        const original=type.prototype.getShaderPrecisionFormat;
        type.prototype.getShaderPrecisionFormat=function(...args){
          window.__nullPrecisionQueries++;
          return null;
        };
      }
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>
      ['observed','failed'].includes(document.getElementById('environment')?.dataset.renderStatus),
      null,{timeout:45000});
    const outcome=await page.evaluate(()=>({
      status:document.getElementById('environment').dataset.renderStatus,
      failure:document.getElementById('render-failure').textContent,
      queries:window.__nullPrecisionQueries
    }));
    assert.ok(outcome.queries>0,'must exercise actual null precision API');
    assert.equal(outcome.status,'observed',JSON.stringify({outcome,errors}));
    assert.deepEqual(errors,[]);
    console.log('Observed real Violet pixels with null shader precision reports:',outcome.queries);
    await page.close();
  }finally{await browser.close();}
}finally{server.kill();}
