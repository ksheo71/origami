import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateTreeFromName, TreeGenerationError } from './llm/generateTree.js'
import type { AnthropicMessageClient } from './llm/generateTree.js'
import { createAnthropicClient } from './llm/anthropicClient.js'
import { createRateLimiter } from './rateLimit.js'

export interface AppOptions {
  staticDir?: string
  treeClient?: AnthropicMessageClient
}

export function createApp(opts: AppOptions = {}): Hono {
  const app = new Hono()
  const treeFromNameLimiter = createRateLimiter(60 * 60 * 1000, 10) // IP당 시간에 10회

  app.get('/api/health', (c) => {
    return c.json({
      ok: true,
      version: process.env.GIT_SHA ?? 'dev',
    })
  })

  app.post('/api/tree-from-name', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400)
    }
    const name = (body as { name?: unknown }).name
    if (typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'name must be a non-empty string' }, 400)
    }

    const clientKey =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'
    if (!treeFromNameLimiter.tryConsume(clientKey)) {
      return c.json({ error: 'rate limit exceeded, try again later' }, 429)
    }

    if (!opts.treeClient) {
      return c.json({ error: 'tree generation is not configured (missing ANTHROPIC_API_KEY)' }, 503)
    }

    try {
      const tree = await generateTreeFromName(name.trim(), opts.treeClient)
      return c.json({ tree })
    } catch (err) {
      if (err instanceof TreeGenerationError) {
        return c.json({ error: err.message }, 502)
      }
      throw err
    }
  })

  if (opts.staticDir) {
    const staticDir = opts.staticDir
    app.use('/assets/*', serveStatic({ root: staticDir }))
    // Unmatched /api/* paths get a JSON 404 (not the SPA HTML).
    app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))
    // SPA fallback for everything else.
    app.get('*', (c) => {
      const html = readFileSync(join(staticDir, 'index.html'), 'utf-8')
      return c.html(html)
    })
  }

  return app
}

// 모듈로 import 될 때는 서버를 띄우지 않음.
const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const port = Number(process.env.PORT ?? 3150)
  const staticDir = process.env.STATIC_DIR
  const apiKey = process.env.ANTHROPIC_API_KEY
  const treeClient = apiKey ? createAnthropicClient(apiKey) : undefined
  serve({ fetch: createApp({ staticDir, treeClient }).fetch, port }, (info) => {
    console.log(JSON.stringify({ msg: 'server.listening', port: info.port, staticDir, llmConfigured: !!treeClient }))
  })
}
