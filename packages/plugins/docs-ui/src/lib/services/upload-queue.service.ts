import { HttpEventType } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { BehaviorSubject, catchError, Observable, of, Subject, Subscription, timer } from 'rxjs';
import { DocumentKnowledgeStatusEnum, DocumentStatusEnum, ID, IDocument } from '@gauzy/contracts';
import { DocumentsActions } from '../+state/documents.actions';
import { DocumentsQuery } from '../+state/documents.query';
import {
	DOCS_DEFAULT_MAX_FILE_SIZE_BYTES,
	DOCS_MAX_FILES_PER_UPLOAD,
	DOCS_PROCESSING_POLL_MS,
	DOCS_UPLOAD_ACCEPT
} from '../docs.constants';
import { IDocumentUploadOptions } from '../models/docs-api.model';
import { DocumentsService } from './documents.service';

export type UploadQueueItemState = 'uploading' | 'done' | 'error';

export interface UploadQueueItem {
	/** Stable client-side id for template tracking / retry / dismiss. */
	key: string;
	file: File;
	options: IDocumentUploadOptions;
	progress: number;
	state: UploadQueueItemState;
	documentId?: ID;
	error?: string;
}

export interface UploadValidationError {
	file: File;
	reason: 'too-large' | 'type-not-allowed';
}

/**
 * Why the *server* rejected an upload. `quota-exceeded` is the P1 org storage
 * quota (`08-permissions-security.md` §5.7) — it needs its own friendly toast
 * because, unlike the others, no amount of retrying will fix it and the raw
 * message ("Payload too large") points the user at the wrong problem.
 */
export type UploadRejectionReason = 'quota-exceeded' | 'too-large' | 'type-not-allowed' | 'failed';

export interface UploadRejection {
	file: File;
	reason: UploadRejectionReason;
	/** Server message, when it carried actionable detail (current usage / limit). */
	message?: string;
}

/**
 * Multi-file upload queue + processing poll.
 *
 * `enqueue` validates client-side (count/size/extension — UX only, the server
 * re-validates), then issues one multipart request per file with progress
 * events. A `timer(5000, 5000)` runs only while processing rows are visible or
 * the queue holds unsettled ids; each tick dispatches `pollTick` (silent
 * in-place refresh, never a URL write) and stops itself when everything
 * settles.
 */
@Injectable()
export class UploadQueueService implements OnDestroy {
	private readonly _items$ = new BehaviorSubject<UploadQueueItem[]>([]);
	public readonly items$: Observable<UploadQueueItem[]> = this._items$.asObservable();

	/** Emits each document that reaches READY (facet refresh; future chat hooks). */
	private readonly _documentReady$ = new Subject<IDocument>();
	public readonly documentReady$: Observable<IDocument> = this._documentReady$.asObservable();

	/** Client-side validation failures from the last `enqueue` call. */
	private readonly _validationErrors$ = new Subject<UploadValidationError[]>();
	public readonly validationErrors$: Observable<UploadValidationError[]> = this._validationErrors$.asObservable();

	/** Server-side upload rejections (quota, size, type) — one emission per file. */
	private readonly _rejections$ = new Subject<UploadRejection>();
	public readonly rejections$: Observable<UploadRejection> = this._rejections$.asObservable();

	/** Uploaded document ids whose processing has not settled yet. */
	private readonly pendingIds = new Set<string>();
	private pollSubscription: Subscription | null = null;
	private processingVisible = false;
	private processingSubscription: Subscription;
	private uploadSubscriptions = new Map<string, Subscription>();
	private keySeq = 0;

	public maxFileSizeBytes = DOCS_DEFAULT_MAX_FILE_SIZE_BYTES;
	public maxFilesPerUpload = DOCS_MAX_FILES_PER_UPLOAD;

	private readonly allowedExtensions = new Set(
		DOCS_UPLOAD_ACCEPT.split(',').map((extension) => extension.trim().toLowerCase())
	);

