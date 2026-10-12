# The podcast's free fallback voice (scripts/podcast/make.mjs): Kokoro, an open-source model (Apache 2.0) that runs on
# the GitHub runner's processor. Reads {lang, voices: {speaker: voice}, turns: [{speaker, mood, text}]} and writes one
# WAV (24 kHz mono). Used only when Gemini cannot voice the episode.
# Kokoro has no emotion control (Parth, 13 Oct: "it has no emotion at all"), so the feeling comes from pace and timing:
# each mood sets the speed, a quick reaction follows the line before it closely, and a change of mood (a new story)
# gets a longer pause.
import json, sys
import numpy as np
import soundfile as sf
from kokoro import KPipeline

SPEED = {"excited": 1.1, "delighted": 1.06, "surprised": 1.05, "amused": 1.04, "curious": 1.03, "warm": 1.0, "good": 1.03,
         "matter-of-fact": 1.0, "neutral": 1.0, "wry": 0.98, "mixed": 0.97, "concerned": 0.94, "gentle": 0.9, "sombre": 0.88, "bad": 0.9}
inp, out = sys.argv[1], sys.argv[2]
job = json.load(open(inp))
pipe = KPipeline(lang_code=job.get("lang", "a"))
voices = job.get("voices", {})
names = list(dict.fromkeys(t["speaker"] for t in job["turns"]))
default = ["af_heart", "am_michael"]
silence = lambda s: np.zeros(int(24000 * s), dtype=np.float32)
parts, prev = [], None
for t in job["turns"]:
    v = voices.get(t["speaker"]) or default[names.index(t["speaker"]) % 2]
    mood = t.get("mood") or "neutral"
    if prev is not None:
        short = len(t["text"].split()) <= 8
        parts.append(silence(0.18 if short else 0.65 if mood != prev else 0.35))
    for _, _, audio in pipe(t["text"], voice=v, speed=SPEED.get(mood, 1.0)):
        parts.append(np.asarray(audio, dtype=np.float32))
    prev = mood
sf.write(out, np.concatenate(parts), 24000, subtype="PCM_16")
print(f"kokoro: {len(job['turns'])} turns")
