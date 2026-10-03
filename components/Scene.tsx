"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { minecraftAssets } from "@/lib/minecraft";
import { home, approaches, workshopRoute, type Station } from "@/lib/workshop-route";
import { roomBlocks, minecraftGait, stationPositions } from "@/lib/workshop-room";
import { limbElbow, leverPose, nearestHeading } from "@/lib/character-motion";
export type { Station } from "@/lib/workshop-route";
export type SceneHandle = { visit: (id: Station) => void; reset: () => void };
type Props = { onSelect: (id: Station) => void; selected: Station | null; lit: boolean; suspended: boolean; musicPlaying: boolean; insertedRecord: number | null; onReady: (success: boolean) => void; onTravel: (id: Station | null) => void; onChidori: () => void; onSeals: () => void; onSleepChange: (sleeping: boolean) => void; controllerRef: Ref<SceneHandle> };
const labels: [Station, string][] = [["about", "Meet Psymariux"], ["psystream", "Explore the PsyStream painting"], ["projects", "Open the project chest"], ["skills", "Explore the crafting table"], ["activity", "Flip the redstone lever and read activity"], ["furnace", "Inspect the active-work furnace"], ["contact", "Open the message book"], ["sleep", "Rest in the cozy bed"], ["jukebox", "Choose a record at the jukebox"]];

