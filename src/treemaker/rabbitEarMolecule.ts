import type { Point, StarTripodLeaf } from './starTripod.js'
import type { EdgeAssignment } from '../shared/fold.js'

export interface MoleculeCrease {
  from: Point
  to: Point
  assignment: EdgeAssignment
}

export interface RabbitEarMolecule {
  branchPoint: Point
  tangentPoints: [Point, Point, Point]
  creases: MoleculeCrease[]
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function buildRabbitEarMolecule(
  leaves: [StarTripodLeaf, StarTripodLeaf, StarTripodLeaf],
): RabbitEarMolecule {
  const [l0, l1, l2] = leaves
  const a = l0.edgeLength
  const b = l1.edgeLength
  const c = l2.edgeLength
  const sum = a + b + c

  // Lang, SoCG96 p.5 / TreeMaker 매뉴얼 §5.0: 삼각형의 세 이등분선이 만나는 점은
  // 각 꼭짓점을 "그 꼭짓점에 닿지 않는 두 변 길이의 합"으로 가중평균한 점이다.
  const branchPoint: Point = {
    x: (l0.position.x * (b + c) + l1.position.x * (c + a) + l2.position.x * (a + b)) / (2 * sum),
    y: (l0.position.y * (b + c) + l1.position.y * (c + a) + l2.position.y * (a + b)) / (2 * sum),
  }

  const t01 = lerp(l0.position, l1.position, a / (a + b))
  const t12 = lerp(l1.position, l2.position, b / (b + c))
  const t20 = lerp(l2.position, l0.position, c / (c + a))

  const creases: MoleculeCrease[] = [
    { from: branchPoint, to: l0.position, assignment: 'M' },
    { from: branchPoint, to: l1.position, assignment: 'M' },
    { from: branchPoint, to: l2.position, assignment: 'M' },
    // Maekawa 정리(|M-V|=2)를 만족시키려면 valley 3개 중 하나를 mountain으로 바꿔야 한다.
    // Lang 자신도 "어느 것을 바꿀지는 정해주지 않는다"고 명시했으므로(TreeMaker 매뉴얼 Tutorial 1),
    // 결정성을 위해 항상 t01 방향을 바꾼다.
    { from: branchPoint, to: t01, assignment: 'M' },
    { from: branchPoint, to: t12, assignment: 'V' },
    { from: branchPoint, to: t20, assignment: 'V' },
  ]

  return { branchPoint, tangentPoints: [t01, t12, t20], creases }
}
