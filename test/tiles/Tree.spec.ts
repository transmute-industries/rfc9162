import fs from 'fs'
import crypto from 'crypto'

import { Hash, Tree, VerifyInclusion, VerifyConsistency, to_hex, prettyInclusionProof, prettyConsistencyProof, prettyProof } from "../../src";

const th = new Hash((data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}, 32)

it('interop generate', () => {
  const tree = new Tree(th)

  for (let i = 0; i < 10; i++) {
    const entry = `entry-${i}`
    tree.appendData(tree.encodeData(entry))
  }

  const size1 = tree.size
  const root1 = tree.hash()

  // start
  const start = 0
  const ip1 = tree.inclusionProof(start, size1)
  const sip1 = prettyInclusionProof(start, ip1, root1, size1)
  fs.writeFileSync('./test/tiles/from-ts/sip1.json', JSON.stringify(sip1, null, 2))

  // middle
  const middle = size1 / 2
  const ip2 = tree.inclusionProof(middle, size1)
  const sip2 = prettyInclusionProof(middle, ip2, root1, size1)
  fs.writeFileSync('./test/tiles/from-ts/sip2.json', JSON.stringify(sip2, null, 2))

  // end
  let end = size1 - 1
  const ip3 = tree.inclusionProof(end, size1)
  const sip3 = prettyInclusionProof(end, ip3, root1, size1)
  fs.writeFileSync('./test/tiles/from-ts/sip3.json', JSON.stringify(sip3, null, 2))


  for (let i = 10; i < 20; i++) {
    const entry = `entry-${i}`
    tree.appendData(tree.encodeData(entry))
  }
  const root2 = tree.hash()
  const size2 = tree.size

  // end
  end = size2 - 1
  const ip4 = tree.inclusionProof(end, size2)
  const sip4 = prettyInclusionProof(end, ip4, root2, size2)
  fs.writeFileSync('./test/tiles/from-ts/sip4.json', JSON.stringify(sip4, null, 2))

  const cp1 = tree.consistencyProof(size1, size2)
  const scp1 = prettyConsistencyProof(root1, size1, cp1, root2, size2)
  fs.writeFileSync('./test/tiles/from-ts/scp1.json', JSON.stringify(scp1, null, 2))

  // assert equality with go
  expect(JSON.parse(fs.readFileSync('./test/tiles/from-ts/sip1.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/from-go/sip1.json').toString()))
  expect(JSON.parse(fs.readFileSync('./test/tiles/from-ts/sip2.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/from-go/sip2.json').toString()))
  expect(JSON.parse(fs.readFileSync('./test/tiles/from-ts/sip3.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/from-go/sip3.json').toString()))
  expect(JSON.parse(fs.readFileSync('./test/tiles/from-ts/sip4.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/from-go/sip4.json').toString()))
  expect(JSON.parse(fs.readFileSync('./test/tiles/from-ts/scp1.json').toString())).toEqual(JSON.parse(fs.readFileSync('./test/tiles/from-go/scp1.json').toString()))
})

describe('tree size', () => {
  const interopSizeToRoot = JSON.parse(fs.readFileSync('./test/tiles/from-ts/size-to-root.json').toString())

  const tree = new Tree(th)
  for (let i = 0; i < 10; i++) {
    const entry = `entry-${i}`
    tree.appendData(tree.encodeData(entry))
    it(`${tree.size}`, () => {
      const calcRoot = Buffer.from(tree.hash()).toString('base64')
      const expectedRoot = interopSizeToRoot[`${tree.size}`]
      expect(calcRoot).toBe(expectedRoot)
    })
  }
})

it('sanity', () => {
  const tree = new Tree(th)
  tree.appendData(tree.encodeData('L123456'))
  const r0 = tree.hash()
  expect(to_hex(r0)).toBe('395aa064aa4c29f7010acfe3f25db9485bbd4b91897b6ad7ad547639252b4d56')
  tree.appendData(tree.encodeData('L789'))
  const r1 = tree.hash()
  expect(to_hex(r1)).toBe('1798faa3eb85affab608a28cf885a24a13af4ec794fe3abec046f21b7a799bec')
  const ip0 = tree.inclusionProof(0, 2)
  expect(prettyProof(ip0)).toEqual(["12250d7a57ba6166c61b0b135fc2c21f096f918b69a42d673d812798d9c5d693"])
  const lh0 = th.hashLeaf(tree.encodeData('L123456'))
  const ip0v = VerifyInclusion(th, 0, 2, lh0, ip0, r1)
  expect(ip0v).toBe(true)
  tree.appendData(tree.encodeData('L012'))
  const r2 = tree.hash()
  expect(to_hex(r2)).toBe('3322c85256086aa0e1984dff85eab5f1e11d4b8fbbd6c4510611e3bbab0e132a')
  const cp0 = tree.consistencyProof(2, 3)
  expect(prettyProof(cp0)).toEqual(["4852d9c133177e783c92ef70b3f7ca23d7e8f4b5dc02d415b5c7ea6426db046e"])
  const cp0v = VerifyConsistency(th, 2, 3, cp0, r1, r2)
  expect(cp0v).toBe(true)
})


describe('TestTreeIncremental', () => {
  const tree = new Tree(th)
  it('the empty tree hash', () => {
    expect(to_hex(tree.hash())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('the empty leaf hash', () => {
    const leaf = new Uint8Array()
    const leafHash = th.hashLeaf(leaf)
    tree.appendHash(leafHash)
    expect(to_hex(tree.hash())).toBe('6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d')
  })

  it('the first intermediate / root', () => {
    const leaf = tree.encodeData(`entry-1`)
    const leafHash = th.hashLeaf(leaf)
    expect(to_hex(leafHash)).toBe(`e868811a482c27d50b6d45dde79c465d6adb9b06645100477a90cf3d8518898b`)
    tree.appendHash(leafHash)
    expect(to_hex(tree.hash())).toBe('ef2154dde385935cccbaa4129960d8fb571ae75737203e70252c47431d0b2e3e')
  })

  it('the first unbalanced root', () => {
    tree.appendData(tree.encodeData(`entry-${2}`))
    expect(to_hex(tree.hash())).toBe('74d80c0d37c9d19475c2c3e6d3183ebd39031191bbd16571e2db0e4a5f999c4f')
  })

  it('the second unbalanced root', () => {
    tree.appendData(tree.encodeData(`entry-${3}`))
    expect(to_hex(tree.hash())).toBe('c34777e9c093d8a7b9907621cf12f7c868a1beb196d09a866f36933849832705')
  })
})