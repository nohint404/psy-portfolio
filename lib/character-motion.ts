export type Point3 = [number, number, number];
export function nearestHeading(from: number, to: number) {
  const full = Math.PI * 2; return from + ((to - from + Math.PI) % full + full) % full - Math.PI;
}
// Two rigid segments, with a pole to keep elbows/knees bending away from the body.
export function limbElbow(target: Point3, upper: number, lower: number, pole: Point3): Point3 {
  const length = Math.hypot(...target);
  if (!length) return [0, -upper, 0];
  const direction = target.map(v => v / length), projection = pole.reduce((sum, v, i) => sum + v * direction[i], 0);
  let bend = pole.map((v, i) => v - projection * direction[i]), bendLength = Math.hypot(...bend);
  if (bendLength < 1e-8) { const fallback = Math.abs(direction[0]) < .8 ? [1, 0, 0] : [0, 0, 1]; const dot = fallback.reduce((sum, v, i) => sum + v * direction[i], 0); bend = fallback.map((v, i) => v - dot * direction[i]); bendLength = Math.hypot(...bend); }
  const reach = Math.max(Math.abs(upper - lower) + 1e-8, Math.min(upper + lower - 1e-8, length));
  const along = (upper ** 2 - lower ** 2 + reach ** 2) / (2 * reach), height = Math.sqrt(Math.max(0, upper ** 2 - along ** 2));
  return direction.map((v, i) => v * along + bend[i] / bendLength * height) as Point3;
}
export function leverPose(angle: number) {
  const t = Math.max(0, Math.min(1, (angle + Math.PI / 4) / (Math.PI / 2)));
  return { lean: .24 + .76 * t, hip: .72 - .2 * t };
}
