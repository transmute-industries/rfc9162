
import { strToBin, binToHex, inclusionProof, treeHead, verifyInclusionProof, leaf } from '../../src'

describe('inclusionProof', () => {
  it('1', async () => {
    const entries = [strToBin('A')]
    const proof = await inclusionProof(entries[0], entries)
    expect(proof?.leaf_index).toBe(0)
    expect(proof?.tree_size).toBe(1)
    expect(proof?.inclusion_path).toEqual([])
  })

  it('2', async () => {
    const entries = [strToBin('A'), strToBin('B')]
    const proof = await inclusionProof(entries[0], entries)
    expect(proof?.leaf_index).toBe(0)
    expect(proof?.tree_size).toBe(2)
    expect(proof?.inclusion_path.map(binToHex)).toEqual([
      '87afe6086fe4571e37657e76281301f189c75ebae1d2eaafb56d578067a1d95e',
    ])
  })

  it('3', async () => {
    const entries = [strToBin('A'), strToBin('B'), strToBin('C')]
    const proof = await inclusionProof(entries[0], entries)
    expect(proof?.leaf_index).toBe(0)
    expect(proof?.tree_size).toBe(3)
    expect(proof?.inclusion_path.map(binToHex)).toEqual([
      '87afe6086fe4571e37657e76281301f189c75ebae1d2eaafb56d578067a1d95e',
      'b563a5e69628743929eddec0ccfeb0745c39577e12a72e84915edd6633cb97f2',
    ])
  })
})



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
