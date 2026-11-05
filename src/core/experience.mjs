// One visitor experience; no private TNOS runtime, webcam, microphone, or AI model.
// The presenter is a consumer of qualified state, never its source of truth.
const OUTPUTS = new Set(['caption', 'visual', 'narration']);
const RESULTS = new Set(['confirmed', 'failed', 'unavailable']);

export function createExperience(catalog) {
  if (!catalog || !Array.isArray(catalog.cues) || !(catalog.topics instanceof Map)) {
    throw new Error('Validated public catalog required');
  }
  let s = {
    mode: 'welcome', position: -1, topicId: null, paused: false,
    checkpoint: null, generation: 0, outputs: {}, finishedTalk: false,
    history: []
  };
  const listeners = new Set();
  const snapshot = () => structuredClone(s);
  function record(type, note = null) {
    s.history = [...s.history.slice(-49), {type, note, generation: s.generation}];
  }
  function present(index) {
    const cue = catalog.cues[index];
    s.mode = 'guided'; s.position = index; s.topicId = cue.topicId;
    s.paused = false; s.generation++; s.outputs = {};
    for (const output of cue.requiredOutputs) s.outputs[output] = 'pending';
    return [{
      type: 'PRESENT_CUE', cueId: cue.id, generation: s.generation,
      text: cue.text, requiredOutputs: [...cue.requiredOutputs]
    }];
  }
  function ready() {
    return s.mode === 'guided' && !s.paused &&
      Object.values(s.outputs).length > 0 &&
      Object.values(s.outputs).every(result => result === 'confirmed');
  }
  function process(event, authority) {
    if (!event || typeof event.type !== 'string') throw new Error('Event type required');
    if (event.type === 'OBSERVE' && authority !== 'observer') throw new Error('Observation authority required');
    let accepted = false, effects = [];
    switch (event.type) {
      case 'START':
        if (s.mode === 'welcome' && catalog.cues.length) {
          effects = present(0); accepted = true;
        }
        break;
      case 'OBSERVE':
        // An observation of an old generation cannot establish a new result.
        if (s.mode === 'guided' && event.generation === s.generation &&
            OUTPUTS.has(event.output) && RESULTS.has(event.status) &&
            Object.hasOwn(s.outputs, event.output) &&
            s.outputs[event.output] === 'pending') {
          s.outputs[event.output] = event.status; accepted = true;
          if (ready()) effects.push({type: 'CUE_READY', cueId: catalog.cues[s.position].id});
        }
        break;
      case 'NEXT':
        if (ready()) {
          accepted = true;
          if (s.position + 1 < catalog.cues.length) {
            effects = present(s.position + 1);
          } else {
            s.finishedTalk = true; s.mode = 'explore'; s.checkpoint = null;
            s.outputs = {};
            effects = [{type: 'ENTER_EXPLORATION', topicId: s.topicId}];
          }
        }
        break;
      case 'RETRY':
        if (s.mode === 'guided' &&
            Object.values(s.outputs).some(x => x === 'failed' || x === 'unavailable')) {
          effects = present(s.position); accepted = true;
        }
        break;
      case 'PAUSE':
        if (s.mode === 'guided' && !s.paused) {
          s.paused = true; accepted = true; effects = [{type: 'PAUSE_MEDIA'}];
        }
        break;
      case 'RESUME':
        if (s.mode === 'guided' && s.paused) {
          s.paused = false; accepted = true; effects = [{type: 'RESUME_MEDIA'}];
          if (ready()) effects.push({type: 'CUE_READY', cueId: catalog.cues[s.position].id});
        }
        break;
      case 'EXPLORE':
        if (catalog.topics.has(event.topicId)) {
          if (s.mode === 'guided' && !s.checkpoint) {
            s.checkpoint = {position: s.position, paused: s.paused};
          }
          s.mode = 'explore'; s.topicId = event.topicId;
          s.generation++; s.outputs = {}; accepted = true;
          effects = [{type: 'SHOW_TOPIC', topicId: event.topicId, generation: s.generation}];
        }
        break;
      case 'RETURN_TO_TALK':
        if (s.mode === 'explore' && s.checkpoint) {
          const {position, paused} = s.checkpoint;
          s.checkpoint = null; effects = present(position); accepted = true;
          if (paused) {s.paused = true; effects.push({type: 'PAUSE_MEDIA'});}
        }
        break;
      case 'SKIP_TO_EXPLORATION':
        if (s.mode === 'guided' || s.mode === 'welcome') {
          s.generation++; s.mode = 'explore'; s.paused = false;
          s.checkpoint = null; s.outputs = {}; accepted = true;
          effects = [{type: 'ENTER_EXPLORATION', topicId: s.topicId}];
        }
        break;
      default: throw new Error('Unknown event: ' + event.type);
    }
    if (accepted) {
      record(event.type, event.type === 'OBSERVE' ? event.output + ':' + event.status : null);
      const next = snapshot();
      for (const listener of listeners) listener(next, effects);
    }
    return {accepted, state: snapshot(), effects};
  }
  const dispatch = event => process(event, 'interaction');
  const observe = observation => process({...observation, type: 'OBSERVE'}, 'observer');
  return Object.freeze({
    snapshot, dispatch, observe,
    subscribe(callback) {
      if (typeof callback !== 'function') throw new Error('Listener must be a function');
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  });
}
