import { describe, it, expect } from 'vitest'
import { buildImportSvgMessage, isSimulatorReadyMessage } from './importSvgMessage.js'

describe('buildImportSvgMessage', () => {
  it('builds the importSVG op with svg + filename', () => {
    const msg = buildImportSvgMessage('<svg></svg>', 'crane')
    expect(msg).toEqual({ op: 'importSVG', svg: '<svg></svg>', filename: 'crane' })
  })
})

describe('isSimulatorReadyMessage', () => {
  it('accepts the ready handshake', () => {
    expect(isSimulatorReadyMessage({ from: 'OrigamiSimulator', status: 'ready' })).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isSimulatorReadyMessage({ from: 'x' })).toBe(false)
    expect(isSimulatorReadyMessage(null)).toBe(false)
    expect(isSimulatorReadyMessage('ready')).toBe(false)
  })
})
