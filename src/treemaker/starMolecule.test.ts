import { describe, it, expect } from 'vitest'
import { buildStarMolecule } from './starMolecule.js'
import { packStarLeaves } from './starPacking.js'
import type { StarTree } from './starTree.js'
import type { EdgeAssignment } from '../shared/fold.js'

function isInsideConvexPolygon(
  p: { x: number; y: number },
  poly: { x: number; y: number }[],
): boolean {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross !== 0) {
      const s = Math.sign(cross)
      if (sign === 0) sign = s
      else if (s !== sign) return false
    }
  }
  return true
}

function star(lengths: number[]): StarTree {
  return {
    branchNodeId: 'branch',
    legs: lengths.map((len, i) => ({ id: `leg-${i}`, edgeLength: len })),
  }
}

function countAssignments(list: EdgeAssignment[]): Record<string, number> {
  return list.reduce<Record<string, number>>((acc, a) => {
    acc[a] = (acc[a] ?? 0) + 1
    return acc
  }, {})
}

describe('buildStarMolecule', () => {
  it('for 3 equal legs, hub is the centroid (origin) and matches the 3-leg star structure', () => {
    const molecule = buildStarMolecule(packStarLeaves(star([1, 1, 1])))
    expect(molecule.hub.x).toBeCloseTo(0, 6)
    expect(molecule.hub.y).toBeCloseTo(0, 6)
    expect(molecule.tangentPoints).toHaveLength(3)
    expect(molecule.leafCreaseAssignments).toEqual(['M', 'M', 'M'])
    expect(molecule.tangentCreaseAssignments).toEqual(['M', 'V', 'V'])
  })

  it('satisfies Maekawa |M - V| = 2 for N = 5', () => {
    const molecule = buildStarMolecule(packStarLeaves(star([1, 1.2, 1, 0.8, 1.4])))
    const all = [...molecule.leafCreaseAssignments, ...molecule.tangentCreaseAssignments]
    const counts = countAssignments(all)
    expect(Math.abs((counts.M ?? 0) - (counts.V ?? 0))).toBe(2)
    // n leaf creases + n tangent creases
    expect(molecule.leafCreaseAssignments).toHaveLength(5)
    expect(molecule.tangentCreaseAssignments).toHaveLength(5)
  })

  it('places the tangent point at the e_i : e_{i+1} ratio on each edge', () => {
    const packing = packStarLeaves(star([1, 3, 1, 1])) // edge leg0->leg1 split 1:3
    const molecule = buildStarMolecule(packing)
    const p0 = packing.leaves[0]!.position
    const p1 = packing.leaves[1]!.position
    const t0 = molecule.tangentPoints[0]!
    // |p0 - t0| / |p0 - p1| == e0 / (e0 + e1) == 1/4
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y)
    expect(d(p0, t0) / d(p0, p1)).toBeCloseTo(0.25, 6)
  })

  it('keeps the hub strictly inside (weighted centroid) for asymmetric legs', () => {
    const packing = packStarLeaves(star([1, 1.5, 0.7, 1.2]))
    const molecule = buildStarMolecule(packing)
    expect(Number.isFinite(molecule.hub.x)).toBe(true)
    expect(Number.isFinite(molecule.hub.y)).toBe(true)
    const polygon = packing.leaves.map((l) => l.position)
    expect(isInsideConvexPolygon(molecule.hub, polygon)).toBe(true)
  })
})
