

import { EQUAL } from './EQUAL'
import { InclusionProofDataV2 } from './inclusionProof'
import { root_from_inclusion } from './root_from_inclusion'

export const verifyInclusionProof = async (
  root_hash: Uint8Array,
  hash: Uint8Array,
  proof: InclusionProofDataV2,
): Promise<boolean> => {
  try {
    const reconstructed_root = await root_from_inclusion(hash, proof)
    const roots_match = EQUAL(reconstructed_root, root_hash)
    return roots_match
  } catch {
    return false
  }
}
