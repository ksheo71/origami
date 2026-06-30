import { describe, it, expect } from 'vitest'
import { createApp } from './index.js'

describe('GET /api/health', () => {
  it('returns 200 with ok=true and version', async () => {
    const app = createApp()
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; version: string }
    expect(body.ok).toBe(true)
    expect(typeof body.version).toBe('string')
  })

  it('version reflects GIT_SHA env when set', async () => {
    const original = process.env.GIT_SHA
    process.env.GIT_SHA = 'abc123'
    try {
      const app = createApp()
      const res = await app.request('/api/health')
      const body = await res.json() as { version: string }
      expect(body.version).toBe('abc123')
    } finally {
      if (original === undefined) delete process.env.GIT_SHA
      else process.env.GIT_SHA = original
    }
  })

  it('version is "dev" when GIT_SHA is unset', async () => {
    const original = process.env.GIT_SHA
    delete process.env.GIT_SHA
    try {
      const app = createApp()
      const res = await app.request('/api/health')
      const body = await res.json() as { version: string }
      expect(body.version).toBe('dev')
    } finally {
      if (original !== undefined) process.env.GIT_SHA = original
    }
  })
})
