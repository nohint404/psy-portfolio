import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRepositories, getFeaturedProjects, getRecentCommits, getPullRequests, getRecentActivity, buildPortfolio, normalizePublicReleases, meaningfulCommit, safeUrl, summarizeReadme, type Api, type Project, type PortfolioData } from "../lib/github-core.ts";
import { isAllowedOrigin, validateContact } from "../lib/contact.ts";

const repository = (name = "example", extra = {}) => ({ name, full_name: `nohint404/${name}`, private: false, visibility: "public", archived: false, fork: false, owner: { login: "nohint404" }, language: "Rust", pushed_at: "2026-09-01T00:00:00Z", default_branch: "main", ...extra });
const apiMock = (fn: (path: string) => unknown) => (async (path: string) => fn(path)) as Api;

test("repository pagination and public-owner boundary", async () => {
  const seen: string[] = [];
  const repos = await getRepositories(apiMock(path => {
    seen.push(path);
    if (new URL(path, "https://api.github.com").searchParams.get("page") === "1") return Array.from({ length: 100 }, (_, i) => repository(`r${i}`));
    return [repository("last"), repository("secret", { private: true }), repository("outsider", { owner: { login: "other" } }), repository("internal", { visibility: "internal" })];
  }));
  assert.equal(repos.length, 101); assert.equal(seen.length, 2); assert.equal(repos.at(-1)?.name, "last");
});
test("only explicitly featured forks, no archived or empty experiments", () => {
  const repos = [repository("fork", { fork: true }), repository("spotatui", { fork: true }), repository("old", { archived: true }), repository("empty", { language: null }), repository("owned")];
  assert.deepEqual(getFeaturedProjects(repos as never).map(r => r.name), ["spotatui", "owned"]);
});
test("commit pagination, filtering and accurate branch context", async () => {
  const seen: string[] = [];
  const commit = (i: number) => ({ sha: String(i).padStart(40, "0"), html_url: `https://github.com/nohint404/example/commit/${i}`, author: { login: "nohint404" }, commit: { message: `fix: issue ${i}`, author: { name: "Psymariux", date: "2026-09-01T00:00:00Z" } } });
  const data = await getRecentCommits(apiMock(path => { seen.push(path); return new URL(path, "https://api.github.com").searchParams.get("page") === "1" ? Array.from({ length: 100 }, (_, i) => commit(i)) : [commit(100)]; }), repository() as never, "2026-08-01T00:00:00Z");
  assert.equal(data.items.length, 101); assert.equal(data.truncated, false); assert.equal(seen.length, 2); assert.equal(data.items[0].branch, "main"); assert.ok(seen[0].includes("since="));
  assert.equal(meaningfulCommit("chore: bump dependencies", "dependabot[bot]"), false); assert.equal(meaningfulCommit("fix authentication race", "nohint404"), true);
});
test("PR pagination stops at window and preserves merged status", async () => {
  const data = await getPullRequests(apiMock(() => [{ number: 1, title: "fix", state: "closed", html_url: "https://github.com/nohint404/example/pull/1", updated_at: "2026-09-01", merged_at: "2026-09-01", user: { login: "nohint404" } }, { number: 2, title: "old", state: "open", html_url: "x", updated_at: "2025-01-01", merged_at: null, user: { login: "nohint404" } }]), repository() as never, "2026-08-01");
  assert.equal(data.items.length, 1); assert.equal(data.items[0].state, "merged");
});
test("snapshot feed is real, cross-repository, and does not attribute upstream work to Psymariux", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../lib/github-snapshot.json", import.meta.url), "utf8")) as PortfolioData;
  assert.ok(snapshot.projects.length); assert.ok(snapshot.activity.length);
  assert.ok(snapshot.activity.every(a => a.author === "nohint404" && a.url.startsWith("https://github.com/nohint404/")));
  assert.ok(new Set(snapshot.activity.map(a => a.repository)).size > 1);
  assert.ok(!snapshot.projects.some(p => p.name === "PsyStream"));
  const first = snapshot.projects[0];
  const activity = getRecentActivity([{ ...first, commits: [{ kind: "commit", repository: first.name, author: "upstream", date: "2026-09-01", sha: "abc", message: "fix", url: "https://github.com/x", branch: "main" }], pullRequests: [] } as Project]);
  assert.equal(activity.length, 0);
});
test("URL safety and plain README summarization", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null); assert.equal(safeUrl("https://example.com"), "https://example.com/");
  assert.equal(summarizeReadme("# Header\n\n![badge](https://example.com)\n\nA factual description of a developer tool with [documentation](https://example.com)."), "A factual description of a developer tool with documentation.");
});
test("public visibility is rechecked after fetching before serialization", async () => {
  await assert.rejects(buildPortfolio(apiMock(path => {
    if (path.startsWith("/users/nohint404/repos")) return [repository()];
    if (path.endsWith("/languages")) return { Rust: 100 };
    if (path === "/repos/nohint404/example") return repository("example", { private: true });
    if (path.includes("/contents/") || path.endsWith("/readme")) throw new Error("not found");
    return [];
  }), new Date("2026-09-30")), /Public repository verification/);
});
test("authenticated release responses never expose private drafts or unpublished data", () => {
  const base = { tag_name: "v1", name: "Public release", published_at: "2026-09-01T00:00:00Z", html_url: "https://github.com/nohint404/example/releases/tag/v1", draft: false };
  const releases = normalizePublicReleases([base, { ...base, name: "Private future release", draft: true }, { ...base, name: "Not published", published_at: null }, { ...base, html_url: "javascript:alert(1)" }]);
  assert.deepEqual(releases, [{ name: base.name, date: base.published_at, url: base.html_url }]);
  assert.ok(!JSON.stringify(releases).includes("Private future release"));
});
test("same-origin contact works behind a 0.0.0.0 bind without accepting foreign origins", () => {
  assert.equal(isAllowedOrigin("http://localhost:3000", "localhost:3000"), true);
  assert.equal(isAllowedOrigin("https://portfolio.example.com", "portfolio.example.com"), true);
  assert.equal(isAllowedOrigin("https://other.example.com", "portfolio.example.com"), false);
  assert.equal(isAllowedOrigin("garbage", "localhost:3000"), false);
});
test("contact input validation rejects unsafe sizes and types", () => {
  assert.equal(validateContact({ name: {}, email: "x", message: "hello" }), null);
  assert.equal(validateContact({ name: "A", email: "invalid", message: "A valid message." }), null);
  assert.equal(validateContact({ name: "A", email: "a@b.com", message: "x".repeat(1801) }), null);
  assert.deepEqual(validateContact({ name: " A ", email: "a@b.com", message: "A valid message." }), { name: "A", email: "a@b.com", message: "A valid message.", website: "" });
});
