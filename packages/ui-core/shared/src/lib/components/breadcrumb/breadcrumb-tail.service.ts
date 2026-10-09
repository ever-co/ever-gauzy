import { Injectable, Signal, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Extra breadcrumb levels a page appends to the route-derived trail.
 *
 * `BreadcrumbComponent` builds its trail from the URL, which is the right source for
 * everything the router knows about. It cannot describe a step a page enters WITHOUT
 * navigating — the contacts pages, for instance, swap their table for the add/edit
 * wizard in place, so the URL still says `/pages/contacts/leads` while the screen shows
 * a form. The trail then stops one level short of where the user actually is.
 *
 * Entries are i18n KEYS rather than finished strings: the breadcrumb component
 * re-resolves the whole trail whenever the language (or the loaded bundle) changes, and
 * a pre-translated label would be the one crumb that stayed in the previous language.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbTailService {
	private readonly _keys = signal<string[]>([]);

	/** The current tail, outermost level first. */
	public readonly keys: Signal<string[]> = this._keys.asReadonly();

	constructor() {
		// A tail describes a state of the page currently on screen, so it can never
		// survive a navigation. Clearing here rather than leaving it to each page means
		// a page that forgets to clean up (or is torn down by a guard / an error) cannot
		// strand a stale crumb on the next page.
		inject(Router)
			.events.pipe(
				filter((event): event is NavigationEnd => event instanceof NavigationEnd),
				takeUntilDestroyed()
			)
			.subscribe(() => this._keys.set([]));
	}

	/**
	 * Replaces the tail shown after the route-derived trail.
	 *
	 * @param keys i18n keys, outermost level first. Called with no arguments it clears the tail.
	 */
	public setTail(...keys: string[]): void {
		this._keys.set(keys.filter((key: string) => !!key));
	}

	/** Drops the tail — the page is back to the state its URL describes. */
	public clearTail(): void {
		this._keys.set([]);
	}
}
