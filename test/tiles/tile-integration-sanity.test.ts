

import crypto from 'crypto'
import { Hash, Tree, } from "../../src";
import { treeHead } from '../../src/RFC9162';

const th = new Hash((data: Uint8Array) => {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest());
}, 32)

it('generate log entries', async () => {
  const tree = new Tree(th)
  const entries: Uint8Array[] = []
  for (let i = 0; i < 26; i++) {
    const message = `entry-${i}`
    const data = new TextEncoder().encode(message)
    entries.push(data)
    tree.appendData(tree.encodeData(message))
  }
  const tileTreeEncoded = tree.hashes[0].map((h) => Buffer.from(h).toString('base64'))
  const oldTreeEncoded = entries.map((h) => Buffer.from(tree.th.hash_leaf(h)).toString('base64'))
  // tree equality from leaf equality
  expect(tileTreeEncoded)
    .toEqual(oldTreeEncoded)
  // tree equality by root comparison
  expect(Buffer.from(await treeHead(entries)).toString('hex'))
    .toEqual(Buffer.from(tree.hash()).toString('hex'))

  expect(Buffer.from(await treeHead(entries)).toString('base64'))
    .toBe('eMR1/fvh2IykZmA/Q7o3SypidfJRgnhWN5SPTPSeNeE=')

  // tree equality from hash at size
  expect(Buffer.from(await treeHead(entries.slice(0, 7))).toString('base64'))
    .toEqual(Buffer.from(tree.hashAt(7)).toString('base64'))
})
