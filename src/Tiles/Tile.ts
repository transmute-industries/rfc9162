import crypto from 'crypto'

import { trailing_zeros_64 } from "./Node";

import { HashSize, Hash, concat, IntermediatePrefix, toHex } from "./Hash";

// need to make this a parameter
const th = new Hash((data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}, 32)


export interface HashReader {
  read_hashes: (indexes: number[]) => Uint8Array[]
}

export interface TileReader {
  height: () => number
  read_tiles: (tiles: Tile[]) => Uint8Array[]
  save_tiles: (tiles: Tile[], data: Uint8Array[]) => void
}

export type Tile = [number, number, number, number]


export function Tile(h: number, l: number, n: number, w: number) {
  return [h, l, n, w] as Tile
}

export const pretty_hash = (h: Uint8Array) => {
  return Buffer.from(h).toString('base64')
}

export const pretty_hashes = (hs: Uint8Array[]) => {
  return hs.map(pretty_hash)
}

export function stored_hash_index(level: number, n: number) {
  for (let l = level; l > 0; l--) {
    n = 2 * n + 1
  }
  let i = 0;
  while (n > 0) {
    i += n
    n >>= 1
  }
  return i + level
}

export function split_stored_hash_index(index: number) {
  let n = Math.ceil(index / 2)
  let indexN = stored_hash_index(0, n)
  indexN = Math.ceil(indexN)
  if (indexN > index) {
    throw new Error('bad math')
  }

  let x
  // eslint-disable-next-line no-constant-condition
  while (true) {
    x = indexN + 1 + trailing_zeros_64(n + 1)
    // console.log({x, indexN, n1: n+1})
    if (x > index) {
      break
    }
    n++
    indexN = x
  }
  const level = index - indexN
  n = n >> level
  return [level, n]
}

export function tile_for_storage_id(h: number, storageID: number): [Tile, number, number] {
  if (h < 0) {
    throw new Error(`tile_for_storage_id: invalid height ${h}`)
  }
  const tile_height = h
  let [level, n] = split_stored_hash_index(storageID)
  const tileLevel = Math.floor(level / h)

  // let t = [tile_height, tileLevel, tileIndex, tileWidth] as any
  level -= tileLevel * h
  const tileIndex = n << level >> h
  n -= tileIndex << tile_height >> level
  const tileWidth = (n + 1) >> 0 << level

  return [Tile(tile_height, tileLevel, tileIndex, tileWidth), (n << level) * HashSize, ((n + 1) << level) * HashSize]
}

export function tile_to_path(t: Tile) {
  const [H, L, N, W] = t
  return `tile/${H}/${L}/${N}.${W}`
}

function node_hash(left: Uint8Array, right: Uint8Array) {
  return th.hash(concat(IntermediatePrefix, concat(left, right)))
}

export function hash_from_tile(t: Tile, data: Uint8Array, storageID: number) {
  const [tH, tL, tN, tW] = t
  if (tH < 1 || tH > 30 || tL < 0 || tL >= 64 || tW < 1 || tW > (1 << tH)) {
    throw new Error(`invalid ${tile_to_path(t)}`)
  }
  if (data.length < tW * HashSize) {
    throw new Error(`data length ${data.length} is too short for ${tile_to_path(t)}`)
  }
  const [t1, start, end] = tile_for_storage_id(tH, storageID)
  const [t1H, t1L, t1N, t1W] = t1
  if (tL !== t1L || tN !== t1N || tW < t1W) {
    throw new Error(`index ${storageID} is in ${tile_to_path(t1)} not ${tile_to_path(t)}`)
  }
  const slice = data.slice(start, end)
  return tile_hash(slice)
}

export function tile_hash(data: Uint8Array): Uint8Array {
  if (data.length == 0) {
    throw new Error("bad math in tile_hash")
  }
  if (data.length === HashSize) {
    return data
  }
  const n = data.length / 2
  const left = data.slice(0, n)
  const right = data.slice(n, data.length)
  return node_hash(
    tile_hash(left),
    tile_hash(right)
  )
}

