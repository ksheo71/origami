import { describe, it, expect, vi } from 'vitest'
import { generateTreeFromName, TreeGenerationError } from './generateTree.js'
import type { AnthropicMessageClient } from './generateTree.js'

const validToolInput = {
  creatureLabel: 'crane',
  legs: [
    { label: 'wing-a', length: 1 },
    { label: 'wing-b', length: 1 },
    { label: 'head', length: 1 },
    { label: 'tail', length: 1.5 },
  ],
}

function makeClient(toolInputs: (unknown | null)[]): AnthropicMessageClient {
  let call = 0
  return {
    createMessage: vi.fn(async () => {
      const input = toolInputs[call]
      call++
      return input === null ? { toolInput: null } : { toolInput: input }
    }),
  }
}

describe('generateTreeFromName', () => {
  it('returns a valid Tree on first successful attempt', async () => {
    const client = makeClient([validToolInput])
    const tree = await generateTreeFromName('crane', client)
    expect(tree.nodes).toHaveLength(5)
    expect(client.createMessage).toHaveBeenCalledTimes(1)
  })

  it('retries once when the first tool call returns null (no tool use)', async () => {
    const client = makeClient([null, validToolInput])
    const tree = await generateTreeFromName('crane', client)
    expect(tree.nodes).toHaveLength(5)
    expect(client.createMessage).toHaveBeenCalledTimes(2)
  })

  it('retries once when the first tool input fails geometric validation (e.g. wrong leg count)', async () => {
    const invalidInput = { creatureLabel: 'crane', legs: [{ label: 'a', length: 1 }] }
    const client = makeClient([invalidInput, validToolInput])
    const tree = await generateTreeFromName('crane', client)
    expect(tree.nodes).toHaveLength(5)
    expect(client.createMessage).toHaveBeenCalledTimes(2)
  })

  it('throws TreeGenerationError when both attempts fail', async () => {
    const client = makeClient([null, null])
    await expect(generateTreeFromName('crane', client)).rejects.toThrow(TreeGenerationError)
    expect(client.createMessage).toHaveBeenCalledTimes(2)
  })

  it('throws TreeGenerationError when both attempts produce geometrically invalid trees', async () => {
    const badInput = { creatureLabel: 'crane', legs: [{ label: 'a', length: -1 }] }
    const client = makeClient([badInput, badInput])
    await expect(generateTreeFromName('crane', client)).rejects.toThrow(TreeGenerationError)
  })

  it('passes the animal name into the user message sent to the client', async () => {
    const client = makeClient([validToolInput])
    await generateTreeFromName('도마뱀', client)
    const call = (client.createMessage as any).mock.calls[0][0]
    expect(call.userMessage).toContain('도마뱀')
  })
})
