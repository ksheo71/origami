import { validateTree } from '../shared/tree.js'
import { validateFold } from '../shared/fold.js'
import type { Tree } from '../shared/tree.js'
import type { FoldDocument } from '../shared/fold.js'
import { toStarTree } from './starTree.js'
import { packStarLeaves } from './starPacking.js'
import { buildStarMolecule } from './starMolecule.js'
import { assembleFold } from './foldAssembly.js'

export function treeToFold(tree: Tree): FoldDocument {
  validateTree(tree)
  const star = toStarTree(tree)
  const packing = packStarLeaves(star)
  const molecule = buildStarMolecule(packing)
  const fold = assembleFold(packing, molecule)
  validateFold(fold)
  return fold
}
