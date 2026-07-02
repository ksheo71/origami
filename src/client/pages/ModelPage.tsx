import { useEffect, useState } from 'react'
import { getModelById } from '../catalog/catalog.js'
import { loadModelSvg } from '../model/loadModelSvg.js'
import { CreasePatternSvg } from '../components/CreasePatternSvg.js'
import { SvgFoldSimulator } from '../components/SvgFoldSimulator.js'
import { navigate } from '../router.js'

export interface ModelPageProps {
  id: string
}

export function ModelPage({ id }: ModelPageProps) {
  const model = getModelById(id)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!model) return
    let cancelled = false
    setSvg(null)
    setError(null)
    loadModelSvg(model.svgPath)
      .then((text) => { if (!cancelled) setSvg(text) })
      .catch(() => { if (!cancelled) setError('크리스패턴을 불러오지 못했습니다.') })
    return () => { cancelled = true }
  }, [model])

  if (!model) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
        <p>모델을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>갤러리로</button>
      </main>
    )
  }

  return (
    <main style={{ fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <button onClick={() => navigate('/')}>← 갤러리</button>
        <span style={{ marginLeft: 16, fontWeight: 700 }}>{model.nameKo}</span>
        <span style={{ marginLeft: 8, color: '#888' }}>{model.nameEn} · {model.source} · {model.difficulty}</span>
      </header>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, borderRight: '1px solid #eee', minWidth: 0 }}>
          {error ? <p style={{ padding: 24, color: '#c33' }}>{error}</p>
            : svg ? <CreasePatternSvg svg={svg} />
            : <p style={{ padding: 24 }}>불러오는 중…</p>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {svg && <SvgFoldSimulator svg={svg} filename={model.id} />}
        </div>
      </div>
    </main>
  )
}
