// Minecraft's unfolded cube layout, in Three.js BoxGeometry face order.
export function skinFaces(x: number, y: number, w: number, h: number, d: number) {
  return [
    [x + d + w, y + d, d, h], // +x / left
    [x, y + d, d, h], // -x / right
    [x + d, y, w, d], // top
    [x + d + w, y, w, d], // bottom
    [x + d, y + d, w, h], // front
    [x + 2 * d + w, y + d, w, h], // back
  ];
}

// Slice an existing skin part, rather than remapping its entire texture onto
// every joint. Coordinates run left→right, top→bottom, back→front in pixels.
export function skinSliceFaces(x: number, y: number, w: number, h: number, d: number, from: number[], to: number[]) {
  const [x0, y0, z0] = from, [x1, y1, z1] = to;
  const ranges = [
    [d - z1, y0, z1 - z0, y1 - y0], [z0, y0, z1 - z0, y1 - y0],
    [x0, z0, x1 - x0, z1 - z0], [x0, d - z1, x1 - x0, z1 - z0],
    [x0, y0, x1 - x0, y1 - y0], [w - x1, y0, x1 - x0, y1 - y0],
  ];
  return skinFaces(x, y, w, h, d).map(([u, v], face) => {
    const [du, dv, width, height] = ranges[face];
    return [u + du, v + dv, width, height];
  });
}
