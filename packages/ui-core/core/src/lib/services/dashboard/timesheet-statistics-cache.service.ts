import { inject, Injectable } from '@angular/core';
import { defer, from, Observable, Subject, throwError } from 'rxjs';
import { catchError, shareReplay, startWith, switchMap } from 'rxjs/operators';
import {
	IActivitiesStatistics,
	ICountsStatistics,
	IGetActivitiesStatistics,
	IGetCountsStatistics,
	IGetManualTimesStatistics,
	IGetMembersStatistics,
	IGetProjectsStatistics,
	IGetTasksStatistics,
	IGetTimeSlotStatistics,
	IManualTimesStatistics,
	IMembersStatistics,
	IProjectsStatistics,
	ITasksStatistics,
	ITimeLogFilters,
	ITimeLogTodayFilters,
	ITimeSlotStatistics
} from '@gauzy/contracts';
import { isNotEmpty, toUtcOffset } from '@gauzy/ui-core/common';
import { IDashboardWidgetContext } from './dashboard-widget-context';
import { TimesheetStatisticsService } from '../timesheet/timesheet-statistics.service';

/** Date format the timesheet statistics API expects. */
const API_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
 * How long a fetched statistics response stays reusable.
 *
 * Long enough to collapse the widgets of one dashboard render into a single
 * request per endpoint, short enough that a user tabbing back to a dashboard
 * gets fresh numbers.
 */
export const STATISTICS_CACHE_TTL_MS = 15_000;

/**
 * Window in which repeated invalidations of the same scope collapse into one.
 *
 * Every widget on a canvas reacts to the same "refresh" click, so without this
 * the 2nd..Nth `invalidate()` would evict the entry the previous widget had
 * just re-created — turning one manual refresh into N HTTP requests.
 */
const INVALIDATE_COALESCE_MS = 250;

/** Cache discriminator for the statistics endpoints this service wraps. */
type StatisticsEndpoint = 'counts' | 'time-slots' | 'activities' | 'projects' | 'tasks' | 'manual-times' | 'members';

/**
 * The payload every statistics endpoint receives.
 *
 * Every `IGet*Statistics` interface extends `ITimeLogFilters` and adds only
 * optional members, so this type is directly assignable to all of them.
 */
export type StatisticsRequestPayload = ITimeLogFilters & ITimeLogTodayFilters & { take?: number };

interface ICacheEntry {
	readonly stream$: Observable<unknown>;
	readonly expiresAt: number;
}

/**
 * Serializes a request object into a stable string, independent of key order.
 *
 * @param value - The object to serialize.
 * @returns A deterministic string representation.
 */
function stableStringify(value: object): string {
	const record = value as Record<string, unknown>;
	return Object.keys(record)
		.sort()
		.map((key: string) => `${key}=${JSON.stringify(record[key])}`)
		.join('&');
}

/**
 * Builds the timesheet statistics request payload for a dashboard context.
 *
 * This is the parity-critical function: it reproduces
 * `TimeTrackingComponent.preparePayloads()` exactly — same UTC-offset shift,
 * same `YYYY-MM-DD HH:mm:ss` serialization, same "omit empty scopes" rule — so
 * a canvas widget and the standard dashboard send byte-identical requests and
 * therefore render identical numbers.
 *
 * @param context - The ambient dashboard context.
 * @returns The request payload shared by every statistics endpoint.
 */
export function buildStatisticsRequest(context: IDashboardWidgetContext): StatisticsRequestPayload {
	const { tenantId, organizationId, startDate, endDate, todayStart, todayEnd, timeZone } = context;

	const request: StatisticsRequestPayload = {
		tenantId,
		organizationId,
		todayStart: toUtcOffset(todayStart, timeZone).format(API_DATE_FORMAT),
		todayEnd: toUtcOffset(todayEnd, timeZone).format(API_DATE_FORMAT),
		startDate: toUtcOffset(startDate, timeZone).format(API_DATE_FORMAT),
		endDate: toUtcOffset(endDate, timeZone).format(API_DATE_FORMAT),
		timeZone
	};

	// `isNotEmpty` also rejects `[null]`, which is what the "All Employees"
	// selection produces — sending it would filter on a non-existent employee.
	if (isNotEmpty(context.employeeIds)) {
		request.employeeIds = context.employeeIds;
	}
	if (isNotEmpty(context.projectIds)) {
		request.projectIds = context.projectIds;
	}
	if (isNotEmpty(context.teamIds)) {
		request.teamIds = context.teamIds;
	}

	return request;
}

