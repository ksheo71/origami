# Phase 0 — 인프라 & 빈 스켈레톤 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `https://origami.myazit.kr/api/health` 가 200을 반환하고, 루트 경로에 "hello, origami" 화면이 뜨는 상태를 만든다. main 브랜치 push가 맥미니에서 자동 빌드·재기동되는 CD 파이프라인이 동작한다.

**Architecture:** 단일 Node.js 컨테이너(`origami-app`)가 Vite로 빌드된 React SPA를 정적 서빙하고 `/api/health` endpoint를 노출한다. kyle-mini의 기존 패턴(`/opt/stack`, OrbStack, Cloudflare Tunnel → Caddy → app)을 그대로 따라간다. 외부 노출은 Caddyfile 1줄 추가.

**Tech Stack:** Node.js 20 (alpine), TypeScript, Vite, React, Hono, vitest, Docker (OrbStack), Caddy, GitHub Actions self-hosted runner

## Global Constraints

- 모든 시크릿(특히 `ANTHROPIC_API_KEY`)은 git에 절대 커밋하지 않는다. `.env`는 운영 트리에만 존재하며 `.gitignore` 에 포함.
- 컨테이너는 호스트 포트를 외부에 열지 않는다. `127.0.0.1:3100:3100` 만 로컬 확인용으로 노출. 외부 노출은 `edge_shared` 네트워크 + Caddy.
- Caddyfile 호스트 블록은 반드시 `http://` 접두사로 시작 (Caddy가 `:443`으로 묶지 않도록).
- Caddyfile에 한글 주석·세미콜론 들어간 헤더 값 사용 금지 (`/opt/stack/CLAUDE.md` "함정" 절).
- `docker compose up -d --build --force-recreate` 사용 (macOS bind mount inode 이슈 우회).
- 컨테이너 이름은 `origami-app`, compose 프로젝트 이름은 `origami`, 노출 포트는 `3100`.
- TLS는 Cloudflare가 종단한다. 컨테이너는 평문 HTTP만.
- 코드 식별자(변수·함수·파일명)는 영어. 문서·커밋 메시지는 한국어 OK.

---

## Task 1: 프로젝트 초기화 + `/api/health` (TDD)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `src/server/index.ts`
- Test: `src/server/index.test.ts`

**Interfaces:**
- Produces: `createApp(): Hono` — Hono 앱 팩토리. `GET /api/health` → `{ ok: true, version: string }` (200). `version` 은 `process.env.GIT_SHA ?? "dev"`.

- [ ] **Step 1: `package.json` 작성**

```json
{
  "name": "origami",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:server": "tsx watch src/server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "@types/node": "^20.16.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `.gitignore` 작성**

```
node_modules/
dist/
.env
.env.*
!.env.example
*.log
.DS_Store
coverage/
```

- [ ] **Step 4: `vitest.config.ts` 작성**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: 의존성 설치**

Run: `npm install`
Expected: `package-lock.json` 생성, `node_modules/` 채워짐, 종료 코드 0.

- [ ] **Step 6: 실패하는 테스트 작성 — `src/server/index.test.ts`**

```ts
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
```

- [ ] **Step 7: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './index.js'` 또는 `createApp is not a function`.

- [ ] **Step 8: 최소 구현 — `src/server/index.ts`**

```ts
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
  const port = Number(process.env.PORT ?? 3100)
  serve({ fetch: createApp().fetch, port }, (info) => {
    console.log(JSON.stringify({ msg: 'server.listening', port: info.port }))
  })
}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `npm test`
Expected: 3 passed, 0 failed.

- [ ] **Step 10: 로컬 서버 수동 동작 확인**

Run: `npm run dev:server` (백그라운드 또는 별도 터미널)
Then: `curl -s http://localhost:3100/api/health`
Expected: `{"ok":true,"version":"dev"}`

서버 종료: Ctrl-C.

- [ ] **Step 11: 커밋**

```bash
git add package.json package-lock.json tsconfig.json .gitignore vitest.config.ts src/server/
git commit -m "Phase 0/T1: Hono 서버 스켈레톤 + /api/health"
```

---

## Task 2: Vite SPA + Hono 정적 서빙 통합

