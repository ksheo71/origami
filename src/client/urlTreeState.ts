import type { Tree } from '../shared/tree.js'
import { treeToFold } from '../treemaker/treemaker.js'

export function encodeTreeToUrlParam(tree: Tree): string {
  const json = JSON.stringify(tree)
  const base64 = btoa(unescape(encodeURIComponent(json)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeTreeFromUrlParam(param: string): Tree | null {
  try {
    const base64 = param.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(escape(atob(padded)))
    const parsed = JSON.parse(json) as Tree
    treeToFold(parsed) // validates connectivity AND the Phase 1 engine's tripod shape requirement
    return parsed
  } catch {
    return null
  }
}
