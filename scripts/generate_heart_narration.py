#!/usr/bin/env python3
"""Build approved Heart audio family from the canonical opening script.

Generates asking-name, unnamed after-name, and named pre/post segments.
The visitor's arbitrary name is generated on-device using the same af_heart
model. Never synthesize a placeholder name into the published recording.
"""
import json, re, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT=Path(__file__).resolve().parents[1]
script=(ROOT/'site/opening-script.mjs').read_text()
timeline=json.loads((ROOT/'site/audio/heart-timeline.json').read_text())
out=ROOT/'site/audio'
out.mkdir(parents=True,exist_ok=True)
# Use the approved cue text in the existing validated timeline; do not
# duplicate or paraphrase any approved dialogue in this generator.
tracks=timeline['tracks']
assert timeline['voiceId']=='af_heart'
assert len(tracks['asking-name']['cues'])==4
assert len(tracks['after-name']['cues'])==17
assert tracks['after-name']['cues'][7]['text'].endswith("you've already learned.")
assert tracks['after-name']['cues'][8]['text']=="Let's begin with something familiar."
pipeline=KPipeline(lang_code='a')
rate=24000
pause=np.zeros(round(.08*rate),dtype=np.float32)

def synthesize(text):
    parts=[]
    for _,_,audio in pipeline(text,voice='af_heart',speed=1):
        samples=np.asarray(audio,dtype=np.float32).reshape(-1)
        if not len(samples) or not np.isfinite(samples).all():
            raise RuntimeError('Heart model returned invalid audio')
        parts.append(samples)
    if not parts:raise RuntimeError('Heart model returned no audio')
    result=np.concatenate(parts)
    peak=float(np.max(np.abs(result)))
    if peak<.005:raise RuntimeError('Heart model returned silent audio')
    if peak>1:result=result/peak
    return result

def render(cues,filename):
    segments=[];positions=[];offset=0
    for i,cue in enumerate(cues):
        pcm=synthesize(cue['text'])
        start=offset
        segments.append(pcm);offset+=len(pcm)
        end=offset
        positions.append({'index':cue['index'],'phase':cue['phase'],
                          'text':cue['text'],'startMs':round(start*1000/rate),
                          'endMs':round(end*1000/rate)})
        if i<len(cues)-1:
            segments.append(pause);offset+=len(pause)
    wav=out/(filename+'.wav')
    sf.write(wav,np.concatenate(segments),rate,subtype='PCM_16')
    mp3=out/(filename+'.mp3')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),
                    '-codec:a','libmp3lame','-q:a','3',str(mp3)],check=True)
    wav.unlink()
    return {'file':'/site/audio/'+mp3.name,'durationMs':round(offset*1000/rate),
            'cues':positions}

asking=render(tracks['asking-name']['cues'],'violet-heart-asking-name')
all_cues=tracks['after-name']['cues']
unnamed=render(all_cues,'violet-heart-after-name')
named_before=render(all_cues[:8],'violet-heart-named-before')
named_after=render(all_cues[8:],'violet-heart-named-after')
# The named split files are independent recordings; their timeline is
# local to each file, and the name is synthesized between them.
manifest={'version':1,'voiceId':'af_heart','source':'approved-revision-2',
          'slot':{'afterCueIndex':7,'beforeCueIndex':8,
                  'textTemplate':"Now, {name}, let's take a closer look."},
          'asking':asking,'unnamed':unnamed,
          'named':{'before':named_before,'after':named_after}}
(out/'heart-narration-family.json').write_text(json.dumps(manifest,indent=2)+'\n')
# The existing playback controller still requires its canonical timeline.
timeline['tracks']['asking-name']=asking
timeline['tracks']['after-name']=unnamed
(out/'heart-timeline.json').write_text(json.dumps(timeline,indent=2)+'\n')
print('Generated approved Heart narration family',manifest['named']['before']['durationMs'],
      manifest['named']['after']['durationMs'])
