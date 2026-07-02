import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadModelSvg } from './loadModelSvg.js'

afterEach(() => vi.restoreAllMocks())

describe('loadModelSvg', () => {
  it('returns the svg text on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '<svg>ok</svg>' })))
    await expect(loadModelSvg('/catalog/crane.svg')).resolves.toBe('<svg>ok</svg>')
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })))
    await expect(loadModelSvg('/catalog/missing.svg')).rejects.toThrow(/404/)
  })
})
