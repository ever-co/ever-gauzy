import { DestroyRef, Injectable } from '@angular/core';
import {
	ActivatedRoute,
	NavigationCancel,
	NavigationEnd,
	NavigationError,
	NavigationSkipped,
	Params,
	QueryParamsHandling,
	Router
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class NavigationService {
	/**
	 * Query-param patches accumulated between flushes. Writes COALESCE: a burst
	 * (e.g. an organization switch cascading into team/project rewrites) merges
	 * into one router navigation, last value per key wins — the same end state
	 * the old synchronous `location.replaceState` produced, without issuing one
	 * navigation per write.
	 */
	private _pending: Params | null = null;
	/** Callers awaiting the flush that will carry their patch. */
	private _pendingResolvers: Array<() => void> = [];
	private _flushScheduled = false;

	constructor(
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _destroyRef: DestroyRef
	) {
		// A flush attempt that found a navigation in flight parks the patch and
		// retries once that navigation SETTLES — never mid-flight, where a
		// same-tick `navigate()` supersedes the user's navigation into a silent
		// NavigationSkipped (the 536fa7fced bug class this service must never
		// reintroduce). All four terminal events count as settled; Skipped is
		// what our own idempotent re-writes produce.
		this._router.events
			.pipe(
				filter(
					(event) =>
						event instanceof NavigationEnd ||
						event instanceof NavigationCancel ||
						event instanceof NavigationError ||
						event instanceof NavigationSkipped
				),
				takeUntilDestroyed(this._destroyRef)
			)
			.subscribe(() => {
				if (this._pending) this._scheduleFlush();
			});
	}

	/**
	 * Navigates to the current route with specified query parameters, while preserving existing ones.
	 *
	 * @param queryParams The query parameters to be attached.
	 */
	async navigateQueryParams(
		route: string[] = [],
		queryParams: { [key: string]: string | string[] | boolean },
		queryParamsHandling: QueryParamsHandling = 'merge'
	): Promise<void> {
		await this._router.navigate(route, {
			relativeTo: this._activatedRoute,
			queryParams,
			queryParamsHandling
		});
	}

	/**
	 * Updates the query parameters of the current route without a history entry.
	 *
	 * THE ROUTER OWNS THE WRITE. This used to build the URL by hand and call
	 * `location.replaceState`, which the router cannot see: `currentUrlTree`
	 * never contained the written params, so the first cancelled or failed
	 * navigation had `resetUrlToCurrentUrlTree` rewrite the URL WITHOUT them —
	 * the date-range/organization params silently vanished (observed live on
	 * demo). `router.navigate` keeps tree and URL in agreement.
	 *
	 * The write is DEFERRED (macrotask) and RETRIED after any in-flight
	 * navigation settles, never issued mid-flight:
	 * - deferred, because callers like the app component's bookmark writer run
	 *   synchronously inside NavigationEnd — where `getCurrentNavigation()` is
	 *   still non-null (it is nulled only in the router's `finalize`), so a
	 *   naive "skip while navigating" guard would drop that write on every
	 *   navigation, and `route.data` never re-emits to heal it;
	 * - retried (not dropped), because some writes are one-shot (the
	 *   organization selector's startup write) — a dropped patch here would
	 *   not self-heal.
	 *
	 * Removal semantics are preserved exactly: `''`, `null`, `undefined` and
	 * empty arrays all REMOVE a param (the team/project selectors pass `''`
	 * meaning "All" — under plain router merge that would survive as
	 * `?teamId=`), while `false` and `0` are kept. Arrays are deduplicated.
	 *
	 * @param queryParams The query parameters to be updated.
	 * @param queryParamsHandling The strategy to handle the query parameters (default is 'merge').
	 *                            Every current caller merges; a non-merge patch replaces the
	 *                            pending accumulation wholesale.
	 */
	async updateQueryParams(
		queryParams: { [key: string]: string | string[] | boolean },
		queryParamsHandling: QueryParamsHandling = 'merge'
	): Promise<void> {
		const normalized = this._normalize(queryParams);
		this._pending = queryParamsHandling === 'merge' ? { ...(this._pending ?? {}), ...normalized } : normalized;

		const flushed = new Promise<void>((resolve) => this._pendingResolvers.push(resolve));
		this._scheduleFlush();
		await flushed;
	}

	/**
	 * Maps the service's historical "empty means remove" contract onto the
	 * router's: `createUrlTree` merge removes `null`/`undefined` but keeps `''`
	 * (serialized as `?key=`) and empty arrays, so both become `null` here.
	 */
	private _normalize(queryParams: { [key: string]: string | string[] | boolean }): Params {
		const normalized: Params = {};
		for (const key of Object.keys(queryParams ?? {})) {
			const value = queryParams[key];
			if (value === '' || value === null || value === undefined) {
				normalized[key] = null;
			} else if (Array.isArray(value)) {
				const unique = Array.from(new Set(value));
				normalized[key] = unique.length ? unique : null;
			} else {
				normalized[key] = value;
			}
		}
		return normalized;
	}

	/**
	 * Schedules a flush on a MACROTASK. A microtask is not enough: a write made
	 * synchronously during NavigationEnd would flush before the router's
	 * `finalize` clears `currentNavigation`, see `updateQueryParams`.
	 */
	private _scheduleFlush(): void {
		if (this._flushScheduled) return;
		this._flushScheduled = true;
		setTimeout(() => {
			this._flushScheduled = false;
			void this._flush();
		});
	}

	private async _flush(): Promise<void> {
		if (!this._pending) return;
		// A navigation is in flight — park the patch; the settle listener in the
		// constructor re-schedules. Writing NOW would supersede that navigation.
		if (this._router.getCurrentNavigation()) return;

		const queryParams = this._pending;
		const resolvers = this._pendingResolvers;
		this._pending = null;
		this._pendingResolvers = [];
		try {
			// `replaceUrl` keeps parity with the old `replaceState` (no history
			// entry). An idempotent re-write (same resulting tree) terminates as
			// NavigationSkipped — that is what bounds the NavigationEnd →
			// bookmark-writer → NavigationEnd loop to a single extra round.
			await this._router.navigate([], {
				queryParams,
				queryParamsHandling: 'merge',
				replaceUrl: true
			});
		} finally {
			resolvers.forEach((resolve) => resolve());
		}
	}
}
