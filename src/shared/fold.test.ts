import { describe, it, expect } from 'vitest'
import { validateFold } from './fold.js'
import type { FoldDocument } from './fold.js'

const validTriangle: FoldDocument = {
  file_spec: 1.1,
  file_creator: 'test',
  vertices_coords: [
    [0, 0],
    [1, 0],
    [0.5, 1],
  ],
  edges_vertices: [
    [0, 1],
    [1, 2],
    [2, 0],
  ],
  edges_assignment: ['B', 'B', 'B'],
  edges_foldAngle: [null, null, null],
  faces_vertices: [[0, 1, 2]],
}

describe('validateFold', () => {
  it('does not throw for a valid triangle', () => {
    expect(() => validateFold(validTriangle)).not.toThrow()
  })

  it('throws when edges_vertices and edges_assignment lengths differ', () => {
    const fold: FoldDocument = { ...validTriangle, edges_assignment: ['B', 'B'] }
    expect(() => validateFold(fold)).toThrow(/length/)
  })

  it('throws when edges_vertices and edges_foldAngle lengths differ', () => {
    const fold: FoldDocument = { ...validTriangle, edges_foldAngle: [null, null] }
    expect(() => validateFold(fold)).toThrow(/length/)
  })

  it('throws when an edge references an out-of-range vertex index', () => {
    const fold: FoldDocument = {
      ...validTriangle,
      edges_vertices: [
        [0, 1],
        [1, 2],
        [2, 99],
      ],
    }
    expect(() => validateFold(fold)).toThrow(/out-of-range/)
  })

  it('throws when a face references an out-of-range vertex index', () => {
    const fold: FoldDocument = { ...validTriangle, faces_vertices: [[0, 1, 99]] }
    expect(() => validateFold(fold)).toThrow(/out-of-range/)
  })
})
