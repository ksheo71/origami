import type { Tree } from '../../shared/tree.js'

export interface TripodLeg {
  label: string
  length: number
}

export interface TripodToolInput {
  creatureLabel: string
  legs: [TripodLeg, TripodLeg, TripodLeg]
}

export const TREE_TOOL_NAME = 'emit_animal_tripod'

export const TREE_TOOL_SCHEMA = {
  name: TREE_TOOL_NAME,
  description:
    '동물 이름을 종이접기용 "트라이포드"(분기점 1개 + 다리 3개짜리 별 모양 스틱 피겨)로 변환한다. ' +
    '항상 정확히 3개의 다리만 만든다 — 실제 동물의 다리 개수와 무관하게, 가장 단순화된 형태로 추상화한다.',
  input_schema: {
    type: 'object',
    properties: {
      creatureLabel: {
        type: 'string',
        description: '입력받은 동물 이름 그대로 (예: "학", "도마뱀").',
      },
      legs: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        description: '정확히 3개. 각 다리는 상대적 길이(양수)를 가진다.',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: '이 다리가 무엇을 상징하는지 (예: "wing-left", "tail").',
            },
            length: {
              type: 'number',
              exclusiveMinimum: 0,
              description: '다른 다리 대비 상대적 길이. 1.0을 기준으로 삼는다.',
            },
          },
          required: ['label', 'length'],
        },
      },
    },
    required: ['creatureLabel', 'legs'],
  },
} as const

export function buildSystemPrompt(): string {
  return [
    '당신은 동물 이름을 받아 종이접기 설계용 스틱 피겨로 변환하는 어시스턴트입니다.',
    '',
    `반드시 ${TREE_TOOL_NAME} 도구를 호출해서 답하세요. 다른 형식의 답변은 허용되지 않습니다.`,
    '',
    '규칙:',
    '- 다리는 항상 정확히 3개입니다. 실제 동물의 다리·날개·머리·꼬리 개수와 무관하게,',
    '  그 동물을 대표하는 가장 중요한 3개의 신체 부위(또는 방향)로 단순화하세요.',
    '  예: 학이라면 "양 날개"와 "머리+꼬리" 축 하나로 묶어 3개를 만들 수 있습니다.',
    '- 길이는 1.0을 기준으로 한 상대값입니다. 대칭적인 동물이면 3개 다리 길이를 비슷하게,',
    '  비대칭이 두드러지는 동물(예: 긴 꼬리)이면 그 다리만 길게 설정하세요.',
    '- creatureLabel에는 입력받은 이름을 그대로 넣으세요.',
  ].join('\n')
}

export function tripodInputToTree(input: TripodToolInput): Tree {
  for (const leg of input.legs) {
    if (leg.length <= 0) {
      throw new Error(`tripodInputToTree: leg length must be positive, got ${leg.length} for "${leg.label}"`)
    }
  }

  return {
    nodes: [
      { id: 'branch', label: input.creatureLabel },
      { id: 'leg-0', label: input.legs[0].label },
      { id: 'leg-1', label: input.legs[1].label },
      { id: 'leg-2', label: input.legs[2].label },
    ],
    edges: [
      { from: 'branch', to: 'leg-0', length: input.legs[0].length },
      { from: 'branch', to: 'leg-1', length: input.legs[1].length },
      { from: 'branch', to: 'leg-2', length: input.legs[2].length },
    ],
  }
}
