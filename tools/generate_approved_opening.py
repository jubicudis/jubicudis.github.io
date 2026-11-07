#!/usr/bin/env python3
"""Generate Heart voice for each paragraph of inventor-approved Revision 2.

Outputs two continuous tracks so a mobile browser plays a single asset per
visitor action. Paragraph boundaries come from actual generated sample counts,
not a guessed reading speed or browser timer. The timeline is consumed only
while that same audio file has observed playback.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import soundfile as sf
import subprocess
from kokoro_onnx import Kokoro

def main():
    parser=argparse.ArgumentParser()
    for name in ("model","voices","source","output"):
        parser.add_argument("--"+name,required=True,type=Path)
    a=parser.parse_args()
    tracks=json.loads(a.source.read_text(encoding="utf-8"))
    if set(tracks)!={"asking-name","after-name"}:
        raise ValueError("Both approved narration tracks are required")
    a.output.mkdir(parents=True,exist_ok=True)
    engine=Kokoro(str(a.model),str(a.voices))
    timeline={"version":2,"voiceId":"af_heart","source":"approved-revision-2","tracks":{}}
    sample_rate=None
    for track,segments in tracks.items():
        if not isinstance(segments,list) or len(segments)<2:
            raise ValueError("Approved script must be a list of substantive segments")
        parts=[]
        cues=[]
        position=0
        for index,segment in enumerate(segments):
            phase=segment["phase"]
            text=segment["text"]
            if not isinstance(text,str) or not text.strip() or phase not in (
                "asking-name","welcome","orientation","presentation"
            ):
                raise ValueError("Invalid approved narration segment")
            # Captions preserve TNOS spelling; synthesis must articulate its
            # four letter names, never pronounce it as a lexical word.
            spoken=text.replace("TNOS","T. N. O. S.")
            samples,rate=engine.create(spoken,voice="af_heart",speed=1.0,lang="en-us")
            signal=np.asarray(samples,dtype=np.float32).reshape(-1)
            peak=float(np.max(np.abs(signal))) if signal.size else 0
            if signal.size<rate//3 or not np.isfinite(signal).all() or not .003<=peak<=1.1:
                raise RuntimeError(f"Unqualified Heart audio for {track} cue {index}")
            if sample_rate is None:sample_rate=int(rate)
            if sample_rate!=int(rate):raise RuntimeError("Inconsistent synthesis sample rate")
            start=position
            end=start+signal.size
            cues.append({"index":index,"phase":phase,"text":text,
                "startMs":round(start*1000/rate),
                "endMs":round(end*1000/rate)})
            parts.append(signal)
            position=end
            if index<len(segments)-1:
                # Audible pacing without an invented presentation event; the
                # measured silent audio is part of the actual playback track.
                pause=np.zeros(round(rate*0.20),dtype=np.float32)
                parts.append(pause)
                position+=pause.size
            print(f"Heart {track} segment {index+1}/{len(segments)} {len(signal)/rate:.2f}s",flush=True)
        complete=np.concatenate(parts)
        filename=f"violet-heart-{track}.wav"
        sf.write(a.output/filename,complete,sample_rate,subtype="PCM_16")
        timeline["tracks"][track]={"file":f"/site/audio/violet-heart-{track}.mp3",
            "durationMs":round(complete.size*1000/sample_rate),
            "cues":cues}
    (a.output/"heart-timeline.json").write_text(
        json.dumps(timeline,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    (a.output/"heart-provenance.json").write_text(json.dumps({
        "voice_id":"af_heart","model":"Kokoro-82M v1.0",
        "model_license":"Apache-2.0","runtime":"kokoro-onnx 0.6.1 (MIT)",
        "status":"Heart character treatment candidate; approval pending",
        "spoken_acronym":"T. N. O. S.",
        "tracks":{k:{"spoken_text":" ".join(c["text"] for c in v["cues"]),
                       "segments":len(v["cues"]),"durationMs":v["durationMs"]}
                  for k,v in timeline["tracks"].items()}
    },indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

if __name__=="__main__":
    main()
