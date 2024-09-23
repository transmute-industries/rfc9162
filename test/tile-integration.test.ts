import crypto from 'crypto'
import {
  Hash, Tree,
  NewTiles,
  ReadTileData,
  StoredHashes,
  Tile, Path,
  TileReader,
  TileHashReader,
  StoredHashIndex,
  TreeHash
} from "../src";

import { treeHead } from '../src/RFC9162';

const th = new Hash((data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}, 32)


class TestTileStorage implements TileReader {
  public unsaved = 0
  constructor(public tiles: Record<string, Uint8Array>) { }
  Height() { return 2 }  // testHeight
  ReadTiles(tiles: Tile[]) {
    const out = [] as any
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      const tileName = Path(tile)
      const hasTile = this.tiles[tileName]
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

const encoder = new TextEncoder();
const testH = 2

it('simulated interface', async () => {
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
    const data = encoder.encode(`entry-${i}`)
    entries.push(data)
    const hashes = StoredHashes(i, data, storage)
    storedHashes = [...storedHashes, ...hashes]
    for (const tile of NewTiles(testH, i, i + 1)) {
      const data = ReadTileData(tile, storage)
      tiles[Path(tile)] = data
    }
  }

  const oldTreeEncoded = entries.map((h) => Buffer.from(tree.th.hashLeaf(h)).toString('base64'))
  const root1 = await treeHead(entries)

  const thr = new TileHashReader(entries.length, root1, new TestTileStorage(tiles))
  const [h0] = thr.ReadHashes([StoredHashIndex(0, 7)])
  expect(Buffer.from(h0).toString('base64')).toEqual(oldTreeEncoded[7])

  const [h1] = thr.ReadHashes([StoredHashIndex(1, 0)]) // first hash of level 1 is 
  const h1p = await treeHead(entries.slice(0, 2)) // ...mth of first 2 elements of level 0
  expect(Buffer.from(h1).toString('base64')).toEqual(Buffer.from(h1p).toString('base64'))

  const [h2] = thr.ReadHashes([StoredHashIndex(2, 0)]) // first hash of level 2 is 
  const h2p = await treeHead(entries.slice(0, 4)) // ...mth of first 4 elements of level 0
  expect(Buffer.from(h2).toString('base64')).toEqual(Buffer.from(h2p).toString('base64'))


  // check heads with tile hash reader
  expect(Buffer.from(TreeHash(5, thr)).toString('base64'))
    .toEqual(Buffer.from(await treeHead(entries.slice(0, 5))).toString('base64'))

  expect(Buffer.from(TreeHash(7, thr)).toString('base64'))
    .toEqual(Buffer.from(await treeHead(entries.slice(0, 7))).toString('base64'))

  expect(Buffer.from(TreeHash(8, thr)).toString('base64'))
    .toEqual(Buffer.from(await treeHead(entries.slice(0, 8))).toString('base64'))

  expect(Buffer.from(TreeHash(26, thr)).toString('base64'))
    .toEqual(Buffer.from(await treeHead(entries.slice(0, 26))).toString('base64'))
})