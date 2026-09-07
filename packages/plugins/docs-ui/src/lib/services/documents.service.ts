import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
	ID,
	IDocument,
	IDocumentCategory,
	IDocumentCreateInput,
	IDocumentLink,
	IDocumentLinkCreateInput,
	IDocumentMoveInput,
	IDocumentShare,
	IDocumentUpdateInput,
	IDocumentVersion,
	IPagination,
	BaseEntityEnum
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import {
	IDocumentBulkInput,
	IDocumentBulkResult,
	IDocumentContentUpdateInput,
	IDocumentFacets,
	IDocumentFacetsWire,
	IDocumentFindInput,
	IDocumentSettings,
	IDocumentSettingsDefaults,
	IDocumentStats,
	IDocumentUploadOptions,
	IDocumentUploadResponse,
	IDocumentUploadResult,
	IDocumentsQueryParams,
	IKnowledgeStatus,
	normalizeDocumentFacets,
	toDocumentsQueryParams
} from '../models/docs-api.model';
import { IDocumentShareCreateInput, IDocumentShareUpdateInput } from '../models/docs-share.model';

/**
 * One segment of the server-resolved ancestor chain (`GET /documents/:id/path`).
 *
 * 🛑 `id` is **nullable**: an ancestor the caller may not read is redacted to
 * `{ id: null, restricted: true }` rather than omitted, so the breadcrumb keeps
 * its depth without leaking the folder's name (`08-permissions-security.md`
 * §3.2). A consumer that treats a segment as clickable must check `restricted`
 * (and a present `id`) first.
 */
export interface IDocumentPathSegment {
	/** `null` when the segment is redacted. */
	id: ID | null;
	name?: string;
	restricted?: boolean;
}

/**
 * HTTP client for the Documents backend plugin (`@gauzy/plugin-docs`).
 * One method per endpoint — `03-backend-plugin.md` is authoritative for DTO
 * shapes and query params; provided at module level so it dies with the chunk.
 *
 * 🛑 The list/count/facets trio funnels every caller through
 * `toDocumentsQueryParams()` (models/docs-api.model.ts) rather than passing the
 * caller's object to `toParams()` verbatim: `GetDocumentsQueryDTO` runs under
 * `ValidationPipe({ whitelist: true })`, where a *known* param with the wrong
 * shape (a boolean `archived`, a composite `sort`, an array `kind`) is a 400
 * that blanks the hub, and an *unknown* param is dropped silently.
 */
@Injectable()
export class DocumentsService {
	private readonly API_URL = `${API_PREFIX}/plugins/docs`;

	constructor(private readonly http: HttpClient, private readonly store: Store) {}

	// ─── Documents: read ─────────────────────────────────────────

	getAll(params: IDocumentFindInput = {}): Observable<IPagination<IDocument>> {
		return this.http.get<IPagination<IDocument>>(`${this.API_URL}/documents`, {
			params: toParams(this.toQueryParams(params))
		});
	}

	getCount(params: IDocumentFindInput = {}): Observable<number> {
		return this.http.get<number>(`${this.API_URL}/documents/count`, {
			params: toParams(this.toQueryParams(params))
		});
	}

	/**
	 * 🛑 Mapped through `normalizeDocumentFacets`: the endpoint answers enum facets
	 * as `Record<value, count>` maps and categories/tags as `{ id, name, count }`
	 * rows — this single funnel is what keeps every consumer on `{ value, label,
	 * count }` buckets (stored raw, per-option counts never rendered and the
	 * Category/Tag options bound `undefined` values).
	 */
	getFacets(params: IDocumentFindInput = {}): Observable<IDocumentFacets> {
		return this.http
			.get<IDocumentFacetsWire>(`${this.API_URL}/documents/facets`, {
				params: toParams(this.toQueryParams(params))
			})
			.pipe(map(normalizeDocumentFacets));
	}

	/**
	 * Org-global stats for the hub tiles (`GET /documents/stats`). The endpoint
	 * ignores filters beyond the mandatory `where` scope — tile numbers stay put
	 * while the user filters. Callers treat any failure (incl. 404 on a deployment
	 * that predates the route) as "hide the tiles", never as an error surface.
	 */
	getStats(params: IDocumentFindInput = {}): Observable<IDocumentStats> {
		return this.http.get<IDocumentStats>(`${this.API_URL}/documents/stats`, {
			params: toParams(this.toQueryParams(params))
		});
	}

