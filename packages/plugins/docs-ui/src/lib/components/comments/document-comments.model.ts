import { IComment, ID, IEmployee } from '@gauzy/contracts';

/**
 * Pure helpers behind the document comment thread. They are deliberately free of
 * Angular and of the HTTP layer so the threading, mention-token and mention-id
 * rules can be tested on their own — those are the parts that silently rot (a
 * dropped reply, a `mentionEmployeeIds` array that no longer matches the text,
 * and the backend fans notifications out from that array alone).
 */

/** One root comment plus its (single-level) replies — the backend threads by `parentId`. */
export interface ICommentThreadNode {
	comment: IComment;
	replies: IComment[];
}

/** An employee the author picked from the `@` menu, remembered by the label written into the text. */
export interface IMentionCandidate {
	id: ID;
	label: string;
}

/** An active `@…` token in the composer: where it starts and what has been typed after it. */
export interface IMentionToken {
	/** Index of the `@` character. */
	start: number;
	/** Text between the `@` and the caret. */
	query: string;
}

export const MENTION_TRIGGER = '@';
/** Past this length the token is prose, not a name being typed — the menu closes. */
export const MENTION_QUERY_MAX_LENGTH = 40;
export const MENTION_SUGGESTION_LIMIT = 8;

/**
 * Display name for an employee, mirroring `employee-mention.suggestion.ts` so a
 * mention typed in the editor and one typed in a comment read identically.
 */
export function employeeMentionLabel(employee?: IEmployee | null): string {
	return (
		employee?.fullName ||
		employee?.user?.name ||
		[employee?.user?.firstName, employee?.user?.lastName].filter(Boolean).join(' ') ||
		employee?.user?.email ||
		String(employee?.id ?? '')
	);
}

/** Oldest first — a thread reads top-to-bottom, unlike the newest-first activity list. */
function byCreatedAtAscending(left: IComment, right: IComment): number {
	return new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime();
}

/**
 * Groups a flat comment page into roots + replies.
 *
 * 🛑 A reply whose parent is NOT in the page (the parent was deleted — the FK is
 * `ON DELETE SET NULL`, but a page boundary can do it too) is promoted to a root
 * rather than dropped: a comment that exists but renders nowhere is worse than
 * one that renders at the wrong indent.
 */
export function buildCommentThread(comments: IComment[]): ICommentThreadNode[] {
	const present = new Set(comments.map((comment) => String(comment.id)));
	const repliesByParent = new Map<string, IComment[]>();
	const roots: IComment[] = [];

	for (const comment of comments) {
		const parentId = comment.parentId ? String(comment.parentId) : null;
		if (parentId && present.has(parentId)) {
			const siblings = repliesByParent.get(parentId) ?? [];
			siblings.push(comment);
			repliesByParent.set(parentId, siblings);
		} else {
			roots.push(comment);
		}
	}

	return roots
		.sort(byCreatedAtAscending)
		.map((comment) => ({
			comment,
			replies: (repliesByParent.get(String(comment.id)) ?? []).sort(byCreatedAtAscending)
		}));
}

/**
 * Finds the `@…` token the caret sits in, or `null` when there is none.
 *
 * The trigger only counts at a word boundary, so an e-mail address in the middle
 * of a sentence never opens the menu.
 */
export function detectMentionToken(text: string, caret: number): IMentionToken | null {
	if (caret < 0 || caret > text.length) return null;
	const start = text.lastIndexOf(MENTION_TRIGGER, caret - 1);
	if (start < 0) return null;

	const before = start === 0 ? '' : text.charAt(start - 1);
	if (before && !/\s/.test(before)) return null;

	const query = text.slice(start + 1, caret);
	if (query.length > MENTION_QUERY_MAX_LENGTH || /[\n\r]/.test(query)) return null;

	return { start, query };
}

/** Replaces the active token with `@Label ` and reports where the caret lands. */
export function applyMentionPick(
	text: string,
	token: IMentionToken,
	caret: number,
	label: string
): { text: string; caret: number } {
	const inserted = `${MENTION_TRIGGER}${label} `;
	return {
		text: `${text.slice(0, token.start)}${inserted}${text.slice(caret)}`,
		caret: token.start + inserted.length
	};
}

/**
 * The `mentionEmployeeIds` the create/update DTO carries.
 *
 * Only picks whose label is STILL present in the text are reported: the author
 * may have deleted the `@Name` again before posting, and notifying someone who
 * is not in the comment they receive is the one failure mode worth designing
 * against here. Ids are de-duplicated — `Mention` rows are per (entity, employee).
 */
export function collectMentionEmployeeIds(text: string, picked: readonly IMentionCandidate[]): ID[] {
	const ids = new Set<string>();
	for (const candidate of picked) {
		if (candidate.label && text.includes(`${MENTION_TRIGGER}${candidate.label}`)) {
			ids.add(String(candidate.id));
		}
	}
	return [...ids] as ID[];
}

/** Case-insensitive label filter for the `@` menu, capped so the popup stays a popup. */
export function filterMentionCandidates(
	employees: IEmployee[],
	query: string,
	limit: number = MENTION_SUGGESTION_LIMIT
): IMentionCandidate[] {
	const normalized = (query ?? '').trim().toLowerCase();
	return employees
		.map((employee) => ({ id: employee.id as ID, label: employeeMentionLabel(employee) }))
		.filter((candidate) => !!candidate.label && (!normalized || candidate.label.toLowerCase().includes(normalized)))
		.slice(0, limit);
}
