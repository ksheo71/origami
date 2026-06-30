import { Hono } from 'hono'
import { serve } from '@hono/node-server'

export function createApp(): Hono {
  const app = new Hono()

  app.get('/api/health', (c) => {
    return c.json({
      ok: true,
      version: process.env.GIT_SHA ?? 'dev',
    })
  })

  return app
}

// 모듈로 import 될 때는 서버를 띄우지 않음.
const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const port = Number(process.env.PORT ?? 4500)
  serve({ fetch: createApp().fetch, port }, (info) => {
    console.log(JSON.stringify({ msg: 'server.listening', port: info.port }))
  })
}
