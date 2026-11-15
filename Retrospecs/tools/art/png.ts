/**
 * Tiny RGBA PNG encoder (node zlib, no native build). Posterizes colour and alpha first so the flat-colour cards
 * compress well: fully transparent pixels become 0,0,0,0, and channels snap to `rgbStep` / `alphaStep` levels.
 * Each row picks the PNG filter (none, sub, up, average, Paeth) with the smallest absolute sum.
 */
import {deflateSync} from "node:zlib"

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

const snap = (v: number, step: number) => (step <= 1 ? v : Math.min(255, Math.round(v / step) * step))

export function encodePng(rgba: Uint8Array, w: number, h: number, rgbStep = 4, alphaStep = 4): Uint8Array {
  const px = new Uint8Array(rgba)
  for (let i = 0; i < px.length; i += 4) {
    const a = snap(px[i + 3], alphaStep)
    if (a === 0) {
      px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0
      continue
    }
    px[i] = snap(px[i], rgbStep)
    px[i + 1] = snap(px[i + 1], rgbStep)
    px[i + 2] = snap(px[i + 2], rgbStep)
    px[i + 3] = a
  }
  const stride = w * 4
  const raw = new Uint8Array((stride + 1) * h)
  const cand = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride))
  for (let y = 0; y < h; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride)
    const up = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null
    let best = 0, bestSum = Infinity
    for (let f = 0; f < 5; f++) {
      const o = cand[f]
      let sum = 0
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? row[i - 4] : 0
        const b = up ? up[i] : 0
        const c = up && i >= 4 ? up[i - 4] : 0
        let p: number
        if (f === 0) p = 0
        else if (f === 1) p = a
        else if (f === 2) p = b
        else if (f === 3) p = (a + b) >> 1
        else {
          const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c)
          p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        }
        const v = (row[i] - p) & 0xff
        o[i] = v
        sum += v < 128 ? v : 256 - v
      }
      if (sum < bestSum) {
        bestSum = sum
        best = f
      }
    }
    raw[y * (stride + 1)] = best
    raw.set(cand[best], y * (stride + 1) + 1)
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, {level: 9})), chunk("IEND", new Uint8Array(0))]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
