import { useEffect, useState } from 'react'
import { craneTree } from './cpData/craneTree.js'
import { CPCanvas } from './components/CPCanvas.js'
import { FoldSimulator } from './components/FoldSimulator.js'
import type { FoldDocument } from '../shared/fold.js'
import type { TreemakerWorkerResponse } from './workers/treemaker.worker.js'

export function App() {
  const [fold, setFold] = useState<FoldDocument | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('./workers/treemaker.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<TreemakerWorkerResponse>) => {
      setFold(event.data.fold)
    })
    worker.postMessage({ tree: craneTree })
    return () => worker.terminate()
  }, [])

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
