# 종이접기 갤러리 (방향 전환) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 동물 이름 자동 생성 앱을, 저작권 깨끗한 전통 종이접기 모델 ~10종을 2D 크리스패턴 + 3D 접기로 보여주는 갤러리로 전환한다.

**Architecture:** 전통 모델은 SVG 크리스패턴(선 색=산/골/경계). 2D는 SVG를 인라인 표시하고, 3D는 같은 SVG 텍스트를 Origami Simulator에 `{op:'importSVG', svg}` postMessage로 넘겨 시뮬레이터가 자체 파싱·면검출·접기를 하게 한다(변환기 불필요). 신규 UI(카탈로그·갤러리·상세·경량 라우터)를 먼저 세운 뒤 구 생성기·엔진·LLM·FoldDocument 파이프라인을 제거한다.

**Tech Stack:** React + TypeScript + Vite(root `src/client`), Hono 서버, Vitest, Origami Simulator(iframe 임베드, postMessage), Docker·GitHub Actions 배포.

## Global Constraints

- **저작권 게이트**: 카탈로그에는 전통/퍼블릭 도메인 모델만. Lang(`langCardinal`/`langKnlDragon`/`langOrchid`)·Randlett(`randlettflappingbird`)·Gardner(`MoosersTrain…`) 표기 항목은 **수록 금지**.
- **ESM import 규칙**: 상대 import는 `.js` 확장자 사용(소스는 `.ts`/`.tsx`). 예: `import { CATALOG } from './catalog.js'`.
- **TS strict**: 배열 인덱싱 결과는 `!` 또는 명시적 `undefined` 가드(기존 코드 컨벤션).
- **빌드 게이트**: 코드 변경 Task 끝에 `npm test` 그린 + `npm run build:server` + `npm run build:client` 둘 다 성공(Phase 2 배포 실패 방지).
- **테스트 카운트 주의**: 브리프의 "N passed" 절대치를 믿지 말 것. 먼저 `npm test`로 baseline 확인 후 추가분만 계산.
- **정적 에셋 경로**: Vite root가 `src/client`이므로 정적 파일은 `src/client/public/`에 두면 `/`에서 서빙된다(예: `src/client/public/catalog/traditionalCrane.svg` → `/catalog/traditionalCrane.svg`).
- **React 컴포넌트 테스트 정책**: 순수 로직(파서·필터·메시지 빌더·카탈로그 무결성)만 단위 테스트한다. React 컴포넌트는 `build:client` 타입체크 + Task 10 수동 E2E로 검증(기존 Phase 1/2와 동일, RTL/jsdom 미도입 — YAGNI).
- **simulator 메시지 프로토콜**: ready 신호 = `{from:'OrigamiSimulator', status:'ready'}`. 임포트 = `{op:'importSVG', svg:'<svg문자열>', filename?}` (소스 `js/importer.js:217`에서 확인).

---

## File Structure

**신규**
- `src/client/public/catalog/*.svg` — 안전한 전통 SVG 크리스패턴(복사).
- `src/client/public/catalog/ATTRIBUTION.md` — 출처·라이선스 표기.
- `src/client/catalog/catalog.ts` — `OrigamiModel` 타입 + `CATALOG` 배열 + `getModelById`·`filterModels`.
- `src/client/catalog/catalog.test.ts`
- `src/client/router.ts` — `parseRoute`·`useRoute`·`navigate`(경량 history 기반).
- `src/client/router.test.ts`
- `src/client/model/loadModelSvg.ts` — SVG 텍스트 fetch.
- `src/client/components/CreasePatternSvg.tsx` — SVG 텍스트 인라인 2D 렌더.
- `src/client/components/SvgFoldSimulator.tsx` — iframe + ready 핸드셰이크 + importSVG.
- `src/client/components/importSvgMessage.ts` — `buildImportSvgMessage`·`isSimulatorReadyMessage`.
- `src/client/components/importSvgMessage.test.ts`
- `src/client/pages/GalleryPage.tsx` — 카드 그리드 + 검색/필터.
- `src/client/pages/ModelPage.tsx` — 2D + 3D 상세.

**수정**
- `src/client/App.tsx` — 라우터로 갤러리/상세 전환(전면 재작성).
- `src/server/index.ts` — `/api/tree-from-name`·treeClient 제거, 정적 + `/api/health`만.

