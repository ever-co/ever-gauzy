import { inject, Injectable } from '@angular/core';
import { defer, from, Observable, Subject, throwError } from 'rxjs';
import { catchError, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { ID, IMonthAggregatedEmployeeStatistics, IMonthAggregatedEmployeeStatisticsFindInput } from '@gauzy/contracts';
import { toUTC } from '@gauzy/ui-core/common';
import { EmployeeStatisticsService, IDashboardWidgetContext, STATISTICS_CACHE_TTL_MS } from '@gauzy/ui-core/core';

/**
 * Window in which repeated invalidations of the same scope collapse into one.
 *
 * Every chart widget on a canvas reacts to the same "refresh" click, so without
 * this the 2nd..Nth `invalidate()` would evict the entry the previous widget had
 * just re-created — turning one manual refresh into N HTTP requests.
 */
const INVALIDATE_COALESCE_MS = 250;

/** Date format the `/employee-statistics/months` endpoint expects. */
const API_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

interface ICacheEntry {
	readonly stream$: Observable<IMonthAggregatedEmployeeStatistics[]>;
	readonly expiresAt: number;
}

/**
 * Builds the `/employee-statistics/months` request for a dashboard context.
 *
 * Parity-critical: it reproduces `HumanResourcesComponent.getEmployeeStatistics()`
 * exactly — including the `toUTC(...)` conversion, without which the widgets
 * would silently report a different set of months than the HR dashboard for the
 * same selection.
 *
 * @param context - The ambient dashboard context.
 * @param employeeId - The employee the statistics are for.
 * @returns The find input the months endpoint expects.
 */
export function buildMonthStatisticsRequest(
	context: IDashboardWidgetContext,
	employeeId: ID
): IMonthAggregatedEmployeeStatisticsFindInput {
	const { organizationId, tenantId, startDate, endDate } = context;

	return {
		employeeId: employeeId as string,
		organizationId,
		tenantId,
		startDate: toUTC(startDate).format(API_DATE_FORMAT),
		endDate: toUTC(endDate).format(API_DATE_FORMAT)
	};
}

/**
 * Stable fingerprint of the five fields the request is made of.
 *
 * @param request - The request to fingerprint.
 * @returns The cache key.
 */
function monthStatisticsCacheKey(request: IMonthAggregatedEmployeeStatisticsFindInput): string {
	return [
		`employeeId=${request.employeeId ?? ''}`,
		`organizationId=${request.organizationId ?? ''}`,
		`tenantId=${request.tenantId ?? ''}`,
		`startDate=${request.startDate ?? ''}`,
		`endDate=${request.endDate ?? ''}`
	].join('&');
}

/**
 * Request-coalescing cache in front of
 * {@link EmployeeStatisticsService.getAggregatedStatisticsByEmployeeId}.
 *
 * The four employee chart widgets are four renderings of ONE
 * `/employee-statistics/months` response — exactly like the six Time Tracking
 * counters share one counts payload. Without this service, a canvas showing the
 * doughnut next to the bar chart would issue two identical requests on every
 * date-range change.
 *
 * Mirrors `TimesheetStatisticsCacheService` and `AccountingStatisticsCacheService`:
 * keyed by the request scope, entries expire after {@link STATISTICS_CACHE_TTL_MS},
 * and the returned observables are long-lived so they re-resolve after an
 * {@link invalidate}.
 *
 * Errors are NOT swallowed — widgets need them to render an error state. As usual
 * in RxJS an error terminates the subscription, so a widget's `refresh()` has to
 * RE-CALL {@link getMonthStatistics} (re-subscribe) rather than merely call
 * {@link invalidate}, or a failed widget could never recover. The failed entry is
 * evicted on error, so that re-call always hits the network.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeMonthStatisticsCacheService {
	private readonly _employeeStatisticsService = inject(EmployeeStatisticsService);

	private readonly _cache = new Map<string, ICacheEntry>();
	private readonly _invalidated$ = new Subject<void>();

	/** Guards against the refresh stampede described on {@link INVALIDATE_COALESCE_MS}. */
	private _lastInvalidatedKey: string | null = null;
	private _lastInvalidatedAt = 0;

	/** Emits after every effective invalidation. */
	public readonly invalidated$: Observable<void> = this._invalidated$.asObservable();

	/**
	 * Monthly aggregated statistics for one employee over the context's range.
	 *
	 * @param context - The dashboard context to query for.
	 * @param employeeId - The employee the statistics are for.
	 * @returns A shared stream that re-resolves after every invalidation.
	 */
	public getMonthStatistics(
		context: IDashboardWidgetContext,
		employeeId: ID
	): Observable<IMonthAggregatedEmployeeStatistics[]> {
		const request = buildMonthStatisticsRequest(context, employeeId);
		const key = monthStatisticsCacheKey(request);

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
	 * ignored, so every chart widget may safely call this from its own `refresh()`
	 * without causing a request storm.
	 *
	 * @param context - Limit the invalidation to one context; omit to drop everything.
	 * @param employeeId - The employee scope, required alongside `context`.
	 */
	public invalidate(context?: IDashboardWidgetContext, employeeId?: ID): void {
		const scope =
			context && employeeId ? monthStatisticsCacheKey(buildMonthStatisticsRequest(context, employeeId)) : '*';
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
	 * `defer` keeps the call lazy (nothing is requested until a widget subscribes)
	 * and `shareReplay({ refCount: false })` hands the SAME in-flight promise to
	 * every subsequent subscriber — this is what collapses the chart widgets into
	 * one HTTP request.
	 *
	 * @param key - Cache key of the request.
	 * @param request - The find input to send.
	 */
	private _cached(
		key: string,
		request: IMonthAggregatedEmployeeStatisticsFindInput
	): Observable<IMonthAggregatedEmployeeStatistics[]> {
		const now = Date.now();
		const hit = this._cache.get(key);
		if (hit && hit.expiresAt > now) {
			return hit.stream$;
		}

		this._prune(now);

		// Holder so the error handler can identify "its own" entry without a
		// use-before-assignment dance on the entry const itself.
		const own: { entry?: ICacheEntry } = {};
		const stream$: Observable<IMonthAggregatedEmployeeStatistics[]> = defer(() =>
			from(this._employeeStatisticsService.getAggregatedStatisticsByEmployeeId(request))
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
