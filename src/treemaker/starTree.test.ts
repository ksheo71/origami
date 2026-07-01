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

  it('still works for the 3-leg (minimum) case', () => {
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