**삭제 (Task 9)**
- `src/treemaker/**`, `src/server/llm/**`, `src/server/rateLimit.ts`(+test)
- `src/client/components/{AnimalNameForm,CPCanvas,FoldSimulator,foldToSvgPaths,foldSimulatorMessage}.*`(+tests)
- `src/client/{urlTreeState,treeFromNameRequest 위치의 것}`, `src/client/components/treeFromNameRequest.*`
- `src/client/workers/**`, `src/client/cpData/**`
- `src/shared/{fold,tree}.ts`(+tests)

---

## Task 1: 콘텐츠 — 안전한 전통 SVG 복사 + 출처 표기

**Files:**
- Create: `src/client/public/catalog/` 아래 10개 `.svg`
- Create: `src/client/public/catalog/ATTRIBUTION.md`

**Interfaces:**
- Consumes: 없음
- Produces: `/catalog/<name>.svg` 정적 에셋 10종 (Task 2 카탈로그가 참조)

**저작권 확인**: 아래 10개는 모두 전통/퍼블릭 도메인(OrigamiUSA "전통 모델 자유 사용"). Lang/Randlett/Gardner/테셀레이션은 복사하지 않는다.

- [ ] **Step 1: 소스 저장소 얕은 클론**

Run:
```bash
git clone --depth 1 https://github.com/amandaghassaei/OrigamiSimulator.git /tmp/origami-sim-src
```
Expected: 클론 성공. (MIT 라이선스 저장소.)

- [ ] **Step 2: 안전한 전통 SVG 10종 복사**

Run:
```bash
mkdir -p src/client/public/catalog
cp /tmp/origami-sim-src/assets/Origami/traditionalCrane.svg  src/client/public/catalog/
cp /tmp/origami-sim-src/assets/Origami/flappingBird.svg      src/client/public/catalog/
cp /tmp/origami-sim-src/assets/Origami/airplane.svg          src/client/public/catalog/
cp /tmp/origami-sim-src/assets/Bases/birdBase.svg            src/client/public/catalog/
cp /tmp/origami-sim-src/assets/Bases/frogBase.svg            src/client/public/catalog/
cp /tmp/origami-sim-src/assets/Bases/waterbombBase.svg       src/client/public/catalog/
cp /tmp/origami-sim-src/assets/Bases/boatBase.svg            src/client/public/catalog/
cp /tmp/origami-sim-src/assets/Bases/squareBase.svg          src/client/public/catalog/
cp /tmp/origami-sim-src/assets/Bases/pinwheelBase.svg        src/client/public/catalog/
cp /tmp/origami-sim-src/assets/SimpleFolds/mapfold.svg       src/client/public/catalog/
```

- [ ] **Step 3: 복사 확인 (Lang/Randlett 없음)**

Run: `ls src/client/public/catalog/*.svg | xargs -n1 basename`
Expected: 정확히 10개 — `airplane.svg birdBase.svg boatBase.svg flappingBird.svg frogBase.svg mapfold.svg pinwheelBase.svg squareBase.svg traditionalCrane.svg waterbombBase.svg`. `lang*`/`randlett*`/`Moosers*`가 **없어야** 함.

- [ ] **Step 4: 출처 표기 작성**

Create `src/client/public/catalog/ATTRIBUTION.md`:
```markdown
# Crease pattern sources

All crease patterns here are **traditional origami models** (public domain).
The SVG files were copied from the Origami Simulator project
(https://github.com/amandaghassaei/OrigamiSimulator, MIT licensed), selecting
ONLY the traditional / unattributed models.

Explicitly excluded (copyrighted by their designers): Robert Lang (Cardinal,
KNL Dragon, Orchid), Samuel Randlett (flapping bird), Martin Gardner (Moosers
train), and all tessellation / curved-crease pieces.

| file | model | note |
|------|-------|------|
| traditionalCrane.svg | Crane (tsuru) | traditional |
| flappingBird.svg | Flapping bird | traditional |
| airplane.svg | Paper airplane | traditional |
| birdBase.svg | Bird base | traditional base |
| frogBase.svg | Frog base | traditional base |
| waterbombBase.svg | Waterbomb base | traditional base |
| boatBase.svg | Boat base | traditional base |
| squareBase.svg | Preliminary/square base | traditional base |
| pinwheelBase.svg | Pinwheel base | traditional base |
| mapfold.svg | Map fold | traditional |
```

- [ ] **Step 5: Commit**

```bash
git add src/client/public/catalog
git commit -m "content: add 10 traditional (public-domain) crease-pattern SVGs + attribution"
```

