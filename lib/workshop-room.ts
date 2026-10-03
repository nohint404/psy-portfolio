// Grid-aligned structural blocks: wall decorations replace cells, never overlap them.
export type RoomBlock = { name: string; x: number; y: number; z: number; height: number; axis?: "x" | "z" };
export const roomBlocks: RoomBlock[] = [];
for (let x = 0; x < 8; x++) for (let z = 0; z < 6; z++) {
  roomBlocks.push({ name: "oak_planks", x: x - 3.5, y: -.35, z: z - 2.5, height: .35 });
  roomBlocks.push({ name: "cobblestone", x: x - 3.5, y: -.7, z: z - 2.5, height: .35 });
}
for (let y = 0; y < 4; y++) {
  for (let x = -4.5; x <= 3.5; x++) {
    const name = [-3.5, .5, 3.5].includes(x) ? "oak_log" : [-1.5, -.5].includes(x) && y >= 2 ? "bookshelf" : "cobblestone";
    roomBlocks.push({ name, x, y, z: -3.5, height: 1 });
  }
  for (let z = -2.5; z <= 2.5; z++) roomBlocks.push({ name: "cobblestone", x: -4.5, y, z, height: 1 });
}
for (let x = -4.5; x <= 3.5; x++) roomBlocks.push({ name: "oak_log", x, y: 4, z: -3.5, height: 1, axis: "x" });
for (let z = -2.5; z <= 2.5; z++) roomBlocks.push({ name: "oak_log", x: -4.5, y: 4, z, height: 1, axis: "z" });

export const stationPositions = {
  projects: { x: 1.5, z: 1.5 }, skills: { x: -2.5, z: 1.5 },
  activity: { x: -.5, z: -2.5 }, furnace: { x: 2.5, z: -2.5 }, contact: { x: 3.5, z: 1.5 },
  sleep: { x: -3.5, z: -2 }, psystream: { x: 1.5, z: -2.975 }, jukebox: { x: -.5, z: 1.5 },
};

// Vanilla gait: straight rigid limbs, opposite arm/leg phases, driven by distance.
export function minecraftGait(distance: number) {
  const phase = distance * 4 * .6662;
  return { arm: Math.cos(phase) * .6, leg: Math.cos(phase) * .84 };
}
