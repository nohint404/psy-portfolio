import { test } from "node:test";
import assert from "node:assert/strict";
import { WORLD_W, WORLD_H, createGame, readSave, movePlayer, mine, build, cast, collectScroll, stepEnemies, stepProjectiles, shrines, npcs, tileAt, solid, craft, talk, heal, dash, maxHp, interact, objectives, type GameState } from "../lib/ninja-game.ts";
import { resumeAudio } from "../lib/workshop-audio.ts";

function arena(): GameState {
  const s = createGame();
  for (let y = 4; y < 14; y++) for (let x = 22; x < 37; x++) s.tiles[y * WORLD_W + x] = 0;
  s.x = 25; s.y = 10; s.facing = [1, 0]; s.enemies.forEach(e => { e.hp = 0; });
  return s;
}
function oldSave() {
  const tiles: number[] = Array.from({ length: WORLD_W * WORLD_H }, (_, i) => {
    const x = i % WORLD_W, y = Math.floor(i / WORLD_W);
    if (x < 1 || x >= WORLD_W - 1 || y < 1 || y >= WORLD_H - 1) return 4;
    if (x >= 17 && x <= 20 && y > 3 && y < 28 && y !== 15 && y !== 16) return 2;
    if (y === 15 || y === 16 || x === 10 || x === 29) return 1;
    if ((x * 17 + y * 31) % 29 === 0) return 3;
    if ((x * 13 + y * 7) % 41 === 0) return 4;
    return 0;
  });
  const enemies = [{ x: 13, y: 8, hp: 0 }, { x: 25, y: 12, hp: 2 }, { x: 33, y: 21, hp: 3 }, { x: 7, y: 25, hp: 1 }];
  for (const p of [{ x: 10, y: 16 }, ...shrines]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles[(p.y + dy) * WORLD_W + p.x + dx] = 1;
  enemies.forEach(e => { tiles[e.y * WORLD_W + e.x] = 0; });
  tiles[16 * WORLD_W + 11] = 5; tiles[16 * WORLD_W + 12] = 6;
  return { version: 1, tiles, x: 10, y: 16, facing: [1, 0], hp: 4, chakra: 72, wood: 18, stone: 9, scrolls: [0, 2], enemies };
}

test("deterministic colorful world, v3 round-trip and hostile save validation", () => {
  const s = createGame(); assert.deepEqual(createGame(), s); assert.equal(s.tiles.length, WORLD_W * WORLD_H);
  assert.ok(s.tiles.includes(7) && s.tiles.includes(8) && s.tiles.includes(10) && s.tiles.includes(11) && s.tiles.includes(12));
  assert.deepEqual(readSave(JSON.stringify(s)), s);
  for (const input of [null, "bad", "{}", JSON.stringify({ ...s, hp: -1 }), JSON.stringify({ ...s, x: Number.MAX_SAFE_INTEGER }), JSON.stringify({ ...s, tiles: [0] }), JSON.stringify({ ...s, facing: [1, 1] }), JSON.stringify({ ...s, scrolls: [0, 0] }), JSON.stringify({ ...s, enemies: [] }), JSON.stringify({ ...s, inventory: { ...s.inventory, herb: -1 } }), JSON.stringify({ ...s, quests: ["invented"] }), JSON.stringify({ ...s, upgrades: ["armor", "armor"] }), JSON.stringify({ ...s, projectiles: [{ x: 4, y: 4, dx: 0, dy: 0, left: 4, damage: 2, hostile: true, kind: "fire" }] })]) assert.deepEqual(readSave(input), createGame());
});

test("v1 migration keeps every placed block, actor stat, collected scroll and old enemy", () => {
  const old = oldSave(), s = readSave(JSON.stringify(old));
  assert.equal(s.version, 3);
  for (const key of ["x", "y", "hp", "chakra", "wood", "stone"] as const) assert.equal(s[key], old[key]);
  assert.deepEqual(s.scrolls, old.scrolls); assert.deepEqual(s.facing, old.facing);
  old.tiles.forEach((tile, i) => { if (tile !== 0) assert.equal(s.tiles[i], tile); });
  assert.deepEqual(s.enemies.slice(0, 4).map(({ x, y, hp }) => ({ x, y, hp })), old.enemies);
  assert.ok(s.enemies.some(e => e.kind === "warden")); assert.deepEqual(readSave(JSON.stringify(s)), s);
  assert.deepEqual(readSave(JSON.stringify({ ...old, enemies: [null, ...old.enemies.slice(1)] })), createGame());
});

test("all shrines, quest NPC approaches, gardens and boss are reachable from camp", () => {
  const s = createGame(), seen = new Set<string>([`${s.x},${s.y}`]), queue = [{ x: s.x, y: s.y }];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
      if (x < 1 || y < 1 || x >= WORLD_W - 1 || y >= WORLD_H - 1 || solid(tileAt(s, x, y)) || seen.has(key)) continue;
      seen.add(key); queue.push({ x, y });
    }
  }
  for (const p of [...shrines, ...npcs, { x: 34, y: 26 }, { x: 4, y: 24 }]) assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${p.x + dx},${p.y + dy}`)), `unreachable objective ${p.x},${p.y}`);
});

test("harvesting, ore, crafting, healing and permanent upgrades spend exact resources", () => {
  const s = arena(); s.tiles[10 * WORLD_W + 26] = 3;
  assert.equal(mine(s), "+1 wood"); assert.equal(s.wood, 9);
  s.tiles[10 * WORLD_W + 26] = 4; assert.match(mine(s), /ore/); assert.equal(s.inventory.ore, 1);
  s.tiles[10 * WORLD_W + 26] = 12; assert.equal(mine(s), "+2 herbs");
  assert.match(craft(s, "medicine"), /crafted/); assert.equal(s.inventory.herb, 0); assert.equal(s.wood, 8); assert.equal(s.inventory.medicine, 2);
  s.hp = 2; assert.equal(heal(s), "Field medicine: +3 life."); assert.equal(s.hp, 5);
  assert.match(craft(s, "armor"), /crafted/); assert.equal(maxHp(s), 8); assert.equal(s.hp, 8); assert.equal(s.wood, 4); assert.equal(s.stone, 1);
  const before = JSON.stringify(s); assert.equal(craft(s, "armor"), "You already have this upgrade."); assert.equal(JSON.stringify(s), before);
  assert.match(craft(s, "kunai"), /ingredients/); assert.equal(JSON.stringify(s), before);
  assert.deepEqual(readSave(JSON.stringify(s)), s);
});

test("walkable flowers and gardens harvest underfoot; legacy blocks near camp remain recoverable", () => {
  const s = arena(); s.tiles[s.y * WORLD_W + s.x] = 8; assert.equal(interact(s), "+1 herb"); assert.equal(tileAt(s, s.x, s.y), 0);
  s.tiles[s.y * WORLD_W + s.x] = 12; assert.equal(interact(s), "+2 herbs"); assert.equal(s.inventory.herb, 3);
  s.x = 11; s.y = 17; s.facing = [0, -1]; s.tiles[16 * WORLD_W + 11] = 5; assert.equal(mine(s), "+1 wood"); assert.equal(tileAt(s, 11, 16), 0);
});

test("bridges cross water; five building materials are reversible; protected tiles stay intact", () => {
  const s = arena(); craft(s, "bridge"); s.tiles[10 * WORLD_W + 26] = 2;
  assert.equal(build(s, "wood"), "That tile is occupied."); assert.equal(build(s, "bridge"), "Bridge block placed.");
  assert.equal(movePlayer(s, 1, 0), true);
  s.facing = [-1, 0]; s.tiles[10 * WORLD_W + 25] = 0; assert.match(build(s, "wood"), /placed/); assert.equal(mine(s), "+1 wood");
  s.x = 25; s.facing = [1, 0]; mine(s);
  s.tiles[10 * WORLD_W + 26] = 0;
  for (const [material, tile] of [["stone", 6], ["fence", 13], ["lantern", 14]] as const) {
    if (material !== "stone") s.inventory[material] = 1; else s.stone = 1;
    assert.match(build(s, material), /placed/); assert.equal(tileAt(s, 26, 10), tile); mine(s); assert.equal(tileAt(s, 26, 10), 0);
  }
  s.wood = 0; assert.equal(build(s, "wood"), "Mine more wood first."); assert.equal(s.wood, 0);
  s.x = 7; s.y = 8; s.facing = [0, -1]; assert.equal(build(s, "wood"), "That tile is occupied.");
  s.x = 10; s.y = 15; s.facing = [0, 1]; assert.equal(build(s, "wood"), "That tile is occupied.");
  s.x = 1; s.y = 1; s.facing = [-1, 0]; const edge = tileAt(s, 0, 1); mine(s); assert.equal(tileAt(s, 0, 1), edge);
});

test("projectiles travel, stop at walls, consume chakra, hit enemies and persist", () => {
  const s = arena(); s.enemies[0] = { x: 28, y: 10, hp: 3, kind: "rogue" };
  assert.equal(cast(s, "fire"), "Fire style!"); assert.equal(s.chakra, 80); assert.equal(s.enemies[0].hp, 3);
  assert.deepEqual(readSave(JSON.stringify(s)), s);
  stepProjectiles(s); stepProjectiles(s); assert.equal(s.enemies[0].hp, 3); stepProjectiles(s); assert.equal(s.enemies[0].hp, 0); assert.equal(s.inventory.herb, 1);
  s.enemies[1] = { x: 28, y: 10, hp: 3, kind: "rogue" }; s.tiles[10 * WORLD_W + 26] = 5;
  cast(s, "fire"); stepProjectiles(s); assert.equal(s.enemies[1].hp, 3); assert.equal(s.projectiles.length, 0);
  s.chakra = 0; assert.match(cast(s, "fire"), /Not enough/); assert.equal(s.chakra, 0);
  assert.match(cast(s, "lightning"), /Recover 2/);
  s.tiles[10 * WORLD_W + 28] = 5; assert.deepEqual(readSave(JSON.stringify(s)), createGame(), "living enemies cannot occupy blocks");
  s.enemies[1].hp = 0; assert.deepEqual(readSave(JSON.stringify(s)), s, "dead enemies can be covered by builds");
});

test("wind pierces multiple targets, lightning unlocks at two seals, dash respects obstacles", () => {
  const s = arena(); s.scrolls = [0, 1]; s.enemies[0] = { x: 26, y: 10, hp: 3, kind: "rogue" }; s.enemies[1] = { x: 27, y: 10, hp: 3, kind: "rogue" };
  cast(s, "wind"); stepProjectiles(s); stepProjectiles(s); assert.equal(s.enemies[0].hp, 0); assert.equal(s.enemies[1].hp, 0);
  s.projectiles = []; cast(s, "lightning"); assert.equal(s.chakra, 40);
  s.tiles[10 * WORLD_W + 28] = 4; assert.equal(dash(s), "Body flicker!"); assert.equal(s.x, 27); assert.equal(s.chakra, 28);
  const chakra = s.chakra; assert.equal(dash(s), "The way is blocked."); assert.equal(s.chakra, chakra);
  assert.equal(movePlayer(s, 1, 1), false);
});

test("NPC dialogue and rewards are unique, journal tracks all five objectives", () => {
  const s = createGame(); s.x = 8; s.y = 16;
  assert.match(talk(s), /Village quest complete/); assert.equal(s.wood, 5); assert.equal(s.stone, 2); assert.equal(s.inventory.ore, 2);
  const inventory = JSON.stringify(s.inventory); talk(s); assert.equal(JSON.stringify(s.inventory), inventory);
  s.x = 7; s.y = 9; assert.match(talk(s), /Bring me 3 herbs/); s.inventory.herb = 3; assert.match(talk(s), /Ranger quest complete/); assert.equal(s.inventory.herb, 0);
  const medicine = s.inventory.medicine; talk(s); assert.equal(s.inventory.medicine, medicine);
  for (const p of shrines) { s.x = p.x; s.y = p.y; collectScroll(s); collectScroll(s); }
  assert.deepEqual(s.scrolls, [0, 1, 2]); assert.equal(objectives(s).filter(q => q.done).length, 3);
  s.enemies.find(e => e.kind === "warden")!.hp = 0; s.x = 8; s.y = 16;
  assert.match(talk(s), /lifted the seal/); assert.equal(s.inventory.lantern, 3); talk(s); assert.equal(s.inventory.lantern, 3);
  assert.ok(objectives(s).every(q => q.done)); s.x = 10; s.y = 16; s.hp = 1; assert.match(interact(s), /Rested/); assert.equal(s.hp, 6);
});

test("archers shoot, guards move slowly, Warden sleeps until three seals, freeze stops hostile shots", () => {
  const s = arena(); s.enemies[1] = { x: 30, y: 10, hp: 3, kind: "archer" };
  stepEnemies(s, 0); assert.equal(s.projectiles.length, 1); assert.equal(s.projectiles[0].hostile, true);
  const shot = { ...s.projectiles[0] }; stepProjectiles(s, true); assert.deepEqual(s.projectiles[0], shot);
  for (let i = 0; i < 5; i++) stepProjectiles(s); assert.equal(s.hp, 5);
  s.enemies.forEach(e => { e.hp = 0; }); s.enemies[2] = { x: 29, y: 10, hp: 6, kind: "guard" };
  stepEnemies(s, 1); assert.equal(s.enemies[2].x, 29); stepEnemies(s, 2); assert.equal(s.enemies[2].x, 28);
  s.enemies[7] = { x: 33, y: 10, hp: 18, kind: "warden" }; const warden = { ...s.enemies[7] };
  stepEnemies(s, 4); assert.deepEqual(s.enemies[7], warden);
  s.scrolls = [0, 1, 2]; stepEnemies(s, 6); assert.ok(s.projectiles.some(p => p.hostile && p.kind === "fire"));
});

test("death preserves progression and builds; camp is safe; opponents never step into solids", () => {
  const s = arena(); s.hp = 1; s.scrolls = [0, 1, 2]; s.inventory.herb = 5; s.tiles[8 * WORLD_W + 25] = 5;
  s.enemies[0] = { x: 26, y: 10, hp: 3, kind: "rogue" };
  assert.match(stepEnemies(s, 0), /Back at camp/); assert.equal(s.hp, 6); assert.equal(s.x, 10); assert.equal(s.y, 16); assert.equal(s.inventory.herb, 5); assert.equal(tileAt(s, 25, 8), 5);
  s.enemies[0].x = 11; s.enemies[0].y = 16; stepEnemies(s, 1); assert.equal(s.hp, 6);
  for (let i = 0; i < 300; i++) stepEnemies(s, i);
  assert.ok(s.enemies.filter(e => e.hp).every(e => !solid(tileAt(s, e.x, e.y))));
});

test("AudioContext is reused while live, recreated after close, and resume rejection is handled", async () => {
  const original = globalThis.AudioContext;
  let made = 0;
  class FakeContext {
    state = "suspended"; calls = 0;
    constructor() { made++; }
    resume() { this.calls++; return Promise.reject(new Error("Browser blocked audio")); }
  }
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext;
  try {
    const owner = { current: null as AudioContext | null };
    const first = resumeAudio(owner); assert.equal(resumeAudio(owner), first); assert.equal(made, 1);
    Object.assign(first, { state: "closed" }); assert.notEqual(resumeAudio(owner), first); assert.equal(made, 2);
    Object.assign(owner.current!, { state: "running" }); const calls = (owner.current as unknown as FakeContext).calls;
    resumeAudio(owner); assert.equal((owner.current as unknown as FakeContext).calls, calls);
    await new Promise(resolve => setImmediate(resolve));
  } finally { globalThis.AudioContext = original; }
});