	/**
	 * Normalizes a caller's filter input into the wire DTO, defaulting the
	 * organization scope from the selected organization.
	 *
	 * The scope is NOT optional: `BaseQueryDTO.where` is `@IsNotEmpty()`, and
	 * `DocumentService.resolveOrganizationId()` reads the organization out of
	 * `where` because a top-level `organizationId` is not declared on the query
	 * DTO and `whitelist: true` strips it.
	 */
	private toQueryParams(params: IDocumentFindInput): IDocumentsQueryParams {
		const organization = this.store.selectedOrganization;
		return toDocumentsQueryParams({
			...params,
			organizationId: params.organizationId ?? (organization?.id as ID),
			tenantId: params.tenantId ?? (organization?.tenantId as ID)
		});
	}

	/**
	 * The selected organization's scope as wire params for the DETAIL endpoints (single read,
	 * settings, links). Unlike the list trio, those endpoints fall back to the token's
	 * organization when none is sent — null for a non-employee admin (400
	 * `DOCS_ORGANIZATION_REQUIRED` on every detail read), stale when the UI browses another
	 * organization of the tenant (404 on rows the list just showed). Absent values are omitted
	 * entirely: `toParams()` serializes `undefined` as the literal string "undefined".
	 */
	private organizationScope(): { organizationId?: ID; tenantId?: ID } {
		const organization = this.store.selectedOrganization;
		return {
			...(organization?.id ? { organizationId: organization.id as ID } : {}),
			...(organization?.tenantId ? { tenantId: organization.tenantId as ID } : {})
		};
	}

	getById(id: ID, relations: string[] = []): Observable<IDocument> {
		return this.http.get<IDocument>(`${this.API_URL}/documents/${id}`, {
			params: toParams({ relations, ...this.organizationScope() })
		});
	}

	/**
	 * Ancestor chain of one document, **root → the document itself**.
	 *
	 * Resolving it client-side needs one `GET /documents/:id` per level and still
	 * cannot represent an ancestor the caller may not read — it simply disappears,
	 * which silently shortens the path. The server walks the chain in one call and
	 * substitutes `{ id: null, restricted: true }` for every redacted segment
	 * (`08-permissions-security.md` §3.2).
	 *
	 * 🛑 Deployments that predate the route answer 404, so every caller MUST keep a
	 * local fallback — losing the breadcrumb also loses the only way back out of a
	 * deep-linked folder.
	 */
	getPath(id: ID): Observable<IDocumentPathSegment[]> {
		return this.http
			.get<IDocumentPathSegment[] | IPagination<IDocumentPathSegment>>(`${this.API_URL}/documents/${id}/path`)
			.pipe(map((result) => (Array.isArray(result) ? result : result?.items ?? [])));
	}

	// ─── Documents: write ────────────────────────────────────────

	create(input: IDocumentCreateInput): Observable<IDocument> {
		// `CreateDocumentDTO` extends `TenantOrganizationBaseDTO`, whose `organizationId`
		// is required when no `organization` object is sent — the dialogs do not carry one,
		// so default the scope from the selected organization (same as `uploadMany`).
		// Without it every "New folder" / "New page" is a validation 400.
		const organization = this.store.selectedOrganization;
		return this.http.post<IDocument>(`${this.API_URL}/documents`, {
			...input,
			organizationId: input.organizationId ?? (organization?.id as ID),
			tenantId: input.tenantId ?? (organization?.tenantId as ID)
		});
	}

	update(id: ID, input: IDocumentUpdateInput): Observable<IDocument> {
		return this.http.put<IDocument>(`${this.API_URL}/documents/${id}`, input);
	}

