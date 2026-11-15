/**
 * Talks to the laptop relay (PocketKO/relay/server.py) over a WebSocket:
 * sends prewarm / finisher / steer, receives JPEG frames and decodes them into a texture for the in-lens jumbotron.
 */

export type RelayState = "offline" | "idle" | "connecting" | "ready" | "generating" | "done" | "error"

export class RelayClient {
  state: RelayState = "offline"
  framesReceived = 0
  lastFrameAt = 0
  onFrame: (tex: Texture) => void = null
  onState: (s: RelayState, detail: string) => void = null

  private ws: WebSocket = null
  private decoding = false
  private pendingJpg: string = null
  private retryAt = 0

  constructor(private internet: InternetModule, private url: string) {}

  connect() {
    if (!this.internet || !this.url) return
    try {
      this.ws = this.internet.createWebSocket(this.url)
    } catch (e) {
      print("[PocketKO] relay socket failed: " + e)
      this.retryAt = getTime() + 5
      return
    }
    this.ws.onopen = () => {
      this.setState("idle", "connected")
      this.ws.send(JSON.stringify({type: "hello", role: "lens"}))
    }
    this.ws.onmessage = (ev: any) => {
      const data = ev.data
      if (typeof data !== "string") return
      let m: any
      try {
        m = JSON.parse(data)
      } catch (e) {
        return
      }
      if (m.type === "status") this.setState(m.state, m.detail || "")
      else if (m.type === "frame") this.queueFrame(m.jpg)
    }
    this.ws.onclose = () => {
      this.setState("offline", "closed")
      this.ws = null
      this.retryAt = getTime() + 3
    }
    this.ws.onerror = () => {
      this.setState("offline", "error")
    }
  }

  /** Call every frame: reconnects if the socket dropped. */
  update() {
    if (!this.ws && this.retryAt > 0 && getTime() >= this.retryAt) {
      this.retryAt = 0
      this.connect()
    }
  }

  get connected(): boolean {
    return this.ws !== null && this.state !== "offline"
  }

  prewarm() {
    this.send({type: "prewarm"})
  }

  finisher(seedJpgBase64: string, objectName: string, moveName: string, koAction: string) {
    this.framesReceived = 0
    this.send({type: "finisher", image: seedJpgBase64, object: objectName, move: moveName, ko_action: koAction})
  }

  steer(text: string) {
    this.send({type: "steer", text})
  }

  stop() {
    this.send({type: "stop"})
  }

  private send(obj: any) {
    if (!this.ws) return
    try {
      this.ws.send(JSON.stringify(obj))
    } catch (e) {
      print("[PocketKO] relay send failed: " + e)
    }
  }

  /** Decode one frame at a time; if frames arrive faster, keep only the newest. */
  private queueFrame(jpg: string) {
    if (this.decoding) {
      this.pendingJpg = jpg
      return
    }
    this.decode(jpg)
  }

  private decode(jpg: string) {
    this.decoding = true
    Base64.decodeTextureAsync(
      jpg,
      (tex) => {
        this.framesReceived++
        this.lastFrameAt = getTime()
        if (this.onFrame) this.onFrame(tex)
        this.decoding = false
        if (this.pendingJpg) {
          const next = this.pendingJpg
          this.pendingJpg = null
          this.decode(next)
        }
      },
      () => {
        this.decoding = false
        this.pendingJpg = null
      }
    )
  }

  private setState(s: RelayState, detail: string) {
    this.state = s
    if (this.onState) this.onState(s, detail)
  }
}
