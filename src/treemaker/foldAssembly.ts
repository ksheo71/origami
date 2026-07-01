import type { FoldDocument, EdgeAssignment } from '../shared/fold.js'
import type { Point, StarTripod } from './starTripod.js'
import type { RabbitEarMolecule } from './rabbitEarMolecule.js'

export function assembleFold(tripod: StarTripod, molecule: RabbitEarMolecule): FoldDocument {
  const [l0, l1, l2] = tripod.leaves
  const [t01, t12, t20] = molecule.tangentPoints
  const branchPoint = molecule.branchPoint

  const vertexOrder: Point[] = [l0.position, l1.position, l2.position, branchPoint, t01, t12, t20]
  const indexOf = new Map<Point, number>()
  vertexOrder.forEach((point, index) => indexOf.set(point, index))

  function indexOfPoint(point: Point): number {
    const index = indexOf.get(point)
    if (index === undefined) {
      throw new Error('assembleFold: point not found in vertex list')
    }
    return index
  }

  const vertices_coords: [number, number][] = vertexOrder.map((p) => [p.x, p.y])
  const edges_vertices: [number, number][] = []
  const edges_assignment: EdgeAssignment[] = []
  const edges_foldAngle: (number | null)[] = []

  // Origami Simulator의 실제 데모 FOLD 자산에서 확인한 컨벤션(M=-180, V=180,
  // 크리스가 아닌 edge는 null). 이 값이 없으면 시뮬레이터의 import 경로가
  // fold.edges_foldAngle[i]를 인덱싱하다 TypeError로 죽는다(js/pattern.js:826).
  const FOLD_ANGLE_BY_ASSIGNMENT: Record<EdgeAssignment, number | null> = {
    M: -180,
    V: 180,
    B: null,
    F: 0,
    U: null,
  }

  function addEdge(a: Point, b: Point, assignment: EdgeAssignment): void {
    edges_vertices.push([indexOfPoint(a), indexOfPoint(b)])
    edges_assignment.push(assignment)
    edges_foldAngle.push(FOLD_ANGLE_BY_ASSIGNMENT[assignment])
  }

  // 경계: 삼각형의 세 변을 각 접선점에서 둘로 나눈다.
  addEdge(l0.position, t01, 'B')
  addEdge(t01, l1.position, 'B')
  addEdge(l1.position, t12, 'B')
  addEdge(t12, l2.position, 'B')
  addEdge(l2.position, t20, 'B')
  addEdge(t20, l0.position, 'B')

  // 내부 크리스: 분기점에서 뻗어나가는 6개.
  for (const crease of molecule.creases) {
    addEdge(crease.from, crease.to, crease.assignment)
  }

  const faces_vertices: number[][] = [
    [indexOfPoint(l0.position), indexOfPoint(t01), indexOfPoint(branchPoint)],
    [indexOfPoint(t01), indexOfPoint(l1.position), indexOfPoint(branchPoint)],
    [indexOfPoint(l1.position), indexOfPoint(t12), indexOfPoint(branchPoint)],
    [indexOfPoint(t12), indexOfPoint(l2.position), indexOfPoint(branchPoint)],
    [indexOfPoint(l2.position), indexOfPoint(t20), indexOfPoint(branchPoint)],
    [indexOfPoint(t20), indexOfPoint(l0.position), indexOfPoint(branchPoint)],
  ]

  return {
    file_spec: 1.1,
    file_creator: 'origami-app TreeMaker engine (Phase 1)',
    vertices_coords,
    edges_vertices,
    edges_assignment,
    edges_foldAngle,
    faces_vertices,
  }
}
