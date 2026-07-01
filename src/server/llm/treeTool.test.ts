import { describe, it, expect } from 'vitest'
import { TREE_TOOL_NAME, TREE_TOOL_SCHEMA, starInputToTree } from './treeTool.js'
import { treeToFold } from '../../treemaker/treemaker.js'

describe('emit_animal_star tool', () => {
  it('is named emit_animal_star and requires 4..6 legs', () => {
    expect(TREE_TOOL_NAME).toBe('emit_animal_star')
    expect(TREE_TOOL_SCHEMA.input_schema.properties.legs.minItems).toBe(4)
    expect(TREE_TOOL_SCHEMA.input_schema.properties.legs.maxItems).toBe(6)
  })

  it('starInputToTree builds a single-branch star tree', () => {
    const tree = starInputToTree({
      creatureLabel: '사자',
      legs: [
        { label: 'head', length: 1 },
        { label: 'tail', length: 1.4 },
        { label: 'leg-front', length: 0.8 },
        { label: 'leg-back', length: 0.8 },
      ],
    })
    expect(tree.nodes).toHaveLength(5) // branch + 4 legs
    expect(tree.edges).toHaveLength(4)
    expect(tree.edges.every((e) => e.from === 'branch')).toBe(true)
  })

  it('the produced tree folds through the engine', () => {
    const tree = starInputToTree({
      creatureLabel: '학',
      legs: [
        { label: 'wing-l', length: 1.2 },
        { label: 'wing-r', length: 1.2 },
        { label: 'head', length: 1 },
        { label: 'tail', length: 1.5 },
      ],
    })
    expect(() => treeToFold(tree)).not.toThrow()
  })

  it('rejects non-positive lengths', () => {
    expect(() =>
      starInputToTree({
        creatureLabel: 'x',
        legs: [
          { label: 'a', length: 1 },
          { label: 'b', length: 0 },
          { label: 'c', length: 1 },
          { label: 'd', length: 1 },
        ],
      }),
    ).toThrow(/positive/)
  })
})
