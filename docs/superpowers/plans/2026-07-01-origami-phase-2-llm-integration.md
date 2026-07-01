# Phase 2 — LLM 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 동물 이름(예: "학")을 입력하면 LLM이 자동으로 트리를 생성해 Phase 1의 `treeToFold → 2D/3D` 파이프라인으로 흘려보낸다. 결과 URL을 복사해서 다른 브라우저에서 열면 LLM을 다시 거치지 않고 동일한 결과가 재현된다.

**Architecture:** 백엔드는 `POST /api/tree-from-name` 하나만 추가한다 — Anthropic API를 호출해 구조화된 트리를 받고, **Phase 1의 `treeToFold` 파이프라인을 서버에서도 재사용해 검증**(별도 검증 로직을 새로 만들지 않음)한 뒤 `Tree` JSON만 클라이언트에 반환한다. 실제 기하 계산(FOLD 생성)은 기존 설계 그대로 클라이언트 Web Worker에서 수행한다. 프론트엔드는 입력 폼 + URL 상태 직렬화만 추가한다.

**Tech Stack:** `@anthropic-ai/sdk`, 기존 Hono 서버, 기존 React 클라이언트, 기존 `src/shared/`·`src/treemaker/` 순수 모듈 재사용

## 설계 근거 — 중요한 범위 제약

Phase 1의 TreeMaker 엔진(`buildStarTripod`)은 **정확히 분기 노드 1개 + 잎 3개**인 트리만 처리한다(원 설계 스펙의 "잎 수 ≤ 6" 일반형은 Phase 3 이후 과제). 따라서 이 Phase의 LLM은 **항상 정확히 다리(잎) 3개짜리 별 모양 트리만** 생성하도록 도구 스키마 단계에서 강제한다(`minItems: 3, maxItems: 3`). 실제 동물의 다리 개수·해부학적 구조와는 무관하게 "가장 단순화된 트라이포드"로 추상화하는 것이 이번 Phase의 의도적 범위다.

**서버 측 검증은 새로 만들지 않는다.** LLM이 반환한 구조를 우리 `Tree` 타입으로 변환한 뒤, Phase 1에서 이미 완성한 `treeToFold(tree)`를 서버에서 그대로 호출해 예외가 나는지만 확인한다 — throw 하면 그 트리는 유효하지 않은 것이므로 재시도, 성공하면(FOLD 계산 결과는 버리고) `tree`만 클라이언트로 반환한다. 이렇게 하면 `validateTree`(사이클·연결성)와 `buildStarTripod`의 모양 검증(정확히 3 leaves + 1 branch)을 이중 구현하지 않는다.

## Global Constraints

- TypeScript strict 모드, `noUncheckedIndexedAccess` 기존 패턴 유지.
- 이 Phase에서 추가되는 서버 모듈(`src/server/llm/`)은 `src/shared/`·`src/treemaker/`의 기존 순수 함수를 **직접 import해서 재사용**한다 — 트리 검증 로직을 새로 작성하지 않는다.
- LLM이 생성하는 트리는 항상 정확히 3개의 잎을 가진 단일 분기 트리(별 모양)여야 한다 — 도구 스키마(`minItems: 3, maxItems: 3`)로 강제.
- Anthropic API 호출은 **테스트 가능하도록 클라이언트를 주입받는 형태**로 작성한다(실제 네트워크 호출 없이 mock으로 단위 테스트).
- `ANTHROPIC_API_KEY`가 비어 있으면 서버 부팅 시 fatal(설계 스펙 §5 그대로) — 단, Phase 2 개발/테스트 중에는 `.env.example`에 안내만 추가하고 실제 운영 `.env`는 사용자가 채운다(Phase 0 운영 매뉴얼에 이미 자리가 있음).
- LLM 호출 실패·검증 실패 시 1회 재시도, 그래도 실패하면 사용자에게 명확한 에러 메시지(설계 스펙 §5 에러 처리 표 그대로).
- 코드 식별자는 영어, 문서·커밋 메시지는 한국어 OK.
- 기존 테스트(56개)는 전부 유지되어야 한다(additive).

---

## Task 1: 트리 도구 스키마 + 변환 (`src/server/llm/treeTool.ts`)

**Files:**
- Create: `src/server/llm/treeTool.ts`
- Test: `src/server/llm/treeTool.test.ts`

