"""Pocket KO: test whether Orbis makes a funny, steerable KO cinematic.

Run from the repo root:
  python unneeded/PocketKO/tools/orbis_ko_test.py                       # prompt-only, saves a seed frame
  python unneeded/PocketKO/tools/orbis_ko_test.py --seed out/ko/seed.jpg  # seed the world from a photo (set_image)

Writes out/ko/<name>.mp4, a few JPEG frames, timings, and the model's command schema.
Requires: pip install reactor-sdk opencv-python
"""

import argparse
import asyncio
import json
import time
from pathlib import Path

import cv2
from reactor_sdk import Reactor, ReactorStatus

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "out" / "ko"

SCENE = (
    "A bright yellow banana lies on a wooden table next to a small round green cartoon "
    "blob monster with big googly eyes. Indoor, eye-level, shallow depth of field."
)
KO = (
    "The banana suddenly grows giant and slams down on the green cartoon blob monster, "
    "squashing it flat like a pancake. Cartoon impact, confetti burst, stars spinning, "
    "bowling alley strike celebration energy. Camera shakes, then slowly zooms in."
)
STEER = (
    "Slow motion replay of the giant banana squashing the flattened green blob monster, "
    "huge colorful confetti explosion, fireworks, the monster's eyes spinning."
)


def load_key():
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("REACTOR_API_KEY="):
            return line.partition("=")[2].strip().strip('"').strip("'")
    return ""


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", help="image to seed the world with (set_image)")
    ap.add_argument("--name", default=None)
    ap.add_argument("--seconds", type=float, default=14)
    ap.add_argument("--model", default="reactor/visko-orbis-stable")
    ap.add_argument("--ko", default=None, help="override the KO prompt")
    ap.add_argument("--scene", default=None, help="override the opening scene prompt")
    ap.add_argument("--steer", default=None, help="override the steering prompt")
    args = ap.parse_args()
    global KO, STEER, SCENE
    SCENE = args.scene or SCENE
    KO = args.ko or KO
    STEER = args.steer or STEER
    name = args.name or ("seeded" if args.seed else "prompt")
    OUT.mkdir(parents=True, exist_ok=True)

    key = load_key()
    if not key:
        raise RuntimeError("Add REACTOR_API_KEY to .env")

    fps, size = 18, (640, 368)
    writer = cv2.VideoWriter(str(OUT / f"{name}.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
    reactor = Reactor(model_name=args.model, api_key=key, max_session_duration_seconds=60)
    loop = asyncio.get_running_loop()
    done = asyncio.Event()
    t = {"connect": time.time()}
    state = {"frames": 0, "steered": False}

    @reactor.on_status(ReactorStatus.READY)
    async def on_ready(_s):
        t["ready"] = time.time()
        try:
            schema = await reactor.request_schema()
            (OUT / "orbis-schema.json").write_text(json.dumps(schema, indent=2))
        except Exception as e:  # noqa: BLE001
            print("schema request failed:", e)
        out = reactor.tracks.with_direction("recvonly").with_kind("video").one()

        @out.on_frame
        def on_frame(frame):
            n = state["frames"]
            if n == 0:
                t["first_frame"] = time.time()
            img = cv2.cvtColor(cv2.resize(frame, size), cv2.COLOR_RGB2BGR)
            writer.write(img)
            if n in (0, fps * 3, fps * 6, fps * 9, fps * 12):
                cv2.imwrite(str(OUT / f"{name}_f{n:04d}.jpg"), img)
                if not args.seed and n == fps * 3:
                    cv2.imwrite(str(OUT / f"{name}_seed.jpg"), cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
            state["frames"] = n + 1
            if state["frames"] >= fps * args.seconds:
                loop.call_soon_threadsafe(done.set)

        if args.seed:
            ref = await reactor.upload_file(args.seed)
            await reactor.send_command("set_image", {"image": ref})
            await reactor.send_command("set_prompt", {"prompt": KO})
        else:
            await reactor.send_command("set_prompt", {"prompt": SCENE})
        await reactor.send_command("start", {})
        t["started"] = time.time()

    async def steer_later():
        # Prompt-only run: scene first, then the KO, then a steering change. Seeded run: KO then steer.
        await asyncio.sleep(4 if not args.seed else 7)
        if not args.seed:
            await reactor.send_command("set_prompt", {"prompt": KO})
            t["ko_sent"] = time.time()
            await asyncio.sleep(5)
        await reactor.send_command("set_prompt", {"prompt": STEER})
        t["steer_sent"] = time.time()

    try:
        await reactor.connect()
        await asyncio.wait_for(_wait_ready(reactor), timeout=60)
        asyncio.create_task(steer_later())
        await asyncio.wait_for(done.wait(), timeout=120)
    finally:
        await reactor.disconnect()
        writer.release()

    base = t["connect"]
    print(json.dumps({k: round(v - base, 2) for k, v in t.items()}, indent=2))
    print(f"frames: {state['frames']} -> {OUT / (name + '.mp4')}")


async def _wait_ready(reactor):
    while "ready" not in str(reactor.status).lower():
        await asyncio.sleep(0.2)


if __name__ == "__main__":
    asyncio.run(main())
