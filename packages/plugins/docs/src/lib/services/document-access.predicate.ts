import { DocumentShareAccessEnum, DocumentVisibilityEnum, ID } from '@gauzy/contracts';

/**
 * The visibility + share composition rules of `08-permissions-security.md` §3 as PURE
 * functions — no ORM, no Nest imports — so the truth table can be unit-tested directly and
 * non-SQL consumers (detail reads, write checks, the chat `docs_read` refusal path) share
 * exactly one definition with the SQL predicate in `document-access.sql.ts`.
 *
 * The composition invariant (§3.3):
 *
 * ```
 * effectiveAccess = permission AND (visibility OR ownership OR adminOverride OR share)
 * ```
 *
 * A share NEVER substitutes for the permission: a subject without `DOCS_READ` reads
 * nothing, shared or not; a subject holding an `EDIT` share but not `DOCS_UPDATE` can only
 * view/comment.
 */

/** One share row as the predicates see it (the persisted `document_share` projection). */
export interface IDocumentAccessShare {
	employeeId?: ID | null;
	teamId?: ID | null;
	access: DocumentShareAccessEnum;
}

/** The minimal document projection the access predicates inspect. */
export interface IDocumentAccessRow {
	createdByUserId?: ID | null;
	visibility: DocumentVisibilityEnum;
	isLocked?: boolean;
	/** Share overlay rows of THIS document (already scoped to the document). */
	shares?: IDocumentAccessShare[] | null;
}

/** The requesting subject: identity + the permissions the guards already proved. */
export interface IDocumentAccessSubject {
	/** `RequestContext.currentUserId()` — ownership is user-identity based (§1.6). */
	userId?: ID | null;
	/** The subject's employee id, when it has one (share grants are employee/team scoped). */
	employeeId?: ID | null;
	/** Current team membership, resolved at evaluation time (never materialized). */
	teamIds?: ID[] | null;
	/** Holds `DOCS_READ`. */
	hasReadPermission: boolean;
	/** Holds `DOCS_MANAGE` (admin override — sees and mutates everything in scope). */
	hasManagePermission?: boolean;
	/** Holds `DOCS_UPDATE` (needed on top of an `EDIT` share for mutation). */
	hasUpdatePermission?: boolean;
}

/** Rank of the share access levels — `EDIT` implies `COMMENT` implies `VIEW`. */
const SHARE_ACCESS_RANK: Record<DocumentShareAccessEnum, number> = {
	[DocumentShareAccessEnum.VIEW]: 1,
	[DocumentShareAccessEnum.COMMENT]: 2,
	[DocumentShareAccessEnum.EDIT]: 3
};

/**
 * Whether one share row targets the given subject (employee grant, or a team the subject
 * is currently a member of).
 *
 * @param share The share row.
 * @param subject The requesting subject.
 * @returns True when the row grants to this subject.
 */
export function shareTargetsSubject(share: IDocumentAccessShare, subject: IDocumentAccessSubject): boolean {
	if (share.employeeId && subject.employeeId && share.employeeId === subject.employeeId) {
		return true;
	}
	if (share.teamId && subject.teamIds?.length) {
		return subject.teamIds.includes(share.teamId);
	}
	return false;
}

/**
 * The strongest share access the subject holds on the document, or `null` when no share
 * applies. Shares are an additive overlay on PRIVATE documents only — on ORGANIZATION
 * documents they have no effect in v1 (§3.3), so `null` is returned there as well.
 *
 * @param document The document projection (with its share rows).
 * @param subject The requesting subject.
 * @returns The highest applicable share access, or `null`.
 */
export function effectiveShareAccess(
	document: IDocumentAccessRow,
	subject: IDocumentAccessSubject
): DocumentShareAccessEnum | null {
	if (document.visibility !== DocumentVisibilityEnum.PRIVATE) {
		return null;
	}
	let best: DocumentShareAccessEnum | null = null;
	for (const share of document.shares ?? []) {
		if (!shareTargetsSubject(share, subject)) {
			continue;
		}
		if (!best || SHARE_ACCESS_RANK[share.access] > SHARE_ACCESS_RANK[best]) {
			best = share.access;
		}
	}
	return best;
}

/**
 * Whether the subject holds at least `minimum` through the share overlay.
 *
 * @param document The document projection.
 * @param subject The requesting subject.
 * @param minimum The minimum access required.
 * @returns True when a share of at least that level applies.
 */
