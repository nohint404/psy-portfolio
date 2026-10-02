// Capture the SAME chest entity/atlas as the room. No guessed isometric drawings.
// Requires the dev server on localhost:3000 and agent-browser.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";
const root = fileURLToPath(new URL("../", import.meta.url));
const scratch = path.join(root, "public/__chest-capture");
const browser = (...args) => execFileSync("agent-browser", ["--session", "chest-art", ...args], { encoding: "utf8", maxBuffer: 2e6 });
fs.mkdirSync(scratch);
try {
  for (const file of ["three.module.js", "three.core.js"]) fs.copyFileSync(path.join(root, "node_modules/three/build", file), path.join(scratch, file));
  for (const name of ["minecraft", "skin-uv"]) {
    let source = fs.readFileSync(path.join(root, `lib/${name}.ts`), "utf8");
    source = source.replace('from "three"', 'from "./three.module.js"').replace('from "./skin-uv"', 'from "./skin-uv.js"');
    source = source.replace('import rawModels from "./minecraft-models.json";', `const rawModels = ${fs.readFileSync(path.join(root, "lib/minecraft-models.json"), "utf8")};`);
    fs.writeFileSync(path.join(scratch, `${name}.js`), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
  }
  fs.writeFileSync(path.join(scratch, "index.html"), `<!doctype html><html><body><script type="module">
import * as THREE from './three.module.js';import {minecraftAssets} from './minecraft.js';
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(96,96);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.AmbientLight('#fff5dd',2));const light=new THREE.DirectionalLight('#fff8eb',2);light.position.set(3,6,5);scene.add(light);
const camera=new THREE.OrthographicCamera(-.98,.98,.98,-.98,.1,20);camera.position.set(3,2.5,4);camera.lookAt(0,.65,0);
const sheet=document.createElement('canvas');sheet.width=960;sheet.height=96;const ctx=sheet.getContext('2d');
const assets=minecraftAssets(()=>{for(let i=0;i<10;i++){chest.lid.rotation.x=-Math.PI/2*i/9;renderer.render(scene,camera);ctx.drawImage(renderer.domElement,i*96,0);if(i===0)window.closedChest=renderer.domElement.toDataURL('image/png');}window.chestSheet=sheet.toDataURL('image/png');window.openChest=renderer.domElement.toDataURL('image/png');window.captureReady=true},()=>{window.captureError=true});
const chest=assets.chest();scene.add(chest.group);
</script></body></html>`);
  browser("open", "http://localhost:3000/__chest-capture/index.html");
  browser("wait", "--fn", "window.captureReady === true");
  for (const [name, variable] of [["chest", "closedChest"], ["chest-open", "openChest"], ["chest-sprites", "chestSheet"]]) {
    const result = JSON.parse(browser("eval", `window.${variable}`, "--json"));
    const encoded = result.data.result;
    if (!encoded.startsWith("data:image/png;base64,")) throw Error("Invalid capture");
    fs.writeFileSync(path.join(root, `public/art/${name}.png`), Buffer.from(encoded.split(",")[1], "base64"));
    fs.writeFileSync(path.join(root, `public/art/${name}.png.provenance.json`), JSON.stringify({ origin: "Rendered vanilla chest entity, closed/open hinged frames", source: ["scripts/make-chest-sprites.mjs", "lib/minecraft.ts", "public/minecraft/chest.png"], frames: name === "chest-sprites" ? 10 : 1, rights: "Minecraft chest texture belongs to Mojang/Microsoft; see public/minecraft/provenance.json" }, null, 2) + "\n");
  }
  console.log("Captured closed/open chest and 10-frame sprite sheet.");
} finally { browser("close"); fs.rmSync(scratch, { recursive: true, force: true }); }
