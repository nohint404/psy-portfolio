// Deterministic terrain, independent of rendering, saves and simulation.
// 40×32 is only the authored starting village. Coordinates beyond it stay open.
export const CHUNK_SIZE = 24, CHUNK_CACHE_LIMIT = 64, DEFAULT_SEED = 20261001;
export type Biome = "meadow" | "forest" | "marsh" | "dunes" | "frost";
export type WildEnemy = { id: string; x: number; y: number; hp: number; kind: "rogue" | "archer" | "guard" };
export type Chunk = { x: number; y: number; biome: Biome; feature: "camp" | "ruins" | "grove" | null; tiles: number[]; enemies: WildEnemy[] };
export const biomeNames: Record<Biome, string> = { meadow: "Windflower fields", forest: "Jade wilds", marsh: "Mistwater marsh", dunes: "Amber dunes", frost: "Silver highlands" };
export const pointKey = (x: number, y: number) => `${x},${y}`;
export const chunkKey = (x: number, y: number) => pointKey(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE));
export const villageTile = (x: number, y: number) => x >= 0 && x < 40 && y >= 0 && y < 32;
const mod = (n: number, d: number) => ((n % d) + d) % d;
function random(seed: number, x: number, y: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(Math.floor(x / 4294967296), 1274126177) ^ Math.imul(Math.floor(y / 4294967296), 2246822519) ^ seed;
  h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function noise(seed: number, x: number, y: number, scale: number) {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale), fx = mod(x, scale) / scale, fy = mod(y, scale) / scale;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = random(seed, gx, gy), b = random(seed, gx + 1, gy), c = random(seed, gx, gy + 1), d = random(seed, gx + 1, gy + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
export function biomeAt(seed: number, x: number, y: number): Biome {
  const climate = noise(seed ^ 9173, x, y, 96);
  return climate < .25 ? "frost" : climate < .4 ? "dunes" : climate < .6 ? "forest" : climate < .78 ? "meadow" : "marsh";
}
export const groundTile = (seed: number, x: number, y: number) => ({ meadow: 0, forest: 0, marsh: 0, dunes: 9, frost: 19 })[biomeAt(seed, x, y)];
const cache = new Map<string, Chunk>();
export const cachedChunks = () => cache.size;
export function worldChunk(seed: number, cx: number, cy: number): Chunk {
  const id = `${seed}:${pointKey(cx, cy)}`, cached = cache.get(id);
  if (cached) { cache.delete(id); cache.set(id, cached); return cached; }
  const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE, x = x0 + 12, y = y0 + 12;
  // Chunks intersecting the authored village have no overlapping procedural props.
  const feature = cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1 ? null : random(seed ^ 41, cx, cy) < .25 ? "ruins" : random(seed ^ 53, cx, cy) < .45 ? "camp" : "grove";
  const tiles: number[] = Array.from({ length: CHUNK_SIZE ** 2 }, (_, i) => {
    const lx = i % CHUNK_SIZE, ly = Math.floor(i / CHUNK_SIZE), wx = x0 + lx, wy = y0 + ly, biome = biomeAt(seed, wx, wy), r = random(seed, wx, wy);
    const water = noise(seed ^ 821, wx, wy, 28) < (biome === "marsh" ? .48 : .24);
    // Connected trail crossings are guaranteed across every chunk seam, including
    // rivers. Trees/rocks can always be mined; exploration never needs a rare key.
    if (lx === 12 || ly === 12) return water ? 7 : 1;
    if (feature && Math.abs(lx - 12) <= 3 && Math.abs(ly - 12) <= 3) {
      if (feature === "ruins" && (Math.abs(lx - 12) === 3 || Math.abs(ly - 12) === 3)) return 11;
      if (lx === 11 && ly === 11 && feature === "camp") return 16;
      if (lx === 14 && ly === 10 && feature === "ruins") return 18;
      return feature === "ruins" ? 9 : 0;
    }
    if (water) return 2;
    if (r < .025) return 20;
    if (r < .07) return 4;
    if (r < (biome === "forest" ? .32 : biome === "marsh" ? .2 : .13)) return 3;
    if (r < .4 && biome !== "dunes" && biome !== "frost") return 8;
    return biome === "dunes" ? 9 : biome === "frost" ? 19 : 0;
  });
  const enemies: WildEnemy[] = feature === "ruins" ? [
    { id: `${pointKey(cx, cy)}:0`, x: x - 2, y: y - 2, hp: 6, kind: "guard" },
    { id: `${pointKey(cx, cy)}:1`, x: x - 2, y: y + 2, hp: 3, kind: "archer" },
  ] : feature === "grove" ? [{ id: `${pointKey(cx, cy)}:0`, x: x0 + 7, y: y0 + 8, hp: 3, kind: random(seed ^ 211, cx, cy) < .5 ? "rogue" : "archer" }] : [];
  for (const e of enemies) tiles[(e.y - y0) * CHUNK_SIZE + e.x - x0] = groundTile(seed, e.x, e.y);
  const chunk: Chunk = { x, y, biome: biomeAt(seed, x, y), feature, tiles, enemies };
  cache.set(id, chunk);
  if (cache.size > CHUNK_CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return chunk;
}
export function generatedTile(seed: number, x: number, y: number) {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return 4;
  const chunk = worldChunk(seed, Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE));
  return chunk.tiles[mod(y, CHUNK_SIZE) * CHUNK_SIZE + mod(x, CHUNK_SIZE)];
}
