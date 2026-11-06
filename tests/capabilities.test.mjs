import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../site/vendor/three.module.js';
import {compileSpeechCueTrack,sampleSpeechCue} from '../site/violet-speech-cues.mjs';
import {ZERO_BLOOM_MOTION,validateBloomMotion,solveCoupledMotion,createBloomMotionCapabilities}
  from '../site/violet-motion.mjs';
import {captureWebGLRegion,compareWebGLObservations,compareWithOpenCV}
  from '../site/violet-observation.mjs';
import {createPresentationAuthority} from '../site/presentation-authority.mjs';
import {OFFICIAL_OPENCV_JS_URL,loadOpenCVJs} from '../site/opencv-loader.mjs';

test('speech-to-expression cues require real authored timestamps and observed playback',()=>{
  const t=compileSpeechCueTrack({assetId:'intro-1',transcript:'Hello Violet',durationMs:400,
    cues:[{startMs:0,endMs:150,pose:'viseme-wide'},
      {startMs:150,endMs:320,pose:'viseme-round'}]});
  const data={source:'observed-authored-audio',assetId:'intro-1',token:3,elapsedMs:180,playing:true};
  assert.equal(sampleSpeechCue(t,data).pose,'viseme-round');
  assert.equal(sampleSpeechCue(t,{...data,playing:false}),null);
  assert.equal(sampleSpeechCue(t,{...data,assetId:'wrong'}),null);
  assert.equal(sampleSpeechCue(t,{...data,source:'guess'}),null);
  assert.equal(sampleSpeechCue(t,{...data,elapsedMs:350}),null);
  assert.throws(()=>compileSpeechCueTrack({assetId:'a',transcript:'a',durationMs:100,
    cues:[{startMs:0,endMs:80,pose:'viseme-open'},{startMs:70,endMs:90,pose:'viseme-closed'}]}));
});
test('four body influences move independently within a coupled, deformable surface',()=>{
  assert.equal(ZERO_BLOOM_MOTION.length,4);
  assert.throws(()=>validateBloomMotion([{x:1,y:0}]));
  const request=[{x:.15,y:0},{x:0,y:.2},{x:0,y:0},{x:-.15,y:0}];
  const solved=solveCoupledMotion(request);
  assert.notEqual(solved[0].x,solved[1].x);
  assert.notEqual(solved[0].x,request[0].x);
  const geometry=new THREE.PlaneGeometry(6.65,4.71,88,64);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  const changes=[];
  const rig=createBloomMotionCapabilities({structureSurface:mesh,artWidth:6.65,
    artHeight:4.71,onActiveChange:v=>changes.push(v)});
  const original=Array.from(geometry.getAttribute('position').array);
  assert.equal(rig.readRequested(),ZERO_BLOOM_MOTION);
  const result=rig.apply(request);
  assert.equal(result.active,true);
  assert.notDeepEqual(Array.from(geometry.getAttribute('position').array),original);
  rig.reset();
  assert.deepEqual(Array.from(geometry.getAttribute('position').array),original);
  assert.deepEqual(changes,[true,false]);
  geometry.dispose();mesh.material.dispose();
});
test('site-owned WebGL observation reads pixels and separates request from observed change',()=>{
  let level=40;
  const gl={isContextLost:()=>false,readPixels(x,y,w,h,format,type,target){
    target.set([level,30,level+80,255]);
  }};
  const renderer={getContext:()=>gl,info:{render:{calls:2}}};
  const canvas={width:100,height:80};
  const a=captureWebGLRegion({renderer,canvas,columns:6,rows:5,token:1});
  level=170;
  const b=captureWebGLRegion({renderer,canvas,columns:6,rows:5,token:2});
  assert.equal(a.type,'bounded-webgl-pixels');
  assert.equal(b.pixels.length,6*5*4);
  assert.equal(compareWebGLObservations(a,b).qualified,true);
  assert.equal(compareWebGLObservations(a,a).qualified,false);
  assert.throws(()=>captureWebGLRegion({renderer,canvas,columns:100,rows:100,token:1}));
  assert.throws(()=>captureWebGLRegion({renderer:{...renderer,info:{render:{calls:0}}},canvas,token:2}));
});
test('OpenCV adapter requires actual initialized operations and releases matrices',()=>{
  assert.equal(OFFICIAL_OPENCV_JS_URL,'https://docs.opencv.org/4.13.0/opencv.js');
  let freed=0;
  const cv={
    CV_8UC4:24,
    matFromArray:(h,w,fmt,data)=>({data,delete(){freed++;}}),
    Mat:class{delete(){freed++;}},
    absdiff(a,b,out){out.data=Uint8Array.from(a.data.map((v,i)=>Math.abs(v-b.data[i])));},
    mean:m=>{
      const sum=[0,0,0,0];for(let i=0;i<m.data.length;i++)sum[i%4]+=m.data[i];
      return sum.map(x=>x/(m.data.length/4));
    }
  };
  let level=20;
  const gl={isContextLost:()=>false,readPixels(x,y,w,h,f,t,a){a.set([level,50,90,255]);}};
  const renderer={getContext:()=>gl,info:{render:{calls:2}}},canvas={width:80,height:80};
  const a=captureWebGLRegion({renderer,canvas,token:1});level=100;
  const b=captureWebGLRegion({renderer,canvas,token:2});
  const result=compareWithOpenCV(cv,a,b);
  assert.equal(result.type,'opencv-region-comparison');
  assert.equal(result.changed,true);
  assert.equal(freed,3);
  assert.throws(()=>compareWithOpenCV(null,a,b),/OpenCV/);
  assert.rejects(loadOpenCVJs({documentRef:null}),/browser document/);
});
test('presentation family owns admitted subject and requires qualified output evidence',()=>{
  const p=createPresentationAuthority();
  assert.throws(()=>p.requestOutput({caption:'hi',spokenText:'hi',visualId:'a'}));
  assert.throws(()=>p.admitSubject({id:'x',product:'unknown',sourceRef:'known',description:'a'}));
  p.admitSubject({id:'intro',product:'native-tnos',sourceRef:'sponsors-master-v3.9',
    description:'Tranquility Neuro Operating System introduction'});
  const request=p.requestOutput({caption:'Hello',spokenText:'Hello',visualId:'violet-open'});
  assert.equal(p.snapshot().request.status,'requested');
  assert.equal(p.observe({token:request.token,family:'audio',type:'audio-playback-observed',
    proof:{type:'audio-playback-observed',source:'authored-audio',playing:false}}),null);
  const a=p.observe({token:request.token,family:'audio',type:'audio-playback-observed',
    proof:{type:'audio-playback-observed',source:'authored-audio',playing:true}});
  assert.equal(a.qualified,false);
  assert.equal(p.observe({token:-1,family:'visual',type:'webgl-change-observed',
    proof:{type:'webgl-change-observed',source:'webgl-readpixels',
      differentSamples:10,qualified:true}}),null);
  const v=p.observe({token:request.token,family:'visual',type:'webgl-change-observed',
    proof:{type:'webgl-change-observed',source:'webgl-readpixels',
      differentSamples:10,qualified:true}});
  assert.equal(v.qualified,true);
  assert.equal(p.snapshot().request.status,'qualified');
  const ck=p.interrupt({reason:'subject exploration'});
  assert.equal(p.snapshot().checkpointDepth,1);
  assert.equal(p.resume(ck).subject.id,'intro');
  assert.equal(p.snapshot().checkpointDepth,0);
  assert.throws(()=>p.resume(ck));
});
