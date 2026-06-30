# Phase 1 — 잎 3개 트라이포드 엔진 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하드코딩된 대칭 3-leaf 트리("학" 예제)를 입력으로 받아, 브라우저(Web Worker)에서 실제 종이접기 전개도(FOLD)를 계산하고, 2D SVG로 그 CP를 표시하며, Origami Simulator(외부 iframe)에서 실제로 3D로 접히는 것까지 한 줄 파이프라인으로 동작시킨다.

**Architecture:** 순수 TypeScript 수학 엔진(`src/shared/`, `src/treemaker/` — DOM 의존성 없음, Web Worker와 vitest 양쪽에서 동일하게 동작)이 `Tree → FOLD` 변환을 담당한다. React는 이 엔진을 Worker로 감싸 호출하고, 결과 FOLD를 SVG로 그리고 외부 Origami Simulator iframe에 `postMessage`로 전달하는 얇은 글루 레이어로만 동작한다.

**Tech Stack:** TypeScript(strict), Vitest, React 18, Vite Web Worker(`type: 'module'`), Origami Simulator(Amanda Ghassaei, MIT, `https://origamisimulator.org/`, postMessage 임베드)

## 설계 근거 (리서치로 검증됨)

이 Phase의 핵심 난제는 "분기점이 하나, 잎이 3개인 대칭 트리"를 실제로 접을 수 있는 전개도로 바꾸는 작도법이다. 이는 Robert Lang의 **Universal Molecule** 알고리즘의 **N=3 기저 사례**이며, origami 문헌에서 **rabbit-ear molecule**(토끼귀 분자)이라는 이름으로 불린다. 다음 1차 출처에서 직접 확인했다:

- R. J. Lang, "A Computational Algorithm for Origami Design," *12th ACM Symposium on Computational Geometry* (SoCG), 1996 — Theorem 4 증명에서 "다각형이 변 3개면 인접하지 않은 reduced path가 없고, 세 이등분선이 한 점에서 만나 크리스 패턴이 완성된다"고 명시.
- R. J. Lang, *TreeMaker 4.0* 매뉴얼, §5.0(트리 작도법) / §5.1(M/V 배정) / §6.8(Universal Molecule 수식).
- Demaine, Fekete, Lang, "Circle Packing for Origami Design Is Hard," arXiv:1008.1224 — "branch node가 하나뿐인 star tree는 river가 없고, 최적화 문제가 단순 원 패킹으로 환원된다"를 공식화.

검증된 작도법(가중 평균에 의한 분기점, 접선점, 6개 크리스, Maekawa 정리에 의한 1개 valley→mountain 강제 전환)을 본 계획의 Task 5에 그대로 반영했다. 대칭(잎 3개, 모든 변 길이 1) 케이스로 좌표까지 수치 검증을 마쳤다(분기점 = (1, √3/3), 접선점 = 세 변의 중점).

Origami Simulator의 실제 임베드 방식도 소스코드 직접 확인으로 검증했다(`amandaghassaei/OrigamiSimulator`, MIT): `window.postMessage({op: 'importFold', fold: <FOLD 객체>}, '*')` 가 정식 메커니즘이며, 로드 완료 시 시뮬레이터가 부모 창에 `{from: 'OrigamiSimulator', status: 'ready'}`를 먼저 보낸다. 접기 진행도 슬라이더는 시뮬레이터 자체 UI(아이프레임 내부)에 이미 있으므로, Phase 1은 그 내장 UI를 그대로 사용하고 부모 페이지에서 슬라이더를 원격 제어하지 않는다(원격 제어는 Phase 4의 "소스 vendoring" 결정과 함께 재검토).

## Global Constraints

- TypeScript strict 모드, 특히 `noUncheckedIndexedAccess` 준수: 길이가 고정된 튜플 타입(`[A, B, C]`)을 사용해 구조분해를 안전하게 하고, 일반 배열 인덱싱은 항상 `undefined` 가능성을 명시적으로 체크한다. `!` 비널 단언은 같은 함수 내에서 직전에 안전성이 증명된 경우에만 사용한다.
- `src/shared/`와 `src/treemaker/`의 모든 모듈은 DOM/React/Worker API에 의존하지 않는 순수 TypeScript여야 한다(Node의 vitest 환경과 브라우저 Web Worker 양쪽에서 동일하게 동작해야 하므로).
- 모든 TreeMaker 산출 FOLD는 `validateFold()`를 통과해야 한다.
- Origami Simulator는 Phase 1에서 외부 사이트(`https://origamisimulator.org/`)를 iframe으로 그대로 사용한다(vendoring 안 함). 접기 진행도 슬라이더는 시뮬레이터 자체 내장 UI를 사용하며, 부모 페이지에서 별도로 제어하지 않는다.
- 코드 식별자(변수·함수·파일명)는 영어. 문서·커밋 메시지는 한국어 OK.
- 새 파일 추가만으로 기존 Phase 0의 테스트(8개)가 깨지지 않아야 한다(`npm test` 전체 통과가 각 Task의 완료 기준에 포함).
- 주석은 WHAT이 아니라 WHY만, 그것도 비자명한 경우에만(예: 작도 공식의 출처 — 코드만 봐서는 "왜 이 식인지" 알 수 없는 부분).

---

## Task 1: Tree 타입 + 검증 (`src/shared/tree.ts`)

**Files:**
- Create: `src/shared/tree.ts`
- Test: `src/shared/tree.test.ts`

**Interfaces:**
- Produces:
  - `interface TreeNode { id: string; label?: string }`
  - `interface TreeEdge { from: string; to: string; length: number }`
  - `interface Tree { nodes: TreeNode[]; edges: TreeEdge[] }`
  - `function validateTree(tree: Tree): void` — 중복 id, 미존재 노드 참조, 길이 ≤ 0, 트리 형태(연결됨 + 변 개수 = 노드 개수 − 1) 위반 시 설명 있는 Error throw.
  - `function leafIds(tree: Tree): string[]` — degree 1인 노드 id 목록.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/shared/tree.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { validateTree, leafIds } from './tree.js'
import type { Tree } from './tree.js'

const validStarTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

describe('validateTree', () => {
  it('does not throw for a valid star tree', () => {
    expect(() => validateTree(validStarTree)).not.toThrow()
  })

  it('throws on duplicate node ids', () => {
    const tree: Tree = {
      nodes: [{ id: 'a' }, { id: 'a' }],
      edges: [{ from: 'a', to: 'a', length: 1 }],
    }
    expect(() => validateTree(tree)).toThrow(/duplicate/)
  })

  it('throws when an edge references an unknown node', () => {
    const tree: Tree = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'ghost', length: 1 }],
    }
    expect(() => validateTree(tree)).toThrow(/unknown node/)
  })

  it('throws on non-positive edge length', () => {
    const tree: Tree = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', length: 0 }],
    }
    expect(() => validateTree(tree)).toThrow(/positive/)
  })

  it('throws when edge count does not match nodes.length - 1', () => {
    const tree: Tree = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { from: 'a', to: 'b', length: 1 },
        { from: 'b', to: 'c', length: 1 },
        { from: 'a', to: 'c', length: 1 },
      ],
    }
    expect(() => validateTree(tree)).toThrow(/nodes\.length - 1/)
  })

  it('throws when the graph is disconnected', () => {
    const tree: Tree = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      edges: [
        { from: 'a', to: 'b', length: 1 },
        { from: 'c', to: 'd', length: 1 },
      ],
    }
    expect(() => validateTree(tree)).toThrow(/connected/)
  })
})

