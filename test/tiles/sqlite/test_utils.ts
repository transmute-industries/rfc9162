import sqlite from 'better-sqlite3'

import { tile_to_path, tile_for_storage_id } from '../../../src';

import { hash_size } from '../test_utils'

export const db = new sqlite("./test/tiles/sqlite/transparency.db");

export const prepare = (db: any) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tiles 
    (id TEXT PRIMARY KEY, data BLOB);
        `).run()
}

export const write_tile = (db: any, tile_path: string, tile_data: Uint8Array) => {
  try {
    db.prepare(`
INSERT INTO tiles (id, data)
VALUES( '${tile_path}',	x'${Buffer.from(tile_data).toString('hex')}');
        `).run()
  } catch (e) {
    console.error('Failed to write tile.')
    console.error(e)
  }
}

export const read_tile_data = (db: any, tile_path: string): Buffer | null => {
  const rows = db.prepare(`
SELECT * FROM tiles
WHERE id = '${tile_path}'
        `).all();
  if (rows.length) {
    const [row] = rows
    return row.data
  }
  return null

}

export const read_tile = (tile: string): Uint8Array => {
  const [baseTile] = tile.split('.')
  for (let i = 4; i > 0; i--) {
    const relatedTile = baseTile + '.' + i
    const maybeTileData = read_tile_data(db, relatedTile)
    if (maybeTileData) {
      return maybeTileData
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
  try {
    write_tile(db, tileName, tile_data)
  } catch (e) {
    // ignore
  }
  return tile_data
}