/**
 * Adds the `durationPercentage` field the Apps & URLs widgets render, using the
 * same total-of-the-page denominator the standard dashboard uses.
 *
 * @param activities - Raw activities as returned by the API.
 * @returns A new array with `durationPercentage` populated.
 */
export function withDurationPercentage(activities: IActivitiesStatistics[]): IActivitiesStatistics[] {
	const total = (activities ?? []).reduce(
		(sum: number, activity: IActivitiesStatistics) => sum + parseInt(activity.duration + '', 10),
		0
	);

	return (activities ?? []).map((activity: IActivitiesStatistics) => ({
		...activity,
		durationPercentage: total ? (activity.duration * 100) / total : 0
	}));
}

/**
 * Request-coalescing cache in front of {@link TimesheetStatisticsService}.
 *
 * A dashboard canvas renders many widgets that all describe the same slice of
 * data — the six counter widgets, for instance, are six views of ONE
 * `/timesheet/statistics/counts` response. Without this service each of them
 * would issue its own HTTP request on every context change.
 *
 * Keyed by the serialized request payload, so widgets that narrow the context
 * (pinned to a project, say) correctly get their own request.
 *
 * The returned observables are long-lived: they re-resolve against the cache
 * whenever `invalidate()` fires, so a widget can simply hold one subscription
 * and receive fresh data after a manual refresh.
 *
 * Errors are NOT swallowed — widgets need them to render an error state. As
 * usual in RxJS an error terminates the subscription, which has one consequence
 * callers MUST honour: once a stream has errored it is dead and will no longer
 * react to {@link TimesheetStatisticsCacheService.invalidate}. A widget's
 * `refresh()` therefore has to RE-CALL the getter (re-subscribe), not merely
 * call `invalidate()`, or a failed widget can never recover. The failed cache
 * entry is evicted on error, so the re-call always hits the network.
 */
@Injectable({ providedIn: 'root' })
export class TimesheetStatisticsCacheService {
	private readonly _timesheetStatisticsService = inject(TimesheetStatisticsService);

	private readonly _cache = new Map<string, ICacheEntry>();
	private readonly _invalidated$ = new Subject<void>();

	/** Guards against the refresh stampede described on INVALIDATE_COALESCE_MS. */
	private _lastInvalidatedKey: string | null = null;
	private _lastInvalidatedAt = 0;

	/** Emits after every effective invalidation. */
	public readonly invalidated$: Observable<void> = this._invalidated$.asObservable();

	/*
	|--------------------------------------------------------------------------
	| Endpoints
	|--------------------------------------------------------------------------
	*/

	/**
	 * Counts used by the six counter widgets (members worked, projects worked,
	 * today activity, worked today, worked this period, activity this period).
	 *
	 * @param context - The dashboard context to query for.
	 */
	public getCounts(context: IDashboardWidgetContext): Observable<ICountsStatistics> {
		return this._resolve<ICountsStatistics>(context, 'counts', (payload: IGetCountsStatistics) =>
			this._timesheetStatisticsService.getCounts(payload)
		);
	}

	/**
	 * Application / URL activity buckets.
	 *
	 * Returns the raw API payload — use {@link withDurationPercentage} when the
	 * widget needs the relative share.
	 *
	 * @param context - The dashboard context to query for.
	 */
	public getActivities(context: IDashboardWidgetContext): Observable<IActivitiesStatistics[]> {
		return this._resolve<IActivitiesStatistics[]>(context, 'activities', (payload: IGetActivitiesStatistics) =>
			this._timesheetStatisticsService.getActivities(payload)
		);
	}

	/**
	 * Recent time slots (screenshot / activity strip).
	 *
	 * @param context - The dashboard context to query for.
	 */
	public getTimeSlots(context: IDashboardWidgetContext): Observable<ITimeSlotStatistics[]> {
		return this._resolve<ITimeSlotStatistics[]>(context, 'time-slots', (payload: IGetTimeSlotStatistics) =>
			this._timesheetStatisticsService.getTimeSlots(payload)
		);
	}

	/**
	 * Time tracked per project.
	 *
	 * @param context - The dashboard context to query for.
	 */
	public getProjects(context: IDashboardWidgetContext): Observable<IProjectsStatistics[]> {
		return this._resolve<IProjectsStatistics[]>(context, 'projects', (payload: IGetProjectsStatistics) =>
			this._timesheetStatisticsService.getProjects(payload)
		);
	}

