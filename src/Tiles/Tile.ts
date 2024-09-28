


import { trailing_zeros_64 } from "./Tree"

import { TreeHash, concat, to_hex } from "./TreeHash"

export interface HashReader {
  read_hashes: (indexes: number[]) => Uint8Array[]
}

export interface TileStorage {
  height: () => number
  read_tiles: (tiles: Tile[]) => Uint8Array[]
  save_tiles: (tiles: Tile[], data: Uint8Array[]) => void
}

export type Tile = [number, number, number, number]

export type RecordProof = Uint8Array[]
export type TreeProof = Uint8Array[]

export type InclusionProof = [
  number, // tree size
  number, // record index
  RecordProof // tree path
]

export type ConsistencyProof = [
  number, // old tree size
  number, // new tree size
  TreeProof // tree path
]

export type TileLogParameters = {
  tile_height: number
  hash_size: number
  hash_function: (bytes: Uint8Array) => Uint8Array
  read_tile: (tile: string) => Uint8Array
  update_tiles: (storage_id: number, stored_hash: Uint8Array) => Uint8Array | null
}


export function create_tile(height: number, level: number, hash_number: number, width: number) {
  return [height, level, hash_number, width] as Tile
}

export function stored_hash_index(level: number, hash_number: number) {
  for (let l = level; l > 0; l--) {
    hash_number = 2 * hash_number + 1
  }
  let i = 0;
  while (hash_number > 0) {
    i += hash_number
    hash_number >>= 1
  }
  return i + level
}

export function split_stored_hash_index(record_hash_index: number) {
  let hash_number = Math.ceil(record_hash_index / 2)
  let index_hash_number = stored_hash_index(0, hash_number)
  index_hash_number = Math.ceil(index_hash_number)
  if (index_hash_number > record_hash_index) {
    throw new Error('bad math')
  }
  let x
  // eslint-disable-next-line no-constant-condition
  while (true) {
    x = index_hash_number + 1 + trailing_zeros_64(hash_number + 1)
    if (x > record_hash_index) {
      break
    }
    hash_number++
    index_hash_number = x
  }
  const level = record_hash_index - index_hash_number
  hash_number = hash_number >> level
  return [level, hash_number]
}

export function tile_for_storage_id(hash_size: number, height: number, storage_id: number): [Tile, number, number] {
  if (height < 0) {
    throw new Error(`tile_for_storage_id: invalid height ${height}`)
  }
  const tile_height = height
  let [level, n] = split_stored_hash_index(storage_id)
  const tile_level = Math.floor(level / height)
  level -= tile_level * height
  const hash_number = n << level >> height
  n -= hash_number << tile_height >> level
  const tile_width = (n + 1) >> 0 << level
  const start = (n << level) * hash_size
  const end = ((n + 1) << level) * hash_size
  const tile = create_tile(tile_height, tile_level, hash_number, tile_width)
  return [tile, start, end]
}

export function tile_to_path(tile: Tile) {
  const [H, L, N, W] = tile
  return `tile/${H}/${L}/${N}.${W}`
}


export function hash_from_tile(th: TreeHash, tile: Tile, data: Uint8Array, storage_id: number) {
  const [tile_height, tile_level, hash_number, tile_width] = tile
  if (tile_height < 1 || tile_height > 30 || tile_level < 0 || tile_level >= 64 || tile_width < 1 || tile_width > (1 << tile_height)) {
    throw new Error(`invalid ${tile_to_path(tile)}`)
  }
  if (data.length < tile_width * th.hash_size) {
    throw new Error(`data length ${data.length} is too short for ${tile_to_path(tile)}`)
  }
  const [t1, start, end] = tile_for_storage_id(th.hash_size, tile_height, storage_id)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_t1H, t1L, t1N, t1W] = t1
  if (tile_level !== t1L || hash_number !== t1N || tile_width < t1W) {
    throw new Error(`index ${storage_id} is in ${tile_to_path(t1)} not ${tile_to_path(tile)}`)
  }
  const slice = data.slice(start, end)
  return tile_hash(th, slice)
}

export function tile_hash(th: TreeHash, data: Uint8Array): Uint8Array {
  if (data.length == 0) {
    throw new Error("bad math in tile_hash")
  }
  if (data.length === th.hash_size) {
    return data
  }
  const n = data.length / 2
  const left = data.slice(0, n)
  const right = data.slice(n, data.length)

  return th.hash_children(
    tile_hash(th, left),
    tile_hash(th, right)
  )
}

