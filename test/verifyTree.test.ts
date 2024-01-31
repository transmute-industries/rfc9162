import api from '../src'

const { treeHead, strToBin, verifyTree } = api

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
