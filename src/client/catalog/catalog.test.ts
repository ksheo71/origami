import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOG, getModelById, filterModels } from './catalog.js'

describe('CATALOG', () => {
  it('has at least 10 models with unique ids', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(10)
    const ids = CATALOG.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every svgPath points at an existing public asset', () => {
    for (const m of CATALOG) {
      expect(m.svgPath.startsWith('/catalog/')).toBe(true)
      const abs = join(process.cwd(), 'src/client/public', m.svgPath)
      expect(() => readFileSync(abs, 'utf8')).not.toThrow()
    }
  })

  it('contains no copyrighted (lang/randlett/gardner) source files', () => {
    for (const m of CATALOG) {
      expect(/lang|randlett|moosers/i.test(m.svgPath)).toBe(false)
    }
  })

  it('includes the crane', () => {
    const crane = getModelById('crane')
    expect(crane?.nameKo).toBe('학')
  })
})

describe('getModelById', () => {
  it('returns undefined for unknown id', () => {
    expect(getModelById('does-not-exist')).toBeUndefined()
  })
})

describe('filterModels', () => {
  it('filters by category', () => {
    const bases = filterModels(CATALOG, '', 'base')
    expect(bases.length).toBeGreaterThan(0)
    expect(bases.every((m) => m.category === 'base')).toBe(true)
  })

  it('matches Korean and English names case-insensitively', () => {
    expect(filterModels(CATALOG, '학', null).some((m) => m.id === 'crane')).toBe(true)
    expect(filterModels(CATALOG, 'CRANE', null).some((m) => m.id === 'crane')).toBe(true)
  })

  it('empty query + null category returns everything', () => {
    expect(filterModels(CATALOG, '', null)).toHaveLength(CATALOG.length)
  })
})
