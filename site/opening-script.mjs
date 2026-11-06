// Approved Violet Revision 2, November 6, 2026.
// This is presentation content, not a set of animation triggers.
// A family of segments supplies narration, captions and exact audio tracks.
export const INTRO_SEGMENTS=Object.freeze([
  "Hello, I'm Violet.",
  "I'm a visual representation of the interface being designed for Tranquility Neuro Operating System, or TNOS.",
  "You've arrived at the project's public introduction, and I'm here to help you understand what TNOS is, why it's being developed, and what makes it different.",
  "Before we begin, may I ask what to call you? You can share a name, or we can continue without one."
]);
export const AFTER_NAME_SEGMENTS=Object.freeze([
  Object.freeze({phase:'welcome',text:"Welcome. I'm glad you're here."}),
  Object.freeze({phase:'orientation',text:"TNOS is an experimental operating system being developed around a different foundation for intelligent computing."}),
  Object.freeze({phase:'orientation',text:"Its design aims to connect intelligent computation with the physical state of the computer and the context in which it operates."}),
  Object.freeze({phase:'orientation',text:"I'll begin by showing you the kind of experience TNOS is intended to create. From there, we'll explore what makes the underlying design different, what's already been built, and what remains under development."}),
  Object.freeze({phase:'orientation',text:"Along the way, I'll explain what the Workbench is, why it's being developed, and how it helps with the engineering of TNOS."}),
  Object.freeze({phase:'orientation',text:"We'll also explore the separate MCP server, what it is, and how it's intended to connect selected capabilities with other tools."}),
  Object.freeze({phase:'orientation',text:"As we go, I'll distinguish between the intended design, what has actually been demonstrated, and the work that's still in progress."}),
  Object.freeze({phase:'orientation',text:"I'll explain each part as we reach it, so everything you discover builds on what you've already learned."}),
  Object.freeze({phase:'presentation',text:"Let's begin with something familiar."}),
  Object.freeze({phase:'presentation',text:"Imagine turning on your computer."}),
  Object.freeze({phase:'presentation',text:"But instead of being greeted by the usual desktop, you're welcomed by a visual interface that helps you understand your computer and work with it."}),
  Object.freeze({phase:'presentation',text:"An interface much like the one you're interacting with right now."}),
  Object.freeze({phase:'presentation',text:"That's part of the experience TNOS is being developed to create."}),
  Object.freeze({phase:'presentation',text:"But what you're seeing here is only a representation of that intended experience. You're not actually running TNOS in your browser."}),
  Object.freeze({phase:'presentation',text:"And the larger idea goes much deeper than the interface itself."}),
  Object.freeze({phase:'presentation',text:"To understand what makes TNOS different, we need to look beneath what you can see."}),
  Object.freeze({phase:'presentation',text:"Because the real difference begins with the operating system itself."})
]);
// A named visitor receives an additional Heart-generated spoken line AFTER
// the first four recorded after-name paragraphs (roughly 30 seconds of
// uninterrupted orientation). This is an explicit script slot, not a change
// to the immutable prerecorded Heart track or its measured cue positions.
// Skipped names do not use this slot.
export const VISITOR_NAME_SLOT=Object.freeze({
  track:'after-name',
  phase:'orientation',
  kind:'generated-visitor-name',
  afterCueIndex:3,
  beforeCueIndex:4,
  text:visitorName=>visitorName+", let's continue."
});
// The actual named-visitor script includes this required dynamic speech line.
// The prerecorded Heart media still contains only the static paragraphs.
export const NAMED_VISITOR_SCRIPT=Object.freeze([
  ...AFTER_NAME_SEGMENTS.slice(0,VISITOR_NAME_SLOT.beforeCueIndex),
  VISITOR_NAME_SLOT,
  ...AFTER_NAME_SEGMENTS.slice(VISITOR_NAME_SLOT.beforeCueIndex)
]);
export const OPENING_TRACKS=Object.freeze({
  'asking-name':Object.freeze(INTRO_SEGMENTS.map(text=>Object.freeze({phase:'asking-name',text}))),
  'after-name':AFTER_NAME_SEGMENTS
});
export function openingTrackForPhase(phase){
  if(phase==='asking-name')return 'asking-name';
  if(['welcome','orientation','presentation'].includes(phase))return 'after-name';
  return null;
}
export function visibleOpeningSegment(track,index,visitorName=null){
  const segments=OPENING_TRACKS[track];
  if(!segments || !Number.isSafeInteger(index)||index<0||index>=segments.length)
    throw new RangeError('Opening narration segment must exist in an approved track');
  const segment=segments[index];
  // Static Heart narration must not claim to have pronounced an arbitrary name.
  // The visitor's voluntary name remains part of the visible welcome.
  if(track==='after-name'&&index===0&&visitorName)
    return 'Welcome, '+visitorName+". I'm glad you're here.";
  return segment.text;
}
