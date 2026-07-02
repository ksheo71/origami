import { describe, it, expect } from 'vitest'
import { parseRoute } from './router.js'

describe('parseRoute', () => {
  it('maps / to gallery', () => {
    expect(parseRoute('/')).toEqual({ name: 'gallery' })
    expect(parseRoute('')).toEqual({ name: 'gallery' })
  })
  it('maps /model/:id to model with decoded id', () => {
    expect(parseRoute('/model/crane')).toEqual({ name: 'model', id: 'crane' })
    expect(parseRoute('/model/bird-base/')).toEqual({ name: 'model', id: 'bird-base' })
  })
  it('maps unknown paths to notFound', () => {
    expect(parseRoute('/whatever')).toEqual({ name: 'notFound' })
    expect(parseRoute('/model/')).toEqual({ name: 'notFound' })
  })
})
