// cspell:ignore wikilink wikilinks unfiled
import { DocumentReviewReasonEnum, DocumentReviewStatusEnum } from '@gauzy/contracts';
import { EverWorksKbDocument, EverWorksKbDocumentClass, KB_DOCUMENT_CLASSES, KB_LIMITS } from './ever-works-kb.types';

/**
 * The field map between an Ever Works Knowledge Base document and a Gauzy Docs PAGE (plan 05 §2), as
 * pure functions: placement, paths, review state, metadata and the snapshot the sync compares with.
 */

/** `document.externalSource` of the rows the docs sync writes (plan 05 §2: the upsert key with the EW id). */
export const EVER_WORKS_DOCS_SOURCE = 'ever_works';

/** The name of the root folder synced documents land in (plan 05 §1). */
export const EVER_WORKS_DOCS_ROOT_NAME = 'Ever Works';
export const EVER_WORKS_DOCS_ORGANIZATION_NAME = 'Organization';
export const EVER_WORKS_DOCS_WORKS_NAME = 'Works';

/**
 * `externalId` markers of the folders the sync keeps (with {@link EVER_WORKS_DOCS_SOURCE}): the root, its
 * Organization and Works folders, one folder per Work, and each Ever Works library folder. A synced
 * document carries its Ever Works id.
 */
export const DOCS_TREE = {
	root: 'tree:root',
	organization: 'tree:organization',
	works: 'tree:works',
	work: (workId: string) => `tree:work:${workId}`,
	folder: (folderId: string) => `folder:${folderId}`
} as const;

/** Where a Gauzy document sits in the synced tree. */
export type DocsPlacement =
	| {
			area: 'organization';
			/** The Ever Works library folder of the nearest linked Gauzy folder above it; `null` = Unfiled. */
			ewFolderId: string | null;
			/** Folder names between the Organization folder and the document (for the path). */
			segments: string[];
	  }
	| { area: 'work'; workId: string; segments: string[] };

/** The shared fields of a document pair at the last sync (the merge base of both directions). */
export interface DocSnapshot {
	title?: string;
	description?: string | null;
	/** {@link markdownHash} of Ever Works' body at the last sync. */
	eHash?: string;
	/** {@link markdownHash} of Gauzy's page (as Markdown) at the last sync. */
	gHash?: string;
	/** `contentJsonHash` of Gauzy's stored page at the last sync: an edit the Markdown cannot show moves it (review F92). */
	jHash?: string;
	/** The page sits in another area than its Ever Works document (a move Ever Works cannot make), logged once (review F95). */
	movedAcross?: boolean;
	/** The Ever Works library folder (organization documents). */
	ewFolderId?: string | null;
	status?: EverWorksKbDocument['status'];
	reviewState?: EverWorksKbDocument['reviewState'];
	locked?: boolean;
}

/** What only Ever Works has, kept on the link. */
export interface DocEverWorksOnly {
	scope?: EverWorksKbDocument['scope'];
	workId?: string | null;
	path?: string;
	slug?: string;
	class?: string;
	lockMode?: EverWorksKbDocument['lockMode'];
	revision?: number;
	language?: string;
	source?: string;
	webUrl?: string | null;
}

/** The shared fields of a folder pair at the last sync. */
export interface FolderSnapshot {
	name?: string;
	/** The Ever Works parent folder; `null` = top level. */
	ewParentId?: string | null;
}

/** Gauzy's review state of an Ever Works one (plan 05 §2: proposed → PENDING, accepted → APPROVED). */
export function gauzyReviewOf(document: Pick<EverWorksKbDocument, 'reviewState' | 'source'>): {
	reviewStatus: DocumentReviewStatusEnum;
	reviewReason: DocumentReviewReasonEnum | null;
} {
	if (document.reviewState === 'proposed')
		return {
			reviewStatus: DocumentReviewStatusEnum.PENDING,
			// An agent's proposal shows in the review queue as AI-generated.
			reviewReason: document.source === 'agent' ? DocumentReviewReasonEnum.AI_GENERATED : DocumentReviewReasonEnum.MANUAL
		};
	if (document.reviewState === 'accepted') return { reviewStatus: DocumentReviewStatusEnum.APPROVED, reviewReason: null };
	return { reviewStatus: DocumentReviewStatusEnum.NONE, reviewReason: null };
}

