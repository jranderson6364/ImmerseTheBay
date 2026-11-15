"""Encode the six interpretive people illustrations as short Lens-ready loops.

Requires Pillow, numpy, and imageio-ffmpeg. Run from any directory:
    python Retrospecs/tools/render_people_holograms.py
"""

from pathlib import Path
import math
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageOps


ART = Path(__file__).resolve().parents[1] / "Assets" / "Retrospecs" / "Art"
IDS = ("mainquad", "hoover", "huang", "memchu", "varian", "spilker", "moore")
WIDTH, HEIGHT, FPS, SECONDS = 640, 360, 24, 4


def encode(story_id: str) -> None:
    folder = ART / story_id
    source = folder / f"{story_id}_people_hologram_source.png"
    output = folder / f"{story_id}_people_hologram.mp4"
    with Image.open(source) as image:
        # All sources have generous black margins. Fit to the same 16:9 screen as HP Garage.
        image = ImageOps.fit(image.convert("RGB"), (WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        base = np.asarray(image, dtype=np.uint8).copy()
    # Explicitly key near-black pixels to true black for the additive display.
    base[base.max(axis=2) < 12] = 0

    command = [
        imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", f"{WIDTH}x{HEIGHT}",
        "-framerate", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
        "-profile:v", "baseline", "-level", "3.0", "-pix_fmt", "yuv420p",
        "-r", str(FPS), "-t", str(SECONDS), "-movflags", "+faststart", str(output),
    ]
    with subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE) as process:
        for frame in range(FPS * SECONDS):
            phase = 2 * math.pi * frame / (FPS * SECONDS)
            # A gentle one-pixel hover and light pulse make a seamless loop without
            # inventing facial motion or changing the people in the illustration.
            dx = round(math.sin(phase))
            dy = round(math.sin(phase + math.pi / 2))
            shifted = np.roll(base, (dy, dx), axis=(0, 1))
            if dy > 0:
                shifted[:dy, :, :] = 0
            elif dy < 0:
                shifted[dy:, :, :] = 0
            if dx > 0:
                shifted[:, :dx, :] = 0
            elif dx < 0:
                shifted[:, dx:, :] = 0
            brightness = 0.97 + 0.03 * math.sin(phase)
            process.stdin.write(np.clip(shifted.astype(np.float32) * brightness, 0, 255).astype(np.uint8).tobytes())
        process.stdin.close()
        error = process.stderr.read().decode("utf-8", "replace")
        if process.wait() != 0:
            raise RuntimeError(f"ffmpeg failed for {story_id}: {error}")
    print(f"{story_id}: {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    selected = tuple(sys.argv[1:]) or IDS
    if any(story_id not in IDS for story_id in selected):
        raise SystemExit(f"Choose from: {', '.join(IDS)}")
    for story_id in selected:
        encode(story_id)
