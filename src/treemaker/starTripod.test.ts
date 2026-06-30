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
