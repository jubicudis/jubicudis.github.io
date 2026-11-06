#!/usr/bin/env python3
"""Reproducible, free Kokoro voice auditions for Violet.

Runs only when explicitly invoked by the separate audition workflow/script.
Never changes the live website, voice selection or presentation behavior.
The transcript is pulled from the authoritative opening-state module.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# Female voices only, no artificial pitch change. Two American candidates
# and one restrained British comparison; not an approval or production voice.
CANDIDATES = (
    ("nicole", "af_nicole", "en-us"),
    ("heart", "af_heart", "en-us"),
    ("emma", "bf_emma", "en-gb"),
)
SPEED = 1.0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--voices", required=True, type=Path)
    parser.add_argument("--script", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    for path in (args.model, args.voices, args.script):
        if not path.is_file():
            raise FileNotFoundError(path)
    source = json.loads(args.script.read_text(encoding="utf-8"))
    if not isinstance(source, dict) or any(
        not isinstance(source.get(x), str) or not source[x].strip()
        for x in ("greeting", "welcome")
    ):
        raise ValueError("Actual opening state must supply both narration lines")
    args.output.mkdir(parents=True, exist_ok=True)
    # A continuous listening sample is more representative than only a
    # seven-word greeting, which is a known Kokoro weak case.
    scripts = (
        ("opening", source["greeting"] + " " + source["welcome"]),
        ("greeting", source["greeting"]),
    )
    synth = Kokoro(str(args.model), str(args.voices))
    files = []
    try:
        for slug, voice_id, locale in CANDIDATES:
            for cue, text in scripts:
                print("Generating", slug, cue, flush=True)
                audio, sample_rate = synth.create(
                    text, voice=voice_id, speed=SPEED, lang=locale
                )
                signal = np.asarray(audio, dtype=np.float32).reshape(-1)
                if (
                    signal.size < sample_rate // 2
                    or not np.isfinite(signal).all()
                    or float(np.max(np.abs(signal))) < 0.005
                    or float(np.max(np.abs(signal))) > 1.1
                ):
                    raise RuntimeError(f"Unqualified audio generation: {slug}/{cue}")
                output = args.output / f"violet-{slug}-{cue}.wav"
                sf.write(output, signal, sample_rate, subtype="PCM_16")
                raw = output.read_bytes()
                files.append({
                    "candidate": slug,
                    "voice_id": voice_id,
                    "locale": locale,
                    "cue": cue,
                    "file": output.name,
                    "sha256": hashlib.sha256(raw).hexdigest(),
                    "sample_rate": int(sample_rate),
                    "duration_seconds": round(signal.size / sample_rate, 3),
                    "peak_abs": round(float(np.max(np.abs(signal))), 4),
                })
    finally:
        if hasattr(synth, "voices") and hasattr(synth.voices, "close"):
            synth.voices.close()
    manifest = {
        "status": "generated_not_approved",
        "model": "Kokoro-82M-v1.0 via kokoro-onnx",
        "model_license": "Apache-2.0",
        "runtime_license": "MIT",
        "notes": (
            "Generated free/open-weight voice auditions only. No voice chosen. "
            "No files deployed to the website. Playback quality requires human listening."
        ),
        "speed": SPEED,
        "transcripts": source,
        "files": files,
    }
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Generated {len(files)} audible audition files", flush=True)


if __name__ == "__main__":
    main()
