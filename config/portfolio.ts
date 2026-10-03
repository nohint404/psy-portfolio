export const githubHandle = "psymariux";
export const githubProfileUrl = `https://github.com/${githubHandle}`;
// Historical commits can retain the former login after the account rename.
export const isDeveloperAuthor = (author: string) => [githubHandle, "nohint404"].includes(author.toLowerCase());
// Explicit selections may include public forks. Missing/private selections are omitted.
export const featuredRepos = ["PsyStream", "Icarus-Launcher", "spotatui"];
export const activityWindowDays = 45;
export const maxCommitsPerRepository = 200;
export const maxPullRequestsPerRepository = 200;
