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

  if (tree.edges.length !== tree.nodes.length - 1) {
    throw new Error(
      `tree must have exactly nodes.length - 1 edges (got ${tree.edges.length} edges, ${tree.nodes.length} nodes)`,
    )
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