export function new_tiles(h: number, oldTreeSize: number, newTreeSize: number) {
  if (h < 0) {
    throw new Error(`new_tiles: invalid height ${h}`)
  }
  const H = h
  const tiles = [] as Tile[]
  for (let level = 0; (newTreeSize >> (H * level)) > 0; level++) {
    const oldN = oldTreeSize >> (H * level)
    const newN = newTreeSize >> (H * level)
    if (oldN == newN) {
      continue
    }
    for (let n = oldN >> H; n < (newN >> H); n++) {
      tiles.push(Tile(h, level, n, 1 << H))
    }
    const n = newN >> H
    const w = newN - (n << H)
    if (w > 0) {
      tiles.push(Tile(h, level, n, w))
    }
  }
  return tiles
}



export function read_tile_data(t: Tile, r: HashReader) {
  let size = t[3]
  if (size === 0) {
    size = 1 << t[0]
  }
  const start = t[2] << t[0]
  const indexes = []
  for (let i = 0; i < size; i++) {
    indexes[i] = stored_hash_index(t[0] * t[1], start + i)
  }
  const hashes = r.read_hashes(indexes)
  if (hashes.length != indexes.length) {
    throw new Error(`tlog: read_hashes(${indexes.length} indexes) = ${hashes.length} hashes`)
  }
  const tileData = hashes.reduce(concat)
  return tileData
}

export function stored_hash_count(n: number) {
  if (n === 0) {
    return 0
  }
  let numHash = stored_hash_index(0, n - 1) + 1
  for (let i = n - 1; (i & 1) != 0; i >>= 1) {
    numHash++
  }
  return numHash
}

export function stored_hashes_for_record_hash(n: number, h: Uint8Array, r: HashReader) {
  const hashes = [h] as Uint8Array[]
  const m = trailing_zeros_64(n + 1)
  const indexes = new Array(m).fill(0)
  for (let i = 0; i < m; i++) {
    const next = (n >> i) - 1
    indexes[m - 1 - i] = stored_hash_index(i, next)
  }
  const old = r.read_hashes(indexes)
  for (let i = 0; i < m; i++) {
    h = node_hash(old[m - 1 - i], h)
    hashes.push(h)
  }
  return hashes
}

export function record_hash(data: Uint8Array) {
  return th.hashLeaf(data)
}

export function stored_hashes(n: number, data: Uint8Array, r: HashReader) {
  return stored_hashes_for_record_hash(n, record_hash(data), r)
}




export function max_power_2(n: number) {
  let l = 0
  while ((1 << (l + 1)) < n) {
    l++
  }
  return [1 << l, l]
}



export function subtree_index(lo: number, hi: number, need: number[]) {
  while (lo < hi) {
    const [k, level] = max_power_2(hi - lo + 1)
    if ((lo & (k - 1)) != 0) {
      throw new Error(`tlog: bad math in subtree_index`)
    }
    need.push(stored_hash_index(level, lo >> level))
    lo += k
  }
  return need
}

export function subtree_hash(lo: number, hi: number, hashes: Uint8Array[]): [Uint8Array, Uint8Array[]] {
  let numTree = 0
  while (lo < hi) {
    const [k, _] = max_power_2(hi - lo + 1)
    if ((lo & (k - 1)) != 0 || lo >= hi) {
      throw new Error(`tlog: bad math in subtree_hash`)
    }
    numTree++
    lo += k
  }
  if (hashes.length < numTree) {
    throw new Error(`tlog: bad index math in subtree_hash`)
  }
  let h = hashes[numTree - 1]
  for (let i = numTree - 2; i >= 0; i--) {
    h = node_hash(hashes[i], h)
  }
  return [h, hashes.slice(numTree, hashes.length)]
}


export function tree_hash(n: number, r: HashReader) {
  if (n === 0) {
    return th.emptyRoot()
  }
  const indexes = subtree_index(0, n, [])
  let hashes = r.read_hashes(indexes)
  const sth = subtree_hash(0, n, hashes)
  const hash = sth[0]
  hashes = sth[1]
  if (hashes.length !== 0) {
    throw new Error(`tlog: bad index math in tree_hash`)
  }
  return hash
}

export function tile_bytes_are_equal(tileData1: Uint8Array, tileData2: Uint8Array) {
  return toHex(tileData1) === toHex(tileData2)
}

