import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	ID
} from '@gauzy/contracts';

/**
 * Plugin-local API models for the Wave-2 endpoints (facets, upload options, bulk,
 * settings). These mirror `03-backend-plugin.md`; they move to `@gauzy/contracts`
 * once the backend wave lands the shared DTOs.
 */

/** List/filter query params accepted by every list endpoint. */
export interface IDocumentFindInput {
	kind?: DocumentKindEnum[];
	status?: DocumentStatusEnum[];
	knowledgeStatus?: DocumentKnowledgeStatusEnum[];
	reviewStatus?: DocumentReviewStatusEnum[];
	source?: DocumentSourceEnum[];
	categoryIds?: ID[];
	tagIds?: ID[];
	visibility?: DocumentVisibilityEnum;
	archived?: boolean;
	searchable?: boolean;
	parentId?: ID | null;
	q?: string;
	searchIn?: 'name' | 'content';
	createdFrom?: string;
	createdTo?: string;
	updatedFrom?: string;
	updatedTo?: string;
	sort?: string;
	organizationId?: ID;
	tenantId?: ID;
	relations?: string[];
}

/** One facet bucket: value + display label + count under current filters. */
export interface IDocumentFacetBucket {
	value: string;
	label?: string;
	count: number;
}

/** Facet response for the filter bar + preset chips. */
export interface IDocumentFacets {
	kind: IDocumentFacetBucket[];
	status: IDocumentFacetBucket[];
	knowledgeStatus: IDocumentFacetBucket[];
	reviewStatus: IDocumentFacetBucket[];
	source: IDocumentFacetBucket[];
	categories: IDocumentFacetBucket[];
	tags: IDocumentFacetBucket[];
	presets?: {
		all?: number;
		needsReview?: number;
		notInKnowledge?: number;
		archived?: number;
	};
}

/** Options collected by the classification dialog and sent with each upload. */
export interface IDocumentUploadOptions {
	parentId?: ID | null;
	categoryIds?: ID[];
	tagIds?: ID[];
	classifyWithAi?: boolean;
	importToKnowledge?: boolean;
	visibility?: DocumentVisibilityEnum;
	/** Upload provenance — the editor pipeline sends `EDITOR` (spec 05 §6.6). */
	source?: DocumentSourceEnum;
	organizationId?: ID;
	tenantId?: ID;
}

/** PAGE content save payload for `PUT /documents/:id/content` (spec 05 §9.2). */
export interface IDocumentContentUpdateInput {
	contentJson: unknown;
	contentHtml?: string;
	/** Optimistic-concurrency token: the `updatedAt` the editor last loaded/saved. */
	expectedUpdatedAt: string;
	/** True bypasses the version-snapshot debounce ("Save version now"). */
	forceSnapshot?: boolean;
	/** Distinct employee-mention ids currently in the doc (mention diff-sync). */
	mentionEmployeeIds?: ID[];
}

/**
 * Bulk actions supported by `POST /documents/bulk`.
 *
 * 🛑 These are the WIRE values — they must stay identical to the backend's
 * `DocumentBulkActionEnum` (`packages/plugins/docs/src/lib/dto/bulk-action.dto.ts`),
 * which is `@IsEnum`-validated: anything else is rejected with a 400 before any
 * work happens.
 */
export type DocumentBulkAction =
	| 'ARCHIVE'
	| 'UNARCHIVE'
	| 'DELETE'
	| 'MOVE'
	| 'SET_CATEGORIES'
	| 'ADD_TAGS'
	| 'REMOVE_TAGS'
	| 'KNOWLEDGE_IMPORT'
	| 'KNOWLEDGE_EXCLUDE'
	| 'REVIEW_APPROVE'
	| 'REVIEW_REJECT';

/** Bulk request payload (≤ 200 ids). */
export interface IDocumentBulkInput {
	action: DocumentBulkAction;
	ids: ID[];
	parentId?: ID | null;
	categoryIds?: ID[];
	tagIds?: ID[];
	reason?: string;
	organizationId?: ID;
	tenantId?: ID;
}

/**
 * Per-id bulk result row. Field names mirror the backend DTO exactly: `ok` (not
 * `success`) and a machine `code` (e.g. `DOCS_REVIEW_NOT_PENDING`) rather than a
 * prose message.
 */
export interface IDocumentBulkResultItem {
	id: ID;
	ok: boolean;
	code?: string;
}

/** Bulk response: totals + per-id report (one HTTP 200, per-id partial failure). */
export interface IDocumentBulkResult {
	requested: number;
	succeeded: number;
	failed: number;
	results: IDocumentBulkResultItem[];
}

/** Writable org-defaults block of the Documents settings (spec 03 §4.14). */
export interface IDocumentSettingsDefaults {
	importToKnowledgeDefault: boolean;
	defaultVisibility: DocumentVisibilityEnum;
	autoClassify: boolean;
}

/** Read-only deployment capabilities reported by `GET /settings` (never writable). */
export interface IDocumentSettingsCapabilities {
	aiEnabled: boolean;
	vectorSearch: boolean;
	embeddingModel: string;
	maxFileSize: number;
	acceptedTypes: string[];
}

/**
 * Per-organization storage usage block (`08-permissions-security.md` §5.7, P1).
 *
 * 🛑 **Optional on purpose.** Quota is a P1 backend feature: a deployment whose
 * `GET /settings` predates it simply omits the block and every quota affordance
 * stays hidden (`normalizeDocumentStorage` below returns `null`). Never render a
 * usage bar from an assumed zero — "0 of 0 bytes" reads as a hard-full quota.
 */
export interface IDocumentSettingsStorage {
	/** `SUM(fileSize)` over all non-purged documents (archived + trashed included). */
	usedBytes: number;
	/** Org quota in bytes; `null` (or 0 on the wire) means unlimited. */
	quotaBytes: number | null;
}

/** Full `GET /api/plugins/docs/settings` response shape (spec 03 §4.14). */
export interface IDocumentSettings {
	defaults: IDocumentSettingsDefaults;
	capabilities: IDocumentSettingsCapabilities;
	/** P1 quota block — absent on deployments that predate §5.7. */
	storage?: IDocumentSettingsStorage;
}

/**
 * Reads the storage block out of a settings response tolerantly.
 *
 * The backend wave lands `storage` alongside `capabilities`; older/alternative
 * shapes have been seen flattening it onto `capabilities`, so both are accepted.
 * Returns `null` — meaning "this deployment does not report quota" — unless a
 * real numeric `usedBytes` is present. A quota of `0`/absent means *unlimited*
 * (§5.7), which is normalized to `quotaBytes: null` so callers only have to test
 * for null.
 */
export function normalizeDocumentStorage(
	settings: IDocumentSettings | null | undefined
): IDocumentSettingsStorage | null {
	if (!settings) return null;
	const flat = settings.capabilities as Partial<Record<'storageUsedBytes' | 'storageQuotaBytes', unknown>> | undefined;
	const used = settings.storage?.usedBytes ?? flat?.storageUsedBytes;
	if (typeof used !== 'number' || !Number.isFinite(used) || used < 0) return null;
	const rawQuota = settings.storage?.quotaBytes ?? flat?.storageQuotaBytes;
	const quotaBytes = typeof rawQuota === 'number' && Number.isFinite(rawQuota) && rawQuota > 0 ? rawQuota : null;
	return { usedBytes: used, quotaBytes };
}

/** Response of `GET /api/plugins/docs/knowledge/status` (spec 03 §4.8). */
export interface IKnowledgeStatus {
	vectorCapable: boolean;
	embeddingProviderConfigured: boolean;
	embeddingModel: string;
}
