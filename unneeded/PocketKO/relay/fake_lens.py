"""Stand-in for the glasses: sends a finisher to the relay and counts the frames it gets back.

python unneeded/PocketKO/relay/fake_lens.py --image out/ko/seed.jpg --steer-after 7
Writes the last received frame to out/ko/lens_last_frame.jpg.
"""

import argparse
import asyncio
import base64
import json
import time
from pathlib import Path

import aiohttp

ROOT = Path(__file__).resolve().parents[3]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="ws://localhost:8765/ws")
    ap.add_argument("--image", default=str(ROOT / "out" / "ko" / "seed.jpg"))
    ap.add_argument("--seconds", type=float, default=20)
    ap.add_argument("--steer-after", type=float, default=7)
    args = ap.parse_args()
    img = base64.b64encode(Path(args.image).read_bytes()).decode()
    frames, first, sizes, last = 0, None, [], None
    async with aiohttp.ClientSession() as http:
        async with http.ws_connect(args.url, max_msg_size=16 * 1024 * 1024) as ws:
            await ws.send_str(json.dumps({"type": "hello", "role": "lens"}))
            await ws.send_str(json.dumps({"type": "prewarm"}))
            await asyncio.sleep(1.0)
            t0 = time.time()
            await ws.send_str(json.dumps({
                "type": "finisher", "image": img, "object": "banana", "move": "POTASSIUM SLAM",
                "ko_action": "A huge banana drops from the sky and squashes the green blob monster flat like a pancake.",
            }))
            steered = False
            while time.time() - t0 < args.seconds:
                if not steered and time.time() - t0 > args.steer_after:
                    await ws.send_str(json.dumps({"type": "steer", "text": "slow mo"}))
                    steered = True
                try:
                    msg = await asyncio.wait_for(ws.receive(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                if msg.type != aiohttp.WSMsgType.TEXT:
                    break
                m = json.loads(msg.data)
                if m["type"] == "frame":
                    frames += 1
                    first = first or time.time() - t0
                    sizes.append(len(m["jpg"]))
                    last = m["jpg"]
                elif m["type"] == "status":
                    print(f"{time.time() - t0:5.1f}s status {m['state']}: {m.get('detail', '')}")
    if last:
        (ROOT / "out" / "ko" / "lens_last_frame.jpg").write_bytes(base64.b64decode(last))
    span = args.seconds - (first or args.seconds)
    print(json.dumps({
        "frames": frames,
        "first_frame_s": round(first, 2) if first else None,
        "fps": round(frames / span, 1) if span > 0 and frames else 0,
        "avg_b64_kb": round(sum(sizes) / len(sizes) / 1024, 1) if sizes else 0,
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
