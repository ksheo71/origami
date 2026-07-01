import type { Tree } from '../../shared/tree.js'

export function buildTreeFromNameRequestBody(name: string): string {
  return JSON.stringify({ name })
}

export function parseTreeFromNameResponse(
  status: number,
  body: unknown,
): { tree: Tree } | { error: string } {
  if (status === 200 && typeof body === 'object' && body !== null && 'tree' in body) {
    return { tree: (body as { tree: Tree }).tree }
  }
  if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string') {
    return { error: (body as { error: string }).error }
  }
  return { error: `unexpected response (status ${status})` }
}
