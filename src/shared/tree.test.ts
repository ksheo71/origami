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
