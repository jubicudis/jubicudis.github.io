// Browser-only interaction prototype. All copy is explicitly development-only.
import {createExperience} from '../src/core/experience.mjs';
import {createVioletGuide} from '../src/core/violet.mjs';
import {previewCatalog, previewPlan} from './demo-content.mjs';

if (!/(?:^|\/)preview\/(?:index\.html)?$/.test(window.location.pathname)) {
  throw new Error('Development-only fixture must be served from /preview/');
}
const experience = createExperience(previewCatalog);
const violet = createVioletGuide(previewCatalog, experience, previewPlan);
const $ = id => document.getElementById(id);
const heading = $('scene-title');
const content = $('scene-content');
const status = $('observation-status');
const nameForm = $('name-form');
const controls = $('controls');
const depthControls = $('depth-controls');
const topicNavigation = $('topics');
const coverage = $('coverage-list');
let lastSceneKey = null;

function paragraph(message, className) {
  const p = document.createElement('p');
  p.textContent = message;
  if (className) p.className = className;
  return p;
}
function setControl(name, visible, enabled = true, current = false) {
  const el = document.querySelector('[data-action="' + name + '"]');
  if (!el) throw new Error('Missing action: ' + name);
  el.hidden = !visible;
  el.disabled = !enabled;
  if (current) el.setAttribute('aria-current', 'true');
  else el.removeAttribute('aria-current');
}
function paintNavigation(s) {
  const suggested = new Set(s.recommendations.map(item => item.id));
  for (const button of topicNavigation.querySelectorAll('button[data-topic]')) {
    const selected = s.presentation.mode === 'explore' &&
      s.presentation.topicId === button.dataset.topic;
    const title = previewCatalog.topics.get(button.dataset.topic).title;
    button.textContent = title + (suggested.has(button.dataset.topic) ? ' · suggested next' : '');
    button.setAttribute('aria-current', selected ? 'true' : 'false');
  }
}
function qualifyRenderedCaption(generation, expectedText) {
  // Bounded DOM/layout check, not camera/OpenCV/pixel observation or an assumption
  // that presenting a request means the visitor has read or understood it.
  window.requestAnimationFrame(() => {
    const correctGeneration = content.dataset.generation === String(generation);
    const actualText = content.textContent;
    const visible = content.isConnected && content.getClientRects().length > 0;
    experience.observe({
      generation, output: 'caption',
      status: correctGeneration && visible && actualText === expectedText
        ? 'confirmed' : 'failed'
    });
  });
}
function showScene(s) {
  const p = s.presentation, v = s.visitor;
  const isGuide = p.mode === 'guided';
  const isTopic = p.mode === 'explore' && Boolean(p.topicId);
  const cue = isGuide ? previewCatalog.cues[p.position] : null;
  const topic = isTopic ? previewCatalog.topics.get(p.topicId) : null;
  const sceneKey = p.mode === 'welcome'
    ? 'welcome:' + v.nameStatus + ':' + (v.preferredName ?? '')
    : p.mode + ':' + p.generation + ':' + s.context.extent;
  let title, nodes;
  if (p.mode === 'welcome') {
    title = 'Hello, I’m Violet';
    nodes = [paragraph(v.nameStatus === 'unasked'
      ? previewPlan.greeting.text
      : (v.preferredName ? 'Welcome, ' + v.preferredName + '. ' : 'Welcome. ') +
        'This is a working interaction preview. We can begin with the TNOS introduction, or you can choose a subject that interests you.')];
  } else if (isGuide && cue) {
    title = previewCatalog.topics.get(cue.topicId).title;
    nodes = [paragraph(cue.text)];
  } else if (isTopic && topic) {
    title = topic.title;
    const briefing = violet.briefing(topic.id, v.depth);
    nodes = briefing.claims.map(claim => paragraph(claim.statement));
  } else {
    title = 'Explore TNOS';
    nodes = [paragraph('Choose a subject. The introduction and free exploration share the same environment.')];
  }
  heading.textContent = title;
  if (lastSceneKey !== sceneKey) {
    content.replaceChildren(...nodes);
    content.dataset.generation = String(p.generation);
    lastSceneKey = sceneKey;
    if ((isGuide || isTopic) && p.outputs.caption === 'pending') {
      qualifyRenderedCaption(p.generation, content.textContent);
    }
  }
  if (isGuide && p.paused) status.textContent = 'Introduction paused. The current explanation remains available to read.';
  else if ((isGuide || isTopic) && p.outputs.caption === 'pending') status.textContent = 'Checking the rendered explanation.';
  else if ((isGuide || isTopic) && p.outputs.caption === 'confirmed') status.textContent = 'The explanation is present in the browser layout. This does not establish that it was seen or understood.';
  else if ((isGuide || isTopic) && ['failed','unavailable'].includes(p.outputs.caption))
    status.textContent = 'The output could not be confirmed. You can retry or choose another subject.';
  else status.textContent = 'Choose how you would like to continue.';
}
function paintControls(s) {
  const p = s.presentation;
  const welcomeReady = p.mode === 'welcome' && s.visitor.nameStatus !== 'unasked';
  const canStart = (p.mode === 'welcome' && welcomeReady) ||
    (p.mode === 'explore' && !p.checkpoint && !p.finishedTalk);
  const ready = p.mode === 'guided' && !p.paused &&
    Object.values(p.outputs).length > 0 &&
    Object.values(p.outputs).every(result => result === 'confirmed');
  nameForm.hidden = !(p.mode === 'welcome' && s.visitor.nameStatus === 'unasked');
  controls.hidden = p.mode === 'welcome' && s.visitor.nameStatus === 'unasked';
  setControl('start-talk', canStart);
  setControl('restart-talk', p.mode === 'explore' && !p.checkpoint && p.finishedTalk);
  setControl('next', p.mode === 'guided', ready);
  setControl('pause', p.mode === 'guided' && !p.paused);
  setControl('resume', p.mode === 'guided' && p.paused);
  setControl('retry', p.mode === 'guided' &&
    Object.values(p.outputs).some(x => x === 'failed' || x === 'unavailable'));
  setControl('return-talk', p.mode === 'explore' && Boolean(p.checkpoint));
  setControl('explore', p.mode === 'guided' || welcomeReady);
  depthControls.hidden = !(p.mode === 'explore' && p.topicId);
  setControl('overview', true, true, s.visitor.depth === 'overview');
  setControl('detail', true, true, s.visitor.depth === 'detail');
}
function paintCoverage(s) {
  coverage.replaceChildren(...s.objectives.map(obj => {
    const li = document.createElement('li');
    const words = obj.id.replace(/-/g, ' ');
    li.textContent = words + ': ' + obj.status.replace(/-/g, ' ');
    return li;
  }));
}
function render() {
  const s = violet.snapshot();
  showScene(s);
  paintControls(s);
  paintNavigation(s);
  paintCoverage(s);
}

