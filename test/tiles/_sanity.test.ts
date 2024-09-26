import crypto from 'crypto'
import { StoredHashes, TileForIndex, Path, TreeHash, Tile, StoredHashCount, Hash, TileHashReader, HashFromTile, NewTiles, ReadTileData, SplitStoredHashIndex } from "../../src"

import { treeHead } from '../../src/RFC9162';

const encoder = new TextEncoder()

const encode = (data: string) => {
  return encoder.encode(data)
}

const globalTiles = {} as any

class TileLog {
  public th: Hash
  public thr: TileHashReader
  public treeSize = 0
  public treeRoot: Uint8Array
  constructor() {
    this.th = new Hash((data: Uint8Array) => {
      return new Uint8Array(crypto.createHash('sha256').update(data).digest());
    }, 32)
    this.treeRoot = this.th.emptyRoot()
    this.thr = new TileHashReader(this.treeSize, this.treeRoot, this)
  }
  height() {
    return 2
  }
  read_tiles(tiles: Tile[]) {
    const result = [] as Uint8Array[]
    for (const tile of tiles) {
      const tileData = this.read_tile(Path(tile))
      result.push(tileData)
    }
    return result
  }
  save_tiles(tiles: Tile[]) {
    // 
  }
  read_hashes(storageIds: number[]) {
    return storageIds.map((storageId) => {
      const [tile] = TileForIndex(2, storageId)
      const tileData = this.read_tile(Path(tile))
      const hash = HashFromTile(tile, tileData, storageId)
      return hash
    })
  }
  size() {
    return this.treeSize
  }
  root() {
    const hash = TreeHash(this.treeSize, this)
    return Buffer.from(hash).toString('base64')
  }
  read_tile = (tile: string): Uint8Array => {
    const [baseTile] = tile.split('.')
    for (let i = 4; i > 0; i--) {
      const relatedTile = baseTile + '.' + i
      if (globalTiles[relatedTile]) {
        return globalTiles[relatedTile]
      }
    }
    return new Uint8Array(32)
  }
  maybe_grow_tile = (storageId: number, hash: Uint8Array) => {
    const [tile, start, end] = TileForIndex(2, storageId)
    const tileName = Path(tile)
    let tileData = this.read_tile(tileName)
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
    globalTiles[tileName] = tileData
    return tileData
  }
  write_record = (record: Uint8Array) => {
    const leafIndex = this.size()
    const hashes = StoredHashes(leafIndex, record, this)
    // problem here....
    const storageIdIndexStart = StoredHashCount(leafIndex)
    let storageId = storageIdIndexStart
    for (const hash of hashes) {
      // some hashes here, are not meant to be stored at all!
      // need to figure out if a hash belongs in a tile or not.
      const tileData = this.maybe_grow_tile(storageId, hash)
      if (tileData === null) {
        storageId++
        continue
      }
      storageId++
    }
    this.treeSize++;
  }
}


it('only persist tiles', async () => {
  const log = new TileLog()
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