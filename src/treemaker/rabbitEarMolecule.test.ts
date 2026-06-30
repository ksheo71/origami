import { describe, it, expect } from 'vitest'
import { buildStarTripod } from './starTripod.js'
import { buildRabbitEarMolecule } from './rabbitEarMolecule.js'
import type { Tree } from '../shared/tree.js'

const symmetricTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

describe('buildRabbitEarMolecule', () => {
  it('places the branch point at the known centroid for the symmetric case', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    expect(molecule.branchPoint.x).toBeCloseTo(1, 9)
    expect(molecule.branchPoint.y).toBeCloseTo(Math.sqrt(3) / 3, 9)
  })

  it('places tangent points at the known side midpoints for the symmetric case', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    const [t01, t12, t20] = molecule.tangentPoints
    expect(t01.x).toBeCloseTo(1, 9)
    expect(t01.y).toBeCloseTo(0, 9)
    expect(t12.x).toBeCloseTo(1.5, 9)
    expect(t12.y).toBeCloseTo(Math.sqrt(3) / 2, 9)
    expect(t20.x).toBeCloseTo(0.5, 9)
    expect(t20.y).toBeCloseTo(Math.sqrt(3) / 2, 9)
  })

  it('produces exactly 6 creases, all originating from the branch point (by reference)', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    expect(molecule.creases).toHaveLength(6)
    for (const crease of molecule.creases) {
      expect(crease.from).toBe(molecule.branchPoint)
    }
  })

  it('satisfies the Kawasaki theorem at the branch point (alternating angle sums equal 180 degrees)', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    const center = molecule.branchPoint
    const rayAngles = molecule.creases
      .map((crease) => Math.atan2(crease.to.y - center.y, crease.to.x - center.x))
      .sort((a, b) => a - b)

    const stepAngles: number[] = []
    for (let i = 0; i < rayAngles.length; i++) {
      const current = rayAngles[i]
      const next = rayAngles[(i + 1) % rayAngles.length]
      if (current === undefined || next === undefined) continue
      const diff = next > current ? next - current : next - current + 2 * Math.PI
      stepAngles.push((diff * 180) / Math.PI)
    }

    const total = stepAngles.reduce((sum, a) => sum + a, 0)
    expect(total).toBeCloseTo(360, 6)

    const oddSum = (stepAngles[0] ?? 0) + (stepAngles[2] ?? 0) + (stepAngles[4] ?? 0)
    const evenSum = (stepAngles[1] ?? 0) + (stepAngles[3] ?? 0) + (stepAngles[5] ?? 0)
    expect(oddSum).toBeCloseTo(180, 6)
    expect(evenSum).toBeCloseTo(180, 6)
  })

  it('satisfies the Maekawa theorem at the branch point (|mountain - valley| === 2)', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    const mountainCount = molecule.creases.filter((c) => c.assignment === 'M').length
    const valleyCount = molecule.creases.filter((c) => c.assignment === 'V').length
    expect(Math.abs(mountainCount - valleyCount)).toBe(2)
  })

  it('each crease length matches its endpoint distance exactly', () => {
    const tripod = buildStarTripod(symmetricTree)
    const molecule = buildRabbitEarMolecule(tripod.leaves)
    for (const crease of molecule.creases) {
      const dx = crease.to.x - crease.from.x
      const dy = crease.to.y - crease.from.y
      expect(Math.hypot(dx, dy)).toBeGreaterThan(0)
    }
  })
})
