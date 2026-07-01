import type { Tree } from '../../shared/tree.js'
import { treeToFold } from '../../treemaker/treemaker.js'
import { TREE_TOOL_NAME, TREE_TOOL_SCHEMA, buildSystemPrompt, tripodInputToTree } from './treeTool.js'
import type { TripodToolInput } from './treeTool.js'

export interface AnthropicMessageClient {
  createMessage(params: {
    system: string
    tools: unknown[]
    toolChoice: unknown
    userMessage: string
  }): Promise<{ toolInput: unknown }>
}

export class TreeGenerationError extends Error {}

function isTripodToolInput(value: unknown): value is TripodToolInput {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { creatureLabel?: unknown; legs?: unknown }
  if (typeof candidate.creatureLabel !== 'string') return false
  if (!Array.isArray(candidate.legs) || candidate.legs.length !== 3) return false
  return candidate.legs.every(
    (leg): leg is { label: string; length: number } =>
      typeof leg === 'object' &&
      leg !== null &&
      typeof (leg as { label?: unknown }).label === 'string' &&
      typeof (leg as { length?: unknown }).length === 'number',
  )
}

async function attemptOnce(name: string, client: AnthropicMessageClient): Promise<Tree | null> {
  const response = await client.createMessage({
    system: buildSystemPrompt(),
    tools: [TREE_TOOL_SCHEMA],
    toolChoice: { type: 'tool', name: TREE_TOOL_NAME },
    userMessage: `동물: ${name}`,
  })

  if (!isTripodToolInput(response.toolInput)) {
    return null
  }

  try {
    const tree = tripodInputToTree(response.toolInput)
    treeToFold(tree) // Phase 1 파이프라인 재사용 — 던지면 무효한 트리
    return tree
  } catch {
    return null
  }
}

export async function generateTreeFromName(name: string, client: AnthropicMessageClient): Promise<Tree> {
  const first = await attemptOnce(name, client)
  if (first) return first

  const second = await attemptOnce(name, client)
  if (second) return second

  throw new TreeGenerationError(`generateTreeFromName: failed to produce a valid tripod tree for "${name}" after 2 attempts`)
}
