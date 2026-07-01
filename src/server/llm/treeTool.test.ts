import { describe, it, expect } from 'vitest'
import { TREE_TOOL_SCHEMA, TREE_TOOL_NAME, buildSystemPrompt, tripodInputToTree } from './treeTool.js'
import { validateTree } from '../../shared/tree.js'
import { treeToFold } from '../../treemaker/treemaker.js'

describe('TREE_TOOL_SCHEMA', () => {
  it('has the expected tool name', () => {
    expect(TREE_TOOL_SCHEMA.name).toBe(TREE_TOOL_NAME)
  })

  it('requires exactly 3 legs', () => {
    const legsSchema = (TREE_TOOL_SCHEMA.input_schema as any).properties.legs
    expect(legsSchema.minItems).toBe(3)
    expect(legsSchema.maxItems).toBe(3)
  })
})

describe('buildSystemPrompt', () => {
  it('returns a non-empty string mentioning exactly 3 legs', () => {
    const prompt = buildSystemPrompt()
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).toMatch(/3/)
  })
})

describe('tripodInputToTree', () => {
  const sampleInput = {
    creatureLabel: 'crane',
    legs: [
      { label: 'wing-a', length: 1 },
      { label: 'wing-b', length: 1 },
      { label: 'head-tail', length: 1 },
    ] as [
      { label: string; length: number },
      { label: string; length: number },
      { label: string; length: number },
    ],
  }

  it('produces a tree with 4 nodes and 3 edges', () => {
    const tree = tripodInputToTree(sampleInput)
    expect(tree.nodes).toHaveLength(4)
    expect(tree.edges).toHaveLength(3)
  })

  it('produces a tree that passes validateTree', () => {
    const tree = tripodInputToTree(sampleInput)
    expect(() => validateTree(tree)).not.toThrow()
  })

  it('produces a tree usable by the engine (treeToFold)', () => {
    const tree = tripodInputToTree(sampleInput)
    expect(() => treeToFold(tree)).not.toThrow()
  })

  it('preserves leg lengths on the resulting edges', () => {
    const tree = tripodInputToTree(sampleInput)
    const lengths = tree.edges.map((e) => e.length).sort()
    expect(lengths).toEqual([1, 1, 1])
  })

  it('rejects non-positive leg lengths', () => {
    const badInput = {
      ...sampleInput,
      legs: [
        { label: 'a', length: 0 },
        { label: 'b', length: 1 },
        { label: 'c', length: 1 },
      ] as [
        { label: string; length: number },
        { label: string; length: number },
        { label: string; length: number },
      ],
    }
    expect(() => tripodInputToTree(badInput)).toThrow(/positive/)
  })
})
