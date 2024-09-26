

import { Hash } from "./Hash"

import { TileHashReader, Tile, tile_to_path, tile_for_storage_id, HashFromTile, TreeHash, StoredHashes, StoredHashCount } from "./Tile"


export class TileLog {
  public th: Hash
  public thr: TileHashReader
  public treeSize = 0
  public treeRoot: Uint8Array
  public read_tile
  public maybe_grow_tile
  constructor(
    hash_function: (bytes: Uint8Array) => Uint8Array,
    hash_size: number,
    read_tile: (tile: string) => Uint8Array,
    maybe_grow_tile: (storageId: number, hash: Uint8Array) => Uint8Array | null
  ) {
    this.th = new Hash(hash_function, hash_size)
    this.treeRoot = this.th.emptyRoot()
    this.thr = new TileHashReader(this.treeSize, this.treeRoot, this)
    this.read_tile = read_tile
    this.maybe_grow_tile = maybe_grow_tile
  }
  height() {
    return 2
  }
  read_tiles(tiles: Tile[]) {
    const result = [] as Uint8Array[]
    for (const tile of tiles) {
      const tileData = this.read_tile(tile_to_path(tile))
      result.push(tileData)
    }
    return result
  }
  save_tiles(tiles: Tile[]) {
    // 
  }
  read_hashes(storageIds: number[]) {
    return storageIds.map((storageId) => {
      const [tile] = tile_for_storage_id(2, storageId)
      const tileData = this.read_tile(tile_to_path(tile))
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