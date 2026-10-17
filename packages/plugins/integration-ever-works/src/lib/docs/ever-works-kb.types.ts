/**
 * The Ever Works Knowledge Base as the integration contract serves it (contract v1-draft.6, CR-7,
 * ever-works `docs/specs/features/integrations-api-v1/contract/schemas/resources/kb-document.schema.json`
 * and `kb-folder.schema.json`; routes in B.6 "KB", scopes `kb:read` / `kb:write`).
 */

/** Document classes (every class may live at organization scope; only legal, style and seo inherit into Works). */
export const KB_DOCUMENT_CLASSES = [
	'brand',
	'legal',
	'seo',
	'style',
	'glossary',
	'competitors',
	'personas',
	'research',
	'output',
	'freeform',
	'decision'
] as const;

export type EverWorksKbDocumentClass = (typeof KB_DOCUMENT_CLASSES)[number];

/** Where a document lives: the organization library, or one Work of the organization. */
export interface EverWorksKbScope {
	type: 'organization' | 'work';
	/** The organization id, or the Work id. */
	id: string;
}

/**
 * One Knowledge Base document (`GET /kb/documents[/:id]`, and the data of `kb.document.*` events). Not a
 * ResourceBase: no owner, visibility or teams of its own. `revision` moves only on a content change;
 * `version` (the ETag) on every recorded change. An event whose body is over 256 KiB carries
 * `body: null, bodyOmitted: true` (read the document for it).
 */
export interface EverWorksKbDocument {
	id: string;
	organizationId: string;
	version: number;
	createdAt: string;
	updatedAt: string;
	scope: EverWorksKbScope;
	workId: string | null;
	/** The organization library folder it is filed in; `null` = Unfiled. */
	folderId: string | null;
	/** Relative to the knowledge base root, e.g. `brand/voice.md`. */
	path: string;
	slug: string;
	title: string;
	description: string | null;
	class: EverWorksKbDocumentClass | string;
	tags: string[];
	categories: string[];
	status: 'draft' | 'active' | 'archived';
	/** `proposed` = written by an agent, waiting for a person; `null` on rows that predate review. */
	reviewState: 'proposed' | 'accepted' | null;
	locked: boolean;
	lockMode: 'full' | 'additions-only' | null;
	language: string;
	/** Open set (`user`, `agent`, `imported`, `seeded`, …). */
	source: string;
	/** The Markdown body; `null` only with `bodyOmitted` in an event. */
	body: string | null;
	bodyOmitted?: true;
	revision: number;
	revisionAt: string | null;
	normalizedContentHash: string | null;
	/** The decision lifecycle of a decision-class document (read-only), else `null`. */
	decision: Record<string, unknown> | null;
	createdById: string | null;
	updatedById: string | null;
	archivedAt: string | null;
	wordCount: number | null;
	webUrl?: string | null;
	/** Only on `kb.document.deleted`. */
	deleted?: true;
}

/**
 * One folder of the organization library (`GET /kb/folders[/:id]`, and the data of `kb.folder.*`
 * events). A rename or move rewrites the whole subtree's paths (`kb.folder.updated` for each); a delete
 * removes its subfolders and moves their documents to Unfiled (`kb.document.moved` for each).
 */
export interface EverWorksKbFolder {
	id: string;
	organizationId: string;
	version: number;
	createdAt: string;
	updatedAt: string;
	name: string;
	/** `null` = a top-level folder. */
	parentId: string | null;
	/** The folder chain, e.g. `/Playbooks/Support`. */
	path: string;
	createdById: string;
	webUrl?: string | null;
	/** Only on `kb.folder.deleted`. */
	deleted?: true;
}

/** `POST /kb/documents` (`CreateKbDocument`; `Idempotency-Key` required, `externalRef` de-duplicates). */
export interface EverWorksKbDocumentCreate {
	scope: EverWorksKbScope;
	folderId?: string | null;
	path: string;
	title: string;
	class: EverWorksKbDocumentClass;
	body: string;
	description?: string | null;
	tags?: string[];
	categories?: string[];
	language?: string;
	status?: 'draft' | 'active';
	externalRef?: { source: string; installationId?: string | null; externalId: string; externalUrl?: string | null };
}

/** `PATCH /kb/documents/:id` (`UpdateKbDocument`; at least one field). */
export interface EverWorksKbDocumentUpdate {
	title?: string;
	body?: string;
	description?: string | null;
	class?: EverWorksKbDocumentClass;
	tags?: string[];
	categories?: string[];
	language?: string;
	status?: 'draft' | 'active';
}

/** Contract limits of the KB request bodies (`requests.schema.json`). */
export const KB_LIMITS = {
	title: 255,
	path: 512,
	body: 1_000_000,
	description: 4000,
	tags: 50,
	tag: 100,
	folderName: 120
} as const;
