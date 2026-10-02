import { test } from "node:test";
import assert from "node:assert/strict";
import { CHUNK_SIZE, CHUNK_CACHE_LIMIT, DEFAULT_SEED, generatedTile, worldChunk, cachedChunks, biomeAt, pointKey } from "../lib/ninja-world.ts";
import { createGame, setTile, tileAt, solid, streamWorld, movePlayer, mine, interact, build, craft, advanceWorld, daylight, recall, cast, stepProjectiles, stepEnemies, allEnemies, readSave, type GameState } from "../lib/ninja-game.ts";

function frontier(x = -60, y = -60): GameState {
  const s = createGame(); s.x = x; s.y = y; s.facing = [1, 0]; s.enemies.forEach(e => { e.hp = 0; });
  setTile(s, x, y, 0); setTile(s, x + 1, y, 0); return s;
}
function findFeature(feature: "ruins" | "camp") {
  for (let cy = -10; cy <= 10; cy++) for (let cx = -10; cx <= 10; cx++) { const chunk = worldChunk(DEFAULT_SEED, cx, cy); if (chunk.feature === feature) return { chunk, cx, cy }; }
  throw new Error(`No ${feature} found`);
}

test("procedural terrain is seeded, repeatable after eviction, varied and connected across negative/positive seams", () => {
  const origin = worldChunk(DEFAULT_SEED, -7, -8).tiles.slice(), biomes = new Set<string>(), types = new Set<number>();
  for (let y = -16; y <= 16; y++) for (let x = -16; x <= 16; x++) {
    const chunk = worldChunk(DEFAULT_SEED, x, y); assert.equal(chunk.tiles.length, CHUNK_SIZE ** 2);
    biomes.add(biomeAt(DEFAULT_SEED, x * CHUNK_SIZE + 12, y * CHUNK_SIZE + 12)); chunk.tiles.forEach(t => { assert.ok(t >= 0 && t <= 22); types.add(t); });
    for (const offset of [0, 23]) { assert.ok(!solid(generatedTile(DEFAULT_SEED, x * CHUNK_SIZE + offset, y * CHUNK_SIZE + 12))); assert.ok(!solid(generatedTile(DEFAULT_SEED, x * CHUNK_SIZE + 12, y * CHUNK_SIZE + offset))); }
  }
  assert.equal(biomes.size, 5); for (const tile of [2, 3, 4, 7, 8, 16, 18, 19, 20]) assert.ok(types.has(tile), `missing terrain ${tile}`);
  assert.ok(cachedChunks() <= CHUNK_CACHE_LIMIT); assert.deepEqual(worldChunk(DEFAULT_SEED, -7, -8).tiles, origin);
  assert.notDeepEqual(worldChunk(42, -7, -8).tiles, origin);
  assert.equal(generatedTile(DEFAULT_SEED, -100_000_007, 100_000_009), generatedTile(DEFAULT_SEED, -100_000_007, 100_000_009));
});

test("real movement can cross dozens of streamed chunks without old map boundaries or accumulating tile arrays", () => {
  const s = createGame(); s.x = -500; s.y = -12; streamWorld(s);
  for (let i = 0; i < 1100; i++) { assert.equal(movePlayer(s, -1, 0), true, `blocked at ${s.x},${s.y}`); assert.ok(s.roamers.length <= 18); }
  assert.equal(s.x, -1600); assert.ok(Object.keys(s.world.explored).length > 40);
  assert.equal(s.tiles.length, 40 * 32); assert.deepEqual(s.world.changes, {}); assert.ok(cachedChunks() <= CHUNK_CACHE_LIMIT);
  const value = JSON.stringify(s); assert.ok(value.length < 15000); assert.deepEqual(readSave(value, true), s);
  s.x = 12; s.y = 32; assert.equal(movePlayer(s, 0, 1), true);
});

test("mining and every construction persist outside the starter map at signed, distant coordinates", () => {
  const s = frontier(-100_003, 100_008); const original = generatedTile(s.world.seed, s.x + 1, s.y);
  setTile(s, s.x + 1, s.y, 3); assert.equal(mine(s), "+1 wood"); assert.equal(s.wood, 9);
  setTile(s, s.x + 1, s.y, 20); assert.match(mine(s), /2 ore/); assert.equal(s.inventory.ore, 2);
  for (const material of ["wood", "stone", "fence", "lantern", "campfire"] as const) {
    setTile(s, s.x + 1, s.y, 0); if (material !== "wood" && material !== "stone") s.inventory[material] = 1;
    assert.match(build(s, material), /placed/); const tile = tileAt(s, s.x + 1, s.y);
    const restored = readSave(JSON.stringify(s), true); assert.equal(tileAt(restored, s.x + 1, s.y), tile);
    const before: number = material === "wood" ? s.wood : material === "stone" ? s.stone : s.inventory[material]; mine(s);
    assert.equal(material === "wood" ? s.wood : material === "stone" ? s.stone : s.inventory[material], before + 1);
  }
  s.inventory.bridge = 1; setTile(s, s.x + 1, s.y, 2); assert.match(build(s, "bridge"), /placed/); assert.equal(movePlayer(s, 1, 0), true); s.facing = [1, 0]; s.x--; mine(s); assert.equal(tileAt(s, s.x + 1, s.y), 2);
  assert.equal(generatedTile(s.world.seed, s.x + 1, s.y), original, "edits must never mutate cached base terrain");
});

