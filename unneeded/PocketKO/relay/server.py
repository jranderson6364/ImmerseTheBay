"""Pocket KO relay: runs Orbis on the laptop and streams the KO cinematic to the glasses and a jumbotron page.

Run from the repo root:   python unneeded/PocketKO/relay/server.py
Then open http://localhost:8765 on the laptop (the jumbotron) and point the Lens at ws://<laptop-ip>:8765/ws
(or a wss:// tunnel, see unneeded/PocketKO/README.md).

Protocol (JSON over WebSocket /ws):
  Lens -> relay   {"type": "hello", "role": "lens"}
                  {"type": "prewarm"}                                  connect to Orbis early (no generation yet)
                  {"type": "finisher", "image": <base64 jpeg>, "object": "banana",
                   "move": "POTASSIUM SLAM", "ko_action": "A huge banana ..."}
                  {"type": "steer", "text": "slow mo"}                 live steering from voice
                  {"type": "stop"}
  relay -> Lens   {"type": "status", "state": "idle|connecting|ready|generating|done|error", "detail": "..."}
                  {"type": "frame", "jpg": <base64 jpeg>, "w": 400, "h": 224, "n": 17}
Requires: pip install reactor-sdk opencv-python aiohttp
"""

import argparse
import asyncio
import base64
import json
import tempfile
import threading
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from aiohttp import WSMsgType, web
from reactor_sdk import Reactor, ReactorStatus

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent

STYLE = (
    " Bright saturated cartoon style. The green blob monster gets squashed with a huge gooey splat,"
    " confetti bursts everywhere, cartoon stars spin, bowling alley strike celebration energy."
)
STEERS = [
    (("slow", "slo-mo", "slomo", "slow mo"), "Extreme slow motion replay of the impact, every confetti piece hanging in the air."),
    (("explo", "boom", "blow"), "A gigantic colorful cartoon explosion with fireworks and shockwaves."),
    (("zoom out", "wide", "back"), "The camera pulls far back to reveal the whole table and the giant object towering over the splat."),
    (("zoom in", "close"), "Extreme close-up on the flattened monster's spinning dizzy eyes."),
    (("again", "replay", "one more"), "The giant object lifts up and slams down again for a second splat."),
    (("spin", "twirl"), "The camera orbits around the giant object in a dramatic spin."),
    (("rainbow", "party", "dance"), "Rainbow disco lights, a dance party breaks out around the splat."),
]


def load_key():
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("REACTOR_API_KEY="):
            return line.partition("=")[2].strip().strip('"').strip("'")
    return ""


def crop_16x9(img):
    h, w = img.shape[:2]
    target = w / h
    if target > 16 / 9:  # too wide: crop width
        nw = int(h * 16 / 9)
        x = (w - nw) // 2
        return img[:, x : x + nw]
    nh = int(w * 9 / 16)
    y = (h - nh) // 2
    return img[y : y + nh, :]


