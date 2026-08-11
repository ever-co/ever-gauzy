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
import { IDocumentUploadOptions, IDocumentUploadResult } from '../models/docs-api.model';
import { DocumentsService } from './documents.service';

/**
 * Consecutive failed status fetches after which a pending id is abandoned.
 * At `DOCS_PROCESSING_POLL_MS` that is a bounded ~30s of retrying, not forever.
 */
const DOCS_POLL_MAX_FAILURES = 6;

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
	/**
	 * Advisory in-organization sha256 match reported by the upload response
	 * (`R-UPL-04`). The upload is never blocked or dropped — this only drives the
	 * "possible duplicate of X" notice on the progress row and in the detail panel.
	 *
	 * 🛑 It exists **only** on the upload envelope, never as a column on the
	 * document, so this queue is the single place that remembers it.
	 */
	duplicateOfId?: ID;
	/** Name of `duplicateOfId`, resolved lazily; absent when the lookup failed. */
	duplicateOfName?: string;
	/** Files in the enqueue batch this item belonged to (§7.3 single-upload toast). */
	batchSize: number;
}

/** What the detail panel needs to render the dedup notice for a document. */
export interface UploadDuplicateNotice {
	id: ID;
	name?: string;
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
	/** documentId → consecutive failed status fetches (see `recordPollFailure`). */
	private readonly pollFailures = new Map<string, number>();
	private pollSubscription: Subscription | null = null;
	private processingVisible = false;
	private readonly processingSubscription: Subscription;
	/** upload key → in-flight request (unsubscribed on dismiss / destroy). */
	private readonly uploadSubscriptions = new Map<string, Subscription>();
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
		const batchSize = files.length;
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
					error: validation.reason,
					batchSize
				});
				continue;
			}
			this.upsert({ key, file, options, progress: 0, state: 'uploading', batchSize });
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
		const subscription = this.documentsService.uploadOne(file, options).subscribe({
			next: (event) => {
				if (event.type === HttpEventType.UploadProgress && event.total) {
					this.patch(key, { progress: Math.round((event.loaded / event.total) * 100) });
				} else if (event.type === HttpEventType.Response) {
					// `DocumentsService.uploadOne()` has already unwrapped the batch
					// `{ results, rejected }` envelope down to this file's result; a
					// per-file rejection arrives on the error channel below, never here
					// with an empty body.
					const result = event.body as IDocumentUploadResult;
					const document = result?.document;
					const settled = this.isSettled(document);
					this.patch(key, {
						state: 'done',
						progress: 100,
						documentId: document?.id as ID,
						duplicateOfId: result?.duplicateOfId
					});
					if (result?.duplicateOfId) this.resolveDuplicateName(key, result.duplicateOfId);
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
	 * Resolves the duplicate's display name. Cosmetic and fault-isolated: a failed
	 * lookup (deleted, or not visible to this user) leaves the notice generic
	 * rather than printing a raw id — the upload itself is unaffected either way.
	 */
	private resolveDuplicateName(key: string, duplicateOfId: ID): void {
		this.documentsService
			.getById(duplicateOfId)
			.pipe(catchError(() => of(null)))
			.subscribe((duplicate) => {
				if (duplicate?.name) this.patch(key, { duplicateOfName: duplicate.name });
			});
	}

	/**
	 * The dedup notice for an uploaded document (`R-UPL-04`), or `null` when this
	 * session did not upload it — `duplicateOfId` is upload-response-only, so a
	 * document opened on a later page load simply has no notice to show.
	 */
	duplicateNoticeFor(documentId: ID | null | undefined): UploadDuplicateNotice | null {
		if (!documentId) return null;
		const item = this._items$.value.find((entry) => String(entry.documentId) === String(documentId));
		if (!item?.duplicateOfId) return null;
		return { id: item.duplicateOfId, name: item.duplicateOfName };
	}

	/**
	 * True when the document arrived through a batch of exactly one file — the
	 * condition §7.3 puts on the "uploaded, needs review" toast (a ten-file drop
	 * must not raise ten toasts).
	 */
	isSingleFileUpload(documentId: ID | null | undefined): boolean {
		if (!documentId) return false;
		const item = this._items$.value.find((entry) => String(entry.documentId) === String(documentId));
		return item?.batchSize === 1;
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
					if (!document) {
						// 🛑 Terminal path. An id whose fetch keeps failing (deleted row,
						// revoked visibility, a persistent 5xx) used to stay pending
						// forever, and the 5s timer with it — a background request every
						// 5 seconds for the life of the page. Give up after a bounded
						// number of consecutive failures.
						this.recordPollFailure(id);
						return;
					}
					this.pollFailures.delete(String(id));
					this.actions.dispatch(DocumentsActions.rowChanged(document));
					if (this.isSettled(document)) {
						this.forgetPending(document.id as ID);
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

	/** Drops a pending id and its failure counter. */
	private forgetPending(id: ID): void {
		this.pendingIds.delete(String(id));
		this.pollFailures.delete(String(id));
	}

	/**
	 * Counts a failed status fetch and gives up on the id once
	 * `DOCS_POLL_MAX_FAILURES` consecutive attempts have failed. The queue row is
	 * marked errored so the user sees *something* rather than a spinner that
	 * never resolves.
	 */
	private recordPollFailure(id: ID): void {
		const key = String(id);
		const failures = (this.pollFailures.get(key) ?? 0) + 1;
		if (failures < DOCS_POLL_MAX_FAILURES) {
			this.pollFailures.set(key, failures);
			return;
		}
		this.forgetPending(id);
		const item = this._items$.value.find((entry) => String(entry.documentId) === key);
		if (item && item.state !== 'error') {
			this.patch(item.key, { state: 'error', error: 'status-unavailable' });
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
