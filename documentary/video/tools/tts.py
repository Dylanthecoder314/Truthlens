"""Generate the narration for the MH370 film and the timing every scene uses.

    python tts.py --models /path/to/kokoro-models

Reads ../script.json and writes:
  ../build/segments/<id>.wav   one clip per segment (cached by text + voice)
  ../build/narration.wav       the full narration track, 48 kHz mono
  ../scenes/timing.js          window.TIMING: scene durations, segment start/end, caption chunks
  ../out/MH370-documentary.srt captions

Speech comes from Kokoro (Apache-2.0), an open-weight model that runs locally.
"""
import argparse, hashlib, json, re, subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 24000          # Kokoro output rate
OUT_SR = 48000      # film audio rate
FPS = 30
MAX_CHARS = 96      # caption chunk length (two lines of ~48 characters)


def trim(x, thresh=0.008, pad=0.04):
    idx = np.where(np.abs(x) > thresh)[0]
    if not len(idx):
        return x
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(x), idx[-1] + int(pad * SR))
    return x[a:b]


def radio(path):
    """Band-limit and compress a clip so it sounds like a cockpit radio call."""
    tmp = path.with_suffix(".tmp.wav")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(path),
        "-af", "highpass=f=380,lowpass=f=2900,acompressor=threshold=0.08:ratio=6:attack=5:release=60,volume=1.6",
        str(tmp)], check=True)
    tmp.replace(path)


def chunks(text):
    """Split a caption into pieces of at most MAX_CHARS, at sentence then clause breaks."""
    text = re.sub(r"(\w)'(\w)", "\\1\u2019\\2", text.strip())  # curly apostrophes
    parts = [p for p in re.split(r"(?<=[.!?;])\s+|(?<=:)\s+(?=[A-Za-z“])", text) if p]
    out = []
    for p in parts:
        while len(p) > MAX_CHARS:
            # Prefer a comma break; otherwise break before a conjunction; pick the most even split.
            cands = [(m.end(), 0) for m in re.finditer(r",\s+", p)]
            cands += [(m.start() + 1, 6) for m in re.finditer(r"\s(?:and|but|which|when|to|as|after|in|on)\s", p)]
            cands = [(c, w) for c, w in cands if 18 < c < len(p) - 12] or [(p.rfind(" ", 0, MAX_CHARS), 0)]
            c = min(cands, key=lambda cw: max(cw[0], len(p) - cw[0]) + cw[1])[0]
            out.append(p[:c].strip())
            p = p[c:].strip()
        out.append(p)
    merged = []
    for p in out:
        if merged and len(merged[-1]) + 1 + len(p) <= MAX_CHARS:
            merged[-1] += " " + p
        else:
            merged.append(p)
    return merged


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    args = ap.parse_args()

    from kokoro_onnx import Kokoro
    kokoro = Kokoro(str(Path(args.models) / "kokoro-v1.0.onnx"), str(Path(args.models) / "voices-v1.0.bin"))

    script = json.loads((ROOT / "script.json").read_text())
    voices = script["voice"]
    seg_dir = ROOT / "build" / "segments"
    seg_dir.mkdir(parents=True, exist_ok=True)

    timing = {"fps": FPS, "order": [], "scenes": {}}
    track = []
    srt = []
    offset = 0.0
    for scene in script["scenes"]:
        t = scene.get("lead", 0.6)
        segs = []
        for seg in scene["segments"]:
            kind = seg.get("voice", "narrator")
            voice = voices[kind]
            key = hashlib.sha1(f"{seg['say']}|{voice}|{voices['speed']}|{kind}".encode()).hexdigest()[:12]
            wav = seg_dir / f"{seg['id']}-{key}.wav"
            if not wav.exists():
                for old in seg_dir.glob(f"{seg['id']}-*.wav"):
                    old.unlink()
                lang = "en-gb" if voice.startswith("b") else "en-us"
                audio, sr = kokoro.create(seg["say"], voice=voice, speed=voices["speed"], lang=lang)
                assert sr == SR
                sf.write(wav, trim(audio), SR)
                if kind == "radio":
                    radio(wav)
            audio, _ = sf.read(wav)
            dur = len(audio) / SR
            start, end = t, t + dur
            track.append((offset + start, audio))
            pieces = chunks(seg["sub"])
            total = sum(len(p) for p in pieces)
            hold = min(seg.get("gap", 0.5), 0.45) if seg is not scene["segments"][-1] else 0.6
            cs, c0 = [], start
            for i, p in enumerate(pieces):
                c1 = end if i == len(pieces) - 1 else c0 + dur * len(p) / total
                cs.append({"text": p, "start": round(c0, 3), "end": round(c1 + (hold if i == len(pieces) - 1 else 0), 3)})
                srt.append((offset + c0, offset + cs[-1]["end"], p))
                c0 = c1
            segs.append({"id": seg["id"], "voice": kind, "start": round(start, 3), "end": round(end, 3), "sub": seg["sub"], "chunks": cs})
            t = end + seg.get("gap", 0.5)
        duration = round(t + scene.get("tail", 1.0), 3)
        duration = round(round(duration * FPS) / FPS, 3)
        timing["order"].append(scene["id"])
        timing["scenes"][scene["id"]] = {"title": scene["title"], "offset": round(offset, 3), "duration": duration, "segments": segs}
        offset += duration

    timing["total"] = round(offset, 3)

    # Full narration track at 48 kHz.
    n = int(np.ceil(offset * SR)) + SR
    mix = np.zeros(n, dtype=np.float32)
    for at, audio in track:
        i = int(round(at * SR))
        mix[i:i + len(audio)] += audio.astype(np.float32)
    build = ROOT / "build"
    sf.write(build / "narration24k.wav", mix, SR)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(build / "narration24k.wav"),
                    "-ar", str(OUT_SR), str(build / "narration.wav")], check=True)

    (ROOT / "scenes" / "timing.js").write_text(
        "// Generated by tools/tts.py from script.json. Do not edit.\nwindow.TIMING = " + json.dumps(timing, indent=1) + ";\n")
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    (out / "MH370-documentary.srt").write_text(
        "\n".join(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{txt}\n" for i, (a, b, txt) in enumerate(srt, 1)))

    for sid in timing["order"]:
        s = timing["scenes"][sid]
        print(f"{sid} {s['title']:<28} {s['duration']:6.2f}s  starts {s['offset']:7.2f}s")
    print(f"total {timing['total']:.1f}s ({timing['total'] / 60:.1f} min)")


if __name__ == "__main__":
    main()