**Interfaces:**
- Consumes: `Tree`(`src/shared/tree.ts`).
- Produces:
  - `interface TripodToolInput { creatureLabel: string; legs: [TripodLeg, TripodLeg, TripodLeg] }` — `TripodLeg = { label: string; length: number }`
  - `const TREE_TOOL_NAME = 'emit_animal_tripod'`
  - `const TREE_TOOL_SCHEMA: object` — Anthropic tool definition (`name`, `description`, `input_schema`), `legs`는 `minItems: 3, maxItems: 3`.
  - `function buildSystemPrompt(): string`
  - `function tripodInputToTree(input: TripodToolInput): Tree`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/server/llm/treeTool.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { TREE_TOOL_SCHEMA, TREE_TOOL_NAME, buildSystemPrompt, tripodInputToTree } from './treeTool.js'
import { validateTree } from '../../shared/tree.js'
import { buildStarTripod } from '../../treemaker/starTripod.js'

describe('TREE_TOOL_SCHEMA', () => {
  it('has the expected tool name', () => {
    expect(TREE_TOOL_SCHEMA.name).toBe(TREE_TOOL_NAME)
  })

  it('requires exactly 3 legs', () => {
    const legsSchema = (TREE_TOOL_SCHEMA.input_schema as any).properties.legs
    expect(legsSchema.minItems).toBe(3)
    expect(legsSchema.maxItems).toBe(3)
  })
})

describe('buildSystemPrompt', () => {
  it('returns a non-empty string mentioning exactly 3 legs', () => {
    const prompt = buildSystemPrompt()
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).toMatch(/3/)
  })
})

describe('tripodInputToTree', () => {
  const sampleInput = {
    creatureLabel: 'crane',
    legs: [
      { label: 'wing-a', length: 1 },
      { label: 'wing-b', length: 1 },
      { label: 'head-tail', length: 1 },
    ] as [
      { label: string; length: number },
      { label: string; length: number },
      { label: string; length: number },
    ],
  }

  it('produces a tree with 4 nodes and 3 edges', () => {
    const tree = tripodInputToTree(sampleInput)
    expect(tree.nodes).toHaveLength(4)
    expect(tree.edges).toHaveLength(3)
  })

  it('produces a tree that passes validateTree', () => {
    const tree = tripodInputToTree(sampleInput)
    expect(() => validateTree(tree)).not.toThrow()
  })

  it('produces a tree usable by buildStarTripod (matches Phase 1 engine shape)', () => {
    const tree = tripodInputToTree(sampleInput)
    expect(() => buildStarTripod(tree)).not.toThrow()
  })

  it('preserves leg lengths on the resulting edges', () => {
    const tree = tripodInputToTree(sampleInput)
    const lengths = tree.edges.map((e) => e.length).sort()
    expect(lengths).toEqual([1, 1, 1])
  })

  it('rejects non-positive leg lengths', () => {
    const badInput = {
      ...sampleInput,
      legs: [
        { label: 'a', length: 0 },
        { label: 'b', length: 1 },
        { label: 'c', length: 1 },
      ] as [
        { label: string; length: number },
        { label: string; length: number },
        { label: string; length: number },
      ],
    }
    expect(() => tripodInputToTree(badInput)).toThrow(/positive/)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- treeTool`
Expected: FAIL — `Cannot find module './treeTool.js'`.

- [ ] **Step 3: 구현 — `src/server/llm/treeTool.ts`**

```ts
import type { Tree } from '../../shared/tree.js'

export interface TripodLeg {
  label: string
  length: number
}

export interface TripodToolInput {
  creatureLabel: string
  legs: [TripodLeg, TripodLeg, TripodLeg]
}

export const TREE_TOOL_NAME = 'emit_animal_tripod'

export const TREE_TOOL_SCHEMA = {
  name: TREE_TOOL_NAME,
  description:
    '동물 이름을 종이접기용 "트라이포드"(분기점 1개 + 다리 3개짜리 별 모양 스틱 피겨)로 변환한다. ' +
    '항상 정확히 3개의 다리만 만든다 — 실제 동물의 다리 개수와 무관하게, 가장 단순화된 형태로 추상화한다.',
  input_schema: {
    type: 'object',
    properties: {
      creatureLabel: {
        type: 'string',
        description: '입력받은 동물 이름 그대로 (예: "학", "도마뱀").',
      },
      legs: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        description: '정확히 3개. 각 다리는 상대적 길이(양수)를 가진다.',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: '이 다리가 무엇을 상징하는지 (예: "wing-left", "tail").',
            },
            length: {
              type: 'number',
              exclusiveMinimum: 0,
              description: '다른 다리 대비 상대적 길이. 1.0을 기준으로 삼는다.',
            },
          },
          required: ['label', 'length'],
        },
      },
    },
    required: ['creatureLabel', 'legs'],
  },
} as const

