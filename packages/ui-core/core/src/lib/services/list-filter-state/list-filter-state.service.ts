import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
	NavigationCancel,
	NavigationEnd,
	NavigationError,
	NavigationSkipped,
	NavigationStart,
	Router
} from '@angular/router';
import { merge } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { Store } from '../store/store.service';

/** A navigation to another page that has started and not yet ended. */
interface PendingNavigation {
	id: number;
	/** The page it leaves. */
	fromKey: string;
	/** Opened by Back or Forward. */
	popstate: boolean;
	/** The page whose filters took their values back before it started, for a navigation that does not happen. */
	previousRestoredKey: string | null;
}

/**
 * Keeps the column filters of a list page for as long as the user stays in the app, so a browser Back (or
 * Forward) into the list brings the filters back.
 *
 * A list page holds its filters in the component, so leaving it (a row opens its detail page) destroys them and the
 * way Back lands on an unfiltered list. Only a history step restores them: a click in the menu, a link or a
 * redirect is a new visit and starts clean, as before.
 *
 * The filters live in memory only, and belong to the signed-in user, tenant and selected organization: signing out,
 * signing in as someone else or switching the organization forgets all of them.
 *
 * The router's trigger is known only while a navigation starts and the table renders its filters long after, so the
 * service watches the navigation events itself. It must be created at startup (see the app module) to see the first
 * navigation; one created later restores nothing until the next history step.
 *
 * A page may build its filters more than once in a visit: one that rebuilds its table settings after the first render
 * (to drop a column the user may not see, to add one the organization turns on) gets new filters from the table. Each
 * of them reads the same value back for as long as the user stays on the page, so a re-created filter shows what the
 * list is still filtered by.
 */
@Injectable({
	providedIn: 'root'
})
export class ListFilterStateService {
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);

	/** Filter values per list page (its path, without query or fragment), then per column id. */
	private readonly _saved = new Map<string, Map<string, unknown>>();
	/** The page the last history step opened: its filters take back what they held, until the user leaves it. */
	private _restoredKey: string | null = null;
	private _pending: PendingNavigation | null = null;

	constructor() {
		this._router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
			if (event instanceof NavigationStart) {
				this._onNavigationStart(event);
			} else if (event instanceof NavigationEnd) {
				this._onNavigationEnd(event);
			} else if (
				event instanceof NavigationCancel ||
				event instanceof NavigationError ||
				event instanceof NavigationSkipped
			) {
				this._onNavigationFailed(event.id);
			}
		});

		// Another user, tenant or organization: none of the filters kept so far are theirs.
		merge(this._store.user$, this._store.selectedOrganization$)
			.pipe(map(() => this._scope()), distinctUntilChanged(), takeUntilDestroyed())
			.subscribe(() => this._forgetAll());
	}

	/**
	 * The value a column's filter takes back on this page: the page was opened by Back or Forward and the column had
	 * a filter when the user left. Nothing otherwise.
	 *
	 * The same value every time it is asked during the visit, so a filter the page re-creates shows what the list is
	 * filtered by. A filter the user changes or clears since reads that instead: a cleared one stays cleared.
	 */
	restore(columnId: string): unknown {
		const key = this._currentKey();
		if (this._restoredKey !== key) {
			return undefined;
		}
		// The page's own entry, which `record` keeps in step with the user's choices on this visit.
		return this._saved.get(key)?.get(columnId);
	}

	/** A column's filter now holds `value` on the current page; an empty value clears it. */
	record(columnId: string, value: unknown): void {
		const key = this._currentKey();
		const columns = this._saved.get(key) ?? new Map<string, unknown>();
		if (!this._isEmpty(value)) {
			columns.set(columnId, value);
			this._saved.set(key, columns);
		} else {
			columns.delete(columnId);
			if (columns.size === 0) {
				this._saved.delete(key);
			}
		}
	}

	private _onNavigationStart(event: NavigationStart): void {
		const fromKey = this._currentKey();
		const key = this._keyOf(event.url);
		// Only another page is a visit: a change of the query alone (the organization and date range the app writes
		// into the URL) leaves the page, and its filters, where they are.
		if (key === fromKey) {
			return;
		}
		const popstate = event.navigationTrigger === 'popstate';
		this._pending = { id: event.id, fromKey, popstate, previousRestoredKey: this._restoredKey };
		// Set before the page's filters are created, which happens before the navigation ends.
		this._restoredKey = popstate ? key : null;
	}

	private _onNavigationEnd(event: NavigationEnd): void {
		const pending = this._pending;
		if (!pending || pending.id !== event.id) {
			return;
		}
		this._pending = null;
		// A new visit (not a history step): whatever the page it landed on held on the last visit is gone, as it
		// always was. Done once the navigation succeeds, on the page it lands on after any redirect.
		const key = this._keyOf(event.urlAfterRedirects);
		if (!pending.popstate && key !== pending.fromKey) {
			this._saved.delete(key);
		}
	}

	/** A navigation that did not happen (a guard refused it, it failed or a newer one replaced it) changes nothing. */
	private _onNavigationFailed(id: number): void {
		const pending = this._pending;
		if (!pending || pending.id !== id) {
			return;
		}
		this._pending = null;
		this._restoredKey = pending.previousRestoredKey;
	}

	private _forgetAll(): void {
		this._saved.clear();
		this._restoredKey = null;
		this._pending = null;
	}

	/** Whose filters these are: the signed-in user and their tenant, and the selected organization. */
	private _scope(): string {
		const user = this._store.user;
		return [user?.tenantId, user?.id, this._store.selectedOrganization?.id].map((id) => id ?? '').join('|');
	}

	/** Nothing chosen: no value, no text, no items. `false` is a choice (a toggle set to "no"). */
	private _isEmpty(value: unknown): boolean {
		return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
	}

	private _currentKey(): string {
		return this._keyOf(this._router.url);
	}

	private _keyOf(url: string): string {
		return url.split(/[?#]/)[0];
	}
}
