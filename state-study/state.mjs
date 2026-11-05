// Browser-only educational state propagation model.
// This is NOT the native TNOS runtime, a hardware sensor, or proof of Stage 1-9 execution.
// One authority supplies state; the renderer and captions are qualified consumers.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const copy = value => structuredClone(value);

export function createStateStudy() {
  let s = {
    revision: 0,
    physical: {doorAngle: 0, targetAngle: 0, motion: 'settled'},
    evidence: {status: 'pending', revision: null, measuredAngle: null, source: null},
    runtime: {status: 'unestablished', revision: null, doorOpen: null, access: 'unestablished', context: null},
    passage: {status: 'idle', revision: null, position: 0, observation: null},
    feedback: {successfulPassages: 0, revision: null, last: 'no observation yet'},
    trace: []
  };
  const listeners = new Set();
  const emit = (type, detail) => {
    s.trace = [...s.trace.slice(-15), {type, revision: s.revision, detail}];
    const snapshot = copy(s);
    for (const listener of listeners) listener(snapshot, type);
    return snapshot;
  };
  function changeEnvironment(open) {
    if (typeof open !== 'boolean') throw new TypeError('A simulated door state must be Boolean');
    s.revision++;
    s.physical.targetAngle = open ? 1.33 : 0;
    s.physical.motion = 'requested';
    // Do NOT carry an older admissible measurement into a new physical revision.
    s.evidence = {status: 'pending', revision: s.revision, measuredAngle: null, source: 'browser-scene-model'};
    s.runtime = {status: 'awaiting-observation', revision: null, doorOpen: null, access: 'unestablished', context: null};
    s.passage = {status: 'idle', revision: null, position: 0, observation: null};
    emit('ENVIRONMENT_CHANGED', open ? 'door-open-requested' : 'door-close-requested');
    return copy(s);
  }
  function observeDoor({revision, angle, source = 'browser-scene-model'}) {
    if (revision !== s.revision) return {accepted: false, reason: 'stale-revision'};
    if (!finite(angle) || source !== 'browser-scene-model')
      return {accepted: false, reason: 'inadmissible-source-or-reading'};
    const target = s.physical.targetAngle;
    if (Math.abs(angle - target) > 0.035)
      return {accepted: false, reason: 'motion-not-yet-settled'};
    s.physical.doorAngle = angle;
    s.physical.motion = 'settled';
    s.evidence = {status: 'admitted', revision, measuredAngle: angle, source};
    const doorOpen = angle > 1.15;
    s.runtime = {
      status: 'grounded-in-simulation', revision, doorOpen,
      access: doorOpen ? 'permitted' : 'blocked',
      context: {
        who: 'visitor not identified', what: 'simulated doorway',
        when: 'event revision ' + revision, where: 'browser room model',
        why: 'environment changed independently of a new message',
        how: 'browser model angle checked against requested motion',
        extent: Math.round(angle * 180 / Math.PI) + '° opening'
      }
    };
    emit('MEASUREMENT_ADMITTED', doorOpen ? 'passage-permitted' : 'passage-blocked');
    return {accepted: true, state: copy(s)};
  }
  function requestPassage() {
    if (s.evidence.status !== 'admitted' || s.runtime.revision !== s.revision) {
      emit('PASSAGE_HELD', 'No admitted measurement for current revision');
      return {accepted: false, reason: 'unestablished-state'};
    }
    if (s.runtime.access !== 'permitted') {
      emit('PASSAGE_BLOCKED', 'The currently established doorway state is closed');
      return {accepted: false, reason: 'door-closed'};
    }
    if (s.passage.status === 'requested') return {accepted: false, reason: 'already-requested'};
    s.passage = {status: 'requested', revision: s.revision, position: 0, observation: null};
    emit('PASSAGE_REQUESTED', 'Awaiting observed model crossing');
    return {accepted: true, state: copy(s)};
  }
  function observePassage({revision, position}) {
    if (revision !== s.revision || s.passage.revision !== revision || s.passage.status !== 'requested')
      return {accepted: false, reason: 'no-current-request'};
    if (!finite(position) || position < 0.975) return {accepted: false, reason: 'not-observed-complete'};
    if (s.runtime.access !== 'permitted') return {accepted: false, reason: 'permission-revoked'};
    s.passage = {status: 'observed', revision, position: clamp(position, 0, 1), observation: 'browser-model-target-reached'};
    s.feedback = {
      successfulPassages: s.feedback.successfulPassages + 1,
      revision, last: 'Model crossing observed; next decision uses this updated history'
    };
    emit('OUTCOME_OBSERVED', 'feedback-updated');
    return {accepted: true, state: copy(s)};
  }
  return Object.freeze({
    snapshot: () => copy(s), changeEnvironment, observeDoor, requestPassage, observePassage,
    subscribe(fn) {
      if (typeof fn !== 'function') throw new TypeError('Listener required');
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  });
}