export function buildSystemPrompt(): string {
  return [
    '당신은 동물 이름을 받아 종이접기 설계용 스틱 피겨로 변환하는 어시스턴트입니다.',
    '',
    `반드시 ${TREE_TOOL_NAME} 도구를 호출해서 답하세요. 다른 형식의 답변은 허용되지 않습니다.`,
    '',
    '규칙:',
    '- 다리는 항상 정확히 3개입니다. 실제 동물의 다리·날개·머리·꼬리 개수와 무관하게,',
    '  그 동물을 대표하는 가장 중요한 3개의 신체 부위(또는 방향)로 단순화하세요.',
    '  예: 학이라면 "양 날개"와 "머리+꼬리" 축 하나로 묶어 3개를 만들 수 있습니다.',
    '- 길이는 1.0을 기준으로 한 상대값입니다. 대칭적인 동물이면 3개 다리 길이를 비슷하게,',
    '  비대칭이 두드러지는 동물(예: 긴 꼬리)이면 그 다리만 길게 설정하세요.',
    '- creatureLabel에는 입력받은 이름을 그대로 넣으세요.',
  ].join('\n')
}

export function tripodInputToTree(input: TripodToolInput): Tree {
  for (const leg of input.legs) {
    if (leg.length <= 0) {
      throw new Error(`tripodInputToTree: leg length must be positive, got ${leg.length} for "${leg.label}"`)
    }
  }

  return {
    nodes: [
      { id: 'branch', label: input.creatureLabel },
      { id: 'leg-0', label: input.legs[0].label },
      { id: 'leg-1', label: input.legs[1].label },
      { id: 'leg-2', label: input.legs[2].label },
    ],
    edges: [
      { from: 'branch', to: 'leg-0', length: input.legs[0].length },
      { from: 'branch', to: 'leg-1', length: input.legs[1].length },
      { from: 'branch', to: 'leg-2', length: input.legs[2].length },
    ],
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- treeTool`
Expected: 9 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 65 passed (56 + 9).

- [ ] **Step 6: 커밋**

```bash
git add src/server/llm/treeTool.ts src/server/llm/treeTool.test.ts
git commit -m "Phase 2/T1: LLM 도구 스키마 + Tree 변환 (3-leg 강제)"
```

---

## Task 2: LLM 트리 생성 서비스 (`src/server/llm/generateTree.ts`)

Anthropic 클라이언트를 **주입받는 형태**로 설계해서 실제 네트워크 호출 없이 단위 테스트한다. 검증은 Phase 1의 `treeToFold`를 그대로 재사용 — throw하면 그 트리는 버리고 1회 재시도.

**Files:**
- Create: `src/server/llm/generateTree.ts`
- Test: `src/server/llm/generateTree.test.ts`

**Interfaces:**
- Consumes: `Tree`(Task 1의 `tripodInputToTree`, `TREE_TOOL_SCHEMA`, `TREE_TOOL_NAME`, `buildSystemPrompt`), `treeToFold`(`src/treemaker/treemaker.ts`).
- Produces:
  - `interface AnthropicMessageClient { createMessage(params: { system: string; tools: unknown[]; toolChoice: unknown; userMessage: string }): Promise<{ toolInput: unknown } | { toolInput: null }> }` — 우리가 정의하는 최소 인터페이스(실제 SDK를 얇게 감싼다. Task 3에서 실제 SDK 어댑터 작성).
  - `class TreeGenerationError extends Error {}`
  - `function generateTreeFromName(name: string, client: AnthropicMessageClient): Promise<Tree>` — LLM 호출 → `tripodInputToTree` → `treeToFold`로 검증(실패 시 1회 전체 재시도: LLM 재호출부터) → 검증 통과한 `Tree` 반환. 두 번째 시도도 실패하면 `TreeGenerationError` throw.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/server/llm/generateTree.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { generateTreeFromName, TreeGenerationError } from './generateTree.js'
import type { AnthropicMessageClient } from './generateTree.js'

const validToolInput = {
  creatureLabel: 'crane',
  legs: [
    { label: 'wing-a', length: 1 },
    { label: 'wing-b', length: 1 },
    { label: 'head-tail', length: 1.5 },
  ],
}

function makeClient(toolInputs: (unknown | null)[]): AnthropicMessageClient {
  let call = 0
  return {
    createMessage: vi.fn(async () => {
      const input = toolInputs[call]
      call++
      return input === null ? { toolInput: null } : { toolInput: input }
    }),
  }
}

describe('generateTreeFromName', () => {
  it('returns a valid Tree on first successful attempt', async () => {
    const client = makeClient([validToolInput])
    const tree = await generateTreeFromName('crane', client)
    expect(tree.nodes).toHaveLength(4)
    expect(client.createMessage).toHaveBeenCalledTimes(1)
  })

  it('retries once when the first tool call returns null (no tool use)', async () => {
    const client = makeClient([null, validToolInput])
    const tree = await generateTreeFromName('crane', client)
    expect(tree.nodes).toHaveLength(4)
    expect(client.createMessage).toHaveBeenCalledTimes(2)
  })

  it('retries once when the first tool input fails geometric validation (e.g. wrong leg count)', async () => {
    const invalidInput = { creatureLabel: 'crane', legs: [{ label: 'a', length: 1 }] }
    const client = makeClient([invalidInput, validToolInput])
    const tree = await generateTreeFromName('crane', client)
    expect(tree.nodes).toHaveLength(4)
    expect(client.createMessage).toHaveBeenCalledTimes(2)
  })

  it('throws TreeGenerationError when both attempts fail', async () => {
    const client = makeClient([null, null])
    await expect(generateTreeFromName('crane', client)).rejects.toThrow(TreeGenerationError)
    expect(client.createMessage).toHaveBeenCalledTimes(2)
  })

  it('throws TreeGenerationError when both attempts produce geometrically invalid trees', async () => {
    const badInput = { creatureLabel: 'crane', legs: [{ label: 'a', length: -1 }] }
    const client = makeClient([badInput, badInput])
    await expect(generateTreeFromName('crane', client)).rejects.toThrow(TreeGenerationError)
  })

  it('passes the animal name into the user message sent to the client', async () => {
    const client = makeClient([validToolInput])
    await generateTreeFromName('도마뱀', client)
    const call = (client.createMessage as any).mock.calls[0][0]
    expect(call.userMessage).toContain('도마뱀')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- generateTree`
Expected: FAIL — `Cannot find module './generateTree.js'`.

- [ ] **Step 3: 구현 — `src/server/llm/generateTree.ts`**

```ts
import type { Tree } from '../../shared/tree.js'
import { treeToFold } from '../../treemaker/treemaker.js'
import { TREE_TOOL_NAME, TREE_TOOL_SCHEMA, buildSystemPrompt, tripodInputToTree } from './treeTool.js'
import type { TripodToolInput } from './treeTool.js'

export interface AnthropicMessageClient {
  createMessage(params: {
    system: string
    tools: unknown[]
    toolChoice: unknown
    userMessage: string
  }): Promise<{ toolInput: unknown }>
}

export class TreeGenerationError extends Error {}

function isTripodToolInput(value: unknown): value is TripodToolInput {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { creatureLabel?: unknown; legs?: unknown }
  if (typeof candidate.creatureLabel !== 'string') return false
  if (!Array.isArray(candidate.legs) || candidate.legs.length !== 3) return false
  return candidate.legs.every(
    (leg): leg is { label: string; length: number } =>
      typeof leg === 'object' &&
      leg !== null &&
      typeof (leg as { label?: unknown }).label === 'string' &&
      typeof (leg as { length?: unknown }).length === 'number',
  )
}

async function attemptOnce(name: string, client: AnthropicMessageClient): Promise<Tree | null> {
  const response = await client.createMessage({
    system: buildSystemPrompt(),
    tools: [TREE_TOOL_SCHEMA],
    toolChoice: { type: 'tool', name: TREE_TOOL_NAME },
    userMessage: `동물: ${name}`,
  })

  if (!isTripodToolInput(response.toolInput)) {
    return null
  }

  try {
    const tree = tripodInputToTree(response.toolInput)
    treeToFold(tree) // Phase 1 파이프라인 재사용 — 던지면 무효한 트리
    return tree
  } catch {
    return null
  }
}

export async function generateTreeFromName(name: string, client: AnthropicMessageClient): Promise<Tree> {
  const first = await attemptOnce(name, client)
  if (first) return first

  const second = await attemptOnce(name, client)
  if (second) return second

  throw new TreeGenerationError(`generateTreeFromName: failed to produce a valid tripod tree for "${name}" after 2 attempts`)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- generateTree`
Expected: 6 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 71 passed (65 + 6).

- [ ] **Step 6: 커밋**

```bash
git add src/server/llm/generateTree.ts src/server/llm/generateTree.test.ts
git commit -m "Phase 2/T2: LLM 트리 생성 서비스 (주입형 클라이언트, treeToFold로 검증+재시도)"
```

---

## Task 3: Anthropic SDK 어댑터 + Hono 엔드포인트

**Files:**
- Modify: `package.json` (의존성 `@anthropic-ai/sdk` 추가)
- Create: `src/server/llm/anthropicClient.ts`
- Modify: `src/server/index.ts` (`POST /api/tree-from-name` 라우트 추가)
- Test: `src/server/index.test.ts` (새 라우트 테스트 추가 — 가짜 `AnthropicMessageClient` 주입)

**Interfaces:**
- Consumes: `AnthropicMessageClient`, `generateTreeFromName`, `TreeGenerationError`(Task 2).
- Produces:
  - `function createAnthropicClient(apiKey: string): AnthropicMessageClient` — 실제 `@anthropic-ai/sdk`를 감싸는 어댑터.
  - `createApp` 시그니처 확장: `interface AppOptions { staticDir?: string; treeClient?: AnthropicMessageClient }` — 테스트에서 가짜 클라이언트 주입, 운영에서는 `createAnthropicClient(env.ANTHROPIC_API_KEY)` 사용.

- [ ] **Step 1: 의존성 추가 — `package.json`**

`dependencies`에 추가:

```json
    "@anthropic-ai/sdk": "^0.32.0",
```

Run: `npm install`
Expected: 종료 코드 0.

- [ ] **Step 2: 실패하는 테스트 작성 — `src/server/index.test.ts`에 추가 (파일 끝)**

```ts
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
})
```

같은 파일 상단 import에 `createApp`이 이미 import되어 있는지 확인(Phase 0에서 이미 `import { createApp } from './index.js'` 형태로 존재).

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm test -- index.test`
Expected: FAIL — `treeClient` 옵션이 아직 없어 새 테스트 5개 실패.

- [ ] **Step 4: Anthropic SDK 어댑터 구현 — `src/server/llm/anthropicClient.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk'
import type { AnthropicMessageClient } from './generateTree.js'

const MODEL = 'claude-sonnet-5'

export function createAnthropicClient(apiKey: string): AnthropicMessageClient {
  const anthropic = new Anthropic({ apiKey })

  return {
    async createMessage({ system, tools, toolChoice, userMessage }) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: tools as Anthropic.Tool[],
        tool_choice: toolChoice as Anthropic.MessageCreateParams['tool_choice'],
        messages: [{ role: 'user', content: userMessage }],
      })

      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )

      return { toolInput: toolUseBlock ? toolUseBlock.input : null }
    },
  }
}
```

- [ ] **Step 5: `src/server/index.ts` 확장**

`createApp`의 옵션과 라우트를 추가한다. 기존 파일 구조를 유지하면서 아래처럼 수정:

```ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateTreeFromName, TreeGenerationError } from './llm/generateTree.js'
import type { AnthropicMessageClient } from './llm/generateTree.js'
import { createAnthropicClient } from './llm/anthropicClient.js'

