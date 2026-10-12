# The podcast's free fallback voice (scripts/podcast/make.mjs): Kokoro, an open-source model (Apache 2.0) that runs on
# the GitHub runner's processor. Reads {lang, voices: {speaker: voice}, turns: [{speaker, text}]} and writes one WAV
# (24 kHz mono) with a short pause between turns. Used only when Gemini cannot voice the episode.
import json, sys
import numpy as np
import soundfile as sf
from kokoro import KPipeline

inp, out = sys.argv[1], sys.argv[2]
job = json.load(open(inp))
pipe = KPipeline(lang_code=job.get("lang", "b"))
voices = job.get("voices", {})
names = list(dict.fromkeys(t["speaker"] for t in job["turns"]))
default = ["bf_emma", "bm_george"]
gap = np.zeros(int(24000 * 0.35), dtype=np.float32)
parts = []
for t in job["turns"]:
    v = voices.get(t["speaker"]) or default[names.index(t["speaker"]) % 2]
    for _, _, audio in pipe(t["text"], voice=v, speed=1.0):
        parts.append(np.asarray(audio, dtype=np.float32))
    parts.append(gap)
sf.write(out, np.concatenate(parts), 24000, subtype="PCM_16")
print(f"kokoro: {len(job['turns'])} turns")