export default function Scene({ onSelect, selected, lit, suspended, musicPlaying, insertedRecord, onReady, onTravel, onChidori, onSeals, onSleepChange, controllerRef }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onSelect, onTravel, onChidori, onSeals, onSleepChange });
  const current = useRef(selected), previous = useRef(selected), lighting = useRef(lit);
  const actions = useRef<SceneHandle | null>(null), suspension = useRef(suspended), music = useRef(musicPlaying), insertedDisc = useRef(insertedRecord);
  useImperativeHandle(controllerRef, () => ({ visit: id => actions.current?.visit(id), reset: () => actions.current?.reset() }), []);
  useEffect(() => {
    callbacks.current = { onSelect, onTravel, onChidori, onSeals, onSleepChange }; current.current = selected; lighting.current = lit; suspension.current = suspended; music.current = musicPlaying; insertedDisc.current = insertedRecord;
    if (previous.current && !selected) actions.current?.reset();
    previous.current = selected;
  }, [onSelect, onTravel, onChidori, onSeals, onSleepChange, selected, lit, suspended, musicPlaying, insertedRecord]);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let alive = true, loaded = false, failed = false, visible = true, sized = false, readyNotified = false, activeVisit: Station | null = null, sleeping = false, carryTorch = false;
    let raf = 0, frame = 0, walking = false, walkDistance = 0, strideWeight = 0;
    const lastPosition = new THREE.Vector3(home.x, 0, home.z);
    let sequence: gsap.core.Timeline | null = null;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" }); }
    catch { onReady(false); return; }
    renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true"); renderer.domElement.style.visibility = "hidden"; container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
    const camera = new THREE.OrthographicCamera(-8, 8, 5.4, -5.4, .1, 50);
    camera.position.set(11, 9, 13);
    const focus = new THREE.Vector3(-.25, 1.75, -.25), reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const framing = { zoom: 1 }; // Clamp the authored close-up to the current viewport, including resize.
    const caption = container.querySelector<HTMLElement>(".jutsu-caption")!;
    const assets = minecraftAssets(() => {
      if (!alive || failed) return;
      loaded = true; // Swap the preview only after the first fully sized, textured frame.
    }, () => { if (alive) { failed = true; renderer.domElement.style.visibility = "hidden"; onReady(false); } });
    const targets = new Map<Station, THREE.Group>();
    function block(name: string, x: number, y: number, z: number, parent: THREE.Object3D = world) {
      const group = assets.block(name); group.position.set(x, y, z); parent.add(group); return group;
    }
    function station(id: Station, x: number, z: number) {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.userData.station = id; world.add(group); targets.set(id, group); return group;
    }
    for (const cell of roomBlocks) {
      const group = assets.block(cell.name, cell.height); group.position.set(cell.x, cell.y, cell.z); world.add(group);
      // Models have a bottom-centred origin. Rebase rotated beams around their centres.
      if (cell.axis === "x") { group.rotation.z = Math.PI / 2; group.position.x += .5; group.position.y += .5; }
      if (cell.axis === "z") { group.rotation.x = Math.PI / 2; group.position.z -= .5; group.position.y += .5; }
    }
    block("oak_planks", 3.5, 0, -2.5); block("potted_oak_sapling", 3.5, 1, -2.5);
    const step = block("cobblestone", 2, -.65, 3.5); step.scale.set(2, .3, 1);
    const craft = station("skills", stationPositions.skills.x, stationPositions.skills.z); block("crafting_table", 0, 0, 0, craft).rotation.y = Math.PI;
    const furnace = station("furnace", stationPositions.furnace.x, stationPositions.furnace.z); block("furnace_on", 0, 0, 0, furnace).rotation.y = Math.PI;
    const chest = station("projects", stationPositions.projects.x, stationPositions.projects.z), chestModel = assets.chest(); chest.add(chestModel.group);
    const bedroom = station("sleep", stationPositions.sleep.x, stationPositions.sleep.z); bedroom.add(assets.bed());
    const jukebox = station("jukebox", stationPositions.jukebox.x, stationPositions.jukebox.z); block("jukebox", 0, 0, 0, jukebox);
    const recordTextures = [assets.texture("/art/disc-sweden.png"), assets.texture("/art/disc-moog-city.png")];
    const recordGeometry = new THREE.PlaneGeometry(.45, .45);
    const recordMaterial = new THREE.MeshLambertMaterial({ map: recordTextures[0], transparent: true, alphaTest: .5, side: THREE.DoubleSide });
    const record = new THREE.Mesh(recordGeometry, recordMaterial); record.rotation.y = Math.PI / 4; record.position.y = .84; record.visible = false; jukebox.add(record);
    let lastRecord: number | null = null, recordMotion: gsap.core.Timeline | null = null;
    const painting = station("psystream", stationPositions.psystream.x, stationPositions.psystream.z);
    const paintingGeometry = new THREE.PlaneGeometry(1.8, 1.2);
    const paintingMaterial = new THREE.MeshBasicMaterial({ map: assets.texture("/art/psystream-painting.png") });
    const screenPainting = new THREE.Mesh(paintingGeometry, paintingMaterial); screenPainting.position.y = 2.5; painting.add(screenPainting);
    const terminal = station("activity", stationPositions.activity.x, stationPositions.activity.z);
    const lamp = block("redstone_lamp", 0, 0, 0, terminal);
    const lever = block("lever", 0, .75, .505, terminal); lever.rotation.x = Math.PI / 2;
    const leverHandle = lever.children[1];
    const lampDark = assets.material("redstone_lamp"), lampLit = assets.material("redstone_lamp_on");
    let lampPowered = false, lastPower = false;
    function toggleLever() {
      lampPowered = !lampPowered;
      leverHandle.rotation.x = lampPowered ? Math.PI / 4 : -Math.PI / 4;
      container.dataset.powered = String(lampPowered);
    }
    const contact = station("contact", stationPositions.contact.x, stationPositions.contact.z); block("lectern", 0, 0, 0, contact).rotation.y = Math.PI;
    const bookGeometry = new THREE.PlaneGeometry(.65, .65);
    const bookMaterial = new THREE.MeshLambertMaterial({ map: assets.texture("/minecraft/book.png"), transparent: true, alphaTest: .1, side: THREE.DoubleSide });
    const book = new THREE.Mesh(bookGeometry, bookMaterial); book.rotation.x = -Math.PI / 2 + Math.PI / 8; book.position.set(0, 1.03, .108); contact.add(book);
    const dustGeometry = new THREE.PlaneGeometry(1, .12);
    const dustMaterial = new THREE.MeshLambertMaterial({ map: assets.texture("/minecraft/redstone_dust_line0.png"), color: "#b52315", transparent: true, alphaTest: .1, side: THREE.DoubleSide });
    for (const [x, z, turn] of [[1.5, -1.9, 0], [.5, -1.9, 0], [-.5, -1.9, Math.PI / 2]]) {
      const dust = new THREE.Mesh(dustGeometry, dustMaterial); dust.rotation.set(-Math.PI / 2, 0, turn); dust.position.set(x, .012, z); world.add(dust);
    }
    const lights: THREE.PointLight[] = [];
    for (const x of [-2.7, 2.7]) {
      block("torch", x, 2.6, -2.85);
      const light = new THREE.PointLight("#ffc583", 12, 7, 2); light.position.set(x, 3.2, -2); scene.add(light); lights.push(light);
    }
    const furnaceLight = new THREE.PointLight("#ffa34d", 6, 4, 2); furnaceLight.position.set(stationPositions.furnace.x, .6, stationPositions.furnace.z + .7); scene.add(furnaceLight);
    const signalLight = new THREE.PointLight("#ffc675", 2, 4, 2); signalLight.position.set(stationPositions.activity.x, .65, stationPositions.activity.z + .7); scene.add(signalLight);
    scene.add(new THREE.AmbientLight("#fff0d5", 1.7));
    const key = new THREE.DirectionalLight("#fff8eb", 2); key.position.set(4, 10, 8); scene.add(key);

    const actor = station("about", home.x, home.z);
    const upperBody = new THREE.Group(); upperBody.position.y = .72; actor.add(upperBody);
    const skinMaterial = new THREE.MeshLambertMaterial({ map: assets.texture("/art/psymariux-skin.png"), alphaTest: .5 });
    const limbs: { pivot: THREE.Group; sign: number; kind: "arm" | "leg" }[] = [];
    const unit = .06;
    function part(x: number, y: number, w: number, h: number, d: number, u: number, v: number, ou: number, ov: number, swing = 0) {
      const parent = y === 6 ? actor : upperBody;
      const pivot = new THREE.Group(); pivot.position.set(x * unit, (y + (swing ? h / 2 : 0)) * unit - (parent === upperBody ? .72 : 0), 0); parent.add(pivot);
      for (const overlay of [false, true]) {
        const mesh = assets.atlasBox(w, h, d, overlay ? ou : u, overlay ? ov : v, skinMaterial, unit, overlay ? h === 8 ? 1 : .5 : 0);
        mesh.position.y = swing ? -h * unit / 2 : 0; pivot.add(mesh);
      }
      if (swing) limbs.push({ pivot, sign: swing, kind: y === 6 ? "leg" : "arm" });
      return pivot;
    }
    const head = part(0, 28, 8, 8, 8, 0, 0, 32, 0); part(0, 18, 8, 12, 4, 16, 16, 16, 32);
    const rightArm = part(-6, 18, 4, 12, 4, 40, 16, 40, 32, -1);
    const leftArm = part(6, 18, 4, 12, 4, 32, 48, 48, 48, 1);
    const rightLeg = part(-2, 6, 4, 12, 4, 0, 16, 0, 32, 1), leftLeg = part(2, 6, 4, 12, 4, 16, 48, 0, 48, -1);
    function articulate(arm: THREE.Group, u: number, v: number, sign: number) {
      const original = [...arm.children], rig = new THREE.Group(); rig.visible = false; arm.add(rig);
      // The verified skin's arm overlays are transparent. Slice its original
      // sleeve/cuff pixels; don't stretch a whole arm texture onto each finger.
      const sleeve = assets.atlasSlice(u, v, [0, 0, 0], [4, 6, 4], skinMaterial, unit); sleeve.position.y = -3 * unit; rig.add(sleeve);
      const elbow = new THREE.Group(); elbow.position.y = -6 * unit; rig.add(elbow);
      const cuff = assets.atlasSlice(u, v, [0, 6, 0], [4, 8, 4], skinMaterial, unit); cuff.position.y = -unit; elbow.add(cuff);
      const wrist = new THREE.Group(); wrist.position.y = -2 * unit; elbow.add(wrist);
      const palm = assets.atlasSlice(u, v, [0, 8, 0], [4, 9, 4], skinMaterial, unit); palm.position.y = -.5 * unit; wrist.add(palm);
      const fingers = Array.from({ length: 4 }, (_, i) => {
        const joint = new THREE.Group(); joint.position.set((i - 1.5) * unit, -unit, 0); wrist.add(joint);
        const finger = assets.atlasSlice(u, v, [i, 9, 1], [i + 1, 12, 3], skinMaterial, unit); finger.position.y = -1.5 * unit; joint.add(finger); return joint;
      });
      const thumb = new THREE.Group(); thumb.position.set(sign * 2 * unit, -.5 * unit, 0); wrist.add(thumb);
      const digit = assets.atlasSlice(u, v, [sign > 0 ? 3 : 0, 8, 1], [sign > 0 ? 4 : 1, 10, 3], skinMaterial, unit); digit.position.y = -unit; thumb.add(digit);
      return { arm, original, rig, elbow, wrist, fingers, thumb, sign };
    }
    const hands = [articulate(rightArm, 40, 16, 1), articulate(leftArm, 32, 48, -1)];
    const knees = [{ leg: rightLeg, u: 0, v: 16 }, { leg: leftLeg, u: 16, v: 48 }].map(({ leg, u, v }) => {
      const original = [...leg.children], rig = new THREE.Group(), knee = new THREE.Group(); rig.visible = false; leg.add(rig);
      const thigh = assets.atlasSlice(u, v, [0, 0, 0], [4, 6, 4], skinMaterial, unit); thigh.position.y = -3 * unit; rig.add(thigh);
      knee.position.y = -6 * unit; rig.add(knee);
      const shin = assets.atlasSlice(u, v, [0, 6, 0], [4, 12, 4], skinMaterial, unit); shin.position.y = -3 * unit; knee.add(shin);
      return { leg, original, rig, knee };
    });
    const grip = { amount: 0 }, gripPoint = new THREE.Vector3(0, 8.5 / 16, 0), handEnd = new THREE.Vector3(0, -3.75 * unit, .04);
    const down = new THREE.Vector3(0, -1, 0), gripTarget = new THREE.Vector3(), localGrip = new THREE.Vector3(), elbowPoint = new THREE.Vector3(), limbDirection = new THREE.Vector3(), shoulderAim = new THREE.Quaternion(), elbowAim = new THREE.Quaternion();
    function poseLever() {
      const hand = hands[0], pose = leverPose(leverHandle.rotation.x);
      upperBody.rotation.x = pose.lean * grip.amount; upperBody.position.y = .72 + (pose.hip - .72) * grip.amount; head.rotation.x = -upperBody.rotation.x; head.rotation.y = 0;
      actor.updateMatrixWorld(true); leverHandle.localToWorld(gripTarget.copy(gripPoint));
      localGrip.copy(gripTarget); hand.arm.parent!.worldToLocal(localGrip); localGrip.sub(hand.arm.position);
      elbowPoint.fromArray(limbElbow(localGrip.toArray(), 6 * unit, handEnd.length(), [-1, 0, 0]));
      shoulderAim.setFromUnitVectors(down, limbDirection.copy(elbowPoint).normalize());
      elbowAim.setFromUnitVectors(limbDirection.copy(handEnd).normalize(), localGrip.clone().sub(elbowPoint).normalize());
      elbowAim.premultiply(shoulderAim.clone().invert());
      hand.arm.quaternion.identity().slerp(shoulderAim, grip.amount); hand.elbow.quaternion.identity().slerp(elbowAim, grip.amount);
      knees.forEach(({ leg, knee }) => {
        leg.position.y = upperBody.position.y;
        elbowPoint.fromArray(limbElbow([0, -leg.position.y, 0], 6 * unit, 6 * unit, [0, 0, 1]));
        shoulderAim.setFromUnitVectors(down, limbDirection.copy(elbowPoint).normalize());
        elbowAim.setFromUnitVectors(down, limbDirection.set(0, -leg.position.y, 0).sub(elbowPoint).normalize()).premultiply(shoulderAim.clone().invert());
        leg.quaternion.copy(shoulderAim); knee.quaternion.copy(elbowAim);
      });
      if (grip.amount > .999) {
        actor.updateMatrixWorld(true); const actual = hand.elbow.localToWorld(handEnd.clone());
        container.dataset.gripError = actual.distanceTo(gripTarget).toFixed(4);
      }
    }
    // Keep the burst in front of the palm, outside the torso volume, so the
    // charge never looks clipped by the body from the frontal close-up.
    const chidori = new THREE.Group(); chidori.position.set(0, -.08, .38); hands[1].wrist.add(chidori); chidori.visible = false;
    const sparkGeometry = new THREE.BoxGeometry(.07, .07, .07);
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: "#96e7ff" });
    const coreMaterial = new THREE.MeshBasicMaterial({ color: "#efffff" });
    const core = new THREE.Mesh(sparkGeometry, coreMaterial); core.scale.setScalar(3); chidori.add(core);
    for (let i = 0; i < 10; i++) {
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial), angle = i * 2.4;
      spark.position.set(Math.cos(angle) * .21, Math.sin(angle) * .21, Math.sin(i * 1.7) * .15); chidori.add(spark);
    }
    // WebGL lines stay one physical pixel wide. Instanced cuboid branches remain
    // legible on mobile and share connected endpoints instead of looking severed.
    const arcGeometry = new THREE.BoxGeometry(1, 1, 1), arcMaterial = new THREE.MeshBasicMaterial({ color: "#ccf7ff" });
    const arcs = new THREE.InstancedMesh(arcGeometry, arcMaterial, 16 * 5); arcs.frustumCulled = false; chidori.add(arcs);
    const chargeLight = new THREE.PointLight("#79cde8", .75, 1.1, 2); chidori.add(chargeLight);
    // Grip at the cuff/hand, with the wooden stem below the fist and the flame
    // above it. Counter-rotate the item while the shoulder moves, not the grip.
    const torchParentRotation = new THREE.Quaternion(), torchHeading = new THREE.Quaternion();
    const torch = new THREE.Group(); torch.position.set(0, -.69, .13); rightArm.add(torch); torch.visible = false;
    block("torch", 0, -.08, 0, torch).scale.setScalar(.9);
    const torchLight = new THREE.PointLight("#ffb45e", 1.5, 2.5, 2); torchLight.position.y = .48; torch.add(torchLight);
    const branch = new THREE.Object3D(), start = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3(), delta = new THREE.Vector3(), axis = new THREE.Vector3(0, 0, 1);
    let arcTick = -1;
    function updateArcs(time: number) {
      const tick = Math.floor(time / 90); if (tick === arcTick) return; arcTick = tick;
      let index = 0;
      for (let ray = 0; ray < 16; ray++) {
        const angle = ray * 2.4; direction.set(Math.cos(angle), Math.sin(angle), Math.sin(ray * 1.7)).normalize(); start.set(0, 0, 0);
        for (let segment = 1; segment <= 5; segment++) {
          const jitter = Math.sin(ray * 11 + segment * 7 + tick) * .045;
          end.copy(direction).multiplyScalar(segment * .12); end.x += jitter; end.y -= jitter; end.z += jitter;
          delta.subVectors(end, start); const length = delta.length();
          branch.position.copy(start).add(end).multiplyScalar(.5); branch.quaternion.setFromUnitVectors(axis, delta.normalize()); branch.scale.set(.028, .028, length + .012); branch.updateMatrix();
          arcs.setMatrixAt(index++, branch.matrix); start.copy(end);
        }
      }
      arcs.instanceMatrix.needsUpdate = true;
    }
    function stop() {
      sequence?.kill(); sequence = null; activeVisit = null; container.dataset.travelling = "";
      walking = false; strideWeight = 0; chidori.visible = false; torch.visible = carryTorch;
      leverHandle.rotation.x = lampPowered ? Math.PI / 4 : -Math.PI / 4;
      rightArm.add(torch);
      grip.amount = 0; delete container.dataset.gripError; upperBody.position.y = .72; upperBody.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
      knees.forEach(({ leg, original, rig, knee }) => { leg.position.y = .72; rig.visible = false; original.forEach(mesh => { mesh.visible = true; }); knee.rotation.set(0, 0, 0); });
      limbs.forEach(({ pivot }) => { pivot.rotation.set(0, 0, 0); });
      hands.forEach(hand => { hand.rig.visible = false; hand.original.forEach(mesh => { mesh.visible = true; }); hand.elbow.rotation.set(0, 0, 0); hand.wrist.rotation.set(0, 0, 0); hand.thumb.rotation.set(0, 0, 0); hand.fingers.forEach(finger => { finger.rotation.set(0, 0, 0); }); });
      if (carryTorch) { rightArm.rotation.set(-.65, 0, .08); torch.quaternion.copy(rightArm.quaternion).invert(); }
      caption.textContent = ""; delete container.dataset.seal; callbacks.current.onTravel(null);
    }
    function walkTo(destination: { x: number; z: number }) {
      const walk = gsap.timeline(); let previousPoint = { x: actor.position.x, z: actor.position.z }, heading = actor.rotation.y;
      for (const point of workshopRoute(previousPoint, destination)) {
        const distance = Math.hypot(point.x - previousPoint.x, point.z - previousPoint.z);
        const angle = Math.atan2(point.x - previousPoint.x, point.z - previousPoint.z);
        heading = nearestHeading(heading, angle);
        walk.call(() => { walking = false; });
        walk.to(actor.rotation, { y: heading, duration: .1, ease: "none" });
        walk.call(() => { walking = true; });
        walk.to(actor.position, { x: point.x, z: point.z, duration: Math.max(.04, distance / 3.1), ease: "none" });
        previousPoint = point;
      }
      walk.call(() => { walking = false; }); return walk;
    }
    function reset() {
      if (sleeping || actor.position.y > .01 || Math.abs(actor.rotation.x) > .01) {
        sequence?.kill(); wakeUp(reset); return;
      }
      stop(); container.dataset.phase = "returning";
      if (reduced.matches) { actor.position.set(home.x, 0, home.z); actor.rotation.set(0, 0, 0); framing.zoom = 1; camera.position.set(11, 9, 13); focus.set(-.25, 1.75, -.25); chestModel.lid.rotation.x = 0; container.dataset.phase = "idle"; return; }
      sequence = gsap.timeline({ onComplete: () => { container.dataset.phase = "idle"; } });
      sequence.to(chestModel.lid.rotation, { x: 0, duration: .25 }, 0);
      sequence.to(framing, { zoom: 1, duration: .45 }, 0);
      sequence.to(camera.position, { x: 11, y: 9, z: 13, duration: .45 }, 0);
      sequence.to(focus, { x: -.25, y: 1.75, z: -.25, duration: .45 }, 0);
      sequence.add(walkTo(home), 0);
      sequence.to(actor.rotation, { y: () => nearestHeading(actor.rotation.y, 0), duration: .15 });
    }
    const bedRest = { x: stationPositions.sleep.x, y: 9 / 16 + .13, z: stationPositions.sleep.z + .92 };
    function tuckIn(instant: boolean) {
      sleeping = true; carryTorch = false; torch.visible = false;
      container.dataset.phase = "tucking";
      const finish = () => { activeVisit = null; container.dataset.phase = "sleeping"; container.dataset.travelling = ""; caption.textContent = "Zzz"; callbacks.current.onTravel(null); callbacks.current.onSleepChange(true); };
      if (instant) { actor.position.set(bedRest.x, bedRest.y, bedRest.z); actor.rotation.set(-Math.PI / 2, 0, 0); finish(); }
      else {
        sequence = gsap.timeline({ onComplete: finish });
        // First climb to the foot of the mattress, then lie face-up toward the
        // pillow. Absolute yaw keeps the pose independent of the approach.
        sequence.to(actor.rotation, { x: 0, y: () => nearestHeading(actor.rotation.y, 0), z: 0, duration: .18 });
        sequence.to(actor.position, { x: bedRest.x, y: bedRest.y, z: bedRest.z, duration: .32, ease: "power2.inOut" });
        sequence.to(actor.rotation, { x: -Math.PI / 2, duration: .42, ease: "power2.inOut" });
      }
    }
    function wakeUp(then: () => void) {
      stop(); sleeping = false; carryTorch = true; torch.visible = true; callbacks.current.onSleepChange(false);
      container.dataset.phase = "waking";
      if (reduced.matches) { actor.rotation.set(0, 0, 0); actor.position.set(approaches.sleep.x, 0, approaches.sleep.z); then(); return; }
      sequence = gsap.timeline({ onComplete: then });
      sequence.to(actor.rotation, { x: 0, y: () => nearestHeading(actor.rotation.y, 0), z: 0, duration: .32, ease: "power2.inOut" });
      sequence.to(actor.position, { x: approaches.sleep.x, y: 0, z: approaches.sleep.z, duration: .32, ease: "power2.inOut" });
    }
    function visit(id: Station) {
      if (!loaded || failed) {
        if (id === "sleep") { stop(); sleeping = true; container.dataset.travelling = ""; container.dataset.phase = "sleeping"; caption.textContent = "Zzz"; callbacks.current.onTravel(null); callbacks.current.onSleepChange(true); }
        else callbacks.current.onSelect(id);
        return;
      }
      if (id === "sleep" && sleeping) return;
      if (sleeping || actor.position.y > .01 || Math.abs(actor.rotation.x) > .01) { sequence?.kill(); wakeUp(() => visit(id)); return; }
      if (id === "sleep") {
        stop(); activeVisit = id; callbacks.current.onTravel(id); container.dataset.travelling = id; container.dataset.phase = "walking";
        if (reduced.matches) { actor.position.set(approaches.sleep.x, 0, approaches.sleep.z); activeVisit = null; tuckIn(true); return; }
        sequence = gsap.timeline();
        sequence.add(walkTo(approaches.sleep), 0);
        sequence.call(() => { walking = false; strideWeight = 0; limbs.forEach(({ pivot }) => { pivot.rotation.x = 0; }); });
        sequence.call(() => { activeVisit = null; tuckIn(false); });
        return;
      }
      startVisit(id);
    }
    function startVisit(id: Station) {
      stop(); activeVisit = id; callbacks.current.onTravel(id); container.dataset.travelling = id; container.dataset.phase = "walking";
      const target = targets.get(id)!, destination = approaches[id];
      if (reduced.matches) {
        actor.position.set(destination.x, 0, destination.z); chestModel.lid.rotation.x = id === "projects" ? -Math.PI / 2 : 0;
        stop(); container.dataset.phase = "open"; if (id === "activity") toggleLever(); if (id === "about") { callbacks.current.onSeals(); callbacks.current.onChidori(); } callbacks.current.onSelect(id); return;
      }
      sequence = gsap.timeline({ onComplete: () => {
        if (!alive || activeVisit !== id) return;
        if (id === "about") {
          // Keep the PG holding the full Chidori while the meet dialog stays
          // open. No shrink-out, no rig reset: the close-up, seals caption and
          // burst remain behind the card until reset on dialog close.
          activeVisit = null; walking = false; strideWeight = 0;
          container.dataset.phase = "open"; container.dataset.travelling = "";
          callbacks.current.onTravel(null); callbacks.current.onSelect(id); return;
        }
        stop(); container.dataset.phase = "open"; callbacks.current.onSelect(id);
      } });
      sequence.to(chestModel.lid.rotation, { x: 0, duration: .16 }, 0);
      sequence.to(framing, { zoom: 1.3, duration: .75, ease: "power2.inOut" }, 0);
      sequence.to(camera.position, { x: 11, y: 9, z: 13, duration: .75, ease: "power2.inOut" }, 0);
      sequence.to(focus, { x: target.position.x * .45, y: 1.1, z: target.position.z * .35, duration: .75, ease: "power2.inOut" }, 0);
      sequence.add(walkTo(destination), .08);
      const angle = id === "about" ? 0 : id === "activity" ? Math.PI : Math.atan2(target.position.x - destination.x, target.position.z - destination.z);
      sequence.to(actor.rotation, { y: () => nearestHeading(actor.rotation.y, angle), duration: .13 });
      sequence.call(() => { walking = false; strideWeight = 0; limbs.forEach(({ pivot }) => { pivot.rotation.x = 0; }); container.dataset.phase = "opening"; });
      if (id === "projects") sequence.to(chestModel.lid.rotation, { x: -Math.PI / 2, duration: .36, ease: "power2.out" });
      else if (id === "activity") {
        sequence.call(() => {
          container.dataset.phase = "lever"; caption.textContent = "Reach";
          hands[0].original.forEach(mesh => { mesh.visible = false; }); hands[0].rig.visible = true;
          if (carryTorch) { leftArm.add(torch); leftArm.rotation.set(-.65, 0, -.08); }
          knees.forEach(({ original, rig }) => { original.forEach(mesh => { mesh.visible = false; }); rig.visible = true; });
        });
        sequence.to(grip, { amount: 1, duration: .34, ease: "power2.out" });
        sequence.call(() => { caption.textContent = "Grip"; hands[0].fingers.forEach(finger => { finger.rotation.x = .8; }); hands[0].thumb.rotation.z = -.7; });
        sequence.to({}, { duration: .14 });
        sequence.to(leverHandle.rotation, { x: lampPowered ? -Math.PI / 4 : Math.PI / 4, duration: .42, ease: "power2.inOut" });
        sequence.call(toggleLever);
        sequence.call(() => { caption.textContent = "Click"; });
        sequence.to({}, { duration: .12 });
        sequence.call(() => { hands[0].fingers.forEach(finger => { finger.rotation.x = 0; }); hands[0].thumb.rotation.z = 0; });
        sequence.to(grip, { amount: 0, duration: .26, ease: "power2.inOut" });
      } else if (id === "about") {
        // Full-body frontal shot: the headband, gold cuffs and entire burst stay
        // inside the frame. Keep the ordinary room/rig for all other interactions.
        sequence.to(camera.position, { x: home.x, y: 1.35, z: home.z + 8, duration: .65, ease: "power2.inOut" });
        sequence.to(framing, { zoom: 3.6, duration: .65, ease: "power2.inOut" }, "<");
        sequence.to(focus, { x: home.x, y: 1.05, z: home.z, duration: .65, ease: "power2.inOut" }, "<");
        sequence.call(() => { torch.visible = false; container.dataset.phase = "seals"; hands.forEach(hand => { hand.original.forEach(mesh => { mesh.visible = false; }); hand.rig.visible = true; }); callbacks.current.onSeals(); });
        function seal(name: string, poses: { shoulder: number; wrist: number[]; curl: number[] }[]) {
          const timeline = gsap.timeline();
          timeline.call(() => { container.dataset.seal = name; caption.textContent = name; });
          hands.forEach((hand, i) => {
            const pose = poses[i], shoulder = new THREE.Euler(pose.shoulder, 0, hand.sign * .5);
            const orientation = new THREE.Quaternion().setFromEuler(shoulder).invert().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.wrist[0], pose.wrist[1], pose.wrist[2])));
            const wrist = new THREE.Euler().setFromQuaternion(orientation);
            timeline.to(hand.arm.rotation, { x: shoulder.x, y: 0, z: shoulder.z, duration: .2, ease: "power2.inOut" }, 0);
            timeline.to(hand.wrist.rotation, { x: wrist.x, y: wrist.y, z: wrist.z, duration: .2, ease: "power2.inOut" }, 0);
            hand.fingers.forEach((finger, n) => { timeline.to(finger.rotation, { x: pose.curl[n], duration: .2, ease: "power2.inOut" }, 0); });
            timeline.to(hand.thumb.rotation, { z: -hand.sign * .85, duration: .2 }, 0);
          });
          timeline.to({}, { duration: .32 }); return timeline;
        }
        // Stylised cuboid hand seals, not a human-anatomy replacement skin.
        sequence.add(seal("Ox", [{ shoulder: -1.08, wrist: [0, 0, Math.PI], curl: [0, 1.5, 1.5, 0] }, { shoulder: -1.08, wrist: [0, 0, Math.PI], curl: [0, 1.5, 1.5, 0] }]));
        sequence.add(seal("Hare", [{ shoulder: -1.08, wrist: [0, -.15, Math.PI], curl: [1.5, 1.5, 0, -.2] }, { shoulder: -1.08, wrist: [-.4, 0, -Math.PI / 2], curl: [1.6, 1.6, 1.6, 1.6] }]));
        sequence.add(seal("Monkey", [{ shoulder: -.6, wrist: [0, 0, Math.PI / 2], curl: [.35, .35, .35, .35] }, { shoulder: -1.25, wrist: [0, 0, -Math.PI / 2], curl: [.35, .35, .35, .35] }]));
        sequence.call(() => { container.dataset.phase = "chidori"; delete container.dataset.seal; caption.textContent = "Chidori"; });
        // Left hand forward-outside the torso: the burst sits in the palm,
        // fully in front of the body instead of intersecting it.
        sequence.to(leftArm.rotation, { x: -.92, y: 0, z: -.3, duration: .25 });
        sequence.to(hands[1].wrist.rotation, { x: .9, y: 0, z: 0, duration: .25 }, "<");
        sequence.to(rightArm.rotation, { x: -.15, y: 0, z: .08, duration: .25 }, "<");
        sequence.to(hands[0].wrist.rotation, { x: 0, y: 0, z: 0, duration: .25 }, "<");
        hands.forEach(hand => { hand.fingers.forEach(finger => { sequence!.to(finger.rotation, { x: 0, duration: .25 }, "<"); }); });
        sequence.call(() => { chidori.visible = true; chidori.scale.setScalar(.1); callbacks.current.onChidori(); });
        sequence.to(chidori.scale, { x: 1, y: 1, z: 1, duration: .25, ease: "power2.out" });
        // No shrink-out: the full burst stays held while the meet card is open.
        // The 1.7s supplied clip outlives this hold and ends naturally.
        sequence.to({}, { duration: 1.6 });
      } else sequence.to({}, { duration: .14 });
    }
    actions.current = { visit, reset };
    function contextLost(event: Event) {
      event.preventDefault(); const pending = activeVisit; stop(); failed = true; container.dataset.ready = "false"; renderer.domElement.style.visibility = "hidden"; onReady(false);
      if (sleeping) { sleeping = false; actor.rotation.x = 0; callbacks.current.onSleepChange(false); }
      if (pending) callbacks.current.onSelect(pending);
    }
    function contextRestored() { if (alive) { failed = false; readyNotified = false; container.dataset.ready = "false"; } }
    renderer.domElement.addEventListener("webglcontextlost", contextLost); renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let hovered: Station | null = null;
    function pick(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      let hit: THREE.Object3D | null = raycaster.intersectObjects(world.children, true)[0]?.object || null;
      while (hit && !hit.userData.station) hit = hit.parent;
      return (hit?.userData.station as Station) || null;
    }
    function move(event: PointerEvent) { hovered = (event.target as HTMLElement).closest<HTMLElement>("[data-station]")?.dataset.station as Station || pick(event); container.dataset.hovered = hovered || ""; }
    function leave() { hovered = null; container.dataset.hovered = ""; }
    function click(event: PointerEvent) { if ((event.target as HTMLElement).closest("[data-station]")) return; const id = pick(event); if (id) visit(id); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape" && !event.defaultPrevented && (activeVisit || container.dataset.phase === "waking")) reset(); }
    container.addEventListener("pointermove", move); container.addEventListener("pointerleave", leave); container.addEventListener("click", click as EventListener); window.addEventListener("keydown", escape);
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const aspect = width / Math.max(height, 1);
      camera.left = -5.4 * aspect; camera.right = 5.4 * aspect; camera.top = 5.4; camera.bottom = -5.4;
      renderer.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)), false); camera.updateProjectionMatrix(); sized = width > 0 && height > 0;
    }); resize.observe(container);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }); observer.observe(container);
    const heights: Record<Station, number> = { about: 1.4, psystream: 2.5, projects: .6, skills: .7, activity: .65, furnace: .7, contact: .9, sleep: .55, jukebox: .85 };
    const projected = new THREE.Vector3();
    function draw(time: number) {
      if (!alive) return;
      raf = requestAnimationFrame(draw);
      if (((suspension.current || !visible || document.hidden) && readyNotified) || failed || !loaded || !sized) return;
      const elapsed = Math.min((time - frame) / 1000, .1); frame = time;
      const aspect = camera.right / camera.top;
      // Fit the whole isometric room on narrow screens, not just the actor.
      camera.zoom = Math.min(framing.zoom * Math.min(1, aspect / 1.2), 5.4 * aspect / 1.35);
      camera.lookAt(focus); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const travelled = Math.hypot(actor.position.x - lastPosition.x, actor.position.z - lastPosition.z); lastPosition.copy(actor.position);
      if (walking) walkDistance += travelled;
      strideWeight = THREE.MathUtils.lerp(strideWeight, walking ? 1 : 0, Math.min(1, elapsed * 12));
      if (!["chidori", "seals", "lever"].includes(container.dataset.phase || "") && !sleeping && !reduced.matches) {
        const gait = minecraftGait(walkDistance);
        limbs.forEach(({ pivot, sign, kind }) => { pivot.rotation.x = carryTorch && pivot === rightArm ? -.65 + gait.arm * sign * strideWeight * .1 : gait[kind] * sign * strideWeight; });
        if (carryTorch) rightArm.rotation.z = .08;
      }
      if (container.dataset.phase === "lever") poseLever();
      else if (!sleeping && !reduced.matches && !["chidori", "seals"].includes(container.dataset.phase || "")) {
        const gait = minecraftGait(walkDistance);
        upperBody.position.y = .72 + Math.abs(gait.leg) * .018 * strideWeight; upperBody.rotation.x = .045 * strideWeight;
        head.rotation.x = -upperBody.rotation.x;
        const destination = activeVisit && approaches[activeVisit];
        const turn = destination ? Math.atan2(destination.x - actor.position.x, destination.z - actor.position.z) - actor.rotation.y : 0;
        head.rotation.y = THREE.MathUtils.damp(head.rotation.y, THREE.MathUtils.clamp(Math.atan2(Math.sin(turn), Math.cos(turn)), -.35, .35), 12, elapsed);
      }
      torch.quaternion.copy(torch.parent!.getWorldQuaternion(torchParentRotation)).invert().multiply(torchHeading.setFromAxisAngle(down, -actor.rotation.y));
      if (chidori.visible) updateArcs(time);
      if (insertedDisc.current !== lastRecord) {
        const next = insertedDisc.current; lastRecord = next; recordMotion?.kill(); recordMotion = null;
        if (reduced.matches) {
          record.visible = next !== null; record.position.y = .84;
          if (next !== null) recordMaterial.map = recordTextures[next];
        } else {
          recordMotion = gsap.timeline();
          if (record.visible) recordMotion.to(record.position, { y: 1.65, duration: .22, ease: "steps(4)" });
          recordMotion.call(() => {
            record.visible = next !== null;
            if (next !== null) { recordMaterial.map = recordTextures[next]; record.position.y = 1.65; }
          });
          if (next !== null) recordMotion.to(record.position, { y: .84, duration: .3, ease: "steps(5)" });
        }
      }
      container.dataset.record = lastRecord === null ? "empty" : String(lastRecord);
      container.dataset.musicPlaying = String(music.current);
      const powered = lampPowered;
      if (powered !== lastPower) { lamp.traverse(object => { if (object instanceof THREE.Mesh) object.material = powered ? lampLit : lampDark; }); lastPower = powered; }
      signalLight.intensity = powered ? 4 : 0;
      const warmth = lighting.current ? 1 : .3;
      lights.forEach(light => { light.intensity = warmth * 12; });
      furnaceLight.intensity = warmth * (hovered === "furnace" || current.current === "furnace" ? 10 : 5);
      targets.forEach((target, id) => {
        projected.set(target.position.x, heights[id], target.position.z).project(camera);
        const control = container.querySelector<HTMLElement>(`[data-station="${id}"]`);
        if (control) {
          control.style.display = Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 ? "none" : "";
          control.style.left = `${(projected.x + 1) * 50}%`; control.style.top = `${(1 - projected.y) * 50}%`;
        }
      });
      renderer.render(scene, camera);
      if (!readyNotified) { readyNotified = true; renderer.domElement.style.visibility = "visible"; container.dataset.ready = "true"; onReady(true); }
    }
    camera.lookAt(focus); raf = requestAnimationFrame(draw);
    return () => {
      alive = false; sequence?.kill(); recordMotion?.kill(); actions.current = null; cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect();
      container.removeEventListener("pointermove", move); container.removeEventListener("pointerleave", leave); container.removeEventListener("click", click as EventListener); window.removeEventListener("keydown", escape);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost); renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      sparkGeometry.dispose(); sparkMaterial.dispose(); coreMaterial.dispose(); arcs.dispose(); arcGeometry.dispose(); arcMaterial.dispose();
      paintingGeometry.dispose(); paintingMaterial.dispose();
      recordGeometry.dispose(); recordMaterial.dispose();
      bookGeometry.dispose(); bookMaterial.dispose(); dustGeometry.dispose(); dustMaterial.dispose(); skinMaterial.dispose(); assets.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [onReady]);

  return <div className="voxel-canvas" ref={host} role="group" aria-label="Interactive Minecraft workshop room">
    {labels.map(([id, label]) => <button key={id} data-station={id} className="world-hotspot" aria-label={label} aria-haspopup={id === "sleep" || id === "jukebox" ? undefined : "dialog"} onClick={() => actions.current?.visit(id)}><span>{label}</span></button>)}
    <span className="jutsu-caption" aria-hidden="true" />
  </div>;
}
