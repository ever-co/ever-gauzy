/**
 * How a GitHub pull request or issue is linked to a Gauzy task (spec `task-automations`, T16), as pure functions:
 *
 * - a link of the task (`resource_link`) whose address is the item's (`https://github.com/<owner>/<repo>/pull/<n>` or
 *   `/issues/<n>`: one numbering covers both, so either form names the same item);
 * - a pull request whose title or branch names the task by its reference (`WEB-42: fix the footer`,
 *   `feature/WEB-42-footer`), upper case as the platform writes references;
 * - an issue the task mirrors (the issue sync's integration map, entity `Issue`), read by the service.
 */

/** The kind of a GitHub item, as `task_link.closed` names it. */
export type GithubItemKind = 'pull_request' | 'issue';

/** A pull request or issue of a repository, by its owner, name and number (owner and name lower case). */
export interface IGithubItemAddress {
	owner: string;
	repo: string;
	number: number;
}

/** The most references one pull request is read for (its title and its branch together). */
export const GITHUB_PULL_REQUEST_REFERENCES_MAX = 20;

/**
 * A reference in a pull request's title or branch: an upper-case project key, a dash and a number, not inside a longer
 * word or number. A dash may follow (`WEB-42-footer`, the usual branch name), unlike in the platform's message
 * references; lower case is not read (`node-26` in a dependency branch is no task).
 */
const PULL_REQUEST_REFERENCE = /(?<![A-Za-z0-9])([A-Z][A-Z0-9]{1,9})-(\d{1,9})(?![A-Za-z0-9])/g;

/** The repository of a webhook payload (`full_name`, else `owner.login` and `name`), lower case; `null` when it names none. */
export function repositoryAddressOf(
	repository:
		{ full_name?: string | null; name?: string | null; owner?: { login?: string | null } | null } | null | undefined
): Pick<IGithubItemAddress, 'owner' | 'repo'> | null {
	const [fullOwner, fullRepo] = String(repository?.full_name ?? '').split('/');
	const owner = (fullOwner || repository?.owner?.login || '').trim().toLowerCase();
	const repo = (fullRepo || repository?.name || '').trim().toLowerCase();
	return owner && repo ? { owner, repo } : null;
}

/**
 * The pull request or issue a link's address names, or `null` when it is no GitHub item address. `github.com` (or
 * `www.`) over http(s), then `/<owner>/<repo>/pull/<n>` or `/<owner>/<repo>/issues/<n>`; what follows the number (a
 * tab, a comment anchor, a query) is ignored.
 */
export function parseGithubItemUrl(url: string | null | undefined): IGithubItemAddress | null {
	let parsed: URL;
	try {
		parsed = new URL(String(url ?? '').trim());
	} catch {
		return null;
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
	const host = parsed.hostname.toLowerCase();
	if (host !== 'github.com' && host !== 'www.github.com') return null;
	const [owner, repo, segment, number] = parsed.pathname.split('/').filter(Boolean);
	if (!owner || !repo || (segment !== 'pull' && segment !== 'issues') || !/^[1-9]\d{0,9}$/.test(number ?? ''))
		return null;
	return { owner: owner.toLowerCase(), repo: repo.toLowerCase(), number: Number(number) };
}

/** Whether two addresses name the same item (owner and repository compared lower case). */
export function sameGithubItem(a: IGithubItemAddress | null, b: IGithubItemAddress | null): boolean {
	return !!a && !!b && a.owner === b.owner && a.repo === b.repo && a.number === b.number;
}

/** The escape character of the `LIKE` patterns below (`ESCAPE '!'`: no owner or repository name holds it). */
export const GITHUB_ITEM_URL_LIKE_ESCAPE = '!';

/** A text matched literally inside a `LIKE` pattern escaped with {@link GITHUB_ITEM_URL_LIKE_ESCAPE}. */
function likeLiteral(text: string): string {
	return text.replace(/[!%_]/g, (character) => `${GITHUB_ITEM_URL_LIKE_ESCAPE}${character}`);
}

/**
 * The `LIKE` patterns (over the lower-cased address, `ESCAPE '!'`) that find the links naming an item: its pull request
 * and issue addresses, the number followed by nothing, a path, a query or an anchor — so `/pull/7` never pulls in
 * `/pull/70`. Each link found is still parsed and compared exactly.
 */
export function githubItemUrlPatterns(address: IGithubItemAddress): string[] {
	const repository = `%github.com/${likeLiteral(address.owner)}/${likeLiteral(address.repo)}/`;
	const patterns: string[] = [];
	for (const segment of ['pull', 'issues']) {
		const item = `${repository}${segment}/${address.number}`;
		patterns.push(item, `${item}/%`, `${item}?%`, `${item}#%`);
	}
	return patterns;
}

/** The task references a pull request's title and branch name, each once, title first. */
export function taskReferencesOfPullRequest(
	pullRequest: { title?: string | null; head?: { ref?: string | null } | null } | null | undefined
): string[] {
	const found: string[] = [];
	for (const text of [pullRequest?.title, pullRequest?.head?.ref]) {
		const pattern = new RegExp(PULL_REQUEST_REFERENCE.source, 'g');
		const source = String(text ?? '');
		for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
			const number = Number(match[2]);
			const reference = `${match[1]}-${number}`;
			if (number <= 0 || found.includes(reference)) continue;
			found.push(reference);
			if (found.length >= GITHUB_PULL_REQUEST_REFERENCES_MAX) return found;
		}
	}
	return found;
}
