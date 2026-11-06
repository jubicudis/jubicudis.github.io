import {CUES, topicById} from './content.mjs';

export const initialState = Object.freeze({
  phase:'idle', index:0, name:null, nameChoice:null,
  topicId:null, checkpointPhase:null, checkpointIndex:0,
  presence:'full', presenceGeneration:0,
  visualGeneration:0, visualObservedGeneration:-1,
  voiceEnabled:true, speech:'idle', speechKey:null,
  context:Object.freeze({who:'visitor',what:'first visit',when:null,where:'website entrance',why:'visitor entry',how:'not yet interacted',extent:'not started'})
});

const phases = new Set(['idle','name','welcome','talk','explore','complete']);
function withContext(state,event,patch){
  const merged = {...state,...patch};
  const phase=merged.phase;
  const cue=phase==='talk'?CUES[merged.index]:null;
  const context={
    who:merged.nameChoice==='named'?merged.name:'visitor without a supplied name',
    what:cue?.key || (phase==='explore'?merged.topicId:phase),
    when:event.at ?? null,
    where:'TNOS website / '+phase,
    why:actionPurposes[event.type] || 'visitor-initiated interaction',
    how:event.type.toLowerCase(),
    extent:phase==='talk'?(merged.index+1)+' of '+CUES.length+' narrated passages':phase==='explore'?'selected subject':phase
  };
  merged.context=Object.freeze(context);
  return Object.freeze(merged);
}
const actionPurposes={
  ACTIVATE:'begin interaction', NAME:'provide preferred address',SKIP_NAME:'continue without giving a name',
  BEGIN:'begin guided presentation',NEXT:'continue guided presentation',PREVIOUS:'return to previous passage',
  EXPLORE:'inspect related information',EXPLORE_ALL:'inspect project subjects',
  SELECT_TOPIC:'choose project subject',RETURN:'resume the saved presentation position',
  HIDE:'give the information more screen space',RECALL:'bring Violet back',
  PRESENCE_SETTLED:'confirm completion of the visual presence transition',
  VISUAL_OBSERVED:'record the browser layout check of the requested subject',
  VOICE_TOGGLE:'change narration preference',SPEECH_STARTED:'record speech engine start',
  SPEECH_ENDED:'record speech engine completion'
};
function changedScene(state,event,patch){
  return withContext(state,event,{...patch,visualGeneration:state.visualGeneration+1,visualObservedGeneration:-1,speech:'idle',speechKey:null});
}
export function transition(state,event){
  if(!state || !event || typeof event.type!=='string')return state;
  switch(event.type){
    case 'ACTIVATE':return state.phase==='idle'?changedScene(state,event,{phase:'name'}):state;
    case 'NAME':{
      if(state.phase!=='name' || typeof event.value!=='string')return state;
      const value=event.value.trim().replace(/\s+/g,' ').slice(0,48);
      return value?changedScene(state,event,{phase:'welcome',name:value,nameChoice:'named'}):state;
    }
    case 'SKIP_NAME':return state.phase==='name'?changedScene(state,event,{phase:'welcome',name:null,nameChoice:'skipped'}):state;
    case 'BEGIN':return state.phase==='welcome'?changedScene(state,event,{phase:'talk',index:0}):state;
    case 'NEXT':
      if(state.phase!=='talk')return state;
      return state.index===CUES.length-1?changedScene(state,event,{phase:'complete'}):changedScene(state,event,{index:state.index+1});
    case 'PREVIOUS':
      return state.phase==='talk'&&state.index>0?changedScene(state,event,{index:state.index-1}):state;
    case 'EXPLORE':
      return state.phase==='talk'?changedScene(state,event,{phase:'explore',topicId:CUES[state.index].chapter,checkpointPhase:'talk',checkpointIndex:state.index}):state;
    case 'EXPLORE_ALL':
      return state.phase==='complete'?changedScene(state,event,{phase:'explore',topicId:'origin',checkpointPhase:'complete',checkpointIndex:state.index}):state;
    case 'SELECT_TOPIC':
      return state.phase==='explore'&&topicById(event.id)?changedScene(state,event,{topicId:event.id}):state;
    case 'RETURN':
      if(state.phase!=='explore'||!phases.has(state.checkpointPhase))return state;
      return changedScene(state,event,{phase:state.checkpointPhase,index:state.checkpointIndex,topicId:null,checkpointPhase:null});
    case 'HIDE':
      return ['full','returning'].includes(state.presence)?withContext(state,event,{presence:'receding',presenceGeneration:state.presenceGeneration+1}):state;
    case 'RECALL':
      return ['marker','receding'].includes(state.presence)?withContext(state,event,{presence:'returning',presenceGeneration:state.presenceGeneration+1}):state;
    case 'PRESENCE_SETTLED':
      if(event.generation!==state.presenceGeneration)return state;
      if(state.presence==='receding'&&event.target==='marker')return withContext(state,event,{presence:'marker'});
      if(state.presence==='returning'&&event.target==='full')return withContext(state,event,{presence:'full'});
      return state;
    case 'VISUAL_OBSERVED':
      if(event.generation!==state.visualGeneration || !event.isVisible || state.visualObservedGeneration===event.generation)return state;
      return withContext(state,event,{visualObservedGeneration:event.generation});
    case 'VOICE_TOGGLE':return withContext(state,event,{voiceEnabled:!state.voiceEnabled,speech:state.voiceEnabled?'idle':state.speech});
    case 'SPEECH_STARTED':return typeof event.key==='string'?withContext(state,event,{speech:'speaking',speechKey:event.key}):state;
    case 'SPEECH_ENDED':return event.key===state.speechKey?withContext(state,event,{speech:'idle'}):state;
    default:return state;
  }
}
export function createStore(onChange,clock=()=>Date.now()){
  let state=initialState;
  return {
    getState:()=>state,
    dispatch(event){
      const next=transition(state,{...event,at:event.at??clock()});
      if(next!==state){const previous=state;state=next;onChange?.(state,previous,event);}
      return state;
    }
  };
}
