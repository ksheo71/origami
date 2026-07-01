import { describe, it, expect } from 'vitest'
import { buildStarTripod } from './starTripod.js'
import { buildRabbitEarMolecule } from './rabbitEarMolecule.js'
import { assembleFold } from './foldAssembly.js'
import { validateFold } from '../shared/fold.js'
import type { Tree } from '../shared/tree.js'

const symmetricTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

function buildSymmetricFold() {
  const tripod = buildStarTripod(symmetricTree)
  const molecule = buildRabbitEarMolecule(tripod.leaves)
  return assembleFold(tripod, molecule)
}

describe('assembleFold', () => {
  it('produces a FOLD document that passes validateFold', () => {
    const fold = buildSymmetricFold()
    expect(() => validateFold(fold)).not.toThrow()
  })

  it('produces exactly 7 vertices', () => {
    expect(buildSymmetricFold().vertices_coords).toHaveLength(7)
  })

  it('produces exactly 12 edges (6 boundary + 6 interior creases)', () => {
    const fold = buildSymmetricFold()
    expect(fold.edges_vertices).toHaveLength(12)
    expect(fold.edges_assignment).toHaveLength(12)
  })

  it('produces exactly 6 boundary-assigned edges', () => {
    const fold = buildSymmetricFold()
    expect(fold.edges_assignment.filter((a) => a === 'B')).toHaveLength(6)
  })

  it('produces exactly 6 triangular faces', () => {
    const fold = buildSymmetricFold()
    expect(fold.faces_vertices).toHaveLength(6)
    for (const face of fold.faces_vertices) {
      expect(face).toHaveLength(3)
    }
  })

  it('satisfies Euler characteristic V - E + F = 2 (counting the outer face)', () => {
    const fold = buildSymmetricFold()
    const V = fold.vertices_coords.length
    const E = fold.edges_vertices.length
    const F = fold.faces_vertices.length + 1 // +1 for the outer unbounded face
    expect(V - E + F).toBe(2)
  })

  it('populates edges_foldAngle with the Origami Simulator convention (M=-180, V=180, B=null)', () => {
    const fold = buildSymmetricFold()
    expect(fold.edges_foldAngle).toHaveLength(fold.edges_assignment.length)
    fold.edges_assignment.forEach((assignment, i) => {
      const angle = fold.edges_foldAngle[i]
      if (assignment === 'M') expect(angle).toBe(-180)
      else if (assignment === 'V') expect(angle).toBe(180)
      else if (assignment === 'B') expect(angle).toBeNull()
    })
  })
})
