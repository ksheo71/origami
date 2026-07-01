import type { FoldDocument } from '../../shared/fold.js'

export interface ImportFoldMessage {
  op: 'importFold'
  fold: FoldDocument
}

export function buildImportFoldMessage(fold: FoldDocument): ImportFoldMessage {
  return { op: 'importFold', fold }
}

export function isSimulatorReadyMessage(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const candidate = data as { from?: unknown; status?: unknown }
  return candidate.from === 'OrigamiSimulator' && candidate.status === 'ready'
}
