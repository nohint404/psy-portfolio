"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./PixelIcon";
import { records, nextRecord } from "@/lib/jukebox";
import "./Jukebox.css";

export default function Jukebox({ suspended, onPlaying }: { suspended: boolean; onPlaying: (playing: boolean) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const selected = useRef(0);
  const [record, setRecord] = useState(0), [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(20), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const suspendedRef = useRef(suspended);
  useEffect(() => {
    suspendedRef.current = suspended;
    if (suspended) audio.current?.pause();
  }, [suspended]);
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
    // No src, preload or music request until a visitor presses play.
    if (!media.getAttribute("src")) media.src = records[selected.current].src;
    void media.play().catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setLoading(false); setError("Music could not start. Press play to retry.");
    });
  }
  function choose(index: number, resume = !audio.current?.paused) {
    const media = audio.current;
    if (!media) return;
    pause(); selected.current = index; setRecord(index); setError("");
    // Selecting a disc while stopped does not download or start the music.
    media.removeAttribute("src"); media.load();
    if (resume) start();
  }
  function pause() { audio.current?.pause(); setLoading(false); setPlaying(false); onPlaying(false); }
  return <section id="jukebox" className="jukebox-player" tabIndex={-1} aria-labelledby="jukebox-heading" data-playing={playing}>
    <div className="jukebox-identity"><img src="/art/jukebox.png" width={64} height={64} alt="" className="pixel-art" /><div><h2 id="jukebox-heading">A quiet record.</h2><p>C418 / Minecraft — Volume Alpha</p></div><span className="jukebox-disc" aria-hidden="true" /></div>
    <div className="jukebox-deck">
      <div className="jukebox-records" role="group" aria-label="Choose a music disc">{records.map((item, index) => <button key={item.src} aria-pressed={index === record} onClick={() => choose(index)}><span className={`record-dot record-${index}`} aria-hidden="true" />{item.title}</button>)}</div>
      <div className="jukebox-controls"><button className="icon-button" disabled={suspended} onClick={() => playing || loading ? pause() : start()} aria-label={playing || loading ? "Pause music" : "Play music"} title={playing || loading ? "Pause music" : "Play music"}><Icon name={playing || loading ? "pause" : "play"} /></button><button className="icon-button" disabled={suspended} onClick={() => choose(nextRecord(record))} aria-label="Next music disc" title="Next music disc"><Icon name="next" /></button><label className="jukebox-volume"><span>Volume <output>{volume}%</output></span><input type="range" min={0} max={100} value={volume} aria-label="Music volume" onChange={event => { const value = Number(event.target.value); setVolume(value); if (audio.current) audio.current.volume = value / 100; }} /></label></div>
      <p className="jukebox-status" role="status">{error || (suspended ? "Music paused for the dream." : loading ? "Loading the record…" : playing ? `Playing ${records[record].title} · next: ${records[nextRecord(record)].title}` : "Press play. Two records, one quiet corner.")}</p>
    </div>
    <audio ref={audio} preload="none" onPlaying={() => { if (suspendedRef.current || document.hidden) { audio.current?.pause(); return; } setLoading(false); setPlaying(true); onPlaying(true); }} onPause={() => { setLoading(false); setPlaying(false); onPlaying(false); }} onEnded={() => { setPlaying(false); onPlaying(false); if (!suspendedRef.current && !document.hidden) choose(nextRecord(selected.current), true); }} onError={() => { setLoading(false); setPlaying(false); onPlaying(false); setError("This record is unavailable. Try the other disc."); }} />
  </section>;
}