	constructor(
		private readonly documentsService: DocumentsService,
		private readonly documentsQuery: DocumentsQuery,
		private readonly actions: Actions
	) {
		// Pull org limits once (cosmetic; falls back to defaults).
		this.documentsService
			.getSettings()
			.pipe(catchError(() => of(null)))
			.subscribe((settings) => {
				if (settings?.capabilities?.maxFileSize) this.maxFileSizeBytes = settings.capabilities.maxFileSize;
			});
		// The poll also runs while any visible row is processing (e.g. after a Reprocess).
		this.processingSubscription = this.documentsQuery.isProcessingVisible$.subscribe((visible) => {
			this.processingVisible = visible;
			visible ? this.ensurePolling() : this.stopPollingIfSettled();
		});
	}

	ngOnDestroy(): void {
		this.pollSubscription?.unsubscribe();
		this.processingSubscription?.unsubscribe();
		this.uploadSubscriptions.forEach((subscription) => subscription.unsubscribe());
	}

	// ─── Queue API ───────────────────────────────────────────────

	/**
	 * Validates and enqueues files. Returns `false` when the whole batch is
	 * rejected (> max files). Oversize/disallowed files become error rows.
	 */
	enqueue(files: File[], options: IDocumentUploadOptions): boolean {
		if (!files.length) return false;
		if (files.length > this.maxFilesPerUpload) {
			return false;
		}
		const errors: UploadValidationError[] = [];
		for (const file of files) {
			const key = `upload-${++this.keySeq}`;
			const validation = this.validate(file);
			if (validation) {
				errors.push(validation);
				this.upsert({
					key,
					file,
					options,
					progress: 0,
					state: 'error',
					error: validation.reason
				});
				continue;
			}
			this.upsert({ key, file, options, progress: 0, state: 'uploading' });
			this.startUpload(key, file, options);
		}
		if (errors.length) this._validationErrors$.next(errors);
		return true;
	}

	retry(key: string): void {
		const item = this.find(key);
		if (!item || item.state !== 'error') return;
		if (item.documentId) {
			// Processing failed after upload — reprocess server-side.
			this.documentsService
				.reprocess(item.documentId)
				.pipe(catchError(() => of(null)))
				.subscribe((document) => {
					if (document) {
						this.pendingIds.add(String(document.id));
						this.upsert({ ...item, state: 'uploading', progress: 100 });
						this.ensurePolling();
					}
				});
			return;
		}
		const validation = this.validate(item.file);
		if (validation) return; // still invalid client-side
		this.upsert({ ...item, state: 'uploading', progress: 0, error: undefined });
		this.startUpload(key, item.file, item.options);
	}

	dismiss(key: string): void {
		this.uploadSubscriptions.get(key)?.unsubscribe();
		this.uploadSubscriptions.delete(key);
		this._items$.next(this._items$.value.filter((item) => item.key !== key));
	}

	clearFinished(): void {
		this._items$.next(this._items$.value.filter((item) => item.state === 'uploading'));
	}

	// ─── Internals ───────────────────────────────────────────────

	private validate(file: File): UploadValidationError | null {
		if (file.size > this.maxFileSizeBytes) return { file, reason: 'too-large' };
		const extension = `.${(file.name.split('.').pop() ?? '').toLowerCase()}`;
		if (!this.allowedExtensions.has(extension)) return { file, reason: 'type-not-allowed' };
		return null;
	}

	private startUpload(key: string, file: File, options: IDocumentUploadOptions): void {
		const subscription = this.documentsService.upload(file, options).subscribe({
			next: (event) => {
				if (event.type === HttpEventType.UploadProgress && event.total) {
					this.patch(key, { progress: Math.round((event.loaded / event.total) * 100) });
				} else if (event.type === HttpEventType.Response) {
					const document = event.body as IDocument;
					const settled = this.isSettled(document);
					this.patch(key, {
						state: 'done',
						progress: 100,
						documentId: document?.id as ID
					});
					if (document && !settled) {
						this.pendingIds.add(String(document.id));
						this.ensurePolling();
					}
					// Refresh the list so the new row appears.
					this.actions.dispatch(DocumentsActions.loadDocuments({ silent: true }));
				}
			},
			error: (error) => {
				const rejection = this.classifyRejection(file, error);
				this.patch(key, { state: 'error', error: error?.error?.message ?? rejection.reason });
				this._rejections$.next(rejection);
			}
		});
		this.uploadSubscriptions.set(key, subscription);
	}

