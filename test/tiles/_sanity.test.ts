import crypto from 'crypto'

import { treeHead } from '../../src/RFC9162';

import { tile_for_storage_id, tile_to_path, TileLog } from '../../src/Tiles/Tile';

const global_tiles = {} as Record<string, Uint8Array>

const tile_height = 2
const hash_size = 32

const encoder = new TextEncoder()

const encode = (data: string) => {
  return encoder.encode(data)
}

const hash_function = (data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}

const read_tile = (tile: string): Uint8Array => {
  const [baseTile] = tile.split('.')
  for (let i = 4; i > 0; i--) {
    const relatedTile = baseTile + '.' + i
    if (global_tiles[relatedTile]) {
      return global_tiles[relatedTile]
    }
  }
  return new Uint8Array(32)
}

const update_tiles = (storage_id: number, stored_hash: Uint8Array) => {
  const [tile, start, end] = tile_for_storage_id(2, storage_id)
  const tileName = tile_to_path(tile)
  let tile_data = read_tile(tileName)
  if (tile_data.length < end) {
    const expanded_tile_data = new Uint8Array(tile_data.length + 32)
    expanded_tile_data.set(tile_data)
    tile_data = expanded_tile_data
  }
  if (end - start !== 32) {
    // this hash was an intermediate of the tile
    // so it will never be persisted
    return null
  } else {
    tile_data.set(stored_hash, start)
  }
  global_tiles[tileName] = tile_data
  return tile_data
}

it('only persist tiles', async () => {
  const log = new TileLog({
    tile_height,
    hash_size,
    hash_function,
    read_tile,
    update_tiles
  })
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