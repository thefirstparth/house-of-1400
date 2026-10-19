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

# 19 Oct: Tarun's "<laugh> Priorities sorted, ekdum!" was heard as "Haha, priority sorted, egg": one word of three
# matched, the check failed a right cut, and the episode fell back to one take with no transcript. So a laugh or a
# "hmm" heard is not a word of the line, a plural matches its singular, and the Hindi words (which the model writes
# any way it likes) are not required of the line.
FILLERS = set("ha haha hahaha hah heh hmm hm mm mmm um uh oh ah aah huh".split())
HINDI = set("arre arey haan bilkul ekdum yaar accha achha acha wah bas chalo".split())
def stem(w):
    if len(w) > 4 and w.endswith("ies"): return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss") and not w.endswith("'s"): return w[:-1]
    return w

def words(text, spoken):
    # numbers are left out on both sides: the script spells them ("seventy-two thousand"), the model writes digits
    ws = re.sub(r"<[^>]+>", " ", text.lower()).replace("-", " ")
    ws = re.findall(r"[a-z0-9']+", ws)
    ws = [w for w in ws if not re.search(r"\d", w) and not (spoken and w in NUMBERS)]
    if spoken:
        kept = [w for w in ws if w not in HINDI]
        ws = kept if kept else ws
    else:
        ws = [w for w in ws if w not in FILLERS]
    return [stem(w) for w in ws]

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

def tokens(text):
    # every word as said, numbers included, for placing the cuts (a number or a Hindi word the model writes
    # differently still takes up its place between the lines)
    return [stem(w) for w in re.findall(r"[a-z0-9']+", re.sub(r"<[^>]+>", " ", text.lower()).replace("-", " "))]

def align(job, model):
    # Cutting by ear (14 Oct: Gemini's real delivery did not leave pauses the silence cutter could trust, and it read
    # the instructions out loud before the lines): the whole take is transcribed with a time on every word and the
    # script's words are matched to the heard words in order. Between two lines, the heard words that matched neither
    # (a number written as digits, "Bilkul" heard as something else) sit between them, and the cut goes at the
    # longest pause among them.
    segs, _ = model.transcribe(audio(job["take"]), language="en", beam_size=1, word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
    heard = [(t, w.start, w.end) for s in segs for w in (s.words or []) for t in tokens(w.word) if t not in FILLERS]
    script, owner = [], []
    for k, line in enumerate(job["lines"]):
        for w in tokens(line): script.append(w); owner.append(k)
    m = {}
    for b in SequenceMatcher(None, script, [h[0] for h in heard], autojunk=False).get_matching_blocks():
        for i in range(b.size): m[b.a + i] = b.b + i
    n = len(job["lines"])
    idx = [[i for i in range(len(script)) if owner[i] == k] for k in range(n)]
    hit = [[i for i in ix if i in m] for ix in idx]
    # A line not heard at all (19 Oct: "<laugh> Priorities sorted, ekdum!" in the whole episode) is placed between its
    # neighbours by time, its share of their words; the cuts then find the real pauses (lib.mjs cutAt). Only one such
    # line in a row, and never the first or the last.
    missing = {k for k, h in enumerate(hit) if not h}
    for k in sorted(missing):
        if k == 0 or k == n - 1 or k - 1 in missing or k + 1 in missing: return {"ok": False, "why": f"line {k + 1} not heard"}
    cuts = []
    k = -1
    while k < n - 2:
        k += 1
        if k + 1 in missing:
            a, b = m[max(hit[k])], m[min(hit[k + 2])]
            if b <= a: return {"ok": False, "why": f"lines {k + 1} and {k + 3} heard out of order"}
            tail, L, lead = max(idx[k]) - max(hit[k]), len(idx[k + 1]), min(hit[k + 2]) - min(idx[k + 2])
            T0, T1 = heard[a][2], heard[b][1]
            tot, edge = tail + L + lead, min(0.3, (T1 - T0) / 4)
            cuts.append(round(T0 + (T1 - T0) * tail / tot if tail else T0 + edge, 3))
            cuts.append(round(T0 + (T1 - T0) * (tail + L) / tot if lead else T1 - edge, 3))
            k += 1
            continue
        a, b = m[max(hit[k])], m[min(hit[k + 1])]
        if b <= a: return {"ok": False, "why": f"lines {k + 1} and {k + 2} heard out of order"}
        tail = max(idx[k]) - max(hit[k])           # words of line k said after its last matched word
        lead = min(hit[k + 1]) - min(idx[k + 1])   # words of line k+1 said before its first matched word
        # the cut goes at the longest pause between the two matched words (Gemini pauses between lines: 2.3 s before
        # "Bilkul" on 14 Oct, where "2024" was one heard word for three script words and a count went wrong); with no
        # real pause, the unmatched words are shared out by how many each line has at that edge
        pauses = [(heard[i + 1][1] - heard[i][2], i) for i in range(a, b)]
        gap = list(range(a + 1, b))
        give = round(len(gap) * tail / (tail + lead)) if tail + lead else len(gap) // 2
        expect = gap[give - 1] if give > 0 else a
        # where the words say the line ends, not the longest pause the model heard (18 Oct, twice: "Bhide" heard as "we
        # already" and "Ballon d'Or" as "balloon door" left eleven unmatched words between two lines, and the longest
        # pause among them was the comma after "French riots", inside the next line; and the model ran "Shaista Parveen"
        # into "Jio Platforms" with no pause at all, though the take has 0.6 s there, so the cut went to the comma after
        # "wife"). A pause the model heard is used only right at that place; otherwise the place itself, and the real
        # pause in the sound is found from it (lib.mjs cutAt)
        near = [(p, i) for p, i in pauses if abs(i - expect) <= 1]
        at = max(near)[1] if near and max(near)[0] >= 0.25 else expect
        cuts.append(round((heard[at][2] + heard[at + 1][1]) / 2, 3))
    start = max(0.0, heard[m[min(hit[0])]][1] - 0.15 - 0.4 * (min(hit[0]) - min(idx[0])))
    end = heard[m[max(hit[-1])]][2] + 0.25 + 0.4 * (max(idx[-1]) - max(hit[-1]))
    return {"ok": True, "cuts": cuts, "start": round(start, 3), "end": round(end, 3)}

def main():
    job = json.load(open(sys.argv[1]))
    from faster_whisper import WhisperModel
    model = WhisperModel(job.get("model", "base.en"), device="cpu", compute_type="int8")
    if job.get("take"):
        out = align(job, model)
        json.dump(out, open(sys.argv[2], "w"))
        print(f"align: {len(job['lines'])} lines, " + ("cut by ear" if out["ok"] else f"not cut ({out['why']})"))
        return
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