---

## Task 2: 카탈로그 모듈

**Files:**
- Create: `src/client/catalog/catalog.ts`
- Test: `src/client/catalog/catalog.test.ts`

**Interfaces:**
- Consumes: Task 1의 `/catalog/*.svg` 파일들
- Produces:
  - `interface OrigamiModel { id, nameKo, nameEn, category, difficulty, source, license, svgPath, description? }`
  - `const CATALOG: OrigamiModel[]`
  - `function getModelById(id: string): OrigamiModel | undefined`
  - `function filterModels(models: OrigamiModel[], query: string, category: OrigamiModel['category'] | null): OrigamiModel[]`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/client/catalog/catalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOG, getModelById, filterModels } from './catalog.js'

describe('CATALOG', () => {
  it('has at least 10 models with unique ids', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(10)
    const ids = CATALOG.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every svgPath points at an existing public asset', () => {
    for (const m of CATALOG) {
      expect(m.svgPath.startsWith('/catalog/')).toBe(true)
      const abs = join(process.cwd(), 'src/client/public', m.svgPath)
      expect(() => readFileSync(abs, 'utf8')).not.toThrow()
    }
  })

  it('contains no copyrighted (lang/randlett/gardner) source files', () => {
    for (const m of CATALOG) {
      expect(/lang|randlett|moosers/i.test(m.svgPath)).toBe(false)
    }
  })

  it('includes the crane', () => {
    const crane = getModelById('crane')
    expect(crane?.nameKo).toBe('학')
  })
})

describe('getModelById', () => {
  it('returns undefined for unknown id', () => {
    expect(getModelById('does-not-exist')).toBeUndefined()
  })
})

