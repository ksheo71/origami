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
