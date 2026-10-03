import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, setTile } from "../lib/ninja-game.ts";
import { drawWorld, drawMap } from "../lib/ninja-render.ts";
import { spriteMotion, type SpriteMotion } from "../lib/ninja-motion.ts";

function surface() {
  const labels: { value: string; x: number; y: number }[] = [], rectangles: number[][] = [], images: number[][] = [];
  const ctx = { fillStyle: "", strokeStyle: "", font: "", textAlign: "", imageSmoothingEnabled: false, globalAlpha: 1, lineWidth: 1,
    save() {}, restore() {}, translate() {}, scale() {}, clearRect() {}, drawImage(...args: unknown[]) { images.push(args.slice(1) as number[]); }, strokeRect() {},
    fillRect(...r: number[]) { rectangles.push(r); }, fillText(value: string, x: number, y: number) { labels.push({ value, x, y }); },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, labels, rectangles, images };
}
const skin = { complete: false } as HTMLImageElement;

test("game sprites preserve full skin proportions, outer layers and four directional atlas faces", () => {
  const loadedSkin = { complete: true, naturalWidth: 64 } as HTMLImageElement;
  for (const [dx, dy, headU] of [[0, 1, 8], [0, -1, 24], [1, 0, 0], [-1, 0, 16]]) {
    const s = createGame(); s.facing = [dx, dy]; const before = JSON.stringify(s), target = surface();
    drawWorld(target.ctx, s, loadedSkin, 1000, false, false);
    assert.ok(target.images.some(([u, v, w, h, x, y, dw, dh]) => u === headU && v === 8 && w === 8 && h === 8 && x === 164 && y === 95 && dw === 8 && dh === 8));
    assert.ok(target.images.some(([u, v, w, h]) => u === headU + 32 && v === 8 && w === 8 && h === 8), "hat layer follows the same direction");
    assert.ok(target.images.some(([u, v, w, h, , , dw, dh]) => u < 40 && v === 20 && h === 12 && dh === 12 && w === dw), "body/cuff pixels are not vertically stretched");
    assert.equal(JSON.stringify(s), before);
  }
});

test("frontier camera keeps the player centered, draws signed coordinates and never mutates saved terrain", () => {
  for (const [x, y] of [[-1234, 5678], [100_001, -100_005]]) {
    const s = createGame(); s.x = x; s.y = y; setTile(s, x, y, 0); const before = JSON.stringify(s), target = surface();
    drawWorld(target.ctx, s, skin, 1000, false, true);
    assert.ok(target.labels.some(label => label.value.endsWith(`${x},${y}`)));
    assert.ok(target.rectangles.some(([rx, ry, w, h]) => rx === 162 && ry === 124 && w === 12 && h === 3), "player shadow stays centered beyond legacy dimensions");
    assert.ok(target.rectangles.every(rect => rect.every(Number.isFinite))); assert.equal(JSON.stringify(s), before);
  }
});

test("fractional camera motion draws only finite coordinates and prunes retired sprite state", () => {
  const s = createGame(), motions = new Map<string, SpriteMotion>();
  for (let i = 0; i < 400; i++) spriteMotion(motions, `retired:${i}`, i, 0, 0, false);
  drawWorld(surface().ctx, s, skin, 0, false, false, 0, motions);
  s.x++; drawWorld(surface().ctx, s, skin, 115, true, false, 0, motions);
  const before = JSON.stringify(s), target = surface(); drawWorld(target.ctx, s, skin, 155, true, false, 0, motions);
  assert.ok(motions.get("player")!.x > s.x - 1 && motions.get("player")!.x < s.x);
  assert.ok(motions.size <= s.enemies.length + s.roamers.length + 1); assert.ok([...motions.keys()].every(id => !id.startsWith("retired:")));
  assert.ok(target.rectangles.every(rect => rect.every(Number.isFinite))); assert.equal(JSON.stringify(s), before);
});

test("jump render visibly lifts the real skin while reduced motion keeps a static state label", () => {
  const s = createGame(), loadedSkin = { complete: true, naturalWidth: 64 } as HTMLImageElement;
  const grounded = surface(), airborne = surface(), reduced = surface();
  drawWorld(grounded.ctx, s, loadedSkin, 180, false, false, 0, undefined, undefined, -Infinity);
  drawWorld(airborne.ctx, s, loadedSkin, 180, false, false, 0, undefined, { kind: "jump", started: 0 }, 0);
  const head = (target: ReturnType<typeof surface>) => target.images.find(([u, v, w, h]) => u === 8 && v === 8 && w === 8 && h === 8)!;
  assert.ok(head(airborne)[5] < head(grounded)[5], "airborne skin is lifted above its ground shadow");
  drawWorld(reduced.ctx, s, skin, 180, false, true, 0, undefined, { kind: "jump", started: 0 }, 0);
  assert.ok(reduced.labels.some(label => label.value === "JUMP"), "reduced motion preserves jump feedback without an arc");
});

test("new trail and brick materials have deterministic readable pixel surfaces", () => {
  const s = createGame(); setTile(s, s.x - 1, s.y, 23); setTile(s, s.x + 1, s.y, 24); const target = surface();
  drawWorld(target.ctx, s, skin, 1000, false, true);
  assert.ok(target.rectangles.some(([x, y, w, h]) => x === 146 && y === 115 && w === 5 && h === 2), "trail has pale inset pavers");
  assert.ok(target.rectangles.some(([x, y, w, h]) => x === 176 && y === 113 && w === 16 && h === 15), "brick has an outlined wall face");
});

test("nearby and atlas maps follow the player while the village map remains anchored", () => {
  const s = createGame(); s.x = -500; s.y = 700; setTile(s, s.x, s.y, 0);
  for (const mode of ["local", "atlas", "village"] as const) {
    const target = surface(), before = JSON.stringify(s); drawMap(target.ctx, s, mode);
    assert.ok(target.rectangles.length >= 1280); assert.ok(target.rectangles.every(rect => rect.every(Number.isFinite)));
    if (mode !== "village") assert.ok(target.rectangles.some(([x, y, w, h]) => x === 120 && y === 96 && w === 6 && h === 6));
    assert.equal(JSON.stringify(s), before);
  }
});
