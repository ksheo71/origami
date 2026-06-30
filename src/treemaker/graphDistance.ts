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
