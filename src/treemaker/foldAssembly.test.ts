import { describe, it, expect } from 'vitest'
import { assembleFold } from './foldAssembly.js'
import { packStarLeaves } from './starPacking.js'
import { buildStarMolecule } from './starMolecule.js'
import { validateFold } from '../shared/fold.js'
import type { StarTree } from './starTree.js'

function foldFor(lengths: number[]) {
  const star: StarTree = {
    branchNodeId: 'branch',
    legs: lengths.map((len, i) => ({ id: `leg-${i}`, edgeLength: len })),
  }
  const packing = packStarLeaves(star)
  return assembleFold(packing, buildStarMolecule(packing))
}

describe('assembleFold', () => {
  it('produces 2n+1 vertices, 4n edges, 2n faces for N=4', () => {
    const fold = foldFor([1, 1, 1, 1])
    expect(fold.vertices_coords).toHaveLength(9) // 2*4 + 1
    expect(fold.edges_vertices).toHaveLength(16) // 4n = 16
    expect(fold.faces_vertices).toHaveLength(8) // 2n
  })

  it('matches Phase 1 counts for N=3 (7 vertices, 12 edges, 6 faces)', () => {
    const fold = foldFor([1, 1, 1])
    expect(fold.vertices_coords).toHaveLength(7)
    expect(fold.edges_vertices).toHaveLength(12)
    expect(fold.faces_vertices).toHaveLength(6)
  })

  it('emits parallel edges_assignment and edges_foldAngle arrays', () => {
    const fold = foldFor([1, 1.2, 1, 0.8, 1.4])
    expect(fold.edges_assignment).toHaveLength(fold.edges_vertices.length)
    expect(fold.edges_foldAngle).toHaveLength(fold.edges_vertices.length)
    // boundary edges (2n) are B/null; interior (2n) are M/-180 or V/180
    for (let i = 0; i < fold.edges_vertices.length; i++) {
      const a = fold.edges_assignment[i]
      const angle = fold.edges_foldAngle[i]
      if (a === 'B') expect(angle).toBeNull()
      if (a === 'M') expect(angle).toBe(-180)
      if (a === 'V') expect(angle).toBe(180)
    }
  })

  it('passes validateFold for N=3..6', () => {
    for (const n of [3, 4, 5, 6]) {
      const lengths = Array.from({ length: n }, (_, i) => 1 + 0.1 * i)
      expect(() => validateFold(foldFor(lengths))).not.toThrow()
    }
  })
})
