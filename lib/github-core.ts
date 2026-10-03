import { githubHandle, isDeveloperAuthor, featuredRepos, activityWindowDays, maxCommitsPerRepository, maxPullRequestsPerRepository } from "../config/portfolio.ts";

export type Commit = { kind: "commit"; repository: string; sha: string; message: string; author: string; date: string; url: string; branch: string };
export type PullRequest = { kind: "pr"; repository: string; number: number; title: string; state: string; date: string; url: string; author: string };
export type Project = { latestCommit?: Commit; name: string; description: string | null; url: string; homepage: string | null; language: string | null; languages: Record<string, number>; topics: string[]; stars: number; forks: number; created: string; updated: string; pushed: string; branch: string; size: number; fork: boolean; readme: string | null; technologies: string[]; commits: Commit[]; pullRequests: PullRequest[]; releases: { name: string; date: string; url: string }[]; openIssues: number; activityTruncated: boolean; unavailable: string[] };
export type PortfolioData = { projects: Project[]; activity: (Commit | PullRequest)[]; stats: { publicRepositories: number; languages: { name: string; bytes: number }[]; recentlyActive: string[] }; fetchedAt: string; status: "live" | "cached" | "unavailable"; warnings: string[]; profile: { bio: string | null; url: string } };

type RawRepository = { name: string; full_name: string; private: boolean; visibility?: string; archived: boolean; fork: boolean; owner: { login: string }; description: string | null; html_url: string; homepage: string | null; language: string | null; topics?: string[]; stargazers_count: number; forks_count: number; created_at: string; updated_at: string; pushed_at: string; default_branch: string; size: number; open_issues_count: number };
export type Api = <T>(path: string) => Promise<T>;
type RawRelease = { name: string | null; tag_name: string; published_at: string | null; html_url: string; draft: boolean };
export function normalizePublicReleases(releases: RawRelease[]) {
  // Authenticated owners can see draft releases even on a public repository.
  return releases.filter(r => r.draft === false && r.published_at && safeUrl(r.html_url)).slice(0, 3).map(r => ({ name: r.name || r.tag_name, date: r.published_at!, url: safeUrl(r.html_url)! }));
}

