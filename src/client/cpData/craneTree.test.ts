import { describe, it, expect } from 'vitest'
import { craneTree } from './craneTree.js'
import { treeToFold } from '../../treemaker/treemaker.js'
import { validateFold } from '../../shared/fold.js'

describe('craneTree', () => {
  it('has exactly 1 branch node and 3 leaves', () => {
    expect(craneTree.nodes).toHaveLength(4)
    expect(craneTree.edges).toHaveLength(3)
  })

  it('produces a valid FOLD via the full treeToFold pipeline', () => {
    const fold = treeToFold(craneTree)
    expect(() => validateFold(fold)).not.toThrow()
    expect(fold.vertices_coords).toHaveLength(7)
  })
})
