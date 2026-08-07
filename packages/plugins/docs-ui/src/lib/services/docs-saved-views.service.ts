import { Injectable } from '@angular/core';
import { Params } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import {
	DOCS_SAVED_VIEWS_KEY_PREFIX,
	DOCS_SAVED_VIEWS_LIMIT,
	DOCS_SAVED_VIEW_NAME_MAX
} from '../docs.constants';
import {
	DOCS_SAVED_VIEW_EXCLUDED_PARAMS,
	DOCS_SAVED_VIEW_PARAMS,
	IDocsSavedView
} from '../models/docs-saved-view.model';

/**
 * Device-local named filter views (`01-ux-spec.md` §5, phased M5).
 *
 * Storage is `localStorage['gauzy_docs_saved_views_<orgId>']` — **never** the
 * server in v1 (spec 04 §13 open question: "confirm device-local vs server-side
 * when M5 is scoped"; this suite ships device-local). Because the URL is already
 * the single source of truth for browse state (§5.1), a view stores nothing but
 * the canonical query-param set, which keeps it forward-compatible with params
 * added to §5.1 later.
 *
 * Reads are defensive on every hop: another tab, an older build, or a user
 * poking at devtools can leave anything under that key, so a malformed blob
 * degrades to "no saved views" instead of throwing inside the filter bar.
 */
@Injectable()
export class DocsSavedViewsService {
	private readonly _views$ = new BehaviorSubject<IDocsSavedView[]>([]);
	public readonly views$: Observable<IDocsSavedView[]> = this._views$.asObservable();

	/** The organization the currently loaded list belongs to (guards org switches). */
	private loadedOrganizationId: string | null = null;

	constructor(private readonly store: Store) {}

	get views(): IDocsSavedView[] {
		return this._views$.value;
	}

	/** Re-reads storage when the key changes (first use, organization switch). */
	refresh(): void {
		const organizationId = this.organizationId();
		if (this.loadedOrganizationId === organizationId && this._views$.value.length) return;
		this.loadedOrganizationId = organizationId;
		this._views$.next(this.read());
	}

	// ─── CRUD (all synchronous — this never touches the network) ──

	/**
	 * Stores the current query string under `name`. A name that already exists is
	 * *overwritten* rather than duplicated: users treat "Save view" with the same
	 * name as "update this view", and two identically named rows are unusable.
	 */
	save(name: string, params: Params): IDocsSavedView | null {
		const label = this.sanitizeName(name);
		if (!label) return null;

		const captured = this.captureParams(params);
		const now = new Date().toISOString();
		const views = [...this.read()];
		const existingIndex = views.findIndex((view) => view.name.toLowerCase() === label.toLowerCase());

		let saved: IDocsSavedView;
		if (existingIndex >= 0) {
			saved = { ...views[existingIndex], name: label, params: captured, updatedAt: now };
			views[existingIndex] = saved;
		} else {
			if (views.length >= DOCS_SAVED_VIEWS_LIMIT) return null;
			saved = { id: this.nextId(), name: label, params: captured, createdAt: now };
			views.unshift(saved);
		}
		this.write(views);
		return saved;
	}

	rename(id: string, name: string): boolean {
		const label = this.sanitizeName(name);
		if (!label) return false;
		const views = this.read();
		const target = views.find((view) => view.id === id);
		if (!target) return false;
		// Renaming onto another view's name would recreate the duplicate `save()` avoids.
		if (views.some((view) => view.id !== id && view.name.toLowerCase() === label.toLowerCase())) return false;
		this.write(
			views.map((view) => (view.id === id ? { ...view, name: label, updatedAt: new Date().toISOString() } : view))
		);
		return true;
	}

	remove(id: string): void {
		this.write(this.read().filter((view) => view.id !== id));
	}

	find(id: string): IDocsSavedView | undefined {
		return this._views$.value.find((view) => view.id === id);
	}

	/** True when the saved view's params match the ones currently in the URL. */
	matches(view: IDocsSavedView, params: Params): boolean {
		const current = this.captureParams(params);
		const keys = new Set([...Object.keys(current), ...Object.keys(view.params)]);
		for (const key of keys) {
			if (String(current[key] ?? '') !== String(view.params[key] ?? '')) return false;
		}
		return true;
	}

	// ─── Apply ───────────────────────────────────────────────────

	/**
	 * Query-param patch that applies a view.
	 *
	 * 🛑 Every param the view *owns but does not carry* is explicitly set to
	 * `null` so the router's merge write deletes it. Without that, applying a
	 * narrow view on top of a wider one leaves the old facets in place and the
	 * user sees a result set no saved view ever described. `page` is reset for
	 * the same reason (page 7 of the previous view is meaningless here).
	 */
	toApplyPatch(view: IDocsSavedView): Params {
		const patch: Params = {};
		for (const key of DOCS_SAVED_VIEW_PARAMS) {
			patch[key] = view.params[key] ?? null;
		}
		patch['page'] = null;
		return patch;
	}

	// ─── Internals ───────────────────────────────────────────────

	/** Keeps only the §5.1 params a view owns, as plain non-empty strings. */
	private captureParams(params: Params): Params {
		const excluded = new Set<string>(DOCS_SAVED_VIEW_EXCLUDED_PARAMS);
		const captured: Params = {};
		for (const key of DOCS_SAVED_VIEW_PARAMS) {
			if (excluded.has(key)) continue;
			const value = params?.[key];
			if (value === undefined || value === null || value === '') continue;
			captured[key] = String(value);
		}
		return captured;
	}

	private sanitizeName(name: string): string {
		return (name ?? '').trim().slice(0, DOCS_SAVED_VIEW_NAME_MAX);
	}

	private storageKey(): string {
		return `${DOCS_SAVED_VIEWS_KEY_PREFIX}${this.organizationId()}`;
	}

	private organizationId(): string {
		return String(this.store.selectedOrganization?.id ?? 'default');
	}

	private nextId(): string {
		return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}

	/** Tolerates absent / malformed / partially-shaped storage without throwing. */
	private read(): IDocsSavedView[] {
		try {
			const raw = localStorage.getItem(this.storageKey());
			if (!raw) return [];
			const parsed: unknown = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed
				.filter(
					(entry): entry is IDocsSavedView =>
						!!entry &&
						typeof entry === 'object' &&
						typeof (entry as IDocsSavedView).id === 'string' &&
						typeof (entry as IDocsSavedView).name === 'string'
				)
				.map((entry) => ({
					...entry,
					params: entry.params && typeof entry.params === 'object' ? entry.params : {},
					createdAt: entry.createdAt ?? new Date(0).toISOString()
				}))
				.slice(0, DOCS_SAVED_VIEWS_LIMIT);
		} catch {
			return [];
		}
	}

	/** A full localStorage quota must not take the filter bar down with it. */
	private write(views: IDocsSavedView[]): void {
		const next = views.slice(0, DOCS_SAVED_VIEWS_LIMIT);
		try {
			localStorage.setItem(this.storageKey(), JSON.stringify(next));
		} catch {
			/* storage full / disabled — the in-memory list still reflects the action */
		}
		this.loadedOrganizationId = this.organizationId();
		this._views$.next(next);
	}
}
