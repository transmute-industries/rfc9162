
import {
  tile_for_storage_id,
  hash_from_tile,
  to_hex,
  pretty_hash, new_tiles,
  create_tile,
  read_tile_data, stored_hash_count,
  stored_hashes, stored_hash_index,
  record_hash, tree_hash,
  tile_to_path,
  tile_bytes_are_equal,
  prove_record,
  check_record,
  TileHashReader,
  prove_tree,
  check_tree
} from "../../src";

import { th, TestTileStorage, encode } from './test_utils';


const tile_height = 2
let all_tree_hashes_stored = [] as Uint8Array[]
const storage = {
  read_hashes: (indexes: number[]) => {
    return indexes.map((i) => all_tree_hashes_stored[i])
  }
}

describe('TestTiledTree', () => {

  it('create tree', () => {
    const trees = [] as Uint8Array[]
    const tiles = {} as Record<string, Uint8Array>
    const record_hashes = [] as Uint8Array[]
    for (let i = 0; i < 100; i++) {
      const data = encode(`leaf ${i}`)
      record_hashes.push(record_hash(th, data))
      const old_storage_length = all_tree_hashes_stored.length
      const hashes = stored_hashes(th, i, data, storage)
      all_tree_hashes_stored = [...all_tree_hashes_stored, ...hashes]
      if (stored_hash_count(i + 1) != all_tree_hashes_stored.length) {
        throw new Error('Storage is more clever: ')
      }
      const tree_head = tree_hash(th, i + 1, storage)
      if (i == 0) {
        expect(pretty_hash(tree_head)).toBe("G7l9zCFjXUfiZj79/QoXRobZjdcBNS3SzQbotD/T0wU=")
      }
      if (i == 1) {
        expect(pretty_hash(tree_head)).toBe("/F9riP+FVPdbsvnm85wxsZNtRLaSdu33sSBalVuXYeM=")
      }
      if (i == 2) {
        expect(pretty_hash(tree_head)).toBe("1Pksj7uJcg6ztVZ3x9fvrd/rENEaGoSguo8aIzN/qpU=")
      }
      if (i == 3) {
        expect(pretty_hash(tree_head)).toBe("T2MQhKFXxU9U/Psj/164ZQxLoWDClbsTqYMrEJ1SZ34=")
      }
      if (i == 4) {
        expect(pretty_hash(tree_head)).toBe("NBUVmC1lDiNSDb1U1/zwr6G3DMOhakEdRk3JwayWwwE=")
      }

      for (const tile of new_tiles(tile_height, i, i + 1)) {
        const data = read_tile_data(tile, storage)
        const old = create_tile(tile[0], tile[1], tile[2], tile[3] - 1)
        const oldData = tiles[tile_to_path(old)] || new Uint8Array()
        if ((oldData.length != (data.length - th.hash_size)) || !tile_bytes_are_equal(oldData, data.slice(0, oldData.length))) {
          throw new Error(`tile ${tile} not extending earlier tile ${old}`)
        }
        tiles[tile_to_path(tile)] = data
      }
      for (const tile of new_tiles(tile_height, 0, i + 1)) {
        const data = read_tile_data(tile, storage)
        if (!tile_bytes_are_equal(tiles[tile_to_path(tile)], data)) {
          throw new Error(`mismatch at ${tile}`)
        }
      }
      for (const tile of new_tiles(tile_height, i / 2, i + 1)) {
        const data = read_tile_data(tile, storage)
        if (!tile_bytes_are_equal(tiles[tile_to_path(tile)], data)) {
          throw new Error(`mismatch at ${tile}`)
        }
      }

      for (let j = old_storage_length; j < all_tree_hashes_stored.length; j++) {
        const [tile] = tile_for_storage_id(th.hash_size, tile_height, j)
        const data = tiles[tile_to_path(tile)]
        if (!data) {
          throw new Error(`tile_for_storage_id(${tile_height}, ${j}) = ${tile_to_path(tile)}, not yet stored (i=${i}, stored ${all_tree_hashes_stored.length})`)
        }
        const h = hash_from_tile(th, tile, data, j)
        if (to_hex(h) !== to_hex(all_tree_hashes_stored[j])) {
          throw new Error(`hash_from_tile(${tile_to_path(tile)}, ${j}) = ${h}, want ${all_tree_hashes_stored[j]}`)
        }
      }
      trees.push(tree_head)
      for (let j = 0; j <= i; j++) {
        const p = prove_record(th, i + 1, j, storage)
        if (!check_record(th, p, i + 1, tree_head, j, record_hashes[j])) {
          throw new Error(`check_record(${i + 1}, ${j}) failed`)
        }
        for (let k = 0; k < p.length; k++) {
          p[k][0] ^= 1 // break it
          if (check_record(th, p, i + 1, tree_head, j, record_hashes[j])) {
            throw new Error(`check_record(${i + 1}, ${j}) succeeded with corrupt proof hash #${k}!`)
          }
          p[k][0] ^= 1 // fix it
        }
      }
      // To prove a leaf that way, all you have to do is read and verify its hash.
      const tileStorage = new TestTileStorage(tiles)
      const thr = new TileHashReader(i + 1, tree_head, tileStorage, th)
      for (let j = 0; j <= i; j++) {
        const h = thr.read_hashes([stored_hash_index(0, j)])
        if (to_hex(h[0]) != to_hex(record_hashes[j])) {
          throw new Error(`TileHashReader(%d).read_hashes(%d) returned wrong hash`)
        }
        // Even though reading the hash suffices,
        // check we can generate the proof too.
        const p = prove_record(th, i + 1, j, thr)
        if (!check_record(th, p, i + 1, tree_head, j, record_hashes[j])) {
          throw new Error(`check_record(%d, %d, TileHashReader(%d)): %v`)
        }
      }
      if (tileStorage.unsaved != 0) {
        throw new Error(`TileHashReader(%d) did not save %d tiles`)
      }
      // Check that read_hashes will give an error if the index is not in the tree.
      try {
        thr.read_hashes([(i + 1) * 2])
      } catch (e) {
        expect((e as any).message).toBe(`indexes not in tree`)
      }
      if (tileStorage.unsaved != 0) {
        throw new Error(`TileHashReader(%d) did not save %d tiles`)
      }
      for (let j = 0; j <= i; j++) {
        const h = tree_hash(th, j + 1, thr)
        if (to_hex(h) != to_hex(trees[j])) {
          throw new Error(`"tree_hash(%d, TileHashReader(%d)) = %x, want %x (%v)`)
        }
        // Even though computing the subtree hash suffices,
        // check that we can generate the proof too.
        const p = prove_tree(th, i + 1, j + 1, thr)
        const ct = check_tree(th, p, i + 1, tree_head, j + 1, trees[j])
        if (!ct) {
          throw new Error(`"check_tree(%d, %d): %v [%v]`)
        }
        for (let k = 0; k < p.length; k++) {
          p[k][0] ^= 1 // break
          try {
            check_tree(th, p, i + 1, tree_head, j + 1, trees[j]) // test
          } catch (e) {
            expect((e as any).message).toBe('check_tree failed')
          }
          p[k][0] ^= 1 // fix
        }
        if (tileStorage.unsaved != 0) {
          throw new Error(`TileHashReader(%d) did not save %d tiles`)
        }
      }
    }
  })

})
