


import { TreeHash, to_hex } from "./TreeHash";



// not efficient
export function trailing_zeros_64(n: number) {
  const ns = n.toString(2)
  let count = 0;
  for (let i = 0; i < ns.length; i++) {
    if (ns[i] === '1') {
      count = 0
    } else {
      count++
    }
  }
  return count
}

export function length_64(num: number) {
  return num.toString(2).length;
}

export function ones_count_64(x: number) {
  return (x.toString(2).match(/1/g) || []).length
}

export function decompose(begin: number, end: number) {
  if (begin === 0) {
    return [0, end]
  }
  const xbegin = (begin >>> 0) - 1
  const d = length_64(xbegin ^ end) - 1
  const mask = (1 << d) - 1
  return [(-1 ^ xbegin) & mask, end & mask]
}

export function range_size(begin: number, end: number) {
  const [left, right] = decompose(begin, end)
  return ones_count_64(left) + ones_count_64(right)
}

export type TreeNode = [number, number]

export function TreeNode(level: number, index: number) {
  return [level, index] as TreeNode
}

export function node_parent([level, index]: TreeNode) {
  return TreeNode(level + 1, index >> 1)
}

export function node_sibling([level, index]: TreeNode) {
  return TreeNode(level, index ^ 1)
}

export function node_coverage([level, index]: TreeNode) {
  return TreeNode(index << level, (index + 1) << level)
}

export function range_nodes(begin: number, end: number, ids: TreeNode[]) {
  let [left, right] = decompose(begin, end)
  let pos = begin
  let bit = 0
  while (left !== 0) {
    const level = trailing_zeros_64(left)
    bit = 1 << level
    ids.push([level, pos >> level])
    pos = pos + bit
    left = left ^ bit
  }
  bit = 0
  while (right !== 0) {
    const level = length_64(right) - 1
    bit = 1 << level
    ids.push([level, pos >> level])
    pos = pos + bit
    right = right ^ bit
  }
  return ids
}


export type TreeNodes = {
  ids: TreeNode[],
  begin: number,
  end: number,
  ephem: TreeNode
}

export type HashChildren = (left: Uint8Array, right: Uint8Array) => Uint8Array

function skip_first(nodes: TreeNodes) {
  nodes.ids = nodes.ids.slice(1, nodes.ids.length)
  if (nodes.begin < nodes.end) {
    nodes.begin--
    nodes.end--
  }
  return nodes
}

export function create_nodes(index: number, level: number, size: number): TreeNodes {
  const inner = length_64(index ^ (size >> level)) - 1
  const fork = TreeNode(level + inner, index >> inner)
  const [begin, end] = node_coverage(fork)
  const left = range_size(0, begin)
  const right = range_size(end, size)
  let node = TreeNode(level, index)
  let nodes = [node]
  while (node[0] < fork[0]) {
    nodes.push(node_sibling(node))
    node = node_parent(node)
  }
  let len1 = nodes.length
  nodes = range_nodes(end, size, nodes)
  nodes = [...nodes.slice(0, nodes.length - right), ...nodes.slice(nodes.length - right, nodes.length).reverse()]
  let len2 = nodes.length
  nodes = range_nodes(0, begin, nodes)
  nodes = [...nodes.slice(0, nodes.length - left), ...nodes.slice(nodes.length - left, nodes.length).reverse()]
  if (len1 >= len2) {
    len1 = 0
    len2 = 0
  }
  return {
    ids: nodes,
    begin: len1,
    end: len2,
    ephem: node_sibling(fork)
  }
}


function inner_proof_size(index: number, size: number) {
  return length_64(index ^ (size - 1))
}



function decompose_inclusion_proof(index: number, size: number) {
  const inner = inner_proof_size(index, size)
  const border = ones_count_64(index >> inner)
  return [inner, border]
}

function chain_inner(th: TreeHash, seed: Uint8Array, proof: Uint8Array[], index: number) {
  let i = 0;
  while (i < proof.length) {
    const h = proof[i]
    if ((index >> i) == 0) {
      seed = th.hash_children(seed, h)
    } else {
      seed = th.hash_children(h, seed)
    }
    i++;
  }
  return seed
}



export function chain_inner_right(th: TreeHash, seed: Uint8Array, proof: Uint8Array[], index: number) {
  let i = 0;
  while (i < proof.length) {
    const h = proof[i]
    if (index >> i) {
      seed = th.hash_children(h, seed)
    }
    i++
  }
  return seed
}

function chain_border_right(th: TreeHash, seed: Uint8Array, proof: Uint8Array[]) {
  const i = 0;
  while (i < proof.length) {
    const h = proof[i]
    seed = th.hash_children(h, seed)
  }
  return seed
}

