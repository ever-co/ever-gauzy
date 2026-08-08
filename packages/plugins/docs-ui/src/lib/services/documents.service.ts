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
	IDocumentFindInput,
	IDocumentSettings,
	IDocumentSettingsDefaults,
	IDocumentUploadOptions,
	IDocumentUploadResponse,
	IDocumentsQueryParams,
	IKnowledgeStatus,
	toDocumentsQueryParams
} from '../models/docs-api.model';
import { IDocumentShareCreateInput, IDocumentShareUpdateInput } from '../models/docs-share.model';

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

	getFacets(params: IDocumentFindInput = {}): Observable<IDocumentFacets> {
		return this.http.get<IDocumentFacets>(`${this.API_URL}/documents/facets`, {
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

	getById(id: ID, relations: string[] = []): Observable<IDocument> {
		return this.http.get<IDocument>(`${this.API_URL}/documents/${id}`, { params: toParams({ relations }) });
	}

	// ─── Documents: write ────────────────────────────────────────

	create(input: IDocumentCreateInput): Observable<IDocument> {
		return this.http.post<IDocument>(`${this.API_URL}/documents`, input);
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
	 * Single-file convenience over `uploadMany()`: progress events pass through
	 * untouched and the terminal response is rewritten to carry the accepted
	 * document, so callers keep their `HttpEvent<IDocument>` contract.
	 *
	 * A per-file rejection is surfaced as an `HttpErrorResponse` carrying the
	 * backend's `{ code, message }` — the batch endpoint answers 201 even when it
	 * accepted nothing, so without this a rejected file would look like a success
	 * with an undefined document.
	 */
	upload(file: File, options: IDocumentUploadOptions): Observable<HttpEvent<IDocument>> {
		return this.uploadMany([file], options).pipe(
			map((event) => {
				if (event.type !== HttpEventType.Response) return event as HttpEvent<IDocument>;
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
				return response.clone({ body: accepted.document }) as HttpEvent<IDocument>;
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

	/**
	 * Endpoint path of the download route.
	 *
	 * @deprecated Not navigable — see {@link getDownloadUrl}. Kept only for
	 * templates that still bind it to an `href`; those bindings resolve to a 401
	 * and must move to `getDownloadUrl()` + `window.open(url, '_blank')`.
	 */
	downloadUrl(id: ID): string {
		return `${this.API_URL}/documents/${id}/download`;
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

	/** Archived-only. `mode` decides subtree deletion vs child promotion. */
	delete(id: ID, options: { mode: 'subtree' | 'promote-children' }): Observable<void> {
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
		return this.http.put<IDocument>(`${this.API_URL}/documents/${id}/content`, input);
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
			.get<IPagination<IDocumentLink>>(`${this.API_URL}/documents/${id}/links`)
			.pipe(map((result) => result?.items ?? []));
	}

	/**
	 * Links of a business record. `GetDocumentLinksQueryDTO` carries the
	 * organization scope, and the endpoint answers a pagination envelope.
	 */
	findLinks(entity: BaseEntityEnum, entityId: ID): Observable<IDocumentLink[]> {
		const organization = this.store.selectedOrganization;
		return this.http
			.get<IPagination<IDocumentLink>>(`${this.API_URL}/links`, {
				params: toParams({
					entity,
					entityId,
					...(organization?.id ? { organizationId: organization.id } : {}),
					...(organization?.tenantId ? { tenantId: organization.tenantId } : {})
				})
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

	/** Category catalog (each item carries `documentCount`). Unwraps the pagination envelope. */
	getCategories(): Observable<IDocumentCategory[]> {
		return this.http
			.get<IPagination<IDocumentCategory>>(`${this.API_URL}/categories`)
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

	/** Org defaults + read-only deployment capabilities (spec 03 §4.14). */
	getSettings(): Observable<IDocumentSettings> {
		return this.http.get<IDocumentSettings>(`${this.API_URL}/settings`);
	}

	/** Partial update of the org-defaults block only (`capabilities` is never writable). */
	updateSettings(input: Partial<IDocumentSettingsDefaults>): Observable<IDocumentSettings> {
		return this.http.put<IDocumentSettings>(`${this.API_URL}/settings`, input);
	}
}