export function new_tiles(h: number, old_tree_size: number, new_tree_size: number) {
  if (h < 0) {
    throw new Error(`new_tiles: invalid height ${h}`)
  }
  const H = h
  const tiles = [] as Tile[]
  for (let level = 0; (new_tree_size >> (H * level)) > 0; level++) {
    const oldN = old_tree_size >> (H * level)
    const newN = new_tree_size >> (H * level)
    if (oldN == newN) {
      continue
    }
    for (let n = oldN >> H; n < (newN >> H); n++) {
      tiles.push(create_tile(h, level, n, 1 << H))
    }
    const n = newN >> H
    const w = newN - (n << H)
    if (w > 0) {
      tiles.push(create_tile(h, level, n, w))
    }
  }
  return tiles
}

export function read_tile_data(tile: Tile, r: HashReader) {
  let size = tile[3]
  if (size === 0) {
    size = 1 << tile[0]
  }
  const start = tile[2] << tile[0]
  const indexes = []
  for (let i = 0; i < size; i++) {
    indexes[i] = stored_hash_index(tile[0] * tile[1], start + i)
  }
  const hashes = r.read_hashes(indexes)
  if (hashes.length != indexes.length) {
    throw new Error(`tlog: read_hashes(${indexes.length} indexes) = ${hashes.length} hashes`)
  }
  const tileData = hashes.reduce(concat)
  return tileData
}

export function stored_hash_count(record_hash_number: number) {
  if (record_hash_number === 0) {
    return 0
  }
  let num_hash = stored_hash_index(0, record_hash_number - 1) + 1
  for (let i = record_hash_number - 1; (i & 1) != 0; i >>= 1) {
    num_hash++
  }
  return num_hash
}

export function stored_hashes_for_record_hash(th: TreeHash, record_hash_number: number, record_hash: Uint8Array, r: HashReader) {
  const hashes = [record_hash] as Uint8Array[]
  const m = trailing_zeros_64(record_hash_number + 1)
  const indexes = new Array(m).fill(0)
  for (let i = 0; i < m; i++) {
    const next = (record_hash_number >> i) - 1
    indexes[m - 1 - i] = stored_hash_index(i, next)
  }
  const old = r.read_hashes(indexes)
  for (let i = 0; i < m; i++) {
    record_hash = th.hash_children(old[m - 1 - i], record_hash)
    hashes.push(record_hash)
  }
  return hashes
}



export function stored_hashes(th: TreeHash, record_hash_number: number, data: Uint8Array, r: HashReader) {
  return stored_hashes_for_record_hash(th, record_hash_number, th.hash_leaf(data), r)
}

export function max_power_2(n: number) {
  let l = 0
  while ((1 << (l + 1)) < n) {
    l++
  }
  return [1 << l, l]
}

export function subtree_index(lo: number, hi: number, needed_storage_ids: number[]) {
  while (lo < hi) {
    const [k, level] = max_power_2(hi - lo + 1)
    if ((lo & (k - 1)) != 0) {
      throw new Error(`tlog: bad math in subtree_index`)
    }
    needed_storage_ids.push(stored_hash_index(level, lo >> level))
    lo += k
  }
  return needed_storage_ids
}

export function subtree_hash(th: TreeHash, lo: number, hi: number, hashes: Uint8Array[]): [Uint8Array, Uint8Array[]] {
  let num_tree = 0
  while (lo < hi) {
    const [k, _] = max_power_2(hi - lo + 1)
    if ((lo & (k - 1)) != 0 || lo >= hi) {
      throw new Error(`tlog: bad math in subtree_hash`)
    }
    num_tree++
    lo += k
  }
  if (hashes.length < num_tree) {
    throw new Error(`tlog: bad index math in subtree_hash`)
  }
  let h = hashes[num_tree - 1]
  for (let i = num_tree - 2; i >= 0; i--) {
    h = th.hash_children(hashes[i], h)
  }
  return [h, hashes.slice(num_tree, hashes.length)]
}


export function tree_hash(th: TreeHash, record_hash_number: number, hash_reader: HashReader) {
  if (record_hash_number === 0) {
    return th.empty_root()
  }
  const indexes = subtree_index(0, record_hash_number, [])
  let hashes = hash_reader.read_hashes(indexes)
  const sth = subtree_hash(th, 0, record_hash_number, hashes)
  const hash = sth[0]
  hashes = sth[1]
  if (hashes.length !== 0) {
    throw new Error(`tlog: bad index math in tree_hash`)
  }
  return hash
}



