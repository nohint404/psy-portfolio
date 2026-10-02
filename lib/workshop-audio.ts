// One context per owner; React cleanup may close it (including Strict Mode).
export function resumeAudio(owner: { current: AudioContext | null }) {
  if (!owner.current || owner.current.state === "closed") owner.current = new AudioContext();
  const context = owner.current;
  if (context.state !== "running") void context.resume().catch(() => { /* Browser audio may be unavailable or blocked. */ });
  return context;
}
