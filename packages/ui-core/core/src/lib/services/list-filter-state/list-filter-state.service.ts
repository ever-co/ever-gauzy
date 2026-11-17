import { Injectable } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';

/**
 * Keeps the column filters of a list page for as long as the user stays in the app, so a browser Back (or
 * Forward) into the list brings the filters back.
 *
 * A list page holds its filters in the component, so leaving it (a row opens its detail page) destroys them and the
 * way Back lands on an unfiltered list. Only a history step restores them: a click in the menu, a link or a
 * redirect is a new visit and starts clean, as before.
 *
 * The router's trigger is known only while a navigation starts and the table renders its filters long after, so the
 * service watches `NavigationStart` itself. It must be created at startup (see the app module) to see the first
 * navigation; one created later restores nothing until the next history step.
 */
@Injectable({
	providedIn: 'root'
})
export class ListFilterStateService {
	/** Filter values per list page (its path, without query or fragment), then per column id. */
	private readonly _saved = new Map<string, Map<string, unknown>>();
	/** What the page a history step is opening may take back, once per column. */
	private _restorable: { key: string; values: Map<string, unknown> } | null = null;

	constructor(private readonly _router: Router) {
		this._router.events.subscribe((event) => {
			if (event instanceof NavigationStart) {
				this._onNavigationStart(event);
			}
		});
	}

	/**
	 * The value a column's filter takes back on this page, once: the page was opened by Back or Forward and the
	 * column had a filter when the user left. Nothing otherwise.
	 */
	restore(columnId: string): unknown {
		const restorable = this._restorable;
		if (!restorable || restorable.key !== this._currentKey()) {
			return undefined;
		}
		const value = restorable.values.get(columnId);
		restorable.values.delete(columnId);
		return value;
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
		const key = this._keyOf(event.url);
		// Only another page is a visit: a change of the query alone (the organization and date range the app writes
		// into the URL) leaves the page, and its filters, where they are.
		if (key === this._currentKey()) {
			return;
		}
		if (event.navigationTrigger === 'popstate') {
			this._restorable = { key, values: new Map(this._saved.get(key)) };
		} else {
			// A new visit: whatever the page held on the last visit is gone, as it always was.
			this._restorable = null;
			this._saved.delete(key);
		}
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