export function hasShareAtLeast(
	document: IDocumentAccessRow,
	subject: IDocumentAccessSubject,
	minimum: DocumentShareAccessEnum
): boolean {
	const access = effectiveShareAccess(document, subject);
	return !!access && SHARE_ACCESS_RANK[access] >= SHARE_ACCESS_RANK[minimum];
}

/**
 * The §3.4 effective-read-access truth table:
 *
 * | # | `DOCS_READ` | Visibility   | Creator | `DOCS_MANAGE` | Share >= VIEW | Readable |
 * |---|-------------|--------------|---------|---------------|---------------|----------|
 * | 1 | no          | any          | any     | any           | any           | **No**   |
 * | 2 | yes         | ORGANIZATION | any     | any           | any           | **Yes**  |
 * | 3 | yes         | PRIVATE      | yes     | any           | any           | **Yes**  |
 * | 4 | yes         | PRIVATE      | no      | yes           | any           | **Yes**  |
 * | 5 | yes         | PRIVATE      | no      | no            | yes           | **Yes**  |
 * | 6 | yes         | PRIVATE      | no      | no            | no            | **No**   |
 *
 * Row 6 is a 404 on the wire — existence is never revealed.
 *
 * @param document The document projection.
 * @param subject The requesting subject.
 * @returns True when the row is readable by the subject.
 */
export function isDocumentReadable(document: IDocumentAccessRow, subject: IDocumentAccessSubject): boolean {
	// Row 1 — the permission gate is absolute; a share never substitutes for it.
	if (!subject.hasReadPermission) {
		return false;
	}
	// Row 2 — ORGANIZATION documents are readable org-wide.
	if (document.visibility !== DocumentVisibilityEnum.PRIVATE) {
		return true;
	}
	// Row 3 — the creator always reads their own PRIVATE documents.
	if (subject.userId && document.createdByUserId && document.createdByUserId === subject.userId) {
		return true;
	}
	// Row 4 — admin override.
	if (subject.hasManagePermission) {
		return true;
	}
	// Row 5 — the share overlay (any level implies VIEW).
	return hasShareAtLeast(document, subject, DocumentShareAccessEnum.VIEW);
}

/**
 * Write access per §3.4: readable AND the verb permission held AND
 * (owner OR `DOCS_MANAGE` OR an `EDIT` share). The lock check is deliberately NOT folded
 * in here — a locked-but-writable row is a 423, not a 403, and the callers distinguish the
 * two (`isDocumentLockedFor` below).
 *
 * @param document The document projection.
 * @param subject The requesting subject.
 * @returns True when the subject may mutate content/metadata of the row.
 */
export function isDocumentWritable(document: IDocumentAccessRow, subject: IDocumentAccessSubject): boolean {
	if (!isDocumentReadable(document, subject)) {
		return false;
	}
	if (!subject.hasUpdatePermission) {
		return false;
	}
	if (subject.hasManagePermission) {
		return true;
	}
	if (subject.userId && document.createdByUserId && document.createdByUserId === subject.userId) {
		return true;
	}
	return hasShareAtLeast(document, subject, DocumentShareAccessEnum.EDIT);
}

/**
 * Whether the document's lock blocks this subject. The lock is bypassed by the owner and
 * by `DOCS_MANAGE` holders (§3.4).
 *
 * @param document The document projection.
 * @param subject The requesting subject.
 * @returns True when the subject is blocked by the lock (423 `DOCS_LOCKED`).
 */
export function isDocumentLockedFor(document: IDocumentAccessRow, subject: IDocumentAccessSubject): boolean {
	if (!document.isLocked) {
		return false;
	}
	if (subject.hasManagePermission) {
		return false;
	}
	return !(subject.userId && document.createdByUserId && document.createdByUserId === subject.userId);
}

/**
 * Whether the subject may administer the share overlay of a document: the creator or a
 * `DOCS_MANAGE` holder only (§3.3 / §1.5). A share grantee — even at `EDIT` — can never
 * re-share.
 *
 * @param document The document projection.
 * @param subject The requesting subject.
 * @returns True when the subject may list/create/update/delete shares.
 */
export function canAdministerShares(document: IDocumentAccessRow, subject: IDocumentAccessSubject): boolean {
	if (subject.hasManagePermission) {
		return true;
	}
	return !!(subject.userId && document.createdByUserId && document.createdByUserId === subject.userId);
}
