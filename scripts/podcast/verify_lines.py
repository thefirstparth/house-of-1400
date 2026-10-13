# The listening check for the solo voice form (scripts/podcast/make.mjs; Parth, 13 Oct: "how are we sure this will
# happen accurately?"). After a host's single-voice take is cut into lines by silence alone (lib.mjs splitLines), an
# open-source speech-to-text model (faster-whisper, on the runner's processor, free) transcribes every piece, and each
# piece must say its own line: a fair share of its words, more of them than of the lines either side, and not far
# more words than the line has (a cut in the wrong place moves words into a neighbour or runs two lines together). A one or two word line ("Arre wah!") only has to stay short, since a cut
# that swallowed a neighbour makes it long. Any piece that fails rejects the whole cut, and make.mjs falls back.
# Reads {model, pieces: [{wav, text}]} from argv[1], writes {ok, pieces: [{f1, ok, heard}]} to argv[2].
import json, re, sys, wave
from difflib import SequenceMatcher
import numpy as np

NUMBERS = set("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
              "seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand lakh "
              "lakhs crore crores million billion trillion point per cent percent and".split())

def words(text, spoken):
    # numbers are left out on both sides: the script spells them ("seventy-two thousand"), the model writes digits
    ws = re.sub(r"<[^>]+>", " ", text.lower()).replace("-", " ")
    ws = re.findall(r"[a-z0-9']+", ws)
    return [w for w in ws if not re.search(r"\d", w) and not (spoken and w in NUMBERS)]

def audio(path):
    # the WAV read here, 16-bit mono, resampled to the model's 16 kHz: no audio decoder library to break on the day
    with wave.open(path) as w:
        rate, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1: x = x.reshape(-1, ch).mean(axis=1)
    if rate != 16000: x = np.interp(np.arange(0, len(x), rate / 16000.0), np.arange(len(x)), x).astype(np.float32)
    return x

def f1(want, got):
    if not want or not got: return 0.0
    m = sum(b.size for b in SequenceMatcher(None, want, got, autojunk=False).get_matching_blocks())
    return 2 * m / (len(want) + len(got))

def main():
    job = json.load(open(sys.argv[1]))
    from faster_whisper import WhisperModel
    model = WhisperModel(job.get("model", "base.en"), device="cpu", compute_type="int8")
    heard = []
    for p in job["pieces"]:
        segs, _ = model.transcribe(audio(p["wav"]), language="en", beam_size=1, vad_filter=False, condition_on_previous_text=False)
        heard.append(" ".join(s.text for s in segs).strip())
    want = [words(p["text"], True) for p in job["pieces"]]
    got = [words(h, False) for h in heard]
    out = []
    for i, (w, g) in enumerate(zip(want, got)):
        own = f1(w, g)
        if len(w) < 3:
            ok = len(g) <= len(w) + 5  # a short reaction stays short
        else:
            near = [f1(want[j], g) for j in (i - 1, i + 1) if 0 <= j < len(want) and len(want[j]) >= 3]
            # lenient on the words (an accent, a Hindi word or a name can be misheard); strict on order and length: a
            # piece closer to a neighbouring line, or far longer than its own, is a cut in the wrong place
            ok = own >= 0.35 and all(own >= x for x in near) and len(g) <= 1.6 * len(w) + 4
        out.append({"f1": round(own, 2), "ok": ok, "heard": heard[i][:300]})
    json.dump({"ok": all(x["ok"] for x in out), "pieces": out}, open(sys.argv[2], "w"), indent=1)
    bad = [i for i, x in enumerate(out) if not x["ok"]]
    print(f"verify: {len(out)} lines, {len(out) - len(bad)} match" + (f"; line(s) {', '.join(str(i + 1) for i in bad)} do not" if bad else ""))

if __name__ == "__main__":
    main()