export interface AppOptions {
  staticDir?: string
  treeClient?: AnthropicMessageClient
}

export function createApp(opts: AppOptions = {}): Hono {
  const app = new Hono()

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
    app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))
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
  const apiKey = process.env.ANTHROPIC_API_KEY
  const treeClient = apiKey ? createAnthropicClient(apiKey) : undefined
  serve({ fetch: createApp({ staticDir, treeClient }).fetch, port }, (info) => {
    console.log(JSON.stringify({ msg: 'server.listening', port: info.port, staticDir, llmConfigured: !!treeClient }))
  })
}
```

**주의**: `/api/tree-from-name` 라우트는 `if (opts.staticDir)` 블록 **앞에** 있어야 한다 — 그 블록 안의 `app.all('/api/*', ...)` catch-all이 이 라우트를 가리면 안 되므로, Hono의 라우트 등록 순서(먼저 등록된 것이 우선)를 그대로 활용한다. 위 코드는 이미 올바른 순서다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- index.test`
Expected: 13 passed (기존 8 + 새 5), 0 failed.

- [ ] **Step 7: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 76 passed (71 + 5, index.test.ts의 순증가분).

- [ ] **Step 8: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 에러 없음.

- [ ] **Step 9: `.env.example` 갱신**

```
# Anthropic API key for /api/tree-from-name.
# 비어 있으면 서버는 뜨지만 /api/tree-from-name은 503을 반환한다.
ANTHROPIC_API_KEY=

GIT_SHA=dev
```

