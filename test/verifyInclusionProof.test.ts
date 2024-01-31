import api from '../src'

const { strToBin, leaf, treeHead, inclusionProof, verifyInclusionProof } = api

describe('inclusionProof', () => {
  it('1', async () => {
    expect.assertions(1)
    const entries = [strToBin('A')]
    const root = await treeHead(entries)
    const proof = await inclusionProof(entries[0], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[0]), proof)
    expect(verified).toBe(true)
  })

  it('2', async () => {
    expect.assertions(1)
    const entries = [strToBin('A'), strToBin('B')]
    const root = await treeHead(entries)
    const proof = await inclusionProof(entries[1], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[1]), proof)
    expect(verified).toBe(true)
  })

  it('3', async () => {
    expect.assertions(1)
    const entries = [strToBin('A'), strToBin('B'), strToBin('C')]
    const root = await treeHead(entries)
    const proof = await inclusionProof(entries[1], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[1]), proof)
    expect(verified).toBe(true)
  })

  it('4', async () => {
    expect.assertions(1)
    const entries = [strToBin('A'), strToBin('B'), strToBin('C'), strToBin('D')]
    const root = await treeHead(entries)
    const proof = await inclusionProof(entries[1], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[1]), proof)
    expect(verified).toBe(true)
  })

  it('5', async () => {
    expect.assertions(1)
    const entries = [
      strToBin('A'),
      strToBin('B'),
      strToBin('C'),
      strToBin('D'),
      strToBin('E'),
    ]
    const root = await treeHead(entries)
    const proof = await inclusionProof(entries[1], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[1]), proof)
    expect(verified).toBe(true)
  })

  it('6', async () => {
    expect.assertions(1)
    const entries = [
      strToBin('A'),
      strToBin('B'),
      strToBin('C'),
      strToBin('D'),
      strToBin('E'),
      strToBin('F'),
    ]
    const root = await treeHead(entries)
    const proof = await inclusionProof(entries[1], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[1]), proof)
    expect(verified).toBe(true)
  })

  it('7', async () => {
    expect.assertions(1)
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
    const proof = await inclusionProof(entries[1], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[1]), proof)
    expect(verified).toBe(true)
  })

  it('8', async () => {
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
    ]
    const root = await treeHead(entries)
    const proof = await inclusionProof(entries[1], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[1]), proof)
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
    const proof = await inclusionProof(entries[1], entries)
    const verified = await verifyInclusionProof(root, await leaf(entries[1]), proof)
    expect(verified).toBe(true)
  })
})
