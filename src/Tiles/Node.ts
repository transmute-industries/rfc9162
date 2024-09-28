


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

export function Len64(num: number) {
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
  const d = Len64(xbegin ^ end) - 1
  const mask = (1 << d) - 1
  return [(-1 ^ xbegin) & mask, end & mask]
}

export function RangeSize(begin: number, end: number) {
  const [left, right] = Decompose(begin, end)
  return ones_count_64(left) + ones_count_64(right)
}

export type TNode = [number, number]

export function TNode(level: number, index: number) {
  return [level, index] as TNode
}

export function Parent([level, index]: TNode) {
  return TNode(level + 1, index >> 1)
}

export function Sibling([level, index]: TNode) {
  return TNode(level, index ^ 1)
}

export function Coverage([level, index]: TNode) {
  return TNode(index << level, (index + 1) << level)
}

export function RangeNodes(begin: number, end: number, ids: TNode[]) {
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
    const level = Len64(right) - 1
    bit = 1 << level
    ids.push([level, pos >> level])
    pos = pos + bit
    right = right ^ bit
  }
  return ids
}