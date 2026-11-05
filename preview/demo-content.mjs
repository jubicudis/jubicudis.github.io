// DEVELOPMENT FIXTURE ONLY. This is not approved TNOS publication copy.
// Keep synthetic copy confined to /preview/, never import it from the public entry point.
import {createPublicCatalog} from '../src/core/content.mjs';

const provisional = (id, product, statement) => ({
  id, product, statement, source: 'DEV-ONLY placeholder; no project evidence asserted',
  approvedForPublic: true, kind: 'intended', basis: 'inventor_design'
});
export const previewCatalog = createPublicCatalog({
  claims: [
    provisional('t1','tnos','This is a temporary slot for explaining what the TNOS operating-system experience is intended to become.'),
    provisional('t2','tnos','The full TNOS architectural explanation will be curated from the existing public master and reviewed before publication.'),
    provisional('o1','tnos','This temporary slot will present Jubi’s account of how TNOS began and why its development continues.'),
    provisional('w1','workbench','This temporary slot will explain the Workbench’s role in building, examining, and troubleshooting TNOS.'),
    provisional('w2','workbench','Approved Workbench visuals and evidence can be shown here after their status has been established.'),
    provisional('m1','mcp','This temporary slot will explain the purpose and current status of the separate TNOS MCP server.'),
    provisional('s1','tnos','This temporary slot will explain Jubi’s development needs and the voluntary GitHub Sponsors opportunity.')
  ],
  topics: [
    {id:'tnos',title:'Meet TNOS',approvedForPublic:true,claimIds:['t1','t2'],
      overviewClaimIds:['t1'],detailClaimIds:['t1','t2'],relatedTopicIds:['origin','workbench']},
    {id:'origin',title:'Why Jubi began',approvedForPublic:true,claimIds:['o1'],relatedTopicIds:['tnos']},
    {id:'workbench',title:'TNOS Workbench',approvedForPublic:true,claimIds:['w1','w2'],
      overviewClaimIds:['w1'],detailClaimIds:['w1','w2'],relatedTopicIds:['mcp','tnos']},
    {id:'mcp',title:'TNOS MCP server',approvedForPublic:true,claimIds:['m1'],relatedTopicIds:['tnos','workbench']},
    {id:'support',title:'Why sponsorship matters',approvedForPublic:true,claimIds:['s1'],relatedTopicIds:['tnos']}
  ],
  cues: [
    {id:'opening',topicId:'tnos',approvedForPublic:true,
      text:'This is a development-only narration cue. Violet will introduce the intended TNOS experience here.',
      claimIds:['t1'],requiredOutputs:['caption']},
    {id:'origin',topicId:'origin',approvedForPublic:true,
      text:'This cue is reserved for the inventor’s origin story and reason for developing TNOS.',
      claimIds:['o1'],requiredOutputs:['caption']},
    {id:'workbench',topicId:'workbench',approvedForPublic:true,
      text:'Here Violet will explain the Workbench and what the actual development evidence establishes.',
      claimIds:['w1'],requiredOutputs:['caption']},
    {id:'mcp',topicId:'mcp',approvedForPublic:true,
      text:'Here Violet will explain the separate MCP server without presenting it as the native TNOS operating system.',
      claimIds:['m1'],requiredOutputs:['caption']},
    {id:'support',topicId:'support',approvedForPublic:true,
      text:'Here Violet will connect the work shown to Jubi’s actual sponsorship needs and offer a voluntary next step.',
      claimIds:['s1'],requiredOutputs:['caption']}
  ]
});

export const previewPlan = {
  greeting: {approvedForPublic:true,
    text:"Hello, I'm Violet. Welcome to the TNOS website interaction preview. What should I call you?"},
  route:['tnos','origin','workbench','mcp','support'],
  objectives: [
    {id:'introduce-tnos',topicIds:['tnos']},
    {id:'explain-origin',topicIds:['origin']},
    {id:'explain-workbench',topicIds:['workbench']},
    {id:'explain-mcp',topicIds:['mcp']},
    {id:'connect-sponsorship',topicIds:['support']}
  ]
};
