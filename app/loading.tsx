import { PixelName } from "@/components/EntryLoader";

export default function Loading() {
  return <main className="page-state" role="status"><img className="pixel-art" src="/art/psymariux-head.png" alt="" width={64} height={64} /><div style={{ width: "min(580px, 100%)" }}><PixelName /></div><p>Opening the workshop…</p></main>;
}
