
import { treeHead } from '../../src/RFC9162';
import { Tree, TileLog, to_hex, tile_for_storage_id, stored_hash_index, new_tiles } from "../../src";
import { tile_params, encode, tree_hasher, pretty_hash } from './test_utils';

it('only persist tiles', async () => {
  const log = new TileLog(tile_params)
  const entries = [] as Uint8Array[]
  const root1 = Buffer.from(await treeHead(entries)).toString('base64')
  const root2 = pretty_hash(log.root())
  expect(root1).toBe(root2)
  expect(root1).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
  for (let i = 0; i < 26; i++) {
    const entry = encode(`entry-${i}`)
    log.write_record(entry)
    entries.push(entry)
    const root1 = Buffer.from(await treeHead(entries)).toString('base64')
    const root2 = pretty_hash(log.root())
    expect(root1).toBe(root2)
  }

  const record_hash3 = log.record_hash(encode(`entry-${3}`))
  const root_at_20 = log.root_at(20)
  const inclusion_proof = log.inclusion_proof(20, 3)
  const verified_inclusion = log.verify_inclusion_proof(root_at_20, inclusion_proof, record_hash3)
  expect(verified_inclusion).toBe(true)

  const reconstructed_old_root = log.root_from_inclusion_proof(inclusion_proof, record_hash3)
  expect(reconstructed_old_root).toEqual(root_at_20)

  const consistency_proof = log.consistency_proof(20, log.size())
  const verified_consistency = log.verify_consistency_proof(root_at_20, consistency_proof, log.root())
  expect(verified_consistency).toBe(true)

  const reconstructed_new_root = log.root_from_consistency_proof(root_at_20, consistency_proof)
  expect(reconstructed_new_root).toEqual(log.root())
})


it('generate log entries', async () => {
  const tree = new Tree(tree_hasher)
  const entries: Uint8Array[] = []
  for (let i = 0; i < 26; i++) {
    const message = `entry-${i}`
    const data = new TextEncoder().encode(message)
    entries.push(data)
    tree.append_data(tree.encode_data(message))
  }
  const tileTreeEncoded = tree.hashes[0].map((h) => Buffer.from(h).toString('base64'))
  const oldTreeEncoded = entries.map((h) => Buffer.from(tree.tree_hasher.hash_leaf(h)).toString('base64'))
  // tree equality from leaf equality
  expect(tileTreeEncoded)
    .toEqual(oldTreeEncoded)
  // tree equality by root comparison
  expect(Buffer.from(await treeHead(entries)).toString('hex'))
    .toEqual(Buffer.from(tree.hash()).toString('hex'))

  expect(Buffer.from(await treeHead(entries)).toString('base64'))
    .toBe('eMR1/fvh2IykZmA/Q7o3SypidfJRgnhWN5SPTPSeNeE=')

  // tree equality from hash at size
  expect(Buffer.from(await treeHead(entries.slice(0, 7))).toString('base64'))
    .toEqual(Buffer.from(tree.root_at(7)).toString('base64'))
})


it('tree hasher', () => {
  const empty_root = tree_hasher.empty_root();
  expect(to_hex(empty_root)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  const emptyLeaf = tree_hasher.hash_leaf(Buffer.from(new Uint8Array()));
  expect(to_hex(emptyLeaf)).toBe('6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d')
  // beware these are fake intermediates
  const intermediateHash = tree_hasher.hash_children(Buffer.from('N123'), Buffer.from('N456'))
  expect(to_hex(intermediateHash)).toBe('aa217fe888e47007fa15edab33c2b492a722cb106c64667fc2b044444de66bbb')
})

it('tile_for_storage_id', () => {
  expect(tile_for_storage_id(tree_hasher.hash_size, 2, 0)).toEqual([[2, 0, 0, 1], 0, 32])
  expect(tile_for_storage_id(tree_hasher.hash_size, 2, 1)).toEqual([[2, 0, 0, 2], 32, 64])
  expect(tile_for_storage_id(tree_hasher.hash_size, 2, 2)).toEqual([[2, 0, 0, 2], 0, 64])
  expect(tile_for_storage_id(tree_hasher.hash_size, 2, 3)).toEqual([[2, 0, 0, 3], 64, 96])
  expect(tile_for_storage_id(tree_hasher.hash_size, 8, 9)).toEqual([[8, 0, 0, 6], 128, 192])
})


it('stored_hash_index', () => {
  expect(stored_hash_index(0, 2)).toEqual(3)
  expect(stored_hash_index(0, 3)).toEqual(4)
  expect(stored_hash_index(0, 4)).toEqual(7)
  expect(stored_hash_index(0, 5)).toEqual(8)
})

it('new_tiles', () => {
  expect(new_tiles(2, 0, 1)).toEqual([[2, 0, 0, 1]])
  expect(new_tiles(2, 1, 2)).toEqual([[2, 0, 0, 2]])
})