export function leaf_proof_index(lo: number, hi: number, record_hash_index: number, needed_storage_ids: number[]) {
  if (!(lo <= record_hash_index && record_hash_index < hi)) {
    throw new Error(`tlog: bad math in leaf_proof_index`)
  }
  if ((lo + 1) == hi) {
    return needed_storage_ids
  }
  const [k, _] = max_power_2(hi - lo)
  if (record_hash_index < lo + k) {
    needed_storage_ids = leaf_proof_index(lo, lo + k, record_hash_index, needed_storage_ids)
    needed_storage_ids = subtree_index(lo + k, hi, needed_storage_ids)
  } else {

    needed_storage_ids = subtree_index(lo, lo + k, needed_storage_ids)
    needed_storage_ids = leaf_proof_index(lo + k, hi, record_hash_index, needed_storage_ids)
  }
  return needed_storage_ids
}

export function leaf_proof(th: TreeHash, lo: number, hi: number, record_hash_index: number, hashes: Uint8Array[]): [RecordProof, Uint8Array[]] {
  if (!(lo <= record_hash_index && record_hash_index < hi)) {
    throw new Error(`tlog: bad math in leaf_proof`)
  }
  if (lo + 1 == hi) {
    return [[] as RecordProof, hashes]
  }
  let p: Uint8Array[]
  let next_hash: Uint8Array
  const [k, _] = max_power_2(hi - lo)
  if (record_hash_index < lo + k) {
    [p, hashes] = leaf_proof(th, lo, lo + k, record_hash_index, hashes)
    const sth = subtree_hash(th, lo + k, hi, hashes)
    next_hash = sth[0]
    hashes = sth[1]
  } else {
    [next_hash, hashes] = subtree_hash(th, lo, lo + k, hashes)
    const lp = leaf_proof(th, lo + k, hi, record_hash_index, hashes)
    p = lp[0]
    hashes = lp[1]
  }
  p.push(next_hash)
  return [p, hashes]
}



export function prove_record(th: TreeHash, tile: number, n: number, hash_reader: HashReader) {
  if (tile < 0 || n < 0 || n >= tile) {
    throw new Error('tlog: invalid inputs in prove_record')
  }
  const indexes = leaf_proof_index(0, tile, n, [])
  if (indexes.length === 0) {
    return [] as RecordProof
  }
  let hashes = hash_reader.read_hashes(indexes)
  if (hashes.length != indexes.length) {
    throw new Error(`tlog: read_hashes(${indexes.length} indexes) = ${hashes.length} hashes`)
  }
  let p;
  // eslint-disable-next-line prefer-const
  [p, hashes] = leaf_proof(th, 0, tile, n, hashes)
  if (hashes.length != 0) {
    throw new Error(`tlog: bad index math in prove_record`)
  }
  return p
}

export function run_record_proof(th: TreeHash, record_proof: RecordProof, lo: number, hi: number, leaf_index: number, leaf_hash: Uint8Array): Uint8Array {
  if (!(lo <= leaf_index && leaf_index < hi)) {
    throw new Error(`tlog: bad math in run_record_proof`)
  }
  if (lo + 1 === hi) {
    if (record_proof.length !== 0) {
      throw new Error('errProofFailed')
    }
    return leaf_hash
  }

  if (record_proof.length === 0) {
    throw new Error('errProofFailed')
  }

  const [k, _] = max_power_2(hi - lo)
  if (leaf_index < lo + k) {
    const nextHash = run_record_proof(th, record_proof.slice(0, record_proof.length - 1), lo, lo + k, leaf_index, leaf_hash)
    return th.hash_children(nextHash, record_proof[record_proof.length - 1])
  } else {
    const nextHash = run_record_proof(th, record_proof.slice(0, record_proof.length - 1), lo + k, hi, leaf_index, leaf_hash)
    return th.hash_children(record_proof[record_proof.length - 1], nextHash)
  }

}

