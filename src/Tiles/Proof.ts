
import { TreeNode, length_64, node_coverage, range_size, node_sibling, node_parent, range_nodes, trailing_zeros_64, ones_count_64 } from "./Node"
import { TreeHash, to_hex } from "./Tile"

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
  if (leafHash.length != th.hashSizeBytes) {
    throw new Error(`leafHash has unexpected size ${leafHash.length}, want ${th.hashSizeBytes}`)
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
