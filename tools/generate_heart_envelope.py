#!/usr/bin/env python3
"""Measure frame-by-frame acoustic energy from ACTUAL approved Heart MP3 audio.

No phoneme positions, mouth intentions or presentation timings are guessed.
The resulting envelope describes audible intensity only. A renderer may
choose an open or closed pose based on a real media playback clock, but must
not represent this as phoneme-accurate lip synchronization.
"""
import array
import hashlib
import json
import math
import struct
import wave
from pathlib import Path

ROOT=Path('site/audio')
WINDOW_MS=40
FILES={
    "asking-name":"violet-heart-asking-name.mp3",
    "after-name":"violet-heart-after-name.mp3",
    "post-welcome":"violet-heart-post-welcome.mp3"
}
def measure(path):
    with wave.open(str(path),'rb') as wav:
        if wav.getnchannels()!=1 or wav.getsampwidth()!=2 or wav.getframerate()!=8000:
            raise RuntimeError("Unexpected actual decoded Heart audio format "+str(path))
        raw=wav.readframes(wav.getnframes())
    samples=array.array('h')
    samples.frombytes(raw)
    if struct.pack('=h',1)!=struct.pack('<h',1):
        samples.byteswap()
    size=8000*WINDOW_MS//1000
    amplitudes=[]
    for first in range(0,len(samples),size):
        window=samples[first:first+size]
        if not window:continue
        rms=math.sqrt(sum(int(v)*int(v) for v in window)/len(window))/32768
        amplitudes.append(rms)
    maximum=max(amplitudes) if amplitudes else 0.0
    if maximum<.003 or not all(math.isfinite(v) for v in amplitudes):
        raise RuntimeError("No qualified audio intensity measurements")
    levels=[min(255,round(255*v/maximum)) for v in amplitudes]
    return {"windowMs":WINDOW_MS,"durationMs":round(len(samples)/8),
            "maximumRms":round(maximum,6),"levels":levels}

def main():
    manifest={"version":1,"source":"measured-decoded-approved-heart-audio",
              "voiceId":"af_heart","tracks":{}}
    for name,file in FILES.items():
        mp3=ROOT/file
        wav=Path('/tmp/heart-envelope-'+name+'.wav')
        if not mp3.is_file() or not wav.is_file():
            raise FileNotFoundError(file+" (decoded WAV required)")
        info=measure(wav)
        info.update({"src":"/site/audio/"+file,
            "sha256":hashlib.sha256(mp3.read_bytes()).hexdigest()})
        manifest["tracks"][name]=info
        print(name,"frames",len(info["levels"]),"durationMs",info["durationMs"],
              "maxRms",info["maximumRms"],flush=True)
    (ROOT/'heart-envelope.json').write_text(
        json.dumps(manifest,separators=(',',':'))+'\n',encoding='utf8')

if __name__=="__main__":
    main()
