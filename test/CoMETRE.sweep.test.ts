import { RFC9162, CoMETRE } from '../src'

it('sweep', async () => {

  const leaves: Uint8Array[] = []
  for (let i = 0; i < 10; i++) {
    const message = `emssageawfasd${i}`
    const leaf = await RFC9162.leaf(new TextEncoder().encode(message))
    leaves.push(leaf)
    const inclusion = await CoMETRE.RFC9162_SHA256.inclusion_proof(i, leaves)
    const root1 = await CoMETRE.RFC9162_SHA256.verify_inclusion_proof(leaf, inclusion)
    const root2 = await CoMETRE.getRootFromLeaves(leaves)
    expect(Buffer.from(root1).toString('hex')).toBe(Buffer.from(root2).toString('hex'))
  }

})
