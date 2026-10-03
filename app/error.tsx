"use client";
import { githubProfileUrl } from "@/config/portfolio";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="page-state"><img className="pixel-art" src="/art/psymariux-head.png" alt="PsyMariux’s blue Minecraft skin" width={80} height={80} /><h1>The page could not load.</h1><p>Try again, or visit me on GitHub.</p><button className="pixel-button" onClick={reset}>Try again</button><a href={githubProfileUrl}>Visit GitHub</a></main>;
}
