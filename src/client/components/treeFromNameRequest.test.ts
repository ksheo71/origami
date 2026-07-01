import { describe, it, expect } from 'vitest'
import { buildTreeFromNameRequestBody, parseTreeFromNameResponse } from './treeFromNameRequest.js'

describe('buildTreeFromNameRequestBody', () => {
  it('wraps the name in a JSON object', () => {
    expect(JSON.parse(buildTreeFromNameRequestBody('학'))).toEqual({ name: '학' })
  })
})

describe('parseTreeFromNameResponse', () => {
  const sampleTree = {
    nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
    edges: [
      { from: 'branch', to: 'leaf0', length: 1 },
      { from: 'branch', to: 'leaf1', length: 1 },
      { from: 'branch', to: 'leaf2', length: 1 },
    ],
  }

  it('returns the tree on 200', () => {
    const result = parseTreeFromNameResponse(200, { tree: sampleTree })
    expect('tree' in result && result.tree).toEqual(sampleTree)
  })

  it('returns an error message on 400', () => {
    const result = parseTreeFromNameResponse(400, { error: 'name must be a non-empty string' })
    expect('error' in result && result.error).toMatch(/non-empty/)
  })

  it('returns an error message on 502', () => {
    const result = parseTreeFromNameResponse(502, { error: 'failed after 2 attempts' })
    expect('error' in result).toBe(true)
  })

  it('returns a fallback error for unexpected body shapes', () => {
    const result = parseTreeFromNameResponse(500, { unexpected: true })
    expect('error' in result).toBe(true)
  })
})
