
import { treeHead } from '../../src/RFC9162';
import { Tree, TileLog } from "../../src";
import { tile_params, encode, th } from './test_utils';

it('only persist tiles', async () => {
  const log = new TileLog(tile_params)
  const entries = [] as Uint8Array[]
  const root1 = Buffer.from(await treeHead(entries)).toString('base64')
  const root2 = log.head()
  expect(root1).toBe(root2)
  expect(root1).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
  for (let i = 0; i < 26; i++) {
    const entry = encode(`entry-${i}`)
    log.write_record(entry)
    entries.push(entry)
    const root1 = Buffer.from(await treeHead(entries)).toString('base64')
    const root2 = log.head()
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
  const tree = new Tree(th)
  const entries: Uint8Array[] = []
  for (let i = 0; i < 26; i++) {
    const message = `entry-${i}`
    const data = new TextEncoder().encode(message)
    entries.push(data)
    tree.appendData(tree.encodeData(message))
  }
  const tileTreeEncoded = tree.hashes[0].map((h) => Buffer.from(h).toString('base64'))
  const oldTreeEncoded = entries.map((h) => Buffer.from(tree.th.hash_leaf(h)).toString('base64'))
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
    .toEqual(Buffer.from(tree.hashAt(7)).toString('base64'))
})
