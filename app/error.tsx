"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="page-state"><img className="pixel-art" src="/art/psymariux-head.png" alt="PsyMariux’s blue Minecraft skin" width={80} height={80} /><h1>The workshop needs a moment.</h1><p>The page could not be loaded. Try again, or visit Psymariux on GitHub.</p><button className="pixel-button" onClick={reset}>Try again</button><a href="https://github.com/nohint404">Visit GitHub</a></main>;
}
