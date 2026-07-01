import type { Tree } from '../../shared/tree.js'

export interface StarLegInput {
  label: string
  length: number
}

export interface StarToolInput {
  creatureLabel: string
  legs: StarLegInput[]
}

export const TREE_TOOL_NAME = 'emit_animal_star'

export const TREE_TOOL_SCHEMA = {
  name: TREE_TOOL_NAME,
  description:
    '동물 이름을 종이접기용 "별 모양"(분기점 1개 + 다리 4~6개짜리 스틱 피겨)으로 변환한다. ' +
    '실제 동물의 주요 신체 부위(머리·꼬리·다리·날개)를 4~6개의 다리로 표현한다.',
  input_schema: {
    type: 'object',
    properties: {
      creatureLabel: {
        type: 'string',
        description: '입력받은 동물 이름 그대로 (예: "학", "사자").',
      },
      legs: {
        type: 'array',
        minItems: 4,
        maxItems: 6,
        description: '4개 이상 6개 이하. 각 다리는 상대적 길이(양수)를 가진다.',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: '이 다리가 무엇을 상징하는지 (예: "wing-left", "tail", "leg-front").',
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
    '- 다리는 4개 이상 6개 이하입니다. 그 동물을 대표하는 주요 신체 부위',
    '  (머리·목·꼬리·다리·날개 등)를 4~6개 골라 각각 하나의 다리로 표현하세요.',
    '  예: 사자라면 머리, 꼬리, 앞다리, 뒷다리 → 4개. 학이라면 양 날개, 머리, 꼬리 → 4개.',
    '- 길이는 1.0을 기준으로 한 상대값입니다. 두드러지게 긴 부위(긴 꼬리·목)는 길게,',
    '  짧은 부위는 짧게 설정하되, 한 다리가 나머지 합을 압도하지 않도록 하세요',
    '  (너무 극단적이면 접기 도면을 만들 수 없습니다).',
    '- creatureLabel에는 입력받은 이름을 그대로 넣으세요.',
  ].join('\n')
}

export function starInputToTree(input: StarToolInput): Tree {
  for (const leg of input.legs) {
    if (leg.length <= 0) {
      throw new Error(
        `starInputToTree: leg length must be positive, got ${leg.length} for "${leg.label}"`,
      )
    }
  }

  return {
    nodes: [
      { id: 'branch', label: input.creatureLabel },
      ...input.legs.map((leg, i) => ({ id: `leg-${i}`, label: leg.label })),
    ],
    edges: input.legs.map((leg, i) => ({ from: 'branch', to: `leg-${i}`, length: leg.length })),
  }
}
