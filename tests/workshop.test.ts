import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { home, approaches, workshopRoute, roomObstacles, clearRoomSegment } from "../lib/workshop-route.ts";
import { roomBlocks, minecraftGait, stationPositions } from "../lib/workshop-room.ts";

test("PsyStream uses verified local public branding, precedes repository projects, and paints in front of the wall", async () => {
  const manifest = JSON.parse(readFileSync("public/art/psystream.provenance.json", "utf8"));
  assert.equal(manifest.source, "https://stream.psymariux.dev");
  for (const [file, asset] of Object.entries(manifest.assets) as [string, { source: string; sha256: string }][]) {
    assert.equal(createHash("sha256").update(readFileSync(`public/art/${file}`)).digest("hex"), asset.sha256);
    assert.ok(asset.source.startsWith("https://stream.psymariux.dev"));
  }
  for (const [file, manifestFile] of [["workshop.png", "workshop.png.provenance.json"], ["workshop.webp", "workshop.webp.json"]]) {
    const capture = JSON.parse(readFileSync(`public/art/${manifestFile}`, "utf8"));
    assert.equal(createHash("sha256").update(readFileSync(`public/art/${file}`)).digest("hex"), capture.sha256);
    assert.ok(capture.source.includes("public/art/psystream.provenance.json"));
    const pixels = await sharp(`public/art/${file}`).stats();
    assert.ok(pixels.channels.some(channel => channel.stdev > 20), "fallback must contain a rendered room, not a discarded blank WebGL buffer");
  }
  const workshop = readFileSync("components/Workshop.tsx", "utf8");
  assert.ok(workshop.indexOf("<PsyStream onDetails=") < workshop.indexOf('id="projects"'));
  assert.ok(readFileSync("components/PsyStream.tsx", "utf8").includes("Closed source"));
  assert.ok(stationPositions.psystream.z > -3, "the front wall face is at z=-3; painting must not hide behind it");
  assert.ok(approaches.psystream.z > stationPositions.psystream.z + 1);
});

test("vanilla models resolve every texture locally and record unchanged source hashes", () => {
  const models = JSON.parse(readFileSync("lib/minecraft-models.json", "utf8"));
  const provenance = JSON.parse(readFileSync("public/minecraft/provenance.json", "utf8"));
  assert.equal(provenance.version, "Minecraft Java 1.21.4");
  for (const [file, asset] of Object.entries(provenance.assets) as [string, { source: string; sha256: string }][]) {
    const image = readFileSync(`public/minecraft/${file}`);
    assert.equal(createHash("sha256").update(image).digest("hex"), asset.sha256);
    // Vanilla art ships from two mirrors; both are the 1.21.4 client files.
    assert.ok(asset.source.startsWith("https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/") || asset.source.startsWith("https://assets.mcasset.cloud/"));
    assert.equal(image.subarray(1, 4).toString(), "PNG");
  }
  for (const name of ["crafting_table", "furnace_on", "lectern", "redstone_lamp", "redstone_lamp_on", "lever", "potted_oak_sapling"]) assert.ok(models[name].elements.length);
  for (const model of Object.values(models) as { elements: { faces: Record<string, { texture: string }> }[] }[]) {
    for (const element of model.elements) for (const face of Object.values(element.faces)) {
      assert.ok(!face.texture.startsWith("#"));
      assert.ok(existsSync(`public/minecraft/${face.texture}.png`));
    }
  }
});

test("structural blocks share grid boundaries without positive-volume intersections", () => {
  for (let i = 0; i < roomBlocks.length; i++) for (let j = i + 1; j < roomBlocks.length; j++) {
    const a = roomBlocks[i], b = roomBlocks[j];
    const overlapX = 1 - Math.abs(a.x - b.x), overlapZ = 1 - Math.abs(a.z - b.z);
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    assert.ok(overlapX < 1e-8 || overlapY < 1e-8 || overlapZ < 1e-8, `${a.name}/${b.name} share occupied space`);
  }
  assert.ok(roomBlocks.some(b => b.name === "bookshelf" && b.z === -3.5));
  assert.ok(roomBlocks.every(b => b.y + b.height <= 5));
});

test("Minecraft gait has opposing rigid limb phases and is independent of wall-clock speed", () => {
  const start = minecraftGait(0), half = minecraftGait(Math.PI / (4 * .6662));
  assert.ok(Math.abs(start.arm + half.arm) < 1e-8);
  assert.ok(Math.abs(start.leg + half.leg) < 1e-8);
  assert.equal(start.leg / start.arm, 1.4);
  assert.deepEqual(minecraftGait(3), minecraftGait(3));
});

