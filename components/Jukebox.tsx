"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./PixelIcon";
import { records, nextRecord } from "@/lib/jukebox";
import "./Jukebox.css";

type Props = { suspended: boolean; available: boolean; open: boolean; onOpenChange: (open: boolean) => void; onPlaying: (playing: boolean) => void; onRecordChange: (record: number | null) => void };
export default function Jukebox({ suspended, available, open, onOpenChange, onPlaying, onRecordChange }: Props) {
  const audio = useRef<HTMLAudioElement>(null), trigger = useRef<HTMLButtonElement>(null), disc = useRef<HTMLButtonElement>(null);
  const selected = useRef(0), suspendedRef = useRef(suspended), playbackRequested = useRef(false), requestId = useRef(0), ejectionId = useRef(0), insertedRef = useRef<number | null>(null);
  const [record, setRecord] = useState(0), [inserted, setInserted] = useState<number | null>(null), [ejecting, setEjecting] = useState<{ record: number; id: number } | null>(null);
  const [playing, setPlaying] = useState(false), [volume, setVolume] = useState(20), [loading, setLoading] = useState(false), [error, setError] = useState(""), [motion, setMotion] = useState(0);

  useEffect(() => {
    suspendedRef.current = suspended;
    if (suspended) {
      requestId.current++; playbackRequested.current = false;
      audio.current?.pause(); setLoading(false); setPlaying(false); onPlaying(false);
    }
  }, [suspended, onPlaying]);
  useEffect(() => { if (open && available) disc.current?.focus({ preventScroll: true }); }, [open, available]);
  useEffect(() => { onRecordChange(inserted); }, [inserted, onRecordChange]);
  useEffect(() => {
    const media = audio.current!;
    media.volume = .2;
    const hide = () => {
      if (document.hidden) {
        requestId.current++; playbackRequested.current = false;
        media.pause(); setLoading(false); setPlaying(false); onPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      playbackRequested.current = false;
      media.pause(); media.removeAttribute("src"); media.load();
    };
  }, [onPlaying]);

  function eject(unload = true) {
    const media = audio.current;
    const outgoing = insertedRef.current;
    pause();
    if (unload && media) { media.removeAttribute("src"); media.load(); }
    setLoading(false); setError("");
    insertedRef.current = null; setInserted(null);
    if (outgoing !== null) { const id = ++ejectionId.current; setEjecting({ record: outgoing, id }); setMotion(value => value + 1); }
  }
  function play(index = selected.current) {
    const media = audio.current;
    if (!media || suspendedRef.current || document.hidden) return;
    const id = ++requestId.current;
    playbackRequested.current = true;
    setError(""); setLoading(true);
    selected.current = index; setRecord(index);
    if (media.getAttribute("src") !== records[index].src || error) {
      media.src = records[index].src;
      media.load();
    }
    if (insertedRef.current !== index) { insertedRef.current = index; setInserted(index); setMotion(value => value + 1); }
    // This call deliberately stays in the click/ended event stack; CSS handles the visual sequence independently.
    void media.play().catch((reason: unknown) => {
      if (id !== requestId.current || (reason instanceof DOMException && reason.name === "AbortError")) return;
      playbackRequested.current = false; setLoading(false); setError("Music could not start. Tap the disc to retry.");
    });
  }
  function choose(index: number, resume = playbackRequested.current) {
    if (index === selected.current) return;
    const outgoing = insertedRef.current;
    const media = audio.current;
    pause();
    if (media) { media.removeAttribute("src"); media.load(); }
    selected.current = index; setRecord(index); setLoading(false); setError("");
    insertedRef.current = null; setInserted(null);
    if (outgoing !== null) { const id = ++ejectionId.current; setEjecting({ record: outgoing, id }); setMotion(value => value + 1); }
    if (resume) play(index);
  }
  function pause() { requestId.current++; playbackRequested.current = false; audio.current?.pause(); setLoading(false); setPlaying(false); onPlaying(false); }
  function changeVolume(value: number) { setVolume(value); if (audio.current) audio.current.volume = value / 100; }
  function close() { onOpenChange(false); trigger.current?.focus({ preventScroll: true }); }
  const active = playing || loading;

  return <aside className="jukebox-side" hidden={!available} aria-label="Workshop jukebox" data-playing={playing}>
    <section id="jukebox" className="jukebox-player" hidden={!open} aria-labelledby="jukebox-heading" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); close(); } }}>
      <header className="jukebox-top"><div><h2 id="jukebox-heading">Jukebox</h2><p>C418 / Volume Alpha</p></div><button className="icon-button" onClick={close} aria-label="Close jukebox"><Icon name="close" /></button></header>
      <div className="jukebox-machine-area">
        <button ref={disc} className="jukebox-machine" onClick={() => active ? pause() : play()} aria-label={active ? `Pause ${records[record].title}` : `Play ${records[record].title}`} aria-pressed={playing} aria-describedby="jukebox-hint" disabled={suspended} data-loading={loading}>
          <img className="jukebox-block pixel-art" src="/art/jukebox.png" width={64} height={64} alt="" />
          {ejecting !== null && <img key={`eject-${ejecting.id}`} className="jukebox-record jukebox-record-ejecting pixel-art" src={ejecting.record === 0 ? "/art/disc-sweden.png" : "/art/disc-moog-city.png"} width={16} height={16} alt="" onAnimationEnd={() => { if (ejectionId.current === ejecting.id) setEjecting(null); }} />}
          {inserted === null && ejecting === null && <img className="jukebox-record jukebox-record-ready pixel-art" src={record === 0 ? "/art/disc-sweden.png" : "/art/disc-moog-city.png"} width={16} height={16} alt="" />}
          {inserted !== null && <img key={`insert-${motion}`} className="jukebox-record jukebox-record-inserting pixel-art" src={inserted === 0 ? "/art/disc-sweden.png" : "/art/disc-moog-city.png"} width={16} height={16} alt="" />}
          <span className="jukebox-play-symbol"><Icon name={active ? "pause" : "play"} /></span>
        </button>
        <label className="jukebox-volume" htmlFor="jukebox-volume"><span>Volume</span><input id="jukebox-volume" type="range" min="0" max="100" step="5" value={volume} onChange={event => changeVolume(Number(event.target.value))} aria-valuetext={`${volume}%`} /><output aria-live="polite">{volume}%</output></label>
      </div>
      <h3 className="jukebox-track">{records[record].title}</h3><p id="jukebox-hint" className="jukebox-hint">{active ? "Tap the disc to pause." : inserted !== null ? "Tap the disc to play, or eject it below." : "Tap the disc to play."}</p>
      <div className="jukebox-records" role="group" aria-label="Choose a music disc">{records.map((item, index) => <button key={item.src} aria-pressed={index === record} onClick={() => choose(index)}><img className="pixel-art" src={index === 0 ? "/art/disc-sweden.png" : "/art/disc-moog-city.png"} width={16} height={16} alt="" />{item.title}</button>)}</div>
      <div className="jukebox-actions"><button className="text-button" onClick={() => eject()} disabled={inserted === null && ejecting === null}>Eject disc</button><button className="jukebox-next text-button" onClick={() => choose(nextRecord(selected.current))}>Next disc <Icon name="next" /></button></div>
      <p className="jukebox-status" role="status">{error || (loading ? "Loading the record…" : playing ? `Next: ${records[nextRecord(record)].title}` : inserted !== null ? "Record inserted. Ready to play." : "Choose a record, then tap the block.")}</p>
    </section>
    <button ref={trigger} className="jukebox-toggle" aria-controls="jukebox" aria-expanded={open} aria-label={open ? "Close jukebox" : "Open jukebox"} onClick={() => open ? close() : onOpenChange(true)}><img src="/art/jukebox.png" width={40} height={40} alt="" className="pixel-art" /><span>{open ? "Close" : "Jukebox"}</span><i className="jukebox-signal" aria-hidden="true" /></button>
    <audio ref={audio} preload="none" onPlaying={() => { if (suspendedRef.current || document.hidden || !playbackRequested.current) { audio.current?.pause(); return; } setLoading(false); setPlaying(true); onPlaying(true); }} onPause={() => { if (!audio.current?.paused) return; setLoading(false); setPlaying(false); onPlaying(false); }} onEnded={() => { if (!audio.current?.ended) return; setPlaying(false); onPlaying(false); if (!suspendedRef.current && !document.hidden && playbackRequested.current) choose(nextRecord(selected.current), true); }} onError={() => { if (!audio.current?.error || !playbackRequested.current) return; playbackRequested.current = false; setLoading(false); setPlaying(false); onPlaying(false); setError("This record is unavailable. Try the other disc."); }} />
  </aside>;
}
