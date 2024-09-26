

import { Hash } from "./Hash"

import { TileHashReader, Tile, tile_to_path, tile_for_storage_id, hash_from_tile, tree_hash, stored_hash_count, record_hash, stored_hashes_for_record_hash } from "./Tile"


export class TileLog {
  public th: Hash
  public thr: TileHashReader
  public treeSize = 0
  public treeRoot: Uint8Array
  public read_tile
  public maybe_grow_tile
  public tileHeight: number
  constructor(
    height: number,
    hash_size: number,
    hash_function: (bytes: Uint8Array) => Uint8Array,
    read_tile: (tile: string) => Uint8Array,
    maybe_grow_tile: (storageId: number, hash: Uint8Array) => Uint8Array | null
  ) {
    this.tileHeight = height
    this.th = new Hash(hash_function, hash_size)
    this.treeRoot = this.th.emptyRoot()
    this.thr = new TileHashReader(this.treeSize, this.treeRoot, this)
    this.read_tile = read_tile
    this.maybe_grow_tile = maybe_grow_tile
  }
  record_hash(data: Uint8Array) {
    return record_hash(data)
  }
  height() {
    return this.tileHeight
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
      const hash = hash_from_tile(tile, tileData, storageId)
      return hash
    })
  }
  size() {
    return this.treeSize
  }
  root() {
    const hash = tree_hash(this.treeSize, this)
    return Buffer.from(hash).toString('base64')
  }
  write_record_hashes = (record_hashes: Uint8Array[]) => {
    for (const record_hash of record_hashes) {
      const leafIndex = this.size()
      const hashes = stored_hashes_for_record_hash(leafIndex, record_hash, this)
      let storageId = stored_hash_count(leafIndex)
      for (const stored_hash of hashes) {
        // some hashes here, are not meant to be stored at all!
        // need to figure out if a hash belongs in a tile or not.
        const tileData = this.maybe_grow_tile(storageId, stored_hash)
        if (tileData === null) {
          storageId++
          continue
        }
        storageId++
      }
      this.treeSize++;
    }
  }

  write_record = (record: Uint8Array) => {
    this.write_record_hashes([this.record_hash(record)])
  }
}