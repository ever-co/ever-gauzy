import { IMenuItem } from './interface/menu-item.interface';

/** The menu entry that owns a URL: a top-level row, plus the sub-row inside it when there is one. */
export interface IActiveMenuMatch {
	item: IMenuItem;
	child: IMenuItem | null;
}

export function isSameMenuItem(a: IMenuItem | null | undefined, b: IMenuItem | null | undefined): boolean {
	if (!a || !b) {
		return false;
	}
	if (a === b) {
		return true;
	}
	return !!a.id && a.id === b.id;
}

/**
 * The path part of a router URL: query string and fragment dropped, trailing slash trimmed.
 *
 * @param url A router URL such as `/pages/employees/timesheets/daily?date=2026-11-03#top`.
 * @return {string} The bare path, e.g. `/pages/employees/timesheets/daily`.
 */
export function getUrlPath(url: string | null | undefined): string {
	const path = (url ?? '').split(/[?#]/)[0];
	return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/**
 * How specifically a menu entry claims a path, or -1 when it does not claim it at all.
 *
 * An entry claims its own link (and, with `pathMatch: 'prefix'`, everything below it) plus any
 * `data.activePaths`, which always cover everything below them — for a row that opens one page of
 * a section but owns all of it, like the Standard dashboard. The score is the length of the matched
 * path, so the most specific entry wins: an entry whose link IS the path always outscores one whose
 * link is merely the start of it. Hidden entries (filtered out by permissions or features) never
 * match, so they cannot steal the highlight from a row that is actually on screen.
 *
 * @param item The menu entry to test.
 * @param path A bare path, as returned by `getUrlPath`.
 * @return {number} The match score, -1 for no match.
 */
export function getMenuItemMatchScore(item: IMenuItem | null | undefined, path: string): number {
	if (!item || item.hidden) {
		return -1;
	}
	let score = item.link ? getPathMatchScore(getUrlPath(item.link), path, item.pathMatch === 'prefix') : -1;
	for (const activePath of item.data?.activePaths ?? []) {
		score = Math.max(score, getPathMatchScore(getUrlPath(activePath), path, true));
	}
	return score;
}

/** Length of `link` when it claims `path` (exactly, or as a parent of it when `prefix`), else -1. */
function getPathMatchScore(link: string, path: string, prefix: boolean): number {
	if (!link) {
		return -1;
	}
	if (path === link) {
		return link.length;
	}
	if (prefix && path.startsWith(`${link}/`)) {
		return link.length;
	}
	return -1;
}

/**
 * Find the menu entry that owns a URL.
 *
 * Only rows that navigate are considered: a leaf top-level row, or a sub-row of a parent. A parent
 * with visible children is a toggle, not a link (see MenuItemComponent.redirectTo), so its own link
 * never wins. Among the candidates the most specific link wins; when several tie (the same link
 * listed twice, e.g. under Favorites and under its own section), the current selection is kept if
 * it is one of them, otherwise the first in menu order is taken.
 *
 * @param items The top-level menu entries.
 * @param url The router URL to resolve.
 * @param current The entry selected right now, used to break ties.
 * @return {IActiveMenuMatch | null} The owning entry, or null when no entry claims the URL.
 */
export function findActiveMenuItem(
	items: IMenuItem[] | null | undefined,
	url: string,
	current?: IActiveMenuMatch | null
): IActiveMenuMatch | null {
	const path = getUrlPath(url);
	let best: IActiveMenuMatch | null = null;
	let bestScore = -1;

	for (const candidate of getNavigableMenuEntries(items)) {
		const score = getMenuItemMatchScore(candidate.child ?? candidate.item, path);
		if (score < 0 || score < bestScore) {
			continue;
		}
		if (score > bestScore || isSameMenuMatch(candidate, current)) {
			best = candidate;
			bestScore = score;
		}
	}

	return best;
}

/**
 * Whether two matches point at the same row (same parent and same sub-row, or both without one).
 */
export function isSameMenuMatch(a: IActiveMenuMatch | null | undefined, b: IActiveMenuMatch | null | undefined): boolean {
	if (!a || !b || !isSameMenuItem(a.item, b.item)) {
		return false;
	}
	return a.child || b.child ? isSameMenuItem(a.child, b.child) : true;
}

/**
 * The visible rows that navigate, in menu order: leaf top-level rows and the sub-rows of parents.
 */
function getNavigableMenuEntries(items: IMenuItem[] | null | undefined): IActiveMenuMatch[] {
	const entries: IActiveMenuMatch[] = [];
	for (const item of items ?? []) {
		if (!item || item.hidden) {
			continue;
		}
		const children = ((item.children ?? []) as IMenuItem[]).filter((child) => child && !child.hidden);
		if (children.length) {
			children.forEach((child) => entries.push({ item, child }));
		} else {
			entries.push({ item, child: null });
		}
	}
	return entries;
}
