export interface CreasePatternSvgProps {
  svg: string
}

// 전통 CP SVG를 그대로 인라인 표시한다(선 색 = 산 빨강 / 골 파랑 / 경계 검정).
// SVG는 신뢰된 로컬 정적 에셋(우리 public/catalog)이므로 dangerouslySetInnerHTML 사용이 안전하다.
export function CreasePatternSvg({ svg }: CreasePatternSvgProps) {
  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