test("chest sprite frames and supplied audio/font assets ship with provenance", () => {
  const sheet = readFileSync("public/art/chest-sprites.png");
  assert.equal(sheet.readUInt32BE(16), 960); assert.equal(sheet.readUInt32BE(20), 96);
  assert.notDeepEqual(readFileSync("public/art/chest.png"), readFileSync("public/art/chest-open.png"));
  for (const [file, manifest] of [["public/audio/chidori.mp3", "public/audio/chidori.mp3.provenance.json"], ["public/audio/seals.mp3", "public/audio/seals.mp3.provenance.json"], ["public/audio/itachi-mangekyo.mp3", "public/audio/itachi-mangekyo.mp3.provenance.json"], ["public/audio/sharingan.mp3", "public/audio/sharingan.mp3.provenance.json"], ["public/fonts/DepartureMono-Regular.woff2", "public/fonts/provenance.json"]]) {
    const provenance = JSON.parse(readFileSync(manifest, "utf8"));
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), provenance.sha256);
  }
  assert.ok(readFileSync("public/fonts/OFL.txt", "utf8").includes("SIL OPEN FONT LICENSE"));
});

test("automatic approaches and returns use clear aisles, including contact-to-chest interruptions", () => {
  const obstacles = roomObstacles;
  const destinations = Object.values(approaches);
  for (const start of [home, ...destinations]) for (const destination of destinations) {
    const initial = { ...start };
    const route = workshopRoute(start, destination);
    assert.deepEqual(start, initial, "route planning does not mutate the actor");
    assert.deepEqual(route.at(-1), destination);
    let previous = start;
    for (const point of route) {
      assert.ok(point.x === previous.x || point.z === previous.z, "walk the aisles, not diagonal shortcuts");
      for (let step = 0; step <= 100; step++) {
        const x = previous.x + (point.x - previous.x) * step / 100;
        const z = previous.z + (point.z - previous.z) * step / 100;
        // Include extended walking feet, not just the actor's stationary centre.
        const alongX = point.x !== previous.x;
        const reachX = alongX ? .65 : .48, reachZ = alongX ? .48 : .65;
        for (const obstacle of obstacles) assert.ok(Math.abs(x - obstacle.x) >= obstacle.radiusX + reachX || Math.abs(z - obstacle.z) >= obstacle.radiusZ + reachZ, `collision at ${x},${z} against ${obstacle.x},${obstacle.z}, route ${JSON.stringify({ start, destination })}`);
      }
      previous = point;
    }
  }
});


test("room routes are shortest clear paths and can replan from every interrupted segment", () => {
  assert.deepEqual(workshopRoute(approaches.psystream, approaches.furnace), [approaches.furnace], "neighbors don't detour through home");
  let replans = 0;
  for (const start of [home, ...Object.values(approaches)]) for (const destination of Object.values(approaches)) {
    const path = workshopRoute(start, destination); let previous = start;
    for (const point of path) {
      for (const fraction of [.13, .47, .83]) {
        const interrupted = { x: previous.x + (point.x - previous.x) * fraction, z: previous.z + (point.z - previous.z) * fraction };
        for (const next of Object.values(approaches)) {
          const replan = workshopRoute(interrupted, next);
          assert.deepEqual(replan.at(-1), next, "every interrupted trip remains reachable");
          let a = interrupted;
          for (const b of replan) { assert.ok(clearRoomSegment(a, b), "interruptions cannot cut through furniture"); a = b; }
          replans++;
        }
      }
      previous = point;
    }
  }
  assert.ok(replans > 1000);
  assert.deepEqual(workshopRoute({ x: 1.5, z: 1.5 }, home), [], "invalid occupied starts must not produce an unsafe fallback");
});

test("room uses a physical lever, official bed icon and actual PsyStream favicon", () => {
  const scene = readFileSync("components/Scene.tsx", "utf8"), workshop = readFileSync("components/Workshop.tsx", "utf8");
  assert.ok(!scene.includes('block("command_block"'));
  assert.ok(scene.includes('block("redstone_lamp", 0, 0, 0, terminal)'));
  assert.ok(scene.includes('block("lever"'));
  assert.ok(scene.includes('sequence.call(toggleLever)'));
  assert.ok(!scene.includes('const powered = hovered === "activity"'), "hover must not operate the lever");
  assert.ok(workshop.includes('art: "psystream-favicon"'));
  const bed = JSON.parse(readFileSync("public/art/bed.png.provenance.json", "utf8"));
  assert.ok(bed.source.startsWith("https://raw.githubusercontent.com/Mojang/bedrock-samples/"));
  assert.equal(createHash("sha256").update(readFileSync("public/art/bed.png")).digest("hex"), bed.sha256);
});
