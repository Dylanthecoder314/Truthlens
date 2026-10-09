"""Mix the film's soundtrack: narration, a quiet ambient bed and the scenes' sound cues.

    python mix.py

Reads ../scenes/timing.js, ../build/narration.wav and ../build/scenes/<id>.sfx.json,
writes ../build/mix.wav (48 kHz stereo). All sounds are synthesised here; nothing is sampled.
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
rng = np.random.default_rng(370)


def lowpass_noise(n, cutoff):
    """White noise shaped by a gentle low-pass in the frequency domain."""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    x = np.fft.irfft(spec, n)
    return x / (np.abs(x).max() + 1e-9)


def bed(n):
    t = np.arange(n) / SR
    drone = np.zeros(n)
    for f, a, lfo in [(55.0, .50, .051), (82.41, .32, .073), (110.0, .22, .089), (164.81, .10, .113)]:
        mod = 0.7 + 0.3 * np.sin(2 * np.pi * lfo * t + f)
        drone += a * mod * (np.sin(2 * np.pi * f * t) + np.sin(2 * np.pi * (f + 0.31) * t)) / 2
    drone /= np.abs(drone).max()
    sea = lowpass_noise(n, 380) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.07 * t) ** 2)
    x = 0.030 * drone + 0.022 * sea
    fade = np.minimum(1, np.minimum(t / 4.0, (t[-1] - t) / 7.0))
    return x * np.clip(fade, 0, 1)


def env(n, attack, tau):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / tau)


def reverb(x, taps=((0.11, .45), (0.23, .30), (0.37, .20), (0.53, .12))):
    out = np.copy(x)
    for d, g in taps:
        k = int(d * SR)
        out[k:] += g * x[:-k]
    return out


def ping():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * 1180 * t) + 0.25 * np.sin(2 * np.pi * 2360 * t)) * env(n, 0.004, 0.32)
    return 0.16 * reverb(x) / 1.6


def blip():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    return 0.10 * np.sin(2 * np.pi * 940 * t) * env(n, 0.002, 0.045)


def hit():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 46 + 50 * np.exp(-t / 0.12)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.006, 0.45)
    x += 0.25 * lowpass_noise(n, 220) * env(n, 0.002, 0.12)
    return 0.28 * x / np.abs(x).max()


SOUNDS = {"ping": ping(), "blip": blip(), "hit": hit()}


def main():
    timing = json.loads((ROOT / "scenes" / "timing.js").read_text().split("window.TIMING = ", 1)[1].rstrip().rstrip(";"))
    narr, sr = sf.read(ROOT / "build" / "narration.wav")
    assert sr == SR
    n = int(np.ceil(timing["total"] * SR))
    voice = np.zeros(n)
    voice[:min(n, len(narr))] = narr[:n]

    fx = np.zeros(n)
    count = 0
    for sid in timing["order"]:
        f = ROOT / "build" / "scenes" / f"{sid}.sfx.json"
        if not f.exists():
            continue
        for name, at in json.loads(f.read_text()):
            s = SOUNDS[name]
            i = int((timing["scenes"][sid]["offset"] + at) * SR)
            j = min(n, i + len(s))
            if 0 <= i < n:
                fx[i:j] += s[:j - i]
                count += 1

    ambience = bed(n)
    # Narration centred; effects and ambience widened by delaying one channel slightly.
    k = int(0.011 * SR)
    side = fx + ambience
    delayed = np.zeros(n)
    delayed[k:] = side[:-k]
    left = voice + side
    right = voice + delayed
    stereo = np.stack([left, right], axis=1)
    peak = np.abs(stereo).max()
    if peak > 0.98:
        stereo *= 0.98 / peak
    sf.write(ROOT / "build" / "mix.wav", stereo.astype(np.float32), SR, subtype="FLOAT")
    print(f"mix: {timing['total']:.1f}s, {count} sound cues, peak {peak:.2f}")


if __name__ == "__main__":
    main()
