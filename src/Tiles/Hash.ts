


export const HashSize = 32
export const EmptyBuffer = new Uint8Array()
export const LeafPrefix = new Uint8Array([0])
export const IntermediatePrefix = new Uint8Array([1])

export function Concat (a1: Uint8Array, a2: Uint8Array): Uint8Array {
  // sum of individual array lengths
  const mergedArray = new Uint8Array(a1.length + a2.length)
  mergedArray.set(a1)
  mergedArray.set(a2, a1.length)
  return mergedArray
}

export function toHex (bytes: Uint8Array){
  return bytes.reduce(
    (str: string, byte: number) => str + byte.toString(16).padStart(2, '0'),
    '',
  )
}
 
export class Hash {
  constructor(public hash: (data: Uint8Array) => Uint8Array, public hashSizeBytes: number){}
  emptyRoot(){
    return this.hash(EmptyBuffer) 
  }
  hashLeaf(leaf: Uint8Array){
    return this.hash(Concat(LeafPrefix, leaf))
  }
  hashChildren(left: Uint8Array, right: Uint8Array){
    return this.hash(Concat(IntermediatePrefix, Concat(left, right)))
  }
}