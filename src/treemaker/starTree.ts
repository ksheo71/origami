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