	/**
	 * Maps an upload error response onto a reason the UI can speak to.
	 *
	 * Quota detection is deliberately belt-and-braces: `03-backend-plugin.md` §6
	 * lists the stable `DOCS_*` codes but quota is P1 and its code is not in that
	 * list yet, so both the expected code names and a 413/409 whose message
	 * mentions quota are accepted. A missed quota rejection would otherwise show
	 * "file too large" for a file that is well under the per-file limit.
	 */
	private classifyRejection(file: File, error: unknown): UploadRejection {
		const response = error as { status?: number; error?: { code?: string; message?: string } };
		const code = response?.error?.code;
		const message = response?.error?.message;
		const mentionsQuota = /quota/i.test(String(message ?? ''));

		if (code === 'DOCS_QUOTA_EXCEEDED' || code === 'DOCS_ORG_QUOTA_EXCEEDED' || mentionsQuota) {
			return { file, reason: 'quota-exceeded', message };
		}
		if (code === 'DOCS_FILE_TOO_LARGE' || response?.status === 413) {
			return { file, reason: 'too-large', message };
		}
		if (code === 'DOCS_FILE_TYPE_REJECTED') {
			return { file, reason: 'type-not-allowed', message };
		}
		return { file, reason: 'failed', message };
	}

	private ensurePolling(): void {
		if (this.pollSubscription) return;
		this.pollSubscription = timer(DOCS_PROCESSING_POLL_MS, DOCS_PROCESSING_POLL_MS).subscribe(() => this.tick());
	}

	private tick(): void {
		const ids = [...this.pendingIds] as ID[];
		// Silent page refresh; never writes the URL.
		this.actions.dispatch(DocumentsActions.pollTick(ids));
		// Off-page pending ids are fetched individually to detect settle.
		for (const id of ids) {
			this.documentsService
				.getById(id, ['categories', 'tags'])
				.pipe(catchError(() => of(null)))
				.subscribe((document) => {
					if (!document) return;
					this.actions.dispatch(DocumentsActions.rowChanged(document));
					if (this.isSettled(document)) {
						this.pendingIds.delete(String(document.id));
						if (document.status === DocumentStatusEnum.READY) {
							this._documentReady$.next(document);
							// Classification may have assigned categories/tags — refresh facets once.
							this.actions.dispatch(DocumentsActions.refreshFacets());
						}
						this.markFailedItems(document);
						this.stopPollingIfSettled();
					}
				});
		}
		this.stopPollingIfSettled();
	}

	private markFailedItems(document: IDocument): void {
		if (document.status !== DocumentStatusEnum.FAILED) return;
		const item = this._items$.value.find((entry) => String(entry.documentId) === String(document.id));
		if (item) this.patch(item.key, { state: 'error', error: document.statusMessage ?? 'processing-failed' });
	}

	private isSettled(document: IDocument | null | undefined): boolean {
		if (!document) return true;
		const statusSettled =
			document.status !== DocumentStatusEnum.UPLOADED && document.status !== DocumentStatusEnum.PROCESSING;
		const knowledgeSettled =
			document.knowledgeStatus !== DocumentKnowledgeStatusEnum.QUEUED &&
			document.knowledgeStatus !== DocumentKnowledgeStatusEnum.INDEXING;
		return statusSettled && knowledgeSettled;
	}

	private stopPollingIfSettled(): void {
		if (this.pendingIds.size === 0 && !this.processingVisible && this.pollSubscription) {
			this.pollSubscription.unsubscribe();
			this.pollSubscription = null;
		}
	}

	private find(key: string): UploadQueueItem | undefined {
		return this._items$.value.find((item) => item.key === key);
	}

	private upsert(item: UploadQueueItem): void {
		const items = this._items$.value;
		const index = items.findIndex((entry) => entry.key === item.key);
		if (index >= 0) {
			const next = [...items];
			next[index] = item;
			this._items$.next(next);
		} else {
			this._items$.next([...items, item]);
		}
	}

	private patch(key: string, partial: Partial<UploadQueueItem>): void {
		const item = this.find(key);
		if (item) this.upsert({ ...item, ...partial });
	}
}
