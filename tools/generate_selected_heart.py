#!/usr/bin/env python3
"""Generate the approved Heart voice for the two existing opening states."""
import argparse
import json
from pathlib import Path
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

def main():
    p=argparse.ArgumentParser()
    for field in ("model","voices","transcripts","output"):
        p.add_argument("--"+field,required=True,type=Path)
    a=p.parse_args()
    scripts=json.loads(a.transcripts.read_text(encoding="utf-8"))
    if set(scripts)!={"asking-name","welcome"} or any(not isinstance(s,str) or not s.strip() for s in scripts.values()):
        raise ValueError("Expected approved opening texts for two states")
    a.output.mkdir(parents=True,exist_ok=True)
    synth=Kokoro(str(a.model),str(a.voices))
    results={}
    for phase,text in scripts.items():
        audio,rate=synth.create(text,voice="af_heart",speed=1.0,lang="en-us")
        signal=np.asarray(audio,dtype=np.float32).reshape(-1)
        peak=float(np.max(np.abs(signal)))
        if signal.size<rate or not np.isfinite(signal).all() or not .005<=peak<=1.1:
            raise RuntimeError("Unqualified Heart synthesis: "+phase)
        sf.write(a.output/f"violet-heart-{phase}.wav",signal,int(rate),subtype="PCM_16")
        results[phase]={"spoken_text":text,"sample_rate":int(rate),"duration_seconds":round(signal.size/rate,3),"peak":round(peak,4)}
    (a.output/"heart-provenance.json").write_text(json.dumps({
        "voice_id":"af_heart","model":"Kokoro-82M v1.0",
        "model_license":"Apache-2.0","runtime":"kokoro-onnx 0.6.1 (MIT)",
        "status":"inventor-selected","clips":results
    },indent=2)+"\n",encoding="utf-8")
if __name__=="__main__":
    main()
