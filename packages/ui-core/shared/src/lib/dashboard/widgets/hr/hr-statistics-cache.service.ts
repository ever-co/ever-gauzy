import { inject, Injectable } from '@angular/core';
import { defer, from, Observable, Subject, throwError } from 'rxjs';
import { catchError, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { ID, IMonthAggregatedEmployeeStatistics } from '@gauzy/contracts';
import { EmployeeStatisticsService, IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { buildHrStatisticsRequest, stableStringify } from './hr-statistics.utils';

/**
 * How long a fetched statistics response stays reusable.
 *
 * Long enough to collapse every Human Resources block on one canvas into a
 * single request, short enough that a user tabbing back gets fresh numbers.
 * Deliberately the same window as `TimesheetStatisticsCacheService`.
 */
export const HR_STATISTICS_CACHE_TTL_MS = 15_000;

/**
 * Window in which repeated invalidations of the same scope collapse into one.
 *
 * Every widget on a canvas reacts to the same "refresh" click, so without this
 * the 2nd..Nth `invalidate()` would evict the entry the previous widget had just
 * re-created — turning one manual refresh into N HTTP requests.
 */
const INVALIDATE_COALESCE_MS = 250;

interface ICacheEntry {
	readonly stream$: Observable<unknown>;
	readonly expiresAt: number;
}

/**
 * Request-coalescing cache in front of
 * {@link EmployeeStatisticsService.getAggregatedStatisticsByEmployeeId}.
 *
 * Every Human Resources block — total income, expenses, profit, the bonus
 * figures — is a projection of ONE `/employee-statistics/months` response. A
 * canvas holding all nine of them would otherwise issue nine identical requests
 * on every context change; keyed by the serialized request payload, they instead
 * share a single in-flight promise.
 *
 * Errors are NOT swallowed — widgets need them to render an error state. As
 * usual in RxJS an error terminates the subscription, which has one consequence
 * callers MUST honour: once a stream has errored it is dead and will no longer
 * react to {@link invalidate}. A widget's `refresh()` therefore has to RE-CALL
 * {@link getStatistics} (re-subscribe), not merely call `invalidate()`, or a
 * failed widget could never recover. The failed entry is evicted on error, so
 * the re-call always hits the network.
 */
@Injectable({ providedIn: 'root' })
export class HrStatisticsCacheService {
	private readonly _employeeStatisticsService = inject(EmployeeStatisticsService);

	private readonly _cache = new Map<string, ICacheEntry>();
	private readonly _invalidated$ = new Subject<void>();

	/** Guards against the refresh stampede described on INVALIDATE_COALESCE_MS. */
	private _lastInvalidatedKey: string | null = null;
	private _lastInvalidatedAt = 0;

	/** Emits after every effective invalidation. */
	public readonly invalidated$: Observable<void> = this._invalidated$.asObservable();

	/**
	 * Monthly aggregated statistics for one employee over the context's range.
	 *
	 * @param context - The ambient dashboard widget context.
	 * @param employeeId - The employee the figures are about.
	 * @returns A long-lived stream that re-resolves after every invalidation.
	 */
	public getStatistics(
		context: IDashboardWidgetContext,
		employeeId: ID
	): Observable<IMonthAggregatedEmployeeStatistics[]> {
		const request = buildHrStatisticsRequest(context, employeeId);
		const key = stableStringify(request);

		return this._invalidated$.pipe(
			startWith(undefined),
			switchMap(() =>
				this._cached<IMonthAggregatedEmployeeStatistics[]>(key, () =>
					this._employeeStatisticsService.getAggregatedStatisticsByEmployeeId(request)
				)
			),
			// refCount so the widget's subscription is the only thing keeping this
			// wrapper alive; the cached entry itself outlives it (that is the point).
			shareReplay({ bufferSize: 1, refCount: true })
		);
	}

	/**
	 * Drops the cached response for one scope so the next subscriber re-fetches,
	 * and notifies live streams to re-resolve.
	 *
	 * Repeated calls for the same scope within {@link INVALIDATE_COALESCE_MS} are
	 * ignored, so every widget on a canvas may safely call this from its own
	 * `refresh()` without causing a request storm.
	 *
	 * @param context - Limit the invalidation to one context; omit to drop everything.
	 * @param employeeId - The employee whose entry should be dropped.
	 */
	public invalidate(context?: IDashboardWidgetContext, employeeId?: ID): void {
		const scope = context && employeeId ? stableStringify(buildHrStatisticsRequest(context, employeeId)) : '*';
		const now = Date.now();

		if (this._lastInvalidatedKey === scope && now - this._lastInvalidatedAt < INVALIDATE_COALESCE_MS) {
			return;
		}
		this._lastInvalidatedKey = scope;
		this._lastInvalidatedAt = now;

		if (scope === '*') {
			this._cache.clear();
		} else {
			this._cache.delete(scope);
		}
		this._invalidated$.next();
	}

	/**
	 * Unconditionally empties the cache — no coalescing, no notification.
	 *
	 * Use on hard boundaries (sign-out, organization switch) where replaying a
	 * previous tenant's numbers would be wrong.
	 */
	public clear(): void {
		this._cache.clear();
		this._lastInvalidatedKey = null;
		this._lastInvalidatedAt = 0;
	}

	/**
	 * Returns the shared observable for `key`, creating it on a miss.
	 *
	 * `defer` keeps the call lazy (nothing is requested until a widget
	 * subscribes) and `shareReplay({ refCount: false })` hands the SAME in-flight
	 * promise to every subsequent subscriber — this is what collapses nine info
	 * blocks into one HTTP request.
	 *
	 * @param key - The serialized request payload.
	 * @param request - Factory issuing the actual HTTP call.
	 */
	private _cached<T>(key: string, request: () => Promise<T>): Observable<T> {
		const now = Date.now();
		const hit = this._cache.get(key);
		if (hit && hit.expiresAt > now) {
			return hit.stream$ as Observable<T>;
		}

		this._prune(now);

		// Holder so the error handler can identify "its own" entry without a
		// use-before-assignment dance on the entry const itself.
		const own: { entry?: ICacheEntry } = {};
		const stream$: Observable<T> = defer(() => from(request())).pipe(
			shareReplay({ bufferSize: 1, refCount: false }),
			catchError((error: unknown) => {
				// A cached failure would be replayed to every subscriber for the whole
				// TTL; evict it so the next widget (or retry) hits the network again.
				if (own.entry && this._cache.get(key) === own.entry) {
					this._cache.delete(key);
				}
				return throwError(() => error);
			})
		);

		own.entry = { stream$, expiresAt: now + HR_STATISTICS_CACHE_TTL_MS };
		this._cache.set(key, own.entry);

		return stream$;
	}

	/** Drops expired entries so long sessions don't accumulate dead payload keys. */
	private _prune(now: number): void {
		for (const [key, entry] of Array.from(this._cache.entries())) {
			if (entry.expiresAt <= now) {
				this._cache.delete(key);
			}
		}
	}
}
