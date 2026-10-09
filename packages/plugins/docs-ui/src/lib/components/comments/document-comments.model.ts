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

/**
 * Marker that anchors a comment to an editor block (spec 05 §8 — the UniqueID `blockId`).
 *
 * 🛑 The spec's wording is "opens the standard comment thread UI with `metadata: { blockId }`",
 * but the platform `Comment` entity **has no `metadata` column** (verified against
 * `packages/core/src/lib/comment/comment.entity.ts`) and `CreateCommentDTO` is built with
 * `IntersectionType(TenantOrganizationBaseDTO, Comment, MentionEmployeeIdsDTO)` under a
 * whitelisting `ValidationPipe` — an extra `metadata` property is silently dropped on the way
 * in. Until a `metadata` column (or a docs-side anchor table) lands, the anchor rides in the
 * one field that is guaranteed to persist verbatim: the comment body's first line.
 *
 * Every docs-ui surface reads bodies through `commentBody()`, so the marker never reaches a
 * reader; it does survive into notification e-mails, which is the known cost of this shim and
 * the reason the durable fix is written up in the handoff note.
 */
export const BLOCK_ANCHOR_PATTERN = /^\[\[block:([A-Za-z0-9._:-]{1,128})\]\]\r?\n?/;

/** A comment body split into its block anchor and the text a human wrote. */
export interface IAnchoredCommentBody {
	/** The `blockId` the comment is anchored to, or `null` for a document-level comment. */
	blockId: string | null;
	/** The body without the marker — what every view renders and every editor seeds. */
	body: string;
}

/** Splits a stored comment body into `{ blockId, body }`. */
export function parseBlockAnchor(comment: string | null | undefined): IAnchoredCommentBody {
	const text = comment ?? '';
	const match = BLOCK_ANCHOR_PATTERN.exec(text);
	if (!match) return { blockId: null, body: text };
	return { blockId: match[1], body: text.slice(match[0].length) };
}

/**
 * Stamps the anchor back onto a body before it goes over the wire.
 *
 * Idempotent: an edit seeded with `commentBody()` and re-stamped here keeps exactly one
 * marker, and a `null` blockId writes a plain document-level comment.
 */
export function withBlockAnchor(blockId: string | null | undefined, body: string): string {
	const clean = parseBlockAnchor(body).body;
	return blockId ? `[[block:${blockId}]]\n${clean}` : clean;
}

/** The block a comment is anchored to (`null` = document-level). */
export function commentBlockId(comment: Pick<IComment, 'comment'> | null | undefined): string | null {
	return parseBlockAnchor(comment?.comment).blockId;
}

/** The readable body of a comment — never shows the anchor marker. */
export function commentBody(comment: Pick<IComment, 'comment'> | null | undefined): string {
	return parseBlockAnchor(comment?.comment).body;
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
 * The block anchors that still have an **unresolved** comment.
 *
 * Drives the editor's decoration gutter (spec 05 §8): a thread everyone resolved should stop
 * marking the block, but the thread itself stays readable in the panel. A reply is counted
 * against its own anchor — replies inherit the root's marker because
 * `BlockCommentThreadComponent` stamps it onto every post.
 */
export function openBlockAnchors(comments: readonly IComment[]): string[] {
	const open = new Set<string>();
	for (const comment of comments) {
		if (comment?.resolved) continue;
		const blockId = commentBlockId(comment);
		if (blockId) open.add(blockId);
	}
	return [...open];
}

/**
 * Groups anchored comments by their block, preserving the input order within each block.
 * Document-level comments (no anchor) are not represented — they belong to the detail
 * panel's thread, not to a block.
 */
export function groupCommentsByBlock(comments: readonly IComment[]): Map<string, IComment[]> {
	const byBlock = new Map<string, IComment[]>();
	for (const comment of comments) {
		const blockId = commentBlockId(comment);
		if (!blockId) continue;
		const bucket = byBlock.get(blockId) ?? [];
		bucket.push(comment);
		byBlock.set(blockId, bucket);
	}
	return byBlock;
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
