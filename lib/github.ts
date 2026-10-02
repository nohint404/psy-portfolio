import "server-only";
import { unstable_cache } from "next/cache";
import snapshot from "./github-snapshot.json";
import { activityWindowDays, githubHandle } from "@/config/portfolio";
import { buildPortfolio, getRecentActivity, type PortfolioData } from "./github-core";

const refreshPortfolio = unstable_cache(async () => {
  const data = await buildPortfolio(async <T>(path: string): Promise<T> => {
    const publicCheck = /^\/repos\/[^/]+\/[^/?]+$/.test(path);
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Psymariux-Portfolio", ...(!publicCheck && process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      ...(publicCheck ? { cache: "no-store" as const } : { next: { revalidate: 1800, tags: ["github-public"] } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Public GitHub data unavailable (${response.status})`);
    return response.json();
  });
  // A rate limit on optional activity endpoints must not cache an empty activity feed.
  if (data.projects.length && data.projects.every(p => p.unavailable.includes("commits"))) throw new Error("GitHub activity is unavailable");
  return data;
}, ["psymariux-public-github-v2"], { revalidate: 1800, tags: ["github-public"] });

export async function getPortfolioData(): Promise<PortfolioData> {
  try { return await refreshPortfolio(); }
  catch {
    const cached = snapshot as unknown as PortfolioData;
    const since = new Date(Date.now() - activityWindowDays * 86400000).toISOString();
    return { ...cached, activity: getRecentActivity(cached.projects, since), stats: { ...cached.stats, recentlyActive: cached.projects.filter(p => p.commits.some(c => c.author.toLowerCase() === githubHandle && c.date >= since)).map(p => p.name) }, status: "cached", warnings: [`GitHub is temporarily unavailable. Showing verified public data from ${snapshot.fetchedAt}.`] };
  }
}
