import { inject, Injectable } from '@angular/core';
import { defer, from, Observable, Subject, throwError } from 'rxjs';
import { catchError, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { IAggregatedEmployeeStatistic, IAggregatedEmployeeStatisticFindInput } from '@gauzy/contracts';
import { EmployeeStatisticsService, IDashboardWidgetContext, STATISTICS_CACHE_TTL_MS } from '@gauzy/ui-core/core';

/**
 * Window in which repeated invalidations of the same scope collapse into one.
 *
 * Every accounting widget on a canvas reacts to the same "refresh" click, so
 * without this the 2nd..Nth `invalidate()` would evict the entry the previous
 * widget had just re-created — turning one manual refresh into N HTTP requests.
 */
const INVALIDATE_COALESCE_MS = 250;

interface ICacheEntry {
	readonly stream$: Observable<IAggregatedEmployeeStatistic>;
	readonly expiresAt: number;
}

/**
 * Builds the `/employee-statistics/aggregate` request for a dashboard context.
 *
 * Parity-critical: it reproduces `AccountingComponent.getAggregateStatistics()`
 * exactly — organization, tenant and the raw selected range, nothing else. The
 * endpoint knows no employee/project/team scope, which is precisely why the
 * widgets must NOT refetch when those selectors change.
 *
 * @param context - The ambient dashboard context.
 * @returns The find input the aggregate endpoint expects.
 */
export function buildAggregateStatisticsRequest(
	context: IDashboardWidgetContext
): IAggregatedEmployeeStatisticFindInput {
	const { organizationId, tenantId, startDate, endDate } = context;
	return { organizationId, tenantId, startDate, endDate };
}

/**
 * Stable, order-independent fingerprint of the four fields the request is made of.
 *
 * Dates are reduced to their epoch value so two equal instants produce one key
 * (a `Date` has no stable string form across the code paths that build it).
 *
 * @param context - The ambient dashboard context.
 * @returns The cache key for this context.
 */
function aggregateCacheKey(context: IDashboardWidgetContext): string {
	const { organizationId, tenantId, startDate, endDate } = context;
	return [
		`organizationId=${organizationId ?? ''}`,
		`tenantId=${tenantId ?? ''}`,
		`startDate=${toEpoch(startDate)}`,
		`endDate=${toEpoch(endDate)}`
	].join('&');
}

/**
 * Epoch milliseconds of a value the context types as a `Date`.
 *
 * Defensive on purpose: a context deserialized from a bookmark carries an ISO
 * string, and `String(date)` would then key two identical ranges differently.
 *
 * @param value - The date to normalize.
 * @returns The epoch value, or an empty string when it cannot be parsed.
 */
function toEpoch(value: Date): string {
	const time = value instanceof Date ? value.getTime() : new Date(value as unknown as string).getTime();
	return Number.isNaN(time) ? '' : String(time);
}

/**
 * Request-coalescing cache in front of
 * {@link EmployeeStatisticsService.getAggregateStatisticsByOrganizationId}.
 *
 * The accounting KPIs (income, expenses, profit, bonus) are four projections of
 * ONE `/employee-statistics/aggregate` response — exactly like the six Time
 * Tracking counters share one counts payload. Without this service, dropping all
 * four on a canvas would issue four identical requests on every context change.
 *
 * Mirrors `TimesheetStatisticsCacheService`: keyed by the request scope, entries
 * expire after {@link STATISTICS_CACHE_TTL_MS}, and the returned observables are
 * long-lived so they re-resolve after an {@link invalidate}.
 *
 * Errors are NOT swallowed — widgets need them to render an error state. As
 * usual in RxJS an error terminates the subscription, so a widget's `refresh()`
 * has to RE-CALL {@link getAggregate} (re-subscribe) rather than merely call
 * {@link invalidate}, or a failed widget could never recover. The failed entry is
 * evicted on error, so that re-call always hits the network.
 */
@Injectable({ providedIn: 'root' })
export class AccountingStatisticsCacheService {
	private readonly _employeeStatisticsService = inject(EmployeeStatisticsService);

	private readonly _cache = new Map<string, ICacheEntry>();
	private readonly _invalidated$ = new Subject<void>();

	/** Guards against the refresh stampede described on {@link INVALIDATE_COALESCE_MS}. */
	private _lastInvalidatedKey: string | null = null;
	private _lastInvalidatedAt = 0;

	/** Emits after every effective invalidation. */
	public readonly invalidated$: Observable<void> = this._invalidated$.asObservable();

	/**
	 * Aggregated employee statistics (totals, per-employee rows and the cash-flow
	 * chart series) for the given dashboard context.
	 *
	 * @param context - The dashboard context to query for.
	 * @returns A shared stream that re-resolves after every invalidation.
	 */
	public getAggregate(context: IDashboardWidgetContext): Observable<IAggregatedEmployeeStatistic> {
		const request = buildAggregateStatisticsRequest(context);
		const key = aggregateCacheKey(context);

		return this._invalidated$.pipe(
			startWith(undefined),
			switchMap(() => this._cached(key, request)),
			// refCount so the widget's subscription is the only thing keeping this
			// wrapper alive; the cached entry itself outlives it (that is the point).
			shareReplay({ bufferSize: 1, refCount: true })
		);
	}

	/**
	 * Drops cached responses so the next subscriber re-fetches, and notifies live
	 * streams to re-resolve.
	 *
	 * Repeated calls for the same scope within {@link INVALIDATE_COALESCE_MS} are
	 * ignored, so all four accounting widgets may safely call this from their own
	 * `refresh()` without causing a request storm.
	 *
	 * @param context - Limit the invalidation to one context; omit to drop everything.
	 */
	public invalidate(context?: IDashboardWidgetContext): void {
		const scope = context ? aggregateCacheKey(context) : '*';
		const now = Date.now();

		if (this._lastInvalidatedKey === scope && now - this._lastInvalidatedAt < INVALIDATE_COALESCE_MS) {
			return;
		}
		this._lastInvalidatedKey = scope;
		this._lastInvalidatedAt = now;

		if (context) {
			this._cache.delete(scope);
		} else {
			this._cache.clear();
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
	 * `defer` keeps the call lazy (nothing is requested until a widget subscribes)
	 * and `shareReplay({ refCount: false })` hands the SAME in-flight promise to
	 * every subsequent subscriber — this is what collapses the four KPI widgets
	 * into one HTTP request.
	 */
	private _cached(
		key: string,
		request: IAggregatedEmployeeStatisticFindInput
	): Observable<IAggregatedEmployeeStatistic> {
		const now = Date.now();
		const hit = this._cache.get(key);
		if (hit && hit.expiresAt > now) {
			return hit.stream$;
		}

		this._prune(now);

		// Holder so the error handler can identify "its own" entry without a
		// use-before-assignment dance on the entry const itself.
		const own: { entry?: ICacheEntry } = {};
		const stream$: Observable<IAggregatedEmployeeStatistic> = defer(() =>
			from(this._employeeStatisticsService.getAggregateStatisticsByOrganizationId(request))
		).pipe(
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

		own.entry = { stream$, expiresAt: now + STATISTICS_CACHE_TTL_MS };
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
