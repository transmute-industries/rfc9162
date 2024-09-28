
import {
  Tree,
  TileLog
} from "../../../src";

import { encode, tile_params, tree_hasher } from '../test_utils'
import { read_tile, update_tiles, db, prepare, write_tile, read_tile_data } from "./test_utils";

it('basics', async () => {
  prepare(db)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.error = () => { }
  try {
    write_tile(db, 'foo', Buffer.from('bar'))
  } catch (e) {
    // ignore
  }
  const data2 = read_tile_data(db, 'foo')
  expect(data2?.toString()).toBe('bar')
})

it('synchronous apis', async () => {
  prepare(db)
  const tree = new Tree(tree_hasher)
  const log = new TileLog({
    ...tile_params,
    read_tile,
    update_tiles
  })
  for (let i = 0; i < 26; i++) {
    const data = encode(`entry-${i}`)
    tree.append_data(data)
    log.write_record(data)
  }
  const tree_root = tree.hash()
  const log_head = log.root()
  expect(tree_root).toEqual(log_head)
})
