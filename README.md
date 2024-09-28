# RFC9162

[![CI](https://github.com/transmute-industries/rfc9162/actions/workflows/ci.yml/badge.svg)](https://github.com/transmute-industries/rfc9162/actions/workflows/ci.yml)
![Branches](./badges/coverage-branches.svg)
![Functions](./badges/coverage-functions.svg)
![Lines](./badges/coverage-lines.svg)
![Statements](./badges/coverage-statements.svg)
![Jest coverage](./badges/coverage-jest%20coverage.svg)

<!-- [![NPM](https://nodei.co/npm/@transmute/rfc9162.png?mini=true)](https://npmjs.org/package/@transmute/rfc9162) -->

<img src="./transmute-banner.png" />

#### [Questions? Contact Transmute](https://transmute.typeform.com/to/RshfIw?typeform-source=rfc9162)

## Usage

```bash
npm install '@transmute/rfc9162'
```

```ts
import RFC9162 from "@transmute/rfc9162";
```

```js
const RFC9162 = require("@transmute/rfc9162");
```

### Usage

```ts
import crypto from "crypto";
import sqlite from "better-sqlite3";
import { TileLog, to_hex } from "@transmute/rfc9162";

const db = new sqlite("./test/transparency.db");
db.prepare(
  `CREATE TABLE IF NOT EXISTS tiles (id TEXT PRIMARY KEY, data BLOB);`
).run();
const hash_size = 32;
const tile_height = 2;
const log = new TileLog({
  tile_height,
  hash_size,
  hash_function: (data: Uint8Array) => {
    return new Uint8Array(crypto.createHash("sha256").update(data).digest());
  },
  read_tile: (tile: string): Uint8Array => {
    const [base_tile] = tile.split(".");
    // look for completed tiles first
    for (let i = 4; i > 0; i--) {
      const tile_path = base_tile + "." + i;
      const rows = db
        .prepare(
          `
          SELECT * FROM tiles
          WHERE id = '${tile_path}'
                  `
        )
        .all();
      if (rows.length) {
        const [row] = rows;
        return row.data;
      }
    }
    return new Uint8Array(32);
  },
  update_tiles: function (
    tile_path: string,
    start: number,
    end: number,
    stored_hash: Uint8Array
  ) {
    if (end - start !== 32) {
      // this hash is an intermediate of the tile
      // so it will never be persisted
      return null;
    }
    let tile_data = this.read_tile(tile_path);
    if (tile_data.length < end) {
      const expanded_tile_data = new Uint8Array(tile_data.length + 32);
      expanded_tile_data.set(tile_data);
      tile_data = expanded_tile_data;
    }
    tile_data.set(stored_hash, start);
    try {
      db.prepare(
        `
    INSERT INTO tiles (id, data)
    VALUES( '${tile_path}',	x'${Buffer.from(tile_data).toString("hex")}');
            `
      ).run();
    } catch (e) {
      // ignore errors
    }
    return tile_data;
  },
});
const encoder = new TextEncoder();

for (let i = 0; i < 26; i++) {
  const record = encoder.encode(`entry-${i}`);
  log.write_record(record);
}

// prove 17 was in log at tree size 20
const inclusion_proof = log.inclusion_proof(20, 17);
const root_from_inclusion_proof = log.root_from_inclusion_proof(
  inclusion_proof,
  log.record_hash(encoder.encode(`entry-${17}`))
);
// console.log(to_hex(root_from_inclusion_proof) === to_hex(log.root_at(20))) // true

// prove log is append only from root at 20 to current log size
const consistency_proof = log.consistency_proof(20, log.size());
const root_from_consistency_proof = log.root_from_consistency_proof(
  root_from_inclusion_proof,
  consistency_proof
);
// console.log(to_hex(root_from_consistency_proof) === to_hex(log.root())) // true
```

## Develop

```bash
npm i
npm t
npm run lint
npm run build
```
