import { treeToFold } from '../../treemaker/treemaker.js'
import type { Tree } from '../../shared/tree.js'
import type { FoldDocument } from '../../shared/fold.js'

export interface TreemakerWorkerRequest {
  tree: Tree
}

export interface TreemakerWorkerResponse {
  fold: FoldDocument
}

self.addEventListener('message', (event: MessageEvent<TreemakerWorkerRequest>) => {
  const fold = treeToFold(event.data.tree)
  const response: TreemakerWorkerResponse = { fold }
  ;(self as unknown as Worker).postMessage(response)
})
