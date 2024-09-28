
import { EQUAL } from "./EQUAL";
import { ConsistencyProofDataV2 } from "./consistencyProof";
import { root_from_consistency } from "./root_from_consistency";

export const verifyConsistencyProof = async (hash1: Uint8Array, hash2: Uint8Array, proof: ConsistencyProofDataV2): Promise<boolean> => {
  const reconstructed_root = await root_from_consistency(hash1, proof)
  return EQUAL(reconstructed_root, hash2)
}