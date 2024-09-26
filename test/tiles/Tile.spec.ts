import crypto from 'crypto'
import {
  tile_for_storage_id,
  hash_from_tile,
  Hash, Tree, concat, to_hex,
  pretty_hash, new_tiles,
  pretty_hashes,
  read_tile_data, stored_hash_count,
  stored_hashes, stored_hash_index,
  record_hash, tree_hash,
  Tile, tile_to_path, hash_size,
  tile_bytes_are_equal,
  prove_record,
  check_record,
  TileReader,
  TileHashReader,
  prove_tree,
  check_tree
} from "../../src";

it('tile_for_storage_id', () => {
  expect(tile_for_storage_id(2, 0)).toEqual([[2, 0, 0, 1], 0, 32])
  expect(tile_for_storage_id(2, 1)).toEqual([[2, 0, 0, 2], 32, 64])
  expect(tile_for_storage_id(2, 2)).toEqual([[2, 0, 0, 2], 0, 64])
  expect(tile_for_storage_id(2, 3)).toEqual([[2, 0, 0, 3], 64, 96])
  expect(tile_for_storage_id(8, 9)).toEqual([[8, 0, 0, 6], 128, 192])
})


describe('hash_from_tile', () => {
  const th = new Hash((data: Uint8Array) => {
    return new Uint8Array(crypto.createHash('sha256').update(data).digest());
  }, 32)
  const tree = new Tree(th)
  for (let i = 0; i < 26; i++) {
    const entry = `entry-${i}`
    tree.appendData(tree.encodeData(entry))
  }
  const rawData = tree.hashes[0].reduce(concat)
  it('first hash, from first tile', () => {
    const index = 0
    const [tile] = tile_for_storage_id(2, index)
    expect(
      to_hex(
        hash_from_tile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('QHZrIDNCkCb1PVRQJnmoOXBrR0H43K86i7pfQbX/4HU=', 'base64').toString('hex')
      )
  })
  it('second hash, from first tile', () => {
    const index = 1
    const [tile,] = tile_for_storage_id(2, index)
    expect(
      to_hex(
        hash_from_tile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('6GiBGkgsJ9ULbUXd55xGXWrbmwZkUQBHepDPPYUYiYs=', 'base64').toString('hex')
      )

  })
  it('third hash, from first tile', () => {
    const index = 2
    const [tile] = tile_for_storage_id(2, index)
    expect(
      to_hex(
        hash_from_tile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('LyelCCwdQq+kiKw1Cp/EOQwIT1T3Hs3/hZ6Y24QptHk=', 'base64').toString('hex')
      )
  })

  it('fourth hash, from first tile', () => {
    const index = 3
    const [tile] = tile_for_storage_id(2, index)
    expect(
      to_hex(
        hash_from_tile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('BJ19zbVrz+vTEzBMmDnxlqPUtu873AsIKY+TrIGR8Kg=', 'base64').toString('hex')
      )
  })

  it('fifth hash, from first tile', () => {
    const index = 4
    const [tile] = tile_for_storage_id(2, index)
    expect(
      to_hex(
        hash_from_tile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('J0ebarMh0u5HdFL2i6UndI6GPK/o+9HfK/idFXDRtpc=', 'base64').toString('hex')
      )
  })
})



it('new_tiles', () => {
  expect(new_tiles(2, 0, 1)).toEqual([[2, 0, 0, 1]])
  expect(new_tiles(2, 1, 2)).toEqual([[2, 0, 0, 2]])
})

it('stored_hash_index', () => {
  expect(stored_hash_index(0, 2)).toEqual(3)
  expect(stored_hash_index(0, 3)).toEqual(4)
  expect(stored_hash_index(0, 4)).toEqual(7)
  expect(stored_hash_index(0, 5)).toEqual(8)
})
describe('TestTiledTree', () => {
  const encoder = new TextEncoder();
  it('create tree', () => {
    const testH = 2
    let storedHashes = [] as any
    const trees = [] as Uint8Array[]
    const tiles = {} as Record<string, Uint8Array>
    const leafHashes = [] as Uint8Array[]
    const storage = {
      read_hashes: (indexes: number[]) => {
        return indexes.map((i) => storedHashes[i])
      }
    }
    for (let i = 0; i < 100; i++) {
      const data = encoder.encode(`leaf ${i}`)
      leafHashes.push(record_hash(data))
      const oldStorage = storedHashes.length
      const hashes = stored_hashes(i, data, storage)


      storedHashes = [...storedHashes, ...hashes]


      if (stored_hash_count(i + 1) != storedHashes.length) {
        throw new Error('Storage is more clever: ')
      }

      const th = tree_hash(i + 1, storage)
      if (i == 0) {
        expect(pretty_hash(th)).toBe("G7l9zCFjXUfiZj79/QoXRobZjdcBNS3SzQbotD/T0wU=")
      }
      if (i == 1) {
        expect(pretty_hash(th)).toBe("/F9riP+FVPdbsvnm85wxsZNtRLaSdu33sSBalVuXYeM=")
      }
      if (i == 2) {
        expect(pretty_hash(th)).toBe("1Pksj7uJcg6ztVZ3x9fvrd/rENEaGoSguo8aIzN/qpU=")
      }
      if (i == 3) {
        expect(pretty_hash(th)).toBe("T2MQhKFXxU9U/Psj/164ZQxLoWDClbsTqYMrEJ1SZ34=")
      }
      if (i == 4) {
        expect(pretty_hash(th)).toBe("NBUVmC1lDiNSDb1U1/zwr6G3DMOhakEdRk3JwayWwwE=")
      }

      for (const tile of new_tiles(testH, i, i + 1)) {
        const data = read_tile_data(tile, storage)
        const old = Tile(tile[0], tile[1], tile[2], tile[3] - 1)
        const oldData = tiles[tile_to_path(old)] || new Uint8Array()
        if ((oldData.length != (data.length - hash_size)) || !tile_bytes_are_equal(oldData, data.slice(0, oldData.length))) {
          throw new Error(`tile ${tile} not extending earlier tile ${old}`)
        }
        tiles[tile_to_path(tile)] = data
      }
      for (const tile of new_tiles(testH, 0, i + 1)) {
        const data = read_tile_data(tile, storage)
        if (!tile_bytes_are_equal(tiles[tile_to_path(tile)], data)) {
          throw new Error(`mismatch at ${tile}`)
        }
      }
      for (const tile of new_tiles(testH, i / 2, i + 1)) {
        const data = read_tile_data(tile, storage)
        if (!tile_bytes_are_equal(tiles[tile_to_path(tile)], data)) {
          throw new Error(`mismatch at ${tile}`)
        }
      }

      for (let j = oldStorage; j < storedHashes.length; j++) {
        const [tile] = tile_for_storage_id(testH, j)
        const data = tiles[tile_to_path(tile)]
        if (!data) {
          throw new Error(`tile_for_storage_id(${testH}, ${j}) = ${tile_to_path(tile)}, not yet stored (i=${i}, stored ${storedHashes.length})`)
        }
        const h = hash_from_tile(tile, data, j)
        if (to_hex(h) !== to_hex(storedHashes[j])) {
          throw new Error(`hash_from_tile(${tile_to_path(tile)}, ${j}) = ${h}, want ${storedHashes[j]}`)
        }
      }

      trees.push(th)

      for (let j = 0; j <= i; j++) {
        const p = prove_record(i + 1, j, storage)
        if (!check_record(p, i + 1, th, j, leafHashes[j])) {
          throw new Error(`check_record(${i + 1}, ${j}) failed`)
        }
        for (let k = 0; k < p.length; k++) {
          p[k][0] ^= 1 // break it
          if (check_record(p, i + 1, th, j, leafHashes[j])) {
            throw new Error(`check_record(${i + 1}, ${j}) succeeded with corrupt proof hash #${k}!`)
          }
          p[k][0] ^= 1 // fix it
        }
      }


      // To prove a leaf that way, all you have to do is read and verify its hash.
      const tileStorage = new TestTileStorage(tiles)
      const thr = new TileHashReader(i + 1, th, tileStorage)
      for (let j = 0; j <= i; j++) {
        const h = thr.read_hashes([stored_hash_index(0, j)])
        if (to_hex(h[0]) != to_hex(leafHashes[j])) {
          throw new Error(`TileHashReader(%d).read_hashes(%d) returned wrong hash`)
        }

        // Even though reading the hash suffices,
        // check we can generate the proof too.
        const p = prove_record(i + 1, j, thr)
        if (!check_record(p, i + 1, th, j, leafHashes[j])) {
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
        const h = tree_hash(j + 1, thr)
        if (to_hex(h) != to_hex(trees[j])) {
          throw new Error(`"tree_hash(%d, TileHashReader(%d)) = %x, want %x (%v)`)
        }

        // Even though computing the subtree hash suffices,
        // check that we can generate the proof too.
        const p = prove_tree(i + 1, j + 1, thr)
        const ct = check_tree(p, i + 1, th, j + 1, trees[j])
        if (!ct) {
          throw new Error(`"check_tree(%d, %d): %v [%v]`)
        }

        for (let k = 0; k < p.length; k++) {
          p[k][0] ^= 1 // break
          try {
            check_tree(p, i + 1, th, j + 1, trees[j]) // test
          } catch (e) {
            expect((e as any).message).toBe('errProofFailed')
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

class TestTileStorage implements TileReader {
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