import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	ID,
	IDocument
} from '@gauzy/contracts';

/**
 * Plugin-local API models for the Wave-2 endpoints (facets, upload options, bulk,
 * settings). These mirror `03-backend-plugin.md`; they move to `@gauzy/contracts`
 * once the backend wave lands the shared DTOs.
 */

/** Archived-row handling — the wire values of `GetDocumentsQueryDTO.archived`. */
export type DocumentArchivedFilter = 'exclude' | 'include' | 'only';

/**
 * Sort fields the backend accepts.
 *
 * 🛑 WIRE values, `@IsIn`-validated on `GetDocumentsQueryDTO.sort`: anything else
 * (a composite `field:order` string, `index`, a column name) is a 400 that takes
 * the whole list, count and facets request down with it.
 */
export const DOCUMENT_SORT_FIELDS = ['name', 'updatedAt', 'createdAt', 'size', 'kind'] as const;
export type DocumentSortField = (typeof DOCUMENT_SORT_FIELDS)[number];

/**
 * Minimum `q` length the backend requires for `searchIn=content` (else 400
 * `DOCS_QUERY_TOO_SHORT`).
 *
 * 🛑 **The single client-side definition of that number** — `DOCS_CONTENT_SEARCH_MIN_CHARS`
 * in `docs.constants.ts` re-exports this one, and the filter bar's Content gate, its tooltip
 * (`DOCS.FILTERS.SEARCH_CONTENT_DISABLED`, which interpolates it) and the downgrade below all
 * read from here. A second, disagreeing copy is exactly how the gate came to advertise 2
 * while `DocumentService.buildFilters()` rejected anything under 3.
 */
export const DOCUMENT_CONTENT_SEARCH_MIN_CHARS = 3;

/** `PaginationQueryDTO.take` is `@Max(100)` — a larger window is a 400, not a bigger page. */
export const DOCUMENT_MAX_TAKE = 100;

/**
 * Caller-facing list/filter input. Deliberately more forgiving than the wire DTO
 * (booleans, arrays, a composite sort) — `toDocumentsQueryParams()` below is the
 * single place that reconciles it with `GetDocumentsQueryDTO`.
 */
export interface IDocumentFindInput {
	/** 🛑 The DTO's `kind` is a **scalar** — a multi-kind selection cannot be expressed server-side. */
	kind?: DocumentKindEnum | DocumentKindEnum[];
	status?: DocumentStatusEnum[];
	knowledgeStatus?: DocumentKnowledgeStatusEnum[];
	reviewStatus?: DocumentReviewStatusEnum[];
	source?: DocumentSourceEnum[];
	categoryIds?: ID[];
	tagIds?: ID[];
	visibility?: DocumentVisibilityEnum;
	/** `true`/`false` are mapped to `only`/`exclude`. */
	archived?: boolean | DocumentArchivedFilter;
	searchable?: boolean;
	/** `'root'` = top level; `null`/omitted = flat search across the whole tree. */
	parentId?: ID | 'root' | null;
	q?: string;
	searchIn?: 'name' | 'content';
	createdAtFrom?: string;
	createdAtTo?: string;
	updatedAtFrom?: string;
	updatedAtTo?: string;
	/** `'updatedAt'`, `'updatedAt:desc'` or `{ field, order }` — all normalized to `sort` + `sortOrder`. */
	sort?: string | { field: string; order: 'ASC' | 'DESC' };
	sortOrder?: 'ASC' | 'DESC';
	organizationId?: ID;
	tenantId?: ID;
	relations?: string[];
	/** 1-based **page number** (Gauzy convention: the API computes `offset = take × (skip − 1)`). */
	skip?: number;
	take?: number;
}

/**
 * The exact wire shape of `GET /documents`, `/count` and `/facets`.
 *
 * 🛑 Every key here exists on `GetDocumentsQueryDTO`
 * (`packages/plugins/docs/src/lib/dto/get-documents-query.dto.ts`) and nothing
 * else does: those routes run `ValidationPipe({ whitelist: true })`, so an
 * unknown key is silently dropped (a filter that quietly stops filtering) while
 * a *known* key with the wrong shape is a 400 that empties the hub.
 */
