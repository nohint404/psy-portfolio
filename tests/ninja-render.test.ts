import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { awakenEyes, skinEyes } from "../lib/ninja-render.ts";

test("Mangekyo replaces the verified skin pupils, not cheek pixels or adjacent sclera", async () => {
  const { data, info } = await sharp("public/art/psymariux-skin.png").raw().toBuffer({ resolveWithObject: true });
  for (const eye of skinEyes) {
    const index = ((8 + Math.floor(eye.y)) * info.width + 8 + Math.floor(eye.x)) * info.channels;
    assert.ok(data[index] + data[index + 1] + data[index + 2] < 10, "anchor must be on a black pupil");
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) } });
  try {
    const rectangles: number[][] = [];
    const ctx = { drawImage: (_image: unknown, ...bounds: number[]) => rectangles.push(bounds) } as unknown as CanvasRenderingContext2D;
    awakenEyes(ctx, 64, 18, 24);
    assert.deepEqual(rectangles, [[88, 66, 24, 24], [208, 66, 24, 24]]);
    rectangles.length = 0;
    awakenEyes(ctx, 144, 89, 4);
    assert.deepEqual(rectangles, [[148, 97, 4, 4], [168, 97, 4, 4]]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
