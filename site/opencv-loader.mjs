// Load an actual OpenCV.js implementation only when observation is requested.
// The main opening never downloads OpenCV merely because the page is visited.
// A load failure is a failure, not a synthetic successful observation.
export const OFFICIAL_OPENCV_JS_URL='https://docs.opencv.org/4.13.0/opencv.js';
let inFlight=null;
const isReady=cv=>cv&&typeof cv.Mat==='function'&&
  typeof cv.matFromArray==='function'&&typeof cv.absdiff==='function';
async function initialized(cv,timeoutMs){
  if(cv&&typeof cv.then==='function')cv=await cv;
  if(isReady(cv))return cv;
  if(!cv)throw new Error('OpenCV.js script loaded without a cv module');
  return new Promise((resolve,reject)=>{
    const deadline=setTimeout(()=>reject(new Error('OpenCV.js runtime did not initialize')),timeoutMs);
    const previous=cv.onRuntimeInitialized;
    cv.onRuntimeInitialized=()=>{
      clearTimeout(deadline);
      try{if(typeof previous==='function')previous();}catch{/* external callback does not establish observation */}
      if(isReady(cv))resolve(cv);
      else reject(new Error('OpenCV.js runtime did not supply required operations'));
    };
  });
}
export async function loadOpenCVJs({
  url=OFFICIAL_OPENCV_JS_URL,
  documentRef=typeof document!=='undefined'?document:null,
  timeoutMs=60000
}={}){
  if(!documentRef?.createElement||!documentRef.head)
    throw new Error('An actual browser document is required to load OpenCV.js');
  if(!Number.isFinite(timeoutMs)||timeoutMs<1000||timeoutMs>180000)
    throw new RangeError('OpenCV.js load timeout must be bounded');
  const location=new URL(url,documentRef.baseURI);
  if(location.protocol!=='https:')throw new Error('OpenCV.js requires HTTPS');
  if(location.href!==OFFICIAL_OPENCV_JS_URL)
    throw new Error('Only the verified official OpenCV.js version is permitted');
  if(isReady(documentRef.defaultView?.cv))
    return documentRef.defaultView.cv;
  if(inFlight)return inFlight;
  inFlight=new Promise((resolve,reject)=>{
    let done=false;
    const script=documentRef.createElement('script');
    script.src=OFFICIAL_OPENCV_JS_URL;script.async=true;script.crossOrigin='anonymous';
    const deadline=setTimeout(()=>{
      if(done)return;done=true;script.remove();reject(new Error('OpenCV.js load timed out'));
    },timeoutMs);
    script.onerror=()=>{
      if(done)return;done=true;clearTimeout(deadline);
      script.remove();reject(new Error('Failed to download official OpenCV.js'));
    };
    script.onload=async()=>{
      if(done)return;
      try{
        const cv=await initialized(documentRef.defaultView?.cv,timeoutMs);
        if(done)return;
        done=true;clearTimeout(deadline);resolve(cv);
      }catch(error){
        if(done)return;
        done=true;clearTimeout(deadline);script.remove();reject(error);
      }
    };
    documentRef.head.append(script);
  }).catch(error=>{inFlight=null;throw error;});
  return inFlight;
}
