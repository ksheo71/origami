export interface ImportSvgMessage {
  op: 'importSVG'
  svg: string
  filename: string
}

export function buildImportSvgMessage(svg: string, filename: string): ImportSvgMessage {
  return { op: 'importSVG', svg, filename }
}

export function isSimulatorReadyMessage(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const candidate = data as { from?: unknown; status?: unknown }
  return candidate.from === 'OrigamiSimulator' && candidate.status === 'ready'
}
