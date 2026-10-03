"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./PixelIcon";
import { records, nextRecord, adjustVolume } from "@/lib/jukebox";
import "./Jukebox.css";

type Props = { suspended: boolean; available: boolean; open: boolean; onOpenChange: (open: boolean) => void; onPlaying: (playing: boolean) => void };
export default function Jukebox({ suspended, available, open, onOpenChange, onPlaying }: Props) {
  const audio = useRef<HTMLAudioElement>(null), trigger = useRef<HTMLButtonElement>(null), disc = useRef<HTMLButtonElement>(null);
  const selected = useRef(0);
  const [record, setRecord] = useState(0), [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(20), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const suspendedRef = useRef(suspended);
  useEffect(() => {
    suspendedRef.current = suspended;
    if (suspended) audio.current?.pause();
  }, [suspended]);
  useEffect(() => {
    if (open && available) disc.current?.focus({ preventScroll: true });
  }, [open, available]);
  useEffect(() => {
    const media = audio.current!;
    media.volume = .2;
    const hide = () => { if (document.hidden) media.pause(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); media.pause(); media.removeAttribute("src"); media.load(); };
  }, []);
  function start() {
    const media = audio.current;
    if (!media || suspendedRef.current || document.hidden) return;
    setError(""); setLoading(true);
    // Music remains manual even after interaction sound effects are unlocked.
    if (!media.getAttribute("src")) media.src = records[selected.current].src;
    void media.play().catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setLoading(false); setError("Music could not start. Tap the record to retry.");
    });
  }
  function choose(index: number, resume = !audio.current?.paused) {
    const media = audio.current;
    if (!media) return;
    pause(); selected.current = index; setRecord(index); setError("");
    media.removeAttribute("src"); media.load();
    if (resume) start();
  }
  function pause() { audio.current?.pause(); setLoading(false); setPlaying(false); onPlaying(false); }
  function changeVolume(change: number) {
    const value = adjustVolume(volume, change); setVolume(value);
    if (audio.current) audio.current.volume = value / 100;
  }
  function close() { onOpenChange(false); trigger.current?.focus({ preventScroll: true }); }
  return <aside className="jukebox-side" hidden={!available} aria-label="Workshop jukebox" data-playing={playing}>
    <section id="jukebox" className="jukebox-player" hidden={!open} aria-labelledby="jukebox-heading" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); close(); } }}>
      <header className="jukebox-top"><div><h2 id="jukebox-heading">Jukebox</h2><p>C418 / Volume Alpha</p></div><button className="icon-button" onClick={close} aria-label="Close jukebox"><Icon name="close" /></button></header>
      <button ref={disc} className="jukebox-machine" onClick={() => playing || loading ? pause() : start()} aria-label={playing || loading ? `Pause ${records[record].title}` : `Play ${records[record].title}`} aria-pressed={playing} aria-describedby="jukebox-hint" disabled={suspended} data-loading={loading}>
        <img className="jukebox-block pixel-art" src="/art/jukebox.png" width={64} height={64} alt="" />
        <img className="jukebox-record pixel-art" src={record === 0 ? "/art/disc-sweden.png" : "/art/disc-moog-city.png"} width={16} height={16} alt="" />
        <span className="jukebox-play-symbol"><Icon name={playing || loading ? "pause" : "play"} /></span>
      </button>
      <h3 className="jukebox-track">{records[record].title}</h3><p id="jukebox-hint" className="jukebox-hint">{playing || loading ? "Tap the disc to pause." : "Tap the disc to play."}</p>
      <div className="jukebox-records" role="group" aria-label="Choose a music disc">{records.map((item, index) => <button key={item.src} aria-pressed={index === record} onClick={() => choose(index)}><img className="pixel-art" src={index === 0 ? "/art/disc-sweden.png" : "/art/disc-moog-city.png"} width={16} height={16} alt="" />{item.title}</button>)}</div>
      <div className="jukebox-volume" role="group" aria-label="Music volume"><button className="jukebox-lever lever-down" onClick={() => changeVolume(-5)} disabled={volume === 0} aria-label="Lower music volume" title="Lower volume by 5%"><span className="lever-base" aria-hidden="true"><i /></span><span>-5</span></button><div className="jukebox-level"><span>Volume <output aria-live="polite">{volume}%</output></span><div className="jukebox-meter" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} data-on={volume > index * 10} />)}</div></div><button className="jukebox-lever lever-up" onClick={() => changeVolume(5)} disabled={volume === 100} aria-label="Raise music volume" title="Raise volume by 5%"><span className="lever-base" aria-hidden="true"><i /></span><span>+5</span></button></div>
      <button className="jukebox-next text-button" onClick={() => choose(nextRecord(record))}>Next disc <Icon name="next" /></button>
      <p className="jukebox-status" role="status">{error || (loading ? "Loading the record…" : playing ? `Next: ${records[nextRecord(record)].title}` : "Two records. A quiet corner.")}</p>
    </section>
    <button ref={trigger} className="jukebox-toggle" aria-controls="jukebox" aria-expanded={open} aria-label={open ? "Close jukebox" : "Open jukebox"} onClick={() => open ? close() : onOpenChange(true)}><img src="/art/jukebox.png" width={40} height={40} alt="" className="pixel-art" /><span>{open ? "Close" : "Jukebox"}</span><i className="jukebox-signal" aria-hidden="true" /></button>
    <audio ref={audio} preload="none" onPlaying={() => { if (suspendedRef.current || document.hidden) { audio.current?.pause(); return; } setLoading(false); setPlaying(true); onPlaying(true); }} onPause={() => { setLoading(false); setPlaying(false); onPlaying(false); }} onEnded={() => { setPlaying(false); onPlaying(false); if (!suspendedRef.current && !document.hidden) choose(nextRecord(selected.current), true); }} onError={() => { setLoading(false); setPlaying(false); onPlaying(false); setError("This record is unavailable. Try the other disc."); }} />
  </aside>;
}