- [ ] **Step 10: 커밋**

```bash
git add package.json package-lock.json src/server/llm/anthropicClient.ts src/server/index.ts src/server/index.test.ts .env.example
git commit -m "Phase 2/T3: Anthropic SDK 어댑터 + POST /api/tree-from-name"
```

---

## Task 4: URL 트리 상태 직렬화 (`src/client/urlTreeState.ts`)

**Files:**
- Create: `src/client/urlTreeState.ts`
- Test: `src/client/urlTreeState.test.ts`

**Interfaces:**
- Consumes: `Tree`, `validateTree`(`src/shared/tree.ts`).
- Produces:
  - `function encodeTreeToUrlParam(tree: Tree): string` — `JSON.stringify` → UTF-8 안전 base64url.
  - `function decodeTreeFromUrlParam(param: string): Tree | null` — 디코드+파싱+`validateTree` 실패 시 `null`(throw 안 함 — 호출부가 "URL이 이상하면 기본 화면"으로 처리하기 쉽게).

- [ ] **Step 1: 실패하는 테스트 작성 — `src/client/urlTreeState.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { encodeTreeToUrlParam, decodeTreeFromUrlParam } from './urlTreeState.js'
import type { Tree } from '../shared/tree.js'

const sampleTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1.5 },
  ],
}

describe('encodeTreeToUrlParam / decodeTreeFromUrlParam', () => {
  it('round-trips a valid tree', () => {
    const encoded = encodeTreeToUrlParam(sampleTree)
    const decoded = decodeTreeFromUrlParam(encoded)
    expect(decoded).toEqual(sampleTree)
  })

  it('produces a URL-safe string (no +, /, or = characters)', () => {
    const encoded = encodeTreeToUrlParam(sampleTree)
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('handles Korean labels correctly (UTF-8 safe)', () => {
    const treeWithKorean: Tree = {
      ...sampleTree,
      nodes: [{ id: 'branch', label: '학' }, ...sampleTree.nodes.slice(1)],
    }
    const encoded = encodeTreeToUrlParam(treeWithKorean)
    const decoded = decodeTreeFromUrlParam(encoded)
    expect(decoded?.nodes[0]?.label).toBe('학')
  })

  it('returns null for garbage input', () => {
    expect(decodeTreeFromUrlParam('not-valid-base64url-json!!!')).toBeNull()
  })

  it('returns null for well-formed base64url that decodes to invalid JSON', () => {
    const garbage = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeTreeFromUrlParam(garbage)).toBeNull()
  })

  it('returns null for valid JSON that fails validateTree (e.g. disconnected)', () => {
    const disconnectedTree = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [],
    }
    const json = JSON.stringify(disconnectedTree)
    const encoded = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeTreeFromUrlParam(encoded)).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- urlTreeState`
