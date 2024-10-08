import fs from 'fs'

import {
  tile_for_storage_id,
  hash_from_tile,
  to_hex,
  new_tiles,
  create_tile,
  read_tile_data, stored_hash_count,
  stored_hashes, stored_hash_index,
  tree_hash,
  tile_to_path,
  prove_record,
  check_record,
  TileHashReader,
  prove_tree,
  check_tree,
  Tree, verify_inclusion, verify_consistency, concat
} from "../../../src";

import { tree_hasher, TestTileStorage, encode, pretty_hash, tile_bytes_are_equal, tile_height, hash_storage, pretty_inclusion_proof, pretty_consistency_proof, pretty_proof, } from '../test_utils';

describe('TestTiledTree', () => {

  it('create tree', () => {
    const trees = [] as Uint8Array[]
    const tiles = {} as Record<string, Uint8Array>
    const record_hashes = [] as Uint8Array[]
    hash_storage.stored_hashes = [] as Uint8Array[]
    for (let i = 0; i < 100; i++) {
      const data = encode(`leaf ${i}`)
      record_hashes.push(tree_hasher.hash_leaf(data))
      const old_storage_length = hash_storage.stored_hashes.length
      const hashes = stored_hashes(tree_hasher, i, data, hash_storage)
      hash_storage.stored_hashes = [...hash_storage.stored_hashes, ...hashes]
      if (stored_hash_count(i + 1) != hash_storage.stored_hashes.length) {
        throw new Error('Storage is more clever: ')
      }
      const tree_head = tree_hash(tree_hasher, i + 1, hash_storage)
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
        const data = read_tile_data(tile, hash_storage)
        const old = create_tile(tile[0], tile[1], tile[2], tile[3] - 1)
        const oldData = tiles[tile_to_path(old)] || new Uint8Array()
        if ((oldData.length != (data.length - tree_hasher.hash_size)) || !tile_bytes_are_equal(oldData, data.slice(0, oldData.length))) {
          throw new Error(`tile ${tile} not extending earlier tile ${old}`)
        }
        tiles[tile_to_path(tile)] = data
      }
      for (const tile of new_tiles(tile_height, 0, i + 1)) {
        const data = read_tile_data(tile, hash_storage)
        if (!tile_bytes_are_equal(tiles[tile_to_path(tile)], data)) {
          throw new Error(`mismatch at ${tile}`)
        }
      }
      for (const tile of new_tiles(tile_height, i / 2, i + 1)) {
        const data = read_tile_data(tile, hash_storage)
        if (!tile_bytes_are_equal(tiles[tile_to_path(tile)], data)) {
          throw new Error(`mismatch at ${tile}`)
        }
      }

      for (let j = old_storage_length; j < hash_storage.stored_hashes.length; j++) {
        const [tile] = tile_for_storage_id(tree_hasher.hash_size, tile_height, j)
        const data = tiles[tile_to_path(tile)]
        if (!data) {
          throw new Error(`tile_for_storage_id(${tile_height}, ${j}) = ${tile_to_path(tile)}, not yet stored (i=${i}, stored ${hash_storage.stored_hashes.length})`)
        }
        const h = hash_from_tile(tree_hasher, tile, data, j)
        if (to_hex(h) !== to_hex(hash_storage.stored_hashes[j])) {
          throw new Error(`hash_from_tile(${tile_to_path(tile)}, ${j}) = ${h}, want ${hash_storage.stored_hashes[j]}`)
        }
      }
      trees.push(tree_head)
      for (let j = 0; j <= i; j++) {
        const p = prove_record(tree_hasher, i + 1, j, hash_storage)
        if (!check_record(tree_hasher, p, i + 1, tree_head, j, record_hashes[j])) {
          throw new Error(`check_record(${i + 1}, ${j}) failed`)
        }
        for (let k = 0; k < p.length; k++) {
          p[k][0] ^= 1 // break it
          if (check_record(tree_hasher, p, i + 1, tree_head, j, record_hashes[j])) {
            throw new Error(`check_record(${i + 1}, ${j}) succeeded with corrupt proof hash #${k}!`)
          }
          p[k][0] ^= 1 // fix it
        }
      }
      // To prove a leaf that way, all you have to do is read and verify its hash.
      const tileStorage = new TestTileStorage(tiles)
      const thr = new TileHashReader(i + 1, tree_head, tileStorage, tree_hasher)
      for (let j = 0; j <= i; j++) {
        const h = thr.read_hashes([stored_hash_index(0, j)])
        if (to_hex(h[0]) != to_hex(record_hashes[j])) {
          throw new Error(`TileHashReader(%d).read_hashes(%d) returned wrong hash`)
        }
        // Even though reading the hash suffices,
        // check we can generate the proof too.
        const p = prove_record(tree_hasher, i + 1, j, thr)
        if (!check_record(tree_hasher, p, i + 1, tree_head, j, record_hashes[j])) {
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
        const h = tree_hash(tree_hasher, j + 1, thr)
        if (to_hex(h) != to_hex(trees[j])) {
          throw new Error(`"tree_hash(%d, TileHashReader(%d)) = %x, want %x (%v)`)
        }
        // Even though computing the subtree hash suffices,
        // check that we can generate the proof too.
        const p = prove_tree(tree_hasher, i + 1, j + 1, thr)
        const ct = check_tree(tree_hasher, p, i + 1, tree_head, j + 1, trees[j])
        if (!ct) {
          throw new Error(`"check_tree(%d, %d): %v [%v]`)
        }
        for (let k = 0; k < p.length; k++) {
          p[k][0] ^= 1 // break
          try {
            check_tree(tree_hasher, p, i + 1, tree_head, j + 1, trees[j]) // test
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



it('interop generate', () => {
  const tree = new Tree(tree_hasher)

  for (let i = 0; i < 10; i++) {
    const entry = `entry-${i}`
    tree.append_data(tree.encode_data(entry))
  }

  const size1 = tree.size
  const root1 = tree.hash()

  // start
  const start = 0
  const ip1 = tree.inclusion_proof(start, size1)
  const sip1 = pretty_inclusion_proof(start, ip1, root1, size1)
  fs.writeFileSync('./test/tiles/interop/from-ts/sip1.json', JSON.stringify(sip1, null, 2))

  // middle
  const middle = size1 / 2
  const ip2 = tree.inclusion_proof(middle, size1)
  const sip2 = pretty_inclusion_proof(middle, ip2, root1, size1)
  fs.writeFileSync('./test/tiles/interop/from-ts/sip2.json', JSON.stringify(sip2, null, 2))

  // end
  let end = size1 - 1
  const ip3 = tree.inclusion_proof(end, size1)
  const sip3 = pretty_inclusion_proof(end, ip3, root1, size1)
  fs.writeFileSync('./test/tiles/interop/from-ts/sip3.json', JSON.stringify(sip3, null, 2))


  for (let i = 10; i < 20; i++) {
    const entry = `entry-${i}`
    tree.append_data(tree.encode_data(entry))
  }
  const root2 = tree.hash()
  const size2 = tree.size

  // end
  end = size2 - 1
  const ip4 = tree.inclusion_proof(end, size2)
  const sip4 = pretty_inclusion_proof(end, ip4, root2, size2)
  fs.writeFileSync('./test/tiles/interop/from-ts/sip4.json', JSON.stringify(sip4, null, 2))

  const cp1 = tree.consistency_proof(size1, size2)
  const scp1 = pretty_consistency_proof(root1, size1, cp1, root2, size2)
  fs.writeFileSync('./test/tiles/interop/from-ts/scp1.json', JSON.stringify(scp1, null, 2))

  // assert equality with go
  expect(JSON.parse(fs.readFileSync('./test/tiles/interop/from-ts/sip1.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/interop/from-go/sip1.json').toString()))
  expect(JSON.parse(fs.readFileSync('./test/tiles/interop/from-ts/sip2.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/interop/from-go/sip2.json').toString()))
  expect(JSON.parse(fs.readFileSync('./test/tiles/interop/from-ts/sip3.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/interop/from-go/sip3.json').toString()))
  expect(JSON.parse(fs.readFileSync('./test/tiles/interop/from-ts/sip4.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/interop/from-go/sip4.json').toString()))
  expect(JSON.parse(fs.readFileSync('./test/tiles/interop/from-ts/scp1.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/interop/from-go/scp1.json').toString()))
})

describe('tree size', () => {
  const interopSizeToRoot = JSON.parse(fs.readFileSync('./test/tiles/interop/from-ts/size-to-root.json').toString())

  const tree = new Tree(tree_hasher)
  for (let i = 0; i < 10; i++) {
    const entry = `entry-${i}`
    tree.append_data(tree.encode_data(entry))
    it(`${tree.size}`, () => {
      const calcRoot = Buffer.from(tree.hash()).toString('base64')
      const expectedRoot = interopSizeToRoot[`${tree.size}`]
      expect(calcRoot).toBe(expectedRoot)
    })
  }
})

it('sanity', () => {
  const tree = new Tree(tree_hasher)
  tree.append_data(tree.encode_data('L123456'))
  const r0 = tree.hash()
  expect(to_hex(r0)).toBe('395aa064aa4c29f7010acfe3f25db9485bbd4b91897b6ad7ad547639252b4d56')
  tree.append_data(tree.encode_data('L789'))
  const r1 = tree.hash()
  expect(to_hex(r1)).toBe('1798faa3eb85affab608a28cf885a24a13af4ec794fe3abec046f21b7a799bec')
  const ip0 = tree.inclusion_proof(0, 2)
  expect(pretty_proof(ip0)).toEqual(["12250d7a57ba6166c61b0b135fc2c21f096f918b69a42d673d812798d9c5d693"])
  const lh0 = tree_hasher.hash_leaf(tree.encode_data('L123456'))
  const ip0v = verify_inclusion(tree_hasher, 0, 2, lh0, ip0, r1)
  expect(ip0v).toBe(true)
  tree.append_data(tree.encode_data('L012'))
  const r2 = tree.hash()
  expect(to_hex(r2)).toBe('3322c85256086aa0e1984dff85eab5f1e11d4b8fbbd6c4510611e3bbab0e132a')
  const cp0 = tree.consistency_proof(2, 3)
  expect(pretty_proof(cp0)).toEqual(["4852d9c133177e783c92ef70b3f7ca23d7e8f4b5dc02d415b5c7ea6426db046e"])
  const cp0v = verify_consistency(tree_hasher, 2, 3, cp0, r1, r2)
  expect(cp0v).toBe(true)
})


describe('TestTreeIncremental', () => {
  const tree = new Tree(tree_hasher)
  it('the empty tree hash', () => {
    expect(to_hex(tree.hash())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('the empty leaf hash', () => {
    const leaf = new Uint8Array()
    const leafHash = tree_hasher.hash_leaf(leaf)
    tree.append_record_hash(leafHash)
    expect(to_hex(tree.hash())).toBe('6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d')
  })

  it('the first intermediate / root', () => {
    const leaf = tree.encode_data(`entry-1`)
    const leafHash = tree_hasher.hash_leaf(leaf)
    expect(to_hex(leafHash)).toBe(`e868811a482c27d50b6d45dde79c465d6adb9b06645100477a90cf3d8518898b`)
    tree.append_record_hash(leafHash)
    expect(to_hex(tree.hash())).toBe('ef2154dde385935cccbaa4129960d8fb571ae75737203e70252c47431d0b2e3e')
  })

  it('the first unbalanced root', () => {
    tree.append_data(tree.encode_data(`entry-${2}`))
    expect(to_hex(tree.hash())).toBe('74d80c0d37c9d19475c2c3e6d3183ebd39031191bbd16571e2db0e4a5f999c4f')
  })

  it('the second unbalanced root', () => {
    tree.append_data(tree.encode_data(`entry-${3}`))
    expect(to_hex(tree.hash())).toBe('c34777e9c093d8a7b9907621cf12f7c868a1beb196d09a866f36933849832705')
  })
})


describe('hash_from_tile', () => {
  const tree = new Tree(tree_hasher)
  for (let i = 0; i < 26; i++) {
    const entry = `entry-${i}`
    tree.append_data(tree.encode_data(entry))
  }
  const rawData = tree.hashes[0].reduce(concat)
  it('first hash, from first tile', () => {
    const index = 0
    const [tile] = tile_for_storage_id(tree_hasher.hash_size, 2, index)
    expect(
      to_hex(
        hash_from_tile(tree_hasher, tile, rawData, index)
      ))
      .toBe(
        Buffer.from('QHZrIDNCkCb1PVRQJnmoOXBrR0H43K86i7pfQbX/4HU=', 'base64').toString('hex')
      )
  })
  it('second hash, from first tile', () => {
    const index = 1
    const [tile,] = tile_for_storage_id(tree_hasher.hash_size, 2, index)
    expect(
      to_hex(
        hash_from_tile(tree_hasher, tile, rawData, index)
      ))
      .toBe(
        Buffer.from('6GiBGkgsJ9ULbUXd55xGXWrbmwZkUQBHepDPPYUYiYs=', 'base64').toString('hex')
      )

  })
  it('third hash, from first tile', () => {
    const index = 2
    const [tile] = tile_for_storage_id(tree_hasher.hash_size, 2, index)
    expect(
      to_hex(
        hash_from_tile(tree_hasher, tile, rawData, index)
      ))
      .toBe(
        Buffer.from('LyelCCwdQq+kiKw1Cp/EOQwIT1T3Hs3/hZ6Y24QptHk=', 'base64').toString('hex')
      )
  })

  it('fourth hash, from first tile', () => {
    const index = 3
    const [tile] = tile_for_storage_id(tree_hasher.hash_size, 2, index)
    expect(
      to_hex(
        hash_from_tile(tree_hasher, tile, rawData, index)
      ))
      .toBe(
        Buffer.from('BJ19zbVrz+vTEzBMmDnxlqPUtu873AsIKY+TrIGR8Kg=', 'base64').toString('hex')
      )
  })

  it('fifth hash, from first tile', () => {
    const index = 4
    const [tile] = tile_for_storage_id(tree_hasher.hash_size, 2, index)
    expect(
      to_hex(
        hash_from_tile(tree_hasher, tile, rawData, index)
      ))
      .toBe(
        Buffer.from('J0ebarMh0u5HdFL2i6UndI6GPK/o+9HfK/idFXDRtpc=', 'base64').toString('hex')
      )
  })
})

