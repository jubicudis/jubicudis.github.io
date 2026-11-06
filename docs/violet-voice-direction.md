# Violet — approved Heart voice and Revision 2 execution

**Approved voice:** Kokoro `af_heart` (American female), selected by the inventor
on November 6, 2026. Light, soft and airy, natural comfortable pitch.
The alternate Nicole and Emma auditions are not selected.

**Source of truth:** `site/opening-script.mjs` owns the exact spoken and
visible Revision 2 text. No UI-specific alternative transcript or speech
timers are allowed. TNOS (the native operating system), the Workbench,
and the separate MCP server are accurately distinguished.

## Actual visitor and audio state

1. Activation authorizes one prerecorded Heart opening with four paragraphs,
   including Violet's purpose and the optional name question.
2. The name question becomes interactive only when the real greeting audio
   completes. A technical failure or interruption is **diagnostic only**;
   it may not forge a completed name question or alternative presentation.
3. Skipping the optional name plays the approved `after-name` recording.
4. Providing a name also starts the approved `after-name` recording immediately. Name synthesis runs concurrently, not as a silent prerequisite to narration.
5. The same selected Heart voice synthesizes a brief later acknowledgment of the visitor's name. If it becomes ready, the presentation inserts it at an observed later paragraph boundary and resumes the recorded Heart narration at the observed position. No synthetic timing, alternate voice, or invented name completion is permitted. If inference fails, the name is not claimed to have been spoken.
6. Captions and approved topic changes follow the observed audio clock,
   not speculative timeouts. The actual viseme evidence drives Violet's
   existing A2 mouth textures during generated speech.
7. The scripted experience stops at its approved final sentence about
   the operating system. The projection apparatus and subsequent narrative
   are outside this implementation.

## Real capabilities and qualifications

- `tools/generate_approved_opening.py` creates the main prerecorded
  Kokoro Heart narration offline, without per-visitor usage charges.
- `site/violet-dynamic-name.mjs` supports on-demand, in-browser Heart
  synthesis. The selected runtime is based on observed browser capability;
  no alternate presenter voice is configured.
- The HeadTTS runtime provides timed Oculus visemes which are rendered
  using the already-approved four A2 mouth poses. Four poses do **not**
  constitute full phoneme-level facial fidelity; further qualification
  and visual review are required.
- Actual Chromium synthesis of `Welcome, Morgan. I'm glad you're here.`
  was observed, producing 2.95 seconds of audio and 23 timed visemes.
  Initial model synthesis was measured at approximately 28 seconds
  in that browser test. Other device speeds and iPhone Safari remain
  **unverified** until actually tested.
- Dynamic speech generated on the visitor's device requires browser
  inference resources. The module is requested only for a provided name.
  This is a resource consequence, not a new fictional presentation state.
- The current prerecorded narration still needs its own qualified
  audio-to-face alignment. Observed generated-name visemes alone do
  not establish full-narration lip synchronization.

## Media and provenance

- `site/audio/violet-heart-asking-name.mp3`
- `site/audio/violet-heart-after-name.mp3` (skip-name path)
- `site/audio/violet-heart-post-welcome.mp3` (retained historical recording; not used by deferred-name route)
- `site/audio/heart-timeline.json` (actual measured paragraph timing)
- `site/audio/heart-continuation-provenance.json` and SHA-256 evidence

Kokoro model/voices: Apache 2.0
https://huggingface.co/hexgrad/Kokoro-82M

The `kokoro-onnx` inference runtime: MIT
https://github.com/thewh1teagle/kokoro-onnx

HeadTTS browser implementation: MIT
https://github.com/met4citizen/HeadTTS

All work is committed directly to the existing `main` branch. Violet's
approved Structured Bloom A2 artwork, the written introductory script,
and the existing visitor-facing name/skip controls are retained.
