import { describe, it, expect } from 'vitest'
import { encodeTreeToUrlParam, decodeTreeFromUrlParam } from './urlTreeState.js'
import type { Tree } from '../shared/tree.js'

const sampleTree: Tree = {
  nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }, { id: 'leaf2' }],
  edges: [
    { from: 'branch', to: 'leaf0', length: 1 },
    { from: 'branch', to: 'leaf1', length: 1 },
    { from: 'branch', to: 'leaf2', length: 1.5 },
  ],
}

describe('encodeTreeToUrlParam / decodeTreeFromUrlParam', () => {
  it('round-trips a valid tree', () => {
    const encoded = encodeTreeToUrlParam(sampleTree)
    const decoded = decodeTreeFromUrlParam(encoded)
    expect(decoded).toEqual(sampleTree)
  })

  it('produces a URL-safe string (no +, /, or = characters)', () => {
    const encoded = encodeTreeToUrlParam(sampleTree)
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('handles Korean labels correctly (UTF-8 safe)', () => {
    const treeWithKorean: Tree = {
      ...sampleTree,
      nodes: [{ id: 'branch', label: '학' }, ...sampleTree.nodes.slice(1)],
    }
    const encoded = encodeTreeToUrlParam(treeWithKorean)
    const decoded = decodeTreeFromUrlParam(encoded)
    expect(decoded?.nodes[0]?.label).toBe('학')
  })

  it('returns null for garbage input', () => {
    expect(decodeTreeFromUrlParam('not-valid-base64url-json!!!')).toBeNull()
  })

  it('returns null for well-formed base64url that decodes to invalid JSON', () => {
    const garbage = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeTreeFromUrlParam(garbage)).toBeNull()
  })

  it('returns null for valid JSON that fails validateTree (e.g. disconnected)', () => {
    const disconnectedTree = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [],
    }
    const json = JSON.stringify(disconnectedTree)
    const encoded = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeTreeFromUrlParam(encoded)).toBeNull()
  })

  it('returns null for a tree that passes validateTree but the star engine cannot build (e.g. only 2 leaves, below the 3-leg minimum)', () => {
    const unsupportedTree = {
      nodes: [{ id: 'branch' }, { id: 'leaf0' }, { id: 'leaf1' }],
      edges: [
        { from: 'branch', to: 'leaf0', length: 1 },
        { from: 'branch', to: 'leaf1', length: 1 },
      ],
    }
    const json = JSON.stringify(unsupportedTree)
    const encoded = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeTreeFromUrlParam(encoded)).toBeNull()
  })
})
