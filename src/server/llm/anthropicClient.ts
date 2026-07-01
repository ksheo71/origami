import Anthropic from '@anthropic-ai/sdk'
import type { AnthropicMessageClient } from './generateTree.js'

const MODEL = 'claude-sonnet-5'

export function createAnthropicClient(apiKey: string): AnthropicMessageClient {
  const anthropic = new Anthropic({ apiKey })

  return {
    async createMessage({ system, tools, toolChoice, userMessage }) {
      // @anthropic-ai/sdk v0.32.0의 타입은 `thinking`을 모른다(아직 SDK 타입이
      // 최신 API를 못 따라감). 런타임은 body를 그대로 POST하므로 실제로는
      // 전달된다 — 확인된 사실이지 no-op이 아니다. 타입 좁히기는 이 필드
      // 하나에만 국한한다(전체 params를 any로 풀지 않음).
      const params: Anthropic.MessageCreateParams & { thinking: { type: 'disabled' } } = {
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: tools as Anthropic.Tool[],
        tool_choice: toolChoice as Anthropic.MessageCreateParams['tool_choice'],
        messages: [{ role: 'user', content: userMessage }],
        thinking: { type: 'disabled' },
      }
      const response = await anthropic.messages.create(params)

      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )

      return { toolInput: toolUseBlock ? toolUseBlock.input : null }
    },
  }
}