describe('filterModels', () => {
  it('filters by category', () => {
    const bases = filterModels(CATALOG, '', 'base')
    expect(bases.length).toBeGreaterThan(0)
    expect(bases.every((m) => m.category === 'base')).toBe(true)
  })

  it('matches Korean and English names case-insensitively', () => {
    expect(filterModels(CATALOG, '학', null).some((m) => m.id === 'crane')).toBe(true)
    expect(filterModels(CATALOG, 'CRANE', null).some((m) => m.id === 'crane')).toBe(true)
  })

  it('empty query + null category returns everything', () => {
    expect(filterModels(CATALOG, '', null)).toHaveLength(CATALOG.length)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/client/catalog/catalog.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `catalog.ts` 구현**

Create `src/client/catalog/catalog.ts`:
```ts
export interface OrigamiModel {
  id: string
  nameKo: string
  nameEn: string
  category: 'animal' | 'base' | 'simple'
  difficulty: 'easy' | 'medium' | 'hard'
  source: string
  license: string
  svgPath: string
  description?: string
}

export const CATALOG: OrigamiModel[] = [
  { id: 'crane', nameKo: '학', nameEn: 'Crane', category: 'animal', difficulty: 'medium', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/traditionalCrane.svg', description: '가장 유명한 전통 종이접기.' },
  { id: 'flapping-bird', nameKo: '펄럭이는 새', nameEn: 'Flapping Bird', category: 'animal', difficulty: 'medium', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/flappingBird.svg', description: '꼬리를 당기면 날개가 퍼덕인다.' },
  { id: 'airplane', nameKo: '종이비행기', nameEn: 'Paper Airplane', category: 'simple', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/airplane.svg' },
  { id: 'bird-base', nameKo: '새 기본형', nameEn: 'Bird Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/birdBase.svg', description: '학·새 계열의 출발점.' },
  { id: 'frog-base', nameKo: '개구리 기본형', nameEn: 'Frog Base', category: 'base', difficulty: 'medium', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/frogBase.svg' },
  { id: 'waterbomb-base', nameKo: '물풍선 기본형', nameEn: 'Waterbomb Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/waterbombBase.svg' },
  { id: 'boat-base', nameKo: '배 기본형', nameEn: 'Boat Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/boatBase.svg' },
  { id: 'square-base', nameKo: '정사각 기본형', nameEn: 'Preliminary Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/squareBase.svg' },
  { id: 'pinwheel-base', nameKo: '바람개비 기본형', nameEn: 'Pinwheel Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/pinwheelBase.svg' },
  { id: 'map-fold', nameKo: '지도 접기', nameEn: 'Map Fold', category: 'simple', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/mapfold.svg' },
]

export function getModelById(id: string): OrigamiModel | undefined {
  return CATALOG.find((model) => model.id === id)
}

export function filterModels(
  models: OrigamiModel[],
  query: string,
  category: OrigamiModel['category'] | null,
): OrigamiModel[] {
  const q = query.trim().toLowerCase()
  return models.filter((model) => {
    const matchesCategory = category === null || model.category === category
    const matchesQuery =
      q === '' ||
      model.nameKo.toLowerCase().includes(q) ||
      model.nameEn.toLowerCase().includes(q) ||
      model.id.includes(q)
    return matchesCategory && matchesQuery
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/client/catalog/catalog.test.ts`
Expected: PASS (8개 테스트).

- [ ] **Step 5: Commit**

```bash
git add src/client/catalog
git commit -m "feat(catalog): traditional model catalog + filter/lookup"
```

---

## Task 3: importSVG 메시지 + 3D 시뮬레이터 컴포넌트

**Files:**
- Create: `src/client/components/importSvgMessage.ts`
- Create: `src/client/components/importSvgMessage.test.ts`
- Create: `src/client/components/SvgFoldSimulator.tsx`

**Interfaces:**
- Produces:
  - `interface ImportSvgMessage { op: 'importSVG'; svg: string; filename: string }`
  - `function buildImportSvgMessage(svg: string, filename: string): ImportSvgMessage`
  - `function isSimulatorReadyMessage(data: unknown): boolean`
  - `function SvgFoldSimulator({ svg }: { svg: string }): JSX.Element`

Note: 기존 `foldSimulatorMessage.ts`(`importFold`)는 건드리지 않는다(Task 9에서 삭제). 여기서는 SVG 전용 신규 파일을 만든다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/client/components/importSvgMessage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildImportSvgMessage, isSimulatorReadyMessage } from './importSvgMessage.js'

describe('buildImportSvgMessage', () => {
  it('builds the importSVG op with svg + filename', () => {
    const msg = buildImportSvgMessage('<svg></svg>', 'crane')
    expect(msg).toEqual({ op: 'importSVG', svg: '<svg></svg>', filename: 'crane' })
  })
})

describe('isSimulatorReadyMessage', () => {
  it('accepts the ready handshake', () => {
    expect(isSimulatorReadyMessage({ from: 'OrigamiSimulator', status: 'ready' })).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isSimulatorReadyMessage({ from: 'x' })).toBe(false)
    expect(isSimulatorReadyMessage(null)).toBe(false)
    expect(isSimulatorReadyMessage('ready')).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/client/components/importSvgMessage.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `importSvgMessage.ts` 구현**

Create `src/client/components/importSvgMessage.ts`:
```ts
export interface ImportSvgMessage {
  op: 'importSVG'
  svg: string
  filename: string
}

export function buildImportSvgMessage(svg: string, filename: string): ImportSvgMessage {
  return { op: 'importSVG', svg, filename }
}

export function isSimulatorReadyMessage(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const candidate = data as { from?: unknown; status?: unknown }
  return candidate.from === 'OrigamiSimulator' && candidate.status === 'ready'
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/client/components/importSvgMessage.test.ts`
Expected: PASS (3개 테스트).

- [ ] **Step 5: `SvgFoldSimulator.tsx` 구현 (컴포넌트, 빌드로 검증)**

Create `src/client/components/SvgFoldSimulator.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { buildImportSvgMessage, isSimulatorReadyMessage } from './importSvgMessage.js'

const SIMULATOR_URL = 'https://origamisimulator.org/'

export interface SvgFoldSimulatorProps {
  svg: string
  filename: string
}

export function SvgFoldSimulator({ svg, filename }: SvgFoldSimulatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (isSimulatorReadyMessage(event.data)) {
        iframeRef.current?.contentWindow?.postMessage(
          buildImportSvgMessage(svg, filename),
          SIMULATOR_URL,
        )
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [svg, filename])

  return (
    <iframe
      ref={iframeRef}
      src={SIMULATOR_URL}
      title="Origami Simulator"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  )
}
```

- [ ] **Step 6: 빌드 확인 + Commit**

Run: `npm run build:client`
Expected: 성공.
```bash
git add src/client/components/importSvgMessage.ts src/client/components/importSvgMessage.test.ts src/client/components/SvgFoldSimulator.tsx
git commit -m "feat(3d): importSVG message + SvgFoldSimulator component"
```

---

## Task 4: SVG 로더 + 2D 인라인 렌더러

**Files:**
- Create: `src/client/model/loadModelSvg.ts`
- Test: `src/client/model/loadModelSvg.test.ts`
- Create: `src/client/components/CreasePatternSvg.tsx`

**Interfaces:**
- Produces:
  - `async function loadModelSvg(svgPath: string): Promise<string>` (fetch, 실패 시 throw)
  - `function CreasePatternSvg({ svg }: { svg: string }): JSX.Element`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/client/model/loadModelSvg.test.ts`:
```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/client/model/loadModelSvg.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `loadModelSvg.ts` 구현**

Create `src/client/model/loadModelSvg.ts`:
```ts
export async function loadModelSvg(svgPath: string): Promise<string> {
  const response = await fetch(svgPath)
  if (!response.ok) {
    throw new Error(`loadModelSvg: failed to load ${svgPath} (${response.status})`)
  }
  return response.text()
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/client/model/loadModelSvg.test.ts`
Expected: PASS (2개 테스트).

- [ ] **Step 5: `CreasePatternSvg.tsx` 구현 (컴포넌트)**

Create `src/client/components/CreasePatternSvg.tsx`:
```tsx
export interface CreasePatternSvgProps {
  svg: string
}

// 전통 CP SVG를 그대로 인라인 표시한다(선 색 = 산 빨강 / 골 파랑 / 경계 검정).
// SVG는 신뢰된 로컬 정적 에셋(우리 public/catalog)이므로 dangerouslySetInnerHTML 사용이 안전하다.
export function CreasePatternSvg({ svg }: CreasePatternSvgProps) {
  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
```

- [ ] **Step 6: 빌드 확인 + Commit**

Run: `npm run build:client`
Expected: 성공.
```bash
git add src/client/model/loadModelSvg.ts src/client/model/loadModelSvg.test.ts src/client/components/CreasePatternSvg.tsx
git commit -m "feat(2d): svg loader + inline crease-pattern renderer"
```

---

## Task 5: 경량 라우터

**Files:**
- Create: `src/client/router.ts`
- Test: `src/client/router.test.ts`

**Interfaces:**
- Produces:
  - `type Route = { name: 'gallery' } | { name: 'model'; id: string } | { name: 'notFound' }`
  - `function parseRoute(pathname: string): Route`
  - `function useRoute(): Route` (React hook, `popstate` 구독)
  - `function navigate(path: string): void`

- [ ] **Step 1: 실패하는 테스트 작성 (순수 parseRoute만)**

Create `src/client/router.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseRoute } from './router.js'

describe('parseRoute', () => {
  it('maps / to gallery', () => {
    expect(parseRoute('/')).toEqual({ name: 'gallery' })
    expect(parseRoute('')).toEqual({ name: 'gallery' })
  })
  it('maps /model/:id to model with decoded id', () => {
    expect(parseRoute('/model/crane')).toEqual({ name: 'model', id: 'crane' })
    expect(parseRoute('/model/bird-base/')).toEqual({ name: 'model', id: 'bird-base' })
  })
  it('maps unknown paths to notFound', () => {
    expect(parseRoute('/whatever')).toEqual({ name: 'notFound' })
    expect(parseRoute('/model/')).toEqual({ name: 'notFound' })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/client/router.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `router.ts` 구현**

Create `src/client/router.ts`:
```ts
import { useSyncExternalStore } from 'react'

export type Route = { name: 'gallery' } | { name: 'model'; id: string } | { name: 'notFound' }

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'gallery' }
  const match = pathname.match(/^\/model\/([^/]+)\/?$/)
  if (match && match[1]) return { name: 'model', id: decodeURIComponent(match[1]) }
  return { name: 'notFound' }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => '/',
  )
  return parseRoute(pathname)
}

export function navigate(path: string): void {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/client/router.test.ts`
Expected: PASS (3개 테스트).

- [ ] **Step 5: Commit**

```bash
git add src/client/router.ts src/client/router.test.ts
git commit -m "feat(router): lightweight history-based routing"
```

---

## Task 6: 갤러리 페이지

**Files:**
- Create: `src/client/pages/GalleryPage.tsx`

**Interfaces:**
- Consumes: `CATALOG`, `filterModels`, `OrigamiModel` from `../catalog/catalog.js`; `navigate` from `../router.js`
- Produces: `function GalleryPage(): JSX.Element`

- [ ] **Step 1: `GalleryPage.tsx` 구현 (컴포넌트, 빌드+E2E 검증)**

Create `src/client/pages/GalleryPage.tsx`:
```tsx
import { useState } from 'react'
import { CATALOG, filterModels } from '../catalog/catalog.js'
import type { OrigamiModel } from '../catalog/catalog.js'
import { navigate } from '../router.js'

const CATEGORIES: { value: OrigamiModel['category'] | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'animal', label: '동물·사물' },
  { value: 'base', label: '기본형' },
  { value: 'simple', label: '쉬움' },
]

export function GalleryPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<OrigamiModel['category'] | null>(null)
  const models = filterModels(CATALOG, query, category)

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>종이접기 도감</h1>
      <p style={{ color: '#666' }}>전통 종이접기 모델을 고르면 크리스패턴과 3D로 접히는 과정을 볼 수 있어요.</p>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 검색 (예: 학)"
          style={{ flex: 1, minWidth: 160, padding: 8 }}
        />
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            onClick={() => setCategory(c.value)}
            style={{ padding: '8px 12px', fontWeight: category === c.value ? 700 : 400 }}
          >
            {c.label}
          </button>
        ))}
      </div>
      {models.length === 0 ? (
        <p>검색 결과가 없습니다.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/model/${m.id}`)}
              style={{ textAlign: 'left', border: '1px solid #ddd', borderRadius: 12, padding: 16, cursor: 'pointer', background: '#fff' }}
            >
              <img src={m.svgPath} alt={m.nameKo} style={{ width: '100%', height: 120, objectFit: 'contain' }} />
              <div style={{ fontWeight: 700, marginTop: 8 }}>{m.nameKo}</div>
              <div style={{ color: '#888', fontSize: 13 }}>{m.nameEn} · {m.difficulty}</div>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 빌드 확인 + Commit**

Run: `npm run build:client`
Expected: 성공.
```bash
git add src/client/pages/GalleryPage.tsx
git commit -m "feat(gallery): model grid with search + category filter"
```

---

## Task 7: 모델 상세 페이지 (2D + 3D)

**Files:**
- Create: `src/client/pages/ModelPage.tsx`

**Interfaces:**
- Consumes: `getModelById` from `../catalog/catalog.js`; `loadModelSvg` from `../model/loadModelSvg.js`; `CreasePatternSvg`, `SvgFoldSimulator` from `../components/*.js`; `navigate` from `../router.js`
- Produces: `function ModelPage({ id }: { id: string }): JSX.Element`

- [ ] **Step 1: `ModelPage.tsx` 구현**

Create `src/client/pages/ModelPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { getModelById } from '../catalog/catalog.js'
import { loadModelSvg } from '../model/loadModelSvg.js'
import { CreasePatternSvg } from '../components/CreasePatternSvg.js'
import { SvgFoldSimulator } from '../components/SvgFoldSimulator.js'
import { navigate } from '../router.js'

export interface ModelPageProps {
  id: string
}

export function ModelPage({ id }: ModelPageProps) {
  const model = getModelById(id)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!model) return
    let cancelled = false
    setSvg(null)
    setError(null)
    loadModelSvg(model.svgPath)
      .then((text) => { if (!cancelled) setSvg(text) })
      .catch(() => { if (!cancelled) setError('크리스패턴을 불러오지 못했습니다.') })
    return () => { cancelled = true }
  }, [model])

  if (!model) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
        <p>모델을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>갤러리로</button>
      </main>
    )
  }

  return (
    <main style={{ fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <button onClick={() => navigate('/')}>← 갤러리</button>
        <span style={{ marginLeft: 16, fontWeight: 700 }}>{model.nameKo}</span>
        <span style={{ marginLeft: 8, color: '#888' }}>{model.nameEn} · {model.source} · {model.difficulty}</span>
      </header>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, borderRight: '1px solid #eee', minWidth: 0 }}>
          {error ? <p style={{ padding: 24, color: '#c33' }}>{error}</p>
            : svg ? <CreasePatternSvg svg={svg} />
            : <p style={{ padding: 24 }}>불러오는 중…</p>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {svg && <SvgFoldSimulator svg={svg} filename={model.id} />}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 빌드 확인 + Commit**

Run: `npm run build:client`
Expected: 성공.
```bash
git add src/client/pages/ModelPage.tsx
git commit -m "feat(model): detail page with 2D crease pattern + 3D importSVG fold"
```

---

## Task 8: App.tsx 라우터 통합

**Files:**
- Modify: `src/client/App.tsx` (전면 재작성)

**Interfaces:**
- Consumes: `useRoute` from `./router.js`; `GalleryPage`, `ModelPage` from `./pages/*.js`
- Produces: `function App(): JSX.Element`

- [ ] **Step 1: `App.tsx` 재작성**

Overwrite `src/client/App.tsx`:
```tsx
import { useRoute } from './router.js'
import { GalleryPage } from './pages/GalleryPage.js'
import { ModelPage } from './pages/ModelPage.js'
import { navigate } from './router.js'

export function App() {
  const route = useRoute()
  if (route.name === 'gallery') return <GalleryPage />
  if (route.name === 'model') return <ModelPage id={route.id} />
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <p>페이지를 찾을 수 없습니다.</p>
      <button onClick={() => navigate('/')}>갤러리로</button>
    </main>
  )
}
```

- [ ] **Step 2: 빌드 + 전체 테스트 확인**

Run: `npm run build:client`
Expected: 성공.
Run: `npm test`
Expected: 그린(신규 테스트 통과; 구 코드 테스트도 아직 존재하므로 통과 — Task 9에서 제거).

- [ ] **Step 3: Commit**

```bash
git add src/client/App.tsx
git commit -m "feat(app): route between gallery and model detail"
```

---

## Task 9: 구 파이프라인 제거 + 서버 단순화

**Files:**
- Delete: `src/treemaker/`, `src/server/llm/`, `src/server/rateLimit.ts`(+test), `src/client/components/{AnimalNameForm,CPCanvas,FoldSimulator,foldToSvgPaths,foldSimulatorMessage,treeFromNameRequest}.*`(+tests), `src/client/urlTreeState.*`, `src/client/workers/`, `src/client/cpData/`, `src/shared/fold.*`, `src/shared/tree.*`
- Modify: `src/server/index.ts`

**Interfaces:**
- Consumes: 없음(삭제 Task)
- Produces: 서버는 정적 서빙 + `/api/health`만

- [ ] **Step 1: 구 파일 삭제**

Run:
```bash
git rm -r src/treemaker src/server/llm src/client/workers src/client/cpData
git rm src/server/rateLimit.ts src/server/rateLimit.test.ts
git rm src/client/urlTreeState.ts src/client/urlTreeState.test.ts
git rm src/client/components/AnimalNameForm.tsx \
       src/client/components/CPCanvas.tsx \
       src/client/components/FoldSimulator.tsx \
       src/client/components/foldToSvgPaths.ts src/client/components/foldToSvgPaths.test.ts \
       src/client/components/foldSimulatorMessage.ts src/client/components/foldSimulatorMessage.test.ts \
       src/client/components/treeFromNameRequest.ts src/client/components/treeFromNameRequest.test.ts
git rm src/shared/fold.ts src/shared/fold.test.ts src/shared/tree.ts src/shared/tree.test.ts
```
(파일명이 다르면 `git ls-files src/client/components` 로 실제 이름을 확인 후 맞춘다. `treeFromNameRequest` 관련 파일 경로는 `git ls-files | grep treeFromName` 로 확정.)

- [ ] **Step 2: 서버에서 LLM 라우트 제거**

Overwrite `src/server/index.ts`:
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
    return c.json({ ok: true, version: process.env.GIT_SHA ?? 'dev' })
  })

  if (opts.staticDir) {
    const staticDir = opts.staticDir
    app.use('/assets/*', serveStatic({ root: staticDir }))
    app.use('/catalog/*', serveStatic({ root: staticDir }))
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

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const port = Number(process.env.PORT ?? 3150)
  const staticDir = process.env.STATIC_DIR
  serve({ fetch: createApp({ staticDir }).fetch, port }, (info) => {
    console.log(JSON.stringify({ msg: 'server.listening', port: info.port, staticDir }))
  })
}
```

- [ ] **Step 3: 서버 테스트 갱신**

`src/server/index.test.ts`를 확인해 삭제된 `/api/tree-from-name`·treeClient 관련 케이스를 제거하고, 남길 것: `/api/health` 200, 정적/ SPA fallback, `/api/*` 미매치 404, `/catalog/*` 정적 서빙(가능하면). 실제 파일을 읽고 삭제된 심볼 참조를 모두 제거한다.

Run: `git ls-files src/server` 로 남은 테스트 파일 확인 후 편집.

- [ ] **Step 4: 잔존 참조 정리**

Run: `grep -rn "treemaker\|tree-from-name\|FoldDocument\|foldSimulatorMessage\|CPCanvas\|AnimalNameForm\|urlTreeState\|generateTree\|treeTool\|ANTHROPIC" src/ | grep -v node_modules`
Expected: 결과 없음. 남아 있으면 각각 제거/수정.

- [ ] **Step 5: 의존성 정리 (선택)**

`package.json`에서 이제 안 쓰는 `@anthropic-ai/sdk`를 제거해도 된다(빌드에 영향 없으면). 확실치 않으면 남겨둔다(YAGNI로 이번엔 건드리지 않아도 무방).

- [ ] **Step 6: 전체 테스트 + 빌드 게이트**

Run: `npm test`
Expected: 전부 그린(구 테스트는 사라지고 신규만 남음).
Run: `npm run build:server && npm run build:client`
Expected: 둘 다 성공.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove generator/engine/LLM/FoldDocument pipeline, gallery-only server"
```

---

## Task 10: 수동 E2E — 배포 + 갤러리·3D 접기 확인

**Files:** 없음

**Interfaces:** 없음

**목적**: 최대 리스크(전통 SVG가 `importSVG`로 실제 3D 접히는지)를 실제 브라우저에서 확인.

- [ ] **Step 1: 배포**

main 병합 후 `git push` → GitHub Actions 자동 배포 → `https://origami.myazit.kr/api/health`가 새 커밋 sha를 반환할 때까지 대기.

- [ ] **Step 2: 갤러리 확인**

`https://origami.myazit.kr/` 접속 → 카드 그리드에 전통 모델 ~10종의 크리스패턴 썸네일이 보이는지 확인. 검색("학")·카테고리 필터 동작 확인.

- [ ] **Step 3: 상세 + 3D 접힘 확인 (핵심)**

"학" 카드 클릭 → `/model/crane` → 좌측 2D 크리스패턴 표시 + 우측 3D 시뮬레이터가 **`importSVG`로 학을 받아 접히는지** 확인(Fold 슬라이더 조작 시 학 형태로 접힘). 최소 2~3종(학·새 기본형·배 기본형)을 확인.
- 만약 특정 모델이 안 접히면(시뮬레이터가 파싱 실패) → 해당 모델을 카탈로그에서 잠시 제외하거나 `vertTol` 옵션을 `buildImportSvgMessage`에 추가하는 후속 Task를 연다.

- [ ] **Step 4: 결과 보고**

각 확인 모델의 스크린샷/관찰을 사용자에게 보고. `importSVG`가 라이브 시뮬레이터에서 동작함을 확정(이 계획 전체의 핵심 가정).

---

## Self-Review (작성자 체크 완료)

**1. Spec coverage:**
- §3 UX(갤러리+상세, 검색/필터, "접는 법"=CP+3D) → Task 6·7 ✅
- §4.1 재사용(시뮬레이터 iframe+핸드셰이크, 서버) → Task 3·9 ✅
- §4.2 신규(카탈로그·loadModelSvg·CreasePatternSvg·SvgFoldSimulator·페이지·라우터·importSVG) → Task 2~8 ✅
- §4.3 폐기(엔진·LLM·폼·FoldDocument 파이프라인) → Task 9 ✅
- §5 소싱(안전 전통 SVG 10종, 라이선스 가드) → Task 1 ✅
- §6 데이터 흐름(SVG fetch → 2D 인라인 + importSVG) → Task 4·7 ✅
- §8 테스트(카탈로그 무결성·필터·parseRoute·importSVG 메시지) → Task 2·5·3 ✅
- §9 마일스톤·§10 리스크(importSVG 라이브 확인) → Task 10 ✅

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드·명령·기대 출력. "TBD/적절히" 없음. Task 3/9의 "실제 파일 확인 후" 지시는 삭제/편집 대상 파일명이 환경에 따라 다를 수 있어 grep으로 확정하라는 구체 지시(플레이스홀더 아님).

**3. Type consistency:** `OrigamiModel`(catalog) → gallery/model/page 소비 일치. `Route`/`parseRoute`/`useRoute`/`navigate`(router) 일관. `buildImportSvgMessage`/`isSimulatorReadyMessage`(importSvgMessage) → SvgFoldSimulator 소비 일치. `loadModelSvg`·`CreasePatternSvg`·`SvgFoldSimulator` → ModelPage 소비 일치. `svgPath`(catalog) ↔ Task 1 파일명 일치(traditionalCrane.svg 등).
