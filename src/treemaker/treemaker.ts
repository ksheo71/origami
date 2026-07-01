import { validateTree } from '../shared/tree.js'
import { validateFold } from '../shared/fold.js'
import type { Tree } from '../shared/tree.js'
import type { FoldDocument } from '../shared/fold.js'
import { buildStarTripod } from './starTripod.js'
import { buildRabbitEarMolecule } from './rabbitEarMolecule.js'
import { assembleFold } from './foldAssembly.js'

export function treeToFold(tree: Tree): FoldDocument {
  validateTree(tree)
  const tripod = buildStarTripod(tree)
  const molecule = buildRabbitEarMolecule(tripod.leaves)
  const fold = assembleFold(tripod, molecule)
  validateFold(fold)
  return fold
}