	/**
	 * Time tracked per task.
	 *
	 * @param context - The dashboard context to query for.
	 * @param take - Page size; defaults to the 5 the standard dashboard requests.
	 */
	public getTasks(context: IDashboardWidgetContext, take: number = 5): Observable<ITasksStatistics[]> {
		return this._resolve<ITasksStatistics[]>(
			context,
			'tasks',
			(payload: IGetTasksStatistics) => this._timesheetStatisticsService.getTasksStatistics(payload),
			{ take }
		);
	}

	/**
	 * Manually entered time entries.
	 *
	 * @param context - The dashboard context to query for.
	 */
	public getManualTimes(context: IDashboardWidgetContext): Observable<IManualTimesStatistics[]> {
		return this._resolve<IManualTimesStatistics[]>(context, 'manual-times', (payload: IGetManualTimesStatistics) =>
			this._timesheetStatisticsService.getManualTimes(payload)
		);
	}

	/**
	 * Per-member weekly / today totals.
	 *
	 * @param context - The dashboard context to query for.
	 */
	public getMembers(context: IDashboardWidgetContext): Observable<IMembersStatistics[]> {
		return this._resolve<IMembersStatistics[]>(context, 'members', (payload: IGetMembersStatistics) =>
			this._timesheetStatisticsService.getMembers(payload)
		);
	}

	/*
	|--------------------------------------------------------------------------
	| Invalidation
	|--------------------------------------------------------------------------
	*/

	/**
	 * Drops cached responses so the next subscriber re-fetches, and notifies
	 * live streams (returned by the getters above) to re-resolve.
	 *
	 * Repeated calls for the same scope within {@link INVALIDATE_COALESCE_MS} are
	 * ignored, so every widget on a canvas may safely call this from its own
	 * `refresh()` without causing a request storm.
	 *
	 * @param context - Limit the invalidation to one context; omit to drop everything.
	 */
	public invalidate(context?: IDashboardWidgetContext): void {
		const scope = context ? this._contextHash(context) : '*';
		const now = Date.now();

		if (this._lastInvalidatedKey === scope && now - this._lastInvalidatedAt < INVALIDATE_COALESCE_MS) {
			return;
		}
		this._lastInvalidatedKey = scope;
		this._lastInvalidatedAt = now;

		this._drop(context);
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

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Builds the long-lived stream handed to widgets: it resolves a cache entry
	 * now and again after every invalidation.
	 */
	private _resolve<T>(
		context: IDashboardWidgetContext,
		endpoint: StatisticsEndpoint,
		request: (payload: StatisticsRequestPayload) => Promise<T>,
		// Deliberately NOT `Record<string, unknown>`: spreading an index-signature
		// type into the typed payload literal below widens every value to `unknown`.
		extra?: Partial<StatisticsRequestPayload>
	): Observable<T> {
		const payload: StatisticsRequestPayload = { ...buildStatisticsRequest(context), ...(extra ?? {}) };
		const key = `${this._contextHash(context)}::${endpoint}::${extra ? stableStringify(extra) : ''}`;

		return this._invalidated$.pipe(
			startWith(undefined),
			switchMap(() => this._cached<T>(key, () => request(payload))),
			// refCount so the widget's subscription is the only thing keeping this
			// wrapper alive; the cached entry itself outlives it (that is the point).
			shareReplay({ bufferSize: 1, refCount: true })
		);
	}

	/**
	 * Returns the shared observable for `key`, creating it on a miss.
	 *
	 * `defer` keeps the call lazy (nothing is requested until a widget
	 * subscribes) and `shareReplay({ refCount: false })` hands the SAME in-flight
	 * promise to every subsequent subscriber — this is what collapses six
	 * counter widgets into one HTTP request.
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
			catchError((error) => {
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

	/** Stable fingerprint of the context-derived part of a request payload. */
	private _contextHash(context: IDashboardWidgetContext): string {
		return stableStringify(buildStatisticsRequest(context));
	}

	/** Removes cache entries for one context, or all of them. */
	private _drop(context?: IDashboardWidgetContext): void {
		if (!context) {
			this._cache.clear();
			return;
		}

		const prefix = `${this._contextHash(context)}::`;
		for (const key of Array.from(this._cache.keys())) {
			if (key.startsWith(prefix)) {
				this._cache.delete(key);
			}
		}
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
