import RFC9162 from '../src'

it('readme', () => {
  const entries: Uint8Array[] = []
  for (let i = 0; i < 10; i++) {
    entries.push(RFC9162.strToBin(`${String.fromCharCode(65 + i)}`))
  }
  const root = RFC9162.treeHead(entries)
  const inclusionProof = RFC9162.inclusionProof(entries[2], entries)
  const leaf = RFC9162.leaf(entries[2])
  const verifiedInclusionProof = RFC9162.verifyInclusionProof(
    root,
    leaf,
    inclusionProof,
  )
  expect(verifiedInclusionProof).toBe(true)
  entries.push(RFC9162.strToBin('Spicy update 🔥'))
  const root2 = RFC9162.treeHead(entries)
  const consistencyProof = RFC9162.consistencyProof(inclusionProof, entries)
  const verifiedConsistencyProof = RFC9162.verifyConsistencyProof(
    root,
    root2,
    consistencyProof,
  )
  expect(verifiedConsistencyProof).toBe(true)
})
