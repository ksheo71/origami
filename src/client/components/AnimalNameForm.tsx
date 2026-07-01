import { useState } from 'react'
import type { Tree } from '../../shared/tree.js'
import { buildTreeFromNameRequestBody, parseTreeFromNameResponse } from './treeFromNameRequest.js'

export interface AnimalNameFormProps {
  onTreeReady: (tree: Tree) => void
  disabled?: boolean
}

export function AnimalNameForm({ onTreeReady, disabled }: AnimalNameFormProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tree-from-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildTreeFromNameRequestBody(name.trim()),
      })
      const body: unknown = await response.json()
      const result = parseTreeFromNameResponse(response.status, body)
      if ('tree' in result) {
        onTreeReady(result.tree)
      } else {
        setError(result.error)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
      <label htmlFor="animal-name">동물 이름을 입력하세요</label>
      <input
        id="animal-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled || loading}
        placeholder="예: 학, 도마뱀, 사자"
      />
      <button type="submit" disabled={disabled || loading || !name.trim()}>
        {loading ? '트리 생성 중...' : '접기 도면 만들기'}
      </button>
      {error && <p style={{ color: '#c33' }}>{error}</p>}
    </form>
  )
}
