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
	/**
	 * Bumped by every `init()`. A save started for the previous document may land
	 * after the editor was rebuilt for another `:id`; its result must never write
	 * the new session's token or unblock its single-flight latch.
	 */
	private session = 0;

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

	/**
	 * Starts (or restarts) an autosave session. Restarting is what the editor does
	 * when the route ':id' changes: every timer, latch and freeze of the previous
	 * document is dropped so nothing from it can write into the new one.
	 */
	init(documentId: ID, updatedAt: string | Date | undefined, payloadProvider: () => IAutosavePayload | null): void {
		this.clearTimers();
		this.session += 1;
		this.documentId = documentId;
		this.expectedUpdatedAt = updatedAt ? new Date(updatedAt).toISOString() : null;
		this.payloadProvider = payloadProvider;
		this.dirty = false;
		this.frozen = false;
		// A save still in flight belongs to the previous session — it is ignored on
		// arrival (session guard in `flush`), so it must not hold this one's latch.
		this.inFlight = false;
		this.retryCount = 0;
		this._conflict$.next(null);
		this._state$.next('idle');
	}

	/** Called on every doc-changing transaction. */
	markDirty(): void {
		if (this.frozen || !this.documentId) return;
		this.dirty = true;
		if (this.state !== 'saving') this._state$.next('dirty');
		this.armSaveTimers();
	}

	/** Manual flush (Ctrl/Cmd+S, blur, visibility change, route leave). */
	async flush(options: { forceSnapshot?: boolean } = {}): Promise<boolean> {
		if (!this.documentId || this.frozen) return false;
		if (!this.dirty && !options.forceSnapshot) return true;
		// Every early return below leaves work on the table, so it must leave a timer
		// armed too — a fired timer nulls its own handle, so without re-arming here
		// the 15 s ceiling would never fire again and the edits would sit unsaved.
		if (this.inFlight) {
			this.armSaveTimers(); // single-flight; the next flush picks up the latest state
			return false;
		}

		const payload = this.payloadProvider?.();
		if (!payload) {
			this.armSaveTimers(); // uploads pending — retry, don't drop (spec 05 §6.6 step 6)
			return false;
		}

		const session = this.session;
		const documentId = this.documentId;
		this.clearTimers();
		this.inFlight = true;
		this.dirty = false;
		this._state$.next('saving');

		try {
			const saved: IDocument = await firstValueFrom(
				this.documentsService.updateContent(documentId, {
					contentJson: payload.contentJson,
					contentHtml: payload.contentHtml,
					mentionEmployeeIds: payload.mentionEmployeeIds,
					expectedUpdatedAt: this.expectedUpdatedAt ?? new Date(0).toISOString(),
					forceSnapshot: options.forceSnapshot
				})
			);
			// The editor moved on to another document while this was in flight —
			// its token and state belong to a session that no longer exists.
			if (session !== this.session) return false;
			this.expectedUpdatedAt = saved?.updatedAt ? new Date(saved.updatedAt).toISOString() : this.expectedUpdatedAt;
			this.retryCount = 0;
			this.inFlight = false;
			if (this.dirty) {
				this._state$.next('dirty');
				this.armSaveTimers();
			} else {
				this._state$.next('saved');
			}
			return true;
		} catch (error) {
			if (session !== this.session) return false;
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

	/**
	 * The lock was released (the page's own lock toggle, or a refetch that came
	 * back unlocked). A 423 freeze has no self-clearing path, so without this the
	 * editor stays read-only until a full reload (spec 05 §9.2 "lock respect").
	 * A `conflict` freeze is deliberately untouched — only the page's conflict
	 * actions resolve that one.
	 */
	lockReleased(updatedAt?: string | Date): void {
		if (this.state !== 'locked') return;
		this.resolve(updatedAt ?? this.expectedUpdatedAt ?? undefined);
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
			this.retryTimer = this.schedule(() => {
				this.retryTimer = null;
				void this.flush();
			}, delay);
			return;
		}
		this._state$.next('error');
	}

	/**
	 * Arms the 2 s debounce and — unless one is already running — the 15 s max-dirty
	 * ceiling. Each timer nulls its own handle when it fires, so "already running"
	 * stays truthful and the ceiling can always be re-armed.
	 */
	private armSaveTimers(): void {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = this.schedule(() => {
			this.debounceTimer = null;
			void this.flush();
		}, DEBOUNCE_MS);
		if (!this.ceilingTimer) {
			this.ceilingTimer = this.schedule(() => {
				this.ceilingTimer = null;
				void this.flush();
			}, MAX_DIRTY_MS);
		}
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
