import { describe, it, expect } from 'vitest'
import { packStarLeaves, PackingError } from './starPacking.js'
import { distance } from './geometry.js'
import type { StarTree } from './starTree.js'

function star(lengths: number[]): StarTree {
  return {
    branchNodeId: 'branch',
    legs: lengths.map((len, i) => ({ id: `leg-${i}`, edgeLength: len })),
  }
}

describe('packStarLeaves', () => {
  it('places 3 equal legs so adjacent circles are tangent (equilateral)', () => {
    const packing = packStarLeaves(star([1, 1, 1]))
    expect(packing.leaves).toHaveLength(3)
    // adjacent tangency: |p_i - p_{i+1}| == e_i + e_{i+1} == 2
    for (let i = 0; i < 3; i++) {
      const a = packing.leaves[i]!
      const b = packing.leaves[(i + 1) % 3]!
      expect(distance(a.position, b.position)).toBeCloseTo(2, 6)
    }
  })

  it('places 4 equal legs on a square (adjacent tangent, diagonal clear)', () => {
    const packing = packStarLeaves(star([1, 1, 1, 1]))
    for (let i = 0; i < 4; i++) {
      const a = packing.leaves[i]!
      const b = packing.leaves[(i + 1) % 4]!
      expect(distance(a.position, b.position)).toBeCloseTo(2, 6)
    }
    // diagonal (non-adjacent) must NOT overlap: >= e_i + e_j = 2
    expect(distance(packing.leaves[0]!.position, packing.leaves[2]!.position)).toBeGreaterThan(2)
  })

  it('is deterministic — same input yields identical coordinates', () => {
    const a = packStarLeaves(star([1, 1.2, 1, 0.8, 1.5]))
    const b = packStarLeaves(star([1, 1.2, 1, 0.8, 1.5]))
    expect(a).toEqual(b)
  })

  it('preserves leg ids and edge lengths', () => {
    const packing = packStarLeaves(star([1, 1.2, 1.6, 0.9]))
    expect(packing.leaves.map((l) => l.id)).toEqual(['leg-0', 'leg-1', 'leg-2', 'leg-3'])
    expect(packing.leaves.map((l) => l.edgeLength)).toEqual([1, 1.2, 1.6, 0.9])
  })

  it('throws PackingError when non-adjacent leaf circles overlap', () => {
    // alternating short/long legs: the two long (radius 5) circles land on
    // opposite vertices of the cyclic quad and overlap → not representable.
    expect(() => packStarLeaves(star([1, 5, 1, 5]))).toThrow(PackingError)
  })
})
