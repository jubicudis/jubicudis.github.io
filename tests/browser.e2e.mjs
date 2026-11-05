import {chromium} from 'playwright';

const site=process.env.SITE_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const problems=[];
function failUnless(condition,message){if(!condition)throw new Error(message);}
async function waitQualified(page,context){
  await page.waitForFunction(()=>window.__tnosPresentation?.snapshot()?.qualified===true,
    null,{timeout:14000}).catch(async e=>{
      const snapshot=await page.evaluate(()=>window.__tnosPresentation?.snapshot?.()).catch(()=>null);
      throw new Error('Never qualified '+context+': '+JSON.stringify(snapshot)+'; '+e.message);
    });
}
function watch(page,label){
  page.on('pageerror',e=>problems.push(label+' PAGE ERROR '+(e.stack||e.message)));
  page.on('console',m=>{if(m.type()==='error')problems.push(label+' CONSOLE '+m.text()+' '+m.location().url);});
  page.on('response',r=>{if(r.status()>=400)problems.push(label+' HTTP '+r.status()+' '+r.url());});
}
try {
 const desktop=await browser.newPage({viewport:{width:1280,height:800}});
 watch(desktop,'desktop');
 await desktop.goto(site,{waitUntil:'load',timeout:30000});
 failUnless(await desktop.evaluate(()=>!!window.__tnosPresentation),'Presentation runtime absent');
 failUnless(await desktop.locator('#violet-presenter').count()===1,'Violet presenter absent');
 await desktop.locator('#advance').click();
 const count=13;
 for(let i=0;i<count;i++){
  await waitQualified(desktop,'talk step '+i);
  const snapshot=await desktop.evaluate(()=>window.__tnosPresentation.snapshot());
  failUnless(snapshot.position===i,'Incorrect guided position at '+i+': '+JSON.stringify(snapshot));
  const topic=snapshot.topic;
  if(topic==='architecture'||topic==='cognition'){
   failUnless(await desktop.locator('#study-display').isVisible(),'Source study not visible at '+i);
   const image=await desktop.locator('#study-image').evaluate(img=>({width:img.naturalWidth,complete:img.complete,src:img.currentSrc}));
   failUnless(image.complete&&image.width>0,'Source study failed to render: '+JSON.stringify(image));
   if(i===3||i===6)await desktop.screenshot({path:'review-'+topic+'.png'});
  }
  if(i===3){
   await desktop.locator('#depth').click();
   await waitQualified(desktop,'deep architecture');
   failUnless(await desktop.locator('#deep-speech').isVisible(),'Expanded paper-grounded explanation missing');
   failUnless((await desktop.locator('#deep-speech').innerText()).length>110,'Expanded explanation empty');
   await desktop.locator('#inspect-study').click();
   failUnless(await desktop.locator('#study-dialog').evaluate(d=>d.open),'Study inspection does not open');
   await desktop.locator('#close-study').click();
   await desktop.locator('#depth').click();
   await waitQualified(desktop,'overview restored');
  }
  if(i===8){
   await desktop.locator('#pause').click();
   failUnless((await desktop.evaluate(()=>window.__tnosPresentation.snapshot())).paused,'Pause not authoritative');
   await desktop.locator('#explore').click();
   await desktop.locator('[data-subject-id="mcp"]').click();
   await waitQualified(desktop,'interrupted MCP');
   await desktop.locator('#return').click();
   let restored=await desktop.evaluate(()=>window.__tnosPresentation.snapshot());
   failUnless(restored.mode==='guided'&&restored.paused&&restored.position===i,'Talk checkpoint lost '+JSON.stringify(restored));
   await desktop.locator('#pause').click();
   await waitQualified(desktop,'resume');
  }
  await desktop.locator('#advance').click();
 }
 const end=await desktop.evaluate(()=>window.__tnosPresentation.snapshot());
 failUnless(end.mode==='explore'&&end.topic===null&&end.finished,'Talk does not transition to exploration: '+JSON.stringify(end));
 await desktop.screenshot({path:'review-desktop-explore.png'});
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 watch(mobile,'mobile');
 await mobile.goto(site,{waitUntil:'load',timeout:30000});
 await mobile.locator('#explore').click();
 let bounds=await mobile.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 failUnless(bounds.document<=bounds.viewport+2,'Overflow in mobile chooser: '+JSON.stringify(bounds));
 await mobile.locator('[data-subject-id="architecture"]').click();
 await waitQualified(mobile,'mobile architecture');
 failUnless(await mobile.locator('#study-display').isVisible(),'Mobile source diagram absent');
 await mobile.locator('#inspect-study').click();
 failUnless(await mobile.locator('#study-dialog').evaluate(d=>d.open),'Mobile study inspection failed');
 await mobile.screenshot({path:'review-mobile-study.png',fullPage:true});
 await mobile.locator('#close-study').click();
 bounds=await mobile.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 failUnless(bounds.document<=bounds.viewport+2,'Overflow after mobile study: '+JSON.stringify(bounds));
 console.log('QUALIFIED_GUIDED_CUES',count);
 console.log('MOBILE_VIEWPORT',JSON.stringify(bounds));
 console.log('BROWSER_PROBLEMS',JSON.stringify(problems));
 failUnless(problems.length===0,'Browser failures: '+problems.join('; '));
 console.log('END_TO_END_SUCCESS');
}finally{await browser.close();}
