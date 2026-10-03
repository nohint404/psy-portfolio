import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { records, nextRecord } from "../lib/jukebox.ts";

test("jukebox alternates the two user-selected C418 records with local, attributed audio", () => {
  assert.equal(nextRecord(0), 1); assert.equal(nextRecord(1), 0);
  assert.deepEqual(records.map(record => record.title), ["Sweden", "Moog City"]);
  for (const record of records) {
    const file = `public${record.src}`;
    const manifest = JSON.parse(readFileSync(`${file}.provenance.json`, "utf8"));
    assert.equal(manifest.source, record.source);
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), manifest.sha256);
    assert.ok(manifest.rights.includes("Not covered by the project AGPL"));
  }
});
