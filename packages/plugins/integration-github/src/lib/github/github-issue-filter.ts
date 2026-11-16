/** What the filter reads of an item of the repository issues list. */
interface IGithubIssueListItem {
	pull_request?: unknown;
}

/**
 * Whether an item of the repository issues list is really a pull request.
 *
 * The list endpoint answers with pull requests as well as issues, and marks a pull request with a `pull_request`
 * object. The `issues.*` webhooks never carry one (pull requests arrive as their own events), so only the list
 * based syncs have to tell them apart.
 */
export function isGithubPullRequest(issue: IGithubIssueListItem | null | undefined): boolean {
	return !!issue && typeof issue === 'object' && !!issue.pull_request;
}

/**
 * Keeps the issues of a repository issues list and drops its pull requests, so a sync does not turn every pull
 * request into a task. A value that is not a list is returned as an empty list.
 */
export function excludeGithubPullRequests<T extends IGithubIssueListItem>(issues: T[] | null | undefined): T[] {
	return Array.isArray(issues) ? issues.filter((issue) => !isGithubPullRequest(issue)) : [];
}
