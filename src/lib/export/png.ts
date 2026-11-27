/** PNG chunk utilities: pHYs (physical size) and tEXt (provenance), inserted after IHDR. */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  const tb = new TextEncoder().encode(type)
  out.set(tb, 4)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

export function physChunk(dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254)
  const d = new Uint8Array(9)
  const dv = new DataView(d.buffer)
  dv.setUint32(0, ppm)
  dv.setUint32(4, ppm)
  d[8] = 1 // unit: metre
  return chunk('pHYs', d)
}

/** tEXt: Latin-1 keyword + NUL + Latin-1 text (non-Latin-1 characters are replaced by '?'). */
export function textChunk(keyword: string, text: string): Uint8Array {
  const latin1 = (s: string) => Uint8Array.from(s, (ch) => (ch.charCodeAt(0) < 256 ? ch.charCodeAt(0) : 63))
  const k = latin1(keyword.slice(0, 79))
  const t = latin1(text)
  const d = new Uint8Array(k.length + 1 + t.length)
  d.set(k)
  d.set(t, k.length + 1)
  return chunk('tEXt', d)
}

/** Insert chunks right after IHDR (which is always the first chunk). Existing pHYs is dropped. */
export function withChunks(png: Uint8Array, extra: Uint8Array[]): Uint8Array {
  const sig = 8
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const ihdrLen = dv.getUint32(sig)
  const ihdrEnd = sig + 12 + ihdrLen
  const parts: Uint8Array[] = [png.subarray(0, ihdrEnd), ...extra]
  let p = ihdrEnd
  while (p < png.length) {
    const len = dv.getUint32(p)
    const type = String.fromCharCode(...png.subarray(p + 4, p + 8))
    const end = p + 12 + len
    if (type !== 'pHYs') parts.push(png.subarray(p, end))
    p = end
  }
  const out = new Uint8Array(parts.reduce((s, x) => s + x.length, 0))
  let o = 0
  for (const x of parts) {
    out.set(x, o)
    o += x.length
  }
  return out
}

export interface PngInfo {
  width: number
  height: number
  dpiX: number | null
  text: Record<string, string>
}

export function readPngInfo(png: Uint8Array): PngInfo {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let p = 8
  const info: PngInfo = { width: 0, height: 0, dpiX: null, text: {} }
  while (p < png.length) {
    const len = dv.getUint32(p)
    const type = String.fromCharCode(...png.subarray(p + 4, p + 8))
    const d = p + 8
    if (type === 'IHDR') {
      info.width = dv.getUint32(d)
      info.height = dv.getUint32(d + 4)
    } else if (type === 'pHYs' && png[d + 8] === 1) info.dpiX = Math.round(dv.getUint32(d) * 0.0254)
    else if (type === 'tEXt') {
      const b = png.subarray(d, d + len)
      const z = b.indexOf(0)
      info.text[String.fromCharCode(...b.subarray(0, z))] = String.fromCharCode(...b.subarray(z + 1))
    }
    p += 12 + len
  }
  return info
}

/** Conservative browser canvas limits (Chromium/Firefox): max side 16,384 px, max area 268 Mpx. */
export const MAX_CANVAS_SIDE = 16384
export const MAX_CANVAS_AREA = 268_435_456

export function pngPixelSize(widthMm: number, heightMm: number, dpi: number) {
  return { width: Math.round((widthMm / 25.4) * dpi), height: Math.round((heightMm / 25.4) * dpi) }
}

export function checkCanvasSize(w: number, h: number): string | null {
  if (w > MAX_CANVAS_SIDE || h > MAX_CANVAS_SIDE) return `Requested ${w} × ${h} px exceeds the browser canvas limit of ${MAX_CANVAS_SIDE} px per side. Choose a smaller size or a lower dpi; the export is not downscaled.`
  if (w * h > MAX_CANVAS_AREA) return `Requested ${w} × ${h} px (${((w * h) / 1e6).toFixed(0)} Mpx) exceeds the browser canvas area limit (${MAX_CANVAS_AREA / 1e6} Mpx). Choose a smaller size or a lower dpi; the export is not downscaled.`
  return null
}
