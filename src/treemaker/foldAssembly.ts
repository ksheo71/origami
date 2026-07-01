import type { FoldDocument, EdgeAssignment } from '../shared/fold.js'
import type { StarPacking } from './starPacking.js'
import type { StarMolecule } from './starMolecule.js'

// Origami Simulator 데모 자산에서 확인한 컨벤션. 없으면 import 경로가
// fold.edges_foldAngle[i] 인덱싱에서 TypeError로 죽는다.
const FOLD_ANGLE_BY_ASSIGNMENT: Record<EdgeAssignment, number | null> = {
  M: -180,
  V: 180,
  B: null,
  F: 0,
  U: null,
}

export function assembleFold(packing: StarPacking, molecule: StarMolecule): FoldDocument {
  const leaves = packing.leaves
  const n = leaves.length

  // 정점 레이아웃: [leaf_0..leaf_{n-1}, hub, t_0..t_{n-1}]
  const vertices_coords: [number, number][] = []
  for (const leaf of leaves) {
    vertices_coords.push([leaf.position.x, leaf.position.y])
  }
  const hubIndex = vertices_coords.length
  vertices_coords.push([molecule.hub.x, molecule.hub.y])
  const tangentStart = vertices_coords.length
  for (const tp of molecule.tangentPoints) {
    vertices_coords.push([tp.x, tp.y])
  }

  const leafIndex = (i: number): number => i
  const tangentIndex = (i: number): number => tangentStart + i

  const edges_vertices: [number, number][] = []
  const edges_assignment: EdgeAssignment[] = []
  const edges_foldAngle: (number | null)[] = []

  function addEdge(a: number, b: number, assignment: EdgeAssignment): void {
    edges_vertices.push([a, b])
    edges_assignment.push(assignment)
    edges_foldAngle.push(FOLD_ANGLE_BY_ASSIGNMENT[assignment])
  }

  // 경계: 각 순환 변을 접선점에서 둘로 나눈다.
  for (let i = 0; i < n; i++) {
    addEdge(leafIndex(i), tangentIndex(i), 'B')
    addEdge(tangentIndex(i), leafIndex((i + 1) % n), 'B')
  }

  // 내부 크리스: 허브에서 각 잎으로.
  for (let i = 0; i < n; i++) {
    const assignment = molecule.leafCreaseAssignments[i]
    if (assignment === undefined) throw new Error('unreachable')
    addEdge(hubIndex, leafIndex(i), assignment)
  }
  // 내부 크리스: 허브에서 각 접선점으로.
  for (let i = 0; i < n; i++) {
    const assignment = molecule.tangentCreaseAssignments[i]
    if (assignment === undefined) throw new Error('unreachable')
    addEdge(hubIndex, tangentIndex(i), assignment)
  }

  // 면: 각 순환 변마다 삼각형 2개.
  const faces_vertices: number[][] = []
  for (let i = 0; i < n; i++) {
    faces_vertices.push([leafIndex(i), tangentIndex(i), hubIndex])
    faces_vertices.push([tangentIndex(i), leafIndex((i + 1) % n), hubIndex])
  }

  return {
    file_spec: 1.1,
    file_creator: 'origami-app TreeMaker engine (Phase 3)',
    vertices_coords,
    edges_vertices,
    edges_assignment,
    edges_foldAngle,
    faces_vertices,
  }
}
