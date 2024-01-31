import api from '../src'

const {
  leaf,
  treeHead,
  verifyTree,
  inclusionProof,
  verifyInclusionProof,
} = api

it('verify entries list', async () => {

  const entries: Uint8Array[] = []
  for (let i = 0; i < 10; i++) {
    const message = `emssageawfasd${i}`
    entries.push(new TextEncoder().encode(message))
    const root = await treeHead(entries)
    const verified1 = await verifyTree(root, entries)
    expect(verified1).toBe(true)

    const proof = await inclusionProof(entries[i], entries)
    const verified2 = await verifyInclusionProof(root, await leaf(entries[i]), proof)
    expect(verified2).toBe(true)
  }
})
