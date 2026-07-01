import Anthropic from '@anthropic-ai/sdk'
import type { AnthropicMessageClient } from './generateTree.js'

const MODEL = 'claude-sonnet-5'

export function createAnthropicClient(apiKey: string): AnthropicMessageClient {
  const anthropic = new Anthropic({ apiKey })

  return {
    async createMessage({ system, tools, toolChoice, userMessage }) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: tools as Anthropic.Tool[],
        tool_choice: toolChoice as Anthropic.MessageCreateParams['tool_choice'],
        messages: [{ role: 'user', content: userMessage }],
      })

      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )

      return { toolInput: toolUseBlock ? toolUseBlock.input : null }
    },
  }
}