	/**
	 * Multipart batch upload with progress events.
	 *
	 * 🛑 The multipart field is **`files`** (that is what `LazyFilesInterceptor`
	 * binds) and the 201 body is the `{ results, rejected }` envelope — never a
	 * bare document. Only fields `UploadDocumentsDTO` declares are appended;
	 * anything else would be stripped by `whitelist: true` anyway, and appending
	 * it would only make a dead control look alive. Conversely, every toggle the
	 * classification dialog offers MUST be listed here: `importToKnowledge` and
	 * `classifyWithAi` are both real DTO fields, and a toggle that is not sent is
	 * a control that does nothing.
	 */
	uploadMany(files: File[], options: IDocumentUploadOptions): Observable<HttpEvent<IDocumentUploadResponse>> {
		const formData = new FormData();
		files.forEach((file) => formData.append('files', file, file.name));

		const organization = this.store.selectedOrganization;
		const fields: Record<string, unknown> = {
			parentId: options?.parentId,
			visibility: options?.visibility,
			categoryIds: options?.categoryIds,
			tagIds: options?.tagIds,
			importToKnowledge: options?.importToKnowledge,
			classifyWithAi: options?.classifyWithAi,
			source: options?.source,
			// `TenantOrganizationBaseDTO` requires an organization — the dialogs do not carry one.
			organizationId: options?.organizationId ?? organization?.id,
			tenantId: options?.tenantId ?? organization?.tenantId
		};
		Object.entries(fields).forEach(([key, value]) => {
			if (value === undefined || value === null) return;
			if (Array.isArray(value)) {
				if (!value.length) return;
				formData.append(key, value.join(','));
				return;
			}
			formData.append(key, String(value));
		});

		return this.http.post<IDocumentUploadResponse>(`${this.API_URL}/documents/upload`, formData, {
			reportProgress: true,
			observe: 'events'
		});
	}

	/**
	 * Single-file upload keeping the batch envelope's **per-file result**: progress
	 * events pass through untouched and the terminal response carries
	 * `{ document, duplicateOfId? }`.
	 *
	 * 🛑 `duplicateOfId` (the advisory in-org sha256 match, `R-UPL-04`) lives ONLY
	 * on this envelope — it is not a column on the document — so anything that wants
	 * to show the "possible duplicate" notice has to read it here. {@link upload}
	 * narrows the same stream to the bare document for callers that only need the row.
	 *
	 * A per-file rejection is surfaced as an `HttpErrorResponse` carrying the
	 * backend's `{ code, message }` — the batch endpoint answers 201 even when it
	 * accepted nothing, so without this a rejected file would look like a success
	 * with an undefined document.
	 */
	uploadOne(file: File, options: IDocumentUploadOptions): Observable<HttpEvent<IDocumentUploadResult>> {
		return this.uploadMany([file], options).pipe(
			map((event) => {
				if (event.type !== HttpEventType.Response) return event as HttpEvent<IDocumentUploadResult>;
				const response = event as HttpResponse<IDocumentUploadResponse>;
				const accepted = response.body?.results?.[0];
				if (!accepted?.document) {
					const rejection = response.body?.rejected?.[0];
					throw new HttpErrorResponse({
						status: response.status,
						statusText: response.statusText,
						url: response.url ?? undefined,
						error: {
							code: rejection?.code ?? 'DOCS_UPLOAD_REJECTED',
							message: rejection?.message ?? 'The file was rejected by the server'
						}
					});
				}
				return response.clone({ body: accepted }) as HttpEvent<IDocumentUploadResult>;
			})
		);
	}

	/**
	 * Single-file convenience over {@link uploadOne}: the terminal response is
	 * rewritten to carry just the accepted document, so callers keep their
	 * `HttpEvent<IDocument>` contract.
	 */
	upload(file: File, options: IDocumentUploadOptions): Observable<HttpEvent<IDocument>> {
		return this.uploadOne(file, options).pipe(
			map((event) => {
				if (event.type !== HttpEventType.Response) return event as HttpEvent<IDocument>;
				const response = event as HttpResponse<IDocumentUploadResult>;
				return response.clone({ body: response.body?.document }) as HttpEvent<IDocument>;
			})
		);
	}

	/**
	 * Resolves a short-lived provider URL for a FILE document's bytes.
	 *
	 * `GET /:id/download` answers `{ url }` **as JSON behind the JWT guard** — it
	 * is not a redirect, so it can only be reached through the authenticated
	 * `HttpClient`; navigating to it directly (`window.open`) sends no token and
	 * lands on a 401 page.
	 */
	getDownloadUrl(id: ID): Observable<string> {
		return this.http
			.get<{ url: string }>(`${this.API_URL}/documents/${id}/download`)
			.pipe(map((result) => result?.url ?? ''));
	}

