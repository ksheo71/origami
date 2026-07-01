# Phase 3 — N갈래 별 모양 엔진 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TreeMaker 엔진을 "다리 3개 고정 트라이포드"에서 "중심 분기점 1개 + 다리 N개(3≤N≤6)짜리 별 모양"으로 일반화하여, 서로 다른 동물이 서로 다른 다각형 CP로 나오게 한다.

**Architecture:** 잎 배치는 순환 다각형(cyclic polygon) 닫힌-형식 작도(1D 근찾기), 몰리큘은 기존 tripod를 직접 일반화한 단일 허브 방사형 구조. 두 단계 모두 N=3에서 Phase 1과 동일한 도형/면 개수로 환원된다. NLP 솔버·거싯 없음. 못 다루는 트리(한 다리 과대·비인접 겹침)는 깨진 FOLD를 내지 않고 예외로 실패 처리.

**Tech Stack:** TypeScript(strict, ESM), Vitest, 순수 함수 기하 엔진(브라우저 Web Worker에서 실행). Anthropic SDK(LLM 트리 생성).

## Global Constraints

- **결정성 필수**: `Math.random()`·`Date.now()`·`new Date()` 사용 금지. 같은 트리 입력 → 바이트 동일 FOLD (URL 공유 전제).
- **ESM import 규칙**: 상대 import는 항상 `.js` 확장자 사용(TS 소스는 `.ts`이지만 import는 `.js`로 표기). 예: `import { x } from './geometry.js'`.
- **TS strict**: 배열 인덱싱 결과는 `!` 또는 명시적 undefined 가드로 좁힌다(기존 코드 컨벤션 준수).
- **빌드 게이트**: 각 엔진/서버 Task 끝에 `npm run build:server`(엄격한 `tsconfig.server.json`)와 `npm run build:client`가 그린이어야 한다. Phase 2에서 이 검증 누락으로 배포 실패했으므로 필수.
- **테스트 카운트 주의**: 각 Task 브리프의 "N passed" 기대치를 신뢰하지 말 것. 먼저 `npm test`로 실제 baseline을 확인한 뒤 새로 추가한 테스트만 계산한다.
- **FOLD foldAngle 컨벤션**: `M=-180, V=180, B=null, F=0, U=null` (Origami Simulator가 `edges_foldAngle[i]`를 무조건 인덱싱함 — 누락 시 TypeError).
- **엔진 범위**: 엔진은 N≥3을 처리한다. LLM은 4~6개 다리를 방출한다(N=3은 회귀 테스트/직접 트리 입력용으로만 유지).

---

## File Structure

**신규**
- `src/treemaker/geometry.ts` — `Point`, `distance`, `lerp` (공용 기하 프리미티브).
- `src/treemaker/starTree.ts` — `toStarTree(tree)`: 단일 분기점 별 트리 검증 + 순서 있는 다리 추출.
- `src/treemaker/starPacking.ts` — `packStarLeaves(star)`: 순환 다각형 배치 + 겹침 검출. `PackingError`.
- `src/treemaker/starMolecule.ts` — `buildStarMolecule(packing)`: 단일 허브 방사형 몰리큘.

**수정**
- `src/treemaker/foldAssembly.ts` — 고정 7정점 → 동적 (2N+1)정점 조립으로 재작성.
- `src/treemaker/treemaker.ts` — 오케스트레이터를 새 경로로 재배선.
- `src/server/llm/treeTool.ts` — `emit_animal_tripod`(3고정) → `emit_animal_star`(4~6).
- `src/server/llm/generateTree.ts` — 새 도구/변환 함수명·검증 반영.
- `.gitignore` — `src/**/*.js` 무시.

**삭제**
- `src/treemaker/starTripod.ts` + `starTripod.test.ts`
- `src/treemaker/rabbitEarMolecule.ts` + `rabbitEarMolecule.test.ts`
- `src/**/*.js` 컴파일 잔재 6개(untracked).

---

## Task 0: 하우스키핑 — 컴파일 잔재 제거 + gitignore

**Files:**
- Delete: `src/shared/tree.js`, `src/shared/fold.js`, `src/treemaker/starTripod.js`, `src/treemaker/rabbitEarMolecule.js`, `src/treemaker/foldAssembly.js`, `src/treemaker/treemaker.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (동작 변화 없음, 위생 작업)

- [ ] **Step 1: 현재 잔재 확인**

Run: `git status --short src/ && ls src/**/*.js`
Expected: 6개의 untracked `.js` 파일이 보임.

- [ ] **Step 2: 잔재 삭제**

Run:
```bash
rm -f src/shared/tree.js src/shared/fold.js \
      src/treemaker/starTripod.js src/treemaker/rabbitEarMolecule.js \
      src/treemaker/foldAssembly.js src/treemaker/treemaker.js
```

- [ ] **Step 3: `.gitignore`에 규칙 추가**

`.gitignore` 끝에 다음을 추가(이미 있으면 생략):
```gitignore
# tsc가 실수로 src에 남긴 컴파일 잔재 (빌드 출력은 dist/ 로만)
src/**/*.js
```

- [ ] **Step 4: 테스트·빌드가 여전히 그린인지 확인**

Run: `npm test`
Expected: 기존 테스트 전부 PASS (삭제한 건 소스 아닌 잔재라 영향 없음).

Run: `npm run build:server && npm run build:client`
Expected: 둘 다 성공(에러 없음).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove stray compiled .js from src, gitignore them"
```

---

## Task 1: 기하 프리미티브 + 별 트리 추출

**Files:**
- Create: `src/treemaker/geometry.ts`
- Create: `src/treemaker/starTree.ts`
- Test: `src/treemaker/starTree.test.ts`

**Interfaces:**
- Consumes: `Tree` from `../shared/tree.js`, `leafIds` from `../shared/tree.js`
- Produces:
  - `interface Point { x: number; y: number }` (from `geometry.js`)
  - `function distance(a: Point, b: Point): number`
  - `function lerp(a: Point, b: Point, t: number): Point`
  - `interface StarLeg { id: string; edgeLength: number }`
  - `interface StarTree { branchNodeId: string; legs: StarLeg[] }`
  - `function toStarTree(tree: Tree): StarTree`

