import { CHAT_DRAFT_UPLOAD_TTL_HOURS, DocumentKindEnum, DocumentSourceEnum, DocumentVisibilityEnum, ID } from '@gauzy/contracts';

/** How often the sweep of expired draft uploads runs in each API process (a claimed draft is swept once, whoever runs). */
export const CHAT_DRAFT_SWEEP_INTERVAL_MS = 30 * 60 * 1000;
/** The most drafts one pass sweeps (the next pass takes the rest). */
export const CHAT_DRAFT_SWEEP_BATCH = 100;

/** The draft TTL in hours: `GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS` when it is a whole number from 1 to 720, else 24. */
export function draftUploadTtlHours(env: Record<string, string | undefined> = process.env): number {
	const raw = env['GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS'];
	const value = raw === undefined || raw === '' ? NaN : Number(raw);
	return Number.isInteger(value) && value >= 1 && value <= 720 ? value : CHAT_DRAFT_UPLOAD_TTL_HOURS;
}

/** Whether the sweep runs: on unless `GAUZY_CHAT_DRAFT_SWEEP_ENABLED` is exactly `false` (the discard route works either way). */
export function isDraftSweepEnabled(env: Record<string, string | undefined> = process.env): boolean {
	return env['GAUZY_CHAT_DRAFT_SWEEP_ENABLED'] !== 'false';
}

/** The columns of a `document` row the draft rules read (raw, as an insert event or a find hands them over). */
export interface IChatDraftDocument {
	id?: ID | null;
	tenantId?: ID | null;
	organizationId?: ID | null;
	kind?: string | null;
	source?: string | null;
	visibility?: string | null;
	parentId?: ID | null;
	createdByUserId?: ID | null;
	storageProvider?: string | null;
	storageKey?: string | null;
	thumbKey?: string | null;
	/** Archived in Docs: its owner kept it on purpose. */
	isArchived?: boolean | null;
	/** Moved to the Docs trash (recoverable there): never purged by the sweep. */
	deletedAt?: Date | string | null;
	/** An object, or its JSON on SQLite (whose text column takes no object). */
	metadata?: unknown;
}

/** A document's metadata as an object (SQLite stores it as JSON text); empty when it holds none or no JSON. */
export function metadataOf(value: unknown): Record<string, unknown> {
	if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
	if (typeof value === 'string' && value.trim().startsWith('{')) {
		try {
			const parsed = JSON.parse(value);
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
		} catch {
			return {};
		}
	}
	return {};
}

/**
 * Whether a document just stored is a chat composer's upload: a FILE the Docs upload route stored (it writes
 * `metadata.upload`) with the source a chat client states (`CHAT`), by a signed-in user. A file a capture path
 * writes with the same source (its provenance is `metadata.chat`) is not one: nobody composes it, nobody discards it.
 */
export function isChatComposerUpload(document: IChatDraftDocument | null | undefined): boolean {
	if (!document?.id || !document.tenantId || !document.createdByUserId) return false;
	if (document.kind !== DocumentKindEnum.FILE || document.source !== DocumentSourceEnum.CHAT) return false;
	const metadata = metadataOf(document.metadata);
	return !!metadata['upload'] && !metadata['chat'];
}

/**
 * Whether a draft's document is still the upload its uploader left: a chat FILE of theirs, private, outside the
 * documents tree, neither archived nor in the trash. A file its owner adopted in Docs since (moved into a folder,
 * shared with the organization or a team, archived, or put in the trash, which Docs can restore it from) is theirs to
 * keep, and is never swept.
 */
export function isUntouchedDraft(document: IChatDraftDocument, uploaderUserId: ID): boolean {
	return (
		document.kind === DocumentKindEnum.FILE &&
		document.source === DocumentSourceEnum.CHAT &&
		String(document.createdByUserId ?? '') === String(uploaderUserId) &&
		document.visibility === DocumentVisibilityEnum.PRIVATE &&
		!document.parentId &&
		!document.isArchived &&
		!document.deletedAt
	);
}

/** The stored keys of a document (its file, its thumbnail), each once. */
export function storedKeysOf(document: Pick<IChatDraftDocument, 'storageKey' | 'thumbKey'>): string[] {
	return [...new Set([document.storageKey, document.thumbKey].filter((key): key is string => typeof key === 'string' && key.trim().length > 0))];
}

/**
 * Whether a stored key may be handed to a storage provider to delete: no traversal segment, no absolute path, no
 * drive letter, no control character (the Docs plugin's key-shape guard).
 */
export function isSafeStoredKey(key: string): boolean {
	const normalized = String(key ?? '').replace(/\\/g, '/');
	if (!normalized || [...normalized].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)) return false;
	if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return false;
	return !normalized.split('/').includes('..');
}
