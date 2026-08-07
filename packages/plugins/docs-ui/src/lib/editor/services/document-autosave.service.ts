import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ID, IDocument, JsonData } from '@gauzy/contracts';
import { DocumentsService } from '../../services/documents.service';

/** Autosave pill states (spec 05 §9.2 + UX spec §10.6). */
export type DocsSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'locked' | 'offline' | 'error';

export interface IAutosavePayload {
	contentJson: JsonData;
	contentHtml: string;
	mentionEmployeeIds: string[];
}

export interface IConflictInfo {
	code: string;
	currentUpdatedAt?: string;
}

const DEBOUNCE_MS = 2_000;
const MAX_DIRTY_MS = 15_000;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS = 60_000;

/**
 * Content autosave state machine (spec 05 §9.2):
 * `idle → dirty → saving → idle | conflict | error`.
 *
 * - Save fires 2 s after the last edit or at a 15 s max-dirty ceiling.
 * - Optimistic concurrency via `expectedUpdatedAt`; 409 → `conflict` (frozen
 *   until the page resolves), 423 → `locked`.
 * - Network errors retry with exponential backoff (2/4/8… capped 60 s) as
 *   `offline`; saves never overlap (single-flight, latest state wins).
 * - Saves are skipped while the payload provider returns null (uploads pending).
 */
@Injectable()
export class DocumentAutosaveService implements OnDestroy {
	private readonly documentsService = inject(DocumentsService);
	private readonly zone = inject(NgZone);

	private readonly _state$ = new BehaviorSubject<DocsSaveState>('idle');
	public readonly state$ = this._state$.asObservable();

	private readonly _conflict$ = new BehaviorSubject<IConflictInfo | null>(null);
	public readonly conflict$ = this._conflict$.asObservable();

	private documentId: ID | null = null;
	/** The `updatedAt` last loaded/saved — the optimistic-concurrency token. */
	private expectedUpdatedAt: string | null = null;
	private payloadProvider: (() => IAutosavePayload | null) | null = null;

	private dirty = false;
	private frozen = false;
	private inFlight = false;
	private retryCount = 0;

	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private ceilingTimer: ReturnType<typeof setTimeout> | null = null;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;

	get state(): DocsSaveState {
		return this._state$.value;
	}

	get isDirty(): boolean {
		return this.dirty;
	}

	get updatedAt(): string | null {
		return this.expectedUpdatedAt;
	}

	init(documentId: ID, updatedAt: string | Date | undefined, payloadProvider: () => IAutosavePayload | null): void {
		this.documentId = documentId;
		this.expectedUpdatedAt = updatedAt ? new Date(updatedAt).toISOString() : null;
		this.payloadProvider = payloadProvider;
		this.dirty = false;
		this.frozen = false;
		this.retryCount = 0;
		this._conflict$.next(null);
		this._state$.next('idle');
	}

	/** Called on every doc-changing transaction. */
	markDirty(): void {
		if (this.frozen || !this.documentId) return;
		this.dirty = true;
		if (this.state !== 'saving') this._state$.next('dirty');
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = this.schedule(() => void this.flush(), DEBOUNCE_MS);
		if (!this.ceilingTimer) {
			this.ceilingTimer = this.schedule(() => void this.flush(), MAX_DIRTY_MS);
		}
	}

	/** Manual flush (Ctrl/Cmd+S, blur, visibility change, route leave). */
	async flush(options: { forceSnapshot?: boolean } = {}): Promise<boolean> {
		if (!this.documentId || this.frozen) return false;
		if (!this.dirty && !options.forceSnapshot) return true;
		if (this.inFlight) return false; // single-flight; next flush picks up the latest state

		const payload = this.payloadProvider?.();
		if (!payload) return false; // uploads pending — skip (spec 05 §6.6 step 6)

		this.clearTimers();
		this.inFlight = true;
		this.dirty = false;
		this._state$.next('saving');

		try {
			const saved: IDocument = await firstValueFrom(
				this.documentsService.updateContent(this.documentId, {
					contentJson: payload.contentJson,
					contentHtml: payload.contentHtml,
					mentionEmployeeIds: payload.mentionEmployeeIds,
					expectedUpdatedAt: this.expectedUpdatedAt ?? new Date(0).toISOString(),
					forceSnapshot: options.forceSnapshot
				})
			);
			this.expectedUpdatedAt = saved?.updatedAt ? new Date(saved.updatedAt).toISOString() : this.expectedUpdatedAt;
			this.retryCount = 0;
			this.inFlight = false;
			if (this.dirty) {
				this._state$.next('dirty');
				this.debounceTimer = this.schedule(() => void this.flush(), DEBOUNCE_MS);
			} else {
				this._state$.next('saved');
			}
			return true;
		} catch (error) {
			this.inFlight = false;
			this.dirty = true;
			this.handleError(error as HttpErrorResponse);
			return false;
		}
	}

	/** Conflict resolved (reload or keep-as-copy done) — resume with a fresh token. */
	resolve(updatedAt: string | Date | undefined, options: { discardLocal?: boolean } = {}): void {
		this.expectedUpdatedAt = updatedAt ? new Date(updatedAt).toISOString() : null;
		this.frozen = false;
		this._conflict$.next(null);
		this.dirty = options.discardLocal ? false : this.dirty;
		this._state$.next(this.dirty ? 'dirty' : 'idle');
		if (this.dirty) this.markDirty();
	}

	/** Manual retry from the error pill. */
	retryNow(): void {
		this.retryCount = 0;
		void this.flush();
	}

	ngOnDestroy(): void {
		this.clearTimers();
	}

	// ─── Internals ───────────────────────────────────────────────

	private handleError(error: HttpErrorResponse): void {
		if (error?.status === 409) {
			// Freeze until the page resolves (Reload latest / Keep mine as copy).
			this.frozen = true;
			this._conflict$.next({
				code: error.error?.code ?? 'DOCS_CONTENT_CONFLICT',
				currentUpdatedAt: error.error?.currentUpdatedAt
			});
			this._state$.next('conflict');
			return;
		}
		if (error?.status === 423) {
			this.frozen = true;
			this._state$.next('locked');
			return;
		}
		if (error?.status === 0 || (error?.status ?? 0) >= 500) {
			// Network/offline — exponential backoff, capped.
			const delay = Math.min(BACKOFF_BASE_MS * 2 ** this.retryCount, BACKOFF_CAP_MS);
			this.retryCount += 1;
			this._state$.next('offline');
			if (this.retryTimer) clearTimeout(this.retryTimer);
			this.retryTimer = this.schedule(() => void this.flush(), delay);
			return;
		}
		this._state$.next('error');
	}

	private schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
		return this.zone.runOutsideAngular(() =>
			setTimeout(() => this.zone.run(callback), delay)
		);
	}

	private clearTimers(): void {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		if (this.ceilingTimer) clearTimeout(this.ceilingTimer);
		if (this.retryTimer) clearTimeout(this.retryTimer);
		this.debounceTimer = null;
		this.ceilingTimer = null;
		this.retryTimer = null;
	}
}
