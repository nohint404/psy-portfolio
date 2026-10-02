"use client";

import { useEffect, useState, type CSSProperties } from "react";

const letters: Record<string, string[]> = {
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  s: ["00000", "01111", "10000", "01110", "00001", "00001", "11110"],
  y: ["00000", "10001", "10001", "01111", "00001", "10001", "01110"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  a: ["00000", "01110", "00001", "01111", "10001", "10001", "01111"],
  r: ["00000", "10110", "11001", "10000", "10000", "10000", "10000"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  u: ["00000", "10001", "10001", "10001", "10001", "10011", "01101"],
  x: ["00000", "10001", "01010", "00100", "01010", "10001", "10001"],
};

export function PixelName() {
  return <svg className="loading-name" viewBox="0 0 53 7" role="img" aria-label="PsyMariux" shapeRendering="crispEdges">
    {Array.from("PsyMariux").flatMap((letter, index) => letters[letter].flatMap((row, y) => Array.from(row).flatMap((bit, x) => bit === "1" ? [<rect key={`${index}-${x}-${y}`} x={index * 6 + x} y={y} width="1" height="1" style={{ "--delay": `${index * 88 + ((x * 3 + y * 5) % 7) * 64}ms` } as CSSProperties} />] : [])))}
  </svg>;
}

export default function EntryLoader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [assembled, setAssembled] = useState(false);
  const [expired, setExpired] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const minimum = setTimeout(() => setAssembled(true), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1320);
    const deadline = setTimeout(() => setExpired(true), 4000);
    return () => { clearTimeout(minimum); clearTimeout(deadline); };
  }, []);
  useEffect(() => {
    if (!leaving && !(assembled && (ready || expired))) return;
    const timer = setTimeout(onDone, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
    return () => clearTimeout(timer);
  }, [assembled, ready, expired, leaving, onDone]);
  const exit = leaving || (assembled && (ready || expired));
  return <div className="entry-loader" data-exit={exit}>
    <div className="entry-tiles" aria-hidden="true">{Array.from({ length: 96 }, (_, i) => <i key={i} style={{ "--tile-delay": `${((i * 7) % 9) * 8}ms` } as CSSProperties} />)}</div>
    <div className="entry-build"><img src="/art/psymariux-head.png" width="64" height="64" alt="" className="pixel-art" /><PixelName /><div className="entry-slots" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ "--delay": `${i * 136}ms` } as CSSProperties} />)}</div><p role="status">{ready ? "Workshop ready. Come on in." : "Building your way into the workshop…"}</p></div>
    <button className="text-button entry-skip" onClick={() => setLeaving(true)}>Enter now</button>
  </div>;
}
