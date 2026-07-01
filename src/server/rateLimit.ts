export interface RateLimiter {
  tryConsume(key: string): boolean
}

export function createRateLimiter(windowMs: number, maxRequests: number): RateLimiter {
  const store = new Map<string, { count: number; windowStart: number }>()
  return {
    tryConsume(key: string): boolean {
      const now = Date.now()
      const entry = store.get(key)
      if (!entry || now - entry.windowStart >= windowMs) {
        store.set(key, { count: 1, windowStart: now })
        return true
      }
      if (entry.count >= maxRequests) {
        return false
      }
      entry.count += 1
      return true
    },
  }
}
