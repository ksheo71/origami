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
