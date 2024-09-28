


// not efficient
const count_trailing_0 = (n: number) => {
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

export function trailing_zeros_64(n: number) {
  return count_trailing_0(n)
}

export function length_64(num: number) {
  return num.toString(2).length;
}

export function ones_count_64(x: number) {
  return (x.toString(2).match(/1/g) || []).length
}

export function Decompose(begin: number, end: number) {
  if (begin === 0) {
    return [0, end]
  }
  const xbegin = (begin >>> 0) - 1
  const d = length_64(xbegin ^ end) - 1
  const mask = (1 << d) - 1
  return [(-1 ^ xbegin) & mask, end & mask]
}

export function range_size(begin: number, end: number) {
  const [left, right] = Decompose(begin, end)
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
  let [left, right] = Decompose(begin, end)
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