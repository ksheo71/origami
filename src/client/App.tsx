import { useEffect, useState } from 'react'
import { AnimalNameForm } from './components/AnimalNameForm.js'
import { CPCanvas } from './components/CPCanvas.js'
import { FoldSimulator } from './components/FoldSimulator.js'
import { encodeTreeToUrlParam, decodeTreeFromUrlParam } from './urlTreeState.js'
import type { Tree } from '../shared/tree.js'
import type { FoldDocument } from '../shared/fold.js'
import type { TreemakerWorkerResponse } from './workers/treemaker.worker.js'

function readTreeFromCurrentUrl(): Tree | null {
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get('tree')
  if (!encoded) return null
  return decodeTreeFromUrlParam(encoded)
}

export function App() {
  const [tree, setTree] = useState<Tree | null>(() => readTreeFromCurrentUrl())
  const [fold, setFold] = useState<FoldDocument | null>(null)

  function handleTreeReady(newTree: Tree): void {
    const encoded = encodeTreeToUrlParam(newTree)
    const url = new URL(window.location.href)
    url.searchParams.set('tree', encoded)
    window.history.replaceState(null, '', url.toString())
    setFold(null)
    setTree(newTree)
  }

  useEffect(() => {
    if (!tree) return
    const worker = new Worker(new URL('./workers/treemaker.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<TreemakerWorkerResponse>) => {
      setFold(event.data.fold)
    })
    worker.postMessage({ tree })
    return () => worker.terminate()
  }, [tree])

  if (!tree) {
    return (
      <main style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ padding: '24px 24px 0' }}>Origami CP Generator</h1>
        <AnimalNameForm onTreeReady={handleTreeReady} />
      </main>
    )
  }

  if (!fold) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
        <p>CP 계산 중...</p>
      </main>
    )
  }

  return (
    <main style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, borderRight: '1px solid #ddd' }}>
        <CPCanvas fold={fold} />
      </div>
      <div style={{ flex: 1 }}>
        <FoldSimulator fold={fold} />
      </div>
    </main>
  )
}
