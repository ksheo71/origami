import { describe, it, expect } from 'vitest'
import { treeToFold } from './treemaker.js'
import type { Tree } from '../shared/tree.js'

const symmetricTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1 },
  ],
}

describe('treeToFold', () => {
  it('produces a valid FOLD document end-to-end', () => {
    const fold = treeToFold(symmetricTree)
    expect(fold.vertices_coords).toHaveLength(7)
    expect(fold.faces_vertices).toHaveLength(6)
  })

  it('is deterministic — same input produces structurally identical output', () => {
    const foldA = treeToFold(symmetricTree)
    const foldB = treeToFold(symmetricTree)
    expect(foldA).toEqual(foldB)
  })

  it('propagates tree validation errors (e.g. disconnected tree)', () => {
    const brokenTree: Tree = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      edges: [
        { from: 'a', to: 'b', length: 1 },
        { from: 'c', to: 'd', length: 1 },
      ],
    }
    expect(() => treeToFold(brokenTree)).toThrow(/connected/)
  })

  it('propagates star-tripod shape errors (e.g. wrong leaf count)', () => {
    const wrongShape: Tree = {
      nodes: [{ id: 'branch' }, { id: 'leaf0' }],
      edges: [{ from: 'branch', to: 'leaf0', length: 1 }],
    }
    expect(() => treeToFold(wrongShape)).toThrow(/exactly 3 leaves/)
  })
})