export function root_from_record_proof(th: TreeHash, record_proof: RecordProof, tree_size: number, record_index: number, record_hash: Uint8Array) {
  if (tree_size < 0) {
    throw new Error(`tlog: tree_size less than 0 in root_from_record_proof`)
  }
  if (record_index < 0) {
    throw new Error(`tlog: record_index less than 0 in root_from_record_proof`)
  }
  if (record_index >= tree_size) {
    throw new Error(`tlog: record_index greater than or equal to tree_size in root_from_record_proof`)
  }
  return run_record_proof(th, record_proof, 0, tree_size, record_index, record_hash)
}

export function check_record(th: TreeHash, record_proof: RecordProof, record_index: number, tree_root: Uint8Array, tree_size: number, record_hash: Uint8Array) {
  const reconstructed_root = root_from_record_proof(th, record_proof, record_index, tree_size, record_hash)
  return to_hex(reconstructed_root) === to_hex(tree_root)
}

export function tile_parent(tile: Tile, k: number, n: number): Tile {
  // eslint-disable-next-line prefer-const
  let [tile_height, tile_level, hash_number, tile_width] = [...tile]
  tile_level += k
  hash_number >>= (k * tile_height)
  tile_width = 1 << (tile_height)
  const max = n >> (tile_level * tile_height)
  if ((hash_number << tile_height) + tile_width >= max) {
    if ((hash_number << tile_height) >= max) {
      return create_tile(tile_height, tile_level, hash_number, tile_width) // ?
    }
    tile_width = max - (hash_number << tile_height)
  }
  return create_tile(tile_height, tile_level, hash_number, tile_width)
}


export function tree_proof_index(lo: number, hi: number, record_index: number, needed_storage_ids: number[]) {
  if (!(lo < record_index && record_index <= hi)) {
    throw new Error(`tlog: bad math in tree_proof_index`)
  }
  if (record_index === hi) {
    if (lo === 0) {
      return needed_storage_ids
    }
    return subtree_index(lo, hi, needed_storage_ids)
  }
  const [k, _] = max_power_2(hi - lo)
  if (record_index <= lo + k) {
    needed_storage_ids = tree_proof_index(lo, lo + k, record_index, needed_storage_ids)
    needed_storage_ids = subtree_index(lo + k, hi, needed_storage_ids)
  } else {
    needed_storage_ids = subtree_index(lo, lo + k, needed_storage_ids)
    needed_storage_ids = tree_proof_index(lo + k, hi, record_index, needed_storage_ids)
  }
  return needed_storage_ids
}


export function tree_proof(th: TreeHash, lo: number, hi: number, record_index: number, hashes: Uint8Array[]): [Uint8Array[], Uint8Array[]] {
  if (!(lo < record_index && record_index <= hi)) {
    throw new Error(`tlog: bad math in tree_proof`)
  }
  if (record_index === hi) {
    if (lo == 0) {
      return [[], hashes]
    }
    let next_hash
    [next_hash, hashes] = subtree_hash(th, lo, hi, hashes)
    return [[next_hash], hashes]
  }

  // Interior node for the proof.
  let p
  let next_hash: Uint8Array

  const [k, _] = max_power_2(hi - lo)
  if (record_index <= lo + k) {
    [p, hashes] = tree_proof(th, lo, lo + k, record_index, hashes)
    const sth: [Uint8Array, Uint8Array[]] = subtree_hash(th, lo + k, hi, hashes)
    next_hash = sth[0]
    hashes = sth[1]

  } else {
    [next_hash, hashes] = subtree_hash(th, lo, lo + k, hashes)
    const tp = tree_proof(th, lo + k, hi, record_index, hashes)
    p = tp[0]
    hashes = tp[1]

  }

  p.push(next_hash)
  return [p, hashes]

}

export function prove_tree(th: TreeHash, tile: number, record_index: number, hash_reader: HashReader) {
  if (tile < 1 || record_index < 1 || record_index > tile) {
    throw new Error(`tlog: invalid inputs in prove_tree`)
  }
  const indexes = tree_proof_index(0, tile, record_index, [])
  if (indexes.length === 0) {
    return []
  }
  let hashes = hash_reader.read_hashes(indexes)
  if (hashes.length != indexes.length) {
    throw new Error(`tlog: read_hashes(%d indexes) = %d hashes`)
  }
  let p
  // eslint-disable-next-line prefer-const
  [p, hashes] = tree_proof(th, 0, tile, record_index, hashes)
  if (hashes.length != 0) {
    throw new Error(`tlog: bad index math in prove_tree`)
  }
  return p
}

