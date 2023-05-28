import { HASH } from '../RFC9162/HASH'
import { CONCAT } from '../RFC9162/CONCAT'
import { hexToBin } from '../RFC9162/hexToBin'

export const getLeafFromEntry = (entry: Uint8Array): Uint8Array => {
  if (!entry) {
    throw new Error('getLeafFromEntry requires a Uint8Array entry.')
  }
  const prefix = hexToBin('00')
  return HASH(CONCAT(prefix, entry))
}
