import { HttpClient, HttpEvent } from '@angular/common/http';
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
import {
	IDocumentBulkInput,
	IDocumentBulkResult,
	IDocumentContentUpdateInput,
	IDocumentFacets,
	IDocumentFindInput,
	IDocumentSettings,
	IDocumentSettingsDefaults,
	IDocumentUploadOptions,
	IKnowledgeStatus
} from '../models/docs-api.model';
import { IDocumentShareCreateInput, IDocumentShareUpdateInput } from '../models/docs-share.model';

/**
 * HTTP client for the Documents backend plugin (`@gauzy/plugin-docs`).
 * One method per endpoint — `03-backend-plugin.md` is authoritative for DTO
 * shapes and query params; provided at module level so it dies with the chunk.
 */
@Injectable()
export class DocumentsService {
	private readonly API_URL = `${API_PREFIX}/plugins/docs`;

	constructor(private readonly http: HttpClient) {}

	// ─── Documents: read ─────────────────────────────────────────

	getAll(params: IDocumentFindInput & { skip?: number; take?: number }): Observable<IPagination<IDocument>> {
		return this.http.get<IPagination<IDocument>>(`${this.API_URL}/documents`, { params: toParams(params) });
	}

	getCount(params: IDocumentFindInput): Observable<number> {
		return this.http.get<number>(`${this.API_URL}/documents/count`, { params: toParams(params) });
	}

	getFacets(params: IDocumentFindInput): Observable<IDocumentFacets> {
		return this.http.get<IDocumentFacets>(`${this.API_URL}/documents/facets`, { params: toParams(params) });
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

	/** Multipart upload with progress events — one request per file. */
	upload(file: File, options: IDocumentUploadOptions): Observable<HttpEvent<IDocument>> {
		const formData = new FormData();
		formData.append('file', file, file.name);
		Object.entries(options ?? {}).forEach(([key, value]) => {
			if (value === undefined || value === null) return;
			formData.append(key, Array.isArray(value) ? value.join(',') : String(value));
		});
		return this.http.post<IDocument>(`${this.API_URL}/documents/upload`, formData, {
			reportProgress: true,
			observe: 'events'
		});
	}

	/** Resolves the signed download URL redirect endpoint for a document. */
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

	/** PAGE content endpoint. */
	getContent(id: ID): Observable<{ contentJson?: unknown; contentHtml?: string }> {
		return this.http.get<{ contentJson?: unknown; contentHtml?: string }>(`${this.API_URL}/documents/${id}/content`);
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

	getLinks(id: ID): Observable<IDocumentLink[]> {
		return this.http.get<IDocumentLink[]>(`${this.API_URL}/documents/${id}/links`);
	}

	findLinks(entity: BaseEntityEnum, entityId: ID): Observable<IDocumentLink[]> {
		return this.http.get<IDocumentLink[]>(`${this.API_URL}/links`, { params: toParams({ entity, entityId }) });
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

	bulk(input: IDocumentBulkInput): Observable<IDocumentBulkResult> {
		return this.http.post<IDocumentBulkResult>(`${this.API_URL}/documents/bulk`, input);
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