export interface IDocumentsQueryParams {
	kind?: DocumentKindEnum;
	status?: DocumentStatusEnum[];
	knowledgeStatus?: DocumentKnowledgeStatusEnum[];
	reviewStatus?: DocumentReviewStatusEnum[];
	needsReview?: boolean;
	source?: DocumentSourceEnum[];
	categoryIds?: ID[];
	tagIds?: ID[];
	visibility?: DocumentVisibilityEnum;
	archived?: DocumentArchivedFilter;
	searchable?: boolean;
	parentId?: ID | 'root';
	q?: string;
	searchIn?: 'name' | 'content';
	createdAtFrom?: string;
	createdAtTo?: string;
	updatedAtFrom?: string;
	updatedAtTo?: string;
	sort?: DocumentSortField;
	sortOrder?: 'ASC' | 'DESC';
	relations?: string[];
	skip?: number;
	take?: number;
	/**
	 * `BaseQueryDTO` declares `where` as `@IsNotEmpty()` — a request without it is
	 * a 400 before any handler runs — and `DocumentService.resolveOrganizationId()`
	 * reads the organization scope out of it (a top-level `organizationId` is not
	 * declared on the DTO, so `whitelist: true` strips it).
	 */
	where?: { organizationId?: ID; tenantId?: ID };
}

/** Keeps only a non-empty array (an empty one would serialize to nothing anyway). */
const listOrUndefined = <T>(values: T[] | undefined): T[] | undefined => (values?.length ? values : undefined);

/** Keeps only a non-empty string — `''` and `undefined` both mean "no value" here. */
const textOrUndefined = (value: string | undefined): string | undefined => value || undefined;

/** The wire values of `GetDocumentsQueryDTO.archived` (`@IsIn`-validated). */
const DOCUMENT_ARCHIVED_FILTERS: readonly DocumentArchivedFilter[] = ['exclude', 'include', 'only'];

/**
 * The DTO's `kind` is a **scalar** `@IsEnum`: a single-element selection unwraps
 * to it, a multi-kind one cannot be expressed and is dropped (a wider result set
 * beats a 400).
 */
function normalizeKind(kind: IDocumentFindInput['kind']): DocumentKindEnum | undefined {
	if (!Array.isArray(kind)) return kind;
	return kind.length === 1 ? kind[0] : undefined;
}

/** `true`/`false` map onto the DTO enum; an unrecognized value is dropped, not sent. */
function normalizeArchived(archived: IDocumentFindInput['archived']): DocumentArchivedFilter | undefined {
	if (typeof archived === 'boolean') return archived ? 'only' : 'exclude';
	if (archived && DOCUMENT_ARCHIVED_FILTERS.includes(archived)) return archived;
	return undefined;
}

/**
 * `searchIn` only ever travels with a query, and a content search below the
 * backend minimum is a 400 — degrade it to a name search instead.
 */
function normalizeSearchIn(
	q: string | undefined,
	searchIn: IDocumentFindInput['searchIn']
): IDocumentsQueryParams['searchIn'] {
	if (!q) return undefined;
	return searchIn === 'content' && q.length >= DOCUMENT_CONTENT_SEARCH_MIN_CHARS ? 'content' : 'name';
}

/**
 * Page window as `PaginationQueryDTO` accepts it: `skip` is a 1-based page number
 * and `take` is `@Max(100)` — a larger window is a 400, not a bigger page.
 */
function normalizeWindow(skip?: number, take?: number): { skip?: number; take?: number } {
	return {
		skip: typeof skip === 'number' && skip > 0 ? Math.floor(skip) : undefined,
		take: typeof take === 'number' && take > 0 ? Math.min(Math.floor(take), DOCUMENT_MAX_TAKE) : undefined
	};
}

/**
 * Only ever sent WITH an organization: `TenantOrganizationBaseDTO` requires
 * `organizationId` (or an `organization` object), so a tenant-only `where` is a 400.
 */
function buildQueryScope(organizationId?: ID, tenantId?: ID): IDocumentsQueryParams['where'] {
	if (!organizationId) return undefined;
	return tenantId ? { organizationId, tenantId } : { organizationId };
}

/** `toParams()` serializes `undefined` as the literal string "undefined" — prune first. */
function pruneUndefined(params: IDocumentsQueryParams): IDocumentsQueryParams {
	(Object.keys(params) as (keyof IDocumentsQueryParams)[]).forEach((key) => {
		if (params[key] === undefined) delete params[key];
	});
	return params;
}

