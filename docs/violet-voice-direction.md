# Violet voice selection — approved

**Selected voice: Kokoro af_heart, female American English.**
Selected from the actual Heart, Nicole and Emma auditions on 2026-11-06.
Nicole was amusing but not the selected voice.

The voice should be clearly feminine, soft and gentle, light and airy, and
naturally midrange rather than exaggerated or high-pitched.
The model and voice weights are Apache-2.0, and kokoro-onnx is MIT licensed.
This option can be generated for free without per-visitor synthesis fees.

The two approved opening states are rendered as separate authored Heart
M4A recordings via tools/generate_selected_heart.py and the main-only
GitHub Actions workflow. The source text comes from the existing
openingMessage function; no invented narration sequence is introduced.

The visitor's optional name is visible in the on-screen welcome.
Until the same-voice dynamic-name synthesis capability is established,
the spoken Heart welcome uses the shared phrase without pronouncing the
visitor's arbitrary name. Do not silently substitute another voice.
Playback must report real start/end/error/interruption state.
The accepted A2 design and first-load interaction remain unchanged.

Model: https://huggingface.co/hexgrad/Kokoro-82M
Inference: https://github.com/thewh1teagle/kokoro-onnx
