// Presentation family: one authority for admitted subjects and qualified
// output state. Audio, character, captions, and evidence are consumers.
// No chapter order, fabricated content, visitor control, timers or behavior
// decisions are hidden in this module.
export const PUBLIC_PRODUCT_BOUNDS=Object.freeze(['native-tnos','workbench','mcp-server']);
const immutable=value=>Object.freeze(value);
export function createPresentationAuthority(){
  let subject=null,request=null,evidence=immutable({audio:null,visual:null});
  const checkpoints=[];
  let generation=0;
  function admitSubject({id,product,sourceRef,description}){
    if(typeof id!=='string'||!id.trim()||!PUBLIC_PRODUCT_BOUNDS.includes(product)||
      typeof sourceRef!=='string'||!sourceRef.trim()||
      typeof description!=='string'||!description.trim())
      throw new TypeError('A subject requires its actual identity, product owner, and an approved source reference');
    if(request&&request.status==='requested')
      throw new Error('Cannot change subject with an unresolved presentation output request');
    subject=immutable({id,product,sourceRef,description});
    return subject;
  }
  function requestOutput({caption,spokenText,visualId,requiresAudio=true,requiresVisual=true}){
    if(!subject||typeof caption!=='string'||!caption.trim()||
      typeof spokenText!=='string'||!spokenText.trim()||
      typeof visualId!=='string'||!visualId.trim()||
      typeof requiresAudio!=='boolean'||typeof requiresVisual!=='boolean'||(!requiresAudio&&!requiresVisual))
      throw new TypeError('Admitted subject and explicit, attributed output content required');
    const token=++generation;
    request=immutable({token,subjectId:subject.id,
      caption,spokenText,visualId,requiresAudio,requiresVisual,status:'requested'});
    evidence=immutable({audio:null,visual:null});
    return request;
  }
  function observe({token,family,type,proof}){
    if(!request||request.status!=='requested'||token!==request.token||
      !['audio','visual'].includes(family)||
      typeof type!=='string'||!type.endsWith('-observed')||
      !proof||typeof proof!=='object'||!proof.source)
      return null; // Stale/unsupported events never establish state.
    if(family==='audio'&&!request.requiresAudio || family==='visual'&&!request.requiresVisual)
      return null;
    if(family==='visual' && !(type==='webgl-change-observed' &&
        proof.type==='webgl-change-observed'&&proof.qualified===true&&
        Number.isInteger(proof.differentSamples)&&proof.differentSamples>=2))
      return null;
    if(family==='audio' && !(type==='audio-playback-observed' &&
        proof.type==='audio-playback-observed'&&proof.playing===true&&
        ['browser-speech','authored-audio'].includes(proof.source)))
      return null;
    evidence=immutable({...evidence,[family]:immutable({type,proof:immutable({...proof})})});
    const ready=(!request.requiresAudio||evidence.audio)&&
      (!request.requiresVisual||evidence.visual);
    if(ready)request=immutable({...request,status:'qualified'});
    return immutable({token,qualified:!!ready,evidence});
  }
  function interrupt({reason}){
    if(!subject||typeof reason!=='string'||!reason.trim())
      throw new TypeError('Interruption must retain an admitted subject and real reason');
    const checkpoint=immutable({subject,request,evidence,reason,generation});
    checkpoints.push(checkpoint);
    // This records an interruption. It does not choose how to resume.
    if(request?.status==='requested')
      request=immutable({...request,status:'interrupted'});
    return checkpoint;
  }
  function resume(checkpoint){
    if(!checkpoint||checkpoints.at(-1)!==checkpoint)
      throw new Error('No matching uninterrupted presentation checkpoint');
    checkpoints.pop();
    subject=checkpoint.subject;
    request=checkpoint.request?.status==='requested'
      ?immutable({...checkpoint.request,status:'interrupted'})
      :checkpoint.request;
    // Old proof stays historical, but a previously pending output must be
    // explicitly re-requested and re-qualified, never auto-completed.
    evidence=checkpoint.evidence;
    generation=Math.max(generation,checkpoint.generation);
    return snapshot();
  }
  function snapshot(){return immutable({subject,request,evidence,
    checkpointDepth:checkpoints.length,generation});}
  return immutable({admitSubject,requestOutput,observe,interrupt,resume,snapshot});
}