/** Splits `'updatedAt:desc'` / `{ field, order }` / `'updatedAt'` into the two wire params. */
function normalizeSort(
	sort: IDocumentFindInput['sort'],
	sortOrder?: 'ASC' | 'DESC'
): { sort?: DocumentSortField; sortOrder?: 'ASC' | 'DESC' } {
	if (!sort) return {};
	const field = typeof sort === 'string' ? sort.split(':')[0] : sort.field;
	const rawOrder = typeof sort === 'string' ? sort.split(':')[1] : sort.order;
	const order = String(rawOrder ?? sortOrder ?? '').toUpperCase();
	if (!DOCUMENT_SORT_FIELDS.includes(field as DocumentSortField)) return {};
	return {
		sort: field as DocumentSortField,
		sortOrder: order === 'ASC' || order === 'DESC' ? order : undefined
	};
}

/**
 * Reconciles a caller's filter input with `GetDocumentsQueryDTO`.
 *
 * Applied by `DocumentsService` on every list/count/facets call so no call site
 * can drift from the backend contract again. Values the DTO cannot express are
 * dropped rather than sent — a dropped filter is a wider result set, a rejected
 * one is an empty hub.
 */
export function toDocumentsQueryParams(input: IDocumentFindInput = {}): IDocumentsQueryParams {
	const q = textOrUndefined(input.q?.trim());
	const params: IDocumentsQueryParams = {
		kind: normalizeKind(input.kind),
		status: listOrUndefined(input.status),
		knowledgeStatus: listOrUndefined(input.knowledgeStatus),
		reviewStatus: listOrUndefined(input.reviewStatus),
		source: listOrUndefined(input.source),
		categoryIds: listOrUndefined(input.categoryIds),
		tagIds: listOrUndefined(input.tagIds),
		visibility: input.visibility,
		archived: normalizeArchived(input.archived),
		searchable: typeof input.searchable === 'boolean' ? input.searchable : undefined,
		// `null` means "no folder scope" (flat search); only `'root'` is the top level.
		parentId: input.parentId === null ? undefined : input.parentId,
		q,
		searchIn: normalizeSearchIn(q, input.searchIn),
		createdAtFrom: textOrUndefined(input.createdAtFrom),
		createdAtTo: textOrUndefined(input.createdAtTo),
		updatedAtFrom: textOrUndefined(input.updatedAtFrom),
		updatedAtTo: textOrUndefined(input.updatedAtTo),
		...normalizeSort(input.sort, input.sortOrder),
		relations: listOrUndefined(input.relations),
		...normalizeWindow(input.skip, input.take),
		where: buildQueryScope(input.organizationId, input.tenantId)
	};

	return pruneUndefined(params);
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

/**
 * Options collected by the classification dialog and sent with each upload.
 *
 * 🛑 Only the fields `UploadDocumentsDTO` declares reach the server — the upload
 * route runs `ValidationPipe({ whitelist: true })`, so anything else is dropped
 * on the floor. `DocumentsService.upload()` sends exactly the accepted set.
 */
export interface IDocumentUploadOptions {
	parentId?: ID | null;
	categoryIds?: ID[];
	tagIds?: ID[];
	/**
	 * Real DTO field — the "Classify with AI" toggle of the classification dialog.
	 * Per-upload override of the org setting `autoClassify`: `false` skips the
	 * `docs.classify` stage for this batch, omitted follows the organization.
	 */
	classifyWithAi?: boolean;
	/** Real DTO field. Default = org setting `importToKnowledgeDefault`. */
	importToKnowledge?: boolean;
	visibility?: DocumentVisibilityEnum;
	/** Upload provenance — the editor pipeline sends `EDITOR` (spec 05 §6.6). */
	source?: DocumentSourceEnum;
	organizationId?: ID;
	tenantId?: ID;
}

/** One accepted file of an upload batch (mirrors the backend `IDocumentUploadResult`). */
export interface IDocumentUploadResult {
	document: IDocument;
	/** Set when an active document in the same tenant+organization has the same sha256. */
	duplicateOfId?: ID;
}

/** One rejected file of an upload batch — its bytes were never persisted. */
export interface IDocumentUploadRejection {
	fileName: string;
	code: string;
	message: string;
}

/**
 * The 201 envelope of `POST /documents/upload`.
 *
 * 🛑 The endpoint is a **batch** endpoint (multipart field `files`, 1–10 files)
 * and always answers with per-file accept/reject results — never with a bare
 * document.
 */
export interface IDocumentUploadResponse {
	results: IDocumentUploadResult[];
	rejected: IDocumentUploadRejection[];
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