test("herb farming grows only with active simulation, survives reload and recycles seeds", () => {
  const s = frontier(); assert.match(build(s, "garden"), /planted/); assert.equal(s.inventory.garden, 1); assert.equal(tileAt(s, -59, -60), 22);
  assert.match(mine(s), /45 active seconds/); for (let i = 0; i < 44; i++) advanceWorld(s, 1);
  assert.equal(tileAt(s, -59, -60), 22); const restored = readSave(JSON.stringify(s), true); advanceWorld(restored, 1);
  assert.equal(tileAt(restored, -59, -60), 17); assert.match(mine(restored), /2 herbs/); assert.equal(restored.inventory.herb, 2); assert.equal(restored.inventory.garden, 2); assert.equal(tileAt(restored, -59, -60), 21);
  assert.match(craft(restored, "garden"), /crafted/); assert.equal(restored.inventory.garden, 5); assert.equal(restored.inventory.herb, 1);
  assert.match(build(restored, "garden"), /planted/); assert.equal(restored.inventory.garden, 4); assert.deepEqual(readSave(JSON.stringify(restored), true), restored);
  const before = restored.elapsed; for (const dt of [-1, NaN, Infinity]) advanceWorld(restored, dt); assert.equal(restored.elapsed, before);
  restored.elapsed = 179.9; assert.equal(daylight(restored), true); advanceWorld(restored, .2); assert.equal(daylight(restored), false); restored.elapsed = 240; assert.equal(daylight(restored), true);
});

test("placed and generated camps restore health, persist respawn, allow recalls and can be dismantled", () => {
  const s = frontier(); assert.match(build(s, "campfire"), /placed/); s.hp = 1; s.chakra = 0; assert.match(interact(s), /respawn/); assert.deepEqual(s.spawn, { x: -59, y: -60 }); assert.equal(s.hp, 6); assert.equal(s.chakra, 100);
  s.x -= 10; s.roamers = []; s.chakra = 24; assert.match(recall(s), /25 chakra/); s.chakra = 25; assert.match(recall(s), /Recalled/); assert.equal(s.x, -59); assert.equal(s.chakra, 0);
  assert.deepEqual(readSave(JSON.stringify(s), true).spawn, s.spawn);
  s.x = -60; s.facing = [1, 0]; assert.match(mine(s), /campfire recovered/); assert.deepEqual(s.spawn, { x: 10, y: 16 }); assert.equal(s.inventory.campfire, 1);
  const { chunk } = findFeature("camp"); s.x = chunk.x - 1; s.y = chunk.y; assert.match(interact(s), /respawn/); assert.deepEqual(s.spawn, { x: chunk.x - 1, y: chunk.y - 1 });
  setTile(s, s.x + 1, s.y, 22); s.crops[pointKey(s.x + 1, s.y)] = s.elapsed; assert.match(interact(s), /herbs/, "harvesting near a camp must not get trapped behind rest");
});

test("procedural guards, traveling jutsu and ruin loot cannot respawn or duplicate on revisit", () => {
  const { chunk, cx, cy } = findFeature("ruins"), s = frontier(chunk.x, chunk.y); s.upgrades = ["kunai"]; streamWorld(s);
  const guards = s.roamers.filter(e => e.id.startsWith(`${cx},${cy}:`)); assert.equal(guards.length, 2);
  s.x = chunk.x + 1; s.y = chunk.y - 2; s.facing = [1, 0]; assert.match(interact(s), /guards/);
  for (const e of guards) {
    s.x = e.x + 1; s.y = e.y; s.facing = [-1, 0];
    while (e.hp) { assert.match(cast(s, "kunai"), /Kunai thrown/); stepProjectiles(s); }
    assert.equal(s.world.foes[e.id].hp, 0); assert.equal(readSave(JSON.stringify(s), true).world.foes[e.id].hp, 0);
  }
  s.x = chunk.x + 1; s.y = chunk.y - 2; s.facing = [1, 0]; const wood = s.wood; assert.match(interact(s), /Ruins explored/); assert.equal(s.wood, wood + 4);
  const restored = readSave(JSON.stringify(s), true); streamWorld(restored); assert.ok(!restored.roamers.some(e => guards.some(g => g.id === e.id)));
  assert.notEqual(tileAt(restored, chunk.x + 2, chunk.y - 2), 18); const after = restored.wood; interact(restored); assert.equal(restored.wood, after);
  assert.deepEqual(worldChunk(DEFAULT_SEED, cx, cy).enemies.map(e => e.hp), [6, 3], "combat must not mutate cached spawns");
});