Expected: FAIL — `Cannot find module './urlTreeState.js'`.

- [ ] **Step 3: 구현 — `src/client/urlTreeState.ts`**

```ts
import type { Tree } from '../shared/tree.js'
import { validateTree } from '../shared/tree.js'

export function encodeTreeToUrlParam(tree: Tree): string {
  const json = JSON.stringify(tree)
  const base64 = btoa(unescape(encodeURIComponent(json)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeTreeFromUrlParam(param: string): Tree | null {
  try {
    const base64 = param.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(escape(atob(padded)))
    const parsed = JSON.parse(json) as Tree
    validateTree(parsed)
    return parsed
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- urlTreeState`
Expected: 6 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 82 passed (76 + 6).

- [ ] **Step 6: 커밋**

```bash
git add src/client/urlTreeState.ts src/client/urlTreeState.test.ts
git commit -m "Phase 2/T4: URL 트리 상태 직렬화 (base64url, UTF-8 안전)"
```

---

## Task 5: 동물 이름 입력 폼 (`src/client/components/AnimalNameForm.tsx`)

로직(요청 본문 구성, 응답 파싱)은 순수 함수로 분리하고 React 컴포넌트는 얇게 유지한다(Phase 1의 CPCanvas/FoldSimulator와 동일한 패턴).

**Files:**
- Create: `src/client/components/treeFromNameRequest.ts`
- Test: `src/client/components/treeFromNameRequest.test.ts`
- Create: `src/client/components/AnimalNameForm.tsx`

**Interfaces:**
- Consumes: `Tree`(`src/shared/tree.ts`).
- Produces:
  - `function buildTreeFromNameRequestBody(name: string): string` — `JSON.stringify({ name })`.
  - `function parseTreeFromNameResponse(status: number, body: unknown): { tree: Tree } | { error: string }` — HTTP status + JSON body를 성공/실패로 정규화.
  - `function AnimalNameForm(props: { onTreeReady: (tree: Tree) => void; disabled?: boolean }): JSX.Element`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/client/components/treeFromNameRequest.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildTreeFromNameRequestBody, parseTreeFromNameResponse } from './treeFromNameRequest.js'

describe('buildTreeFromNameRequestBody', () => {
  it('wraps the name in a JSON object', () => {
    expect(JSON.parse(buildTreeFromNameRequestBody('학'))).toEqual({ name: '학' })
  })
})

