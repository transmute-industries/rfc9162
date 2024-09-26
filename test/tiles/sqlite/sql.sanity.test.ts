
import sqlite from 'better-sqlite3'
import {
  StoredHashes,
  TileReader,
  ReadTileData,
  Tile,
  TreeHash,
  TileHashReader,
  ProveRecord,
  RecordHash,
  CheckRecord,
  ProveTree,
  StoredHashIndex,
  CheckTree
} from "../../../src";

const prepare = (db: any) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS hashes 
    (id INTEGER PRIMARY KEY, hash BLOB);
        `).run()
}


type HashRecord = {
  id: number,
  hash: Buffer
}

const write_stored_hash = (db: any, record: HashRecord) => {
  try {
    db.prepare(`
INSERT INTO hashes (id, hash)
VALUES( ${record.id},	x'${Buffer.from(record.hash).toString('hex')}');
        `).run()
  } catch (e) {
    console.error('Failed to write hash.')
  }
}

const get_stored_hash_by_index = (db: any, id: number) => {
  const rows = db.prepare(`
SELECT * FROM hashes
WHERE id = ${id}
        `).all();

  const [row] = rows
  return row as HashRecord
}

const get_stored_hash_count = (db: any) => {
  const rows = db.prepare(`
SELECT COUNT(*) FROM hashes
        `).all();

  const [row] = rows
  return row['COUNT(*)'] as number
}

const write_hashes = (db: any, hashes: Uint8Array[]) => {
  const count = get_stored_hash_count(db)
  for (let i = 0; i < hashes.length; i++) {
    write_stored_hash(db, {
      id: count + i,
      hash: Buffer.from(hashes[i])
    })
  }
}

const find_index_for_hash = (db: any, hash: Uint8Array) => {
  const rows = db.prepare(`
SELECT * FROM hashes
WHERE hash = x'${Buffer.from(hash).toString('hex')}'
            `).all();
  const [row] = rows
  if (!row) {
    return null
  }
  return row as HashRecord
}


const encoder = new TextEncoder();

class SQLHashStorage {
  constructor(public db: any) { }
  writeData(index: number, data: Uint8Array,) {
    const hashes = StoredHashes(index, data, this)
    write_hashes(this.db, hashes)
  }
  read_hashes(indexes: number[]) {
    const hashes = [] as Uint8Array[]
    for (const index of indexes) {
      const hash = get_stored_hash_by_index(this.db, index)
      hashes.push(new Uint8Array(hash.hash))
    }
    return hashes
  }
}

const testH = 2
class SQLTileReader implements TileReader {
  public unsaved = 0
  constructor(public hashReader: SQLHashStorage) {
    this.hashReader = hashReader
  }
  height() { return testH }  // testHeight
  read_tiles(tiles: Tile[]) {
    const out = [] as any
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      const data = ReadTileData(tile, this.hashReader)
      out.push(data)
    }
    this.unsaved += tiles.length
    return out
  }
  save_tiles(tiles: Tile[]) {
    // fake persist on client.
    this.unsaved -= tiles.length
  }
}


it('synchronous apis', async () => {
  const db = new sqlite("./test/tiles/sqlite/transparency.db");

  // for (let i = 0; i < 26; i++) {
  //   const data = encoder.encode(`entry-${i}`)
  //   // write data
  //   hashReader.writeData(i, data)
  // }

  const hashReader = new SQLHashStorage(db)

  const tileReader = new SQLTileReader(hashReader)
  prepare(db)
  const root = TreeHash(26, hashReader)
  const thr = new TileHashReader(26, root, tileReader)
  const storageID = StoredHashIndex(0, 17)
  const leaf = RecordHash(encoder.encode(`entry-17`))
  const h0 = find_index_for_hash(db, leaf) as any
  expect(h0?.id).toBe(storageID)
  const hash = get_stored_hash_by_index(db, storageID)
  expect(Buffer.from(hash.hash).toString('base64')).toBe(Buffer.from(leaf).toString('base64'))

  const treeSize = 26
  const leafIndex = 17
  const inclusionPath = ProveRecord(treeSize, leafIndex, thr)
  const inclusionProof = CheckRecord(inclusionPath, treeSize, root, leafIndex, leaf)
  expect(inclusionProof).toBe(true)

  const oldSize = 17
  const newSize = 26
  const oldRoot = TreeHash(17, hashReader)
  const newRoot = TreeHash(26, hashReader)
  const consistencyPath = ProveTree(newSize, oldSize, thr)
  const c = CheckTree(consistencyPath, newSize, newRoot, oldSize, oldRoot)
  expect(c).toBe(true)

})
