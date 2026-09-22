import { inject, Injectable } from '@angular/core';
import { defer, from, Observable, Subject, throwError } from 'rxjs';
import { catchError, shareReplay, startWith, switchMap } from 'rxjs/operators';
import {
	EmployeeStatisticsHistoryEnum,
	IAggregatedEmployeeStatistic,
	IAggregatedEmployeeStatisticFindInput,
	ID,
	IEmployeeStatisticsHistory,
	IEmployeeStatisticsHistoryFindInput
} from '@gauzy/contracts';
import { EmployeeStatisticsService, IDashboardWidgetContext, STATISTICS_CACHE_TTL_MS } from '@gauzy/ui-core/core';

/**
 * Window in which repeated invalidations of the same scope collapse into one.
 *
 * Every accounting widget on a canvas reacts to the same "refresh" click, so
 * without this the 2nd..Nth `invalidate()` would evict the entry the previous
 * widget had just re-created — turning one manual refresh into N HTTP requests.
 */
const INVALIDATE_COALESCE_MS = 250;

interface ICacheEntry<T> {
	readonly stream$: Observable<T>;
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
 * Builds the `/employee-statistics/history` request for a dashboard context.
 *
 * Parity-critical: it reproduces `HumanResourcesComponent.openHistoryDialog()`
 * exactly — including the fact that the range is sent RAW here, unlike the
 * `/employee-statistics/months` request the same page builds with `toUTC(...)`.
 * Normalizing it "for consistency" would make the widget report a different set
 * of records than the dialog does for the same selection.
 *
 * @param context - The ambient dashboard context.
 * @param employeeId - The employee the history is for.
 * @param type - Which history the endpoint should return.
 * @returns The find input the history endpoint expects.
 */
export function buildStatisticsHistoryRequest(
	context: IDashboardWidgetContext,
	employeeId: ID,
	type: EmployeeStatisticsHistoryEnum
): IEmployeeStatisticsHistoryFindInput {
	const { organizationId, tenantId, startDate, endDate } = context;
	return { employeeId: employeeId as string, organizationId, tenantId, startDate, endDate, type };
}

/**
 * Stable, order-independent fingerprint of the four fields the aggregate request
 * is made of.
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
		// Namespaced so an aggregate entry can never collide with a history entry
		// that happens to share the same organization/tenant/range.
		'kind=aggregate',
		`organizationId=${organizationId ?? ''}`,
		`tenantId=${tenantId ?? ''}`,
		`startDate=${toEpoch(startDate)}`,
		`endDate=${toEpoch(endDate)}`
	].join('&');
}

/**
 * Stable fingerprint of the six fields the history request is made of.
 *
 * @param context - The ambient dashboard context.
 * @param employeeId - The employee the history is for.
 * @param type - Which history is being requested.
 * @returns The cache key for this scope.
 */
function historyCacheKey(
	context: IDashboardWidgetContext,
	employeeId: ID,
	type: EmployeeStatisticsHistoryEnum
): string {
	const { organizationId, tenantId, startDate, endDate } = context;
	return [
		'kind=history',
		`employeeId=${employeeId ?? ''}`,
		`type=${type ?? ''}`,
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
 * Request-coalescing cache in front of {@link EmployeeStatisticsService}.
 *
 * It fronts the two endpoints the Accounting widgets read:
 *
 * - `/employee-statistics/aggregate` — the KPIs (income, expenses, profit,
 *   bonus), the cash-flow chart and the per-employee breakdown table are SIX
 *   projections of ONE response, exactly like the six Time Tracking counters
 *   share one counts payload.
 * - `/employee-statistics/history` — the Records History and Profit History
 *   widgets both read it, and a Records History widget configured to `INCOME`
 *   shares its response with the Profit History widget beside it.
 *
 * Without this service, dropping those widgets on one canvas would issue an
 * identical request per widget on every context change.
 *
 * Mirrors `TimesheetStatisticsCacheService`: keyed by the request scope, entries
 * expire after {@link STATISTICS_CACHE_TTL_MS}, and the returned observables are
 * long-lived so they re-resolve after an {@link invalidate}.
 *
 * Errors are NOT swallowed — widgets need them to render an error state. As
 * usual in RxJS an error terminates the subscription, so a widget's `refresh()`
 * has to RE-CALL {@link getAggregate} / {@link getStatisticsHistory}
 * (re-subscribe) rather than merely call {@link invalidate}, or a failed widget
 * could never recover. The failed entry is evicted on error, so that re-call
 * always hits the network.
 */
@Injectable({ providedIn: 'root' })
export class AccountingStatisticsCacheService {
	private readonly _employeeStatisticsService = inject(EmployeeStatisticsService);

	private readonly _cache = new Map<string, ICacheEntry<unknown>>();
	private readonly _invalidated$ = new Subject<void>();

	/**
	 * When each scope was last invalidated — the guard against the refresh
	 * stampede described on {@link INVALIDATE_COALESCE_MS}.
	 *
	 * A map rather than a single "last key" slot: this cache now serves several
	 * scopes at once (one aggregate, one history entry per widget), so widgets
	 * refreshing in an interleaved order (A, B, A) would defeat a single slot and
	 * evict A twice.
	 */
	private readonly _lastInvalidatedAt = new Map<string, number>();

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

		return this._shared(key, () => this._employeeStatisticsService.getAggregateStatisticsByOrganizationId(request));
	}

	/**
	 * Income/expense history rows of one employee over the context's range.
	 *
	 * @param context - The dashboard context to query for.
	 * @param employeeId - The employee the history is for.
	 * @param type - Which history to return (income, expenses, bonus income, ...).
	 * @returns A shared stream that re-resolves after every invalidation.
	 */
	public getStatisticsHistory(
		context: IDashboardWidgetContext,
		employeeId: ID,
		type: EmployeeStatisticsHistoryEnum
	): Observable<IEmployeeStatisticsHistory[]> {
		const request = buildStatisticsHistoryRequest(context, employeeId, type);
		const key = historyCacheKey(context, employeeId, type);

		return this._shared(key, () => this._employeeStatisticsService.getEmployeeStatisticsHistory(request));
	}

	/**
	 * Drops the cached aggregate response so the next subscriber re-fetches, and
	 * notifies live streams to re-resolve.
	 *
	 * Repeated calls for the same scope within {@link INVALIDATE_COALESCE_MS} are
	 * ignored, so every accounting widget may safely call this from its own
	 * `refresh()` without causing a request storm.
	 *
	 * @param context - Limit the invalidation to one context; omit to drop everything.
	 */
	public invalidate(context?: IDashboardWidgetContext): void {
		this._invalidateScope(context ? aggregateCacheKey(context) : '*');
	}

	/**
	 * Drops one cached history response so the next subscriber re-fetches.
	 *
	 * @param context - The dashboard context the history was fetched for.
	 * @param employeeId - The employee the history is for.
	 * @param type - Which history to drop.
	 */
	public invalidateHistory(
		context: IDashboardWidgetContext,
		employeeId: ID,
		type: EmployeeStatisticsHistoryEnum
	): void {
		this._invalidateScope(historyCacheKey(context, employeeId, type));
	}

	/**
	 * Unconditionally empties the cache — no coalescing, no notification.
	 *
	 * Use on hard boundaries (sign-out, organization switch) where replaying a
	 * previous tenant's numbers would be wrong.
	 */
	public clear(): void {
		this._cache.clear();
		this._lastInvalidatedAt.clear();
	}

	/**
	 * Evicts one scope (or everything for `'*'`) and re-resolves live streams,
	 * unless the same scope was already invalidated a moment ago.
	 *
	 * @param scope - Cache key to drop, or `'*'` for the whole cache.
	 */
	private _invalidateScope(scope: string): void {
		const now = Date.now();

		const last = this._lastInvalidatedAt.get(scope);
		if (last !== undefined && now - last < INVALIDATE_COALESCE_MS) {
			return;
		}
		this._rememberInvalidation(scope, now);

		if (scope === '*') {
			this._cache.clear();
		} else {
			this._cache.delete(scope);
		}
		this._invalidated$.next();
	}

	/**
	 * Records an invalidation timestamp, dropping the ones that can no longer
	 * suppress anything so a long session does not accumulate dead scopes.
	 *
	 * @param scope - The scope just invalidated.
	 * @param now - The current epoch value.
	 */
	private _rememberInvalidation(scope: string, now: number): void {
		for (const [key, at] of Array.from(this._lastInvalidatedAt.entries())) {
			if (now - at >= INVALIDATE_COALESCE_MS) {
				this._lastInvalidatedAt.delete(key);
			}
		}
		this._lastInvalidatedAt.set(scope, now);
	}

	/**
	 * The long-lived stream for one cache key: re-resolves the cached entry after
	 * every invalidation, and shares one subscription among the widgets.
	 *
	 * @param key - Cache key of the request.
	 * @param fetch - Issues the request; called only on a cache miss.
	 * @returns A shared stream that re-resolves after every invalidation.
	 */
	private _shared<T>(key: string, fetch: () => Promise<T>): Observable<T> {
		return this._invalidated$.pipe(
			startWith(undefined),
			switchMap(() => this._cached<T>(key, fetch)),
			// refCount so the widget's subscription is the only thing keeping this
			// wrapper alive; the cached entry itself outlives it (that is the point).
			shareReplay({ bufferSize: 1, refCount: true })
		);
	}

	/**
	 * Returns the shared observable for `key`, creating it on a miss.
	 *
	 * `defer` keeps the call lazy (nothing is requested until a widget subscribes)
	 * and `shareReplay({ refCount: false })` hands the SAME in-flight promise to
	 * every subsequent subscriber — this is what collapses the widgets reading one
	 * endpoint into one HTTP request.
	 *
	 * @param key - Cache key of the request.
	 * @param fetch - Issues the request; called only on a cache miss.
	 */
	private _cached<T>(key: string, fetch: () => Promise<T>): Observable<T> {
		const now = Date.now();
		const hit = this._cache.get(key);
		if (hit && hit.expiresAt > now) {
			// Safe: entries are only ever written by the `_shared` call that owns the
			// key, and a key encodes both the endpoint (`kind=`) and its parameters.
			return hit.stream$ as Observable<T>;
		}

		this._prune(now);

		// Holder so the error handler can identify "its own" entry without a
		// use-before-assignment dance on the entry const itself.
		const own: { entry?: ICacheEntry<T> } = {};
		const stream$: Observable<T> = defer(() => from(fetch())).pipe(
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
