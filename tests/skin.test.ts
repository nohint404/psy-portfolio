import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { skinFaces, skinSliceFaces } from "../lib/skin-uv.ts";
import * as THREE from "three";

test("skin atlas maps head and classic limbs to Minecraft's 64x64 layout", () => {
  assert.deepEqual(skinFaces(0, 0, 8, 8, 8)[4], [8, 8, 8, 8]);
  assert.deepEqual(skinFaces(32, 0, 8, 8, 8)[4], [40, 8, 8, 8]);
  for (const [x, y, w, h, d] of [[0, 0, 8, 8, 8], [32, 0, 8, 8, 8], [16, 16, 8, 12, 4], [16, 32, 8, 12, 4], [40, 16, 4, 12, 4], [40, 32, 4, 12, 4], [32, 48, 4, 12, 4], [48, 48, 4, 12, 4], [0, 16, 4, 12, 4], [0, 32, 4, 12, 4], [16, 48, 4, 12, 4], [0, 48, 4, 12, 4]]) {
    const faces = skinFaces(x, y, w, h, d);
    assert.equal(faces.length, 6);
    for (const [u, v, width, height] of faces) assert.ok(u >= 0 && v >= 0 && u + width <= 64 && v + height <= 64);
  }
});

test("articulated sleeves, palms and fingers preserve the original cuff pixels", () => {
  for (const [u, v] of [[40, 16], [32, 48]]) {
    assert.deepEqual(skinSliceFaces(u, v, 4, 12, 4, [0, 0, 0], [4, 12, 4]), skinFaces(u, v, 4, 12, 4));
    const pieces = [[[0, 0, 0], [4, 8, 4]], [[0, 8, 0], [4, 9, 4]], ...Array.from({ length: 4 }, (_, i) => [[i, 9, 1], [i + 1, 12, 3]])];
    const pixels = new Set<string>();
    for (const [from, to] of pieces) {
      const [x, y, width, height] = skinSliceFaces(u, v, 4, 12, 4, from, to)[4];
      for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) {
        const key = `${col},${row}`; assert.ok(!pixels.has(key), "no duplicated or stretched cuff rows"); pixels.add(key);
      }
    }
    assert.equal(pixels.size, 4 * 12);
    for (let row = v + 4; row < v + 16; row++) for (let col = u + 4; col < u + 8; col++) assert.ok(pixels.has(`${col},${row}`));
    assert.deepEqual(skinSliceFaces(u, v, 4, 12, 4, [1, 9, 1], [2, 12, 3])[5], [u + 14, v + 13, 1, 3], "back-facing strips mirror x without mirroring the whole hand");
  }
});

test("developer close-up contains the whole skin and hand burst on desktop and mobile", () => {
  for (const aspect of [1.67, 1.1, .84, .65]) {
    const camera = new THREE.OrthographicCamera(-5.4 * aspect, 5.4 * aspect, 5.4, -5.4, .1, 50);
    camera.position.set(.1, 1.35, 8.2); camera.lookAt(.1, 1.05, .2);
    camera.zoom = Math.min(3.6, 5.4 * aspect / 1.35); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    for (const x of [-1, 1]) for (const y of [0, 2]) for (const z of [-.3, 1.4]) {
      const point = new THREE.Vector3(.1 + x, y, .2 + z).project(camera);
      assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .9 && Math.abs(point.z) < 1, `clipped at aspect ${aspect}`);
    }
  }
});

test("skin and all workstation artwork ship locally as valid PNGs", () => {
  for (const name of ["psymariux-skin", "psymariux-head", "chest", "craft", "furnace", "terminal", "book", "campfire", "cursor", "bed"]) {
    const file = `public/art/${name}.png`;
    assert.ok(existsSync(file));
    assert.equal(readFileSync(file).subarray(1, 4).toString(), "PNG");
  }
  const skin = readFileSync("public/art/psymariux-skin.png");
  assert.equal(skin.readUInt32BE(16), 64);
  assert.equal(skin.readUInt32BE(20), 64);
});
