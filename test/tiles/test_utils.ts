import crypto from 'crypto'
import { TreeHash, TileStorage } from "../../src";
import { tile_for_storage_id, tile_to_path, Tile } from '../../src/Tiles/Tile';

const global_tiles = {} as Record<string, Uint8Array>

export const tile_height = 2
export const hash_size = 32

const encoder = new TextEncoder()

export const encode = (data: string) => {
  return encoder.encode(data)
}

export const hash_function = (data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}

export const th = new TreeHash(hash_function, hash_size)

export const read_tile = (tile: string): Uint8Array => {
  const [baseTile] = tile.split('.')
  for (let i = 4; i > 0; i--) {
    const relatedTile = baseTile + '.' + i
    if (global_tiles[relatedTile]) {
      return global_tiles[relatedTile]
    }
  }
  return new Uint8Array(32)
}

export const update_tiles = (storage_id: number, stored_hash: Uint8Array) => {
  const [tile, start, end] = tile_for_storage_id(hash_size, 2, storage_id)
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



export const tile_params = {
  tile_height,
  hash_size,
  hash_function,
  read_tile,
  update_tiles
}

export class TestTileStorage implements TileStorage {
  public unsaved = 0
  constructor(public tiles: Record<string, Uint8Array>) { }
  height() { return 2 }  // testHeight
  read_tiles(tiles: Tile[]) {
    const out = [] as any
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      const tileName = tile_to_path(tile)
      // console.log(tileName)
      const hasTile = this.tiles[tileName]
      out.push(hasTile)
    }
    this.unsaved += tiles.length

    return out
  }
  save_tiles(tiles: Tile[]) {
    // fake persist on client.
    this.unsaved -= tiles.length
  }
}
