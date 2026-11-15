# Pocket KO

A goofy green blob, the **Glorp**, crash-lands on your table. Your only weapons are whatever is in your pockets.

1. Hold an object up. Gemini turns it into a move, with an **"analyzing your weapon…" cooldown** before you can use it.
2. Physically **slam / swing / poke / toss** the real thing.
3. On the **FINAL BLOW**, a live **Orbis** cinematic of a giant version of your object squashing the Glorp streams onto a jumbotron above the table. It's seeded from a photo of *your* table, and you can steer it by voice ("slow-mo!").

The concept and rationale are in [CONCEPT.md](CONCEPT.md). The current build log is in [STATUS.md](STATUS.md).

## Pieces

| Path | What |
| --- | --- |
| `Assets/PocketKO/Core/` | Pure TS, unit-tested (`bun test parked/PocketKO/tests`): `Moves.ts` (Gemini prompt, schema, validator; fragile items forced to a gentle poke, unsafe items nerfed), `Gesture.ts` (wrist-velocity slam/swing/poke/toss), `Game.ts` (round state machine: cooldown, staleness, new-object combos, stun/slip/burn/multi/knockback, finisher, results). |
| `Assets/PocketKO/Scripts/` | Lens components: `PocketKOController` (main), `Monster` (squash-and-stretch blob), `Fx` (sparks, confetti, damage popups), `RelayClient` (WebSocket + JPEG to texture), `Toon` (helpers). |
| `relay/server.py` | Laptop relay. It runs Orbis, paints the Glorp onto the seed photo (the glasses camera can't see AR content), streams frames to the glasses at about 6–7 fps over WebSocket, and serves the **jumbotron** at `http://localhost:8765` and the **browser play-preview** at `/play`. |
| `relay/fake_lens.py` | Stand-in for the glasses: sends a finisher and counts the frames that come back. |
| `tools/preview/main.ts` | Browser preview of the in-glasses view, using the same Core. Build: `bun build parked/PocketKO/tools/preview/main.ts --outfile parked/PocketKO/relay/static/play.js --external three --target browser` |
| `tools/orbis_ko_test.py` | Standalone Orbis KO prompt tester (writes MP4s and frames to `out/ko/`). |

**Verified on the laptop (Nov 14):**
- Orbis is ready in about 2.3 s, and the first frame arrives about 4 s after `start`.
- A seeded KO (`set_image`) plus live `set_prompt` steering works.
- The relay delivers about 6–7 fps to a WebSocket client at about 13 KB per frame.
- All 11 core tests pass, and all Lens scripts type-check against the Lens 5.15 API.
- **Not yet run in Lens Studio or on the Spectacles.**

## Run the relay (laptop)

```bash
pip install reactor-sdk opencv-python aiohttp
```

```bash
python parked/PocketKO/relay/server.py
```

- Open `http://localhost:8765` full-screen on the laptop. That's the jumbotron. Its **Test KO** button runs a KO without the glasses.
- Open `http://localhost:8765/play` for the browser preview. Keys: `E` scan, `S`/`A`/`W`/`Q` gestures, `K` skip to the finisher, `1`/`2` steer.
- `REACTOR_API_KEY` comes from the repo's `.env`, which is never committed.

**Getting the glasses on the same network:**
- Venue Wi-Fi often blocks device-to-device traffic. Put the laptop and the Specs on a **phone hotspot** and use `ws://<laptop-hotspot-ip>:8765/ws`. That needs **Experimental APIs** on, which is fine for an unpublished push.
- Fallback: a tunnel such as `cloudflared tunnel --url http://localhost:8765`, then use `wss://<tunnel-host>/ws`. It adds about 250 ms.

## One-time Lens Studio setup (about 15 min)

1. Open `parked/PocketKO/PocketKO.esproj` in Lens Studio 5.15+.
2. **Remote Service Gateway token:** Window → Remote Service Gateway Token → paste it into the `RemoteServiceGatewayCredentials` object.
3. **Project Settings → Experimental APIs: ON.** It's needed for camera + internet together, and for `ws://`.
4. Select the object with the sample's `SceneController` and **disable that component**. Keep `DepthCache`, `ASRController` and `SpeechUI`.
5. Create a SceneObject `PocketKO` and add the **`PocketKOController`** script. Fill in:

   | Input | What to set |
   | --- | --- |
   | `camera` | The Camera object |
   | `depthCache` | The DepthCache object |
   | `asr` | The ASRController object |
   | `internetModule` | Create an Internet Module asset (Asset Browser → + → Internet Module) |
   | `relayUrl` | `ws://<laptop-ip>:8765/ws` |
   | `meshSphere` | `Assets/Mesh/Unit Sphere.mesh` |
   | `meshBox` | `Assets/Mesh/Unit Box.mesh` |
   | `meshCylinder` | `Assets/PocketKO/Meshes/ps_cylinder.obj` |
   | `meshPlane` | `Assets/Mesh/Unit Plane.mesh` |
   | `toonMaterial` | `Assets/Materials/White.mat` |
   | `screenMaterial` | `Assets/Materials/CaptureTexture.mat` |

6. **Preview:** click to scan (it cycles through canned moves when there's no camera), then click to attack.
7. **Device:** push the Lens. The Glorp drops about 1.2 s after launch.

## Playing

| Do | Happens |
| --- | --- |
| Hold an item up | It auto-scans 2.5 s after the round starts. After that, pinch the blue **SCAN** orb with your free hand or say "scan" / "new weapon". |
| Wait out "Analyzing your weapon…" | At least a 3.5 s cooldown. The announcer reads the move and the gesture to use. |
| Slam / swing / poke / toss | The right gesture does full damage; a wrong one is a "sloppy" 35% hit. Repeating the same item gets stale, and a new item builds a combo. |
| FINAL BLOW | At 20% HP the next correct gesture KOs the Glorp. The camera still goes to the relay, and the Orbis KO plays on the in-lens jumbotron and the laptop. |
| During the KO | Say "slow-mo", "explode", "zoom out" or "again" to steer it live. |
| After | Results card (MVP item, combo). Say "rematch". |

## Device test checklist (first hour on the Specs)

1. The Glorp lands on the table, not in mid-air. If not, tune `findTable` (depth sample at 70% image height).
2. Hand tracking while **holding** an object: do slams and swings fire? Tune the thresholds in `Core/Gesture.ts` (cm/s). Wrist motion is used because fingers are hidden while gripping.
3. Gemini move quality on 10 random items. Tune the `MOVE_SYSTEM_PROMPT` wording.
4. The relay socket connects (watch `[PocketKO] relay` in the logs), and frames appear on the in-lens jumbotron. If decoding is slow, lower `--lens-width` / `--lens-quality` or `--lens-fps` on the relay.
5. The TTS announcer isn't too chatty. Set `speak` off to compare.

## Known gaps

- If the in-lens stream stalls, the laptop jumbotron still shows the KO live; set it next to the table.
- The Glorp placement and SCAN orb are placed once per round. Re-launch if the table moves.
- Gesture thresholds are guesses until tested on the device.
