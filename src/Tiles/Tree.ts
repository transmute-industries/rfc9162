import { Hash, toHex } from "./Hash";
import { TNode, RangeNodes } from "./Node";
import { Inclusion, Consistency, Rehash } from "./Proof";

export const encoder = new TextEncoder()



export function prettyProof(hashes: Uint8Array[]) {
  return hashes.map((h) => {
    return toHex(h)
  })
}


export function prettyTile(hashes: Uint8Array[]) {
  return hashes.map((h) => {
    return Buffer.from(h).toString('base64')
  })
}

export function prettyLevel(level: number, hashes: Uint8Array[][]) {
  return JSON.stringify({
    level,
    hashes: hashes[level].map((p) => {
      return Buffer.from(p).toString('base64')
    })
  }, null, 2)
}

export function prettyInclusionProof(leaf: number, proof: Uint8Array[], root: Uint8Array, size: number) {
  return {
    leaf,
    proof: proof.map((p) => {
      return Buffer.from(p).toString('base64')
    }),
    root: Buffer.from(root).toString('base64'),
    size
  }
}

export function prettyConsistencyProof(root1: Uint8Array, size1: number, proof: Uint8Array[], root2: Uint8Array, size2: number,) {
  return {
    root1: Buffer.from(root1).toString('base64'),
    size1,
    proof: proof.map((p) => {
      return Buffer.from(p).toString('base64')
    }),
    root2: Buffer.from(root2).toString('base64'),
    size2,
  }
}

export class Tree {
  public size: number

  constructor(public th: Hash, public hashes: Uint8Array[][] = []) {
    this.size = this.hashes.length
  }

  encodeData(data: string) {
    return encoder.encode(data)
  }

  appendData(data: Uint8Array) {
    const hash = this.th.hashLeaf(data)
    this.appendHash(hash)
  }

  appendHash(hash: Uint8Array) {
    let level = 0
    while (((this.size >> level) & 1) == 1) {
      this.hashes[level].push(hash)
      const row = this.hashes[level]
      hash = this.th.hashChildren(row[row.length - 2], hash)
      level++
    }
    if (level > this.hashes.length) {
      throw new Error('Gap in tree appends')
    } else if (level === this.hashes.length) {
      this.hashes.push([])
    }
    this.hashes[level].push(hash)
    this.size++
  }

  hash() {
    return this.hashAt(this.size)
  }

  getNodes(ids: TNode[]) {
    const hashes = new Array(ids.length)
    for (const i in ids) {
      const id = ids[i]
      const [level, index] = id
      hashes[i] = this.hashes[level][index]
    }
    return hashes
  }

  hashAt(size: number) {
    if (size === 0) {
      return this.th.emptyRoot()
    }
    const hashes = this.getNodes(RangeNodes(0, size, []))
    let hash = hashes[hashes.length - 1]
    let i = hashes.length - 2;
    while (i >= 0) {
      hash = this.th.hashChildren(hashes[i], hash)
      i--
    }
    return hash
  }

  inclusionProof(index: number, size: number) {
    const nodes = Inclusion(index, size)
    const hashes = this.getNodes(nodes.ids)
    return Rehash(nodes, hashes, this.th.hashChildren)
  }

  consistencyProof(size1: number, size2: number) {
    const nodes = Consistency(size1, size2)
    const hashes = this.getNodes(nodes.ids)
    return Rehash(nodes, hashes, this.th.hashChildren)
  }

  getTile(height: number, level: number, index: number, width?: number) {
    if (!width) {
      width = 2 ** height
    }
    const start = index * (2 ** height)
    const end = start + width
    return this.hashes[level].slice(start, end)
  }


}