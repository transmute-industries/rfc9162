import api from '../src'

import fs from 'fs'
import { InclusionProofDataV2 } from '../src/RFC9162'

const { treeHead } = api

describe('transparency dev examples', () => {
  it('matches go tests', async () => {
    const entries = [
      fs.readFileSync('./examples/transparency-dev/f1.txt'),
      fs.readFileSync('./examples/transparency-dev/f2.txt')
    ]
    const root1 = await treeHead(entries)
    expect(Buffer.from(root1).toString('hex')).toBe('1798faa3eb85affab608a28cf885a24a13af4ec794fe3abec046f21b7a799bec')
    entries.push(
      fs.readFileSync('./examples/transparency-dev/f3.txt')
    )
    const root2 = await treeHead(entries)
    expect(Buffer.from(root2).toString('hex')).toBe('3322c85256086aa0e1984dff85eab5f1e11d4b8fbbd6c4510611e3bbab0e132a')
  })

  it('matches sbom tests', async () => {
    const receipt = JSON.parse(fs.readFileSync("./examples/transparency-dev/receipt.json").toString())
    const fileData = fs.readFileSync("./examples/transparency-dev/test-package/node_modules/jose/dist/browser/key/generate_secret.js")
    const leafHash = await api.leaf(fileData)
    const verified = await api.verifyInclusionProof(
      new Uint8Array(Buffer.from(receipt.root, 'base64')),
      leafHash,
      {
        tree_size: receipt.size,
        leaf_index: receipt.leaf,
        inclusion_path: receipt.proof.map((p: string) => {
          return new Uint8Array(Buffer.from(p, 'base64'))
        })
      } as InclusionProofDataV2
    )
    expect(verified).toBe(true)
  })
})
