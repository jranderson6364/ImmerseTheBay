"""Synthesises the UI sound effects into Assets/Retrospecs/Audio/sfx (no samples, no licences).

  click.wav   a soft glassy tick for every button press
  whoosh.wav  an airy swoosh for cards and the chat window popping up

Run: python tools/build-sfx.py
"""
import math
import os
import random
import struct
import wave

RATE = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "Assets", "Retrospecs", "Audio", "sfx")


def write(name, samples, peak=0.8):
    m = max(1e-9, max(abs(s) for s in samples))
    k = peak / m
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32767)) for s in samples))
    print(f"wrote {os.path.normpath(path)} ({len(samples) / RATE:.2f} s)")


def click():
    n = int(RATE * 0.07)
    out = []
    for i in range(n):
        t = i / RATE
        attack = min(1.0, t / 0.0015)
        s = 0.55 * math.sin(2 * math.pi * 2400 * t) * math.exp(-t / 0.007)
        s += 0.45 * math.sin(2 * math.pi * 1200 * t) * math.exp(-t / 0.018)
        s += 0.2 * math.sin(2 * math.pi * 3600 * t) * math.exp(-t / 0.004)
        out.append(s * attack)
    return out


def whoosh():
    random.seed(7)
    dur = 0.55
    n = int(RATE * dur)
    out = []
    y1 = y2 = x1 = x2 = 0.0
    for i in range(n):
        u = i / n
        # Band-pass centre sweeps up then settles: the air rushing past.
        fc = 350 + 2600 * math.sin(math.pi * min(1.0, u * 1.15)) ** 1.5
        q = 1.4
        w0 = 2 * math.pi * fc / RATE
        alpha = math.sin(w0) / (2 * q)
        b0, b2 = alpha, -alpha
        a0, a1, a2 = 1 + alpha, -2 * math.cos(w0), 1 - alpha
        x = random.uniform(-1, 1)
        y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1 = x1, x
        y2, y1 = y1, y
        # Quick swell, long soft tail.
        env = (u / 0.35) ** 2 if u < 0.35 else math.exp(-(u - 0.35) / 0.16)
        out.append(y * env)
    return out


if __name__ == "__main__":
    write("click.wav", click(), 0.7)
    write("whoosh.wav", whoosh(), 0.75)