describe('leafIds', () => {
  it('returns all degree-1 nodes for a star tree', () => {
    expect(new Set(leafIds(validStarTree))).toEqual(new Set(['leaf0', 'leaf1', 'leaf2']))
  })

  it('excludes the branch node', () => {
    expect(leafIds(validStarTree)).not.toContain('branch')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- tree`
Expected: FAIL — `Cannot find module './tree.js'`.

- [ ] **Step 3: 구현 — `src/shared/tree.ts`**

```ts
export interface TreeNode {
  id: string
  label?: string
}

export interface TreeEdge {
  from: string
  to: string
  length: number
}

export interface Tree {
  nodes: TreeNode[]
  edges: TreeEdge[]
}

export function validateTree(tree: Tree): void {
  const ids = new Set<string>()
  for (const node of tree.nodes) {
    if (ids.has(node.id)) {
      throw new Error(`duplicate node id: ${node.id}`)
    }
    ids.add(node.id)
  }
  for (const edge of tree.edges) {
    if (!ids.has(edge.from)) {
      throw new Error(`edge references unknown node: ${edge.from}`)
    }
    if (!ids.has(edge.to)) {
      throw new Error(`edge references unknown node: ${edge.to}`)
    }
    if (edge.length <= 0) {
      throw new Error(`edge length must be positive: ${edge.from}-${edge.to}`)
    }
  }

  const firstNode = tree.nodes[0]
  if (!firstNode) {
    throw new Error('tree must have at least one node')
  }
  if (tree.edges.length !== tree.nodes.length - 1) {
    throw new Error(
      `tree must have exactly nodes.length - 1 edges (got ${tree.edges.length} edges, ${tree.nodes.length} nodes)`,
    )
  }

  const adjacency = new Map<string, string[]>()
  for (const id of ids) adjacency.set(id, [])
  for (const edge of tree.edges) {
    adjacency.get(edge.from)!.push(edge.to)
    adjacency.get(edge.to)!.push(edge.from)
  }

  const visited = new Set<string>([firstNode.id])
  const queue: string[] = [firstNode.id]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }
  if (visited.size !== tree.nodes.length) {
    throw new Error('tree is not connected')
  }
}

export function leafIds(tree: Tree): string[] {
  const degree = new Map<string, number>()
  for (const node of tree.nodes) degree.set(node.id, 0)
  for (const edge of tree.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
  }
  return tree.nodes.filter((node) => degree.get(node.id) === 1).map((node) => node.id)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tree`
Expected: 8 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 기존 Phase 0 테스트(8개) + 새 테스트(8개) = 16 passed.

- [ ] **Step 6: 커밋**

```bash
git add src/shared/tree.ts src/shared/tree.test.ts
git commit -m "Phase 1/T1: Tree 타입 + validateTree/leafIds"
```

---

## Task 2: FOLD 타입 + 검증 (`src/shared/fold.ts`)

**Files:**
- Create: `src/shared/fold.ts`
- Test: `src/shared/fold.test.ts`

**Interfaces:**
- Produces:
  - `type EdgeAssignment = 'M' | 'V' | 'B' | 'F' | 'U'`
  - `interface FoldDocument { file_spec: number; file_creator: string; vertices_coords: [number, number][]; edges_vertices: [number, number][]; edges_assignment: EdgeAssignment[]; faces_vertices: number[][] }`
  - `function validateFold(fold: FoldDocument): void` — `edges_vertices`/`edges_assignment` 길이 불일치, 인덱스 범위 초과 시 Error throw.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/shared/fold.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { validateFold } from './fold.js'
import type { FoldDocument } from './fold.js'

const validTriangle: FoldDocument = {
  file_spec: 1.1,
  file_creator: 'test',
  vertices_coords: [
    [0, 0],
    [1, 0],
    [0.5, 1],
  ],
  edges_vertices: [
    [0, 1],
    [1, 2],
    [2, 0],
  ],
  edges_assignment: ['B', 'B', 'B'],
  faces_vertices: [[0, 1, 2]],
}

describe('validateFold', () => {
  it('does not throw for a valid triangle', () => {
    expect(() => validateFold(validTriangle)).not.toThrow()
  })

  it('throws when edges_vertices and edges_assignment lengths differ', () => {
    const fold: FoldDocument = { ...validTriangle, edges_assignment: ['B', 'B'] }
    expect(() => validateFold(fold)).toThrow(/length/)
  })

  it('throws when an edge references an out-of-range vertex index', () => {
    const fold: FoldDocument = {
      ...validTriangle,
      edges_vertices: [
        [0, 1],
        [1, 2],
        [2, 99],
      ],
    }
    expect(() => validateFold(fold)).toThrow(/out-of-range/)
  })

  it('throws when a face references an out-of-range vertex index', () => {
    const fold: FoldDocument = { ...validTriangle, faces_vertices: [[0, 1, 99]] }
    expect(() => validateFold(fold)).toThrow(/out-of-range/)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- fold`
Expected: FAIL — `Cannot find module './fold.js'`.

- [ ] **Step 3: 구현 — `src/shared/fold.ts`**

```ts
export type EdgeAssignment = 'M' | 'V' | 'B' | 'F' | 'U'

export interface FoldDocument {
  file_spec: number
  file_creator: string
  vertices_coords: [number, number][]
  edges_vertices: [number, number][]
  edges_assignment: EdgeAssignment[]
  faces_vertices: number[][]
}

export function validateFold(fold: FoldDocument): void {
  const vertexCount = fold.vertices_coords.length

  if (fold.edges_vertices.length !== fold.edges_assignment.length) {
    throw new Error(
      `edges_vertices length (${fold.edges_vertices.length}) must match edges_assignment length (${fold.edges_assignment.length})`,
    )
  }

  for (const [a, b] of fold.edges_vertices) {
    if (a < 0 || a >= vertexCount || b < 0 || b >= vertexCount) {
      throw new Error(`edge references out-of-range vertex index: [${a}, ${b}]`)
    }
  }

  for (const face of fold.faces_vertices) {
    for (const v of face) {
      if (v < 0 || v >= vertexCount) {
        throw new Error(`face references out-of-range vertex index: ${v}`)
      }
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- fold`
Expected: 4 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 20 passed (Phase 0의 8 + tree.test.ts의 8 + fold.test.ts의 4).

- [ ] **Step 6: 커밋**

```bash
git add src/shared/fold.ts src/shared/fold.test.ts
git commit -m "Phase 1/T2: FOLD 타입 + validateFold"
```

---

## Task 3: 그래프 거리 — Floyd-Warshall (`src/treemaker/graphDistance.ts`)

**Files:**
- Create: `src/treemaker/graphDistance.ts`
- Test: `src/treemaker/graphDistance.test.ts`

**Interfaces:**
- Consumes: `Tree` (Task 1).
- Produces: `function computeNodeDistances(tree: Tree): Map<string, Map<string, number>>` — `distances.get(idA)!.get(idB)!` 형태로 모든 노드 쌍 사이의 트리 경로 거리(간선 길이 합)를 반환.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/treemaker/graphDistance.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeNodeDistances } from './graphDistance.js'
import type { Tree } from '../shared/tree.js'

const starTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

describe('computeNodeDistances', () => {
  it('returns 0 for a node to itself', () => {
    const distances = computeNodeDistances(starTree)
    expect(distances.get('branch')?.get('branch')).toBe(0)
  })

  it('returns the direct edge length for branch-to-leaf', () => {
    const distances = computeNodeDistances(starTree)
    expect(distances.get('branch')?.get('leaf0')).toBe(1)
  })

  it('returns the summed path length for leaf-to-leaf (via branch)', () => {
    const distances = computeNodeDistances(starTree)
    expect(distances.get('leaf0')?.get('leaf1')).toBe(2)
    expect(distances.get('leaf1')?.get('leaf2')).toBe(2)
  })

  it('is symmetric', () => {
    const distances = computeNodeDistances(starTree)
    expect(distances.get('leaf0')?.get('leaf1')).toBe(distances.get('leaf1')?.get('leaf0'))
  })

  it('handles asymmetric edge lengths correctly', () => {
    const tree: Tree = {
      nodes: [{ id: 'branch' }, { id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { from: 'branch', to: 'a', length: 1 },
        { from: 'branch', to: 'b', length: 2 },
        { from: 'branch', to: 'c', length: 3 },
      ],
    }
    const distances = computeNodeDistances(tree)
    expect(distances.get('a')?.get('b')).toBe(3)
    expect(distances.get('b')?.get('c')).toBe(5)
    expect(distances.get('a')?.get('c')).toBe(4)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- graphDistance`
Expected: FAIL — `Cannot find module './graphDistance.js'`.

- [ ] **Step 3: 구현 — `src/treemaker/graphDistance.ts`**

```ts
import type { Tree } from '../shared/tree.js'

export function computeNodeDistances(tree: Tree): Map<string, Map<string, number>> {
  const ids = tree.nodes.map((node) => node.id)

  const dist = new Map<string, Map<string, number>>()
  for (const i of ids) {
    const row = new Map<string, number>()
    for (const j of ids) row.set(j, i === j ? 0 : Infinity)
    dist.set(i, row)
  }

  for (const edge of tree.edges) {
    dist.get(edge.from)!.set(edge.to, edge.length)
    dist.get(edge.to)!.set(edge.from, edge.length)
  }

  for (const k of ids) {
    for (const i of ids) {
      for (const j of ids) {
        const viaK = dist.get(i)!.get(k)! + dist.get(k)!.get(j)!
        if (viaK < dist.get(i)!.get(j)!) {
          dist.get(i)!.set(j, viaK)
        }
      }
    }
  }

  return dist
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- graphDistance`
Expected: 5 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 25 passed.

- [ ] **Step 6: 커밋**

```bash
git add src/treemaker/graphDistance.ts src/treemaker/graphDistance.test.ts
git commit -m "Phase 1/T3: 그래프 거리 (Floyd-Warshall)"
```

---

## Task 4: 트라이포드 삼각형 작도 (`src/treemaker/starTripod.ts`)

이 Task는 "분기점 하나 + 잎 3개" 트리의 **잎 위치**를 결정한다. 일반적인 N-leaf 원 패킹(NLP 최적화, NP-hard — Demaine·Fekete·Lang 2010)을 Phase 3로 미루고, N=3 단일 분기 케이스에 한해 **닫힌 형식(SSS 삼각형 작도)**으로 해결한다: 세 잎의 원이 서로 외접한다고 하면 잎 i, j 사이 거리는 정확히 `e_i + e_j`(두 변 길이의 합)이므로, 변 길이가 `(e0+e1), (e1+e2), (e2+e0)` 인 삼각형을 SSS로 작도하면 된다. 임의의 양수 `e0,e1,e2`에 대해 이 세 변 길이는 항상 삼각부등식을 만족한다(예: `(e0+e1)+(e0+e2) = 2e0+e1+e2 > e1+e2`, `e0>0`이므로 항상 성립) — 따라서 이 함수는 기하학적으로 실패하지 않는다.

**Files:**
- Create: `src/treemaker/starTripod.ts`
- Test: `src/treemaker/starTripod.test.ts`

**Interfaces:**
- Consumes: `Tree`, `leafIds` (Task 1).
- Produces:
  - `interface Point { x: number; y: number }`
  - `interface StarTripodLeaf { id: string; edgeLength: number; position: Point }`
  - `interface StarTripod { branchNodeId: string; leaves: [StarTripodLeaf, StarTripodLeaf, StarTripodLeaf] }`
  - `function buildStarTripod(tree: Tree): StarTripod` — 정확히 잎 3개 + 분기 노드 1개(분기 노드가 모든 잎에 직접 연결)인 트리만 허용. 그렇지 않으면 설명 있는 Error throw.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/treemaker/starTripod.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildStarTripod } from './starTripod.js'
import type { Tree } from '../shared/tree.js'

const symmetricTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

describe('buildStarTripod', () => {
  it('identifies the branch node correctly', () => {
    const tripod = buildStarTripod(symmetricTree)
    expect(tripod.branchNodeId).toBe('branch')
  })

  it('places the 3 leaves at known coordinates for the symmetric case (matches Lang SoCG96 worked example)', () => {
    const tripod = buildStarTripod(symmetricTree)
    const [l0, l1, l2] = tripod.leaves
    expect(l0.position).toEqual({ x: 0, y: 0 })
    expect(l1.position).toEqual({ x: 2, y: 0 })
    expect(l2.position.x).toBeCloseTo(1, 9)
    expect(l2.position.y).toBeCloseTo(Math.sqrt(3), 9)
  })

  it('produces pairwise leaf distances equal to the sum of the two edge lengths', () => {
    const tripod = buildStarTripod(symmetricTree)
    const [l0, l1, l2] = tripod.leaves
    function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    expect(dist(l0.position, l1.position)).toBeCloseTo(l0.edgeLength + l1.edgeLength, 9)
    expect(dist(l1.position, l2.position)).toBeCloseTo(l1.edgeLength + l2.edgeLength, 9)
    expect(dist(l2.position, l0.position)).toBeCloseTo(l2.edgeLength + l0.edgeLength, 9)
  })

  it('handles asymmetric edge lengths while preserving the pairwise-distance invariant', () => {
    const tree: Tree = {
      nodes: [{ id: 'branch' }, { id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { from: 'branch', to: 'a', length: 1 },
        { from: 'branch', to: 'b', length: 2 },
        { from: 'branch', to: 'c', length: 1.5 },
      ],
    }
    const tripod = buildStarTripod(tree)
    const [l0, l1, l2] = tripod.leaves
    function dist(p: { x: number; y: number }, q: { x: number; y: number }): number {
      return Math.hypot(p.x - q.x, p.y - q.y)
    }
    expect(dist(l0.position, l1.position)).toBeCloseTo(l0.edgeLength + l1.edgeLength, 9)
    expect(dist(l1.position, l2.position)).toBeCloseTo(l1.edgeLength + l2.edgeLength, 9)
    expect(dist(l2.position, l0.position)).toBeCloseTo(l2.edgeLength + l0.edgeLength, 9)
  })

  it('throws when the tree does not have exactly 3 leaves', () => {
    const tree: Tree = {
      nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }],
      edges: [
        { from: 'branch', to: 'leaf0', length: 1 },
        { from: 'branch', to: 'leaf1', length: 1 },
      ],
    }
    expect(() => buildStarTripod(tree)).toThrow(/exactly 3 leaves/)
  })

  it('throws when there is more than one branch node', () => {
    const tree: Tree = {
      nodes: [{ id: 'b1' }, { id: 'b2' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
      edges: [
        { from: 'b1', to: 'b2', length: 1 },
        { from: 'b2', to: 'leaf0', length: 1 },
        { from: 'b2', to: 'leaf1', length: 1 },
        { from: 'b1', to: 'leaf2', length: 1 },
      ],
    }
    expect(() => buildStarTripod(tree)).toThrow(/exactly 1 branch node/)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- starTripod`
Expected: FAIL — `Cannot find module './starTripod.js'`.

- [ ] **Step 3: 구현 — `src/treemaker/starTripod.ts`**

```ts
import type { Tree } from '../shared/tree.js'
import { leafIds } from '../shared/tree.js'

export interface Point {
  x: number
  y: number
}

export interface StarTripodLeaf {
  id: string
  edgeLength: number
  position: Point
}

export interface StarTripod {
  branchNodeId: string
  leaves: [StarTripodLeaf, StarTripodLeaf, StarTripodLeaf]
}

export function buildStarTripod(tree: Tree): StarTripod {
  const leaves = leafIds(tree)
  if (leaves.length !== 3) {
    throw new Error(`buildStarTripod requires exactly 3 leaves, got ${leaves.length}`)
  }
  const id0 = leaves[0]
  const id1 = leaves[1]
  const id2 = leaves[2]
  if (id0 === undefined || id1 === undefined || id2 === undefined) {
    throw new Error('unreachable: leaves.length === 3 but indexing returned undefined')
  }

  const nonLeafNodes = tree.nodes.filter((node) => !leaves.includes(node.id))
  if (nonLeafNodes.length !== 1) {
    throw new Error(`buildStarTripod requires exactly 1 branch node, got ${nonLeafNodes.length}`)
  }
  const branchNode = nonLeafNodes[0]
  if (!branchNode) {
    throw new Error('unreachable: nonLeafNodes.length === 1 but indexing returned undefined')
  }
  const branchNodeId = branchNode.id

  const edgesByLeaf = new Map<string, number>()
  for (const edge of tree.edges) {
    if (edge.from === branchNodeId && leaves.includes(edge.to)) {
      edgesByLeaf.set(edge.to, edge.length)
    } else if (edge.to === branchNodeId && leaves.includes(edge.from)) {
      edgesByLeaf.set(edge.from, edge.length)
    } else {
      throw new Error(
        `buildStarTripod requires every edge to connect the branch node directly to a leaf; offending edge: ${edge.from}-${edge.to}`,
      )
    }
  }

  const e0 = edgesByLeaf.get(id0)
  const e1 = edgesByLeaf.get(id1)
  const e2 = edgesByLeaf.get(id2)
  if (e0 === undefined || e1 === undefined || e2 === undefined) {
    throw new Error('buildStarTripod: branch node is not connected to all 3 leaves')
  }

  // 잎 i, j 사이의 거리는 그 두 잎의 원이 외접한다고 가정하면 e_i + e_j다 (Lang SoCG96 Theorem 2).
  // 따라서 세 변의 길이가 (e0+e1, e1+e2, e2+e0)인 삼각형을 SSS로 작도하면
  // 트리 거리 제약을 정확히 만족하는 잎 배치가 나온다.
  const d01 = e0 + e1
  const d02 = e0 + e2
  const d12 = e1 + e2

  const p0: Point = { x: 0, y: 0 }
  const p1: Point = { x: d01, y: 0 }
  const x2 = (d01 * d01 + d02 * d02 - d12 * d12) / (2 * d01)
  const y2 = Math.sqrt(Math.max(0, d02 * d02 - x2 * x2))
  const p2: Point = { x: x2, y: y2 }

  return {
    branchNodeId,
    leaves: [
      { id: id0, edgeLength: e0, position: p0 },
      { id: id1, edgeLength: e1, position: p1 },
      { id: id2, edgeLength: e2, position: p2 },
    ],
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- starTripod`
Expected: 6 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 31 passed.

- [ ] **Step 6: 커밋**

```bash
git add src/treemaker/starTripod.ts src/treemaker/starTripod.test.ts
git commit -m "Phase 1/T4: 트라이포드 삼각형 작도 (SSS, N=3 닫힌 형식)"
```

---

## Task 5: Rabbit-Ear Molecule 작도 (`src/treemaker/rabbitEarMolecule.ts`)

**가장 핵심적이고 리스크가 높았던 Task.** Lang의 SoCG96 §5.1 + TreeMaker 매뉴얼 §6.8에서 검증한 공식을 그대로 구현한다.

- 분기점 `E` = 세 꼭짓점을 "반대편 변에 인접한 두 트리 변 길이의 합"으로 가중평균한 점: `E = [p0·(e1+e2) + p1·(e2+e0) + p2·(e0+e1)] / [2·(e0+e1+e2)]`.
- 접선점 `T_ij`는 변 `i-j`를 `e_i : e_j` 비율로 내분하는 점.
- `E`에서 각 잎으로 가는 3개 크리스(이등분선)는 **mountain**, `E`에서 각 접선점으로 가는 3개 크리스는 **valley**.
- 위 배정 그대로면 `E`에서 mountain 3개·valley 3개라 Maekawa 정리(`|M−V|=2`)를 어긴다. Lang 자신도 이 지점에서 "어느 valley를 mountain으로 바꿀지는 결정해주지 않는다"고 명시했으므로, 결정성 있는 임의 선택으로 **항상 첫 번째 접선점(`T01`) 방향을 valley→mountain으로 강제 전환**한다.

**Files:**
- Create: `src/treemaker/rabbitEarMolecule.ts`
- Test: `src/treemaker/rabbitEarMolecule.test.ts`

**Interfaces:**
- Consumes: `Point`, `StarTripodLeaf`, `buildStarTripod` (Task 4), `EdgeAssignment` (Task 2).
- Produces:
  - `interface MoleculeCrease { from: Point; to: Point; assignment: EdgeAssignment }`
  - `interface RabbitEarMolecule { branchPoint: Point; tangentPoints: [Point, Point, Point]; creases: MoleculeCrease[] }`
  - `function buildRabbitEarMolecule(leaves: [StarTripodLeaf, StarTripodLeaf, StarTripodLeaf]): RabbitEarMolecule` — 항상 6개 크리스 반환. 모든 크리스의 `from`은 `branchPoint`와 동일한 객체 참조(reference equality)다 — 이는 다음 Task(FOLD 조립)가 부동소수점 비교 없이 객체 동일성만으로 정점을 식별할 수 있게 하기 위한 의도적 설계다.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/treemaker/rabbitEarMolecule.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildStarTripod } from './starTripod.js'
import { buildRabbitEarMolecule } from './rabbitEarMolecule.js'
import type { Tree } from '../shared/tree.js'

const symmetricTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

describe('buildRabbitEarMolecule', () => {
  it('places the branch point at the known centroid for the symmetric case', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    expect(molecule.branchPoint.x).toBeCloseTo(1, 9)
    expect(molecule.branchPoint.y).toBeCloseTo(Math.sqrt(3) / 3, 9)
  })

  it('places tangent points at the known side midpoints for the symmetric case', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    const [t01, t12, t20] = molecule.tangentPoints
    expect(t01.x).toBeCloseTo(1, 9)
    expect(t01.y).toBeCloseTo(0, 9)
    expect(t12.x).toBeCloseTo(1.5, 9)
    expect(t12.y).toBeCloseTo(Math.sqrt(3) / 2, 9)
    expect(t20.x).toBeCloseTo(0.5, 9)
    expect(t20.y).toBeCloseTo(Math.sqrt(3) / 2, 9)
  })

  it('produces exactly 6 creases, all originating from the branch point (by reference)', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    expect(molecule.creases).toHaveLength(6)
    for (const crease of molecule.creases) {
      expect(crease.from).toBe(molecule.branchPoint)
    }
  })

  it('satisfies the Kawasaki theorem at the branch point (alternating angle sums equal 180 degrees)', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    const center = molecule.branchPoint
    const rayAngles = molecule.creases
      .map((crease) => Math.atan2(crease.to.y - center.y, crease.to.x - center.x))
      .sort((a, b) => a - b)

    const stepAngles: number[] = []
    for (let i = 0; i < rayAngles.length; i++) {
      const current = rayAngles[i]
      const next = rayAngles[(i + 1) % rayAngles.length]
      if (current === undefined || next === undefined) continue
      const diff = next > current ? next - current : next - current + 2 * Math.PI
      stepAngles.push((diff * 180) / Math.PI)
    }

    const total = stepAngles.reduce((sum, a) => sum + a, 0)
    expect(total).toBeCloseTo(360, 6)

    const oddSum = (stepAngles[0] ?? 0) + (stepAngles[2] ?? 0) + (stepAngles[4] ?? 0)
    const evenSum = (stepAngles[1] ?? 0) + (stepAngles[3] ?? 0) + (stepAngles[5] ?? 0)
    expect(oddSum).toBeCloseTo(180, 6)
    expect(evenSum).toBeCloseTo(180, 6)
  })

  it('satisfies the Maekawa theorem at the branch point (|mountain - valley| === 2)', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    const mountainCount = molecule.creases.filter((c) => c.assignment === 'M').length
    const valleyCount = molecule.creases.filter((c) => c.assignment === 'V').length
    expect(Math.abs(mountainCount - valleyCount)).toBe(2)
  })

  it('each crease length matches its endpoint distance exactly', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    for (const crease of molecule.creases) {
      const dx = crease.to.x - crease.from.x
      const dy = crease.to.y - crease.from.y
      expect(Math.hypot(dx, dy)).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- rabbitEarMolecule`
Expected: FAIL — `Cannot find module './rabbitEarMolecule.js'`.

- [ ] **Step 3: 구현 — `src/treemaker/rabbitEarMolecule.ts`**

```ts
import type { Point, StarTripodLeaf } from './starTripod.js'
import type { EdgeAssignment } from '../shared/fold.js'

export interface MoleculeCrease {
  from: Point
  to: Point
  assignment: EdgeAssignment
}

export interface RabbitEarMolecule {
  branchPoint: Point
  tangentPoints: [Point, Point, Point]
  creases: MoleculeCrease[]
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function buildRabbitEarMolecule(
  leaves: [StarTripodLeaf, StarTripodLeaf, StarTripodLeaf],
): RabbitEarMolecule {
  const [l0, l1, l2] = leaves
  const a = l0.edgeLength
  const b = l1.edgeLength
  const c = l2.edgeLength
  const sum = a + b + c

  // Lang, SoCG96 p.5 / TreeMaker 매뉴얼 §5.0: 삼각형의 세 이등분선이 만나는 점은
  // 각 꼭짓점을 "그 꼭짓점에 닿지 않는 두 변 길이의 합"으로 가중평균한 점이다.
  const branchPoint: Point = {
    x: (l0.position.x * (b + c) + l1.position.x * (c + a) + l2.position.x * (a + b)) / (2 * sum),
    y: (l0.position.y * (b + c) + l1.position.y * (c + a) + l2.position.y * (a + b)) / (2 * sum),
  }

  const t01 = lerp(l0.position, l1.position, a / (a + b))
  const t12 = lerp(l1.position, l2.position, b / (b + c))
  const t20 = lerp(l2.position, l0.position, c / (c + a))

  const creases: MoleculeCrease[] = [
    { from: branchPoint, to: l0.position, assignment: 'M' },
    { from: branchPoint, to: l1.position, assignment: 'M' },
    { from: branchPoint, to: l2.position, assignment: 'M' },
    // Maekawa 정리(|M-V|=2)를 만족시키려면 valley 3개 중 하나를 mountain으로 바꿔야 한다.
    // Lang 자신도 "어느 것을 바꿀지는 정해주지 않는다"고 명시했으므로(TreeMaker 매뉴얼 Tutorial 1),
    // 결정성을 위해 항상 t01 방향을 바꾼다.
    { from: branchPoint, to: t01, assignment: 'M' },
    { from: branchPoint, to: t12, assignment: 'V' },
    { from: branchPoint, to: t20, assignment: 'V' },
  ]

  return { branchPoint, tangentPoints: [t01, t12, t20], creases }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- rabbitEarMolecule`
Expected: 6 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 37 passed.

- [ ] **Step 6: 커밋**

```bash
git add src/treemaker/rabbitEarMolecule.ts src/treemaker/rabbitEarMolecule.test.ts
git commit -m "Phase 1/T5: Rabbit-ear molecule 작도 (Lang SoCG96 검증)"
```

---

## Task 6: FOLD 조립 (`src/treemaker/foldAssembly.ts`)

7개 정점(잎 3 + 분기점 1 + 접선점 3), 12개 간선(경계 6 + 내부 크리스 6), 6개 삼각형 면으로 조립한다. 정점 식별은 부동소수점 비교가 아니라 **객체 참조 동일성**(`Map<Point, number>`)으로 한다 — Task 5에서 모든 크리스가 `branchPoint`/`tangentPoints`/잎의 `position`과 동일한 객체 참조를 쓰도록 설계했기 때문에 안전하다.

**Files:**
- Create: `src/treemaker/foldAssembly.ts`
- Test: `src/treemaker/foldAssembly.test.ts`

**Interfaces:**
- Consumes: `Point`, `StarTripod` (Task 4), `RabbitEarMolecule` (Task 5), `FoldDocument`, `EdgeAssignment`, `validateFold` (Task 2).
- Produces: `function assembleFold(tripod: StarTripod, molecule: RabbitEarMolecule): FoldDocument`.

- [ ] **Step 1: 실패하는 테스트 작성 — `src/treemaker/foldAssembly.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildStarTripod } from './starTripod.js'
import { buildRabbitEarMolecule } from './rabbitEarMolecule.js'
import { assembleFold } from './foldAssembly.js'
import { validateFold } from '../shared/fold.js'
import type { Tree } from '../shared/tree.js'

const symmetricTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

function buildSymmetricFold() {
  const tripod = buildStarTripod(symmetricTree)
  const molecule = buildRabbitEarMolecule(tripod.leaves)
  return assembleFold(tripod, molecule)
}

describe('assembleFold', () => {
  it('produces a FOLD document that passes validateFold', () => {
    const fold = buildSymmetricFold()
    expect(() => validateFold(fold)).not.toThrow()
  })

  it('produces exactly 7 vertices', () => {
    expect(buildSymmetricFold().vertices_coords).toHaveLength(7)
  })

  it('produces exactly 12 edges (6 boundary + 6 interior creases)', () => {
    const fold = buildSymmetricFold()
    expect(fold.edges_vertices).toHaveLength(12)
    expect(fold.edges_assignment).toHaveLength(12)
  })

  it('produces exactly 6 boundary-assigned edges', () => {
    const fold = buildSymmetricFold()
    expect(fold.edges_assignment.filter((a) => a === 'B')).toHaveLength(6)
  })

  it('produces exactly 6 triangular faces', () => {
    const fold = buildSymmetricFold()
    expect(fold.faces_vertices).toHaveLength(6)
    for (const face of fold.faces_vertices) {
      expect(face).toHaveLength(3)
    }
  })

  it('satisfies Euler characteristic V - E + F = 2 (counting the outer face)', () => {
    const fold = buildSymmetricFold()
    const V = fold.vertices_coords.length
    const E = fold.edges_vertices.length
    const F = fold.faces_vertices.length + 1 // +1 for the outer unbounded face
    expect(V - E + F).toBe(2)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- foldAssembly`
Expected: FAIL — `Cannot find module './foldAssembly.js'`.

- [ ] **Step 3: 구현 — `src/treemaker/foldAssembly.ts`**

```ts
import type { FoldDocument, EdgeAssignment } from '../shared/fold.js'
import type { Point, StarTripod } from './starTripod.js'
import type { RabbitEarMolecule } from './rabbitEarMolecule.js'

export function assembleFold(tripod: StarTripod, molecule: RabbitEarMolecule): FoldDocument {
  const [l0, l1, l2] = tripod.leaves
  const [t01, t12, t20] = molecule.tangentPoints
  const branchPoint = molecule.branchPoint

  const vertexOrder: Point[] = [l0.position, l1.position, l2.position, branchPoint, t01, t12, t20]
  const indexOf = new Map<Point, number>()
  vertexOrder.forEach((point, index) => indexOf.set(point, index))

  function indexOfPoint(point: Point): number {
    const index = indexOf.get(point)
    if (index === undefined) {
      throw new Error('assembleFold: point not found in vertex list')
    }
    return index
  }

  const vertices_coords: [number, number][] = vertexOrder.map((p) => [p.x, p.y])
  const edges_vertices: [number, number][] = []
  const edges_assignment: EdgeAssignment[] = []

  function addEdge(a: Point, b: Point, assignment: EdgeAssignment): void {
    edges_vertices.push([indexOfPoint(a), indexOfPoint(b)])
    edges_assignment.push(assignment)
  }

  // 경계: 삼각형의 세 변을 각 접선점에서 둘로 나눈다.
  addEdge(l0.position, t01, 'B')
  addEdge(t01, l1.position, 'B')
  addEdge(l1.position, t12, 'B')
  addEdge(t12, l2.position, 'B')
  addEdge(l2.position, t20, 'B')
  addEdge(t20, l0.position, 'B')

  // 내부 크리스: 분기점에서 뻗어나가는 6개.
  for (const crease of molecule.creases) {
    addEdge(crease.from, crease.to, crease.assignment)
  }

  const faces_vertices: number[][] = [
    [indexOfPoint(l0.position), indexOfPoint(t01), indexOfPoint(branchPoint)],
    [indexOfPoint(t01), indexOfPoint(l1.position), indexOfPoint(branchPoint)],
    [indexOfPoint(l1.position), indexOfPoint(t12), indexOfPoint(branchPoint)],
    [indexOfPoint(t12), indexOfPoint(l2.position), indexOfPoint(branchPoint)],
    [indexOfPoint(l2.position), indexOfPoint(t20), indexOfPoint(branchPoint)],
    [indexOfPoint(t20), indexOfPoint(l0.position), indexOfPoint(branchPoint)],
  ]

  return {
    file_spec: 1.1,
    file_creator: 'origami-app TreeMaker engine (Phase 1)',
    vertices_coords,
    edges_vertices,
    edges_assignment,
    faces_vertices,
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- foldAssembly`
Expected: 6 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 43 passed.

- [ ] **Step 6: 커밋**

```bash
git add src/treemaker/foldAssembly.ts src/treemaker/foldAssembly.test.ts
git commit -m "Phase 1/T6: FOLD 조립 (7정점/12간선/6면)"
```

---

## Task 7: TreeMaker 오케스트레이터 (`src/treemaker/treemaker.ts`)

**Files:**
- Create: `src/treemaker/treemaker.ts`
- Test: `src/treemaker/treemaker.test.ts`

**Interfaces:**
- Consumes: `Tree`, `validateTree` (Task 1), `FoldDocument`, `validateFold` (Task 2), `buildStarTripod` (Task 4), `buildRabbitEarMolecule` (Task 5), `assembleFold` (Task 6).
- Produces: `function treeToFold(tree: Tree): FoldDocument` — `validateTree → buildStarTripod → buildRabbitEarMolecule → assembleFold → validateFold` 순서로 실행하고 최종 FOLD를 반환. 같은 입력에 대해 항상 동일한 출력(결정적).

- [ ] **Step 1: 실패하는 테스트 작성 — `src/treemaker/treemaker.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { treeToFold } from './treemaker.js'
import type { Tree } from '../shared/tree.js'

const symmetricTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

describe('treeToFold', () => {
  it('produces a valid FOLD document end-to-end', () => {
    const fold = treeToFold(symmetricTree)
    expect(fold.vertices_coords).toHaveLength(7)
    expect(fold.faces_vertices).toHaveLength(6)
  })

  it('is deterministic — same input produces structurally identical output', () => {
    const foldA = treeToFold(symmetricTree)
    const foldB = treeToFold(symmetricTree)
    expect(foldA).toEqual(foldB)
  })

  it('propagates tree validation errors (e.g. disconnected tree)', () => {
    const brokenTree: Tree = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      edges: [
        { from: 'a', to: 'b', length: 1 },
        { from: 'c', to: 'd', length: 1 },
      ],
    }
    expect(() => treeToFold(brokenTree)).toThrow(/connected/)
  })

  it('propagates star-tripod shape errors (e.g. wrong leaf count)', () => {
    const wrongShape: Tree = {
      nodes: [{ id: 'branch' }, { id: 'leaf0' }],
      edges: [{ from: 'branch', to: 'leaf0', length: 1 }],
    }
    expect(() => treeToFold(wrongShape)).toThrow(/exactly 3 leaves/)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- treemaker.test`
Expected: FAIL — `Cannot find module './treemaker.js'`.

- [ ] **Step 3: 구현 — `src/treemaker/treemaker.ts`**

```ts
import { validateTree } from '../shared/tree.js'
import { validateFold } from '../shared/fold.js'
import type { Tree } from '../shared/tree.js'
import type { FoldDocument } from '../shared/fold.js'
import { buildStarTripod } from './starTripod.js'
import { buildRabbitEarMolecule } from './rabbitEarMolecule.js'
import { assembleFold } from './foldAssembly.js'

export function treeToFold(tree: Tree): FoldDocument {
  validateTree(tree)
  const tripod = buildStarTripod(tree)
  const molecule = buildRabbitEarMolecule(tripod.leaves)
  const fold = assembleFold(tripod, molecule)
  validateFold(fold)
  return fold
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- treemaker.test`
Expected: 4 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 47 passed.

- [ ] **Step 6: 커밋**

```bash
git add src/treemaker/treemaker.ts src/treemaker/treemaker.test.ts
git commit -m "Phase 1/T7: TreeMaker 오케스트레이터 (Tree -> FOLD)"
```

---

## Task 8: 학 예제 트리 + End-to-End 스모크 테스트 (`src/client/cpData/craneTree.ts`)

**Files:**
- Create: `src/client/cpData/craneTree.ts`
- Test: `src/client/cpData/craneTree.test.ts`

**Interfaces:**
- Consumes: `Tree` (Task 1), `treeToFold` (Task 7).
- Produces: `const craneTree: Tree` — 대칭 3-leaf 예제(분기 노드 1개 + 잎 3개, 모든 간선 길이 1).

- [ ] **Step 1: 실패하는 테스트 작성 — `src/client/cpData/craneTree.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { craneTree } from './craneTree.js'
import { treeToFold } from '../../treemaker/treemaker.js'
import { validateFold } from '../../shared/fold.js'

describe('craneTree', () => {
  it('has exactly 1 branch node and 3 leaves', () => {
    expect(craneTree.nodes).toHaveLength(4)
    expect(craneTree.edges).toHaveLength(3)
  })

  it('produces a valid FOLD via the full treeToFold pipeline', () => {
    const fold = treeToFold(craneTree)
    expect(() => validateFold(fold)).not.toThrow()
    expect(fold.vertices_coords).toHaveLength(7)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- craneTree`
Expected: FAIL — `Cannot find module './craneTree.js'`.

- [ ] **Step 3: 구현 — `src/client/cpData/craneTree.ts`**

```ts
import type { Tree } from '../../shared/tree.js'

export const craneTree: Tree = {
  nodes: [
    { id: 'branch', label: 'body' },
    { id: 'leaf-a', label: 'wing-a' },
    { id: 'leaf-b', label: 'wing-b' },
    { id: 'leaf-c', label: 'head-tail' },
  ],
  edges: [
    { from: 'branch', to: 'leaf-a', length: 1 },
    { from: 'branch', to: 'leaf-b', length: 1 },
    { from: 'branch', to: 'leaf-c', length: 1 },
  ],
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- craneTree`
Expected: 2 passed, 0 failed.

- [ ] **Step 5: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 49 passed.

- [ ] **Step 6: 커밋**

```bash
git add src/client/cpData/craneTree.ts src/client/cpData/craneTree.test.ts
git commit -m "Phase 1/T8: 학 예제 트리 + end-to-end 스모크 테스트"
```

---

## Task 9: 2D CP SVG 렌더러 (`src/client/components/foldToSvgPaths.ts` + `CPCanvas.tsx`)

로직(좌표 → SVG 세그먼트 변환)은 순수 함수로 분리해 vitest로 테스트하고, React 컴포넌트는 그 결과를 그대로 그리는 얇은 래퍼로만 둔다.

**Files:**
- Create: `src/client/components/foldToSvgPaths.ts`
- Test: `src/client/components/foldToSvgPaths.test.ts`
- Create: `src/client/components/CPCanvas.tsx`

**Interfaces:**
- Consumes: `FoldDocument`, `EdgeAssignment` (Task 2).
- Produces:
  - `interface SvgSegment { x1: number; y1: number; x2: number; y2: number; stroke: string; strokeDasharray?: string }`
  - `function foldToSvgSegments(fold: FoldDocument): SvgSegment[]` — mountain 빨강 실선, valley 파랑 점선, boundary 검정 실선.
  - `function computeViewBox(fold: FoldDocument, padding: number): { minX: number; minY: number; width: number; height: number }`
  - `function CPCanvas(props: { fold: FoldDocument }): JSX.Element`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/client/components/foldToSvgPaths.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { foldToSvgSegments, computeViewBox } from './foldToSvgPaths.js'
import type { FoldDocument } from '../../shared/fold.js'

const sampleFold: FoldDocument = {
  file_spec: 1.1,
  file_creator: 'test',
  vertices_coords: [
    [0, 0],
    [2, 0],
    [1, 1],
  ],
  edges_vertices: [
    [0, 1],
    [1, 2],
    [2, 0],
  ],
  edges_assignment: ['M', 'V', 'B'],
  faces_vertices: [[0, 1, 2]],
}

describe('foldToSvgSegments', () => {
  it('produces one segment per edge', () => {
    expect(foldToSvgSegments(sampleFold)).toHaveLength(3)
  })

  it('colors mountain creases red', () => {
    const [mountain] = foldToSvgSegments(sampleFold)
    expect(mountain?.stroke).toBe('#d33')
  })

  it('colors valley creases blue with a dash pattern', () => {
    const segments = foldToSvgSegments(sampleFold)
    expect(segments[1]?.stroke).toBe('#33d')
    expect(segments[1]?.strokeDasharray).toBeDefined()
  })

  it('colors boundary edges black with no dash pattern', () => {
    const segments = foldToSvgSegments(sampleFold)
    expect(segments[2]?.stroke).toBe('#111')
    expect(segments[2]?.strokeDasharray).toBeUndefined()
  })

  it('maps endpoint coordinates correctly', () => {
    const [mountain] = foldToSvgSegments(sampleFold)
    expect(mountain).toMatchObject({ x1: 0, y1: 0, x2: 2, y2: 0 })
  })
})

describe('computeViewBox', () => {
  it('computes a bounding box with padding around all vertices', () => {
    const viewBox = computeViewBox(sampleFold, 0.5)
    expect(viewBox.minX).toBeCloseTo(-0.5, 9)
    expect(viewBox.minY).toBeCloseTo(-0.5, 9)
    expect(viewBox.width).toBeCloseTo(3, 9)
    expect(viewBox.height).toBeCloseTo(2, 9)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- foldToSvgPaths`
Expected: FAIL — `Cannot find module './foldToSvgPaths.js'`.

- [ ] **Step 3: 구현 — `src/client/components/foldToSvgPaths.ts`**

```ts
import type { FoldDocument, EdgeAssignment } from '../../shared/fold.js'

export interface SvgSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  strokeDasharray?: string
}

const STROKE_BY_ASSIGNMENT: Record<EdgeAssignment, string> = {
  M: '#d33',
  V: '#33d',
  B: '#111',
  F: '#999',
  U: '#999',
}

export function foldToSvgSegments(fold: FoldDocument): SvgSegment[] {
  return fold.edges_vertices.map(([a, b], index) => {
    const assignment = fold.edges_assignment[index]
    if (assignment === undefined) {
      throw new Error(`foldToSvgSegments: missing edges_assignment at index ${index}`)
    }
    const coordsA = fold.vertices_coords[a]
    const coordsB = fold.vertices_coords[b]
    if (coordsA === undefined || coordsB === undefined) {
      throw new Error('foldToSvgSegments: edge references missing vertex coordinates')
    }
    const [x1, y1] = coordsA
    const [x2, y2] = coordsB
    return {
      x1,
      y1,
      x2,
      y2,
      stroke: STROKE_BY_ASSIGNMENT[assignment],
      strokeDasharray: assignment === 'V' ? '0.05,0.05' : undefined,
    }
  })
}

export function computeViewBox(
  fold: FoldDocument,
  padding: number,
): { minX: number; minY: number; width: number; height: number } {
  const xs = fold.vertices_coords.map(([x]) => x)
  const ys = fold.vertices_coords.map(([, y]) => y)
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const maxX = Math.max(...xs) + padding
  const maxY = Math.max(...ys) + padding
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- foldToSvgPaths`
Expected: 6 passed, 0 failed.

- [ ] **Step 5: React 컴포넌트 작성 (테스트 없음 — 얇은 글루, 최종 Task의 수동 브라우저 검증으로 커버) — `src/client/components/CPCanvas.tsx`**

```tsx
import type { FoldDocument } from '../../shared/fold.js'
import { foldToSvgSegments, computeViewBox } from './foldToSvgPaths.js'

export interface CPCanvasProps {
  fold: FoldDocument
}

export function CPCanvas({ fold }: CPCanvasProps) {
  const segments = foldToSvgSegments(fold)
  const viewBox = computeViewBox(fold, 0.2)
  return (
    <svg
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      style={{ width: '100%', height: '100%', background: '#fff' }}
    >
      {segments.map((segment, index) => (
        <line
          key={index}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={segment.stroke}
          strokeWidth={0.02}
          strokeDasharray={segment.strokeDasharray}
        />
      ))}
    </svg>
  )
}
```

- [ ] **Step 6: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 55 passed.

- [ ] **Step 7: 커밋**

```bash
git add src/client/components/foldToSvgPaths.ts src/client/components/foldToSvgPaths.test.ts src/client/components/CPCanvas.tsx
git commit -m "Phase 1/T9: 2D CP SVG 렌더러"
```

---

## Task 10: Origami Simulator 3D 임베드 (`src/client/components/foldSimulatorMessage.ts` + `FoldSimulator.tsx`)

`amandaghassaei/OrigamiSimulator` 소스코드(`js/importer.js:210-237`, MIT 라이센스)를 직접 읽고 검증한 메시지 프로토콜을 그대로 구현한다: 시뮬레이터가 로드되면 부모 창에 `{from: 'OrigamiSimulator', status: 'ready'}`를 먼저 보내고, 부모는 그 신호를 받은 뒤 `{op: 'importFold', fold: <FoldDocument>}`를 `postMessage`로 보낸다. 접기 진행도 슬라이더는 시뮬레이터 자체 내장 UI를 그대로 쓴다(Phase 1 범위 밖 — Global Constraints 참조).

**Files:**
- Create: `src/client/components/foldSimulatorMessage.ts`
- Test: `src/client/components/foldSimulatorMessage.test.ts`
- Create: `src/client/components/FoldSimulator.tsx`

**Interfaces:**
- Consumes: `FoldDocument` (Task 2).
- Produces:
  - `interface ImportFoldMessage { op: 'importFold'; fold: FoldDocument }`
  - `function buildImportFoldMessage(fold: FoldDocument): ImportFoldMessage`
  - `function isSimulatorReadyMessage(data: unknown): boolean`
  - `function FoldSimulator(props: { fold: FoldDocument }): JSX.Element`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/client/components/foldSimulatorMessage.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildImportFoldMessage, isSimulatorReadyMessage } from './foldSimulatorMessage.js'
import type { FoldDocument } from '../../shared/fold.js'

const sampleFold: FoldDocument = {
  file_spec: 1.1,
  file_creator: 'test',
  vertices_coords: [[0, 0]],
  edges_vertices: [],
  edges_assignment: [],
  faces_vertices: [],
}

describe('buildImportFoldMessage', () => {
  it('wraps the FOLD document with the importFold op', () => {
    const message = buildImportFoldMessage(sampleFold)
    expect(message).toEqual({ op: 'importFold', fold: sampleFold })
  })
})

describe('isSimulatorReadyMessage', () => {
  it('returns true for the documented ready handshake shape', () => {
    expect(isSimulatorReadyMessage({ from: 'OrigamiSimulator', status: 'ready' })).toBe(true)
  })

  it('returns false for unrelated message shapes', () => {
    expect(isSimulatorReadyMessage({ foo: 'bar' })).toBe(false)
    expect(isSimulatorReadyMessage(null)).toBe(false)
    expect(isSimulatorReadyMessage('a string')).toBe(false)
    expect(isSimulatorReadyMessage({ from: 'OrigamiSimulator', status: 'busy' })).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- foldSimulatorMessage`
Expected: FAIL — `Cannot find module './foldSimulatorMessage.js'`.

- [ ] **Step 3: 구현 — `src/client/components/foldSimulatorMessage.ts`**

```ts
import type { FoldDocument } from '../../shared/fold.js'

export interface ImportFoldMessage {
  op: 'importFold'
  fold: FoldDocument
}

export function buildImportFoldMessage(fold: FoldDocument): ImportFoldMessage {
  return { op: 'importFold', fold }
}

export function isSimulatorReadyMessage(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const candidate = data as { from?: unknown; status?: unknown }
  return candidate.from === 'OrigamiSimulator' && candidate.status === 'ready'
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- foldSimulatorMessage`
Expected: 3 passed, 0 failed.

- [ ] **Step 5: React 컴포넌트 작성 (테스트 없음 — 외부 iframe과의 실제 핸드셰이크는 최종 Task의 수동 브라우저 검증으로 커버) — `src/client/components/FoldSimulator.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import type { FoldDocument } from '../../shared/fold.js'
import { buildImportFoldMessage, isSimulatorReadyMessage } from './foldSimulatorMessage.js'

const SIMULATOR_URL = 'https://origamisimulator.org/'

export interface FoldSimulatorProps {
  fold: FoldDocument
}

export function FoldSimulator({ fold }: FoldSimulatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (isSimulatorReadyMessage(event.data)) {
        iframeRef.current?.contentWindow?.postMessage(buildImportFoldMessage(fold), '*')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [fold])

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

- [ ] **Step 6: origamisimulator.org가 iframe 임베드를 차단하지 않는지 확인**

Run: `curl -sS -I https://origamisimulator.org/ | grep -iE 'x-frame-options|content-security-policy'`
Expected: 출력 없음(두 헤더 모두 없어야 iframe 임베드 가능). 만약 헤더가 있고 `frame-ancestors` 또는 `DENY`/`SAMEORIGIN`으로 제한되어 있다면, **이 Task를 멈추고 보고**(BLOCKED) — Phase 1 §3.6의 iframe 방식 자체가 막힌 것이므로 설계 변경이 필요하다.

- [ ] **Step 7: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 58 passed.

- [ ] **Step 8: 커밋**

```bash
git add src/client/components/foldSimulatorMessage.ts src/client/components/foldSimulatorMessage.test.ts src/client/components/FoldSimulator.tsx
git commit -m "Phase 1/T10: Origami Simulator iframe 임베드 (postMessage importFold)"
```

---

## Task 11: TreeMaker Web Worker (`src/client/workers/treemaker.worker.ts`)

엔진(Task 7)이 순수 함수이기 때문에 Worker 래퍼는 아주 얇다. Worker API는 vitest의 node 환경에서 직접 테스트하기 어려우므로(브라우저 전용 API), 이 Task는 자동 테스트 없이 진행하고 — `treeToFold` 자체의 정확성은 이미 Task 7에서 충분히 검증됐으므로 — 최종 Task의 수동 브라우저 검증으로 wiring을 확인한다.

**Files:**
- Create: `src/client/workers/treemaker.worker.ts`

**Interfaces:**
- Consumes: `treeToFold` (Task 7), `Tree` (Task 1), `FoldDocument` (Task 2).
- Produces:
  - `interface TreemakerWorkerRequest { tree: Tree }`
  - `interface TreemakerWorkerResponse { fold: FoldDocument }`
  - Worker는 `TreemakerWorkerRequest` 메시지를 받으면 `treeToFold`를 호출하고 `TreemakerWorkerResponse`를 `postMessage`로 돌려준다.

- [ ] **Step 1: 구현 — `src/client/workers/treemaker.worker.ts`**

```ts
import { treeToFold } from '../../treemaker/treemaker.js'
import type { Tree } from '../../shared/tree.js'
import type { FoldDocument } from '../../shared/fold.js'

export interface TreemakerWorkerRequest {
  tree: Tree
}

export interface TreemakerWorkerResponse {
  fold: FoldDocument
}

self.addEventListener('message', (event: MessageEvent<TreemakerWorkerRequest>) => {
  const fold = treeToFold(event.data.tree)
  const response: TreemakerWorkerResponse = { fold }
  ;(self as unknown as Worker).postMessage(response)
})
```

- [ ] **Step 2: TypeScript 컴파일 확인 (Vite 클라이언트 빌드 경로로 타입 체크)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 에러 없음(종료 코드 0). Worker 파일이 `self`/`MessageEvent` 등 DOM/WebWorker 타입을 쓰므로, 루트 `tsconfig.json`의 `lib`에 `"DOM"`이 이미 포함되어 있는지 확인(Phase 0의 `tsconfig.json`에 이미 포함됨 — 별도 수정 불필요할 것으로 예상되나, 에러가 나면 `lib`에 `"WebWorker"` 추가 검토).

- [ ] **Step 3: 전체 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 58 passed (이 Task는 새 자동 테스트를 추가하지 않음 — Worker wiring은 Task 12의 수동 검증으로 커버).

- [ ] **Step 4: 커밋**

```bash
git add src/client/workers/treemaker.worker.ts
git commit -m "Phase 1/T11: TreeMaker Web Worker 래퍼"
```

---

## Task 12: App.tsx 통합 + 수동 E2E 검증

**Files:**
- Modify: `src/client/App.tsx`

**Interfaces:**
- Consumes: `craneTree` (Task 8), `CPCanvas` (Task 9), `FoldSimulator` (Task 10), worker 메시지 타입(Task 11), `FoldDocument` (Task 2).

- [ ] **Step 1: 구현 — `src/client/App.tsx` 전체 교체**

```tsx
import { useEffect, useState } from 'react'
import { craneTree } from './cpData/craneTree.js'
import { CPCanvas } from './components/CPCanvas.js'
import { FoldSimulator } from './components/FoldSimulator.js'
import type { FoldDocument } from '../shared/fold.js'
import type { TreemakerWorkerResponse } from './workers/treemaker.worker.js'

export function App() {
  const [fold, setFold] = useState<FoldDocument | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('./workers/treemaker.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<TreemakerWorkerResponse>) => {
      setFold(event.data.fold)
    })
    worker.postMessage({ tree: craneTree })
    return () => worker.terminate()
  }, [])

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
Expected: 58 passed, 0 failed.

- [ ] **Step 3: 클라이언트 빌드 통과 확인**

Run: `npm run build:client`
Expected: `dist/client/` 생성, 에러 없음 — Vite가 `new Worker(new URL(...))` 패턴을 인식해 워커 청크를 별도로 번들링.

- [ ] **Step 4: 로컬 dev 서버로 수동 브라우저 검증**

Run: `npm run dev:client` (별도 터미널, 백그라운드)
Then: 브라우저로 `http://localhost:5173` 접속.

확인 항목(모두 통과해야 Task 완료):
- 페이지 로드 직후 "CP 계산 중..." 잠깐 보였다가 화면이 분할됨
- 왼쪽 패널에 2D CP가 보임 — 빨간 실선(mountain) 3~4개, 파란 점선(valley) 2~3개, 검은 실선(boundary) 삼각형 외곽
- 오른쪽 패널에 Origami Simulator iframe이 로드되고, 잠시 후 자동으로 트라이포드 모델이 임포트됨(빈 화면이 아니라 모델이 보여야 함)
- 오른쪽 패널 내 시뮬레이터 자체 슬라이더(또는 fold 버튼)를 조작하면 평면 → 3D로 접히는 것이 보임
- 브라우저 개발자 도구 콘솔에 에러 없음(특히 `postMessage` 관련 에러나 CORS 에러)

브라우저 콘솔에서 직접 확인(권장):
```js
// 개발자 도구 콘솔에서 실행 — 워커가 정상적으로 FOLD를 만들어내는지 별도 확인
// (App이 이미 화면에 그려져 있다면 이 단계는 시각적 확인으로 충분히 대체됨)
```

서버 종료: Ctrl-C.

- [ ] **Step 5: 커밋**

```bash
git add src/client/App.tsx
git commit -m "Phase 1/T12: App.tsx에 트리->워커->FOLD->2D+3D 파이프라인 연결"
```

---

## 완료 후 체크리스트 (Phase 1 → Phase 2 게이트)

- [ ] 모든 Task의 모든 Step이 체크됨
- [ ] `npm test` 전체 통과 (58개 이상)
- [ ] `npm run build` (client+server) 통과
- [ ] 브라우저에서 학 트리 CP가 2D로 보임
- [ ] 브라우저에서 같은 트리가 Origami Simulator에서 3D로 접힘
- [ ] 콘솔 에러 없음
- [ ] (선택, 강력 권장) 운영 배포: `git push origin main` → `https://origami.myazit.kr` 에서도 동일하게 동작 확인 — Phase 0의 CI/CD가 이미 살아있으므로 추가 설정 없이 배포될 것으로 예상되나, Worker 번들이 정적 파일로 올바르게 서빙되는지(특히 `Content-Type`)는 운영 환경에서 한 번은 직접 확인 권장
