import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicCatalog} from '../src/core/content.mjs';
import {createExperience} from '../src/core/experience.mjs';
import {createVioletGuide} from '../src/core/violet.mjs';

function fixture() {
  const catalog = createPublicCatalog({
    claims: [
      {id:'c1',approvedForPublic:true,product:'tnos',kind:'intended',basis:'inventor_design',statement:'TNOS is intended to ...',source:'Approved test fixture'},
      {id:'c2',approvedForPublic:true,product:'workbench',kind:'implemented',basis:'source_inspection',statement:'Workbench code exists.',source:'Approved test fixture'},
      {id:'c3',approvedForPublic:true,product:'mcp',kind:'intended',basis:'inventor_design',statement:'MCP is intended to ...',source:'Approved test fixture'}
    ],
    topics:[
      {id:'tnos',approvedForPublic:true,title:'TNOS',claimIds:['c1'],relatedTopicIds:['workbench']},
      {id:'workbench',approvedForPublic:true,title:'Workbench',claimIds:['c2'],relatedTopicIds:['mcp']},
      {id:'mcp',approvedForPublic:true,title:'MCP',claimIds:['c3'],relatedTopicIds:[]}
    ],
    cues:[
      {id:'intro',approvedForPublic:true,topicId:'tnos',text:'Approved cue',claimIds:['c1'],requiredOutputs:['caption']},
      {id:'workbench',approvedForPublic:true,topicId:'workbench',text:'Approved second cue',claimIds:['c2'],requiredOutputs:['caption']}
    ]
  });
  const engine = createExperience(catalog);
  const guide = createVioletGuide(catalog, engine, {
    route:['tnos','workbench','mcp'], greeting:{approvedForPublic:true,text:'Sample greeting (test only)'}
  });
  return {catalog,engine,guide};
}

test('greeting is offered once; optional name is local and sanitized; no knowledge assumed', () => {
  const {guide} = fixture();
  assert.equal(guide.dispatch({type:'ARRIVE'}).effect.nameOptional,true);
  assert.equal(guide.dispatch({type:'ARRIVE'}).accepted,false);
  assert.equal(guide.snapshot().context.who,null);
  assert.equal(guide.dispatch({type:'PROVIDE_NAME',name:'  Ada\n Lovelace  '}).accepted,true);
  assert.equal(guide.snapshot().context.who,'Ada Lovelace');
  assert.equal(guide.snapshot().visitor.intent,null);
  assert.equal(guide.dispatch({type:'PROVIDE_NAME',name:'Other'}).accepted,false);
});

test('the visitor can decline the name without being blocked', () => {
  const {guide} = fixture();
  guide.dispatch({type:'ARRIVE'});
  guide.dispatch({type:'SKIP_NAME'});
  assert.equal(guide.snapshot().visitor.preferredName,null);
  assert.equal(guide.dispatch({type:'START_TALK'}).accepted,true);
  assert.equal(guide.snapshot().presentation.mode,'guided');
});

test('relevance follows explicit topic choice, not inferred expertise', () => {
  const {guide} = fixture();
  guide.dispatch({type:'ARRIVE'});
  guide.dispatch({type:'SET_DEPTH',depth:'detail'});
  const opened = guide.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  assert.equal(opened.briefing.topicId,'workbench');
  assert.equal(guide.snapshot().context.why,'explore:workbench');
  assert.equal(guide.snapshot().context.extent,'detail');
  assert.equal(guide.snapshot().recommendations[0].id,'mcp');
  assert.equal(opened.briefing.claims[0].statement,'Workbench code exists.');
});

test('topic selection does not prove understanding or completed rendering', () => {
  const {guide,engine} = fixture();
  guide.dispatch({type:'OPEN_TOPIC',topicId:'tnos'});
  assert.equal(engine.snapshot().mode,'explore');
  assert.ok(!Object.hasOwn(guide.snapshot().visitor,'understood'));
  assert.ok(guide.snapshot().visitor.openedTopicIds.includes('tnos'));
});

test('interrupt and return retains the underlying talk position', () => {
  const {guide,engine} = fixture();
  guide.dispatch({type:'START_TALK'});
  const before=engine.snapshot();
  guide.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  assert.equal(engine.snapshot().mode,'explore');
  assert.equal(engine.snapshot().checkpoint.position,before.position);
  const back=guide.dispatch({type:'RETURN_TO_TALK'});
  assert.equal(back.accepted,true);
  assert.equal(engine.snapshot().position,before.position);
  assert.equal(engine.snapshot().mode,'guided');
});

test('old observations cannot authorize resumed cue', () => {
  const {guide,engine} = fixture();
  guide.dispatch({type:'START_TALK'});
  const old=engine.snapshot().generation;
  guide.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  guide.dispatch({type:'RETURN_TO_TALK'});
  assert.equal(engine.observe({generation:old,output:'caption',status:'confirmed'}).accepted,false);
  assert.equal(engine.dispatch({type:'NEXT'}).accepted,false);
  assert.equal(engine.observe({generation:engine.snapshot().generation,output:'caption',status:'confirmed'}).accepted,true);
  assert.equal(engine.dispatch({type:'NEXT'}).accepted,true);
});

test('impossible content claims remain excluded', () => {
  assert.throws(()=>createPublicCatalog({claims:[{
    id:'x',approvedForPublic:true,product:'tnos',kind:'demonstrated',basis:'inventor_design',statement:'Claim',source:'Missing execution'
  }]}),/requires execution evidence/);
});

test('starting the talk is still possible after exploring on arrival', () => {
  const {guide,engine} = fixture();
  guide.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  assert.equal(guide.dispatch({type:'START_TALK'}).accepted,true);
  assert.equal(engine.snapshot().mode,'guided');
});

test('exploratory content requires observed presentation before being marked ready', () => {
  const {guide,engine} = fixture();
  guide.dispatch({type:'OPEN_TOPIC',topicId:'workbench'});
  const g = engine.snapshot().generation;
  assert.equal(engine.snapshot().outputs.caption,'pending');
  assert.equal(engine.observe({generation:g-1,output:'caption',status:'confirmed'}).accepted,false);
  const o = engine.observe({generation:g,output:'caption',status:'confirmed'});
  assert.equal(o.accepted,true);
  assert.equal(o.effects[0].type,'TOPIC_READY');
});
