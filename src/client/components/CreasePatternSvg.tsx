export interface CreasePatternSvgProps {
  svg: string
}

// 전통 CP SVG를 인라인 표시(선 색은 각 원본 SVG의 규칙을 따름).
// SVG는 신뢰된 로컬 정적 에셋(우리 public/catalog)이므로 dangerouslySetInnerHTML 사용이 안전하다.
export function CreasePatternSvg({ svg }: CreasePatternSvgProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
