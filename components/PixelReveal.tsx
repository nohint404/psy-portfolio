"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type Variant = "chest" | "craft" | "signal" | "book";
export default function PixelReveal({ children, variant }: { children: ReactNode; variant: Variant }) {
  const host = useRef<HTMLDivElement>(null), finishedTiles = useRef(0);
  useEffect(() => {
    const node = host.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      finishedTiles.current = 0; node.dataset.reveal = "playing"; observer.disconnect();
    }, { threshold: .08, rootMargin: "0px 0px -24px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={host} className={`pixel-reveal reveal-${variant}`}>
    <div className="reveal-content">{children}</div>
    <div className="reveal-tiles" aria-hidden="true" onAnimationEnd={event => {
      if (event.animationName === "scroll-pixel-break" && ++finishedTiles.current === 96 && host.current) host.current.dataset.reveal = "done";
    }}>{Array.from({ length: 96 }, (_, i) => {
      const x = i % 12, y = Math.floor(i / 12);
      const delay = variant === "chest" ? (7 - y) * 32 + x * 13 : variant === "craft" ? ((x + y) % 2) * 140 + y * 22 + x * 12 : variant === "signal" ? x * 32 + y * 10 : Math.abs(x - 5.5) * 48 + y * 18;
      return <i key={i} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties} />;
    })}</div>
  </div>;
}
