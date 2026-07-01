import type { FoldDocument, EdgeAssignment } from '../../shared/fold.js'

export interface SvgSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  strokeDasharray?: string
}

const STROKE_BY_ASSIGNMENT: Record<EdgeAssignment, string> = {
  M: '#d33',
  V: '#33d',
  B: '#111',
  F: '#999',
  U: '#999',
}

export function foldToSvgSegments(fold: FoldDocument): SvgSegment[] {
  return fold.edges_vertices.map(([a, b], index) => {
    const assignment = fold.edges_assignment[index]
    if (assignment === undefined) {
      throw new Error(`foldToSvgSegments: missing edges_assignment at index ${index}`)
    }
    const coordsA = fold.vertices_coords[a]
    const coordsB = fold.vertices_coords[b]
    if (coordsA === undefined || coordsB === undefined) {
      throw new Error('foldToSvgSegments: edge references missing vertex coordinates')
    }
    const [x1, y1] = coordsA
    const [x2, y2] = coordsB
    return {
      x1,
      y1,
      x2,
      y2,
      stroke: STROKE_BY_ASSIGNMENT[assignment],
      strokeDasharray: assignment === 'V' ? '0.05,0.05' : undefined,
    }
  })
}

export function computeViewBox(
  fold: FoldDocument,
  padding: number,
): { minX: number; minY: number; width: number; height: number } {
  if (fold.vertices_coords.length === 0) {
    return { minX: -padding, minY: -padding, width: padding * 2, height: padding * 2 }
  }
  const bounds = fold.vertices_coords.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
  }
}