def draw_glorp(img, cx=0.58, cy=0.66, size=0.30):
    """The glasses' camera can't see the virtual monster, so paint a cartoon Glorp onto the seed photo.
    Orbis then 'grows' the KO out of a frame that already has the real table, the real object, and the blob."""
    out = img.copy()
    h, w = out.shape[:2]
    r = int(h * size / 2)
    x, y = int(w * cx), int(h * cy)
    green, dark, belly = (60, 230, 110), (30, 150, 50), (140, 255, 190)  # BGR
    cv2.ellipse(out, (x, y + int(r * 0.92)), (int(r * 0.95), int(r * 0.18)), 0, 0, 360, (25, 25, 25), -1, cv2.LINE_AA)  # shadow
    for s in (-1, 1):
        cv2.ellipse(out, (x + s * int(r * 0.55), y + int(r * 0.85)), (int(r * 0.32), int(r * 0.16)), 0, 0, 360, dark, -1, cv2.LINE_AA)
    cv2.line(out, (x, y - int(r * 0.9)), (x, y - int(r * 1.35)), dark, max(2, r // 14), cv2.LINE_AA)
    cv2.circle(out, (x, y - int(r * 1.42)), max(3, r // 7), (40, 220, 255), -1, cv2.LINE_AA)
    cv2.ellipse(out, (x, y), (r, int(r * 0.92)), 0, 0, 360, green, -1, cv2.LINE_AA)
    cv2.ellipse(out, (x, y + int(r * 0.25)), (int(r * 0.55), int(r * 0.45)), 0, 0, 360, belly, -1, cv2.LINE_AA)
    cv2.ellipse(out, (x - int(r * 0.45), y - int(r * 0.5)), (int(r * 0.18), int(r * 0.1)), -30, 0, 360, (200, 255, 220), -1, cv2.LINE_AA)
    for s in (-1, 1):
        ex, ey = x + s * int(r * 0.38), y - int(r * 0.32)
        cv2.ellipse(out, (ex, ey), (int(r * 0.3), int(r * 0.35)), 0, 0, 360, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(out, (ex + s * int(r * 0.04), ey + int(r * 0.04)), int(r * 0.14), (10, 10, 10), -1, cv2.LINE_AA)
        cv2.circle(out, (ex + s * int(r * 0.0) - int(r * 0.05), ey - int(r * 0.06)), max(1, int(r * 0.05)), (255, 255, 255), -1, cv2.LINE_AA)
    cv2.ellipse(out, (x, y + int(r * 0.12)), (int(r * 0.28), int(r * 0.12)), 0, 0, 180, (10, 10, 10), max(2, r // 16), cv2.LINE_AA)
    return out


class OrbisSession:
    """One Orbis session at a time. Frames land on an SDK thread; we keep only the latest."""

    def __init__(self, key, model, max_seconds, on_status, paint_glorp=True):
        self.paint_glorp = paint_glorp
        self.key = key
        self.model = model
        self.max_seconds = max_seconds
        self.on_status = on_status
        self.reactor = None
        self.ready = asyncio.Event()
        self.lock = threading.Lock()
        self.queue = deque(maxlen=180)  # RGB numpy frames, oldest first
        self.frame_no = 0
        self.base_prompt = ""
        self.started_at = None
        self.connected_at = None

    async def connect(self):
        if self.reactor is not None:
            return
        self.on_status("connecting", "opening Orbis session")
        self.connected_at = time.time()
        self.reactor = Reactor(model_name=self.model, api_key=self.key, max_session_duration_seconds=self.max_seconds)
        loop = asyncio.get_running_loop()

        @self.reactor.on_status(ReactorStatus.READY)
        async def _ready(_s):
            out = self.reactor.tracks.with_direction("recvonly").with_kind("video").one()

            @out.on_frame
            def _frame(frame):
                with self.lock:
                    self.queue.append(frame)
                    self.frame_no += 1

            try:
                await self.reactor.send_command("set_audio_enabled", {"audio_enabled": False})
            except Exception:  # noqa: BLE001 - optional on some deployments
                pass
            loop.call_soon_threadsafe(self.ready.set)
            self.on_status("ready", "Orbis ready")

        await self.reactor.connect()

    async def finisher(self, seed_bgr, ko_action):
        await self.connect()
        await asyncio.wait_for(self.ready.wait(), timeout=30)
        if seed_bgr is not None:
            seed = cv2.resize(crop_16x9(seed_bgr), (1280, 720))
            if self.paint_glorp:
                seed = draw_glorp(seed)
            cv2.imwrite(str(ROOT / "out" / "ko" / "last_seed.jpg"), seed)
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
                cv2.imwrite(f.name, seed, [cv2.IMWRITE_JPEG_QUALITY, 90])
                ref = await self.reactor.upload_file(f.name)
            await self.reactor.send_command("set_image", {"image": ref})
        self.base_prompt = ko_action.strip() + STYLE
        await self.reactor.send_command("set_prompt", {"prompt": self.base_prompt})
        await self.reactor.send_command("start", {})
        self.started_at = time.time()
        self.on_status("generating", "KO cinematic streaming")

    async def steer(self, text):
        if self.reactor is None or self.started_at is None:
            return None
        t = text.lower()
        extra = next((p for keys, p in STEERS if any(k in t for k in keys)), None)
        if extra is None:
            extra = f"Now: {text.strip()}."
        await self.reactor.send_command("set_prompt", {"prompt": self.base_prompt + " " + extra})
        return extra

    def take_next(self, max_backlog):
        """Orbis delivers frames in bursts per chunk; hand them out one at a time at a steady rate.
        If we fall too far behind, skip ahead so the stream stays live."""
        with self.lock:
            while len(self.queue) > max_backlog:
                self.queue.popleft()
            return self.queue.popleft() if self.queue else None

    async def close(self):
        if self.reactor is not None:
            try:
                await self.reactor.disconnect()
            except Exception:  # noqa: BLE001
                pass
        self.reactor = None


class Relay:
    def __init__(self, args):
        self.args = args
        self.key = load_key()
        if not self.key:
            raise SystemExit("Add REACTOR_API_KEY to the repo's .env")
        self.lens_clients = set()
        self.page_clients = set()
        self.session = None
        self.state = "idle"
        self.detail = ""
        self.last_seed = None
        self.mjpeg_frame = None
        self.events = []  # recent log lines for the jumbotron page

    # -- status -------------------------------------------------------------
    def set_status(self, state, detail=""):
        self.state, self.detail = state, detail
        self.log(f"{state}: {detail}")
        msg = json.dumps({"type": "status", "state": state, "detail": detail})
        for ws in list(self.lens_clients | self.page_clients):
            asyncio.ensure_future(self._send(ws, msg))

    def log(self, line):
        stamp = time.strftime("%H:%M:%S")
        self.events = (self.events + [f"{stamp} {line}"])[-12:]
        print(f"[relay] {stamp} {line}", flush=True)

    async def _send(self, ws, msg):
        try:
            await ws.send_str(msg)
        except Exception:  # noqa: BLE001
            self.lens_clients.discard(ws)
            self.page_clients.discard(ws)

    # -- session control ----------------------------------------------------
    def _new_session(self):
        return OrbisSession(self.key, self.args.model, self.args.max_seconds, self.set_status, paint_glorp=not self.args.no_glorp)

    async def prewarm(self):
        if self.session is None:
            self.session = self._new_session()
            asyncio.ensure_future(self._guarded(self.session.connect()))
            asyncio.ensure_future(self._idle_timeout(self.session))

    async def _idle_timeout(self, s):
        # Billing runs while connected; drop a pre-warmed session nobody used.
        await asyncio.sleep(self.args.prewarm_timeout)
        if self.session is s and s.started_at is None:
            self.log("pre-warmed session unused; closing")
            await self.stop()

    async def finisher(self, seed_bgr, ko_action):
        if self.session is not None and self.session.started_at is not None:
            await self.stop()
        if self.session is None:
            self.session = self._new_session()
        if seed_bgr is not None:
            self.last_seed = seed_bgr
        s = self.session
        await self._guarded(s.finisher(seed_bgr, ko_action))
        asyncio.ensure_future(self._cap(s))

    async def _cap(self, s):
        await asyncio.sleep(self.args.cinematic_seconds)
        if self.session is s:
            self.set_status("done", "KO cinematic finished")
            await self.stop(status=False)

    async def stop(self, status=True):
        s, self.session = self.session, None
        if s is not None:
            await s.close()
        if status:
            self.set_status("idle", "stopped")

    async def _guarded(self, coro):
        try:
            await coro
        except Exception as e:  # noqa: BLE001
            self.set_status("error", repr(e))
            await self.stop(status=False)

    # -- frame pump -----------------------------------------------------------
    async def pump(self):
        period = 1.0 / self.args.lens_fps
        no = 0
        while True:
            await asyncio.sleep(period)
            s = self.session
            if s is None:
                continue
            frame = s.take_next(max_backlog=int(self.args.lens_fps * 3))
            if frame is None:
                continue
            no += 1
            bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            ok, big = cv2.imencode(".jpg", cv2.resize(bgr, (960, 540)), [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                self.mjpeg_frame = big.tobytes()
            if self.lens_clients:
                w, h = self.args.lens_width, int(self.args.lens_width * 9 / 16) // 8 * 8
                ok, small = cv2.imencode(".jpg", cv2.resize(bgr, (w, h)), [cv2.IMWRITE_JPEG_QUALITY, self.args.lens_quality])
                if ok:
                    msg = json.dumps({"type": "frame", "jpg": base64.b64encode(small.tobytes()).decode(), "w": w, "h": h, "n": no})
                    for ws in list(self.lens_clients):
                        await self._send(ws, msg)

    # -- HTTP / WS handlers ---------------------------------------------------
    async def ws_handler(self, request):
        ws = web.WebSocketResponse(max_msg_size=16 * 1024 * 1024, heartbeat=20)
        await ws.prepare(request)
        role = "lens"
        self.lens_clients.add(ws)
        self.log(f"client connected from {request.remote}")
        await ws.send_str(json.dumps({"type": "status", "state": self.state, "detail": self.detail}))
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue
            try:
                data = json.loads(msg.data)
            except ValueError:
                continue
            kind = data.get("type")
            if kind == "hello" and data.get("role") == "page":
                role = "page"
                self.lens_clients.discard(ws)
                self.page_clients.add(ws)
            elif kind == "prewarm":
                self.log("prewarm requested")
                await self.prewarm()
            elif kind == "finisher":
                seed = None
                if data.get("image"):
                    raw = np.frombuffer(base64.b64decode(data["image"]), np.uint8)
                    seed = cv2.imdecode(raw, cv2.IMREAD_COLOR)
                elif self.last_seed is not None:
                    seed = self.last_seed
                else:
                    seed = self.default_seed()
                obj = data.get("object", "object")
                ko = data.get("ko_action") or f"A giant {obj} smashes the green blob monster flat."
                self.log(f"FINISHER: {data.get('move', '?')} with {obj}")
                asyncio.ensure_future(self.finisher(seed, ko))
            elif kind == "steer":
                if self.session is not None:
                    extra = await self.session.steer(data.get("text", ""))
                    if extra:
                        self.log(f"steer '{data.get('text')}' -> {extra[:60]}")
            elif kind == "stop":
                await self.stop()
        self.lens_clients.discard(ws)
        self.page_clients.discard(ws)
        self.log(f"{role} client disconnected")
        return ws

    def default_seed(self):
        for name in ("table_seed.jpg", "seed.jpg"):
            path = ROOT / "out" / "ko" / name
            if path.exists():
                return cv2.imread(str(path))
        return None

    async def play(self, _request):
        return web.FileResponse(HERE / "static" / "play.html")

    async def seed_image(self, _request):
        for name in ("table_seed.jpg", "seed.jpg"):
            path = ROOT / "out" / "ko" / name
            if path.exists():
                return web.FileResponse(path)
        raise web.HTTPNotFound()

    async def index(self, _request):
        return web.FileResponse(HERE / "jumbotron.html")

    async def status(self, _request):
        return web.json_response({"state": self.state, "detail": self.detail, "lens_clients": len(self.lens_clients), "log": self.events})

    async def test_ko(self, request):
        """Jumbotron 'test' button: run a finisher from a stored seed image without the glasses."""
        seed = self.last_seed if self.last_seed is not None else self.default_seed()
        obj = request.query.get("object", "banana")
        asyncio.ensure_future(self.finisher(seed, f"A huge {obj} drops from the sky and squashes the green blob monster flat like a pancake."))
        return web.json_response({"ok": True})

    async def mjpeg(self, request):
        resp = web.StreamResponse(headers={"Content-Type": "multipart/x-mixed-replace; boundary=frame", "Cache-Control": "no-cache"})
        await resp.prepare(request)
        last = None
        try:
            while True:
                f = self.mjpeg_frame
                if f is not None and f is not last:
                    last = f
                    await resp.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(f)).encode() + b"\r\n\r\n" + f + b"\r\n")
                await asyncio.sleep(1 / 24)
        except (ConnectionResetError, asyncio.CancelledError):
            pass
        return resp


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--model", default="reactor/visko-orbis-stable")
    ap.add_argument("--max-seconds", type=int, default=60, help="Orbis session hard cap")
    ap.add_argument("--cinematic-seconds", type=float, default=20, help="how long a KO cinematic streams")
    ap.add_argument("--prewarm-timeout", type=float, default=40)
    ap.add_argument("--lens-fps", type=float, default=14)
    ap.add_argument("--lens-width", type=int, default=384)
    ap.add_argument("--lens-quality", type=int, default=60)
    ap.add_argument("--no-glorp", action="store_true", help="don't paint the cartoon monster onto seed photos")
    args = ap.parse_args()

    relay = Relay(args)
    app = web.Application(client_max_size=16 * 1024 * 1024)
    app.add_routes(
        [
            web.get("/", relay.index),
            web.get("/ws", relay.ws_handler),
            web.get("/status", relay.status),
            web.get("/stream.mjpg", relay.mjpeg),
            web.post("/test-ko", relay.test_ko),
            web.get("/play", relay.play),
            web.get("/seed.jpg", relay.seed_image),
            web.static("/static", HERE / "static"),
        ]
    )
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", args.port).start()
    relay.log(f"jumbotron on http://localhost:{args.port}  lens socket ws://<laptop-ip>:{args.port}/ws")
    await relay.pump()


if __name__ == "__main__":
    asyncio.run(main())
