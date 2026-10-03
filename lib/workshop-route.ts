import { stationPositions } from "./workshop-room.ts";

export type Station = "about" | "psystream" | "projects" | "skills" | "activity" | "furnace" | "contact" | "sleep" | "jukebox";
export type Point = { x: number; z: number };
export const home: Point = { x: .1, z: .2 };
export const approaches: Record<Station, Point> = {
  about: home, projects: { x: 1.5, z: 2.7 }, skills: { x: -2.5, z: 2.7 },
  activity: { x: -.86, z: -.9 }, furnace: { x: 2.5, z: -1.15 }, contact: { x: 3.5, z: 2.7 },
  sleep: { x: -3.5, z: -.15 }, psystream: { x: 1.5, z: -1.15 }, jukebox: { x: -.5, z: 2.7 },
};
export const roomObstacles = [
  ...(["projects", "skills", "activity", "furnace", "contact", "sleep", "jukebox"] as const).map(id => ({
    ...stationPositions[id], radiusX: id === "projects" ? .4375 : .5,
    radiusZ: id === "sleep" ? 1 : id === "projects" ? .4375 : .5,
  })),
  { x: 3.5, z: -2.5, radiusX: .5, radiusZ: .5 }, // Sapling pedestal.
];

export function clearRoomSegment(a: Point, b: Point) {
  if (a.x !== b.x && a.z !== b.z) return false;
  const reachX = a.x !== b.x ? .65 : .48, reachZ = a.z !== b.z ? .65 : .48;
  return roomObstacles.every(o =>
    Math.max(a.x, b.x) <= o.x - o.radiusX - reachX || Math.min(a.x, b.x) >= o.x + o.radiusX + reachX ||
    Math.max(a.z, b.z) <= o.z - o.radiusZ - reachZ || Math.min(a.z, b.z) >= o.z + o.radiusZ + reachZ);
}

// Rectilinear A*: actual interrupted position + furniture clearance edges, not
// snapped cells or a mandatory trip through the centre. This tiny room needs no navmesh.
export function workshopRoute(start: Point, destination: Point): Point[] {
  if (start.x === destination.x && start.z === destination.z) return [{ ...destination }];
  const coordinates = (axis: "x" | "z", min: number, max: number) => [...new Set([
    start[axis], destination[axis], min, max,
    ...roomObstacles.flatMap(o => [o[axis] - (axis === "x" ? o.radiusX : o.radiusZ) - .66, o[axis] + (axis === "x" ? o.radiusX : o.radiusZ) + .66]),
  ])].filter(n => n >= min && n <= max).sort((a, b) => a - b);
  const xs = coordinates("x", -3.5, 3.5), zs = coordinates("z", -2.35, 2.7);
  const points = zs.flatMap(z => xs.map(x => ({ x, z })));
  const from = points.findIndex(p => p.x === start.x && p.z === start.z), to = points.findIndex(p => p.x === destination.x && p.z === destination.z);
  if (from < 0 || to < 0) return [];
  const cost = points.map(() => Infinity), parent = points.map(() => -1), open = new Set([from]); cost[from] = 0;
  const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  while (open.size) {
    let current = -1, best = Infinity;
    for (const id of open) { const score = cost[id] + distance(points[id], destination); if (score < best) { best = score; current = id; } }
    if (current === to) {
      const path: Point[] = [];
      for (let id = to; id !== from; id = parent[id]) path.unshift(points[id]);
      // Keep bends only; interrupted trips still begin at the exact actor position.
      return path.filter((p, i) => { const a = i ? path[i - 1] : start, b = path[i + 1]; return !b || (a.x !== b.x && a.z !== b.z); });
    }
    open.delete(current);
    const col = current % xs.length, row = Math.floor(current / xs.length);
    const neighbors = [col > 0 ? current - 1 : -1, col + 1 < xs.length ? current + 1 : -1, row > 0 ? current - xs.length : -1, row + 1 < zs.length ? current + xs.length : -1];
    for (const next of neighbors) {
      if (next < 0 || !clearRoomSegment(points[current], points[next])) continue;
      const score = cost[current] + distance(points[current], points[next]);
      if (score < cost[next]) { cost[next] = score; parent[next] = current; open.add(next); }
    }
  }
  return []; // Never fall back to walking through furniture.
}
