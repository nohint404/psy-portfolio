import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { records, nextRecord, adjustVolume } from "../lib/jukebox.ts";

test("jukebox volume values step by five and stay within the media volume range", () => {
  assert.equal(adjustVolume(20, -5), 15); assert.equal(adjustVolume(20, 5), 25);
  assert.equal(adjustVolume(0, -5), 0); assert.equal(adjustVolume(100, 5), 100);
});

test("jukebox keeps media lazy and exposes native volume and eject controls", () => {
  const source = readFileSync("components/Jukebox.tsx", "utf8");
  assert.match(source, /<audio ref=\{audio\} preload="none"/);
  assert.match(source, /type="range" min="0" max="100" step="5"/);
  assert.match(source, />Eject disc</);
  assert.doesNotMatch(source, /Two records\. A quiet corner\./);
});

test("interactive disc buttons use unchanged vanilla sprites with provenance", () => {
  for (const name of ["disc-sweden", "disc-moog-city"]) {
    const image = readFileSync(`public/art/${name}.png`);
    const manifest = JSON.parse(readFileSync(`public/art/${name}.png.provenance.json`, "utf8"));
    assert.equal(createHash("sha256").update(image).digest("hex"), manifest.sha256);
    assert.equal(image.readUInt32BE(16), 16); assert.equal(image.readUInt32BE(20), 16);
    assert.ok(manifest.source.includes("/1.21.4/items/music_disc_"));
  }
});

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
