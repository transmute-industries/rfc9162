import { RFC9162, CoMETRE } from '../src'

const entries1: Uint8Array[] = []
const entries2: Uint8Array[] = []

for (let i = 0; i < 10; i++) {
  entries1.push(RFC9162.strToBin(`${String.fromCharCode(65 + i)}`))
}



for (let i = 0; i < 15; i++) {
  entries2.push(RFC9162.strToBin(`${String.fromCharCode(65 + i)}`))
}


it('tree from leaves', async () => {

  const leaves1 = await Promise.all(entries1.map((entry) => {
    return CoMETRE.getLeafFromEntry(entry)
  }))
  const root1 = await CoMETRE.getRootFromLeaves(leaves1)
  expect(RFC9162.binToHex(root1)).toBe(
    '5c24145146b182c48953638243a0735c710325f3712cf1d3a172733d4b6c3e7c',
  )
  const root2 = await CoMETRE.getRootFromLeaves(leaves1)
  expect(RFC9162.binToHex(root2)).toBe(
    '5c24145146b182c48953638243a0735c710325f3712cf1d3a172733d4b6c3e7c',
  )
})

it('root from proof', async () => {
  const leaves1 = await Promise.all(entries1.map((entry) => {
    return CoMETRE.getLeafFromEntry(entry)
  }))
  const leaf_index = 3

  const proof = await CoMETRE.getInclusionProofForLeaf(leaf_index, leaves1)
  const root = await CoMETRE.getRootFromInclusionProof(leaves1[leaf_index], proof)
  expect(RFC9162.binToHex(root)).toBe(
    '5c24145146b182c48953638243a0735c710325f3712cf1d3a172733d4b6c3e7c',
  )
})

it('consistency', async () => {
  const leaves1 = await Promise.all(entries1.map((entry) => {
    return CoMETRE.getLeafFromEntry(entry)
  }))

  const leaves2 = await Promise.all(entries2.map((entry) => {
    return CoMETRE.getLeafFromEntry(entry)
  }))

  const root1 = await CoMETRE.getRootFromLeaves(leaves1)
  const hash2 = await RFC9162.treeHead(entries1)
  expect(hash2).toEqual(root1)
  const hash3 = await RFC9162.treeHead(entries2)

  const root2 = await CoMETRE.getRootFromLeaves(leaves2)
  expect(hash3).toEqual(root2)
  const inclusionProof = await CoMETRE.getInclusionProofForLeaf(0, leaves1)
  const inclusionProof2 = await RFC9162.inclusionProof(entries1[0], entries1)
  expect(inclusionProof2).toEqual(inclusionProof)
  const consistencyProof = await RFC9162.consistencyProof(inclusionProof, entries2)
  const consistencyProof2 = await CoMETRE.getConsistencyProofFromLeaves(
    inclusionProof,
    leaves2,
  )
  expect(consistencyProof2).toEqual(consistencyProof)
  const verifiedConsistency = await RFC9162.verifyConsistencyProof(
    hash2,
    hash3,
    consistencyProof,
  )
  expect(verifiedConsistency).toBe(true)
})

it('sdk', async () => {
  const leaf_index = 3
  const leaves1 = await Promise.all(entries1.map((entry) => {
    return CoMETRE.getLeafFromEntry(entry)
  }))
  const leaves2 = await Promise.all(entries2.map((entry) => {
    return CoMETRE.getLeafFromEntry(entry)
  }))
  const root2 = await CoMETRE.getRootFromLeaves(leaves2)

  const root1 = await CoMETRE.getRootFromLeaves(leaves1)
  const leaf = leaves1[leaf_index]
  const iproof = await CoMETRE.RFC9162_SHA256.inclusion_proof(3, leaves1)
  const vroot = await CoMETRE.RFC9162_SHA256.verify_inclusion_proof(leaf, iproof)
  expect(root1).toEqual(vroot)
  const cproof = await CoMETRE.RFC9162_SHA256.consistency_proof(iproof, leaves2)
  const vcproof = await CoMETRE.RFC9162_SHA256.verify_consistency_proof(
    root1,
    root2,
    cproof,
  )
  expect(vcproof).toBe(true)
})
