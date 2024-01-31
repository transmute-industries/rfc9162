import { CONCAT } from './CONCAT'
import { hexToBin } from './hexToBin'
import { HASH } from './HASH'

import { EQUAL } from './EQUAL'

import { InclusionProofDataV2 } from './inclusionProof'

export const verifyInclusionProof = async (
  root_hash: Uint8Array,
  hash: Uint8Array,
  proof: InclusionProofDataV2,
): Promise<boolean> => {
  const { tree_size, leaf_index, inclusion_path } = proof
  if (leaf_index > tree_size) {
    return false
  }
  let fn = leaf_index
  let sn = tree_size - 1
  let r = hash
  const prefix = hexToBin('01')
  for (const p of inclusion_path) {
    // a.  If sn is 0, then stop the iteration and fail the proof verification.
    if (sn === 0) {
      return false
    }
    // b.  If LSB(fn) is set, or if fn is equal to sn, then:
    if (fn % 2 === 1 || fn === sn) {
      // i.   Set r to HASH(0x01 || p || r).
      r = await HASH(CONCAT(prefix, CONCAT(p, r)))
      // ii.  If LSB(fn) is not set, then right-shift both fn and sn
      // equally until either LSB(fn) is set or fn is 0.
      while (fn % 2 !== 1) {
        fn = fn >> 1
        sn = sn >> 1
        if (fn === 0) {
          break
        }
      }
      // Otherwise:
    } else {
      // i.  Set r to HASH(0x01 || r || p).
      r = await HASH(CONCAT(prefix, CONCAT(r, p)))
    }
    // c.  Finally, right-shift both fn and sn one time.
    fn = fn >> 1
    sn = sn >> 1
  }
  const roots_match = EQUAL(r, root_hash)
  const sn_is_0 = sn === 0
  return sn_is_0 && roots_match
}
