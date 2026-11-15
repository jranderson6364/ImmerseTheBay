# Pocket KO — parked build log

Parked November 14, 2026 at the user's request. This is an **unfinished prototype**. The project, concept, relay, preview, and tests are together in this folder. Nothing in this folder has been committed yet.

## What exists

- `CONCEPT.md`: game pitch and track fit (Game Changer, AI Horizons, possible Visko sponsor challenge).
- `Assets/PocketKO/Core/`: move validation, wrist gesture detection, cooldowns, combat, combos, effects, finisher, and results. The 11 Bun tests in `tests/` pass after the move.
- `Assets/PocketKO/Scripts/`: Lens Studio scripts for the Glorp, visual effects, announcer, Gemini move generation, hand input, and a WebSocket JPEG video screen.
- `Assets/Scene.scene`: Snap Depth Cache sample scene used as a base. The Pocket KO controller has **not** been added or connected to this scene.
- `relay/server.py`: Python relay that runs live Orbis, sends JPEG frames over WebSocket, and serves the laptop jumbotron and browser preview. `relay/fake_lens.py` is a stand-in WebSocket client.
- `relay/static/play.html` and `play.js`: playable browser mockup with keyboard gestures, a desk image, the game core, and live Orbis finisher. It is a preview, not the Spectacles build.
- `tools/orbis_ko_test.py`: standalone Orbis prompt/seed/steering test. Generated clips and frames are in the ignored repo-root `out/ko/` folder if present.
- `README.md`: build and setup instructions. Paths were updated for this parked location.

## What was actually tested

- `bun test unneeded/PocketKO/tests`: **11 passed, 0 failed** after parking.
- Earlier in this session, the Pocket KO Lens scripts produced zero project-file TypeScript errors against Lens Studio 5.15 declarations. This checks types, not editor or device behavior.
- Orbis accepted the API key, generated a seeded cartoon KO, and responded to a live `set_prompt` steer. A laptop fake client received frames from the relay; the browser jumbotron and preview displayed a round. Earlier observations were roughly 2 seconds to Orbis ready and 4–6 seconds to first frame, depending on test.
- After moving the files, this environment's `python.exe` launcher could not start, so the Python entry points were **not rerun** from the new path. Their repository-root path calculations were updated.

## What is unfinished or unverified

- **Lens Studio scene wiring:** the sample `SceneController` still needs disabling, a `PocketKOController` scene object needs adding, and its camera, depth, meshes, materials, InternetModule, and optional ASR inputs need connecting. No Pocket KO scene preview has run in Lens Studio.
- **Spectacles:** no Pocket KO Lens has been deployed or tested on the loaner device. Table placement, object recognition, hand tracking while gripping an item, voice, performance, and battery are unverified.
- **Video in the glasses:** the relay-to-fake-client and browser paths work. The WebSocket-to-JPEG-to-texture path in the Lens is only typed code; there is no on-device proof of video display, frame rate, or latency.
- **Network and credentials:** a working Remote Service Gateway token, Experimental APIs setting, laptop/glasses network, and relay URL still need on-device setup. The real Orbis API key remains in the repo-root `.env`, which is ignored by Git.
- **Hackathon deliverables:** no Pocket KO 30-second device video, public build validation, Devpost submission, or prize-track verification was completed here.

## To resume later

1. Open `unneeded/PocketKO/PocketKO.esproj` in Lens Studio and complete the wiring table in `README.md`.
2. Start the relay from the repo root with `python unneeded/PocketKO/relay/server.py` and open `http://localhost:8765` on the laptop.
3. Push to Spectacles and test the camera, gesture, relay, and in-lens video paths before promising a live demo.

This folder was intentionally parked; the browser preview is evidence of the concept, not evidence that the glasses build works.