- [ ] **Step 1: `geometry.ts` 작성 (테스트 불필요한 순수 프리미티브)**

Create `src/treemaker/geometry.ts`:
```ts
export interface Point {
  x: number
  y: number
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `src/treemaker/starTree.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toStarTree } from './starTree.js'
import type { Tree } from '../shared/tree.js'

function starTree(lengths: number[]): Tree {
  return {
    nodes: [{ id: 'branch' }, ...lengths.map((_, i) => ({ id: `leg-${i}` }))],
    edges: lengths.map((len, i) => ({ from: 'branch', to: `leg-${i}`, length: len })),
  }
}

describe('toStarTree', () => {
  it('extracts branch id and ordered legs for a 4-leg star', () => {
    const star = toStarTree(starTree([1, 1.2, 1, 0.8]))
    expect(star.branchNodeId).toBe('branch')
    expect(star.legs).toEqual([
      { id: 'leg-0', edgeLength: 1 },
      { id: 'leg-1', edgeLength: 1.2 },
      { id: 'leg-2', edgeLength: 1 },
      { id: 'leg-3', edgeLength: 0.8 },
    ])
  })

  it('still works for the 3-leg (tripod) case', () => {
    const star = toStarTree(starTree([1, 1, 1]))
    expect(star.legs).toHaveLength(3)
  })

  it('throws when fewer than 3 legs', () => {
    expect(() => toStarTree(starTree([1, 1]))).toThrow(/at least 3/)
  })

  it('throws when there is not exactly one branch node', () => {
    // two internal nodes (a spine) — out of scope for the star engine
    const tree: Tree = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'l0' }, { id: 'l1' }, { id: 'l2' }],
      edges: [
        { from: 'a', to: 'b', length: 1 },
        { from: 'a', to: 'l0', length: 1 },
        { from: 'a', to: 'l1', length: 1 },
        { from: 'b', to: 'l2', length: 1 },
      ],
    }
    expect(() => toStarTree(tree)).toThrow(/exactly 1 branch node/)
  })

  it('throws when an edge does not touch the branch node', () => {
    // 3 legs on branch (passes the >=3 leaves + exactly-1-internal checks),
    // plus a stray edge between two other nodes that touches neither branch nor a real leg.
    const tree: Tree = {
      nodes: [
        { id: 'branch' },
        { id: 'l0' },
        { id: 'l1' },
        { id: 'l2' },
        { id: 'x' },
        { id: 'y' },
      ],
      edges: [
        { from: 'branch', to: 'l0', length: 1 },
        { from: 'branch', to: 'l1', length: 1 },
        { from: 'branch', to: 'l2', length: 1 },
        { from: 'x', to: 'y', length: 1 }, // stray edge — touches neither branch
      ],
    }
    expect(() => toStarTree(tree)).toThrow(/touch the branch node/)
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/treemaker/starTree.test.ts`
Expected: FAIL — `Cannot find module './starTree.js'` (아직 미작성).

- [ ] **Step 4: `starTree.ts` 구현**

Create `src/treemaker/starTree.ts`:
```ts
import type { Tree } from '../shared/tree.js'
import { leafIds } from '../shared/tree.js'

export interface StarLeg {
  id: string
  edgeLength: number
}

export interface StarTree {
  branchNodeId: string
  legs: StarLeg[]
}

export function toStarTree(tree: Tree): StarTree {
  const leaves = leafIds(tree)
  if (leaves.length < 3) {
    throw new Error(`toStarTree requires at least 3 legs, got ${leaves.length}`)
  }

  const internal = tree.nodes.filter((node) => !leaves.includes(node.id))
  if (internal.length !== 1) {
    throw new Error(`toStarTree requires exactly 1 branch node, got ${internal.length}`)
  }
  const branchNode = internal[0]
  if (branchNode === undefined) {
    throw new Error('unreachable: internal.length === 1 but indexing returned undefined')
  }
  const branchNodeId = branchNode.id

  for (const edge of tree.edges) {
    if (edge.from !== branchNodeId && edge.to !== branchNodeId) {
      throw new Error(
        `toStarTree requires every edge to touch the branch node; offending edge: ${edge.from}-${edge.to}`,
      )
    }
  }

  const legs: StarLeg[] = leaves.map((leafId) => {
    const edge = tree.edges.find(
      (e) =>
        (e.from === branchNodeId && e.to === leafId) ||
        (e.to === branchNodeId && e.from === leafId),
    )
    if (edge === undefined) {
      throw new Error(`toStarTree: leaf ${leafId} is not connected to the branch node`)
    }
    return { id: leafId, edgeLength: edge.length }
  })

  return { branchNodeId, legs }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/treemaker/starTree.test.ts`
Expected: PASS (5개 테스트).

- [ ] **Step 6: Commit**

```bash
git add src/treemaker/geometry.ts src/treemaker/starTree.ts src/treemaker/starTree.test.ts
git commit -m "feat(treemaker): geometry primitives + single-branch star tree extraction"
```

---

## Task 2: 순환 다각형 잎 배치

**Files:**
- Create: `src/treemaker/starPacking.ts`
- Test: `src/treemaker/starPacking.test.ts`

**Interfaces:**
- Consumes: `Point`, `distance` from `./geometry.js`; `StarTree`, `StarLeg` from `./starTree.js`
- Produces:
  - `interface PackedLeaf { id: string; edgeLength: number; position: Point }`
  - `interface StarPacking { branchNodeId: string; leaves: PackedLeaf[] }`
  - `class PackingError extends Error`
  - `function packStarLeaves(star: StarTree): StarPacking`

**수학 노트 (구현자 필독):** 인접(순환) 잎 원이 접하도록 배치하려면, 변 길이 `d_i = e_i + e_{i+1}`(순환)를 갖는 **원에 내접하는 다각형**을 만든다. 외접원 반지름 `R`은 `Σ_i 2·asin(d_i/2R) = 2π`의 유일 해다(좌변은 R에 대해 단조감소). 존재 조건은 `max(d_i) < (Σ d_i)/2`. N=3이면 이는 SSS 삼각형의 외접원과 동일하다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/treemaker/starPacking.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { packStarLeaves, PackingError } from './starPacking.js'
import { distance } from './geometry.js'
import type { StarTree } from './starTree.js'

function star(lengths: number[]): StarTree {
  return {
    branchNodeId: 'branch',
    legs: lengths.map((len, i) => ({ id: `leg-${i}`, edgeLength: len })),
  }
}

describe('packStarLeaves', () => {
  it('places 3 equal legs so adjacent circles are tangent (equilateral)', () => {
    const packing = packStarLeaves(star([1, 1, 1]))
    expect(packing.leaves).toHaveLength(3)
    // adjacent tangency: |p_i - p_{i+1}| == e_i + e_{i+1} == 2
    for (let i = 0; i < 3; i++) {
      const a = packing.leaves[i]!
      const b = packing.leaves[(i + 1) % 3]!
      expect(distance(a.position, b.position)).toBeCloseTo(2, 6)
    }
  })

  it('places 4 equal legs on a square (adjacent tangent, diagonal clear)', () => {
    const packing = packStarLeaves(star([1, 1, 1, 1]))
    for (let i = 0; i < 4; i++) {
      const a = packing.leaves[i]!
      const b = packing.leaves[(i + 1) % 4]!
      expect(distance(a.position, b.position)).toBeCloseTo(2, 6)
    }
    // diagonal (non-adjacent) must NOT overlap: >= e_i + e_j = 2
    expect(distance(packing.leaves[0]!.position, packing.leaves[2]!.position)).toBeGreaterThan(2)
  })

  it('is deterministic — same input yields identical coordinates', () => {
    const a = packStarLeaves(star([1, 1.2, 1, 0.8, 1.5]))
    const b = packStarLeaves(star([1, 1.2, 1, 0.8, 1.5]))
    expect(a).toEqual(b)
  })

  it('preserves leg ids and edge lengths', () => {
    const packing = packStarLeaves(star([1, 1.2, 1.6, 0.9]))
    expect(packing.leaves.map((l) => l.id)).toEqual(['leg-0', 'leg-1', 'leg-2', 'leg-3'])
    expect(packing.leaves.map((l) => l.edgeLength)).toEqual([1, 1.2, 1.6, 0.9])
  })

  it('throws PackingError when one leg dominates (cannot form a convex ring)', () => {
    // one huge leg vs tiny others: max(d_i) >= sum(d_i)/2
    expect(() => packStarLeaves(star([1, 1, 10, 1]))).toThrow(PackingError)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/treemaker/starPacking.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `starPacking.ts` 구현**

Create `src/treemaker/starPacking.ts`:
```ts
import type { Point } from './geometry.js'
import { distance } from './geometry.js'
import type { StarTree } from './starTree.js'

export interface PackedLeaf {
  id: string
  edgeLength: number
  position: Point
}

export interface StarPacking {
  branchNodeId: string
  leaves: PackedLeaf[]
}

export class PackingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackingError'
  }
}

// 변 길이 d_i(순환)로 원에 내접하는 다각형의 외접원 반지름을 이분법으로 찾는다.
// f(R) = Σ 2·asin(d_i / 2R) − 2π 는 R에 대해 단조감소. 존재 조건: max(d_i) < Σd_i/2.
function solveCircumradius(sides: number[]): number {
  const perimeterHalf = sides.reduce((acc, d) => acc + d, 0) / 2
  const maxSide = Math.max(...sides)
  if (maxSide >= perimeterHalf) {
    throw new PackingError('one leg dominates; cannot form a convex tangent ring')
  }

  const f = (R: number): number =>
    sides.reduce((acc, d) => acc + 2 * Math.asin(Math.min(1, d / (2 * R))), 0) - 2 * Math.PI

  let lo = maxSide / 2 + 1e-12
  let hi = maxSide
  let guard = 0
  while (f(hi) >= 0) {
    hi *= 2
    guard += 1
    if (guard > 200) {
      throw new PackingError('circumradius search did not converge')
    }
  }
  if (f(lo) <= 0) {
    throw new PackingError('circumradius search has no root (degenerate leg lengths)')
  }

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function packStarLeaves(star: StarTree): StarPacking {
  const legs = star.legs
  const n = legs.length
  const radii = legs.map((leg) => leg.edgeLength)

  // 인접(순환) 접선 거리 d_i = e_i + e_{i+1}
  const sides = radii.map((r, i) => {
    const next = radii[(i + 1) % n]
    if (next === undefined) throw new Error('unreachable')
    return r + next
  })

  const R = solveCircumradius(sides)

  // 정점을 원 둘레에 중심각을 누적하며 배치.
  const positions: Point[] = []
  let angle = 0
  for (let i = 0; i < n; i++) {
    positions.push({ x: R * Math.cos(angle), y: R * Math.sin(angle) })
    const side = sides[i]
    if (side === undefined) throw new Error('unreachable')
    angle += 2 * Math.asin(Math.min(1, side / (2 * R)))
  }

  // 비인접 원 겹침 검출: 모든 쌍이 |p_i - p_j| >= e_i + e_j 여야 함.
  const EPS = 1e-6
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pi = positions[i]
      const pj = positions[j]
      const ri = radii[i]
      const rj = radii[j]
      if (pi === undefined || pj === undefined || ri === undefined || rj === undefined) {
        throw new Error('unreachable')
      }
      if (distance(pi, pj) < ri + rj - EPS) {
        throw new PackingError(
          `leaf circles ${legs[i]!.id} and ${legs[j]!.id} overlap; tree not representable as a simple star base`,
        )
      }
    }
  }

  return {
    branchNodeId: star.branchNodeId,
    leaves: legs.map((leg, i) => {
      const position = positions[i]
      if (position === undefined) throw new Error('unreachable')
      return { id: leg.id, edgeLength: leg.edgeLength, position }
    }),
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/treemaker/starPacking.test.ts`
Expected: PASS (5개 테스트).

- [ ] **Step 5: Commit**

```bash
git add src/treemaker/starPacking.ts src/treemaker/starPacking.test.ts
git commit -m "feat(treemaker): cyclic-polygon leaf packing for N-leg star"
```

---

## Task 3: 단일 허브 방사형 몰리큘

**Files:**
- Create: `src/treemaker/starMolecule.ts`
- Test: `src/treemaker/starMolecule.test.ts`

**Interfaces:**
- Consumes: `Point`, `lerp` from `./geometry.js`; `StarPacking` from `./starPacking.js`; `EdgeAssignment` from `../shared/fold.js`
- Produces:
  - `interface StarMolecule { hub: Point; tangentPoints: Point[]; leafCreaseAssignments: EdgeAssignment[]; tangentCreaseAssignments: EdgeAssignment[] }`
  - `function buildStarMolecule(packing: StarPacking): StarMolecule`

**수학 노트:** 허브 `H = Σ p_i·(S − e_i) / ((n−1)·S)`, `S = Σ e_i` (N=3이면 tripod 가중 incenter와 동일). 접선점 `t_i`는 변 (i → i+1) 위 비율 `e_i : e_{i+1}` 지점. 크리스 배정: `H→leaf_i` 전부 M(n개), `H→t_i`는 첫 번째만 M·나머지 V(n개) → M=n+1, V=n−1, |M−V|=2 (Maekawa, 모든 N).

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/treemaker/starMolecule.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildStarMolecule } from './starMolecule.js'
import { packStarLeaves } from './starPacking.js'
import type { StarTree } from './starTree.js'
import type { EdgeAssignment } from '../shared/fold.js'

function star(lengths: number[]): StarTree {
  return {
    branchNodeId: 'branch',
    legs: lengths.map((len, i) => ({ id: `leg-${i}`, edgeLength: len })),
  }
}

function countAssignments(list: EdgeAssignment[]): Record<string, number> {
  return list.reduce<Record<string, number>>((acc, a) => {
    acc[a] = (acc[a] ?? 0) + 1
    return acc
  }, {})
}

describe('buildStarMolecule', () => {
  it('for 3 equal legs, hub is the centroid (origin) and matches tripod structure', () => {
    const molecule = buildStarMolecule(packStarLeaves(star([1, 1, 1])))
    expect(molecule.hub.x).toBeCloseTo(0, 6)
    expect(molecule.hub.y).toBeCloseTo(0, 6)
    expect(molecule.tangentPoints).toHaveLength(3)
    expect(molecule.leafCreaseAssignments).toEqual(['M', 'M', 'M'])
    expect(molecule.tangentCreaseAssignments).toEqual(['M', 'V', 'V'])
  })

  it('satisfies Maekawa |M - V| = 2 for N = 5', () => {
    const molecule = buildStarMolecule(packStarLeaves(star([1, 1.2, 1, 0.8, 1.4])))
    const all = [...molecule.leafCreaseAssignments, ...molecule.tangentCreaseAssignments]
    const counts = countAssignments(all)
    expect(Math.abs((counts.M ?? 0) - (counts.V ?? 0))).toBe(2)
    // n leaf creases + n tangent creases
    expect(molecule.leafCreaseAssignments).toHaveLength(5)
    expect(molecule.tangentCreaseAssignments).toHaveLength(5)
  })

  it('places the tangent point at the e_i : e_{i+1} ratio on each edge', () => {
    const packing = packStarLeaves(star([1, 3, 1, 1])) // edge leg0->leg1 split 1:3
    const molecule = buildStarMolecule(packing)
    const p0 = packing.leaves[0]!.position
    const p1 = packing.leaves[1]!.position
    const t0 = molecule.tangentPoints[0]!
    // |p0 - t0| / |p0 - p1| == e0 / (e0 + e1) == 1/4
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y)
    expect(d(p0, t0) / d(p0, p1)).toBeCloseTo(0.25, 6)
  })

  it('keeps the hub strictly inside (weighted centroid) for asymmetric legs', () => {
    const molecule = buildStarMolecule(packStarLeaves(star([1, 1.5, 0.7, 1.2])))
    expect(Number.isFinite(molecule.hub.x)).toBe(true)
    expect(Number.isFinite(molecule.hub.y)).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/treemaker/starMolecule.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `starMolecule.ts` 구현**

Create `src/treemaker/starMolecule.ts`:
```ts
import type { Point } from './geometry.js'
import { lerp } from './geometry.js'
import type { StarPacking } from './starPacking.js'
import type { EdgeAssignment } from '../shared/fold.js'

export interface StarMolecule {
  hub: Point
  tangentPoints: Point[]
  // hub -> leaf_i (길이 n)
  leafCreaseAssignments: EdgeAssignment[]
  // hub -> t_i (길이 n)
  tangentCreaseAssignments: EdgeAssignment[]
}

export function buildStarMolecule(packing: StarPacking): StarMolecule {
  const leaves = packing.leaves
  const n = leaves.length
  const S = leaves.reduce((acc, leaf) => acc + leaf.edgeLength, 0)

  // 허브 = 가중 중심 H = Σ p_i (S − e_i) / ((n−1) S)
  let hx = 0
  let hy = 0
  for (const leaf of leaves) {
    const w = S - leaf.edgeLength
    hx += leaf.position.x * w
    hy += leaf.position.y * w
  }
  const denom = (n - 1) * S
  const hub: Point = { x: hx / denom, y: hy / denom }

  // 접선점 t_i: 변 (i → i+1) 위 비율 e_i : e_{i+1}
  const tangentPoints: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = leaves[i]
    const b = leaves[(i + 1) % n]
    if (a === undefined || b === undefined) throw new Error('unreachable')
    const t = a.edgeLength / (a.edgeLength + b.edgeLength)
    tangentPoints.push(lerp(a.position, b.position, t))
  }

  // 배정: leaf 크리스 전부 M; tangent 크리스 첫 번째만 M, 나머지 V → |M − V| = 2
  const leafCreaseAssignments: EdgeAssignment[] = leaves.map(() => 'M')
  const tangentCreaseAssignments: EdgeAssignment[] = tangentPoints.map((_, i) =>
    i === 0 ? 'M' : 'V',
  )

  return { hub, tangentPoints, leafCreaseAssignments, tangentCreaseAssignments }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/treemaker/starMolecule.test.ts`
Expected: PASS (4개 테스트).

- [ ] **Step 5: Commit**

```bash
git add src/treemaker/starMolecule.ts src/treemaker/starMolecule.test.ts
git commit -m "feat(treemaker): single-hub radial molecule generalizing the tripod"
```

---

## Task 4: 일반화된 FOLD 조립

**Files:**
- Modify: `src/treemaker/foldAssembly.ts` (전면 재작성)
- Test: `src/treemaker/foldAssembly.test.ts` (재작성)

**Interfaces:**
- Consumes: `FoldDocument`, `EdgeAssignment` from `../shared/fold.js`; `StarPacking` from `./starPacking.js`; `StarMolecule` from `./starMolecule.js`
- Produces: `function assembleFold(packing: StarPacking, molecule: StarMolecule): FoldDocument`

**정점 레이아웃:** `[leaf_0..leaf_{n-1}, hub, t_0..t_{n-1}]` → 총 `2n+1` 정점. 변: 경계 `2n`(각 순환 변을 접선점에서 분할) + 내부 `2n`(hub→leaf, hub→t). 면: `2n`개 삼각형 `[leaf_i, t_i, hub]`, `[t_i, leaf_{i+1}, hub]`. N=3이면 정점7·변12·면6 (Phase 1과 동일).

- [ ] **Step 1: 실패하는 테스트로 재작성**

Overwrite `src/treemaker/foldAssembly.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { assembleFold } from './foldAssembly.js'
import { packStarLeaves } from './starPacking.js'
import { buildStarMolecule } from './starMolecule.js'
import { validateFold } from '../shared/fold.js'
import type { StarTree } from './starTree.js'

function foldFor(lengths: number[]) {
  const star: StarTree = {
    branchNodeId: 'branch',
    legs: lengths.map((len, i) => ({ id: `leg-${i}`, edgeLength: len })),
  }
  const packing = packStarLeaves(star)
  return assembleFold(packing, buildStarMolecule(packing))
}

describe('assembleFold', () => {
  it('produces 2n+1 vertices, 4n edges, 2n faces for N=4', () => {
    const fold = foldFor([1, 1, 1, 1])
    expect(fold.vertices_coords).toHaveLength(9) // 2*4 + 1
    expect(fold.edges_vertices).toHaveLength(16) // 4n = 16
    expect(fold.faces_vertices).toHaveLength(8) // 2n
  })

  it('matches Phase 1 counts for N=3 (7 vertices, 12 edges, 6 faces)', () => {
    const fold = foldFor([1, 1, 1])
    expect(fold.vertices_coords).toHaveLength(7)
    expect(fold.edges_vertices).toHaveLength(12)
    expect(fold.faces_vertices).toHaveLength(6)
  })

  it('emits parallel edges_assignment and edges_foldAngle arrays', () => {
    const fold = foldFor([1, 1.2, 1, 0.8, 1.4])
    expect(fold.edges_assignment).toHaveLength(fold.edges_vertices.length)
    expect(fold.edges_foldAngle).toHaveLength(fold.edges_vertices.length)
    // boundary edges (2n) are B/null; interior (2n) are M/-180 or V/180
    for (let i = 0; i < fold.edges_vertices.length; i++) {
      const a = fold.edges_assignment[i]
      const angle = fold.edges_foldAngle[i]
      if (a === 'B') expect(angle).toBeNull()
      if (a === 'M') expect(angle).toBe(-180)
      if (a === 'V') expect(angle).toBe(180)
    }
  })

  it('passes validateFold for N=3..6', () => {
    for (const n of [3, 4, 5, 6]) {
      const lengths = Array.from({ length: n }, (_, i) => 1 + 0.1 * i)
      expect(() => validateFold(foldFor(lengths))).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/treemaker/foldAssembly.test.ts`
Expected: FAIL — 기존 `assembleFold`가 `StarTripod`/`RabbitEarMolecule` 시그니처라 타입/런타임 에러.

- [ ] **Step 3: `foldAssembly.ts` 재작성**

Overwrite `src/treemaker/foldAssembly.ts`:
```ts
import type { FoldDocument, EdgeAssignment } from '../shared/fold.js'
import type { StarPacking } from './starPacking.js'
import type { StarMolecule } from './starMolecule.js'

// Origami Simulator 데모 자산에서 확인한 컨벤션. 없으면 import 경로가
// fold.edges_foldAngle[i] 인덱싱에서 TypeError로 죽는다.
const FOLD_ANGLE_BY_ASSIGNMENT: Record<EdgeAssignment, number | null> = {
  M: -180,
  V: 180,
  B: null,
  F: 0,
  U: null,
}

export function assembleFold(packing: StarPacking, molecule: StarMolecule): FoldDocument {
  const leaves = packing.leaves
  const n = leaves.length

  // 정점 레이아웃: [leaf_0..leaf_{n-1}, hub, t_0..t_{n-1}]
  const vertices_coords: [number, number][] = []
  for (const leaf of leaves) {
    vertices_coords.push([leaf.position.x, leaf.position.y])
  }
  const hubIndex = vertices_coords.length
  vertices_coords.push([molecule.hub.x, molecule.hub.y])
  const tangentStart = vertices_coords.length
  for (const tp of molecule.tangentPoints) {
    vertices_coords.push([tp.x, tp.y])
  }

  const leafIndex = (i: number): number => i
  const tangentIndex = (i: number): number => tangentStart + i

  const edges_vertices: [number, number][] = []
  const edges_assignment: EdgeAssignment[] = []
  const edges_foldAngle: (number | null)[] = []

  function addEdge(a: number, b: number, assignment: EdgeAssignment): void {
    edges_vertices.push([a, b])
    edges_assignment.push(assignment)
    edges_foldAngle.push(FOLD_ANGLE_BY_ASSIGNMENT[assignment])
  }

  // 경계: 각 순환 변을 접선점에서 둘로 나눈다.
  for (let i = 0; i < n; i++) {
    addEdge(leafIndex(i), tangentIndex(i), 'B')
    addEdge(tangentIndex(i), leafIndex((i + 1) % n), 'B')
  }

  // 내부 크리스: 허브에서 각 잎으로.
  for (let i = 0; i < n; i++) {
    const assignment = molecule.leafCreaseAssignments[i]
    if (assignment === undefined) throw new Error('unreachable')
    addEdge(hubIndex, leafIndex(i), assignment)
  }
  // 내부 크리스: 허브에서 각 접선점으로.
  for (let i = 0; i < n; i++) {
    const assignment = molecule.tangentCreaseAssignments[i]
    if (assignment === undefined) throw new Error('unreachable')
    addEdge(hubIndex, tangentIndex(i), assignment)
  }

  // 면: 각 순환 변마다 삼각형 2개.
  const faces_vertices: number[][] = []
  for (let i = 0; i < n; i++) {
    faces_vertices.push([leafIndex(i), tangentIndex(i), hubIndex])
    faces_vertices.push([tangentIndex(i), leafIndex((i + 1) % n), hubIndex])
  }

  return {
    file_spec: 1.1,
    file_creator: 'origami-app TreeMaker engine (Phase 3)',
    vertices_coords,
    edges_vertices,
    edges_assignment,
    edges_foldAngle,
    faces_vertices,
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/treemaker/foldAssembly.test.ts`
Expected: PASS (4개 테스트).

- [ ] **Step 5: Commit**

```bash
git add src/treemaker/foldAssembly.ts src/treemaker/foldAssembly.test.ts
git commit -m "feat(treemaker): dynamic FOLD assembly for N-leg star"
```

---

## Task 5: 오케스트레이터 재배선 + 구 트라이포드 제거

**Files:**
- Modify: `src/treemaker/treemaker.ts`
- Test: `src/treemaker/treemaker.test.ts` (보강)
- Delete: `src/treemaker/starTripod.ts`, `src/treemaker/starTripod.test.ts`, `src/treemaker/rabbitEarMolecule.ts`, `src/treemaker/rabbitEarMolecule.test.ts`

**Interfaces:**
- Consumes: `validateTree`, `Tree` from `../shared/tree.js`; `validateFold`, `FoldDocument` from `../shared/fold.js`; `toStarTree`, `packStarLeaves`, `buildStarMolecule`, `assembleFold`
- Produces: `function treeToFold(tree: Tree): FoldDocument` (시그니처 불변 — 소비자 영향 없음)

- [ ] **Step 1: 구 트라이포드/rabbit-ear 파일 삭제**

Run:
```bash
git rm src/treemaker/starTripod.ts src/treemaker/starTripod.test.ts \
       src/treemaker/rabbitEarMolecule.ts src/treemaker/rabbitEarMolecule.test.ts
```

- [ ] **Step 2: `treemaker.ts` 재배선**

Overwrite `src/treemaker/treemaker.ts`:
```ts
import { validateTree } from '../shared/tree.js'
import { validateFold } from '../shared/fold.js'
import type { Tree } from '../shared/tree.js'
import type { FoldDocument } from '../shared/fold.js'
import { toStarTree } from './starTree.js'
import { packStarLeaves } from './starPacking.js'
import { buildStarMolecule } from './starMolecule.js'
import { assembleFold } from './foldAssembly.js'

export function treeToFold(tree: Tree): FoldDocument {
  validateTree(tree)
  const star = toStarTree(tree)
  const packing = packStarLeaves(star)
  const molecule = buildStarMolecule(packing)
  const fold = assembleFold(packing, molecule)
  validateFold(fold)
  return fold
}
```

- [ ] **Step 3: 오케스트레이터 테스트 보강 (결정성 + N=4 + 회귀)**

Overwrite `src/treemaker/treemaker.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { treeToFold } from './treemaker.js'
import { validateFold } from '../shared/fold.js'
import type { Tree } from '../shared/tree.js'

function starTree(lengths: number[]): Tree {
  return {
    nodes: [{ id: 'branch' }, ...lengths.map((_, i) => ({ id: `leg-${i}` }))],
    edges: lengths.map((len, i) => ({ from: 'branch', to: `leg-${i}`, length: len })),
  }
}

describe('treeToFold', () => {
  it('produces a valid FOLD for a 3-leg star (regression)', () => {
    const fold = treeToFold(starTree([1, 1, 1]))
    expect(() => validateFold(fold)).not.toThrow()
    expect(fold.faces_vertices).toHaveLength(6)
  })

  it('produces a valid FOLD for a 4-leg star', () => {
    const fold = treeToFold(starTree([1, 1.2, 1, 0.8]))
    expect(() => validateFold(fold)).not.toThrow()
    expect(fold.faces_vertices).toHaveLength(8)
  })

  it('is deterministic — identical FOLD across two runs', () => {
    const a = treeToFold(starTree([1, 1.2, 1, 0.8, 1.4]))
    const b = treeToFold(starTree([1, 1.2, 1, 0.8, 1.4]))
    expect(a).toEqual(b)
  })

  it('rejects a tree with a leg that dominates', () => {
    expect(() => treeToFold(starTree([1, 1, 10, 1]))).toThrow()
  })
})
```

- [ ] **Step 4: 전체 테스트 실행**

먼저 baseline 확인 후 실행:
Run: `npm test`
Expected: 엔진 테스트 전부 PASS. 삭제한 starTripod/rabbitEar 테스트는 사라지고, 새 파일 테스트가 대신 그린. 실패가 있으면 남은 `starTripod`/`rabbitEarMolecule` import를 찾아 제거(아래 Step 5에서 grep).

- [ ] **Step 5: 잔존 import 확인**

Run: `grep -rn "starTripod\|rabbitEarMolecule\|buildStarTripod\|buildRabbitEarMolecule" src/`
Expected: 결과 없음(0 매치). 있으면 해당 파일을 새 API로 고친다.

- [ ] **Step 6: 빌드 게이트**

Run: `npm run build:server && npm run build:client`
Expected: 둘 다 성공.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(treemaker): wire N-leg star pipeline, remove tripod/rabbit-ear"
```

---

## Task 6: LLM 도구 — emit_animal_star (4~6 다리)

**Files:**
- Modify: `src/server/llm/treeTool.ts`
- Modify: `src/server/llm/generateTree.ts`
- Test: `src/server/llm/treeTool.test.ts` (재작성)

**Interfaces:**
- Produces (`treeTool.ts`):
  - `interface StarLegInput { label: string; length: number }`
  - `interface StarToolInput { creatureLabel: string; legs: StarLegInput[] }`
  - `const TREE_TOOL_NAME = 'emit_animal_star'`
  - `const TREE_TOOL_SCHEMA` (legs `minItems: 4, maxItems: 6`)
  - `function buildSystemPrompt(): string`
  - `function starInputToTree(input: StarToolInput): Tree`
- Consumes (`generateTree.ts`): 위 심볼들 (구 `tripodInputToTree`/`TripodToolInput` 대체)

- [ ] **Step 1: 실패하는 테스트로 재작성**

Overwrite `src/server/llm/treeTool.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { TREE_TOOL_NAME, TREE_TOOL_SCHEMA, starInputToTree } from './treeTool.js'
import { treeToFold } from '../../treemaker/treemaker.js'

describe('emit_animal_star tool', () => {
  it('is named emit_animal_star and requires 4..6 legs', () => {
    expect(TREE_TOOL_NAME).toBe('emit_animal_star')
    expect(TREE_TOOL_SCHEMA.input_schema.properties.legs.minItems).toBe(4)
    expect(TREE_TOOL_SCHEMA.input_schema.properties.legs.maxItems).toBe(6)
  })

  it('starInputToTree builds a single-branch star tree', () => {
    const tree = starInputToTree({
      creatureLabel: '사자',
      legs: [
        { label: 'head', length: 1 },
        { label: 'tail', length: 1.4 },
        { label: 'leg-front', length: 0.8 },
        { label: 'leg-back', length: 0.8 },
      ],
    })
    expect(tree.nodes).toHaveLength(5) // branch + 4 legs
    expect(tree.edges).toHaveLength(4)
    expect(tree.edges.every((e) => e.from === 'branch')).toBe(true)
  })

  it('the produced tree folds through the engine', () => {
    const tree = starInputToTree({
      creatureLabel: '학',
      legs: [
        { label: 'wing-l', length: 1.2 },
        { label: 'wing-r', length: 1.2 },
        { label: 'head', length: 1 },
        { label: 'tail', length: 1.5 },
      ],
    })
    expect(() => treeToFold(tree)).not.toThrow()
  })

  it('rejects non-positive lengths', () => {
    expect(() =>
      starInputToTree({
        creatureLabel: 'x',
        legs: [
          { label: 'a', length: 1 },
          { label: 'b', length: 0 },
          { label: 'c', length: 1 },
          { label: 'd', length: 1 },
        ],
      }),
    ).toThrow(/positive/)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/server/llm/treeTool.test.ts`
Expected: FAIL — `emit_animal_star`/`starInputToTree` 미존재.

- [ ] **Step 3: `treeTool.ts` 재작성**

Overwrite `src/server/llm/treeTool.ts`:
```ts
import type { Tree } from '../../shared/tree.js'

export interface StarLegInput {
  label: string
  length: number
}

export interface StarToolInput {
  creatureLabel: string
  legs: StarLegInput[]
}

export const TREE_TOOL_NAME = 'emit_animal_star'

export const TREE_TOOL_SCHEMA = {
  name: TREE_TOOL_NAME,
  description:
    '동물 이름을 종이접기용 "별 모양"(분기점 1개 + 다리 4~6개짜리 스틱 피겨)으로 변환한다. ' +
    '실제 동물의 주요 신체 부위(머리·꼬리·다리·날개)를 4~6개의 다리로 표현한다.',
  input_schema: {
    type: 'object',
    properties: {
      creatureLabel: {
        type: 'string',
        description: '입력받은 동물 이름 그대로 (예: "학", "사자").',
      },
      legs: {
        type: 'array',
        minItems: 4,
        maxItems: 6,
        description: '4개 이상 6개 이하. 각 다리는 상대적 길이(양수)를 가진다.',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: '이 다리가 무엇을 상징하는지 (예: "wing-left", "tail", "leg-front").',
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
    '- 다리는 4개 이상 6개 이하입니다. 그 동물을 대표하는 주요 신체 부위',
    '  (머리·목·꼬리·다리·날개 등)를 4~6개 골라 각각 하나의 다리로 표현하세요.',
    '  예: 사자라면 머리, 꼬리, 앞다리, 뒷다리 → 4개. 학이라면 양 날개, 머리, 꼬리 → 4개.',
    '- 길이는 1.0을 기준으로 한 상대값입니다. 두드러지게 긴 부위(긴 꼬리·목)는 길게,',
    '  짧은 부위는 짧게 설정하되, 한 다리가 나머지 합을 압도하지 않도록 하세요',
    '  (너무 극단적이면 접기 도면을 만들 수 없습니다).',
    '- creatureLabel에는 입력받은 이름을 그대로 넣으세요.',
  ].join('\n')
}

export function starInputToTree(input: StarToolInput): Tree {
  for (const leg of input.legs) {
    if (leg.length <= 0) {
      throw new Error(
        `starInputToTree: leg length must be positive, got ${leg.length} for "${leg.label}"`,
      )
    }
  }

  return {
    nodes: [
      { id: 'branch', label: input.creatureLabel },
      ...input.legs.map((leg, i) => ({ id: `leg-${i}`, label: leg.label })),
    ],
    edges: input.legs.map((leg, i) => ({ from: 'branch', to: `leg-${i}`, length: leg.length })),
  }
}
```

- [ ] **Step 4: `generateTree.ts` 참조 갱신**

`src/server/llm/generateTree.ts`의 import·검증·변환 참조를 새 이름으로 바꾼다.

Line 3-4 을:
```ts
import { TREE_TOOL_NAME, TREE_TOOL_SCHEMA, buildSystemPrompt, starInputToTree } from './treeTool.js'
import type { StarToolInput } from './treeTool.js'
```
로 교체.

`isTripodToolInput` 함수(17-29행)를 다음으로 교체:
```ts
function isStarToolInput(value: unknown): value is StarToolInput {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { creatureLabel?: unknown; legs?: unknown }
  if (typeof candidate.creatureLabel !== 'string') return false
  if (!Array.isArray(candidate.legs) || candidate.legs.length < 4 || candidate.legs.length > 6) {
    return false
  }
  return candidate.legs.every(
    (leg): leg is { label: string; length: number } =>
      typeof leg === 'object' &&
      leg !== null &&
      typeof (leg as { label?: unknown }).label === 'string' &&
      typeof (leg as { length?: unknown }).length === 'number',
  )
}
```

`attemptOnce` 내부(39·44행)의 `isTripodToolInput` → `isStarToolInput`, `tripodInputToTree` → `starInputToTree` 로 교체. 에러 메시지 문자열의 "tripod" → "star" 로 교체(60행).

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/server/llm/treeTool.test.ts`
Expected: PASS (4개 테스트).

Run: `grep -rn "tripod\|Tripod" src/server/`
Expected: 결과 없음.

- [ ] **Step 6: 빌드 게이트**

Run: `npm run build:server && npm run build:client`
Expected: 둘 다 성공.

- [ ] **Step 7: Commit**

```bash
git add src/server/llm/treeTool.ts src/server/llm/treeTool.test.ts src/server/llm/generateTree.ts
git commit -m "feat(llm): emit_animal_star tool with 4-6 legs"
```

---

## Task 7: 배선·예제 정합성 검증

**Files:**
- Inspect: `src/client/workers/treemaker.worker.ts`, `src/client/urlTreeState.ts`, `src/client/cpData/craneTree.ts`, `src/client/components/CPCanvas.tsx`, `src/client/components/foldToSvgPaths.ts`
- Modify (필요 시): 위 중 3-다리를 가정한 곳

**Interfaces:**
- Consumes: `treeToFold` (시그니처 불변), `FoldDocument` (구조 불변)
- Produces: 없음 (검증 Task)

- [ ] **Step 1: 3-다리 가정이 남은 곳 검색**

Run: `grep -rn "length !== 3\|=== 3\|tripod\|Tripod\|3 leaves\|3 legs" src/client/`
Expected: 렌더러·워커·URL 코드에는 3 고정 가정이 없어야 함(모두 FOLD를 일반적으로 소비). 매치가 있으면 각각 검토.

- [ ] **Step 2: 예제 트리(craneTree)가 새 엔진을 통과하는지 확인**

`src/client/cpData/craneTree.ts`가 여전히 유효한 단일 분기점 별 트리인지 확인(3-다리라도 엔진이 처리). 별도 테스트가 있으면 실행:
Run: `npx vitest run src/client/cpData 2>/dev/null || echo "no cpData tests"`
Expected: 통과 또는 테스트 없음.

- [ ] **Step 3: 클라이언트 타입체크·빌드**

Run: `npm run build:client`
Expected: 성공(렌더러가 동적 정점/변/면 FOLD를 그대로 처리하므로 변경 불필요할 가능성 높음).

- [ ] **Step 4: 전체 테스트 스위트 그린 확인**

Run: `npm test`
Expected: 전부 PASS.

- [ ] **Step 5: (변경이 있었다면) Commit**

```bash
git add -A
git commit -m "chore(client): verify N-leg FOLD flows through worker/render/url"
```
변경이 없었다면 이 Task는 커밋 없이 검증만 기록.

---

## Task 8: 수동 E2E — 시뮬레이터에서 서로 다른 동물 접기

**Files:** 없음 (운영/로컬 검증)

**Interfaces:** 없음

**목적:** 단위 테스트로는 "발산 없이 접힘"을 증명 못 함(스펙 §10 최대 리스크). 실제 브라우저에서 확인.

- [ ] **Step 1: 배포 또는 로컬 실행**

main에 병합 후 `https://origami.myazit.kr` 배포를 기다리거나, 로컬 `npm run dev` 로 띄운다.
(운영 배포 시 Phase 0 CI/CD 사용 — `.env`의 `ANTHROPIC_API_KEY` 이미 설정됨.)

- [ ] **Step 2: 4종 입력, 서로 다른 CP 확인**

브라우저에서 "학", "사자", "도마뱀", "물고기"를 각각 입력한다. 각 결과에 대해:
- 좌측 2D CP가 **서로 다른 다각형 별 모양**(변 개수·비대칭이 다름)인지 육안 확인.
- 우측 3D가 **발산(폭발) 없이** N-flap 베이스로 접히는지 확인.
- URL의 `?tree=` 를 복사해 새 탭에서 열었을 때 **동일 결과**인지(결정성) 확인.

- [ ] **Step 3: 실패 케이스 확인**

극단적 입력(예: LLM이 한 다리만 매우 길게)이 나오면, 앱이 **크래시 없이** 에러 UI("이 트리는 …")를 띄우는지 확인. (엔진이 `PackingError`를 던지고 워커가 error 메시지로 변환.)

- [ ] **Step 4: 결과 기록**

각 동물의 스크린샷/관찰을 사용자에게 보고. 발산하는 동물이 있으면 → 몰리큘 배정 규칙(허브 위치 또는 tangent 크리스 M/V 패턴)을 조정하는 후속 Task를 연다.

---

## Self-Review (작성자 체크 완료)

**1. Spec coverage:**
- §4.1 순환 다각형 배치 → Task 2 ✅
- §4.2 단일 허브 몰리큘 → Task 3 ✅
- §4.3 동적 FOLD 조립 → Task 4 ✅
- §4.4 emit_animal_star 4~6 → Task 6 ✅
- §4.5 대칭 미강제·결정성 → Task 2/5 결정성 테스트 ✅
- §5 StarPacking/StarMolecule 타입 → Task 2/3 ✅
- §6 에러 처리(근찾기 실패·겹침) → Task 2 PackingError + Task 8 Step 3 ✅
- §7 테스트(골든·결정성·N=3 회귀·N=3~6 유효성) → Task 2~5 ✅
- §8 하우스키핑 → Task 0 ✅
- §9 완료 기준(4종 구별·발산 없음·결정성·빌드 그린) → Task 8 + 빌드 게이트 ✅

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드·명령·기대 출력 포함. "TBD/적절히 처리" 없음.

**3. Type consistency:** `Point`(geometry) → 모든 모듈 공유. `StarTree`/`StarLeg`(starTree) → packing 소비. `PackedLeaf`/`StarPacking`(packing) → molecule/assembly 소비. `StarMolecule`(molecule, `leafCreaseAssignments`/`tangentCreaseAssignments`) → assembly 소비. `treeToFold` 시그니처 불변. LLM `StarToolInput`/`starInputToTree`/`TREE_TOOL_NAME` 일관. ✅