function root_from_inclusion_proof(th: TreeHash, index: number, size: number, leafHash: Uint8Array, proof: Uint8Array[]) {
  if (index >= size) {
    throw new Error(`index is beyond size: ${index} >= ${size}`)
  }
  if (leafHash.length != th.hash_size) {
    throw new Error(`leafHash has unexpected size ${leafHash.length}, want ${th.hash_size}`)
  }
  const [inner, border] = decompose_inclusion_proof(index, size)

  if (proof.length != inner + border) {
    throw new Error(`wrong proof size ${proof.length}, want ${inner + border}`)
  }
  let res = chain_inner(th, leafHash, proof.slice(0, inner), index)
  res = chain_border_right(th, res, proof.slice(inner, proof.length))
  return res
}

function verify_match(calculatedRoot: Uint8Array, expectedRoot: Uint8Array) {
  return to_hex(calculatedRoot) === to_hex(expectedRoot)
}

export function verify_inclusion(th: TreeHash, index: number, size: number, leafHash: Uint8Array, proof: Uint8Array[], root: Uint8Array) {
  const calculatedRoot = root_from_inclusion_proof(th, index, size, leafHash, proof)
  return verify_match(calculatedRoot, root)
}


export function verify_consistency(th: TreeHash, size1: number, size2: number, proof: Uint8Array[], root1: Uint8Array, root2: Uint8Array) {
  if (size2 < size1) {
    throw new Error(`size2 (${size2}) < size1 (${size1})`)
  }
  if (size1 === size2) {
    if (proof.length > 0) {
      throw new Error(`size1=size2, but proof is not empty`)
    }
    return verify_match(root1, root2)
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

  // eslint-disable-next-line prefer-const
  let [inner, border] = decompose_inclusion_proof(size1 - 1, size2)
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
  let hash1 = chain_inner_right(th, seed, proof.slice(0, inner), mask)
  hash1 = chain_border_right(th, hash1, proof.slice(inner, proof.length))
  if (!verify_match(hash1, root1)) {
    console.log({ hash1, root1 })
    throw new Error('inconsistency with root 1')
  }
  let hash2 = chain_inner(th, seed, proof.slice(0, inner), mask)
  hash2 = chain_border_right(th, hash2, proof.slice(inner, proof.length))
  if (!verify_match(hash2, root2)) {
    throw new Error('inconsistency with root 2')
  }
  return true
}


export function inclusion(index: number, size: number): TreeNodes {
  if (index >= size) {
    throw new Error(`Index ${index} out of bounds for tree size ${size}`)
  }
  const nodes = create_nodes(index, 0, size)
  return skip_first(nodes)
}

export function consistency(size1: number, size2: number): TreeNodes {
  if (size1 > size2) {
    throw new Error(`tree size ${size1} > ${size2}`)
  }
  if (size1 === size2 && size1 === 0) {
    return { ids: [], begin: 0, end: 0, ephem: [0, 0] }
  }
  const level = trailing_zeros_64(size1)
  const index = (size1 - 1) >> level
  const p = create_nodes(index, level, size2)
  if (index == 0) {
    return skip_first(p)
  }
  return p
}

export function rehash(nodes: TreeNodes, hashes: Uint8Array[], hash_children: HashChildren) {
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
        hash = hash_children(left, right)
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


export class Tree {
  public size: number
  public encoder: TextEncoder

  constructor(public th: TreeHash, public hashes: Uint8Array[][] = []) {
    this.size = this.hashes.length
    this.encoder = new TextEncoder()
  }

  encodeData(data: string) {
    return this.encoder.encode(data)
  }

  appendData(data: Uint8Array) {
    const hash = this.th.hash_leaf(data)
    this.appendHash(hash)
  }

  appendHash(hash: Uint8Array) {
    let level = 0
    while (((this.size >> level) & 1) == 1) {
      this.hashes[level].push(hash)
      const row = this.hashes[level]
      hash = this.th.hash_children(row[row.length - 2], hash)
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

  getNodes(ids: TreeNode[]) {
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
      return this.th.empty_root()
    }
    const hashes = this.getNodes(range_nodes(0, size, []))
    let hash = hashes[hashes.length - 1]
    let i = hashes.length - 2;
    while (i >= 0) {
      hash = this.th.hash_children(hashes[i], hash)
      i--
    }
    return hash
  }

  inclusionProof(index: number, size: number) {
    const nodes = inclusion(index, size)
    const hashes = this.getNodes(nodes.ids)
    return rehash(nodes, hashes, this.th.hash_children)
  }

  consistencyProof(size1: number, size2: number) {
    const nodes = consistency(size1, size2)
    const hashes = this.getNodes(nodes.ids)
    return rehash(nodes, hashes, this.th.hash_children)
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