"""Record a short Orbis-Stable cottage stream to a local MP4.

Run from the repository root: python unneeded/scripts/test_orbis_cottage.py
Requires: pip install reactor-sdk opencv-python
"""

import asyncio
import os
from pathlib import Path

import cv2
from reactor_sdk import Reactor, ReactorStatus


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "out" / "orbis-cottage-test.mp4"
PROMPT = (
    "A cozy stone cottage with a mossy roof sits beside a wildflower garden "
    "at golden hour. Smoke curls gently from the chimney, warm light glows "
    "through the windows, and leaves move in a soft breeze. A narrow path "
    "leads to its wooden door. Wide shot, eye-level, slow camera push in."
)
FPS = 18
SECONDS = 8
FRAME_SIZE = (640, 368)


def load_key():
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("REACTOR_API_KEY="):
            return line.partition("=")[2].strip().strip('"').strip("'")
    return ""


async def main():
    key = load_key()
    if not key:
        raise RuntimeError("Add REACTOR_API_KEY to the repository's .env file")

    OUTPUT.parent.mkdir(exist_ok=True)
    writer = cv2.VideoWriter(
        str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, FRAME_SIZE
    )
    if not writer.isOpened():
        raise RuntimeError("Could not open MP4 video writer")

    reactor = Reactor(
        model_name="reactor/visko-orbis-stable",
        api_key=key,
        max_session_duration_seconds=60,
    )
    finished = asyncio.Event()
    loop = asyncio.get_running_loop()
    frame_count = 0

    @reactor.on_status(ReactorStatus.READY)
    async def on_ready(_status):
        output = reactor.tracks.with_direction("recvonly").with_kind("video").one()

        @output.on_frame
        def on_frame(frame):
            nonlocal frame_count
            if frame_count >= FPS * SECONDS:
                return
            resized = cv2.resize(frame, FRAME_SIZE)
            writer.write(cv2.cvtColor(resized, cv2.COLOR_RGB2BGR))
            frame_count += 1
            if frame_count >= FPS * SECONDS:
                loop.call_soon_threadsafe(finished.set)

        print("Orbis ready; starting cottage stream...")
        await reactor.send_command("set_prompt", {"prompt": PROMPT})
        await reactor.send_command("start", {})

    try:
        await reactor.connect()
        await asyncio.wait_for(finished.wait(), timeout=90)
    finally:
        await reactor.disconnect()
        writer.release()

    print(f"Saved {frame_count} frames to {OUTPUT}")


if __name__ == "__main__":
    asyncio.run(main())
