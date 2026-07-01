import { useEffect, useRef } from 'react'
import type { FoldDocument } from '../../shared/fold.js'
import { buildImportFoldMessage, isSimulatorReadyMessage } from './foldSimulatorMessage.js'

const SIMULATOR_URL = 'https://origamisimulator.org/'

export interface FoldSimulatorProps {
  fold: FoldDocument
}

export function FoldSimulator({ fold }: FoldSimulatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (isSimulatorReadyMessage(event.data)) {
        iframeRef.current?.contentWindow?.postMessage(buildImportFoldMessage(fold), '*')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [fold])

  return (
    <iframe
      ref={iframeRef}
      src={SIMULATOR_URL}
      title="Origami Simulator"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  )
}
