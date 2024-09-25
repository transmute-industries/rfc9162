import crypto from 'crypto'
import {
  Hash, Tree,
  NewTiles,
  ReadTileData,
  StoredHashes,
  Tile, Path,
  TileReader as TR,
  TileHashReader,
  StoredHashIndex,
  TreeHash,
  HashReader
} from "../../src";

import { treeHead } from '../../src/RFC9162';

const th = new Hash((data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}, 32)


const testH = 2
const encoder = new TextEncoder();

class HashStorage {
  constructor(public hashes: Uint8Array[]) { }
  writeData(index: number, data: Uint8Array,) {
    const hashes = StoredHashes(index, data, this)
    this.hashes = [...this.hashes, ...hashes]
  }
  ReadHashes(indexes: number[]) {
    return indexes.map((i) => this.hashes[i])
  }
}

class TileReader implements TR {
  public unsaved = 0
  public tiles: Record<string, Uint8Array>

  constructor(tiles: Record<string, Uint8Array> = {}, public hashReader: HashReader) {
    this.tiles = tiles
    this.hashReader = hashReader
  }
  Height() { return testH }  // testHeight
  writeTileData(oldTreeSize: number, newTreeSize: number,) {
    for (const tile of NewTiles(testH, oldTreeSize, newTreeSize)) {
      const data = ReadTileData(tile, this.hashReader)
      this.tiles[Path(tile)] = data
    }
  }
  ReadTiles(tiles: Tile[]) {
    const out = [] as any
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      const tileName = Path(tile)
      // read from cache ...
      const hasTile = this.tiles[tileName]
      out.push(hasTile)
    }
    this.unsaved += tiles.length
    return out
  }
  SaveTiles(tiles: Tile[]) {
    // fake persist on client.
    this.unsaved -= tiles.length
    for (const tile of tiles) {
      const data = ReadTileData(tile, this.hashReader)
      this.tiles[Path(tile)] = data
    }
  }
}


it('simulated interface', async () => {

  // for testing compatibility
  const entries: Uint8Array[] = []

  // these primitives go in the database
  const hashes = [] as Uint8Array[]
  const tiles = {} as Record<string, Uint8Array>

  // these readers and writers talk to the database
  const hashReader = new HashStorage(hashes)
  const tileReader = new TileReader(tiles, hashReader)

  for (let i = 0; i < 26; i++) {
    const data = encoder.encode(`entry-${i}`)

    // write data
    hashReader.writeData(i, data)

    // for testing compatibility
    entries.push(data)

  }

  // write tiles at the end
  tileReader.writeTileData(0, 26)

  const oldTreeEncoded = entries.map((h) => Buffer.from(th.hashLeaf(h)).toString('base64'))
  const root1 = await treeHead(entries)
  // console.log(Buffer.from(root1).toString('base64'))
  const thr = new TileHashReader(entries.length, root1, tileReader)

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

  // read all leaves from tiles
  for (let i = 0; i < entries.length; i++) {
    const [h] = thr.ReadHashes([StoredHashIndex(0, i)])
    expect(Buffer.from(h).toString('base64')).toEqual(oldTreeEncoded[i])
  }

})