/** The `metadata.everWorks` block of a synced page (read-only in Gauzy: class, tags, language, decision, path). */
export function everWorksMetadataOf(document: EverWorksKbDocument): Record<string, unknown> {
	return {
		class: document.class,
		tags: document.tags ?? [],
		categories: document.categories ?? [],
		language: document.language ?? null,
		status: document.status,
		path: document.path,
		lockMode: document.lockMode ?? null,
		decision: document.decision ?? null,
		webUrl: document.webUrl ?? null
	};
}

/** The row's metadata with the `everWorks` block replaced; everything else in it (AI, review, migration) is kept. */
export function mergeMetadata(existing: unknown, everWorks: Record<string, unknown>): Record<string, unknown> {
	let base: Record<string, unknown> = {};
	if (typeof existing === 'string') {
		try {
			base = JSON.parse(existing) as Record<string, unknown>;
		} catch {
			base = {};
		}
	} else if (existing && typeof existing === 'object' && !Array.isArray(existing)) base = existing as Record<string, unknown>;
	return { ...base, everWorks };
}

/** The `metadata.everWorks` block of a row, or `{}`. */
export function everWorksBlockOf(metadata: unknown): Record<string, unknown> {
	const parsed = typeof metadata === 'string' ? safeParse(metadata) : metadata;
	const block = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>)['everWorks'] : undefined;
	return block && typeof block === 'object' && !Array.isArray(block) ? (block as Record<string, unknown>) : {};
}

function safeParse(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

/** The class a Gauzy page is created with in Ever Works: its synced class if valid, else `freeform` (plan 05 §2). */
export function everWorksClassOf(metadata: unknown): EverWorksKbDocumentClass {
	const value = everWorksBlockOf(metadata)['class'];
	return typeof value === 'string' && (KB_DOCUMENT_CLASSES as readonly string[]).includes(value) ? (value as EverWorksKbDocumentClass) : 'freeform';
}

/** A path segment from a Gauzy name: lower case, ASCII letters, digits and dashes (`Refund Policy` → `refund-policy`). */
export function slugOf(name: string | null | undefined, fallback = 'document'): string {
	const slug = String(name ?? '')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '');
	return slug || fallback;
}

/**
 * The Ever Works `path` of a Gauzy page (plan 05 §2: derived from the folder chain under the root). An
 * organization document is relative to the library (`support/refund-policy.md`); a Work document starts
 * with its class folder, as Ever Works requires (`freeform/notes/refund-policy.md`). `suffix` makes it
 * unique when the plain path is taken. At most 512 characters (folder segments are dropped first).
 */
export function documentPathOf(placement: DocsPlacement, name: string, kind: EverWorksKbDocumentClass, suffix?: string): string {
	const file = `${slugOf(name)}${suffix ? `-${slugOf(suffix, 'x').slice(0, 12)}` : ''}.md`;
	const folders = placement.segments.map((segment) => slugOf(segment, 'folder'));
	const prefix = placement.area === 'work' ? [kind] : [];
	let parts = [...prefix, ...folders, file];
	while (parts.join('/').length > KB_LIMITS.path && parts.length > prefix.length + 1) parts = [...prefix, ...parts.slice(prefix.length + 1)];
	return parts.join('/').slice(0, KB_LIMITS.path);
}

/** Text cut to a contract limit (on a code point boundary). */
export function cut(text: string | null | undefined, max: number): string {
	const value = String(text ?? '');
	if (value.length <= max) return value;
	let out = '';
	for (const char of value) {
		if (out.length + char.length > max) break;
		out += char;
	}
	return out;
}

/** A Gauzy description (500 characters) from an Ever Works one. */
export function gauzyDescriptionOf(description: string | null | undefined): string | null {
	const value = (description ?? '').trim();
	return value ? cut(value, 500) : null;
}

/** The archived state of an Ever Works document (`status: archived`, or an `archivedAt`). */
export function isEverWorksArchived(document: Pick<EverWorksKbDocument, 'status' | 'archivedAt'>): boolean {
	return document.status === 'archived' || !!document.archivedAt;
}
