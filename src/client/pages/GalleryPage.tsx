import { useState } from 'react'
import { CATALOG, filterModels } from '../catalog/catalog.js'
import type { OrigamiModel } from '../catalog/catalog.js'
import { navigate } from '../router.js'

const CATEGORIES: { value: OrigamiModel['category'] | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'animal', label: '동물·사물' },
  { value: 'base', label: '기본형' },
  { value: 'simple', label: '쉬움' },
]

export function GalleryPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<OrigamiModel['category'] | null>(null)
  const models = filterModels(CATALOG, query, category)

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>종이접기 도감</h1>
      <p style={{ color: '#666' }}>전통 종이접기 모델을 고르면 크리스패턴과 3D로 접히는 과정을 볼 수 있어요.</p>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 검색 (예: 학)"
          style={{ flex: 1, minWidth: 160, padding: 8 }}
        />
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            onClick={() => setCategory(c.value)}
            style={{ padding: '8px 12px', fontWeight: category === c.value ? 700 : 400 }}
          >
            {c.label}
          </button>
        ))}
      </div>
      {models.length === 0 ? (
        <p>검색 결과가 없습니다.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/model/${m.id}`)}
              style={{ textAlign: 'left', border: '1px solid #ddd', borderRadius: 12, padding: 16, cursor: 'pointer', background: '#fff' }}
            >
              <img src={m.svgPath} alt={m.nameKo} style={{ width: '100%', height: 120, objectFit: 'contain' }} />
              <div style={{ fontWeight: 700, marginTop: 8 }}>{m.nameKo}</div>
              <div style={{ color: '#888', fontSize: 13 }}>{m.nameEn} · {m.difficulty}</div>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