export function run_tree_proof(th: TreeHash, p: Uint8Array[], lo: number, hi: number, record_index: number, old: Uint8Array): [Uint8Array, Uint8Array] {
  if (!(lo < record_index && record_index <= hi)) {
    throw new Error(`tlog: bad math in run_tree_proof`)
  }
  if (record_index == hi) {
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
  if (record_index <= lo + k) {
    const [oh, next_hash] = run_tree_proof(th, p.slice(0, p.length - 1), lo, lo + k, record_index, old)
    return [oh, th.hash_children(next_hash, p[p.length - 1])]
  } else {
    const [oh, next_hash] = run_tree_proof(th, p.slice(0, p.length - 1), lo + k, hi, record_index, old)
    return [th.hash_children(p[p.length - 1], oh), th.hash_children(p[p.length - 1], next_hash)]
  }
}

export function new_tree_root_from_tree_proof(th: TreeHash, tree_proof: Uint8Array[], new_tree_size: number, old_tree_size: number, old_tree_root: Uint8Array) {
  if (old_tree_size > new_tree_size) {
    throw new Error(`tlog: old_tree_size is greater than new_tree_size in check_tree`)
  }
  if (old_tree_size < 1) {
    throw new Error(`tlog: old_tree_size is less than 1 in check_tree`)
  }
  if (new_tree_size < 1) {
    throw new Error(`tlog: new_tree_size is less than 1 in check_tree`)
  }
  const [reconstructed_old_root, reconstructed_new_root] = run_tree_proof(th, tree_proof, 0, new_tree_size, old_tree_size, old_tree_root)
  if (to_hex(reconstructed_old_root) == to_hex(old_tree_root)) {
    return reconstructed_new_root
  }
  return new Uint8Array()
}

export function check_tree(th: TreeHash, tree_proof: Uint8Array[], new_tree_size: number, new_tree_root: Uint8Array, old_tree_size: number, old_tree_root: Uint8Array) {
  const reconstructed_new_tree_root = new_tree_root_from_tree_proof(th, tree_proof, new_tree_size, old_tree_size, old_tree_root)
  if (to_hex(reconstructed_new_tree_root) == to_hex(new_tree_root)) {
    return true
  }
  throw new Error('check_tree failed')
}



export class TileHashReader implements HashReader {
  constructor(public size: number, public root: Uint8Array, public tile_storage: TileStorage, public th: TreeHash) { }
  read_hashes(indexes: number[]) {
    const height = this.tile_storage.height()
    const tileOrder = {} as Record<string, number>
    const tiles = [] as Tile[]
    const stx = subtree_index(0, this.size, [])
    const stxTileOrder = new Array(stx.length).fill(0)
    for (let i = 0; i < stx.length; i++) {
      const x = stx[i]
      let [tile] = tile_for_storage_id(this.th.hash_size, height, x)
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

      const [tile] = tile_for_storage_id(this.th.hash_size, height, x)
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

    const data = this.tile_storage.read_tiles(tiles)
    if (data.length != tiles.length) {
      throw new Error(`TileStorage returned bad result slice (len=%d, want %d)`)
    }

    // this slows things down... and should be removed...
    // for (let i = 0; i < tiles.length; i++) {
    //   const tile = tiles[i]
    //   if (data[i].length !== tile[3] * hash_size) {
    //     throw new Error(`TileStorage returned bad result slice (%v len=%d, want %d)`)
    //   }
    // }

    // Authenticate the initial tiles against the tree hash.
    // They are arranged so that parents are authenticated before children.
    // First the tiles needed for the tree hash.

    let next_hash = hash_from_tile(this.th, tiles[stxTileOrder[stx.length - 1]], data[stxTileOrder[stx.length - 1]], stx[stx.length - 1])
    for (let i = stx.length - 2; i >= 0; i--) {
      const h = hash_from_tile(this.th, tiles[stxTileOrder[i]], data[stxTileOrder[i]], stx[i])
      next_hash = this.th.hash_children(h, next_hash)
    }
    if (to_hex(next_hash) != to_hex(this.root)) {
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
      const h = hash_from_tile(this.th, p, data[j], stored_hash_index(p[1] * p[0], tile[2]))
      if (to_hex(h) != to_hex(tile_hash(this.th, data[i]))) {
        throw new Error(`downloaded inconsistent tile 2`)
      }
    }

    this.tile_storage.save_tiles(tiles, data)
    // pull out requested hashes
    const hashes = new Array(indexes.length).fill(new Uint8Array())
    for (let i = 0; i < indexes.length; i++) {
      const x = indexes[i]
      const j = indexTileOrder[i]
      const h = hash_from_tile(this.th, tiles[j], data[j], x)
      hashes[i] = h
    }
    return hashes
  }
}

export class TileLog implements TileStorage, HashReader {
  public th: TreeHash
  public thr: TileHashReader
  public tree_size = 0
  public tree_root: Uint8Array
  public read_tile
  public update_tiles
  public tile_height: number
  constructor(
    config: TileLogParameters
  ) {
    this.tile_height = config.tile_height
    this.th = new TreeHash(config.hash_function, config.hash_size)
    this.tree_root = this.th.empty_root()
    this.thr = new TileHashReader(this.tree_size, this.tree_root, this, this.th,)
    this.read_tile = config.read_tile
    this.update_tiles = config.update_tiles
  }
  record_hash(data: Uint8Array) {
    return this.th.hash_leaf(data)
  }
  inclusion_proof(tree_size: number, record_index: number): InclusionProof {
    return [tree_size, record_index, prove_record(this.th, tree_size, record_index, this)]
  }
  verify_inclusion_proof(root: Uint8Array, inclusion_proof: InclusionProof, record_hash: Uint8Array) {
    const [tree_size, record_index, record_proof] = inclusion_proof
    return check_record(this.th, record_proof, tree_size, root, record_index, record_hash)
  }
  consistency_proof(old_tree_size: number, new_tree_size: number): ConsistencyProof {
    return [old_tree_size, new_tree_size, prove_tree(this.th, new_tree_size, old_tree_size, this)]
  }
  verify_consistency_proof(old_tree_root: Uint8Array, consistency_proof: ConsistencyProof, new_tree_root: Uint8Array) {
    const [old_tree_size, new_tree_size, proof] = consistency_proof
    return check_tree(this.th, proof, new_tree_size, new_tree_root, old_tree_size, old_tree_root)
  }
  root_from_inclusion_proof(inclusion_proof: InclusionProof, record_hash: Uint8Array): Uint8Array {
    const [tree_size, record_index, record_proof] = inclusion_proof
    return root_from_record_proof(this.th, record_proof, tree_size, record_index, record_hash)
  }
  root_from_consistency_proof(old_root: Uint8Array, consistency_proof: ConsistencyProof) {
    const [old_tree_size, new_tree_size, tree_proof] = consistency_proof
    return new_tree_root_from_tree_proof(this.th, tree_proof, new_tree_size, old_tree_size, old_root)
  }
  height() {
    return this.tile_height
  }
  read_tiles(tiles: Tile[]) {
    const result = [] as Uint8Array[]
    for (const tile of tiles) {
      const tile_data = this.read_tile(tile_to_path(tile))
      result.push(tile_data)
    }
    return result
  }
  save_tiles(tiles: Tile[]) {
    // this is usually called on the client
    // there is no needed_storage_ids to save tiles on the server
    // since they are already saved when this is called
    // in order to make a client implementation
    // we needed_storage_ids to make the whole process async
  }
  read_hashes(storage_ids: number[]) {
    return storage_ids.map((storage_id) => {
      const [tile] = tile_for_storage_id(this.th.hash_size, 2, storage_id)
      const tileData = this.read_tile(tile_to_path(tile))
      const hash = hash_from_tile(this.th, tile, tileData, storage_id)
      return hash
    })
  }
  size() {
    return this.tree_size
  }
  root() {
    return this.root_at(this.tree_size)
  }
  root_at(tree_size: number) {
    return tree_hash(this.th, tree_size, this)
  }
  write_record_hashes = (record_hashes: Uint8Array[]) => {
    for (const record_hash of record_hashes) {
      const leaf_index = this.size()
      const hashes = stored_hashes_for_record_hash(this.th, leaf_index, record_hash, this)
      let storage_id = stored_hash_count(leaf_index)
      for (const stored_hash of hashes) {
        // some hashes here, are not meant to be stored at all!
        // needed_storage_ids to figure out if a hash belongs in a tile or not.
        const tileData = this.update_tiles(storage_id, stored_hash)
        if (tileData === null) {
          storage_id++
          continue
        }
        storage_id++
      }
      this.tree_size++;
    }
  }
  write_record = (record: Uint8Array) => {
    this.write_record_hashes([this.record_hash(record)])
  }
}