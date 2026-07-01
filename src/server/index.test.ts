import { describe, it, expect } from 'vitest'
import { createApp } from './index.js'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

describe('static serving', () => {
  function setupStaticDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'origami-static-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body>HOME</body></html>')
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("app")')
    return dir
  }

  it('serves index.html for /', async () => {
    const dir = setupStaticDir()
    const app = createApp({ staticDir: dir })
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('HOME')
  })

  it('serves asset files', async () => {
    const dir = setupStaticDir()
    const app = createApp({ staticDir: dir })
    const res = await app.request('/assets/app.js')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('console.log')
  })

  it('falls back to index.html for unknown route (SPA)', async () => {
    const dir = setupStaticDir()
    const app = createApp({ staticDir: dir })
    const res = await app.request('/some/spa/route')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('HOME')
  })

  it('/api/health is not shadowed by static serving', async () => {
    const dir = setupStaticDir()
    const app = createApp({ staticDir: dir })
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns JSON 404 for unmatched /api/* paths (not SPA HTML)', async () => {
    const dir = setupStaticDir()
    const app = createApp({ staticDir: dir })
    const res = await app.request('/api/does-not-exist')
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('not_found')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})

import type { AnthropicMessageClient } from './llm/generateTree.js'

describe('POST /api/tree-from-name', () => {
  const validToolInput = {
    creatureLabel: 'crane',
    legs: [
      { label: 'wing-a', length: 1 },
      { label: 'wing-b', length: 1 },
      { label: 'head-tail', length: 1.5 },
    ],
  }

  function fakeClient(toolInput: unknown): AnthropicMessageClient {
    return { createMessage: async () => ({ toolInput }) }
  }

  it('returns 200 with a tree for a valid animal name', async () => {
    const app = createApp({ treeClient: fakeClient(validToolInput) })
    const res = await app.request('/api/tree-from-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'crane' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tree: { nodes: unknown[]; edges: unknown[] } }
    expect(body.tree.nodes).toHaveLength(4)
    expect(body.tree.edges).toHaveLength(3)
  })

  it('returns 400 when name is missing', async () => {
    const app = createApp({ treeClient: fakeClient(validToolInput) })
    const res = await app.request('/api/tree-from-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const app = createApp({ treeClient: fakeClient(validToolInput) })
    const res = await app.request('/api/tree-from-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 502 when the LLM client fails to produce a valid tree after retries', async () => {
    const app = createApp({ treeClient: fakeClient(null) })
    const res = await app.request('/api/tree-from-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'crane' }),
    })
    expect(res.status).toBe(502)
  })

  it('returns 503 when no tree client is configured (missing API key)', async () => {
    const app = createApp({}) // treeClient 없음
    const res = await app.request('/api/tree-from-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'crane' }),
    })
    expect(res.status).toBe(503)
  })

  it('returns 429 after exceeding the rate limit for the same client', async () => {
    const app = createApp({ treeClient: fakeClient(validToolInput) })
    for (let i = 0; i < 10; i++) {
      const res = await app.request('/api/tree-from-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'crane' }),
      })
      expect(res.status).toBe(200)
    }
    const res = await app.request('/api/tree-from-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'crane' }),
    })
    expect(res.status).toBe(429)
  })
})
