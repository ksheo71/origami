export type EdgeAssignment = 'M' | 'V' | 'B' | 'F' | 'U'

export interface FoldDocument {
  file_spec: number
  file_creator: string
  vertices_coords: [number, number][]
  edges_vertices: [number, number][]
  edges_assignment: EdgeAssignment[]
  // Origami Simulator(origamisimulator.org)의 import 경로가 이 배열을
  // 무조건 인덱싱한다(js/pattern.js getFacesAndVerticesForEdges:825,
  // `fold.edges_foldAngle[i]`) — 없으면 TypeError로 조용히 죽는다.
  // 값 컨벤션은 실제 번들 데모 FOLD 파일에서 확인: M=-180, V=180, B(비크리스)=null.
  edges_foldAngle: (number | null)[]
  faces_vertices: number[][]
}

export function validateFold(fold: FoldDocument): void {
  const vertexCount = fold.vertices_coords.length

  if (fold.edges_vertices.length !== fold.edges_assignment.length) {
    throw new Error(
      `edges_vertices length (${fold.edges_vertices.length}) must match edges_assignment length (${fold.edges_assignment.length})`,
    )
  }

  if (fold.edges_vertices.length !== fold.edges_foldAngle.length) {
    throw new Error(
      `edges_vertices length (${fold.edges_vertices.length}) must match edges_foldAngle length (${fold.edges_foldAngle.length})`,
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