**Files:**
- Modify: `package.json` (Vite/React deps, `build`/`dev` 스크립트)
- Create: `vite.config.ts`
- Create: `src/client/index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Modify: `src/server/index.ts` (정적 파일 서빙 추가)
- Test: `src/server/index.test.ts` (정적 fallback 테스트 추가)

**Interfaces:**
- Consumes: Task 1의 `createApp()` 시그니처 유지.
- Produces: 빌드 산출물 `dist/client/` 디렉터리. `createApp({ staticDir?: string })` 로 시그니처 확장. `staticDir` 가 주어지면 그 디렉터리의 파일을 서빙하고, 미매칭 경로는 `index.html` 로 SPA fallback.

- [ ] **Step 1: 클라이언트/빌드 의존성 추가 — `package.json`**

```json
{
  "name": "origami",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:client": "vite",
    "dev:server": "tsx watch src/server/index.ts",
    "build:client": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "build": "npm run build:client && npm run build:server",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "@types/node": "^20.16.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: 의존성 설치**

Run: `npm install`
Expected: 종료 코드 0.

- [ ] **Step 3: 서버 빌드용 별도 tsconfig — `tsconfig.server.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist/server",
    "rootDir": "src/server",
    "noEmit": false
  },
  "include": ["src/server/**/*"]
}
```

- [ ] **Step 4: `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3100',
    },
  },
})
```

- [ ] **Step 5: 클라이언트 진입점 — `src/client/index.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Origami</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: React 마운트 — `src/client/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('root element missing')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: 빈 화면 — `src/client/App.tsx`**

```tsx
export function App() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>hello, origami</h1>
      <p>Phase 0 — infrastructure skeleton.</p>
    </main>
  )
}
```

- [ ] **Step 8: 클라이언트 빌드 동작 확인**

Run: `npm run build:client`
Expected: `dist/client/index.html`, `dist/client/assets/*.js`, `dist/client/assets/*.css` 생성.

- [ ] **Step 9: 정적 fallback 테스트 추가 — `src/server/index.test.ts` 끝에**

```ts
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
})
```

- [ ] **Step 10: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: 새 테스트 4개 모두 FAIL (`staticDir` 옵션이 아직 없으므로).

- [ ] **Step 11: `createApp` 확장 — `src/server/index.ts`**

```ts
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
    // SPA fallback: 모든 비-API GET 요청은 index.html
    app.get('*', (c) => {
      const html = readFileSync(join(staticDir, 'index.html'), 'utf-8')
      return c.html(html)
    })
  }

  return app
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const port = Number(process.env.PORT ?? 3100)
  const staticDir = process.env.STATIC_DIR
  serve({ fetch: createApp({ staticDir }).fetch, port }, (info) => {
    console.log(JSON.stringify({ msg: 'server.listening', port: info.port, staticDir }))
  })
}
```

- [ ] **Step 12: `serveStatic` 헬퍼 의존성 확인**

`@hono/node-server` 가 `serve-static` 서브경로를 export 하는지 확인:
Run: `node -e "console.log(Object.keys(require('@hono/node-server/serve-static')))"`
Expected: `[ 'serveStatic' ]` 또는 비슷한 export 목록.

만약 export가 없으면 `@hono/node-server` 의 README 또는 `package.json` 의 `exports` 필드를 확인하고 import 경로 조정. 대안: `serveStatic` 을 직접 미들웨어로 구현 (`fs.readFile` + `path.join`).

- [ ] **Step 13: 테스트 통과 확인**

Run: `npm test`
Expected: 모든 테스트 (health 3개 + static 4개) PASS.

- [ ] **Step 14: 전체 빌드 + 통합 수동 확인**

Run: `npm run build`
Expected: `dist/client/` + `dist/server/index.js` 생성.

Run: `STATIC_DIR=$(pwd)/dist/client node dist/server/index.js` (별도 터미널)
Then:
- `curl -s http://localhost:3100/api/health` → `{"ok":true,"version":"dev"}`
- `curl -s http://localhost:3100/` 응답에 `hello, origami` 포함
- `curl -s http://localhost:3100/non/existent/route` 응답에 `hello, origami` 포함 (SPA fallback)

서버 종료: Ctrl-C.

- [ ] **Step 15: 커밋**

```bash
git add package.json package-lock.json tsconfig.server.json vite.config.ts src/client/ src/server/
git commit -m "Phase 0/T2: Vite SPA + Hono 정적 서빙 통합"
```

---

## Task 3: Dockerfile + docker-compose.yml

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`
- Create: `.env.example`

**Interfaces:**
- Produces: 컨테이너 이미지를 만들어 `3100` 포트에 SPA + `/api/health` 를 서빙한다. compose 파일은 외부 `edge_shared` 네트워크에 합류하고 `127.0.0.1:3100:3100` 만 로컬 노출.

- [ ] **Step 1: `.dockerignore`**

```
node_modules
dist
.env
.env.*
.git
.github
*.log
coverage
docs
```

- [ ] **Step 2: `Dockerfile` (multi-stage)**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV STATIC_DIR=/app/dist/client
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
EXPOSE 3100
CMD ["node", "dist/server/index.js"]
```

- [ ] **Step 3: `docker-compose.yml`**

```yaml
name: origami

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        GIT_SHA: ${GIT_SHA:-dev}
    container_name: origami-app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3100
      STATIC_DIR: /app/dist/client
      GIT_SHA: ${GIT_SHA:-dev}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
    ports:
      - "127.0.0.1:3100:3100"
    networks:
      - edge_shared
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3100/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

networks:
  edge_shared:
    external: true
```

- [ ] **Step 4: `.env.example` (커밋됨, 실제 `.env`는 운영 트리에만)**

```
# Anthropic API key for /api/tree-from-name (Phase 2+).
# Phase 0에서는 비워둬도 컨테이너가 뜬다.
ANTHROPIC_API_KEY=

# 배포 시 GitHub Actions가 git rev-parse HEAD를 넣어준다.
GIT_SHA=dev
```

- [ ] **Step 5: 로컬 빌드 확인 (OrbStack 또는 Docker 가능 환경)**

`edge_shared` 네트워크가 로컬에 없을 수 있으므로 임시 생성:
Run: `docker network create edge_shared 2>/dev/null || true`

Run: `docker compose build`
Expected: 빌드 성공, 종료 코드 0.

- [ ] **Step 6: 로컬 실행 + 헬스체크**

Run: `docker compose up -d`
Then: `curl -s http://localhost:3100/api/health`
Expected: `{"ok":true,"version":"dev"}`

Run: `curl -s http://localhost:3100/` 응답에 `hello, origami` 포함 확인.

- [ ] **Step 7: 컨테이너 헬스 상태 확인**

Run: `docker ps --filter name=origami-app --format '{{.Names}}\t{{.Status}}'`
Expected: `origami-app  Up X seconds (healthy)` (또는 starting 후 healthy로 전환).

- [ ] **Step 8: 정리**

Run: `docker compose down`
Run: `docker network rm edge_shared 2>/dev/null || true` (임시 네트워크 정리. 맥미니에는 cloudflared가 이미 소유)

- [ ] **Step 9: 커밋**

```bash
git add Dockerfile docker-compose.yml .dockerignore .env.example
git commit -m "Phase 0/T3: Dockerfile + docker-compose (edge_shared, 포트 3100)"
```

---

## Task 4: deploy.sh + GitHub Actions workflow

**Files:**
- Create: `scripts/deploy.sh`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: `scripts/deploy.sh` 는 맥미니의 self-hosted 러너 작업 디렉터리(`/opt/stack/services/public/myazit.kr/origami/repo`)에서 실행되어 `git reset --hard origin/main → docker compose build/up --force-recreate → 헬스체크` 흐름을 수행한다. workflow는 `main` push에서 self-hosted 러너로 deploy.sh를 호출한다.

- [ ] **Step 1: `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
# /opt/stack/services/public/myazit.kr/origami/repo/scripts/deploy.sh
# self-hosted 러너에서 실행된다.
# CWD는 repo 루트(이 스크립트의 부모/부모).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[deploy] git fetch + reset"
git fetch --prune origin
git reset --hard origin/main

GIT_SHA="$(git rev-parse --short HEAD)"
export GIT_SHA
echo "[deploy] GIT_SHA=${GIT_SHA}"

echo "[deploy] compose up -d --build --force-recreate"
docker compose \
  --env-file ../.env \
  -f docker-compose.yml \
  up -d --build --force-recreate --remove-orphans

echo "[deploy] image prune"
docker image prune -f >/dev/null || true

echo "[deploy] health check (max 60s)"
DEADLINE=$(( $(date +%s) + 60 ))
while true; do
  if curl -fsS http://127.0.0.1:3100/api/health >/dev/null; then
    echo "[deploy] healthy"
    break
  fi
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "[deploy] HEALTHCHECK FAILED" >&2
    docker logs --tail 100 origami-app >&2 || true
    exit 1
  fi
  sleep 2
done

echo "[deploy] done"
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x scripts/deploy.sh`
Expected: 종료 코드 0.

- [ ] **Step 3: `.github/workflows/deploy.yml`**

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-origami
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: self-hosted
    timeout-minutes: 15
    steps:
      - name: invoke deploy.sh on host
        run: /opt/stack/services/public/myazit.kr/origami/repo/scripts/deploy.sh
```

> 참고: 이 workflow는 repo를 actions/checkout으로 받지 않는다. self-hosted 러너가 이미 `/opt/stack/.../repo` 의 운영 트리에 상주하고, `deploy.sh` 가 `git reset --hard origin/main` 으로 그 트리를 갱신한다 (`/opt/stack/CLAUDE.md` 패턴 그대로).

- [ ] **Step 4: `deploy.sh` 정적 검증 — shellcheck (선택)**

shellcheck가 설치돼 있으면:
Run: `shellcheck scripts/deploy.sh`
Expected: 종료 코드 0 (경고 없음).

없으면 스킵.

- [ ] **Step 5: 커밋**

```bash
git add scripts/deploy.sh .github/workflows/deploy.yml
git commit -m "Phase 0/T4: deploy.sh + GitHub Actions self-hosted workflow"
```

---

## Task 5: 운영 셋업 매뉴얼 + 첫 배포 게이트

**Files:**
- Create: `README.md`
- Create: `docs/ops/deploy.md`

이 task는 코드가 아니라 **수동 셋업 작업의 체크리스트**다. 각 step은 사람이 따라하는 절차이며, 마지막 step은 `https://origami.myazit.kr/api/health` 200을 받아야 끝난다.

**Interfaces:**
- Produces: 운영 트리, deploy key, self-hosted 러너, Caddyfile 라우트, GitHub repo가 모두 준비된 상태. main 브랜치 push가 자동 배포되는 상태.

- [ ] **Step 1: `README.md`**

`````markdown
# Origami CP Generator

동물 이름을 입력하면 LLM이 스틱 피겨를 만들고, TreeMaker 엔진이 종이 한 장으로 접을 수 있는 전개도(CP)를 생성하는 웹 앱. 결과를 Origami Simulator로 3D 접기까지 보여준다.

- 운영 URL: https://origami.myazit.kr
- 설계 문서: `docs/superpowers/specs/2026-06-30-origami-cp-generator-design.md`
- 운영 셋업: `docs/ops/deploy.md`

## 로컬 개발

```bash
npm install
npm run dev:server   # 백엔드 :3100
npm run dev:client   # 프론트 :5173 (api는 3100으로 프록시)
```

## 테스트

```bash
npm test
```

## 빌드 + 도커 실행

```bash
docker network create edge_shared 2>/dev/null || true
docker compose up -d --build
curl http://localhost:3100/api/health
```

## 배포

main 브랜치 push → 맥미니 self-hosted 러너가 `scripts/deploy.sh` 실행.
`````

- [ ] **Step 2: `docs/ops/deploy.md` — 운영 셋업 매뉴얼**

````markdown
# Origami — 운영 셋업 (Phase 0)

이 문서는 맥미니(`kyle-mini.local`)에서 origami 앱을 처음 띄울 때의 수동 단계를 정리한 것이다. `/opt/stack/CLAUDE.md` 의 일반 패턴을 origami에 적용한 구체화 버전.

## 사전 조건

- 맥미니에 OrbStack 동작 중
- `/opt/stack/services/network/{cloudflared, caddy}/` 가 떠 있음 (= `edge_shared` 네트워크 존재)
- 작업자 GitHub 계정에 `ksheo71/origami` 생성 권한
- 작업자 손에 맥미니 셸 (직접 또는 원격)

## 1. GitHub repo 생성

GitHub 웹에서 `ksheo71/origami` 생성 (private 또는 public). description: "Origami CP generator (Phase 0+)".

로컬 작업 트리에서 첫 push:

```bash
cd /Users/kyle/workspace/origami
git remote add origin git@github.com:ksheo71/origami.git
git push -u origin main
```

(첫 push 단계에서는 통상 GitHub 계정 SSH 키를 쓴다. deploy key는 맥미니 전용으로 아래 4단계에서 발급.)

## 2. 운영 트리 생성

맥미니에서:

```bash
sudo mkdir -p /opt/stack/services/public/myazit.kr/origami
sudo chown kyle:staff /opt/stack/services/public/myazit.kr/origami
cd /opt/stack/services/public/myazit.kr/origami
```

`.env` 작성 (이 파일은 git에 커밋되지 않는다):

```bash
cat > .env <<'EOF'
ANTHROPIC_API_KEY=
GIT_SHA=dev
EOF
chmod 600 .env
```

> Phase 0 에서는 `ANTHROPIC_API_KEY` 가 비어 있어도 컨테이너가 뜨고 헬스체크 통과한다. Phase 2 시작 시 실제 키를 채운다.

## 3. 포트 3100 충돌 검사

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep ':3100' || echo "포트 3100 OK"
ss -tln | grep -E ':3100\b' || echo "포트 3100 OK"
```

충돌이 있으면 `docker-compose.yml` 과 `scripts/deploy.sh`, `vite.config.ts` 프록시 대상의 포트를 동일하게 다른 번호로 교체 후 push (예: 3100).

## 4. deploy key 발급 + 등록

맥미니에서:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/origami_deploy -N '' -C 'origami deploy key'
cat ~/.ssh/origami_deploy.pub
```

출력된 public key를 GitHub repo의 Settings → Deploy keys → "Add deploy key" 에 등록 (write access 체크 ❌ — 우리는 read only면 충분).

`~/.ssh/config` 에 별칭 추가:

```
Host github-origami
    HostName github.com
    User git
    IdentityFile ~/.ssh/origami_deploy
    IdentitiesOnly yes
```

## 5. 운영 트리에 repo clone

```bash
cd /opt/stack/services/public/myazit.kr/origami
git clone git@github-origami:ksheo71/origami.git repo
```

확인:

```bash
ls repo/scripts/deploy.sh
```

## 6. self-hosted 러너 등록

GitHub repo Settings → Actions → Runners → "New self-hosted runner" → macOS arm64 선택 → 토큰을 받는다.

맥미니에서:

```bash
mkdir -p ~/actions-runner-origami
cd ~/actions-runner-origami
curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-osx-arm64-2.319.1.tar.gz
# (버전은 GitHub 안내 페이지의 최신값으로 교체)
tar xzf actions-runner.tar.gz
./config.sh --url https://github.com/ksheo71/origami --token <RUNNER_TOKEN> --name kyle-mini-origami --labels self-hosted,origami --unattended
```

launchd 등록 (다른 앱의 `~/actions-runner-<앱>/` 패턴 그대로 복사):

```bash
./svc.sh install
./svc.sh start
./svc.sh status
```

> 기존 다른 앱 러너의 plist 를 참고해서 동일한 패턴으로 둔다.

## 7. Caddyfile 라우트 추가

`edge-caddy` repo(예: `~/workspace/edge-caddy`)의 `Caddyfile` 끝에 다음을 추가:

```caddy
http://origami.myazit.kr {
    import common
    reverse_proxy origami-app:3100
}
```

주의 (`/opt/stack/CLAUDE.md` 의 함정 절):
- 반드시 `http://` 접두사
- multi-line — `import common` 과 `reverse_proxy` 는 별도 줄
- 한글 주석·세미콜론 들어간 헤더 값 금지

commit + push:

```bash
git add Caddyfile
git commit -m "feat: route origami.myazit.kr"
git push origin main
```

→ caddy 의 self-hosted 러너가 자동 force-recreate.

caddy 가 새 설정을 받았는지 확인:

```bash
docker exec caddy wget -qO- http://localhost:2019/config/ | python3 -m json.tool | grep -A2 origami
```

Cloudflare 대시보드는 손대지 않는다 (`*.myazit.kr` 와일드카드가 흡수).

## 8. 첫 배포 트리거

로컬에서 main 브랜치에 트리비얼한 변경(예: README의 줄 끝 공백) 또는 빈 커밋을 push, 또는 GitHub Actions에서 `workflow_dispatch` 로 수동 실행:

```bash
gh workflow run deploy.yml --repo ksheo71/origami
```

진행 상황 보기:

```bash
gh run watch --repo ksheo71/origami
```

또는 맥미니에서:

```bash
docker logs -f origami-app
```

## 9. 최종 검증 게이트

브라우저 또는 curl:

```bash
curl -sS https://origami.myazit.kr/api/health
```

기대: `{"ok":true,"version":"<짧은 git sha>"}`

루트도 확인:

```bash
curl -sS https://origami.myazit.kr/ | grep 'hello, origami'
```

이 두 응답이 정상이면 **Phase 0 완료**.

## 트러블슈팅

- **502 from Caddy**: `docker ps --filter name=origami-app` 으로 컨테이너 상태 확인. Up이 아니면 `docker logs origami-app`.
- **헬스체크 실패**: `docker exec origami-app wget -qO- http://localhost:3100/api/health`. 컨테이너 내부에서 실패하면 빌드 산출물(`dist/server/index.js`)이 들어갔는지 확인.
- **Caddy가 새 호스트를 모름**: caddy 컨테이너 재기동(`gh workflow run deploy.yml --repo ksheo71/edge-caddy`). bind mount inode 이슈로 reload가 안 먹은 경우.
- **러너가 깨어 있지 않음**: `cd ~/actions-runner-origami && ./svc.sh status`.
````

- [ ] **Step 3: 운영 매뉴얼 한 번 정독**

작성한 매뉴얼을 처음 보는 사람의 눈으로 한 번 읽는다. 다음을 확인:
- 모든 명령어가 복사·붙여넣기로 동작하는가
- `<RUNNER_TOKEN>` 같은 placeholder가 사람이 채울 곳임이 분명한가
- 단계 순서대로 의존성이 맞는가 (예: 6번에서 러너가 이미 4번의 deploy key를 통해 fetch 가능)

문제가 있으면 인라인으로 수정.

- [ ] **Step 4: 커밋**

```bash
git add README.md docs/ops/deploy.md
git commit -m "Phase 0/T5: README + 운영 셋업 매뉴얼"
```

- [ ] **Step 5: GitHub repo로 push**

`docs/ops/deploy.md` 1단계에 따라 GitHub repo 생성 후:

```bash
git remote add origin git@github.com:ksheo71/origami.git
git push -u origin main
```

- [ ] **Step 6: 운영 매뉴얼 따라 셋업 수행**

`docs/ops/deploy.md` 의 2~7단계를 차례로 실행한다.

- [ ] **Step 7: 첫 배포 트리거 + 검증**

`docs/ops/deploy.md` 8~9단계 수행.

**최종 기대**:
- `curl -sS https://origami.myazit.kr/api/health` → `{"ok":true,"version":"<sha>"}`
- 브라우저로 `https://origami.myazit.kr` 접속 시 "hello, origami" 표시

위 두 조건이 만족되면 Phase 0 완료. Phase 1 plan 작성으로 넘어간다.

---

## 완료 후 체크리스트 (Phase 0 → Phase 1 게이트)

- [ ] 모든 task의 모든 step이 체크됨
- [ ] `npm test` 통과
- [ ] `docker compose build` 통과 (로컬)
- [ ] `https://origami.myazit.kr/api/health` 200 (운영)
- [ ] `https://origami.myazit.kr/` 에 "hello, origami" 표시
- [ ] main push 후 자동 배포 1회 성공 (러너·헬스체크 모두 통과)
- [ ] `docs/superpowers/specs/2026-06-30-origami-cp-generator-design.md` §8 TBD 중 "포트 3100 충돌" 항목 해소 (확정된 포트 번호 기록)
