import * as THREE from "three";
import rawModels from "./minecraft-models.json";
import { skinFaces, skinSliceFaces } from "./skin-uv";

type Face = { texture: string; uv?: number[]; rotation?: number };
type Element = { from: number[]; to: number[]; faces: Record<string, Face>; rotation?: { origin: number[]; axis: "x" | "y" | "z"; angle: number; rescale?: boolean } };
const models = rawModels as Record<string, { elements: Element[] }>;
const directions = ["east", "west", "up", "down", "south", "north"];

export function minecraftAssets(onReady: () => void, onError: () => void) {
  const manager = new THREE.LoadingManager(onReady, undefined, onError);
  const loader = new THREE.TextureLoader(manager);
  const textures = new Map<string, THREE.Texture>();
  const materials = new Map<string, THREE.MeshLambertMaterial>();
  const geometries = new Set<THREE.BufferGeometry>();
  const invisible = new THREE.MeshLambertMaterial({ visible: false });
  function texture(path: string) {
    if (!textures.has(path)) {
      const tex = loader.load(path, value => {
        // Vanilla animated textures are vertical strips. Sample the first square frame.
        const image = value.image as HTMLImageElement;
        value.repeat.y = image.width / image.height;
        value.offset.y = 1 - value.repeat.y;
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
      textures.set(path, tex);
    }
    return textures.get(path)!;
  }
  function material(name: string) {
    if (!materials.has(name)) materials.set(name, new THREE.MeshLambertMaterial({ map: texture(`/minecraft/${name}.png`), alphaTest: .1 }));
    return materials.get(name)!;
  }
  function geometry(w: number, h: number, d: number) {
    const geo = new THREE.BoxGeometry(w, h, d); geometries.add(geo); return geo;
  }
  function block(name: string, height = 1) {
    const group = new THREE.Group(); group.userData.model = name;
    for (const element of models[name].elements) {
      const size = element.to.map((value, i) => (value - element.from[i]) / 16);
      const geo = geometry(size[0], size[1] * height, size[2]);
      const uv = geo.getAttribute("uv");
      const mats = directions.map((direction, faceIndex) => {
        const face = element.faces[direction];
        if (!face) return invisible;
        const [u0, v0, u1, v1] = face.uv || [0, 0, 16, 16];
        const angle = (face.rotation || 0) * Math.PI / 180;
        for (let i = 0; i < 4; i++) {
          const index = faceIndex * 4 + i;
          const x = uv.getX(index) - .5, y = (1 - uv.getY(index)) - .5;
          const u = x * Math.cos(angle) - y * Math.sin(angle) + .5;
          const mappedV = x * Math.sin(angle) + y * Math.cos(angle) + .5;
          // Short floor courses crop side pixels instead of squashing a whole block.
          const v = direction === "up" || direction === "down" ? mappedV : 1 - height + mappedV * height;
          uv.setXY(index, (u0 + u * (u1 - u0)) / 16, 1 - (v0 + v * (v1 - v0)) / 16);
        }
        return material(face.texture);
      });
      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set((element.from[0] + element.to[0]) / 32 - .5, (element.from[1] + element.to[1]) / 32 * height, (element.from[2] + element.to[2]) / 32 - .5);
      if (element.rotation) {
        const rotation = element.rotation, pivot = new THREE.Group();
        pivot.position.set(rotation.origin[0] / 16 - .5, rotation.origin[1] / 16, rotation.origin[2] / 16 - .5);
        mesh.position.sub(pivot.position); pivot.rotation[rotation.axis] = THREE.MathUtils.degToRad(rotation.angle);
        if (rotation.rescale) for (const axis of ["x", "y", "z"] as const) if (axis !== rotation.axis) pivot.scale[axis] = 1 / Math.cos(pivot.rotation[rotation.axis]);
        pivot.add(mesh); group.add(pivot);
      } else group.add(mesh);
    }
    return group;
  }
  function atlasBox(w: number, h: number, d: number, u: number, v: number, mat: THREE.Material, scale = 1 / 16, expansion = 0) {
    const geo = geometry((w + expansion) * scale, (h + expansion) * scale, (d + expansion) * scale);
    const uv = geo.getAttribute("uv");
    skinFaces(u, v, w, h, d).forEach(([sx, sy, sw, sh], face) => {
      for (let i = 0; i < 4; i++) {
        const index = face * 4 + i;
        uv.setXY(index, (sx + uv.getX(index) * sw) / 64, 1 - (sy + (1 - uv.getY(index)) * sh) / 64);
      }
    });
    return new THREE.Mesh(geo, mat);
  }
  function atlasSlice(u: number, v: number, from: number[], to: number[], mat: THREE.Material, scale: number) {
    const geo = geometry((to[0] - from[0]) * scale, (to[1] - from[1]) * scale, (to[2] - from[2]) * scale);
    const uv = geo.getAttribute("uv");
    skinSliceFaces(u, v, 4, 12, 4, from, to).forEach(([sx, sy, sw, sh], face) => {
      for (let i = 0; i < 4; i++) {
        const index = face * 4 + i;
        uv.setXY(index, (sx + uv.getX(index) * sw) / 64, 1 - (sy + (1 - uv.getY(index)) * sh) / 64);
      }
    });
    return new THREE.Mesh(geo, mat);
  }
  function bed() {
    // Vanilla BedRenderer: two 16×16×6 entity cubes, rotated onto the floor,
    // four 3×3×3 legs. The pillow is in the atlas, not an extra wooden headboard.
    // Reference: net/minecraft/client/renderer/blockentity/BedRenderer.java.
    const group = new THREE.Group(); group.userData.model = "bed";
    const cloth = material("bed-red");
    for (const [v, z] of [[0, -.5], [22, .5]]) {
      const half = atlasBox(16, 16, 6, 0, v, cloth);
      // Keep nearest-filtered face edges inside their atlas rectangle: the
      // blanket/pillow must not borrow a row from the adjacent wooden underside.
      const uv = half.geometry.getAttribute("uv");
      skinFaces(0, v, 16, 16, 6).forEach(([sx, sy, sw, sh], face) => {
        for (let i = 0; i < 4; i++) {
          const index = face * 4 + i;
          uv.setXY(index, THREE.MathUtils.clamp(uv.getX(index), (sx + .5) / 64, (sx + sw - .5) / 64), THREE.MathUtils.clamp(uv.getY(index), 1 - (sy + sh - .5) / 64, 1 - (sy + .5) / 64));
        }
      });
      half.rotation.x = -Math.PI / 2; half.position.set(0, 6 / 16, z); group.add(half);
    }
    for (const [x, z, v] of [[-6.5, -14.5, 6], [6.5, -14.5, 18], [-6.5, 14.5, 0], [6.5, 14.5, 12]]) {
      const leg = atlasBox(3, 3, 3, 50, v, cloth);
      leg.position.set(x / 16, 1.5 / 16, z / 16); group.add(leg);
    }
    return group;
  }
  function chest() {
    // Vanilla chest is a block entity, not a cube block JSON: 14x10x14 base,
    // 14x5x14 lid, 2x4x1 latch, with the game's 64x64 entity atlas.
    const group = new THREE.Group(); group.userData.model = "chest";
    const mat = material("chest");
    const bottom = atlasBox(14, 10, 14, 0, 19, mat); bottom.position.y = 5 / 16; group.add(bottom);
    const lid = new THREE.Group(); lid.position.set(0, 9 / 16, -7 / 16); group.add(lid);
    const top = atlasBox(14, 5, 14, 0, 0, mat); top.position.set(0, 2.5 / 16, 7 / 16); lid.add(top);
    // The framed inset panel belongs under the lid (shadowed underside when
    // open). The plain outer panel belongs on top so a closed chest reads
    // solid instead of hollow.
    const uv = top.geometry.getAttribute("uv");
    for (let i = 0; i < 4; i++) {
      const a = 2 * 4 + i, b = 3 * 4 + i, x = uv.getX(a), y = uv.getY(a);
      uv.setXY(a, uv.getX(b), uv.getY(b)); uv.setXY(b, x, y);
    }
    const latch = atlasBox(2, 4, 1, 0, 0, mat); latch.position.set(0, 0, 14.5 / 16); lid.add(latch);
    return { group, lid };
  }
  return { block, chest, bed, texture, material, atlasBox, atlasSlice, dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); invisible.dispose(); } };
}