for (const [id, topic] of previewCatalog.topics) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.topic = id;
  b.textContent = topic.title;
  topicNavigation.append(b);
}
nameForm.addEventListener('submit', event => {
  event.preventDefault();
  const typed = $('visitor-name').value;
  const result = typed.trim()
    ? violet.dispatch({type: 'PROVIDE_NAME', name: typed})
    : violet.dispatch({type: 'SKIP_NAME'});
  if (result.accepted) heading.focus();
});
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  let result = null;
  if (button.dataset.topic) {
    result = violet.dispatch({type: 'OPEN_TOPIC', topicId: button.dataset.topic});
  } else {
    switch (button.dataset.action) {
      case 'skip-name': result = violet.dispatch({type: 'SKIP_NAME'}); break;
      case 'start-talk': result = violet.dispatch({type: 'START_TALK'}); break;
      case 'restart-talk': result = violet.dispatch({type: 'RESTART_TALK'}); break;
      case 'return-talk': result = violet.dispatch({type: 'RETURN_TO_TALK'}); break;
      case 'explore': result = violet.dispatch({type: 'SKIP_TO_EXPLORATION'}); break;
      case 'overview': result = violet.dispatch({type: 'SET_DEPTH', depth: 'overview'}); break;
      case 'detail': result = violet.dispatch({type: 'SET_DEPTH', depth: 'detail'}); break;
      case 'next': result = experience.dispatch({type: 'NEXT'}); break;
      case 'pause': result = experience.dispatch({type: 'PAUSE'}); break;
      case 'resume': result = experience.dispatch({type: 'RESUME'}); break;
      case 'retry': result = experience.dispatch({type: 'RETRY'}); break;
    }
  }
  if (result?.accepted && !['overview','detail','pause','resume'].includes(button.dataset.action)) {
    heading.focus();
  }
});
experience.subscribe(render);
violet.subscribe(render);
violet.dispatch({type: 'ARRIVE'});
render();
