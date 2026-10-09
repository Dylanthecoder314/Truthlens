"""Soundtrack for the edited upload: the original intro and narration, levelled, plus a quiet bed and cues.

    python mix_edit.py SOURCE.mp4

1. Cuts the source audio into the intro (0 to keep_intro_until) and the narration
   (resume_audio_at to the end), as set in ../cues.json.
2. Loudness-normalises each part to -16 LUFS separately. In the upload the intro music
   sits near -12.5 LUFS and clips, while the narration sits near -26.6 LUFS.
3. Places them on the new timeline, adds the ambient bed and the scenes' sound cues
   (reusing ../../tools/mix.py), and writes ../build/mix.wav.
"""
import json, subprocess, sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "tools"))
import mix  # noqa: E402  (bed() and SOUNDS)

SR = 48000
# The pings sit in the speech band under "only intermittent satellite pings": keep them well below the voice.
CUE_GAIN = {"ping": 0.4}


def loudnorm(src, start, end, out, target=-16.0, lra=11):
    """Two-pass EBU R128 normalisation; linear when possible, dynamic otherwise."""
    cut = ["-ss", str(start)] + (["-to", str(end)] if end else [])
    first = subprocess.run(["ffmpeg", "-hide_banner", *cut, "-i", src, "-vn",
                            "-af", f"loudnorm=I={target}:TP=-1.5:LRA={lra}:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    m = json.loads(first[first.rindex("{"):first.rindex("}") + 1])
    af = (f"loudnorm=I={target}:TP=-1.5:LRA={lra}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *cut, "-i", src, "-vn", "-af", af, "-ar", str(SR), "-ac", "2",
                    "-c:a", "pcm_f32le", str(out)], check=True)
    print(f"{out.name}: measured {m['input_i']} LUFS, peak {m['input_tp']} dBTP -> {target} LUFS")


def main():
    src = sys.argv[1]
    cues = json.loads((ROOT / "cues.json").read_text())
    timing = json.loads((ROOT / "scenes" / "timing.js").read_text().split("window.TIMING = ", 1)[1].rstrip().rstrip(";"))
    build = ROOT / "build"
    keep, resume = cues["keep_intro_until"], cues["resume_audio_at"]

    loudnorm(src, 0, keep, build / "intro.wav", lra=11)
    loudnorm(src, resume, None, build / "narration.wav", lra=7)
    intro, _ = sf.read(build / "intro.wav")
    narr, _ = sf.read(build / "narration.wav")

    total = keep + timing["total"]
    n = int(np.ceil(total * SR))
    out = np.zeros((n, 2))
    out[:min(n, len(intro))] += intro[:n]
    i0 = int(keep * SR)
    j = min(n, i0 + len(narr))
    out[i0:j] += narr[:j - i0]

    # Ambient bed under the rebuilt section only, fading in after the intro's glitch.
    bed = mix.bed(n - i0 + SR)[:n - i0] * 0.85
    fade = np.clip(np.arange(n - i0) / (2.5 * SR), 0, 1)
    out[i0:, 0] += bed * fade
    k = int(0.011 * SR)
    out[i0 + k:, 1] += (bed * fade)[:-k]

    count = 0
    for sid in timing["order"]:
        f = build / "scenes" / f"{sid}.sfx.json"
        if not f.exists():
            continue
        for name, at in json.loads(f.read_text()):
            s = mix.SOUNDS[name] * CUE_GAIN.get(name, 1.0)
            a = int((keep + timing["scenes"][sid]["offset"] + at) * SR)
            b = min(n, a + len(s))
            if 0 <= a < n:
                out[a:b, 0] += s[:b - a]
                out[a:b, 1] += s[:b - a]
                count += 1

    peak = np.abs(out).max()
    if peak > 0.97:
        out *= 0.97 / peak
    sf.write(build / "mix.wav", out.astype(np.float32), SR, subtype="FLOAT")
    print(f"mix: {total:.2f}s, {count} sound cues, peak before trim {peak:.2f}")


if __name__ == "__main__":
    main()
