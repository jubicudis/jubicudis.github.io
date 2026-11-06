// Public website presentation state. This is not TNOS native cognition or TranquilSpeak execution.
export const initialState=Object.freeze({
  phase:'dormant',visitorName:null,nameDecision:null,
  renderStatus:'uninitialized',renderEvidence:null,renderFailure:null,
  speaking:false,speechToken:0,voiceSupported:null,speechStatus:'not-requested',
  enteredAt:0,
  context:Object.freeze({who:'unidentified visitor',what:'Violet',when:'unstarted',where:'TNOS website opening',why:'visit',how:'await activation',extent:'not started'})
});
const states=new Set(['dormant','asking-name','welcome']);
export function openingMessage(state){
  switch(state.phase){
    case 'dormant':return '';
    case 'asking-name':return "Hello, I'm Violet. What is your name?";
    case 'welcome':{
      const greeting=state.nameDecision==='provided'?`Welcome, ${state.visitorName}.`:'Welcome.';
      return `${greeting} This experience introduces Tranquility Neuro Operating System, the Workbench being developed to help build and examine it, and the separate MCP server intended to connect selected capabilities with other tools.`;
    }
    default:throw new Error('Unknown opening phase');
  }
}
export function reduceOpening(state,event){
  if(!event||typeof event.type!=='string')return state;
  const when=Number.isFinite(event.at)?event.at:null;
  let patch=null;
  switch(event.type){
    case 'RENDER_STARTED':
      if(state.renderStatus==='uninitialized')patch={renderStatus:'initializing'};
      break;
    case 'RENDER_OBSERVED':
      if(state.renderStatus==='initializing' && event.evidence?.type==='webgl-pixel-observed'
          && event.evidence.nonBackgroundPixel===true && event.evidence.drawCalls>=2)
        patch={renderStatus:'observed',renderEvidence:Object.freeze({
          type:event.evidence.type,drawCalls:event.evidence.drawCalls,
          nonBackgroundPixel:true
        })};
      break;
    case 'RENDER_FAILED':
      if(state.renderStatus!=='failed'&&typeof event.reason==='string')
        patch={renderStatus:'failed',renderEvidence:null,renderFailure:event.reason.slice(0,240)};
      break;
    case 'ACTIVATE':
      if(state.phase==='dormant'&&state.renderStatus==='observed')patch={phase:'asking-name',enteredAt:when,speaking:false,speechStatus:'pending',speechToken:state.speechToken+1};
      break;
    case 'GIVE_NAME':
      if(state.phase!=='asking-name'||typeof event.name!=='string')break;
      {const name=event.name.replace(/[\u0000-\u001F\u007F<>]/g,'').trim().replace(/\s+/g,' ').slice(0,48);
       if(name)patch={phase:'welcome',visitorName:name,nameDecision:'provided',enteredAt:when,speaking:false,speechStatus:'pending',speechToken:state.speechToken+1};}
      break;
    case 'SKIP_NAME':
      if(state.phase==='asking-name')patch={phase:'welcome',visitorName:null,nameDecision:'skipped',enteredAt:when,speaking:false,speechStatus:'pending',speechToken:state.speechToken+1};
      break;
    case 'VOICE_AVAILABLE':
      patch={voiceSupported:event.value===true};break;
    case 'SPEECH_STARTED':
      if(event.token===state.speechToken&&state.phase!=='dormant')patch={speaking:true,speechStatus:'speaking'};
      break;
    case 'SPEECH_ENDED':
      if(event.token===state.speechToken&&state.speaking)patch={speaking:false,speechStatus:'completed'};
      break;
    case 'SPEECH_FAILED':
      if(event.token===state.speechToken&&state.phase!=='dormant'&&state.speechStatus!=='completed'&&state.speechStatus!=='failed')
        patch={speaking:false,speechStatus:'failed'};
      break;
    case 'SPEECH_UNAVAILABLE':
      if(event.token===state.speechToken&&state.phase!=='dormant'&&state.speechStatus==='pending')
        patch={speaking:false,speechStatus:'unavailable'};
      break;
    case 'SPEECH_INTERRUPTED':
      if(event.token===state.speechToken&&state.phase!=='dormant'
          &&(state.speechStatus==='speaking'||state.speechStatus==='pending'))
        patch={speaking:false,speechStatus:'interrupted'};
      break;
  }
  if(!patch)return state;
  const next={...state,...patch};
  if(!states.has(next.phase))throw new Error('Illegal opening phase');
  next.context=Object.freeze({
    who:next.nameDecision==='provided'?next.visitorName:'unidentified visitor',
    what:next.phase==='dormant'?'Violet':next.phase==='asking-name'?'greeting and optional name':'three-product introduction',
    when:when,
    where:'TNOS website opening',
    why:'introduce the operating system, Workbench and separate MCP server',
    how:event.type,
    extent:next.phase
  });
  return Object.freeze(next);
}
export function createOpeningStore(listener){
  let state=initialState;
  return {getState:()=>state,dispatch(event){
    const next=reduceOpening(state,{...event,at:event.at??performance.now()});
    if(next!==state){const previous=state;state=next;listener?.(next,previous,event);}
    return state;
  }};
}
