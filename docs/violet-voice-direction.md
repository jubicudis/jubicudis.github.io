# Violet — Approved Voice and Revision 2 Delivery

**Voice:** Kokoro `af_heart` (American female), inventor-selected on November 6, 2026.
Soft, light and airy with a natural, comfortable pitch; not exaggerated or
cartoonishly high. Other audition candidates were not selected.

**Cost:** Zero ongoing synthesis cost for static, locally generated narration.
Kokoro-82M model and voice assets are Apache 2.0 licensed;
`kokoro-onnx` inference is MIT licensed.
Model: https://huggingface.co/hexgrad/Kokoro-82M
Runtime: https://github.com/thewh1teagle/kokoro-onnx

## Approved words and source of truth

`site/opening-script.mjs` contains the exact Revision 2 dialogue approved by
the inventor. It governs the audio generation text, visible captions and topic
changes. Do not write a second, divergent script in the application code.

The script has 4 initial greeting and name-question segments, and 17
post-name segments comprising welcome, orientation and the opening of the
TED-style presentation. The Workbench is introduced as something Violet
will explain before its contribution to engineering is discussed. The
separate MCP server is not presented as a native TNOS runtime dependency.

## Authoritative execution

- The visitor activates Violet. One continuous Heart recording delivers the
  complete informative greeting and optional name question.
- Only after an actual completed or failed/interrupted greeting can the
  visitor enter a name or continue without one.
- The visitor's name choice authorizes one continuous post-name recording.
- Genuine audio playback positions, compared with boundaries measured from
  the generated Heart audio, update captions and distinguish welcome,
  orientation and presentation. Independent text timers are forbidden.
- The scripted experience ends at the approved line about the operating
  system itself. Future presentation material requires separate approval.
- The visitor's name can be shown in a personalized caption, but no fixed
  recording may falsely be said to pronounce an arbitrary name. Dynamic
  name rendering will require qualified same-voice synthesis.
- A playback request is not evidence of success. A missing asset or
  interrupted playback must be reported truthfully, without silently
  selecting a different device voice.

## Actual free audio assets

The existing `main` workflow `.github/workflows/publish-heart-audio.yml`
calls `tools/generate_approved_opening.py` using the approved single
script source, then publishes:

- `site/audio/violet-heart-asking-name.m4a`
- `site/audio/violet-heart-after-name.m4a`
- `site/audio/heart-timeline.json` (measured caption boundaries)
- `site/audio/heart-provenance.json`
- `site/audio/heart-sha256.txt`

The two audio tracks are approximately 24 and 101 seconds, respectively.
They do not include later, unapproved TED-style content.

No separate branches, pull requests, conventional navigation or alternate
character design are introduced. Violet's accepted Structured Bloom A2
appearance remains the opening's visual authority.
