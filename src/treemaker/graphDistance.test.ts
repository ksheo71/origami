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
