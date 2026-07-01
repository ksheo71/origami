import { describe, it, expect } from 'vitest'
import { createRateLimiter } from './rateLimit.js'

describe('createRateLimiter', () => {
  it('allows requests up to the max within the window', () => {
    const limiter = createRateLimiter(60_000, 3)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
  })

  it('rejects requests beyond the max within the window', () => {
    const limiter = createRateLimiter(60_000, 3)
    limiter.tryConsume('a')
    limiter.tryConsume('a')
    limiter.tryConsume('a')
    expect(limiter.tryConsume('a')).toBe(false)
  })

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter(60_000, 1)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('b')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
  })

  it('resets the count after the window elapses', async () => {
    const limiter = createRateLimiter(50, 1)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
    await new Promise((r) => setTimeout(r, 60))
    expect(limiter.tryConsume('a')).toBe(true)
  })
})
