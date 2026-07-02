import { useEffect, useRef } from 'react'
import { buildImportSvgMessage, isSimulatorReadyMessage } from './importSvgMessage.js'

const SIMULATOR_URL = 'https://origamisimulator.org/'

export interface SvgFoldSimulatorProps {
  svg: string
  filename: string
}

export function SvgFoldSimulator({ svg, filename }: SvgFoldSimulatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (isSimulatorReadyMessage(event.data)) {
        iframeRef.current?.contentWindow?.postMessage(
          buildImportSvgMessage(svg, filename),
          SIMULATOR_URL,
        )
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [svg, filename])

  return (
    <iframe
      ref={iframeRef}
      src={SIMULATOR_URL}
      title="Origami Simulator"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  )
}
