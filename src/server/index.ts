import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface AppOptions {
  staticDir?: string
}

export function createApp(opts: AppOptions = {}): Hono {
  const app = new Hono()

  app.get('/api/health', (c) => {
    return c.json({
      ok: true,
      version: process.env.GIT_SHA ?? 'dev',
    })
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
  const port = Number(process.env.PORT ?? 3100)
  const staticDir = process.env.STATIC_DIR
  serve({ fetch: createApp({ staticDir }).fetch, port }, (info) => {
    console.log(JSON.stringify({ msg: 'server.listening', port: info.port, staticDir }))
  })
}
