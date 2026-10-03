export const records = [
  { title: "Sweden", src: "/audio/c418-sweden.mp3", source: "https://www.youtube.com/watch?v=aBkTkxKDduc" },
  { title: "Moog City", src: "/audio/c418-moog-city.mp3", source: "https://www.youtube.com/watch?v=wnHy42Zh14Y" },
] as const;
export function nextRecord(index: number) { return (index + 1) % records.length; }
export function adjustVolume(volume: number, change: number) { return Math.min(100, Math.max(0, volume + change)); }
