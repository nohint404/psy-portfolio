import { writeFile } from "node:fs/promises";
import { buildPortfolio } from "../lib/github-core.ts";
const data = await buildPortfolio(async <T>(path: string): Promise<T> => {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Psymariux-Portfolio", "X-GitHub-Api-Version": "2022-11-28", ...(!/^\/repos\/[^/]+\/[^/?]+$/.test(path) && process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  return response.json();
});
await writeFile(new URL("../lib/github-snapshot.json", import.meta.url), JSON.stringify(data, null, 2) + "\n");
console.log(`Verified public snapshot: ${data.projects.length} projects, ${data.activity.length} activity items. ${data.fetchedAt}`);
console.log(data.warnings);
