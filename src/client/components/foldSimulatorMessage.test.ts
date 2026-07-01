import { describe, it, expect } from 'vitest'
import { buildImportFoldMessage, isSimulatorReadyMessage } from './foldSimulatorMessage.js'
import type { FoldDocument } from '../../shared/fold.js'

const sampleFold: FoldDocument = {
  file_spec: 1.1,
  file_creator: 'test',
  vertices_coords: [[0, 0]],
  edges_vertices: [],
  edges_assignment: [],
  faces_vertices: [],
}

describe('buildImportFoldMessage', () => {
  it('wraps the FOLD document with the importFold op', () => {
    const message = buildImportFoldMessage(sampleFold)
    expect(message).toEqual({ op: 'importFold', fold: sampleFold })
  })
})

describe('isSimulatorReadyMessage', () => {
  it('returns true for the documented ready handshake shape', () => {
    expect(isSimulatorReadyMessage({ from: 'OrigamiSimulator', status: 'ready' })).toBe(true)
  })

  it('returns false for unrelated message shapes', () => {
    expect(isSimulatorReadyMessage({ foo: 'bar' })).toBe(false)
    expect(isSimulatorReadyMessage(null)).toBe(false)
    expect(isSimulatorReadyMessage('a string')).toBe(false)
    expect(isSimulatorReadyMessage({ from: 'OrigamiSimulator', status: 'busy' })).toBe(false)
  })
})