test("streamed enemies respect walls and camp protection, persist damage, and do not burst-kill in one step", () => {
  const { chunk } = findFeature("ruins"), s = frontier(chunk.x, chunk.y); streamWorld(s); const e = s.roamers.find(e => e.kind === "guard")!;
  s.x = e.x + 1; s.y = e.y; setTile(s, s.x, s.y, 0); s.hp = 6;
  stepEnemies(s, 1); assert.ok(s.hp >= 4); const health = s.hp; stepEnemies(s, 2); assert.equal(s.hp, health, "damage grace lasts .65 active seconds");
  s.facing = [-1, 0]; cast(s, "kunai"); stepProjectiles(s); assert.ok(s.world.foes[e.id].hp < 6);
  const restored = readSave(JSON.stringify(s), true); streamWorld(restored); assert.equal(restored.roamers.find(n => n.id === e.id)?.hp, e.hp);
  s.x = -60; s.y = -60; s.facing = [1, 0]; setTile(s, -60, -60, 0); setTile(s, -59, -60, 0); build(s, "campfire"); interact(s); assert.ok(!allEnemies(s).some(n => n.hp && n.x === s.x && n.y === s.y));
});

test("nearby pursuers survive crossing out of their original spawn window", () => {
  const { chunk } = findFeature("ruins"), s = frontier(chunk.x, chunk.y); streamWorld(s);
  const e = s.roamers.find(e => e.kind === "guard")!;
  s.x += CHUNK_SIZE * 3; e.x = s.x - 1; e.y = s.y; setTile(s, s.x, s.y, 0); setTile(s, e.x, e.y, 0); s.world.foes[e.id] = { x: e.x, y: e.y, hp: e.hp };
  streamWorld(s); assert.ok(s.roamers.some(n => n.id === e.id)); assert.ok(s.roamers.length <= 18); assert.deepEqual(readSave(JSON.stringify(s), true), s);
});

test("save timestamps survive validation and reject malformed values", () => {
  const s = createGame(); s.savedAt = 123456789; assert.equal(readSave(JSON.stringify(s), true).savedAt, s.savedAt);
  for (const savedAt of [-1, 1.1, "123", Number.MAX_SAFE_INTEGER]) assert.throws(() => readSave(JSON.stringify({ ...s, savedAt }), true), /Invalid world save/);
});

test("v2 saves migrate without erasing terrain, inventory, objectives or combat progress", () => {
  const s = createGame(), old = { version: 2, tiles: [...s.tiles], x: s.x, y: s.y, facing: [...s.facing], hp: s.hp, chakra: s.chakra, wood: s.wood, stone: s.stone, scrolls: [...s.scrolls], enemies: s.enemies.map(e => ({ ...e })), inventory: { herb: 0, ore: 0, medicine: 1, bridge: 0, fence: 0, lantern: 0 }, quests: [...s.quests], upgrades: [...s.upgrades], projectiles: [...s.projectiles] };
  const inventory = { ...old.inventory };
  old.tiles[3 * 40 + 3] = 5; old.scrolls = [0, 2]; old.quests = ["supplies"]; old.enemies[0].hp = 0; old.inventory = inventory;
  const restored = readSave(JSON.stringify(old), true); assert.equal(restored.version, 3); assert.deepEqual(restored.tiles, old.tiles); assert.deepEqual(restored.enemies, old.enemies); assert.deepEqual(restored.scrolls, old.scrolls); assert.deepEqual(restored.quests, old.quests);
  for (const [key, value] of Object.entries(inventory)) assert.equal(restored.inventory[key as keyof typeof inventory], value);
  assert.deepEqual(readSave(JSON.stringify(restored), true), restored);
});

test("invalid frontier imports are rejected explicitly rather than replacing the live world", () => {
  const s = frontier(), before = JSON.stringify(s);
  for (const patch of [
    { world: { ...s.world, seed: -1 } }, { world: { ...s.world, changes: { "__proto__": 1, "not-a-point": 3 } } },
    { world: { ...s.world, changes: { "-60,-60": 999 } } }, { world: { ...s.world, changes: { "4,4": 0 } } },
    { world: { ...s.world, explored: { "-01,0": true } } }, { world: { ...s.world, foes: { "arbitrary": { hp: 1, x: 0, y: 0 } } } },
    { elapsed: -10 }, { spawn: { x: 0, y: 0 } }, { crops: { "-59,-60": 30 } }, { world: { ...s.world, changes: { "-59,-60": 22 } } }, { roamers: [null] },
  ]) assert.throws(() => readSave(JSON.stringify({ ...s, ...patch }), true), /Invalid world save/);
  assert.throws(() => readSave("not JSON", true), /Invalid world save/); assert.equal(JSON.stringify(s), before);
});