export function leaf_proof_index(lo: number, hi: number, n: number, need: number[]) {
  if (!(lo <= n && n < hi)) {
    throw new Error(`tlog: bad math in leaf_proof_index`)
  }
  if ((lo + 1) == hi) {
    return need
  }
  const [k, _] = max_power_2(hi - lo)
  if (n < lo + k) {
    need = leaf_proof_index(lo, lo + k, n, need)
    need = subtree_index(lo + k, hi, need)
  } else {

    need = subtree_index(lo, lo + k, need)
    need = leaf_proof_index(lo + k, hi, n, need)
  }
  return need
}

export function leaf_proof(lo: number, hi: number, n: number, hashes: Uint8Array[]): [RecordProof, Uint8Array[]] {
  if (!(lo <= n && n < hi)) {
    throw new Error(`tlog: bad math in leaf_proof`)
  }
  if (lo + 1 == hi) {
    return [[] as RecordProof, hashes]
  }
  let p: any
  let th: any
  const [k, _] = max_power_2(hi - lo)
  if (n < lo + k) {
    [p, hashes] = leaf_proof(lo, lo + k, n, hashes)
    const sth = subtree_hash(lo + k, hi, hashes)
    th = sth[0]
    hashes = sth[1]
  } else {
    [th, hashes] = subtree_hash(lo, lo + k, hashes)
    const lp = leaf_proof(lo + k, hi, n, hashes)
    p = lp[0]
    hashes = lp[1]
  }
  p.push(th)
  return [p, hashes]
}

export type RecordProof = Uint8Array[]

export function prove_record(t: number, n: number, r: HashReader) {
  if (t < 0 || n < 0 || n >= t) {
    throw new Error('tlog: invalid inputs in prove_record')
  }
  const indexes = leaf_proof_index(0, t, n, [])
  if (indexes.length === 0) {
    return [] as RecordProof
  }
  let hashes = r.read_hashes(indexes)
  if (hashes.length != indexes.length) {
    throw new Error(`tlog: read_hashes(${indexes.length} indexes) = ${hashes.length} hashes`)
  }
  let p;
  [p, hashes] = leaf_proof(0, t, n, hashes)
  if (hashes.length != 0) {
    throw new Error(`tlog: bad index math in prove_record`)
  }
  return p
}

export function run_record_proof(p: RecordProof, lo: number, hi: number, n: number, leafHash: Uint8Array): Uint8Array {
  if (!(lo <= n && n < hi)) {
    throw new Error(`tlog: bad math in run_record_proof`)
  }
  if (lo + 1 === hi) {
    if (p.length !== 0) {
      throw new Error('errProofFailed')
    }
    return leafHash
  }

  if (p.length === 0) {
    throw new Error('errProofFailed')
  }

  const [k, _] = max_power_2(hi - lo)
  if (n < lo + k) {
    const nextHash = run_record_proof(p.slice(0, p.length - 1), lo, lo + k, n, leafHash)
    return node_hash(nextHash, p[p.length - 1])
  } else {
    const nextHash = run_record_proof(p.slice(0, p.length - 1), lo + k, hi, n, leafHash)
    return node_hash(p[p.length - 1], nextHash)
  }

}

export function check_record(p: RecordProof, t: number, th: Uint8Array, n: number, h: Uint8Array) {
  if (t < 0 || n < 0 || n >= t) {
    throw new Error(`tlog: invalid inputs in check_record`)
  }
  const th2 = run_record_proof(p, 0, t, n, h)
  return toHex(th2) === toHex(th)
}

export function tile_parent(t: Tile, k: number, n: number): Tile {
  let [tH, tL, tN, tW] = [...t]
  tL += k
  tN >>= (k * tH)
  tW = 1 << (tH)
  const max = n >> (tL * tH)
  if ((tN << tH) + tW >= max) {
    if ((tN << tH) >= max) {
      return Tile(tH, tL, tN, tW) // ?
    }
    tW = max - (tN << tH)
  }
  return Tile(tH, tL, tN, tW)
}

