// Violet's browser presentation guide. No model, surveillance or visitor profiling.
// The existing experience engine remains the only authority for presentation position.
// This guide owns only voluntary communication preferences and explicit visitor intent.
const MODES = new Set(['text', 'voice-and-text']);
const DEPTHS = new Set(['overview', 'detail']);
const cleanName = input => {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
};
const reject = message => { throw new Error('Violet guide: ' + message); };

export function createVioletGuide(catalog, experience, plan = {}) {
  if (!(catalog?.topics instanceof Map) || !(catalog?.claims instanceof Map) ||
      typeof experience?.dispatch !== 'function' || typeof experience?.snapshot !== 'function') {
    reject('validated catalog and experience engine required');
  }
  const route = plan.route ?? [];
  if (!Array.isArray(route) || new Set(route).size !== route.length ||
      route.some(id => !catalog.topics.has(id))) reject('route must contain distinct approved topic IDs');
  const goals = plan.objectives ?? [];
  if (!Array.isArray(goals) || new Set(goals.map(g => g?.id)).size !== goals.length ||
      goals.some(g => !g || typeof g.id !== 'string' || !g.id ||
        !Array.isArray(g.topicIds) || !g.topicIds.length ||
        g.topicIds.some(id => !catalog.topics.has(id)))) {
    reject('objectives require unique IDs and approved topic coverage');
  }
  if (plan.greeting !== undefined &&
      (!plan.greeting || plan.greeting.approvedForPublic !== true ||
       typeof plan.greeting.text !== 'string' || !plan.greeting.text.trim())) {
    reject('greeting requires inventor-approved public text');
  }
  let visitor = {
    greetingOffered: false, nameStatus: 'unasked', preferredName: null,
    delivery: 'text', depth: 'overview', intent: null,
    openedTopicIds: []
  };
  const listeners = new Set();
  const presentedTopics = new Set();
  const presentedCues = new Set();
  experience.subscribe((_state, effects) => {
    for (const effect of effects) {
      if (effect.type === 'TOPIC_READY') presentedTopics.add(effect.topicId);
      if (effect.type === 'CUE_READY') {
        presentedCues.add(effect.cueId);
        const cue = catalog.cues.find(item => item.id === effect.cueId);
        if (cue && catalog.cues.filter(item => item.topicId === cue.topicId)
          .every(item => presentedCues.has(item.id))) presentedTopics.add(cue.topicId);
      }
    }
  });
  function objectiveStatus() {
    return goals.map(g => {
      const shown = g.topicIds.filter(id => presentedTopics.has(id));
      return {id: g.id, status: shown.length === g.topicIds.length ? 'presented' :
        shown.length ? 'partially-presented' : 'not-presented',
        presentedTopicIds: shown};
    });
  }
  const state = () => structuredClone(visitor);
  const context = () => {
    const presentation = experience.snapshot();
    return {
      who: visitor.preferredName, // unknown by default; never an expertise label
      what: presentation.topicId,
      when: presentation.mode,
      where: {environment: 'TNOS Pages', cuePosition: presentation.position},
      why: visitor.intent, // only an explicitly selected activity
      how: visitor.delivery,
      extent: visitor.depth
    };
  };
  function recommendations(limit = 3) {
    const snap = experience.snapshot();
    const explicitRelated = catalog.topics.get(snap.topicId)?.relatedTopicIds ?? [];
    const unmet = goals.filter(g => g.topicIds.some(id => !presentedTopics.has(id)))
      .flatMap(g => g.topicIds.filter(id => !presentedTopics.has(id)));
    const order = [...explicitRelated, ...unmet, ...route, ...catalog.topics.keys()];
    const unique = [...new Set(order)].filter(id => id !== snap.topicId && catalog.topics.has(id));
    return unique.filter(id => !visitor.openedTopicIds.includes(id)).concat(
      unique.filter(id => visitor.openedTopicIds.includes(id))
    ).slice(0, Math.min(3, Math.max(0, Number.isInteger(limit) ? limit : 3)))
      .map(id => ({id, title: catalog.topics.get(id).title}));
  }
  function briefing(topicId, depth = visitor.depth) {
    const topic = catalog.topics.get(topicId);
    if (!topic) reject('unknown approved topic');
    if (!DEPTHS.has(depth)) reject('invalid explanation depth');
    // Curated claim references, never generated text or inferred technical claims.
    const overview = topic.overviewClaimIds ?? topic.claimIds;
    const detail = topic.detailClaimIds ?? topic.claimIds;
    const ids = depth === 'overview' ? overview : [...new Set([...overview, ...detail])];
    if (!Array.isArray(ids) || ids.some(id => !catalog.claims.has(id))) {
      reject('topic contains unauthorized claim references');
    }
    return {
      topicId, title: topic.title, depth,
      claims: ids.map(id => {
        const {statement, kind, basis, source, product} = catalog.claims.get(id);
        return {id, statement, kind, basis, source, product};
      })
    };
  }
  function notify(result) {
    const snap = snapshot();
    for (const listener of listeners) listener(snap, result);
    return {...result, snapshot: snap};
  }
  function snapshot() {
    return {visitor: state(), presentation: experience.snapshot(), context: context(),
      recommendations: recommendations(), objectives: objectiveStatus()};
  }
  function dispatch(event) {
    if (!event || typeof event.type !== 'string') reject('typed event required');
    let result;
    switch (event.type) {
      case 'ARRIVE':
        if (visitor.greetingOffered) return {accepted: false, snapshot: snapshot()};
        visitor.greetingOffered = true;
        result = {accepted: true, effect: {type: 'OFFER_GREETING',
          // Copy belongs to approved authored content, never invented by the planner.
          text: plan.greeting?.text ?? null, nameOptional: true}};
        break;
      case 'PROVIDE_NAME': {
        if (!visitor.greetingOffered || visitor.nameStatus !== 'unasked')
          return {accepted: false, snapshot: snapshot()};
        const name = cleanName(event.name);
        if (!name) return {accepted: false, snapshot: snapshot()};
        visitor.preferredName = name;
        visitor.nameStatus = 'provided';
        result = {accepted: true, effect: {type: 'WELCOME_VISITOR', preferredName: name}};
        break;
      }
      case 'SKIP_NAME':
        if (!visitor.greetingOffered || visitor.nameStatus !== 'unasked')
          return {accepted: false, snapshot: snapshot()};
        visitor.nameStatus = 'skipped';
        result = {accepted: true, effect: {type: 'WELCOME_VISITOR', preferredName: null}};
        break;
      case 'SET_DELIVERY':
        if (!MODES.has(event.delivery)) reject('invalid delivery preference');
        visitor.delivery = event.delivery;
        result = {accepted: true, effect: {type: 'DELIVERY_UPDATED', delivery: visitor.delivery}};
        break;
      case 'SET_DEPTH': {
        if (!DEPTHS.has(event.depth)) reject('invalid detail preference');
        if (visitor.depth === event.depth) return {accepted: false, snapshot: snapshot()};
        visitor.depth = event.depth;
        const snap = experience.snapshot();
        const effects = snap.mode === 'explore' && snap.topicId
          ? experience.dispatch({type: 'EXPLORE', topicId: snap.topicId}).effects : [];
        result = {accepted: true, effects, effect: {type: 'DEPTH_UPDATED', depth: visitor.depth}};
        break;
      }
      case 'RESTART_TALK': {
        const r = experience.dispatch({type: 'RESTART_TALK'});
        if (!r.accepted) return {accepted: false, snapshot: snapshot()};
        visitor.intent = 'guided-introduction';
        result = {accepted: true, effects: r.effects};
        break;
      }
      case 'START_TALK': {
        // A name is not required; the visitor has already chosen to begin.
        const r = experience.dispatch({type: 'START'});
        if (!r.accepted) return {accepted: false, snapshot: snapshot()};
        visitor.intent = 'guided-introduction';
        result = {accepted: true, effects: r.effects};
        break;
      }
      case 'OPEN_TOPIC': {
        if (!catalog.topics.has(event.topicId)) reject('unknown approved topic');
        const r = experience.dispatch({type: 'EXPLORE', topicId: event.topicId});
        if (!r.accepted) return {accepted: false, snapshot: snapshot()};
        visitor.intent = 'explore:' + event.topicId;
        if (!visitor.openedTopicIds.includes(event.topicId))
          visitor.openedTopicIds.push(event.topicId);
        result = {accepted: true, effects: r.effects,
          briefing: briefing(event.topicId)};
        break;
      }
      case 'RETURN_TO_TALK': {
        const r = experience.dispatch({type: 'RETURN_TO_TALK'});
        if (!r.accepted) return {accepted: false, snapshot: snapshot()};
        visitor.intent = 'guided-introduction';
        result = {accepted: true, effects: r.effects};
        break;
      }
      case 'SKIP_TO_EXPLORATION': {
        const r = experience.dispatch({type: 'SKIP_TO_EXPLORATION'});
        if (!r.accepted) return {accepted: false, snapshot: snapshot()};
        visitor.intent = 'free-exploration';
        result = {accepted: true, effects: r.effects};
        break;
      }
      default: reject('unknown action: ' + event.type);
    }
    return notify(result);
  }
  return Object.freeze({
    snapshot, dispatch, recommendations, briefing,
    subscribe(listener) {
      if (typeof listener !== 'function') reject('listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
