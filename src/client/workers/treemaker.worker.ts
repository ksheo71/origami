import { treeToFold } from '../../treemaker/treemaker.js'
import type { Tree } from '../../shared/tree.js'
import type { FoldDocument } from '../../shared/fold.js'

export interface TreemakerWorkerRequest {
  tree: Tree
}

export type TreemakerWorkerResponse = { fold: FoldDocument } | { error: string }

self.addEventListener('message', (event: MessageEvent<TreemakerWorkerRequest>) => {
  try {
    const fold = treeToFold(event.data.tree)
    const response: TreemakerWorkerResponse = { fold }
    ;(self as unknown as Worker).postMessage(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error computing crease pattern'
    const response: TreemakerWorkerResponse = { error: message }
    ;(self as unknown as Worker).postMessage(response)
  }
})