export class TileHashReader {
  constructor(public size: number, public root: Uint8Array, public storage: TileReader) { }
  read_hashes(indexes: number[]) {
    const h = this.storage.height()
    const tileOrder = {} as Record<string, number>
    const tiles = [] as Tile[]
    const stx = subtree_index(0, this.size, [])
    const stxTileOrder = new Array(stx.length).fill(0)
    for (let i = 0; i < stx.length; i++) {
      const x = stx[i]
      let [tile] = tile_for_storage_id(h, x)
      tile = tile_parent(tile, 0, this.size)
      if (tileOrder[tile_to_path(tile)]) {
        stxTileOrder[i] = tileOrder[tile_to_path(tile)]
        continue
      }
      stxTileOrder[i] = tiles.length
      tileOrder[tile_to_path(tile)] = tiles.length
      tiles.push(tile)
    }

    // Plan to fetch tiles containing the indexes,
    // along with any parent tiles needed
    // for authentication. For most calls,
    // the parents are being fetched anyway.

    const indexTileOrder = new Array(indexes.length).fill(0)
    for (let i = 0; i < indexes.length; i++) {
      const x = indexes[i]
      if (x >= stored_hash_index(0, this.size)) {
        throw new Error(`indexes not in tree`)
      }

      const [tile] = tile_for_storage_id(h, x)
      let k = 0;
      for (; ; k++) {
        const p = tile_parent(tile, k, this.size)
        if (tileOrder[tile_to_path(p)] !== undefined) {
          if (k === 0) {
            indexTileOrder[i] = tileOrder[tile_to_path(p)]
          }
          break
        }
      }

      // Walk back down recording child tiles after parents.
      // This loop ends by revisiting the tile for this index
      // (tile_parent(tile, 0, r.tree.N)) unless k == 0, in which
      // case the previous loop did it.

      for (k--; k >= 0; k--) {
        // console.log("r.tree.N ", this.size)
        const p = tile_parent(tile, k, this.size)
        if (p[3] != (1 << p[0])) {
          // Only full tiles have parents.
          // This tile has a parent, so it must be full.
          throw new Error(`"bad math in tileHashReader: %d %d %v`)
        }
        tileOrder[tile_to_path(p)] = tiles.length
        if (k == 0) {
          indexTileOrder[i] = tiles.length
        }
        tiles.push(p)
      }

    }
    // Fetch all the tile data.

    const data = this.storage.read_tiles(tiles)
    if (data.length != tiles.length) {
      throw new Error(`TileReader returned bad result slice (len=%d, want %d)`)
    }

    // this slows things down... and should be removed...
    // for (let i = 0; i < tiles.length; i++) {
    //   const tile = tiles[i]
    //   if (data[i].length !== tile[3] * HashSize) {
    //     throw new Error(`TileReader returned bad result slice (%v len=%d, want %d)`)
    //   }
    // }

    // Authenticate the initial tiles against the tree hash.
    // They are arranged so that parents are authenticated before children.
    // First the tiles needed for the tree hash.

    let th = hash_from_tile(tiles[stxTileOrder[stx.length - 1]], data[stxTileOrder[stx.length - 1]], stx[stx.length - 1])
    for (let i = stx.length - 2; i >= 0; i--) {
      const h = hash_from_tile(tiles[stxTileOrder[i]], data[stxTileOrder[i]], stx[i])
      th = node_hash(h, th)
    }
    if (toHex(th) != toHex(this.root)) {
      throw new Error(`downloaded inconsistent tile`)
    }

    // Authenticate full tiles against their parents.
    for (let i = stx.length; i < tiles.length; i++) {
      const tile = tiles[i]
      const p = tile_parent(tile, 1, this.size)
      const j = tileOrder[tile_to_path(p)]
      if (j === undefined) {
        throw new Error(`bad math in tileHashReader %d %v: lost parent of %v`)
      }
      const h = hash_from_tile(p, data[j], stored_hash_index(p[1] * p[0], tile[2]))
      if (toHex(h) != toHex(tile_hash(data[i]))) {
        throw new Error(`downloaded inconsistent tile 2`)
      }
    }

    this.storage.save_tiles(tiles, data)
    // pull out requested hashes
    const hashes = new Array(indexes.length).fill(new Uint8Array())
    for (let i = 0; i < indexes.length; i++) {
      const x = indexes[i]
      const j = indexTileOrder[i]
      const h = hash_from_tile(tiles[j], data[j], x)
      hashes[i] = h
    }
    return hashes
  }
}

