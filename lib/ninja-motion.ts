export type SpriteMotion = { x: number; y: number; fromX: number; fromY: number; tx: number; ty: number; start: number; last: number; travel: number; facing: [number, number]; walking: boolean };
export function spriteMotion(cache: Map<string, SpriteMotion> | undefined, id: string, x: number, y: number, now: number, reduced: boolean, duration = 95) {
  const m = cache?.get(id) ?? { x, y, fromX: x, fromY: y, tx: x, ty: y, start: now, last: now, travel: 0, facing: [0, 1] as [number, number], walking: false };
  const beforeX = m.x, beforeY = m.y;
  let snapped = reduced || !cache || now - m.last > 2000;
  if (x !== m.tx || y !== m.ty) {
    const dx = x - m.tx, dy = y - m.ty;
    m.facing = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    m.fromX = m.x; m.fromY = m.y; m.tx = x; m.ty = y; m.start = now;
    if (Math.abs(dx) + Math.abs(dy) > 4) snapped = true;
  }
  if (snapped) { m.fromX = x; m.fromY = y; }
  const t = snapped ? 1 : Math.min(1, Math.max(0, (now - m.start) / duration)), eased = 1 - (1 - t) ** 2;
  m.x = m.fromX + (x - m.fromX) * eased; m.y = m.fromY + (y - m.fromY) * eased;
  const moved = Math.hypot(m.x - beforeX, m.y - beforeY); m.walking = !snapped && moved > .00001;
  if (m.walking) m.travel += moved;
  m.last = now; cache?.set(id, m); return m;
}
