
import fs from 'fs'
import crypto from 'crypto'

import { Hash, Tree, TileForIndex, HashFromTile, Concat, StoredHashes, ReadTileData, TreeHash, TileReader, Path, Tile, TileHashReader, StoredHashIndex, NewTiles, HashSize } from "../src";


import api from '../src'


const {
  leaf,
  treeHead,
  verifyTree,
  inclusionProof,
  verifyInclusionProof,
} = api


const th = new Hash((data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}, 32)


class TestTileStorage implements TileReader {
  public unsaved: number = 0
  constructor(public tiles: Record<string, Uint8Array>) { }
  Height() { return 2 }  // testHeight
  ReadTiles(tiles: Tile[]) {
    let out = [] as any
    for (let i = 0; i < tiles.length; i++) {
      let tile = tiles[i]
      let tileName = Path(tile)
      // console.log(tileName)
      let hasTile = this.tiles[tileName]
      out.push(hasTile)
    }
    this.unsaved += tiles.length

    return out
  }
  SaveTiles(tiles: Tile[]) {
    // fake persist on client.
    this.unsaved -= tiles.length
  }
}

const testH = 2
it.skip('generate log entries', async () => {
  const tree = new Tree(th)
  const entries: Uint8Array[] = []
  let storedHashes = [] as any
  const tiles = {} as Record<string, Uint8Array>
  const storage = {
    ReadHashes: (indexes: number[]) => {
      return indexes.map((i) => storedHashes[i])
    }
  }
  for (let i = 0; i < 26; i++) {
    const message = `entry-${i}`
    const data = new TextEncoder().encode(message)
    entries.push(data)
    tree.appendData(tree.encodeData(message))
    const hashes = StoredHashes(i, data, storage)
    storedHashes = [...storedHashes, ...hashes]

    for (const tile of NewTiles(testH, i, i + 1)) {
      const data = ReadTileData(tile, storage)
      tiles[Path(tile)] = data
    }
  }

  const tileTreeEncoded = tree.hashes[0].map((h) => Buffer.from(h).toString('base64'))
  const oldTreeEncoded = entries.map((h) => Buffer.from(tree.th.hashLeaf(h)).toString('base64'))

  console.log('tile tree', tileTreeEncoded)
  console.log('old tree', oldTreeEncoded)

  // tree equality from leaf equality
  expect(tileTreeEncoded)
    .toEqual(oldTreeEncoded)

  // tree equality by root comparison
  expect(Buffer.from(await treeHead(entries)).toString('hex'))
    .toEqual(Buffer.from(tree.hash()).toString('hex'))

  // tree equality from hash at size
  expect(Buffer.from(await treeHead(entries.slice(0, 7))).toString('base64'))
    .toEqual(Buffer.from(tree.hashAt(7)).toString('base64'))

  const index = 7
  const [tile] = TileForIndex(1, index)

  const [tileData] = tree.getTile(...tile)
  console.log(Buffer.from(tileData).toString('base64'))
  // const h1 = Buffer.from(HashFromTile(tile, tileData, index)).toString('base64')

  // expect(h1).toBe(oldTreeEncoded[index])

  const tileStorage = new TestTileStorage(tiles)
  const thr = new TileHashReader(7, tree.hashAt(7), tileStorage)
  const h = thr.ReadHashes([StoredHashIndex(0, 7)])
  console.log(h)
})
