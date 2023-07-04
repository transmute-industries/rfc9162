import api from '../src'

const {
  leaf,
  treeHead,
  binToHex,
  strToBin,
  verifyTree,
  inclusionProof,
  verifyInclusionProof,
} = api

it('verify entries list', async () => {

  const entries: Uint8Array[] = []
  for (let i = 0; i < 10; i++) {
    const message = `emssageawfasd${i}`
    entries.push(new TextEncoder().encode(message))
    const root = treeHead(entries)
    const verified1 = verifyTree(root, entries)
    expect(verified1).toBe(true)

    const proof = inclusionProof(entries[i], entries)
    const verified2 = verifyInclusionProof(root, leaf(entries[i]), proof)
    expect(verified2).toBe(true)
  }
})
