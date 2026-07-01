import { describe, it, expect } from 'vitest'
import { treeToFold } from './treemaker.js'
import { validateFold } from '../shared/fold.js'
import type { Tree } from '../shared/tree.js'

function starTree(lengths: number[]): Tree {
  return {
    nodes: [{ id: 'branch' }, ...lengths.map((_, i) => ({ id: `leg-${i}` }))],
    edges: lengths.map((len, i) => ({ from: 'branch', to: `leg-${i}`, length: len })),
  }
}

describe('treeToFold', () => {
  it('produces a valid FOLD for a 3-leg star (regression)', () => {
    const fold = treeToFold(starTree([1, 1, 1]))
    expect(() => validateFold(fold)).not.toThrow()
    expect(fold.faces_vertices).toHaveLength(6)
  })

  it('produces a valid FOLD for a 4-leg star', () => {
    const fold = treeToFold(starTree([1, 1.2, 1, 0.8]))
    expect(() => validateFold(fold)).not.toThrow()
    expect(fold.faces_vertices).toHaveLength(8)
  })

  it('is deterministic — identical FOLD across two runs', () => {
    const a = treeToFold(starTree([1, 1.2, 1, 0.8, 1.4]))
    const b = treeToFold(starTree([1, 1.2, 1, 0.8, 1.4]))
    expect(a).toEqual(b)
  })

  it('rejects a tree whose leg lengths make non-adjacent leaves overlap', () => {
    // NOTE: [1, 1, 10, 1] (as in the original brief) is NOT actually a dominance
    // case — Task 2 proved max(d_i) < sum(e_i) always holds for n>=3, so that input
    // packs validly. [1, 5, 1, 5] is the genuine failure mode established in Task 2:
    // the two radius-5 leaves sit opposite each other and their circles overlap
    // (distance ~8.485 < 5+5=10), which packStarLeaves correctly rejects.
    expect(() => treeToFold(starTree([1, 5, 1, 5]))).toThrow()
  })
})
