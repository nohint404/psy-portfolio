import type { CSSProperties, ComponentProps } from "react";
import styles from "./RetroBubble.module.css";

// Adapted from Dksie09/RetroUI Bubble. BSD-3-Clause notice in licenses/.
// A noninteractive status bubble, not the original click-only div control.
export function RetroBubble({ className = "", children, ...props }: ComponentProps<"div">) {
  const border = "#79cde8";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path d="M3 1h2v1H3zM2 2h1v1H2zM5 2h1v1H5zM1 3h1v2H1zM6 3h1v2H6zM2 5h1v1H2zM5 5h1v1H5zM3 6h2v1H3z" fill="${border}"/></svg>`;
  return <div {...props} className={`${styles.balloon} ${className}`} style={{ "--bubble-border-color": border, "--bubble-bg-color": "#20323a", "--bubble-border-image": `url("data:image/svg+xml,${encodeURIComponent(svg)}")` } as CSSProperties}>{children}</div>;
}
