export interface OrigamiModel {
  id: string
  nameKo: string
  nameEn: string
  category: 'animal' | 'base' | 'simple'
  difficulty: 'easy' | 'medium' | 'hard'
  source: string
  license: string
  svgPath: string
  description?: string
}

export const CATALOG: OrigamiModel[] = [
  { id: 'crane', nameKo: '학', nameEn: 'Crane', category: 'animal', difficulty: 'medium', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/traditionalCrane.svg', description: '가장 유명한 전통 종이접기.' },
  { id: 'flapping-bird', nameKo: '펄럭이는 새', nameEn: 'Flapping Bird', category: 'animal', difficulty: 'medium', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/flappingBird.svg', description: '꼬리를 당기면 날개가 퍼덕인다.' },
  { id: 'airplane', nameKo: '종이비행기', nameEn: 'Paper Airplane', category: 'simple', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/airplane.svg' },
  { id: 'bird-base', nameKo: '새 기본형', nameEn: 'Bird Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/birdBase.svg', description: '학·새 계열의 출발점.' },
  { id: 'frog-base', nameKo: '개구리 기본형', nameEn: 'Frog Base', category: 'base', difficulty: 'medium', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/frogBase.svg' },
  { id: 'waterbomb-base', nameKo: '물풍선 기본형', nameEn: 'Waterbomb Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/waterbombBase.svg' },
  { id: 'boat-base', nameKo: '배 기본형', nameEn: 'Boat Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/boatBase.svg' },
  { id: 'square-base', nameKo: '정사각 기본형', nameEn: 'Preliminary Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/squareBase.svg' },
  { id: 'pinwheel-base', nameKo: '바람개비 기본형', nameEn: 'Pinwheel Base', category: 'base', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/pinwheelBase.svg' },
  { id: 'map-fold', nameKo: '지도 접기', nameEn: 'Map Fold', category: 'simple', difficulty: 'easy', source: '전통', license: 'public domain (traditional)', svgPath: '/catalog/mapfold.svg' },
]

export function getModelById(id: string): OrigamiModel | undefined {
  return CATALOG.find((model) => model.id === id)
}

export function filterModels(
  models: OrigamiModel[],
  query: string,
  category: OrigamiModel['category'] | null,
): OrigamiModel[] {
  const q = query.trim().toLowerCase()
  return models.filter((model) => {
    const matchesCategory = category === null || model.category === category
    const matchesQuery =
      q === '' ||
      model.nameKo.toLowerCase().includes(q) ||
      model.nameEn.toLowerCase().includes(q) ||
      model.id.includes(q)
    return matchesCategory && matchesQuery
  })
}
