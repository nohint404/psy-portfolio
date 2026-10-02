"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { resumeAudio } from "@/lib/workshop-audio";
import { SAVE_KEY, readSave, movePlayer, interact, mine, build, cast, collectScroll, stepEnemies, stepProjectiles, craft, heal, dash, recipes, objectives, maxHp, materials, recall, streamWorld, advanceWorld, daylight, type GameState, type Material, type Jutsu, type RecipeId } from "@/lib/ninja-game";
import { drawWorld, drawIntro, drawMap } from "@/lib/ninja-render";
import type { SpriteMotion } from "@/lib/ninja-motion";
import Icon from "./PixelIcon";
import "./NinjaDream.css";

type Action = "kunai" | "chakra" | "mine" | "build" | "eye" | "scroll" | "heal" | "dash" | "recall" | "recover";
const keys: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
const actionKeys: Record<string, Action> = { j: "kunai", k: "chakra", e: "mine", q: "build", " ": "eye", Enter: "scroll", h: "heal", l: "dash", r: "recall", x: "recover" };

export default function NinjaDream({ sound, intro = true, onClose }: { sound: boolean; intro?: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<"intro" | "game">(intro ? "intro" : "game");
  const [message, setMessage] = useState("Explore beyond the village: terrain keeps growing in every direction. E gathers / talks, Q builds, I opens recipes and maps. Tap the world to aim; R recalls your camp.");
  const [stats, setStats] = useState({ hp: 6, maxLife: 6, chakra: 100, wood: 8, stone: 4, herb: 0, ore: 0, medicine: 1, scrolls: 0 });
  const [material, setMaterial] = useState<Material>("wood"), materialRef = useRef<Material>("wood");
  const [jutsu, setJutsu] = useState<Jutsu>("fire"), jutsuRef = useRef<Jutsu>("fire");
  const [journal, setJournal] = useState(false), journalRef = useRef(false), journalPause = useRef(false);
  const [journalPage, setJournalPage] = useState<"bag" | "quests" | "map">("bag");
  const [moreTools, setMoreTools] = useState(false);
  const [mapMode, setMapMode] = useState<"local" | "village" | "atlas">("local");
  const [pendingImport, setPendingImport] = useState<GameState | null>(null);
  const importFile = useRef<HTMLInputElement>(null), importGeneration = useRef(0), externalWrite = useRef(false);
  const journalClose = useRef<HTMLButtonElement>(null);
  const [muted, setMuted] = useState(!sound);
  const [paused, setPaused] = useState(false), pausedRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState("Loading your world…");
  const screen = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const attachCanvas = useCallback((node: HTMLCanvasElement | null) => { canvas.current = node; setCanvasElement(node); }, []);
  const state = useRef<GameState | null>(null), skin = useRef<HTMLImageElement | null>(null);
  const audio = useRef<AudioContext | null>(null), notes = useRef<OscillatorNode[]>([]);
  const clips = useRef(new Map<string, Promise<AudioBuffer>>()), samples = useRef<AudioBufferSourceNode[]>([]), soundGeneration = useRef(0);
  const held = useRef(new Set<string>()), freezeLeft = useRef(0);
  const motions = useRef(new Map<string, SpriteMotion>()), gesture = useRef<{ kind: string; started: number } | undefined>(undefined);
  const lastAction = useRef(0), lastMove = useRef(0), dirty = useRef(false), soundOn = useRef(sound);
  const stopSound = useCallback(() => {
    soundGeneration.current++;
    [...notes.current, ...samples.current].forEach(node => { try { node.stop(); } catch { /* Already ended. */ } });
    notes.current = []; samples.current = [];
  }, []);
  const playClip = useCallback((name: "itachi-mangekyo" | "sharingan", delay = 0) => {
    if (!soundOn.current) return;
    try {
      const context = resumeAudio(audio), generation = soundGeneration.current, start = context.currentTime + delay;
      if (!clips.current.has(name)) clips.current.set(name, fetch(`/audio/${name}.mp3`).then(response => {
        if (!response.ok) throw new Error("Dream audio unavailable"); return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).catch(error => { clips.current.delete(name); throw error; }));
      void clips.current.get(name)!.then(buffer => {
        if (!soundOn.current || generation !== soundGeneration.current || context.state === "closed") return;
        const source = context.createBufferSource(), gain = context.createGain(); source.buffer = buffer;
        gain.gain.value = name === "itachi-mangekyo" ? .45 : .2; source.connect(gain); gain.connect(context.destination); samples.current.push(source);
        source.onended = () => { source.disconnect(); gain.disconnect(); samples.current = samples.current.filter(node => node !== source); };
        source.start(Math.max(start, context.currentTime));
      }).catch(() => { /* Optional audio never gates the transition or game. */ });
    } catch { /* Muted, unavailable or closed audio never blocks play. */ }
  }, []);
  const tone = useCallback((ritual = false) => {
    if (!soundOn.current) return;
    if (ritual) { playClip("sharingan"); return; }
    try {
      const context = resumeAudio(audio);
      const frequencies = [330, 440];
      frequencies.forEach((frequency, i) => {
        const node = context.createOscillator(), gain = context.createGain(), start = context.currentTime + i * .045, length = .1;
        node.type = "square"; node.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(.018, start + .02); gain.gain.exponentialRampToValueAtTime(.0001, start + length);
        node.connect(gain); gain.connect(context.destination); notes.current.push(node);
        node.onended = () => { node.disconnect(); gain.disconnect(); notes.current = notes.current.filter(n => n !== node); };
        node.start(start); node.stop(start + length);
      });
    } catch { /* Audio never gates the game. */ }
  }, [playClip]);
  const save = useCallback(() => {
    if (!state.current || externalWrite.current) return;
    state.current.savedAt = Math.min(Number.MAX_SAFE_INTEGER - 1, Math.max(Date.now(), state.current.savedAt + 1));
    const value = JSON.stringify(state.current); let persistent = false, tab = false;
    try { localStorage.setItem(SAVE_KEY, value); persistent = true; } catch { /* Try the existing tab save next. */ }
    try { sessionStorage.setItem(SAVE_KEY, value); tab = true; } catch { /* A downloadable backup remains available. */ }
    if (persistent || tab) dirty.current = false;
    setSaveStatus(persistent ? "Saved on this device" : tab ? "Tab-only save · export a permanent copy" : "Storage full / blocked · export your world in Bag");
  }, []);
  const syncStats = useCallback(() => {
    const s = state.current;
    if (s) setStats({ hp: s.hp, maxLife: maxHp(s), chakra: Math.floor(s.chakra), wood: s.wood, stone: s.stone, herb: s.inventory.herb, ore: s.inventory.ore, medicine: s.inventory.medicine, scrolls: s.scrolls.length });
  }, []);
  const finishIntro = useCallback(() => { stopSound(); setPhase("game"); }, [stopSound]);
  const leave = useCallback(() => { save(); stopSound(); if (document.fullscreenElement === screen.current) void document.exitFullscreen().catch(() => {}); onClose(); }, [save, stopSound, onClose]);
  const togglePause = useCallback(() => {
    if (journalRef.current) return;
    pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); held.current.clear(); stopSound(); save(); canvas.current?.focus();
  }, [save, stopSound]);
  const toggleJournal = useCallback(() => {
    const open = !journalRef.current;
    journalRef.current = open; setJournal(open); held.current.clear();
    if (open) { journalPause.current = pausedRef.current; pausedRef.current = true; stopSound(); }
    else { pausedRef.current = journalPause.current; canvas.current?.focus(); }
    setPaused(pausedRef.current); syncStats(); save();
  }, [save, syncStats, stopSound]);
  const act = useCallback((action: Action) => {
    const s = state.current, now = performance.now();
    if (!s || pausedRef.current || now - lastAction.current < 220) return;
    lastAction.current = now; gesture.current = { kind: action, started: now };
    let text = "";
    if (action === "mine") text = interact(s);
    else if (action === "recover") text = mine(s);
    else if (action === "build") text = build(s, materialRef.current);
    else if (action === "scroll") text = collectScroll(s);
    else if (action === "heal") text = heal(s);
    else if (action === "dash") text = dash(s);
    else if (action === "recall") text = recall(s);
    else if (action === "eye") {
      if (s.scrolls.length < 3) text = "Find all three scrolls to awaken Mangekyo. Your journal map marks the shrines.";
      else if (s.chakra < 50) text = "The eye needs 50 chakra.";
      else { s.chakra -= 50; freezeLeft.current = 5; text = "Tsukuyomi! Enemies and their projectiles frozen for 5 seconds."; tone(true); }
    } else text = cast(s, action === "chakra" ? jutsuRef.current : "kunai");
    setMessage(text); dirty.current = true; syncStats(); save(); canvas.current?.focus();
    if (action !== "eye") tone();
  }, [save, syncStats, tone]);
  function make(id: RecipeId) {
    if (!state.current) return;
    setMessage(craft(state.current, id)); dirty.current = true; syncStats(); save(); tone();
  }
  function changeSound() { const enabled = muted; soundOn.current = enabled; setMuted(!enabled); if (!enabled) stopSound(); else if (phase === "intro") playClip("itachi-mangekyo"); else tone(); }
  function fullscreen() { if (screen.current?.requestFullscreen) void screen.current.requestFullscreen().catch(() => setMessage("Fullscreen is unavailable here. The game already fills the page.")); }
  function touchMove(key: string, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); canvas.current?.focus();
    if (pausedRef.current || !state.current) return;
    movePlayer(state.current, ...keys[key]); dirty.current = true; lastMove.current = performance.now(); held.current.add(key);
  }

  function aim(event: React.PointerEvent<HTMLCanvasElement>) {
    const s = state.current; if (!s || pausedRef.current || phase !== "game") return;
    const rect = event.currentTarget.getBoundingClientRect(), dx = (event.clientX - rect.left - 4) / (rect.width - 8) * 320 - 168, dy = (event.clientY - rect.top - 4) / (rect.height - 8) * 240 - 120;
    s.facing = Math.abs(dx) >= Math.abs(dy) ? [dx < 0 ? -1 : 1, 0] : [0, dy < 0 ? -1 : 1]; dirty.current = true; event.currentTarget.focus();
  }
  function exportWorld() {
    if (!state.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.current)], { type: "application/json" })), link = document.createElement("a");
    link.href = url; link.download = `shinobi-world-${state.current.world.seed}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("World exported. Keep this file to restore your builds, crops, quests and discoveries on another device.");
  }
  async function previewImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0], generation = ++importGeneration.current; event.currentTarget.value = ""; if (!file) return;
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error("This file exceeds the 32 MB import limit. Your current world was not changed.");
      const value = await file.text(), imported = readSave(value, true);
      if (generation !== importGeneration.current) return;
      setPendingImport(imported); setMessage("Import checked. Export your current world first if you want to keep both, then choose Replace world or Cancel.");
    } catch (error) { if (generation === importGeneration.current) { setPendingImport(null); setMessage(error instanceof Error ? error.message : "Could not read this file. Your current world was not changed."); } }
  }
  function acceptImport() {
    if (!pendingImport) return;
    externalWrite.current = false; motions.current.clear(); gesture.current = undefined; state.current = pendingImport; streamWorld(pendingImport); setPendingImport(null); freezeLeft.current = 0; held.current.clear(); stopSound(); dirty.current = true; syncStats(); save(); setMessage("World imported. Close your journal to continue exploring.");
  }
  function villageRecall() { if (!state.current) return; setMessage(recall(state.current, true)); dirty.current = true; syncStats(); save(); }

  useEffect(() => {
    const pendingRequests = importGeneration;
    let restored: GameState | null = null, invalid = false;
    for (const get of [() => localStorage.getItem(SAVE_KEY), () => sessionStorage.getItem(SAVE_KEY)]) {
      try { const value = get(); if (value) { try { const candidate = readSave(value, true); if (!restored || candidate.savedAt > restored.savedAt) restored = candidate; } catch { invalid = true; } } } catch { /* Storage may be unavailable; try the tab backup. */ }
    }
    state.current = restored ?? readSave(null); streamWorld(state.current);
    if (restored || !invalid) save();
    else { externalWrite.current = true; setSaveStatus("Unreadable save · original kept"); setMessage("The stored world could not be read and was not overwritten. You can explore a fresh world, export it in Bag, then import that file to replace the unreadable save."); }
    const otherTab = (event: StorageEvent) => { if (event.key !== SAVE_KEY && event.key !== null) return; externalWrite.current = true; pausedRef.current = true; journalPause.current = true; setPaused(true); held.current.clear(); stopSound(); setSaveStatus("Updated in another tab · export this copy"); setMessage("Another tab changed this world. Export your copy in Bag, then reload to use the newer save. This tab will not overwrite it."); };
    window.addEventListener("storage", otherTab);
    const image = new Image(); image.src = "/art/psymariux-skin.png"; skin.current = image;
    const pagehide = () => save(); window.addEventListener("pagehide", pagehide);
    const loseFocus = () => { held.current.clear(); stopSound(); save(); }; window.addEventListener("blur", loseFocus); document.addEventListener("visibilitychange", loseFocus);
    return () => {
      save(); stopSound(); const context = audio.current; audio.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
      pendingRequests.current++; window.removeEventListener("storage", otherTab); window.removeEventListener("pagehide", pagehide); window.removeEventListener("blur", loseFocus); document.removeEventListener("visibilitychange", loseFocus);
    };
  }, [save, stopSound]);

  useEffect(() => {
    const target = canvasElement, ctx = target?.getContext("2d"); if (!target || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now(), pressed = held.current;
    let raf = 0, last = started, enemyTime = 0, projectileTime = 0, hudTime = 0, saveTime = 0, tick = 0;
    if (phase === "intro") { if (!reduced) { playClip("itachi-mangekyo"); playClip("sharingan", 1.9); } }
    else { target.focus(); syncStats(); }
    const keydown = (event: KeyboardEvent) => {
      if (phase !== "game" || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const control = event.target as HTMLElement;
      if (key === "i" && !event.repeat && !["SELECT", "INPUT", "TEXTAREA"].includes(control.tagName)) { event.preventDefault(); toggleJournal(); return; }
      if (event.target !== target || journalRef.current) return;
      if (key === "p" && !event.repeat) { event.preventDefault(); togglePause(); }
      else if (keys[key]) {
        event.preventDefault();
        if (!pausedRef.current && !event.repeat && state.current) { movePlayer(state.current, ...keys[key]); dirty.current = true; lastMove.current = performance.now(); }
        if (!pausedRef.current) held.current.add(key);
      } else if (actionKeys[key]) { event.preventDefault(); if (!event.repeat) act(actionKeys[key]); }
    };
    const keyup = (event: KeyboardEvent) => { held.current.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key); };
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
    function draw(now: number) {
      if (!ctx || !target || !skin.current || !state.current) return;
      raf = requestAnimationFrame(draw);
      const dt = Math.min((now - last) / 1000, .05); last = now;
      if (document.hidden) return;
      if (phase === "intro") {
        const t = (now - started) / 1000; drawIntro(ctx, skin.current, state.current, t, reduced);
        if (t > (reduced ? .2 : 4.25)) finishIntro();
        return;
      }
      const s = state.current;
      if (!pausedRef.current) {
        advanceWorld(s, dt); streamWorld(s);
        if (now - lastMove.current > 115) {
          const key = [...held.current].at(-1), direction = key && keys[key];
          if (direction) { movePlayer(s, ...direction); dirty.current = true; lastMove.current = now; }
        }
        freezeLeft.current = Math.max(0, freezeLeft.current - dt);
        s.chakra = Math.min(100, s.chakra + dt * 5);
        enemyTime += dt; projectileTime += dt; hudTime += dt; saveTime += dt;
        if (projectileTime > .11) { projectileTime = 0; if (s.projectiles.length) { const msg = stepProjectiles(s, freezeLeft.current > 0); if (msg) setMessage(msg); dirty.current = true; } }
        if (enemyTime > .75) { enemyTime = 0; if (freezeLeft.current <= 0) { const msg = stepEnemies(s, tick++); if (msg) setMessage(msg); dirty.current = true; } }
        if (hudTime > .25) { hudTime = 0; syncStats(); }
        if (saveTime > 2) { saveTime = 0; if (dirty.current) save(); }
      }
      drawWorld(ctx, s, skin.current, now, held.current.size > 0, reduced || pausedRef.current, freezeLeft.current, motions.current, gesture.current);
      if (pausedRef.current && !journalRef.current) { ctx.fillStyle = "#24364a"; ctx.fillRect(96, 94, 128, 39); ctx.fillStyle = "#f6e4b3"; ctx.font = "19px 'Pixelify Sans', monospace"; ctx.textAlign = "center"; ctx.fillText("Paused", 160, 119); }
    }
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); pressed.clear(); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); stopSound(); };
  }, [canvasElement, phase, act, finishIntro, save, syncStats, tone, playClip, stopSound, togglePause, toggleJournal]);

  useEffect(() => { if (journal) journalClose.current?.focus(); }, [journal]);

  const world = state.current;
  return <Dialog.Root open onOpenChange={open => { if (!open) leave(); }}><Dialog.Portal><Dialog.Overlay className="dream-overlay" /><Dialog.Content className="ninja-dream" ref={screen} aria-describedby="dream-description" onOpenAutoFocus={event => { event.preventDefault(); canvas.current?.focus(); }} onEscapeKeyDown={event => { if (journalRef.current) { event.preventDefault(); toggleJournal(); } }}>
    <header className="dream-header"><div><Dialog.Title>{phase === "intro" ? "The hidden dream" : <><span className="dream-title-prefix">Psy · </span>Shinobi sandbox</>}</Dialog.Title><span title={phase === "game" ? saveStatus : undefined}>{phase === "intro" ? "Psymariux / Mangekyo Sharingan" : saveStatus}</span></div><div className="dream-header-actions"><button className="icon-button" onClick={changeSound} aria-label={muted ? "Enable game sound" : "Mute game sound"} aria-pressed={!muted}><Icon name={muted ? "volume-x" : "volume-2"} /></button><button className="dream-button fullscreen-button" onClick={fullscreen}>Fullscreen</button><button className="dream-button dream-exit" onClick={leave}>Portfolio <Icon name="close" /></button></div></header>
    <Dialog.Description id="dream-description" className="sr-only">Explore a procedurally generated pixel ninja world without map borders. Tap the world to aim without moving. R recalls your camp. WASD or arrows move, J throws kunai, K casts the selected jutsu, E talks, rests, mines or collects a scroll, Q builds, L dashes, H heals, I opens your inventory, quests and map. Space freezes enemies after three scrolls. Escape closes your bag or saves and returns to the portfolio. Touch controls are available.</Dialog.Description>
    {phase === "game" && <div className="dream-hud"><span aria-label={`Health ${stats.hp} of ${stats.maxLife}`}>Life <b>{"♥".repeat(stats.hp)}<i>{"♡".repeat(stats.maxLife - stats.hp)}</i></b></span><span>Chakra <meter min={0} max={100} value={stats.chakra} aria-label="Chakra" /><b>{stats.chakra}</b></span><span>Wood <b>{stats.wood}</b> / Stone <b>{stats.stone}</b> / Ore <b>{stats.ore}</b></span><span>Scrolls <b>{stats.scrolls}/3</b> · Day <b>{world ? Math.floor(world.elapsed / 240) + 1 : 1}</b> · {world && !daylight(world) ? "Moonrise" : "Daylight"}</span></div>}
    <div className={`dream-viewport ${phase === "intro" ? "dream-intro" : ""}`}><canvas ref={attachCanvas} width={320} height={240} onPointerDown={aim} tabIndex={journal ? -1 : 0} aria-label={phase === "intro" ? "Psymariux awakens Itachi’s Mangekyo Sharingan" : "Procedural ninja world. WASD or arrows move; tap to aim. E interacts, Q builds, R recalls your camp. I opens recipes and maps."} />{phase === "intro" && <button className="dream-button intro-skip" onClick={finishIntro}>Skip / Play</button>}
      {journal && world && <section className="dream-journal" aria-labelledby="journal-heading"><div className="journal-heading"><h3 id="journal-heading">Shinobi field journal</h3><button className="dream-button" ref={journalClose} onClick={toggleJournal}>Close <kbd>I / Esc</kbd></button></div><div className="journal-tabs" role="group" aria-label="Journal pages">{[["bag", "Bag / recipes"], ["quests", "Quests"], ["map", "World map"]].map(([id, label]) => <button key={id} className="dream-button" aria-pressed={journalPage === id} onClick={() => setJournalPage(id as typeof journalPage)}>{label}</button>)}</div>
        <p className="journal-message" role="status">{message}</p>
        {journalPage === "bag" && <><dl className="dream-inventory">{[["Wood", world.wood], ["Stone", world.stone], ["Herbs", world.inventory.herb], ["Ore", world.inventory.ore], ["Medicine", world.inventory.medicine], ["Bridges", world.inventory.bridge], ["Fences", world.inventory.fence], ["Lanterns", world.inventory.lantern], ["Campfires", world.inventory.campfire], ["Herb seeds", world.inventory.garden]].map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}</dl><h4>Crafting recipes</h4><div className="dream-recipes">{recipes.map(r => { const owned = (r.id === "armor" || r.id === "kunai") && world.upgrades.includes(r.id); const enough = Object.entries(r.cost).every(([key, count]) => (key === "wood" ? world.wood : key === "stone" ? world.stone : world.inventory[key as keyof typeof world.inventory]) >= count); return <div className="dream-recipe" key={r.id}><div><strong>{r.name}{r.amount > 1 ? ` ×${r.amount}` : ""}</strong><span>{Object.entries(r.cost).map(([name, count]) => `${count} ${name}`).join(" + ")}</span><small>{r.note}</small></div><button className="dream-button" disabled={owned || !enough} onClick={() => make(r.id)} aria-label={`Craft ${r.name}`}>{owned ? "Equipped" : "Craft"}</button></div>; })}</div></>}
        {journalPage === "bag" && <section className="dream-world-save" aria-labelledby="world-save-heading"><h4 id="world-save-heading">Keep your world</h4><p>{saveStatus}. Export a file before clearing browser data or moving to another device.</p><div className="journal-tabs"><button className="dream-button" onClick={exportWorld}>Export world</button><button className="dream-button" onClick={() => importFile.current?.click()}>Import world</button><input type="file" accept=".json,application/json" ref={importFile} hidden onChange={previewImport} aria-label="Import world save file" /></div>{pendingImport && <div className="world-import-review"><p>Seed {pendingImport.world.seed} · {Object.keys(pendingImport.world.explored).length} explored chunks · position {pendingImport.x},{pendingImport.y}. Replacing discards your current in-game world; export it first to keep both.</p><div className="journal-tabs"><button className="dream-button" onClick={acceptImport}>Replace world</button><button className="dream-button" onClick={() => { setPendingImport(null); setMessage("Import canceled. Your current world is unchanged."); }}>Cancel import</button></div></div>}</section>}
        {journalPage === "quests" && <><ol className="dream-quests">{objectives(world).map(q => <li key={q.title} data-complete={q.done}><strong><span>{q.done ? "✓" : "○"}</span>{q.title}</strong><p>{q.detail}</p></li>)}</ol><h4>Beyond the village</h4><p className="journal-note">{Object.keys(world.world.explored).length} chunks explored · {world.totals.built} blocks placed · {world.totals.harvested} harvests · {world.totals.defeated} enemies defeated.</p><p className="journal-note">Follow trails through fields, forests, marshes, dunes and highlands. Clear ruin guards for supplies. Craft a campfire, place it with Q and rest with E to set a new respawn. X recovers blocks and campfires. Plant herb seeds, let them grow for 45 active seconds, then harvest herbs and a seed to plant again. The village quests unlock jutsu; they don’t end your world.</p></>}
        {journalPage === "map" && <div className="dream-map"><div className="journal-tabs" role="group" aria-label="Map views">{[["local", "Nearby"], ["village", "Village"], ["atlas", "Explored atlas"]].map(([id, label]) => <button key={id} className="dream-button" aria-pressed={mapMode === id} onClick={() => setMapMode(id as typeof mapMode)}>{label}</button>)}</div><canvas width={240} height={192} ref={node => { if (node) { const ctx = node.getContext("2d"); if (ctx) drawMap(ctx, world, mapMode); } }} role="img" aria-label={`${mapMode} map. You are at ${world.x},${world.y}; your camp is ${world.spawn.x},${world.spawn.y}. ${Object.keys(world.world.explored).length} chunks explored. Village shrines at 7,7; 32,8; 30,25.`} /><p>You: {world.x},{world.y} · Camp: {world.spawn.x},{world.spawn.y}<br />{Object.keys(world.world.explored).length} chunks explored · Seed {world.world.seed}</p><p>Cyan: you · Amber: camp · Gold: seals · Rose: villagers · Red: Warden. Nearby follows you; Village shows the starting quests. Each atlas square is a 24×24 chunk; dark squares are unexplored, amber dots are camps, pale dots are ruins.</p><div className="journal-tabs"><button className="dream-button" onClick={() => { setMessage(recall(world)); dirty.current = true; syncStats(); save(); }}>Recall to camp · 25 chakra</button><button className="dream-button" onClick={villageRecall}>Return to village · 25 chakra</button></div><p>Recall needs safe ground. Walk away from enemies first. The world never resets when you return.</p></div>}
        <p className="journal-note">The world is paused while your journal is open.</p></section>}
    </div>
    {phase === "game" && <><div className="dream-status" role={journal ? undefined : "status"}>{journal ? message : paused ? "Paused. Your world is saved; resume whenever you’re ready." : message}</div><div className="dream-controls" inert={journal}><div className="dream-dpad" aria-label="Movement controls">{[["ArrowUp", "↑", "Move up"], ["ArrowLeft", "←", "Move left"], ["ArrowDown", "↓", "Move down"], ["ArrowRight", "→", "Move right"]].map(([key, label, name]) => <button key={key} className={`dream-button dpad-${key}`} aria-label={name} onPointerDown={event => touchMove(key, event)} onPointerUp={() => held.current.delete(key)} onPointerCancel={() => held.current.delete(key)} onLostPointerCapture={() => held.current.delete(key)} onClick={event => { if (event.detail === 0 && !pausedRef.current && state.current) { movePlayer(state.current, ...keys[key]); syncStats(); save(); } }}>{label}</button>)}</div><div className="dream-tools">{[["kunai", "J", "Kunai"], ["chakra", "K", "Jutsu"], ["mine", "E", "Use / mine"], ["build", "Q", "Build"]].map(([action, key, label]) => <button key={action} className="dream-button" disabled={paused} onClick={() => act(action as Action)}><kbd>{key}</kbd>{label}</button>)}<button className="dream-button" aria-pressed={paused && !journal} disabled={journal} onClick={togglePause}><kbd>P</kbd>{paused && !journal ? "Resume" : "Pause"}</button><button className="dream-button journal-open" aria-expanded={journal} onClick={toggleJournal}><kbd>I</kbd>{journal ? "Close bag" : "Bag"}</button><button className="dream-button dream-more" aria-expanded={moreTools} aria-controls="dream-extra-tools" onClick={() => setMoreTools(!moreTools)}>{moreTools ? "Fewer tools" : "More tools"}</button><div className="dream-extra" id="dream-extra-tools" data-open={moreTools}>{[["dash", "L", "Dash"], ["heal", "H", `Heal (${stats.medicine})`], ["eye", "Space", "Eye"], ["recall", "R", "Recall"], ["recover", "X", "Recover"]].map(([action, key, label]) => <button key={action} className="dream-button" disabled={paused} onClick={() => act(action as Action)}><kbd>{key}</kbd>{label}</button>)}<label className="dream-material">Jutsu<select value={jutsu} onChange={event => { const value = event.target.value as Jutsu; jutsuRef.current = value; setJutsu(value); }}><option value="fire">Fire · 20</option><option value="wind" disabled={stats.scrolls < 1}>Wind · 25{stats.scrolls < 1 ? " (1 scroll)" : ""}</option><option value="lightning" disabled={stats.scrolls < 2}>Lightning · 35{stats.scrolls < 2 ? " (2 scrolls)" : ""}</option></select></label><label className="dream-material">Block<select value={material} onChange={event => { const value = event.target.value as Material; materialRef.current = value; setMaterial(value); }}>{materials.map(m => <option key={m} value={m}>{m === "garden" ? "Herb seeds" : m[0].toUpperCase() + m.slice(1)} ({m === "wood" ? stats.wood : m === "stone" ? stats.stone : world?.inventory[m] ?? 0})</option>)}</select></label></div></div></div><footer className="dream-help"><span>WASD / arrows · J kunai · K jutsu · E interact · Q build · L dash · H heal · R camp · I bag · Tap to aim · Esc return</span><span>Five biomes · Unbounded trails · Camps, ruins, farming and building.</span></footer></>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
