import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { limbElbow, leverPose, nearestHeading } from "../lib/character-motion.ts";
import { approaches } from "../lib/workshop-route.ts";
import { spriteMotion, type SpriteMotion } from "../lib/ninja-motion.ts";
import { findCommands, type WorkshopCommand } from "../lib/workshop-commands.ts";

test("both lever directions keep the hand on the moving shaft and crouched feet on the floor", () => {
  const actor = new THREE.Group(); actor.position.set(approaches.activity.x, 0, approaches.activity.z); actor.rotation.y = Math.PI;
  const body = new THREE.Group(), arm = new THREE.Group(), forearm = new THREE.Group(); actor.add(body); body.add(arm); arm.add(forearm); arm.position.set(-.36, .72, 0); forearm.position.y = -.36;
  const lever = new THREE.Group(), handle = new THREE.Group(); lever.position.set(-.5, .75, -1.995); lever.rotation.x = Math.PI / 2; handle.position.y = 1 / 16; lever.add(handle);
  const handEnd = new THREE.Vector3(0, -.225, .04), down = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i <= 100; i++) {
    const angle = -Math.PI / 4 + i / 100 * Math.PI / 2, pose = leverPose(angle);
    handle.rotation.x = angle; body.position.y = pose.hip; body.rotation.x = pose.lean; actor.updateMatrixWorld(true);
    const target = handle.localToWorld(new THREE.Vector3(0, 8.5 / 16, 0));
    const local = body.worldToLocal(target.clone()).sub(arm.position);
    assert.ok(local.length() <= .36 + handEnd.length(), `shaft must be reachable at sample ${i}`);
    const elbow = new THREE.Vector3().fromArray(limbElbow(local.toArray(), .36, handEnd.length(), [-1, 0, 0]));
    assert.ok(Math.abs(elbow.length() - .36) < 1e-7); assert.ok(Math.abs(local.clone().sub(elbow).length() - handEnd.length()) < 1e-7);
    arm.quaternion.setFromUnitVectors(down, elbow.clone().normalize());
    forearm.quaternion.setFromUnitVectors(handEnd.clone().normalize(), local.clone().sub(elbow).normalize()).premultiply(arm.quaternion.clone().invert());
    actor.updateMatrixWorld(true); assert.ok(forearm.localToWorld(handEnd.clone()).distanceTo(target) < 1e-7);
    const head = body.localToWorld(new THREE.Vector3(0, .96, 0)); assert.ok(head.z - .27 > -2, "upright head must not clip through the lamp's front face");
    const knee = new THREE.Vector3().fromArray(limbElbow([0, -pose.hip, 0], .36, .36, [0, 0, 1]));
    assert.ok(Math.abs(knee.length() - .36) < 1e-7); assert.ok(Math.abs(new THREE.Vector3(0, -pose.hip, 0).sub(knee).length() - .36) < 1e-7);
  }
});

test("arrivals, interrupted trips and bed poses take the shortest turn without a full-circle spin", () => {
  for (const from of [-Math.PI * 5, -Math.PI, -.1, 0, Math.PI, Math.PI * 6]) for (const to of [-Math.PI, -.2, 0, .2, Math.PI]) {
    const heading = nearestHeading(from, to);
    assert.ok(Math.abs(heading - from) <= Math.PI + 1e-8); assert.ok(Math.abs(Math.sin(heading) - Math.sin(to)) < 1e-8); assert.ok(Math.abs(Math.cos(heading) - Math.cos(to)) < 1e-8);
  }
  assert.ok(Math.abs(nearestHeading(-Math.PI, Math.PI) + Math.PI) < 1e-8);
});

test("limb poles remain finite at parallel and unreachable targets", () => {
  for (const target of [[0, 0, 0], [0, -20, 0], [0, -.1, 0], [1, 0, 0]] as [number, number, number][]) {
    const elbow = limbElbow(target, .36, .225, [0, -1, 0]); assert.ok(elbow.every(Number.isFinite)); assert.ok(Math.abs(Math.hypot(...elbow) - .36) < 1e-7);
  }
});

test("render-only movement interpolates signed grid steps, turns, stops and snaps teleports/reduced motion", () => {
  const cache = new Map<string, SpriteMotion>();
  spriteMotion(cache, "player", -20, -10, 0, false); spriteMotion(cache, "player", -19, -10, 115, false);
  const mid = spriteMotion(cache, "player", -19, -10, 160, false); assert.ok(mid.x > -20 && mid.x < -19); assert.deepEqual(mid.facing, [1, 0]); assert.ok(mid.walking);
  const end = spriteMotion(cache, "player", -19, -10, 210, false); assert.equal(end.x, -19);
  assert.equal(spriteMotion(cache, "player", -19, -10, 226, false).walking, false);
  spriteMotion(cache, "player", -19, -11, 230, false); assert.deepEqual(spriteMotion(cache, "player", -19, -11, 250, false).facing, [0, -1]);
  const teleported = spriteMotion(cache, "player", 900, -900, 260, false); assert.equal(teleported.x, 900); assert.equal(teleported.y, -900); assert.equal(teleported.walking, false);
  const reduced = spriteMotion(cache, "player", 901, -900, 275, true); assert.equal(reduced.x, 901); assert.equal(reduced.walking, false);
  assert.equal(spriteMotion(cache, "player", 901, -900, 280, false).x, 901, "resume must not rewind a snapped step");
  assert.equal(spriteMotion(undefined, "player", 120, -90, 0, false).x, 120);
});

test("quick navigation searches all tokens, diacritics and public metadata without running actions", () => {
  let calls = 0;
  const commands: WorkshopCommand[] = [{ id: "lamp", label: "Redstone lamp", detail: "Flip the lever / attività", keywords: "github commits", art: "/art/terminal.png", run: () => calls++ }, { id: "repo", label: "Psy-Tool", detail: "Public repository / Rust", keywords: "server backend", art: "/art/chest.png", run: () => calls++ }];
  assert.deepEqual(findCommands(commands, "  GITHUB attivita  ").map(c => c.id), ["lamp"]);
  assert.deepEqual(findCommands(commands, "RUST backend").map(c => c.id), ["repo"]);
  assert.equal(findCommands(commands, "Rust github").length, 0); assert.equal(findCommands(commands, "   ").length, 2); assert.equal(calls, 0);
});
