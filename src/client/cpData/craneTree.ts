import type { Tree } from '../../shared/tree.js'

export const craneTree: Tree = {
  nodes: [
    { id: 'branch', label: 'body' },
    { id: 'leaf-a', label: 'wing-a' },
    { id: 'leaf-b', label: 'wing-b' },
    { id: 'leaf-c', label: 'head-tail' },
  ],
  edges: [
    { from: 'branch', to: 'leaf-a', length: 1 },
    { from: 'branch', to: 'leaf-b', length: 1 },
    { from: 'branch', to: 'leaf-c', length: 1 },
  ],
}
