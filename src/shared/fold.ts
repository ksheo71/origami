export type EdgeAssignment = 'M' | 'V' | 'B' | 'F' | 'U'

export interface FoldDocument {
  file_spec: number
  file_creator: string
  vertices_coords: [number, number][]
  edges_vertices: [number, number][]
  edges_assignment: EdgeAssignment[]
  faces_vertices: number[][]
}

export function validateFold(fold: FoldDocument): void {
  const vertexCount = fold.vertices_coords.length

  if (fold.edges_vertices.length !== fold.edges_assignment.length) {
    throw new Error(
      `edges_vertices length (${fold.edges_vertices.length}) must match edges_assignment length (${fold.edges_assignment.length})`,
    )
  }

  for (const [a, b] of fold.edges_vertices) {
    if (a < 0 || a >= vertexCount || b < 0 || b >= vertexCount) {
      throw new Error(`edge references out-of-range vertex index: [${a}, ${b}]`)
    }
  }

  for (const face of fold.faces_vertices) {
    for (const v of face) {
      if (v < 0 || v >= vertexCount) {
        throw new Error(`face references out-of-range vertex index: ${v}`)
      }
    }
  }
}
