import type { FoldDocument } from '../../shared/fold.js'
import { foldToSvgSegments, computeViewBox } from './foldToSvgPaths.js'

export interface CPCanvasProps {
  fold: FoldDocument
}

export function CPCanvas({ fold }: CPCanvasProps) {
  const segments = foldToSvgSegments(fold)
  const viewBox = computeViewBox(fold, 0.2)
  return (
    <svg
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      style={{ width: '100%', height: '100%', background: '#fff' }}
    >
      {segments.map((segment, index) => (
        <line
          key={index}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={segment.stroke}
          strokeWidth={0.02}
          strokeDasharray={segment.strokeDasharray}
        />
      ))}
    </svg>
  )
}
