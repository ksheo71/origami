import { describe, it, expect } from 'vitest'
import { foldToSvgSegments, computeViewBox } from './foldToSvgPaths.js'
import type { FoldDocument } from '../../shared/fold.js'

const sampleFold: FoldDocument = {
  file_spec: 1.1,
  file_creator: 'test',
  vertices_coords: [
    [0, 0],
    [2, 0],
    [1, 1],
  ],
  edges_vertices: [
    [0, 1],
    [1, 2],
    [2, 0],
  ],
  edges_assignment: ['M', 'V', 'B'],
  edges_foldAngle: [-180, 180, null],
  faces_vertices: [[0, 1, 2]],
}

describe('foldToSvgSegments', () => {
  it('produces one segment per edge', () => {
    expect(foldToSvgSegments(sampleFold)).toHaveLength(3)
  })

  it('colors mountain creases red', () => {
    const [mountain] = foldToSvgSegments(sampleFold)
    expect(mountain?.stroke).toBe('#d33')
  })

  it('colors valley creases blue with a dash pattern', () => {
    const segments = foldToSvgSegments(sampleFold)
    expect(segments[1]?.stroke).toBe('#33d')
    expect(segments[1]?.strokeDasharray).toBeDefined()
  })

  it('colors boundary edges black with no dash pattern', () => {
    const segments = foldToSvgSegments(sampleFold)
    expect(segments[2]?.stroke).toBe('#111')
    expect(segments[2]?.strokeDasharray).toBeUndefined()
  })

  it('maps endpoint coordinates correctly', () => {
    const [mountain] = foldToSvgSegments(sampleFold)
    expect(mountain).toMatchObject({ x1: 0, y1: 0, x2: 2, y2: 0 })
  })
})

describe('computeViewBox', () => {
  it('computes a bounding box with padding around all vertices', () => {
    const viewBox = computeViewBox(sampleFold, 0.5)
    expect(viewBox.minX).toBeCloseTo(-0.5, 9)
    expect(viewBox.minY).toBeCloseTo(-0.5, 9)
    expect(viewBox.width).toBeCloseTo(3, 9)
    expect(viewBox.height).toBeCloseTo(2, 9)
  })

  it('returns a degenerate but finite box for an empty vertex list (no NaN/Infinity)', () => {
    const emptyFold: FoldDocument = {
      file_spec: 1.1,
      file_creator: 'test',
      vertices_coords: [],
      edges_vertices: [],
      edges_assignment: [],
      edges_foldAngle: [],
      faces_vertices: [],
    }
    const viewBox = computeViewBox(emptyFold, 0.5)
    expect(Number.isFinite(viewBox.minX)).toBe(true)
    expect(Number.isFinite(viewBox.minY)).toBe(true)
    expect(Number.isFinite(viewBox.width)).toBe(true)
    expect(Number.isFinite(viewBox.height)).toBe(true)
  })
})
