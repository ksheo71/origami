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
// f(R) = Σ 2·asin(d_i / 2R) − 2π 는 R에 대해 단조감소.
// 볼록 순환 다각형은 양수 접선 변(다리 ≥ 3개)에 대해 항상 존재한다:
//   perimeterHalf = Σd_i/2 = Σe_i, maxSide = max(e_i+e_{i+1}) 이므로 항상 maxSide < perimeterHalf.
// 따라서 f(maxSide/2+) > 0 이고 R→∞ 에서 f → −2π 라 근이 유일하게 존재한다.
// 진짜 실패(자기교차/표현 불가)는 근찾기가 아니라 아래 "비인접 겹침" 검사에서 잡힌다.
function solveCircumradius(sides: number[]): number {
  const maxSide = Math.max(...sides)

  const f = (R: number): number =>
    sides.reduce((acc, d) => acc + 2 * Math.asin(Math.min(1, d / (2 * R))), 0) - 2 * Math.PI

  let lo = maxSide / 2 + 1e-12
  let hi = maxSide
  let guard = 0
  // 병리적 입력(NaN 등)에 대한 안전망: hi가 무한정 커지면 중단.
  while (f(hi) >= 0) {
    hi *= 2
    guard += 1
    if (guard > 200) {
      throw new PackingError('circumradius search did not converge (degenerate leg lengths)')
    }
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
