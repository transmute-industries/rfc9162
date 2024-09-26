
import { TNode, Len64, Coverage, RangeSize, Sibling, Parent, RangeNodes, trailing_zeros_64, OnesCount64 } from "./Node"
import { Hash, to_hex } from "./Hash"

export type Nodes = {
  ids: TNode[],
  begin: number,
  end: number,
  ephem: TNode
}

export type HashChildren = (left: Uint8Array, right: Uint8Array) => Uint8Array

function SkipFirst(nodes: Nodes) {
  nodes.ids = nodes.ids.slice(1, nodes.ids.length)
  if (nodes.begin < nodes.end) {
    nodes.begin--
    nodes.end--
  }
  return nodes
}

export function Nodes(index: number, level: number, size: number): Nodes {
  const inner = Len64(index ^ (size >> level)) - 1
  const fork = TNode(level + inner, index >> inner)
  const [begin, end] = Coverage(fork)
  const left = RangeSize(0, begin)
  const right = RangeSize(end, size)
  let node = TNode(level, index)
  let nodes = [node]
  while (node[0] < fork[0]) {
    nodes.push(Sibling(node))
    node = Parent(node)
  }
  let len1 = nodes.length
  nodes = RangeNodes(end, size, nodes)
  nodes = [...nodes.slice(0, nodes.length - right), ...nodes.slice(nodes.length - right, nodes.length).reverse()]
  let len2 = nodes.length
  nodes = RangeNodes(0, begin, nodes)
  nodes = [...nodes.slice(0, nodes.length - left), ...nodes.slice(nodes.length - left, nodes.length).reverse()]
  if (len1 >= len2) {
    len1 = 0
    len2 = 0
  }
  return {
    ids: nodes,
    begin: len1,
    end: len2,
    ephem: Sibling(fork)
  }
}


function InnerProofSize(index: number, size: number) {
  return Len64(index ^ (size - 1))
}



function DecomposeInclusionProof(index: number, size: number) {
  const inner = InnerProofSize(index, size)
  const border = OnesCount64(index >> inner)
  return [inner, border]
}

function ChainInner(th: Hash, seed: Uint8Array, proof: Uint8Array[], index: number) {
  let i = 0;
  while (i < proof.length) {
    const h = proof[i]
    if ((index >> i) == 0) {
      seed = th.hashChildren(seed, h)
    } else {
      seed = th.hashChildren(h, seed)
    }
    i++;
  }
  return seed
}



export function ChainInnerRight(th: Hash, seed: Uint8Array, proof: Uint8Array[], index: number) {
  let i = 0;
  while (i < proof.length) {
    const h = proof[i]
    if (index >> i) {
      seed = th.hashChildren(h, seed)
    }
    i++
  }
  return seed
}

function ChainBorderRight(th: Hash, seed: Uint8Array, proof: Uint8Array[]) {
  const i = 0;
  while (i < proof.length) {
    const h = proof[i]
    seed = th.hashChildren(h, seed)
  }
  return seed
}

function RootFromInclusionProof(th: Hash, index: number, size: number, leafHash: Uint8Array, proof: Uint8Array[]) {
  if (index >= size) {
    throw new Error(`index is beyond size: ${index} >= ${size}`)
  }
  if (leafHash.length != th.hashSizeBytes) {
    throw new Error(`leafHash has unexpected size ${leafHash.length}, want ${th.hashSizeBytes}`)
  }
  const [inner, border] = DecomposeInclusionProof(index, size)

  if (proof.length != inner + border) {
    throw new Error(`wrong proof size ${proof.length}, want ${inner + border}`)
  }
  let res = ChainInner(th, leafHash, proof.slice(0, inner), index)
  res = ChainBorderRight(th, res, proof.slice(inner, proof.length))
  return res
}

function VerifyMatch(calculatedRoot: Uint8Array, expectedRoot: Uint8Array) {
  return to_hex(calculatedRoot) === to_hex(expectedRoot)
}

export function VerifyInclusion(th: Hash, index: number, size: number, leafHash: Uint8Array, proof: Uint8Array[], root: Uint8Array) {
  const calculatedRoot = RootFromInclusionProof(th, index, size, leafHash, proof)
  return VerifyMatch(calculatedRoot, root)
}


export function VerifyConsistency(th: Hash, size1: number, size2: number, proof: Uint8Array[], root1: Uint8Array, root2: Uint8Array) {
  if (size2 < size1) {
    throw new Error(`size2 (${size2}) < size1 (${size1})`)
  }
  if (size1 === size2) {
    if (proof.length > 0) {
      throw new Error(`size1=size2, but proof is not empty`)
    }
    return VerifyMatch(root1, root2)
  }
  if (size1 == 0) {
    if (proof.length > 0) {
      throw new Error(`expected empty proof, but got ${proof.length} components`)
    }
    return true // Proof OK.
  }
  if (proof.length === 0) {
    throw new Error(`empty proof`)
  }

  let [inner, border] = DecomposeInclusionProof(size1 - 1, size2)
  const shift = trailing_zeros_64(size1)
  inner -= shift

  let seed = proof[0]
  let start = 1
  if (size1 === (1 << shift)) {
    seed = root1
    start = 0
  }
  if (proof.length != start + inner + border) {
    throw new Error(`wrong proof size ${proof.length}, want ${start + inner + border}`)
  }
  proof = proof.slice(start, proof.length)
  const mask = (size1 - 1) >> shift
  let hash1 = ChainInnerRight(th, seed, proof.slice(0, inner), mask)
  hash1 = ChainBorderRight(th, hash1, proof.slice(inner, proof.length))
  if (!VerifyMatch(hash1, root1)) {
    console.log({ hash1, root1 })
    throw new Error('inconsistency with root 1')
  }
  let hash2 = ChainInner(th, seed, proof.slice(0, inner), mask)
  hash2 = ChainBorderRight(th, hash2, proof.slice(inner, proof.length))
  if (!VerifyMatch(hash2, root2)) {
    throw new Error('inconsistency with root 2')
  }
  return true
}


export function Inclusion(index: number, size: number): Nodes {
  if (index >= size) {
    throw new Error(`Index ${index} out of bounds for tree size ${size}`)
  }
  const nodes = Nodes(index, 0, size)
  return SkipFirst(nodes)
}

export function Consistency(size1: number, size2: number): Nodes {
  if (size1 > size2) {
    throw new Error(`tree size ${size1} > ${size2}`)
  }
  if (size1 === size2 && size1 === 0) {
    return { ids: [], begin: 0, end: 0, ephem: [0, 0] }
  }
  const level = trailing_zeros_64(size1)
  const index = (size1 - 1) >> level
  const p = Nodes(index, level, size2)
  if (index == 0) {
    return SkipFirst(p)
  }
  return p
}

export function Rehash(nodes: Nodes, hashes: Uint8Array[], hashChildren: HashChildren) {
  if (hashes.length != nodes.ids.length) {
    throw new Error(`got ${hashes.length} hashes but expected ${nodes.ids.length}`)
  }
  let cursor = 0;
  let i = 0
  const ln = hashes.length
  while (i < ln) {
    let hash = hashes[i]
    if (i >= nodes.begin && i < nodes.end) {
      while (++i < nodes.end) {
        const left = hashes[i]
        const right = hash
        hash = hashChildren(left, right)
        i++
      }
      i--
    }
    hashes[cursor] = hash
    i = i + 1
    cursor = cursor + 1
  }
  return hashes.slice(0, cursor)
}
