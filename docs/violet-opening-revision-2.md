# Violet — approved opening script (Revision 2)

Approved by the inventor on 2026-11-06. This is the single content source for
the public Violet greeting, optional name exchange, informative orientation,
and opening of the TED-style presentation.

## Content authority
The exact spoken paragraphs are in site/opening-script.mjs. Both UI captions
and Heart audio are derived from those segments. The original name question
is reached through the informative greeting, not used in isolation.

Opening sequence:
1. Introduce Violet as a visual representation of the interface being designed for TNOS; identify where the visitor has arrived, what they will learn, and the optional name question.
2. Personal acknowledgment (with or without a name). Optional name is displayed, but no false assertion is made that a fixed Heart recording pronounced an arbitrary visitor name.
3. Informative orientation explaining TNOS's aims, what the Workbench is and why it exists, the separate MCP server, and distinctions between intended designs, demonstrated results and in-progress work.
4. Presentation begins with the familiar example of powering on a computer, then distinguishes the web representation from a running TNOS installation and leads to the operating system itself.

## Delivery architecture
The presentation state governs the sequence. Audio returns only observed
start, playback-position, completion, interruption, or failure. Caption
boundaries come from measured lengths of the individual segments in the
actual recorded Heart tracks. No independent text-rotation timers.
The mobile page must not show the entire long presentation text at once.
No conventional menus, fake buttons, chapters or inferred content.

Voice: selected Kokoro af_heart, free Apache-2.0 model, natural pitch.
The accepted Structured Bloom A2 artwork is not altered.
No unapproved presentation material follows the approved final line.