describe('parseTreeFromNameResponse', () => {
  const sampleTree = {
    nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
    edges: [
      { from: 'branch', to: 'leaf0', length: 1 },
      { from: 'branch', to: 'leaf1', length: 1 },
      { from: 'branch', to: 'leaf2', length: 1 },
    ],
  }

  it('returns the tree on 200', () => {
    const result = parseTreeFromNameResponse(200, { tree: sampleTree })
    expect('tree' in result && result.tree).toEqual(sampleTree)
  })

  it('returns an error message on 400', () => {
    const result = parseTreeFromNameResponse(400, { error: 'name must be a non-empty string' })
    expect('error' in result && result.error).toMatch(/non-empty/)
  })

  it('returns an error message on 502', () => {
    const result = parseTreeFromNameResponse(502, { error: 'failed after 2 attempts' })
    expect('error' in result).toBe(true)
  })

  it('returns a fallback error for unexpected body shapes', () => {
    const result = parseTreeFromNameResponse(500, { unexpected: true })
    expect('error' in result).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- treeFromNameRequest`
Expected: FAIL — `Cannot find module './treeFromNameRequest.js'`.

- [ ] **Step 3: 구현 — `src/client/components/treeFromNameRequest.ts`**

```ts
import type { Tree } from '../../shared/tree.js'

export function buildTreeFromNameRequestBody(name: string): string {
  return JSON.stringify({ name })
}

export function parseTreeFromNameResponse(
  status: number,
  body: unknown,
): { tree: Tree } | { error: string } {
  if (status === 200 && typeof body === 'object' && body !== null && 'tree' in body) {
    return { tree: (body as { tree: Tree }).tree }
  }
  if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string') {
    return { error: (body as { error: string }).error }
  }
  return { error: `unexpected response (status ${status})` }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- treeFromNameRequest`
Expected: 4 passed, 0 failed.

- [ ] **Step 5: React 컴포넌트 작성 (테스트 없음 — 얇은 글루) — `src/client/components/AnimalNameForm.tsx`**

```tsx
import { useState } from 'react'
import type { Tree } from '../../shared/tree.js'
import { buildTreeFromNameRequestBody, parseTreeFromNameResponse } from './treeFromNameRequest.js'

export interface AnimalNameFormProps {
  onTreeReady: (tree: Tree) => void
  disabled?: boolean
}

export function AnimalNameForm({ onTreeReady, disabled }: AnimalNameFormProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tree-from-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildTreeFromNameRequestBody(name.trim()),
      })
      const body: unknown = await response.json()
      const result = parseTreeFromNameResponse(response.status, body)
      if ('tree' in result) {
        onTreeReady(result.tree)
      } else {
        setError(result.error)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
      <label htmlFor="animal-name">동물 이름을 입력하세요</label>
      <input
        id="animal-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled || loading}
        placeholder="예: 학, 도마뱀, 사자"
      />
      <button type="submit" disabled={disabled || loading || !name.trim()}>
        {loading ? '트리 생성 중...' : '접기 도면 만들기'}
      </button>
      {error && <p style={{ color: '#c33' }}>{error}</p>}
    </form>
  )
}
```

- [ ] **Step 6: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 86 passed (82 + 4).

- [ ] **Step 7: 커밋**

```bash
git add src/client/components/treeFromNameRequest.ts src/client/components/treeFromNameRequest.test.ts src/client/components/AnimalNameForm.tsx
git commit -m "Phase 2/T5: 동물 이름 입력 폼"
```

---

## Task 6: App.tsx 통합 — 입력 폼 + URL 상태 + 기존 파이프라인 연결

**Files:**
- Modify: `src/client/App.tsx`

**Interfaces:**
- Consumes: `AnimalNameForm`(Task 5), `encodeTreeToUrlParam`/`decodeTreeFromUrlParam`(Task 4), 기존 `CPCanvas`/`FoldSimulator`/Worker 파이프라인(Phase 1).

**동작 방식**: 페이지 로드 시 URL에 `?tree=`가 있으면 그걸 디코드해서 바로 Worker로 보낸다(LLM 안 거침). 없으면 입력 폼을 보여주고, 폼 제출 성공 시 받은 트리를 URL에 인코딩해 넣고(`history.replaceState`) 동일하게 Worker로 보낸다.

- [ ] **Step 1: 구현 — `src/client/App.tsx` 전체 교체**

```tsx
import { useEffect, useState } from 'react'
import { AnimalNameForm } from './components/AnimalNameForm.js'
import { CPCanvas } from './components/CPCanvas.js'
import { FoldSimulator } from './components/FoldSimulator.js'
import { encodeTreeToUrlParam, decodeTreeFromUrlParam } from './urlTreeState.js'
import type { Tree } from '../shared/tree.js'
import type { FoldDocument } from '../shared/fold.js'
import type { TreemakerWorkerResponse } from './workers/treemaker.worker.js'

function readTreeFromCurrentUrl(): Tree | null {
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get('tree')
  if (!encoded) return null
  return decodeTreeFromUrlParam(encoded)
}

export function App() {
  const [tree, setTree] = useState<Tree | null>(() => readTreeFromCurrentUrl())
  const [fold, setFold] = useState<FoldDocument | null>(null)

  function handleTreeReady(newTree: Tree): void {
    const encoded = encodeTreeToUrlParam(newTree)
    const url = new URL(window.location.href)
    url.searchParams.set('tree', encoded)
    window.history.replaceState(null, '', url.toString())
    setFold(null)
    setTree(newTree)
  }

  useEffect(() => {
    if (!tree) return
    const worker = new Worker(new URL('./workers/treemaker.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<TreemakerWorkerResponse>) => {
      setFold(event.data.fold)
    })
    worker.postMessage({ tree })
    return () => worker.terminate()
  }, [tree])

  if (!tree) {
    return (
      <main style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ padding: '24px 24px 0' }}>Origami CP Generator</h1>
        <AnimalNameForm onTreeReady={handleTreeReady} />
      </main>
    )
  }

  if (!fold) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
        <p>CP 계산 중...</p>
      </main>
    )
  }

  return (
    <main style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, borderRight: '1px solid #ddd' }}>
        <CPCanvas fold={fold} />
      </div>
      <div style={{ flex: 1 }}>
        <FoldSimulator fold={fold} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 전체 테스트 스위트 통과 확인**

