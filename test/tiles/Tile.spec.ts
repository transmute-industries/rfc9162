import crypto from 'crypto'
import {
  TileForIndex,
  HashFromTile,
  Hash, Tree, Concat, toHex,
  PrettyHash, NewTiles,
  PrettyHashes,
  ReadTileData, StoredHashCount,
  StoredHashes, StoredHashIndex,
  RecordHash, TreeHash,
  Tile, Path, HashSize,
  TileBytesAreEqual,
  ProveRecord,
  CheckRecord,
  TileReader,
  TileHashReader,
  ProveTree,
  CheckTree
} from "../../src";

it('TileForIndex', () => {
  expect(TileForIndex(2, 0)).toEqual([[2, 0, 0, 1], 0, 32])
  expect(TileForIndex(2, 1)).toEqual([[2, 0, 0, 2], 32, 64])
  expect(TileForIndex(2, 2)).toEqual([[2, 0, 0, 2], 0, 64])
  expect(TileForIndex(2, 3)).toEqual([[2, 0, 0, 3], 64, 96])
  expect(TileForIndex(8, 9)).toEqual([[8, 0, 0, 6], 128, 192])
})


describe('HashFromTile', () => {
  const th = new Hash((data: Uint8Array) => {
    return new Uint8Array(crypto.createHash('sha256').update(data).digest());
  }, 32)
  const tree = new Tree(th)
  for (let i = 0; i < 26; i++) {
    const entry = `entry-${i}`
    tree.appendData(tree.encodeData(entry))
  }
  const rawData = tree.hashes[0].reduce(Concat)
  it('first hash, from first tile', () => {
    const index = 0
    const [tile] = TileForIndex(2, index)
    expect(
      toHex(
        HashFromTile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('QHZrIDNCkCb1PVRQJnmoOXBrR0H43K86i7pfQbX/4HU=', 'base64').toString('hex')
      )
  })
  it('second hash, from first tile', () => {
    const index = 1
    const [tile,] = TileForIndex(2, index)
    expect(
      toHex(
        HashFromTile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('6GiBGkgsJ9ULbUXd55xGXWrbmwZkUQBHepDPPYUYiYs=', 'base64').toString('hex')
      )

  })
  it('third hash, from first tile', () => {
    const index = 2
    const [tile] = TileForIndex(2, index)
    expect(
      toHex(
        HashFromTile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('LyelCCwdQq+kiKw1Cp/EOQwIT1T3Hs3/hZ6Y24QptHk=', 'base64').toString('hex')
      )
  })

  it('fourth hash, from first tile', () => {
    const index = 3
    const [tile] = TileForIndex(2, index)
    expect(
      toHex(
        HashFromTile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('BJ19zbVrz+vTEzBMmDnxlqPUtu873AsIKY+TrIGR8Kg=', 'base64').toString('hex')
      )
  })

  it('fifth hash, from first tile', () => {
    const index = 4
    const [tile] = TileForIndex(2, index)
    expect(
      toHex(
        HashFromTile(tile, rawData, index)
      ))
      .toBe(
        Buffer.from('J0ebarMh0u5HdFL2i6UndI6GPK/o+9HfK/idFXDRtpc=', 'base64').toString('hex')
      )
  })
})



it('NewTiles', () => {
  expect(NewTiles(2, 0, 1)).toEqual([[2, 0, 0, 1]])
  expect(NewTiles(2, 1, 2)).toEqual([[2, 0, 0, 2]])
})

it('StoredHashIndex', () => {
  expect(StoredHashIndex(0, 2)).toEqual(3)
  expect(StoredHashIndex(0, 3)).toEqual(4)
  expect(StoredHashIndex(0, 4)).toEqual(7)
  expect(StoredHashIndex(0, 5)).toEqual(8)
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
      leafHashes.push(RecordHash(data))
      const oldStorage = storedHashes.length
      const hashes = StoredHashes(i, data, storage)


      storedHashes = [...storedHashes, ...hashes]


      if (StoredHashCount(i + 1) != storedHashes.length) {
        throw new Error('Storage is more clever: ')
      }

      const th = TreeHash(i + 1, storage)
      if (i == 0) {
        expect(PrettyHash(th)).toBe("G7l9zCFjXUfiZj79/QoXRobZjdcBNS3SzQbotD/T0wU=")
      }
      if (i == 1) {
        expect(PrettyHash(th)).toBe("/F9riP+FVPdbsvnm85wxsZNtRLaSdu33sSBalVuXYeM=")
      }
      if (i == 2) {
        expect(PrettyHash(th)).toBe("1Pksj7uJcg6ztVZ3x9fvrd/rENEaGoSguo8aIzN/qpU=")
      }
      if (i == 3) {
        expect(PrettyHash(th)).toBe("T2MQhKFXxU9U/Psj/164ZQxLoWDClbsTqYMrEJ1SZ34=")
      }
      if (i == 4) {
        expect(PrettyHash(th)).toBe("NBUVmC1lDiNSDb1U1/zwr6G3DMOhakEdRk3JwayWwwE=")
      }

      for (const tile of NewTiles(testH, i, i + 1)) {
        const data = ReadTileData(tile, storage)
        const old = Tile(tile[0], tile[1], tile[2], tile[3] - 1)
        const oldData = tiles[Path(old)] || new Uint8Array()
        if ((oldData.length != (data.length - HashSize)) || !TileBytesAreEqual(oldData, data.slice(0, oldData.length))) {
          throw new Error(`tile ${tile} not extending earlier tile ${old}`)
        }
        tiles[Path(tile)] = data
      }
      for (const tile of NewTiles(testH, 0, i + 1)) {
        const data = ReadTileData(tile, storage)
        if (!TileBytesAreEqual(tiles[Path(tile)], data)) {
          throw new Error(`mismatch at ${tile}`)
        }
      }
      for (const tile of NewTiles(testH, i / 2, i + 1)) {
        const data = ReadTileData(tile, storage)
        if (!TileBytesAreEqual(tiles[Path(tile)], data)) {
          throw new Error(`mismatch at ${tile}`)
        }
      }

      for (let j = oldStorage; j < storedHashes.length; j++) {
        const [tile] = TileForIndex(testH, j)
        const data = tiles[Path(tile)]
        if (!data) {
          throw new Error(`TileForIndex(${testH}, ${j}) = ${Path(tile)}, not yet stored (i=${i}, stored ${storedHashes.length})`)
        }
        const h = HashFromTile(tile, data, j)
        if (toHex(h) !== toHex(storedHashes[j])) {
          throw new Error(`HashFromTile(${Path(tile)}, ${j}) = ${h}, want ${storedHashes[j]}`)
        }
      }

      trees.push(th)

      for (let j = 0; j <= i; j++) {
        const p = ProveRecord(i + 1, j, storage)
        if (!CheckRecord(p, i + 1, th, j, leafHashes[j])) {
          throw new Error(`CheckRecord(${i + 1}, ${j}) failed`)
        }
        for (let k = 0; k < p.length; k++) {
          p[k][0] ^= 1 // break it
          if (CheckRecord(p, i + 1, th, j, leafHashes[j])) {
            throw new Error(`CheckRecord(${i + 1}, ${j}) succeeded with corrupt proof hash #${k}!`)
          }
          p[k][0] ^= 1 // fix it
        }
      }


      // To prove a leaf that way, all you have to do is read and verify its hash.
      const tileStorage = new TestTileStorage(tiles)
      const thr = new TileHashReader(i + 1, th, tileStorage)
      for (let j = 0; j <= i; j++) {
        const h = thr.read_hashes([StoredHashIndex(0, j)])
        if (toHex(h[0]) != toHex(leafHashes[j])) {
          throw new Error(`TileHashReader(%d).read_hashes(%d) returned wrong hash`)
        }

        // Even though reading the hash suffices,
        // check we can generate the proof too.
        const p = ProveRecord(i + 1, j, thr)
        if (!CheckRecord(p, i + 1, th, j, leafHashes[j])) {
          throw new Error(`CheckRecord(%d, %d, TileHashReader(%d)): %v`)
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
        const h = TreeHash(j + 1, thr)
        if (toHex(h) != toHex(trees[j])) {
          throw new Error(`"TreeHash(%d, TileHashReader(%d)) = %x, want %x (%v)`)
        }

        // Even though computing the subtree hash suffices,
        // check that we can generate the proof too.
        const p = ProveTree(i + 1, j + 1, thr)
        const ct = CheckTree(p, i + 1, th, j + 1, trees[j])
        if (!ct) {
          throw new Error(`"CheckTree(%d, %d): %v [%v]`)
        }

        for (let k = 0; k < p.length; k++) {
          p[k][0] ^= 1 // break
          try {
            CheckTree(p, i + 1, th, j + 1, trees[j]) // test
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
      const tileName = Path(tile)
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