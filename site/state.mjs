// Single authority for the browser presentation.
// The scene, captions, controls and optional narration only consume this state.
// "Observed" below means the website's OWN UI was rendered/inspected. It does
// not mean TNOS, its hardware, its native cognition or visitors were observed.
import {cues,cuesForSubject,subjectById} from './content.mjs';
const copy = value => structuredClone(value);
export function createPresentation() {
  let s={mode:'arrival',position:-1,topic:null,returnPoint:null,paused:false,finished:false,depth:'overview',
    generation:0,outputs:{},qualified:false,interaction:'arrived',visited:[],history:[]};
  const listeners=new Set();
  const snap=()=>copy(s);
  function emit(type,detail) {
    s.history=[...s.history.slice(-19),{type,detail,generation:s.generation}];
    const state=snap();
    for(const listener of listeners)listener(state,type);
    return {accepted:true,state};
  }
  function resetOutputs() {
    s.generation++;
    s.outputs={caption:'pending',spatial:'pending'};
    s.qualified=false;
  }
  function show(index,reason) {
    if(index<0 || index>=cues.length)return {accepted:false,state:snap()};
    s.position=index;s.topic=cues[index].topic;resetOutputs();
    s.interaction=reason;
    return emit('PRESENT_CUE',cues[index].id);
  }
  function dispatch(event) {
    if(!event || typeof event.type!=='string')throw new TypeError('Typed event required');
    switch(event.type){
      case 'START':
        if(s.mode!=='arrival')return {accepted:false,state:snap()};
        s.mode='guided';s.paused=false;return show(0,'started presentation');
      case 'NEXT':
        if(s.mode!=='guided'||s.paused||!s.qualified)return {accepted:false,state:snap()};
        if(s.position+1>=cues.length){
          s.mode='explore';s.finished=true;s.returnPoint=null;s.topic=null;resetOutputs();s.outputs={};
          return emit('ENTER_EXPLORATION','guided presentation completed');
        }
        s.depth='overview';return show(s.position+1,'continued guided presentation');
      case 'PREVIOUS':
        if(s.mode!=='guided'||s.position<=0)return {accepted:false,state:snap()};
        s.depth='overview';return show(s.position-1,'returned to previous passage');
      case 'PAUSE':
        if(s.mode!=='guided'||s.paused)return {accepted:false,state:snap()};
        s.paused=true;return emit('PAUSED','presentation paused at existing generation');
      case 'RESUME':
        if(s.mode!=='guided'||!s.paused)return {accepted:false,state:snap()};
        s.paused=false;return emit('RESUMED','presentation resumed at existing generation');
      case 'EXPLORE':
        if(s.mode==='guided')s.returnPoint={position:s.position,paused:s.paused,depth:s.depth};
        if(s.mode==='arrival')s.returnPoint=null;
        s.mode='explore';s.paused=false;s.topic=null;s.depth='overview';resetOutputs();s.outputs={};
        s.interaction='visitor chose exploration';return emit('ENTER_EXPLORATION','subject chooser');
      case 'SELECT_SUBJECT':
        if(!subjectById.has(event.id))return {accepted:false,state:snap()};
        if(s.mode==='guided')s.returnPoint={position:s.position,paused:s.paused};
        s.mode='explore';s.paused=false;s.topic=event.id;s.depth='overview';
        s.position=cues.indexOf(cuesForSubject(event.id)[0]);
        if(!s.visited.includes(event.id))s.visited.push(event.id);
        resetOutputs();s.interaction='visitor selected '+event.id;
        return emit('SHOW_SUBJECT',event.id);
      case 'EXPLORE_NEXT': {
        if(s.mode!=='explore'||!s.topic||!s.qualified)return {accepted:false,state:snap()};
        const relevant=cuesForSubject(s.topic);
        const current=relevant.findIndex(cue=>cue.id===cues[s.position]?.id);
        if(current<0||current+1>=relevant.length){
          s.topic=null;resetOutputs();s.outputs={};
          return emit('ENTER_EXPLORATION','returned to subject selection');
        }
        s.depth='overview';return show(cues.indexOf(relevant[current+1]),'continued contextual exploration');
      }
      case 'EXPLORE_PREVIOUS': {
        if(s.mode!=='explore'||!s.topic)return {accepted:false,state:snap()};
        const relevant=cuesForSubject(s.topic);
        const current=relevant.findIndex(cue=>cue.id===cues[s.position]?.id);
        if(current<=0)return {accepted:false,state:snap()};
        s.depth='overview';return show(cues.indexOf(relevant[current-1]),'returned to earlier related explanation');
      }
      case 'RETURN':
        if(s.mode!=='explore'||!s.returnPoint)return {accepted:false,state:snap()};
        const back=s.returnPoint;s.returnPoint=null;s.mode='guided';s.paused=back.paused;s.depth=back.depth??'overview';
        return show(back.position,'returned to the interrupted talk');
      case 'SET_DEPTH':
        if(!['overview','detail'].includes(event.depth)||s.mode==='arrival'||
          (s.mode==='explore'&&!s.topic)||s.paused||s.depth===event.depth)
          return {accepted:false,state:snap()};
        s.depth=event.depth;
        resetOutputs();
        s.interaction='changed explanation detail to '+event.depth;
        return emit('DEPTH_CHANGED',event.depth);
      case 'OBSERVE':
        if(s.paused||event.generation!==s.generation||!Object.hasOwn(s.outputs,event.output)||
           s.outputs[event.output]!=='pending'||!['confirmed','failed','unavailable'].includes(event.status))
          return {accepted:false,state:snap()};
        s.outputs[event.output]=event.status;
        s.qualified=Object.values(s.outputs).length>0&&Object.values(s.outputs).every(x=>x==='confirmed');
        return emit('OUTPUT_OBSERVED',event.output+':'+event.status);
      case 'RETRY':
        if(!Object.values(s.outputs).some(x=>x==='failed'||x==='unavailable'))
          return {accepted:false,state:snap()};
        resetOutputs();return emit('RETRY_PRESENTATION','requalification');
      case 'RESTART':
        s={mode:'arrival',position:-1,topic:null,returnPoint:null,paused:false,finished:false,
          generation:s.generation+1,outputs:{},qualified:false,interaction:'restarted',visited:[],history:[]};
        return emit('RESTARTED','new visitor session');
      default:throw new Error('Unknown event '+event.type);
    }
  }
  const observe=(generation,output,status)=>dispatch({type:'OBSERVE',generation,output,status});
  return Object.freeze({snapshot:snap,dispatch,observe,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}});
}
