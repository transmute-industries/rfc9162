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

const entry1 = strToBin('A')
const entry2 = strToBin('B')

const entries: Uint8Array[] = []
for (let i = 0; i < 10; i++) {
  entries.push(strToBin(`${String.fromCharCode(65 + i)}`))
}

it('empty list', async () => {
  const root = binToHex(treeHead([]))
  expect(root).toBe(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
})

it('leaf', async () => {
  const root = binToHex(treeHead([entry1]))
  expect(root).toBe(
    'c00b4d3c929cb5cc316691ed4636f634576f2c9b2954767234c5274e9dde185d',
  )
})

it('verify leaf', async () => {
  const entries = [entry1]
  const root = treeHead(entries)
  const verified = verifyTree(root, entries)
  expect(verified).toBe(true)
})

it('smallest entries list', async () => {
  const entries = [entry1, entry2]
  const root = binToHex(treeHead(entries))
  expect(root).toBe(
    'ed692f01f7f6c46930d7ad8f9adad3f9f38b7379cf6a8d2f399a0ba1e914fe25',
  )
})

it('verify entries list', async () => {
  const entries = [entry1, entry2]
  const root = treeHead(entries)
  const verified = verifyTree(root, entries)
  expect(verified).toBe(true)
  expect(binToHex(root)).toBe(
    'ed692f01f7f6c46930d7ad8f9adad3f9f38b7379cf6a8d2f399a0ba1e914fe25',
  )
})

it('proof for a leaf', async () => {
  const entries = [entry1]
  const proof = inclusionProof(entry1, entries)
  if (proof) {
    expect(proof.inclusion_path).toEqual([])
  }
})

it('proof for smallest entries list', async () => {
  const entries = [entry1, entry2]
  const proof = inclusionProof(entry1, entries)
  if (proof) {
    expect(proof.inclusion_path.map(binToHex)).toEqual([
      '87afe6086fe4571e37657e76281301f189c75ebae1d2eaafb56d578067a1d95e',
    ])
  }
})

it('verify proof for smallest entries list', async () => {
  const entries = [entry1, entry2]
  const root = treeHead(entries)
  const proof = inclusionProof(entry1, entries)

  const verified = verifyInclusionProof(root, leaf(entry1), proof)
  expect(verified).toBe(true)
})

it('verify proof for larger entries list', async () => {
  expect.assertions(1)
  const proof = inclusionProof(entries[1], entries)
  const root = treeHead(entries)
  const verified = verifyInclusionProof(root, leaf(entry2), proof)
  expect(verified).toBe(true)
})