export function tree_proof_index(lo: number, hi: number, n: number, need: number[]) {
  if (!(lo < n && n <= hi)) {
    throw new Error(`tlog: bad math in tree_proof_index`)
  }
  if (n === hi) {
    if (lo === 0) {
      return need
    }
    return subtree_index(lo, hi, need)
  }
  const [k, _] = max_power_2(hi - lo)
  if (n <= lo + k) {
    need = tree_proof_index(lo, lo + k, n, need)
    need = subtree_index(lo + k, hi, need)
  } else {
    need = subtree_index(lo, lo + k, need)
    need = tree_proof_index(lo + k, hi, n, need)
  }
  return need
}


export function tree_proof(lo: number, hi: number, n: number, hashes: Uint8Array[]): [Uint8Array[], Uint8Array[]] {
  if (!(lo < n && n <= hi)) {
    throw new Error(`tlog: bad math in tree_proof`)
  }
  if (n === hi) {
    if (lo == 0) {
      return [[], hashes]
    }
    let th
    [th, hashes] = subtree_hash(lo, hi, hashes)
    return [[th], hashes]
  }

  // Interior node for the proof.
  let p
  let th

  const [k, _] = max_power_2(hi - lo)
  if (n <= lo + k) {
    [p, hashes] = tree_proof(lo, lo + k, n, hashes)
    const sth: any = subtree_hash(lo + k, hi, hashes) // liekly problem
    th = sth[0]
    hashes = sth[1]

  } else {
    [th, hashes] = subtree_hash(lo, lo + k, hashes)
    const tp = tree_proof(lo + k, hi, n, hashes)
    p = tp[0]
    hashes = tp[1]

  }
  p.push(th)
  return [p, hashes]

}

export function prove_tree(t: number, n: number, h: HashReader) {
  if (t < 1 || n < 1 || n > t) {
    throw new Error(`tlog: invalid inputs in prove_tree`)
  }
  const indexes = tree_proof_index(0, t, n, [])
  if (indexes.length === 0) {
    return []
  }
  let hashes = h.read_hashes(indexes)
  if (hashes.length != indexes.length) {
    throw new Error(`tlog: read_hashes(%d indexes) = %d hashes`)
  }
  let p
  [p, hashes] = tree_proof(0, t, n, hashes)
  if (hashes.length != 0) {
    throw new Error(`tlog: bad index math in prove_tree`)
  }
  return p
}

export function run_tree_proof(p: Uint8Array[], lo: number, hi: number, n: number, old: Uint8Array): [Uint8Array, Uint8Array] {
  if (!(lo < n && n <= hi)) {
    throw new Error(`tlog: bad math in run_tree_proof`)
  }
  if (n == hi) {
    if (lo == 0) {
      if (p.length !== 0) {
        throw new Error(`errProofFailed`)
      }
      return [old, old]
    }
    if (p.length != 1) {
      throw new Error(`errProofFailed`)
    }
    return [p[0], p[0]]
  }

  if (p.length == 0) {
    throw new Error(`errProofFailed`)
  }

  const [k, _] = max_power_2(hi - lo)
  if (n <= lo + k) {
    const [oh, th] = run_tree_proof(p.slice(0, p.length - 1), lo, lo + k, n, old)
    return [oh, node_hash(th, p[p.length - 1])]
  } else {
    const [oh, th] = run_tree_proof(p.slice(0, p.length - 1), lo + k, hi, n, old)
    return [node_hash(p[p.length - 1], oh), node_hash(p[p.length - 1], th)]
  }

}

export function check_tree(p: Uint8Array[], t: number, th: Uint8Array, n: number, h: Uint8Array) {
  if (t < 1 || n < 1 || n > t) {
    throw new Error(`tlog: invalid inputs in check_tree`)
  }

  const [h2, th2] = run_tree_proof(p, 0, t, n, h)
  if (toHex(th2) == toHex(th) && toHex(h2) == toHex(h)) {
    return true
  }
  throw new Error('errProofFailed')

}