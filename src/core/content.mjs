// TNOS Pages public-content authority. Never import the private audit master.
const PRODUCTS = new Set(['tnos', 'workbench', 'mcp']);
const KINDS = new Set(['intended', 'implemented', 'demonstrated']);
const BASES = new Set(['inventor_design', 'source_inspection', 'inventor_report', 'execution_record', 'independent_verification']);
const OUTPUTS = new Set(['caption', 'visual', 'narration']);
const nonempty = s => typeof s === 'string' && s.trim().length > 0;
function check(ok, message) {
  if (!ok) throw new Error('Public content rejected: ' + message);
}
function index(items, label) {
  check(Array.isArray(items), label + ' must be an array');
  const map = new Map();
  for (const item of items) {
    check(item && nonempty(item.id) && !map.has(item.id), 'missing/duplicate ' + label + ' ID');
    map.set(item.id, Object.freeze({...item}));
  }
  return map;
}

export function createPublicCatalog({claims = [], topics = [], cues = []} = {}) {
  const byClaim = index(claims, 'claim');
  for (const c of byClaim.values()) {
    check(c.approvedForPublic === true, 'claim ' + c.id + ' not approved');
    check(PRODUCTS.has(c.product), 'claim ' + c.id + ' invalid product');
    check(KINDS.has(c.kind), 'claim ' + c.id + ' invalid class');
    check(BASES.has(c.basis), 'claim ' + c.id + ' missing evidence basis');
    check(nonempty(c.statement) && nonempty(c.source), 'claim ' + c.id + ' missing statement/source');
    check(!(c.kind === 'implemented' && c.basis === 'inventor_design'),
      'claim ' + c.id + ' confuses design with implementation');
    check(!(c.kind === 'demonstrated' && !['execution_record', 'independent_verification'].includes(c.basis)),
      'claim ' + c.id + ' requires execution evidence');
  }
  const byTopic = index(topics, 'topic');
  for (const t of byTopic.values()) {
    check(t.approvedForPublic === true && nonempty(t.title), 'topic ' + t.id + ' not approved');
    check(Array.isArray(t.claimIds), 'topic ' + t.id + ' has no claim references');
    for (const id of t.claimIds) check(byClaim.has(id), 'topic ' + t.id + ': unknown claim ' + id);
    for (const id of t.relatedTopicIds ?? []) {
      check(byTopic.has(id), 'topic ' + t.id + ': unknown related topic ' + id);
    }
  }
  const byCue = index(cues, 'cue');
  for (const cue of byCue.values()) {
    check(cue.approvedForPublic === true && nonempty(cue.text), 'cue ' + cue.id + ' not approved');
    check(byTopic.has(cue.topicId), 'cue ' + cue.id + ': unknown topic');
    check(Array.isArray(cue.claimIds) && cue.claimIds.length > 0,
      'cue ' + cue.id + ': no claim references');
    for (const id of cue.claimIds) check(byClaim.has(id), 'cue ' + cue.id + ': unknown claim ' + id);
    check(Array.isArray(cue.requiredOutputs) && cue.requiredOutputs.includes('caption'),
      'cue ' + cue.id + ': caption required');
    check(cue.requiredOutputs.every(x => OUTPUTS.has(x)), 'cue ' + cue.id + ': invalid output');
    check(new Set(cue.requiredOutputs).size === cue.requiredOutputs.length,
      'cue ' + cue.id + ': duplicate output');
  }
  return Object.freeze({
    claims: byClaim, topics: byTopic, cues: Object.freeze([...byCue.values()]),
    relatedTo(topicId) {
      return (byTopic.get(topicId)?.relatedTopicIds ?? []).map(id => byTopic.get(id));
    }
  });
}
