

import {
  leaf,
  treeHead,
  verifyTree,
  inclusionProof,
  verifyInclusionProof,
  binToHex,
  strToBin,
} from '../../src'


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

const entry1 = strToBin('A')
const entry2 = strToBin('B')

const entries: Uint8Array[] = []
for (let i = 0; i < 10; i++) {
  entries.push(strToBin(`${String.fromCharCode(65 + i)}`))
}

it('empty list', async () => {
  const root = binToHex(await treeHead([]))
  expect(root).toBe(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
})

it('leaf', async () => {
  const root = binToHex(await treeHead([entry1]))
  expect(root).toBe(
    'c00b4d3c929cb5cc316691ed4636f634576f2c9b2954767234c5274e9dde185d',
  )
})

it('verify leaf', async () => {
  const entries = [entry1]
  const root = await treeHead(entries)
  const verified = await verifyTree(root, entries)
  expect(verified).toBe(true)
})

it('smallest entries list', async () => {
  const entries = [entry1, entry2]
  const root = binToHex(await treeHead(entries))
  expect(root).toBe(
    'ed692f01f7f6c46930d7ad8f9adad3f9f38b7379cf6a8d2f399a0ba1e914fe25',
  )
})

it('verify entries list', async () => {
  const entries = [entry1, entry2]
  const root = await treeHead(entries)
  const verified = await verifyTree(root, entries)
  expect(verified).toBe(true)
  expect(binToHex(root)).toBe(
    'ed692f01f7f6c46930d7ad8f9adad3f9f38b7379cf6a8d2f399a0ba1e914fe25',
  )
})

it('proof for a leaf', async () => {
  const entries = [entry1]
  const proof = await inclusionProof(entry1, entries)
  if (proof) {
    expect(proof.inclusion_path).toEqual([])
  }
})

it('proof for smallest entries list', async () => {
  const entries = [entry1, entry2]
  const proof = await inclusionProof(entry1, entries)
  if (proof) {
    expect(proof.inclusion_path.map(binToHex)).toEqual([
      '87afe6086fe4571e37657e76281301f189c75ebae1d2eaafb56d578067a1d95e',
    ])
  }
})

it('verify proof for smallest entries list', async () => {
  const entries = [entry1, entry2]
  const root = await treeHead(entries)
  const proof = await inclusionProof(entry1, entries)

  const verified = await verifyInclusionProof(root, await leaf(entry1), proof)
  expect(verified).toBe(true)
})

it('verify proof for larger entries list', async () => {
  expect.assertions(1)
  const proof = await inclusionProof(entries[1], entries)
  const root = await treeHead(entries)
  const verified = await verifyInclusionProof(root, await leaf(entry2), proof)
  expect(verified).toBe(true)
})



describe('verifyTree', () => {
  it('1', async () => {
    const entries = [strToBin('A')]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })

  it('2', async () => {
    const entries = [strToBin('A'), strToBin('B')]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })

  it('3', async () => {
    const entries = [strToBin('A'), strToBin('B'), strToBin('C')]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })

  it('4', async () => {
    const entries = [strToBin('A'), strToBin('B'), strToBin('C'), strToBin('D')]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })

  it('5', async () => {
    const entries = [
      strToBin('A'),
      strToBin('B'),
      strToBin('C'),
      strToBin('D'),
      strToBin('E'),
    ]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })

  it('6', async () => {
    const entries = [
      strToBin('A'),
      strToBin('B'),
      strToBin('C'),
      strToBin('D'),
      strToBin('E'),
      strToBin('F'),
    ]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })

  it('7', async () => {
    const entries = [
      strToBin('A'),
      strToBin('B'),
      strToBin('C'),
      strToBin('D'),
      strToBin('E'),
      strToBin('F'),
      strToBin('G'),
    ]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })

  it('8', async () => {
    const entries = [
      strToBin('A'),
      strToBin('B'),
      strToBin('C'),
      strToBin('D'),
      strToBin('E'),
      strToBin('F'),
      strToBin('G'),
      strToBin('H'),
    ]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })

  it('9', async () => {
    expect.assertions(1)
    const entries = [
      strToBin('A'),
      strToBin('B'),
      strToBin('C'),
      strToBin('D'),
      strToBin('E'),
      strToBin('F'),
      strToBin('G'),
      strToBin('H'),
      strToBin('I'),
    ]
    const root = await treeHead(entries)
    const verified = await verifyTree(root, entries)
    expect(verified).toBe(true)
  })
})
