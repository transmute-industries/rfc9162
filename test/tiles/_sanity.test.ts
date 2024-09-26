import crypto from 'crypto'
import { TileLog } from '../../src/Tiles/TileLog'
import { treeHead } from '../../src/RFC9162';
import { tile_for_storage_id, tile_to_path } from '../../src/Tiles/Tile';

const global_tiles = {} as Record<string, Uint8Array>

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

const maybe_grow_tile = (storageId: number, hash: Uint8Array) => {
  const [tile, start, end] = tile_for_storage_id(2, storageId)
  const tileName = tile_to_path(tile)
  let tileData = read_tile(tileName)
  if (tileData.length < end) {
    const tileData2 = new Uint8Array(tileData.length + 32)
    tileData2.set(tileData)
    tileData = tileData2
  }
  if (end - start !== 32) {
    return null
  } else {
    tileData.set(hash, start)
  }
  global_tiles[tileName] = tileData
  return tileData
}


it('only persist tiles', async () => {
  const log = new TileLog(hash_function, hash_size, read_tile, maybe_grow_tile)
  const entries = [] as Uint8Array[]
  const root1 = Buffer.from(await treeHead(entries)).toString('base64')
  const root2 = log.root()
  expect(root1).toBe(root2)
  expect(root1).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
  for (let i = 0; i < 26; i++) {
    const entry = encode(`entry-${i}`)
    log.write_record(entry)
    entries.push(entry)
    const root1 = Buffer.from(await treeHead(entries)).toString('base64')
    const root2 = log.root()
    expect(root1).toBe(root2)
  }
})