	move(id: ID, input: IDocumentMoveInput): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/move`, input);
	}

	duplicate(id: ID, options: { deep?: boolean } = {}): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/duplicate`, options);
	}

	archive(id: ID): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/archive`, {});
	}

	unarchive(id: ID): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/unarchive`, {});
	}

	/**
	 * Archived-only. `strategy` decides subtree deletion vs child promotion.
	 *
	 * 🛑 The param is **`strategy`** — that is what `DeleteDocumentQueryDTO`
	 * declares, and the route runs under `ValidationPipe({ whitelist: true })`, so
	 * any other name (this used to send `mode`) is stripped without an error and
	 * the handler falls back to `strategy ?? 'subtree'`. The caller's choice then
	 * looks honoured while every delete silently cascades over the subtree.
	 */
	delete(id: ID, options: { strategy: 'subtree' | 'promote-children' }): Observable<void> {
		return this.http.delete<void>(`${this.API_URL}/documents/${id}`, { params: toParams(options) });
	}

	recover(id: ID): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/recover`, {});
	}

	// ─── Processing / extraction ─────────────────────────────────

	reprocess(id: ID): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/reprocess`, {});
	}

	getExtractedText(id: ID): Observable<{ extractedText: string; extractedTextEdited: boolean }> {
		return this.http.get<{ extractedText: string; extractedTextEdited: boolean }>(
			`${this.API_URL}/documents/${id}/extracted-text`
		);
	}

	updateExtractedText(id: ID, extractedText: string): Observable<IDocument> {
		return this.http.put<IDocument>(`${this.API_URL}/documents/${id}/extracted-text`, { extractedText });
	}

	/**
	 * PAGE content.
	 *
	 * 🛑 There is **no `GET /documents/:id/content`** — the content route is
	 * `PUT`-only (`DocumentController.updateContent`). The columns ride along on
	 * the single-document read instead: `GET /documents/:id` returns the full
	 * entity, unlike the *list* projection, which deliberately never selects
	 * `contentJson`/`contentHtml`. Reading the missing route 404'd, and every
	 * caller swallowed it — which is how export and print silently produced
	 * empty output for pages that were not open in an editor.
	 */
	getContent(id: ID): Observable<{ contentJson?: unknown; contentHtml?: string }> {
		return this.getById(id).pipe(
			map((document) => ({ contentJson: document?.contentJson, contentHtml: document?.contentHtml }))
		);
	}

	/**
	 * PAGE content save (spec 05 §9.2): optimistic concurrency via
	 * `expectedUpdatedAt` — stale token → 409 `DOCS_CONTENT_CONFLICT`, locked
	 * document → 423 `DOCS_LOCKED`. `forceSnapshot` bypasses the version debounce.
	 */
	updateContent(id: ID, input: IDocumentContentUpdateInput): Observable<IDocument> {
		// The content route resolves its scope from the token when the body carries none — the
		// same null/stale token-org failure as `getById`, but on the SAVE path, where it surfaces
		// as autosave silently dying. Body fields rather than query params: JSON serialization
		// drops `undefined`, so an absent scope is simply not sent.
		const organization = this.store.selectedOrganization;
		return this.http.put<IDocument>(`${this.API_URL}/documents/${id}/content`, {
			...input,
			organizationId: input.organizationId ?? (organization?.id as ID),
			tenantId: input.tenantId ?? (organization?.tenantId as ID)
		});
	}

	/** Stable app-relative authenticated inline stream URL (spec 05 §6.6 — persisted as image `src`). */
	rawUrl(id: ID): string {
		return `${this.API_URL}/documents/${id}/raw`;
	}

	/**
	 * Fetches the original binary through the authenticated HTTP client (the
	 * JWT interceptor rides along, unlike a bare `<img src>`). The preview modal
	 * turns the blob into an object URL.
	 */
	getRawBlob(id: ID): Observable<Blob> {
		return this.http.get(this.rawUrl(id), { responseType: 'blob' });
	}

	// ─── AI knowledge ────────────────────────────────────────────

	knowledgeImport(id: ID): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/knowledge/import`, {});
	}

	knowledgeExclude(id: ID): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/knowledge/exclude`, {});
	}

	reindex(id: ID, options: { force?: boolean } = {}): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/knowledge/reindex`, options);
	}

	/** Deployment/index capability probe (spec 03 §4.8) — cosmetic, fail silently. */
	getKnowledgeStatus(): Observable<IKnowledgeStatus> {
		return this.http.get<IKnowledgeStatus>(`${this.API_URL}/knowledge/status`);
	}

	/** Re-runs the classify-summary job (`summary` + `aiConfidence`) — requires AI enabled. */
	regenerateSummary(id: ID): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/summary/regenerate`, {});
	}

	// ─── Review ──────────────────────────────────────────────────

	approveReview(id: ID, input: { note?: string } = {}): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/review/approve`, input);
	}

	rejectReview(id: ID, input: { reason?: string } = {}): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/review/reject`, input);
	}

	/**
	 * Manual review request (`DOCS_UPDATE`) — moves the document to
	 * `reviewStatus=PENDING` with `reviewReason='manual'`. The optional `reason`
	 * is stored on the review metadata. Already-PENDING is a 200 no-op, so the
	 * callers gate on the status rather than relying on an error.
	 */
	requestReview(id: ID, input: { reason?: string } = {}): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/review/request`, input);
	}

	// ─── Versions ────────────────────────────────────────────────

	/** Paginated version history, newest first (list projection has no content columns). */
	getVersions(id: ID): Observable<IPagination<IDocumentVersion>> {
		return this.http.get<IPagination<IDocumentVersion>>(`${this.API_URL}/documents/${id}/versions`);
	}

	/** One full snapshot incl. `contentJson`/`contentHtml`. */
	getVersion(id: ID, versionId: ID): Observable<IDocumentVersion> {
		return this.http.get<IDocumentVersion>(`${this.API_URL}/documents/${id}/versions/${versionId}`);
	}

	restoreVersion(id: ID, versionId: ID): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents/${id}/versions/${versionId}/restore`, {});
	}

	// ─── Links ───────────────────────────────────────────────────

	/** Links of one document. The endpoint answers `IPagination<IDocumentLink>` — unwrapped here. */
	getLinks(id: ID): Observable<IDocumentLink[]> {
		return this.http
			.get<IPagination<IDocumentLink>>(`${this.API_URL}/documents/${id}/links`, {
				params: toParams(this.organizationScope())
			})
			.pipe(map((result) => result?.items ?? []));
	}

	/**
	 * Links of a business record. `GetDocumentLinksQueryDTO` carries the
	 * organization scope, and the endpoint answers a pagination envelope.
	 */
	findLinks(entity: BaseEntityEnum, entityId: ID): Observable<IDocumentLink[]> {
		return this.http
			.get<IPagination<IDocumentLink>>(`${this.API_URL}/links`, {
				params: toParams({ entity, entityId, ...this.organizationScope() })
			})
			.pipe(map((result) => result?.items ?? []));
	}

	createLink(input: IDocumentLinkCreateInput): Observable<IDocumentLink> {
		return this.http.post<IDocumentLink>(`${this.API_URL}/links`, input);
	}

	deleteLink(linkId: ID): Observable<void> {
		return this.http.delete<void>(`${this.API_URL}/links/${linkId}`);
	}

	// ─── Shares (spec 03 §4.12 / 08 §3) ──────────────────────────

	/**
	 * Share overlay for a PRIVATE document. `DOCS_READ`, but the backend's
	 * visibility scope means only the creator and `DOCS_MANAGE` holders ever see
	 * a non-404 here. On a deployment that predates the P1 share endpoints this
	 * 404s too — callers feature-detect rather than surfacing an error.
	 */
	getShares(id: ID): Observable<IDocumentShare[]> {
		return this.http
			.get<IDocumentShare[] | IPagination<IDocumentShare>>(`${this.API_URL}/documents/${id}/shares`)
			.pipe(map((result) => (Array.isArray(result) ? result : result?.items ?? [])));
	}

	/**
	 * `DOCS_UPDATE`. Exactly one of `employeeId` / `teamId` — both or neither is
	 * 400 `DOCS_SHARE_TARGET`; an ORGANIZATION-visible document is 409
	 * `DOCS_SHARE_NOT_PRIVATE`; a duplicate target is 409.
	 */
	createShare(id: ID, input: IDocumentShareCreateInput): Observable<IDocumentShare> {
		return this.http.post<IDocumentShare>(`${this.API_URL}/documents/${id}/shares`, input);
	}

	/** `DOCS_UPDATE`. Access level is the only mutable field on a share row. */
	updateShare(id: ID, shareId: ID, input: IDocumentShareUpdateInput): Observable<IDocumentShare> {
		return this.http.put<IDocumentShare>(`${this.API_URL}/documents/${id}/shares/${shareId}`, input);
	}

	/** `DOCS_UPDATE`. Revokes one share row (the subject keeps org-level access). */
	deleteShare(id: ID, shareId: ID): Observable<void> {
		return this.http.delete<void>(`${this.API_URL}/documents/${id}/shares/${shareId}`);
	}

	// ─── Bulk ────────────────────────────────────────────────────

	/**
	 * 🛑 `POST /documents/bulk` validates with `forbidNonWhitelisted: true`, and
	 * `BulkDocumentActionDTO` declares **no organization scope** (the handler
	 * takes it from the request context). An `organizationId`/`tenantId` on the
	 * body is therefore a 400 for the whole batch, not a stripped extra — they
	 * are dropped here so no caller can smuggle one in.
	 */
	bulk(input: IDocumentBulkInput): Observable<IDocumentBulkResult> {
		const payload = { ...(input ?? ({} as IDocumentBulkInput)) };
		delete payload.organizationId;
		delete payload.tenantId;
		return this.http.post<IDocumentBulkResult>(`${this.API_URL}/documents/bulk`, payload);
	}

	// ─── Categories ──────────────────────────────────────────────

	/**
	 * Category catalog (each item carries `documentCount`). Unwraps the pagination envelope.
	 *
	 * The scope goes inside `where`, like the list trio, for two reasons that both bite: the route
	 * types its query as `BaseQueryDTO`, whose `where` is `@IsNotEmpty()`, so sending nothing at all
	 * answered EVERY call with `400 {"message":["where should not be empty"]}` — and because every
	 * caller wraps this in `catchError(() => of([]))`, the catalog just came back silently empty
	 * instead of erroring. And `whitelist: true` strips a top-level `organizationId`, while
	 * `DocumentCategoryService.getCategories()` reads `params.organizationId ?? params.where
	 * .organizationId` — so `where` is also the only place the scope survives the pipe.
	 */
	getCategories(): Observable<IDocumentCategory[]> {
		return this.http
			.get<IPagination<IDocumentCategory>>(`${this.API_URL}/categories`, {
				params: toParams({ where: this.organizationScope() })
			})
			.pipe(map((result) => result?.items ?? []));
	}

	createCategory(input: Partial<IDocumentCategory>): Observable<IDocumentCategory> {
		return this.http.post<IDocumentCategory>(`${this.API_URL}/categories`, input);
	}

	updateCategory(id: ID, input: Partial<IDocumentCategory>): Observable<IDocumentCategory> {
		return this.http.put<IDocumentCategory>(`${this.API_URL}/categories/${id}`, input);
	}

	deleteCategory(id: ID): Observable<void> {
		return this.http.delete<void>(`${this.API_URL}/categories/${id}`);
	}

	mergeCategory(id: ID, targetId: ID): Observable<void> {
		return this.http.post<void>(`${this.API_URL}/categories/${id}/merge`, { targetId });
	}

	// ─── Settings ────────────────────────────────────────────────

	/**
	 * Org defaults + read-only deployment capabilities (spec 03 §4.14). The scope params matter:
	 * `DocumentSettingsQueryDTO` accepts them, and without them the controller falls back to the
	 * token's organization — null for a non-employee admin, which blanks the settings page.
	 */
	getSettings(): Observable<IDocumentSettings> {
		return this.http.get<IDocumentSettings>(`${this.API_URL}/settings`, {
			params: toParams(this.organizationScope())
		});
	}

	/** Partial update of the org-defaults block only (`capabilities` is never writable). */
	updateSettings(input: Partial<IDocumentSettingsDefaults>): Observable<IDocumentSettings> {
		return this.http.put<IDocumentSettings>(`${this.API_URL}/settings`, input, {
			params: toParams(this.organizationScope())
		});
	}
}
