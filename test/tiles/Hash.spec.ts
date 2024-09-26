
import crypto from 'crypto'

import { Hash, to_hex, EmptyBuffer } from "../../src";

const th = new Hash((data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}, 32)

it('Hasher', () => {

  const empty_root = th.empty_root();
  expect(to_hex(empty_root)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  const emptyLeaf = th.hash_leaf(EmptyBuffer);
  expect(to_hex(emptyLeaf)).toBe('6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d')
  // beware these are fake intermediates
  const intermediateHash = th.hash_children(Buffer.from('N123'), Buffer.from('N456'))
  expect(to_hex(intermediateHash)).toBe('aa217fe888e47007fa15edab33c2b492a722cb106c64667fc2b044444de66bbb')
})