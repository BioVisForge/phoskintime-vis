import { describe, expect, it } from 'vitest'
import { crc32, physChunk, textChunk, withChunks, readPngInfo, pngPixelSize, checkCanvasSize } from '../../src/lib/export/png'
import { exportFilename, normalise, DEFAULTS, ptToLayoutPx, provenanceText } from '../../src/lib/export/settings'
import { deflateSync } from 'node:zlib'

function tinyPng(w: number, h: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, data.length)
    out.set(new TextEncoder().encode(type), 4)
    out.set(data, 8)
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
    return out
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const raw = new Uint8Array(h * (1 + 3 * w))
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(deflateSync(raw))), chunk('IEND', new Uint8Array())]
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

describe('PNG chunks', () => {
  it('crc32 matches the PNG reference value', () => {
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082)
  })
  it('writes pHYs and tEXt after IHDR, readable back', () => {
    const png = withChunks(tinyPng(3, 2), [physChunk(600), textChunk('bundle_id', 'pkt-abc'), textChunk('panel_id', 'nm-gof')])
    const info = readPngInfo(png)
    expect([info.width, info.height]).toEqual([3, 2])
    expect(info.dpiX).toBe(600)
    expect(info.text).toEqual({ bundle_id: 'pkt-abc', panel_id: 'nm-gof' })
  })
  it('replaces an existing pHYs', () => {
    const once = withChunks(tinyPng(1, 1), [physChunk(72)])
    expect(readPngInfo(withChunks(once, [physChunk(1200)])).dpiX).toBe(1200)
  })
  it('pixel size from mm and dpi; refuses sizes over the canvas limits', () => {
    expect(pngPixelSize(85, 60, 600)).toEqual({ width: 2008, height: 1417 })
    expect(pngPixelSize(174, 100, 1200).width).toBe(8220)
    expect(checkCanvasSize(8220, 4724)).toBeNull()
    expect(checkCanvasSize(20000, 100)).toMatch(/not downscaled/)
    expect(checkCanvasSize(16384, 16384)).toBeNull() // exactly at both limits
  })
})

describe('export settings', () => {
  it('filenames: <panel>_<bundle-8>_<yyyymmdd>.<ext>, comparisons carry both ids', () => {
    const d = new Date(2026, 10, 26)
    expect(exportFilename('nm-gof', ['pkt-3d14d0f826776869'], 'png', d)).toBe('nm-gof_3d14d0f8_20261126.png')
    expect(exportFilename('compare-overlay', ['pkt-3d14d0f826776869', 'pkt-7d71597712a90adb'], 'pdf', d)).toBe('compare-overlay_3d14d0f8_vs_7d715977_20261126.pdf')
  })
  it('normalises presets and ranges', () => {
    expect(normalise({ ...DEFAULTS, preset: 'double', widthMm: 3 }).widthMm).toBe(174)
    expect(normalise({ ...DEFAULTS, preset: 'custom', widthMm: 3 }).widthMm).toBe(20)
    expect(normalise({ ...DEFAULTS, fontPt: 30 }).fontPt).toBe(12)
    expect(normalise({ ...DEFAULTS, dpi: 450 as never }).dpi).toBe(600)
  })
  it('8 pt at the layout scale', () => {
    expect(ptToLayoutPx(8)).toBeCloseTo((8 * 25.4) / 72 * 5.6, 12)
  })
  it('provenance text names bundle, commit, panel and viewer version', () => {
    expect(provenanceText({ bundleIds: ['pkt-3d14d0f826776869'], commits: ['e634e17aaaa'], panelId: 'nm-gof', viewerVersion: '0.2.0', exportDate: '' })).toBe('bundle pkt-3d14d0f8 · PhosKinTime e634e17 · panel nm-gof · PhosKinTime-Vis 0.2.0')
  })
})