export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export function isPublicOwned(repo: RawRepository) {
  return repo.private === false && (!repo.visibility || repo.visibility === "public") && repo.owner.login.toLowerCase() === githubHandle;
}
export function meaningfulCommit(message: string, author: string) {
  return !/\[bot\]$|dependabot|renovate/i.test(author) && !/^(chore(?:\([^)]*\))?:\s*(bump|update dependencies)|bump .* from .* to .*|merge branch|merge pull request)/i.test(message);
}
export function summarizeReadme(content: string): string | null {
  const text = content.replace(/```[\s\S]*?```/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<[^>]+>/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 45 && !/^(#|\||\[!|https?:|[-*]\s)/.test(p));
  return paragraphs[0]?.replace(/[*_`]/g, "").replace(/\s+/g, " ").slice(0, 700) || null;
}

async function pages<T>(api: Api, path: string, cap = Infinity): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await api<T[]>(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return { items: items.slice(0, cap), truncated: items.length > cap };
    if (items.length >= cap) return { items: items.slice(0, cap), truncated: true };
  }
}
export async function getRepositories(api: Api) {
  const { items } = await pages<RawRepository>(api, `/users/${githubHandle}/repos?type=owner&sort=pushed`);
  return items.filter(isPublicOwned);
}
export function getFeaturedProjects(repos: RawRepository[]) {
  const selected = repos.filter(r => !r.archived && (r.language || featuredRepos.some(n => n.toLowerCase() === r.name.toLowerCase())) && (!r.fork || featuredRepos.some(n => n.toLowerCase() === r.name.toLowerCase())));
  return selected.sort((a, b) => {
    const rank = (r: RawRepository) => { const i = featuredRepos.findIndex(n => n.toLowerCase() === r.name.toLowerCase()); return i < 0 ? featuredRepos.length : i; };
    return rank(a) - rank(b) || b.pushed_at.localeCompare(a.pushed_at);
  });
}
export async function getRepositoryLanguages(api: Api, repo: RawRepository) { return api<Record<string, number>>(`/repos/${repo.full_name}/languages`); }
export async function getRepositoryReadme(api: Api, repo: RawRepository) {
  const result = await api<{ encoding: string; content: string }>(`/repos/${repo.full_name}/readme`);
  return result.encoding === "base64" ? summarizeReadme(Buffer.from(result.content, "base64").toString("utf8")) : null;
}
export async function getRecentCommits(api: Api, repo: RawRepository, since: string) {
  const result = await pages<{ sha: string; html_url: string; author: { login: string } | null; commit: { message: string; author: { name: string; date: string } } }>(api, `/repos/${repo.full_name}/commits?since=${encodeURIComponent(since)}&sha=${encodeURIComponent(repo.default_branch)}`, maxCommitsPerRepository);
  return { items: result.items.filter(c => meaningfulCommit(c.commit.message, c.author?.login || c.commit.author.name)).map(c => ({ kind: "commit" as const, repository: repo.name, sha: c.sha, message: c.commit.message.slice(0, 2000), author: c.author?.login || c.commit.author.name, date: c.commit.author.date, url: c.html_url, branch: repo.default_branch })), truncated: result.truncated };
}
export async function getLatestCommit(api: Api, repo: RawRepository): Promise<Commit | undefined> {
  const [c] = await api<{ sha: string; html_url: string; author: { login: string } | null; commit: { message: string; author: { name: string; date: string } } }[]>(`/repos/${repo.full_name}/commits?sha=${encodeURIComponent(repo.default_branch)}&per_page=1`);
  return c ? { kind: "commit", repository: repo.name, sha: c.sha, message: c.commit.message.slice(0, 2000), author: c.author?.login || c.commit.author.name, date: c.commit.author.date, url: c.html_url, branch: repo.default_branch } : undefined;
}
export async function getPullRequests(api: Api, repo: RawRepository, since: string) {
  // Updated-desc pagination is bounded; stop once the page is older than the activity window.
  const items: PullRequest[] = [];
  for (let page = 1; ; page++) {
    const batch = await api<{ number: number; title: string; state: string; html_url: string; updated_at: string; merged_at: string | null; user: { login: string } }[]>(`/repos/${repo.full_name}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${page}`);
    for (const p of batch.filter(p => p.updated_at >= since && !p.user.login.endsWith("[bot]"))) items.push({ kind: "pr", repository: repo.name, number: p.number, title: p.title, state: p.merged_at ? "merged" : p.state, date: p.merged_at || p.updated_at, url: p.html_url, author: p.user.login });
    if (batch.length < 100 || batch.at(-1)!.updated_at < since) return { items, truncated: false };
    if (page * 100 >= maxPullRequestsPerRepository) return { items, truncated: true };
  }
}
async function getTechnologies(api: Api, repo: RawRepository, languages: Record<string, number>) {
  const technologies = new Set([...Object.keys(languages), ...(repo.topics || [])]);
  try {
    const manifest = await api<{ encoding: string; content: string }>(`/repos/${repo.full_name}/contents/package.json?ref=${encodeURIComponent(repo.default_branch)}`);
    if (manifest.encoding === "base64") {
      const json = JSON.parse(Buffer.from(manifest.content, "base64").toString("utf8"));
      const deps = { ...json.dependencies, ...json.devDependencies };
      for (const [name, label] of Object.entries({ react: "React", next: "Next.js", vite: "Vite", typescript: "TypeScript", tailwindcss: "Tailwind CSS", "@tauri-apps/api": "Tauri", vue: "Vue", express: "Express", gsap: "GSAP", three: "Three.js" })) if (name in deps) technologies.add(label);
    }
  } catch { /* Optional manifest unavailable; languages/topics remain factual signals. */ }
  if ("Rust" in languages) {
    try {
      const cargo = await api<{ encoding: string; content: string }>(`/repos/${repo.full_name}/contents/Cargo.toml?ref=${encodeURIComponent(repo.default_branch)}`);
      if (cargo.encoding === "base64") {
        const text = Buffer.from(cargo.content, "base64").toString("utf8");
        const dependencies = [...text.matchAll(/\[(?:workspace\.|dev-|build-)?dependencies\]([^]*?)(?=\n\[|$)/g)].map(m => m[1]).join("\n");
        for (const [name, label] of Object.entries({ tokio: "Tokio", serde: "Serde", ratatui: "Ratatui", librespot: "Librespot", reqwest: "Reqwest", crossterm: "Crossterm", tauri: "Tauri" })) if (new RegExp(`^${name}\\s*=`, "m").test(dependencies)) technologies.add(label);
      }
    } catch { /* Optional Rust manifest; do not guess missing dependencies. */ }
  }
  return [...technologies].slice(0, 24);
}
export function getRecentActivity(projects: Project[], since?: string) {
  const unique = new Map<string, Commit | PullRequest>();
  for (const project of projects) for (const item of [...project.commits, ...project.pullRequests]) {
    if (isDeveloperAuthor(item.author) && (!since || item.date >= since)) unique.set(item.url, item);
  }
  const counts = new Map<string, number>();
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date)).filter(item => {
    const count = counts.get(item.repository) || 0;
    counts.set(item.repository, count + 1);
    return count < 12;
  }).slice(0, 40);
}
export function getDeveloperStats(repos: RawRepository[], projects: Project[], since: string) {
  const languages: Record<string, number> = {};
  for (const p of projects) for (const [name, bytes] of Object.entries(p.languages)) languages[name] = (languages[name] || 0) + bytes;
  return { publicRepositories: repos.length, languages: Object.entries(languages).map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes), recentlyActive: projects.filter(p => p.commits.some(c => c.date >= since && isDeveloperAuthor(c.author))).map(p => p.name) };
}
export async function buildPortfolio(api: Api, now = new Date()): Promise<PortfolioData> {
  const repos = await getRepositories(api);
  const since = new Date(now.getTime() - activityWindowDays * 86400000).toISOString();
  const warnings: string[] = [];
  // Serial repositories keep anonymous API traffic bounded; each repo's optional endpoints run concurrently.
  const projects: Project[] = [];
  const candidates = getFeaturedProjects(repos);
  for (const r of candidates) {
    const unavailable: string[] = [];
    async function optional<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> { try { return await fn(); } catch { unavailable.push(name); return fallback; } }
    const [languages, readme, commits, prs, releases] = await Promise.all([
      optional("languages", () => getRepositoryLanguages(api, r), {}),
      optional("README", () => getRepositoryReadme(api, r), null),
      optional("commits", () => getRecentCommits(api, r, since), { items: [] as Commit[], truncated: false }),
      optional("pull requests", () => getPullRequests(api, r, since), { items: [] as PullRequest[], truncated: false }),
      optional("releases", () => api<RawRelease[]>(`/repos/${r.full_name}/releases?per_page=30`), []),
    ]);
    const technologies = await getTechnologies(api, r, languages);
    const latestCommit = commits.items[0] || await optional("latest commit", () => getLatestCommit(api, r), undefined);
    // With an authenticated API client, visibility can change during collection. Recheck
    // before serializing so newly private repository contents never reach the portfolio.
    const visibility = await api<RawRepository>(`/repos/${r.full_name}`).catch(() => null);
    if (!visibility || !isPublicOwned(visibility)) continue;
    projects.push({ latestCommit, name: r.name, description: r.description, url: r.html_url, homepage: safeUrl(r.homepage), language: r.language, languages, topics: r.topics || [], stars: r.stargazers_count, forks: r.forks_count, created: r.created_at, updated: r.updated_at, pushed: r.pushed_at, branch: r.default_branch, size: r.size, fork: r.fork, readme, technologies, commits: commits.items, pullRequests: prs.items, releases: normalizePublicReleases(releases), openIssues: r.open_issues_count, activityTruncated: commits.truncated || prs.truncated, unavailable });
    if (unavailable.length) warnings.push(`${r.name}: ${unavailable.join(", ")} unavailable`);
  }
  if (candidates.length && !projects.length) throw new Error("Public repository verification is unavailable");
  const profile = await api<{ bio: string | null; html_url: string }>(`/users/${githubHandle}`).catch(() => ({ bio: null, html_url: `https://github.com/${githubHandle}` }));
  return { projects, activity: getRecentActivity(projects, since), stats: getDeveloperStats(repos, projects, since), fetchedAt: now.toISOString(), status: "live", warnings, profile: { bio: profile.bio, url: profile.html_url } };
}
