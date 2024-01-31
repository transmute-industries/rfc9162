import RFC9162 from '../src'

it('readme', async () => {
  const entries: Uint8Array[] = []
  for (let i = 0; i < 10; i++) {
    entries.push(RFC9162.strToBin(`${String.fromCharCode(65 + i)}`))
  }
  const root = await RFC9162.treeHead(entries)
  const inclusionProof = await RFC9162.inclusionProof(entries[2], entries)
  const leaf = await RFC9162.leaf(entries[2])
  const verifiedInclusionProof = await RFC9162.verifyInclusionProof(
    root,
    leaf,
    inclusionProof,
  )
  expect(verifiedInclusionProof).toBe(true)
  entries.push(await RFC9162.strToBin('Spicy update 🔥'))
  const root2 = await RFC9162.treeHead(entries)
  const consistencyProof = await RFC9162.consistencyProof(inclusionProof, entries)
  const verifiedConsistencyProof = await RFC9162.verifyConsistencyProof(
    root,
    root2,
    consistencyProof,
  )
  expect(verifiedConsistencyProof).toBe(true)
})