Run: `npm test`
Expected: 86 passed, 0 failed (이 Task는 새 테스트 없음 — App.tsx는 수동 브라우저 검증으로 커버).

- [ ] **Step 3: 클라이언트 빌드 통과 확인**

Run: `npm run build:client`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/client/App.tsx
git commit -m "Phase 2/T6: App.tsx에 입력 폼 + URL 상태 통합"
```

---

## Task 7: 수동 E2E 검증 (LLM 실제 호출 포함)

이 Task는 **운영 환경에서 실제 `ANTHROPIC_API_KEY`가 설정된 상태**로 진행해야 한다 — 로컬에서는 `.env`에 실제 키가 없으면 `/api/tree-from-name`이 항상 503을 반환한다(Task 3에서 의도적으로 그렇게 설계함).

**Files:** 없음(검증만).

- [ ] **Step 1: 로컬에서 목(mock) 클라이언트로 전체 흐름 스모크 확인**

`.env` 없이 `npm run dev:server` + `npm run dev:client`로 브라우저 접속 → 입력 폼이 뜨는지, "학" 입력 후 제출 시 503 에러 메시지가 화면에 뜨는지 확인(정상 — 로컬엔 API 키 없음).

- [ ] **Step 2: 운영 배포**

`git push origin main` → Phase 0의 CI/CD로 자동 배포.

- [ ] **Step 3: 운영 `.env`에 실제 API 키 설정 (사용자 작업)**

맥미니에서 `/opt/stack/services/public/myazit.kr/origami/.env`의 `ANTHROPIC_API_KEY=`에 실제 키를 채우고, `docker compose --env-file ../.env -f docker-compose.yml up -d --build --force-recreate`로 재기동(또는 `scripts/deploy.sh` 재실행).

- [ ] **Step 4: 실제 브라우저로 https://origami.myazit.kr 접속해 확인**

- 입력 폼이 보임
- "학" 입력 → 제출 → 로딩 표시 → 몇 초 후 2D CP + 3D 뷰가 뜸(Phase 1 파이프라인)
- 브라우저 주소창에 `?tree=...` 파라미터가 추가됨
- 그 URL을 복사해서 새 탭/시크릿 창에 붙여넣기 → **입력 폼 없이 바로** 동일한 CP가 뜸(LLM 재호출 안 함)
- "도마뱀", "사자" 등 다른 동물도 시도해서 매번 다른(하지만 항상 유효한) 트라이포드가 나오는지 확인
- 아주 이상한 입력(예: 빈 문자열 제출 시도, 특수문자만)도 폼에서 막히거나 서버가 400/502로 정상 응답하는지 확인

- [ ] **Step 5: 완료 기준 체크**

- [ ] "학"·"crane"·"swan" 등 최소 3개 동물이 정상 동작
- [ ] URL 공유 시 다른 브라우저/시크릿 창에서 동일 결과 재현
- [ ] 콘솔 에러 없음
- [ ] `npm test` 전체 통과 (86개)

---

## 완료 후 체크리스트 (Phase 2 → Phase 3 게이트)

- [ ] 모든 Task의 모든 Step이 체크됨
- [ ] `npm test` 전체 통과 (86개 이상)
- [ ] 운영 배포 + 실제 API 키로 end-to-end 동작 확인
- [ ] URL 공유 재현성 확인
- [ ] 설계 스펙(`docs/superpowers/specs/2026-06-30-origami-cp-generator-design.md`) §7 Phase 2 완료 기준과 대조 확인
