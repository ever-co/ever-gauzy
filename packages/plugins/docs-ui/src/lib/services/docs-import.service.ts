import { HttpClient, HttpErrorResponse, HttpEvent, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, Observable, of, shareReplay } from 'rxjs';
import {
	DocumentVisibilityEnum,
	ID,
	IDocumentImport,
	IDocumentImportList,
	IDocumentPdfExportCapabilities
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { fileNameFromDisposition } from '../models/docs-import.model';

/** Where an import lands: under a page or folder, or at the top of a space. */
export interface IDocsImportTarget {
	parentId?: ID | null;
	visibility?: DocumentVisibilityEnum;
	organizationTeamId?: ID | null;
}

/** What a PDF download covers. */
export interface IDocsPdfOptions {
	/** The page and the readable pages under it. */
	subtree?: boolean;
	/** With `subtree`: a zip with one PDF per page instead of one PDF with a table of contents. */
	zip?: boolean;
}

/**
 * HTTP client of the Docs import of exported workspaces and of the PDF export (`docs-import-export` spec FR-17).
 *
 * Both features are behind default-off flags on the server, whose routes then answer 404: the probes answer `null` on
 * any failure, and the callers hide the actions while they do. A probe is read once per organization and reused.
 */
@Injectable()
export class DocsImportService {
	private readonly API_URL = `${API_PREFIX}/plugins/docs`;
	private importProbe?: { organizationId: string; result$: Observable<IDocumentImportList | null> };
	private pdfProbe?: { organizationId: string; result$: Observable<IDocumentPdfExportCapabilities | null> };

	private readonly http = inject(HttpClient);
	private readonly store = inject(Store);

	/** The caller's last imports and the zip limit, or `null` when import is off (or the read failed). */
	probeImport(): Observable<IDocumentImportList | null> {
		const organizationId = String(this.store.selectedOrganization?.id ?? '');
		if (this.importProbe?.organizationId !== organizationId) {
			this.importProbe = {
				organizationId,
				result$: this.http.get<IDocumentImportList>(`${this.API_URL}/imports`, { params: toParams(this.scope()) }).pipe(
					catchError(() => of(null)),
					shareReplay({ bufferSize: 1, refCount: false })
				)
			};
		}
		return this.importProbe.result$;
	}

	/** The PDF export's capabilities, or `null` when it is off (or the read failed). */
	probePdf(): Observable<IDocumentPdfExportCapabilities | null> {
		const organizationId = String(this.store.selectedOrganization?.id ?? '');
		if (this.pdfProbe?.organizationId !== organizationId) {
			this.pdfProbe = {
				organizationId,
				result$: this.http.get<IDocumentPdfExportCapabilities>(`${this.API_URL}/exports/pdf`).pipe(
					catchError(() => of(null)),
					shareReplay({ bufferSize: 1, refCount: false })
				)
			};
		}
		return this.pdfProbe.result$;
	}

	/** The next probe reads the server again (after an import, its history changed). */
	refreshImportProbe(): void {
		this.importProbe = undefined;
	}

	/**
	 * Uploads a zip and starts its import, with upload progress events. The multipart field is `file`; only the fields
	 * `CreateDocumentImportDTO` declares are sent (`forbidNonWhitelisted` refuses anything else).
	 */
	start(file: File, target: IDocsImportTarget): Observable<HttpEvent<IDocumentImport>> {
		const form = new FormData();
		form.append('file', file, file.name);
		const fields: Record<string, unknown> = {
			parentId: target.parentId ?? undefined,
			visibility: target.parentId ? undefined : target.visibility,
			organizationTeamId: target.parentId ? undefined : (target.organizationTeamId ?? undefined),
			...this.scope()
		};
		for (const [key, value] of Object.entries(fields)) {
			if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
		}
		return this.http.post<IDocumentImport>(`${this.API_URL}/imports`, form, { reportProgress: true, observe: 'events' });
	}

	/** One import: state, progress, report. */
	get(id: ID): Observable<IDocumentImport> {
		return this.http.get<IDocumentImport>(`${this.API_URL}/imports/${id}`, { params: toParams(this.scope()) });
	}

	/**
	 * Downloads a page (or a subtree) as PDF, named as the server names it. Resolves `false` when the server refused it
	 * (the caller says so); the error is the server's, for the caller to show.
	 */
	async downloadPdf(id: ID, options: IDocsPdfOptions = {}): Promise<{ ok: boolean; error?: HttpErrorResponse }> {
		const params = { ...this.scope(), ...(options.subtree ? { subtree: 'true' } : {}), ...(options.subtree && options.zip ? { format: 'zip' } : {}) };
		try {
			const response = await firstValueFrom(
				this.http.get(`${this.API_URL}/documents/${id}/export.pdf`, { params: toParams(params), observe: 'response', responseType: 'blob' })
			);
			this.save(response, options.subtree && options.zip ? 'pages.zip' : 'document.pdf');
			return { ok: true };
		} catch (error) {
			return { ok: false, error: error instanceof HttpErrorResponse ? error : undefined };
		}
	}

	/**
	 * Downloads a folder (its pages, sub-folders and files, with an `index.md`) or a page with its sub-pages as a zip of
	 * Markdown files (`GET …/documents/:id/export/markdown?subtree=true`), named as the server names it. Resolves
	 * `ok: false` when the server refused it.
	 */
	async downloadMarkdownZip(id: ID): Promise<{ ok: boolean; error?: HttpErrorResponse }> {
		const params = { ...this.scope(), subtree: 'true' };
		try {
			const response = await firstValueFrom(
				this.http.get(`${this.API_URL}/documents/${id}/export/markdown`, { params: toParams(params), observe: 'response', responseType: 'blob' })
			);
			this.save(response, 'pages.zip');
			return { ok: true };
		} catch (error) {
			return { ok: false, error: error instanceof HttpErrorResponse ? error : undefined };
		}
	}

	private save(response: HttpResponse<Blob>, fallback: string): void {
		const blob = response.body;
		if (!blob) return;
		const name = fileNameFromDisposition(response.headers?.get('Content-Disposition'), fallback);
		const url = URL.createObjectURL(blob);
		const anchor = window.document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		anchor.style.display = 'none';
		window.document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		// Revoking synchronously races the download in Safari.
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	/** The selected organization, as the routes' `organizationId` scope. */
	private scope(): { organizationId?: string } {
		const id = this.store.selectedOrganization?.id;
		return id ? { organizationId: String(id) } : {};
	}
}
