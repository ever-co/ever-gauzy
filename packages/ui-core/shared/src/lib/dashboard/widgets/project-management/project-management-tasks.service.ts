import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { IPagination, ITask } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { IDashboardWidgetContext, STATISTICS_CACHE_TTL_MS } from '@gauzy/ui-core/core';
import { IProjectManagementSnapshot } from './project-management-dashboard.types';
import { buildProjectManagementSnapshot, projectManagementScopeKey, scopedId } from './project-management-widget.utils';

/**
 * How many tasks one snapshot samples.
 *
 * The legacy panel pages through the whole task list with an infinite scroll; a
 * canvas card has no room for that, so the widgets read one page. It is a shared
 * CONSTANT rather than a per-widget setting because two widgets asking for
 * different page sizes would hash to different cache keys and defeat the request
 * sharing this service exists for.
 *
 * Set to 100 — the hard ceiling `PaginationQueryDTO.take` (`@Max(100)`) enforces
 * on the API side, so this is as large a sample as the endpoints can return in
 * one call. That matters beyond the row count: the Most Viewed Projects ranking
 * is derived from this same page, so the page size IS the ranking's sample size
 * (see `sortProjectsByPopularity`). Ranking beyond it would need a server-side
 * "tasks per project" aggregate, which no endpoint exposes today.
 */
export const PROJECT_MANAGEMENT_TASKS_PAGE_SIZE = 100;

/** Relations the legacy Project Management panel loads with its tasks. */
const TASK_RELATIONS: string[] = ['project', 'tags'];

/**
 * Window in which repeated invalidations of the same scope collapse into one.
 *
 * Every Project Management widget on a canvas reacts to the same "refresh"
 * click, so without this the 2nd..Nth `invalidate()` would evict the entry the
 * previous widget had just re-created — turning one manual refresh into N HTTP
 * requests.
 */
const INVALIDATE_COALESCE_MS = 250;

interface ICacheEntry {
	readonly stream$: Observable<IProjectManagementSnapshot>;
	readonly expiresAt: number;
	/**
	 * Aborts the entry's HTTP call when the entry is dropped.
	 *
	 * See {@link ProjectManagementTasksService._drop}: because the shared stream is
	 * built with `refCount: false`, unsubscribing every widget does NOT tear the
	 * request down, so an evicted entry would otherwise keep a request in flight
	 * that nothing can ever read.
	 */
	readonly released$: Subject<void>;
}

/** An endpoint plus the query string to call it with. */
interface ITasksRequest {
	readonly endPoint: string;
	readonly params: HttpParams;
}

/**
 * Builds the task request for a dashboard context.
 *
 * Parity-critical: it reproduces
 * `ProjectManagementDetailsComponent._setSmartTableSource()` — the same two
 * endpoints, the same relations and the same `dueDate` ascending order — with
 * ONE correction.
 *
 * The legacy page sends `where.employeeId` to `/tasks/employee`, but
 * `TaskService.getEmployeeTasks()` reads `where.members.id` and ignores every
 * other key (it builds its query by hand and never feeds `where` to TypeORM).
 * For a user holding `CHANGE_SELECTED_EMPLOYEE` — i.e. every admin who can use
 * the employee selector — that means the legacy panel silently returns the whole
 * organization's tasks whichever employee is picked. This sends the key the
 * server actually reads, so the widget honours the selector.
 *
 * @param context - The ambient dashboard context.
 * @returns The endpoint and params to fetch the task page with.
 */
export function buildProjectManagementTasksRequest(context: IDashboardWidgetContext): ITasksRequest {
	const { organizationId, tenantId } = context;
	const employeeId = scopedId(context.employeeIds);
	const projectId = scopedId(context.projectIds);

	return {
		// `/tasks/employee` resolves "tasks of this person", including the ones
		// they only own through a team; `/tasks/pagination` is the organization
		// wide list. Same split as the legacy page.
		endPoint: employeeId ? `${API_PREFIX}/tasks/employee` : `${API_PREFIX}/tasks/pagination`,
		params: toParams({
			relations: TASK_RELATIONS,
			where: {
				organizationId,
				tenantId,
				...(employeeId ? { members: { id: employeeId } } : {}),
				...(projectId ? { projectId } : {})
			},
			order: { dueDate: 'ASC' },
			// `skip` is a 1-based PAGE NUMBER on this API, not an offset
			// (`CrudService.paginate` computes `take * (skip - 1)`).
			skip: 1,
			take: PROJECT_MANAGEMENT_TASKS_PAGE_SIZE
		})
	};
}

/**
 * Single source of truth for every Project Management dashboard widget.
 *
 * The legacy `ProjectManagementDetailsComponent` derives its Today, Most Viewed
 * Projects and Recently Assigned panels from ONE task list, and so does this
 * service. Without it, dropping the three data-driven widgets on a canvas would
 * issue three identical requests on every context change.
 *
 * Keyed by {@link projectManagementScopeKey}, so a widget that narrows the
 * context (pinned to one project, say) correctly gets its own fetch.
 *
 * Calls `HttpClient` directly rather than going through `TasksService`: that
 * service's `errorHandler` raises a global toastr on every failure, which for a
 * canvas of widgets means a stack of toasts for a problem that belongs inside
 * the failing card — and it rethrows a bare string, losing the status code.
 *
 * Errors are NOT swallowed: widgets need them to render an error state. As usual
 * in RxJS an error terminates the subscription, so a widget's `refresh()` must
 * RE-SUBSCRIBE (call {@link getSnapshot} again) rather than only invalidating —
 * the failed cache entry is evicted on error, so the re-call hits the network.
 */
@Injectable({ providedIn: 'root' })
export class ProjectManagementTasksService {
	private readonly _http = inject(HttpClient);

	private readonly _cache = new Map<string, ICacheEntry>();
	private readonly _invalidated$ = new Subject<void>();

	/** Guards against the refresh stampede described on {@link INVALIDATE_COALESCE_MS}. */
	private _lastInvalidatedKey: string | null = null;
	private _lastInvalidatedAt = 0;

	/** Emits after every effective invalidation. */
	public readonly invalidated$: Observable<void> = this._invalidated$.asObservable();

	/**
	 * Long-lived stream of the task snapshot for one dashboard context.
	 *
	 * Re-resolves against the cache after every {@link invalidate}, so a widget
	 * can hold a single subscription and still receive refreshed data.
	 *
	 * @param context - The ambient dashboard context to query for.
	 * @returns The snapshot stream; it errors when the underlying request fails.
	 */
	public getSnapshot(context: IDashboardWidgetContext): Observable<IProjectManagementSnapshot> {
		const key = projectManagementScopeKey(context);

		return this._invalidated$.pipe(
			startWith(undefined),
			switchMap(() => this._cached(key, context)),
			// refCount so the widget's subscription is the only thing keeping this
			// wrapper alive; the cached entry itself outlives it (that is the point).
			shareReplay({ bufferSize: 1, refCount: true })
		);
	}

	/**
	 * Drops cached snapshots so the next subscriber re-fetches, and notifies live
	 * streams to re-resolve.
	 *
	 * Repeated calls for the same scope within {@link INVALIDATE_COALESCE_MS} are
	 * ignored, so every Project Management widget on a canvas may call this from
	 * its own `refresh()` without causing a request storm.
	 *
	 * @param context - Limit the invalidation to one context; omit to drop everything.
	 */
	public invalidate(context?: IDashboardWidgetContext): void {
		const scope = context ? projectManagementScopeKey(context) : '*';
		const now = Date.now();

		if (this._lastInvalidatedKey === scope && now - this._lastInvalidatedAt < INVALIDATE_COALESCE_MS) {
			return;
		}
		this._lastInvalidatedKey = scope;
		this._lastInvalidatedAt = now;

		const dropped = context ? this._drop(scope) : this._dropAll();

		// Notify BEFORE releasing: `_invalidated$` makes every live `switchMap`
		// unsubscribe from the evicted entry and resolve a fresh one, so by the time
		// the old entry is aborted no widget is listening to it any more.
		this._invalidated$.next();
		this._release(dropped);
	}

	/**
	 * Unconditionally empties the cache — no coalescing, no notification.
	 *
	 * Use on hard boundaries (sign-out, organization switch) where replaying a
	 * previous organization's tasks would be wrong.
	 */
	public clear(): void {
		this._release(this._dropAll());
		this._lastInvalidatedKey = null;
		this._lastInvalidatedAt = 0;
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Returns the shared observable for `key`, creating it on a miss.
	 *
	 * `HttpClient` observables are cold, so nothing is fetched until a widget
	 * subscribes; `shareReplay({ refCount: false })` then hands the SAME in-flight
	 * response to every subsequent subscriber — this is what collapses the three
	 * data-driven widgets into one HTTP request, and what keeps the entry warm for
	 * the whole TTL after the last widget has unsubscribed.
	 */
	private _cached(key: string, context: IDashboardWidgetContext): Observable<IProjectManagementSnapshot> {
		const now = Date.now();
		const hit = this._cache.get(key);
		if (hit && hit.expiresAt > now) {
			return hit.stream$;
		}

		this._prune(now);

		const { endPoint, params } = buildProjectManagementTasksRequest(context);
		const request$: Observable<IPagination<ITask>> = this._http.get<IPagination<ITask>>(endPoint, { params });
		const released$ = new Subject<void>();

		// Holder so the error handler can identify "its own" entry without a
		// use-before-assignment dance on the entry const itself.
		const own: { entry?: ICacheEntry } = {};
		const stream$: Observable<IProjectManagementSnapshot> = request$.pipe(
			// FIRST in the chain, so it unsubscribes from `HttpClient` itself and the
			// XHR is actually aborted. Once the response has arrived `request$` has
			// completed and `takeUntil` has already dropped its notifier, so releasing
			// a settled entry is a no-op and can never truncate a replayed value.
			takeUntil(released$),
			map((response: IPagination<ITask>) =>
				buildProjectManagementSnapshot(response?.items ?? [], response?.total ?? 0)
			),
			shareReplay({ bufferSize: 1, refCount: false }),
			catchError((error: unknown) => {
				// A cached failure would be replayed to every subscriber for the whole
				// TTL; evict it so the next widget (or a retry) hits the network again.
				if (own.entry && this._cache.get(key) === own.entry) {
					this._cache.delete(key);
				}
				return throwError(() => error);
			})
		);

		own.entry = { stream$, expiresAt: now + STATISTICS_CACHE_TTL_MS, released$ };
		this._cache.set(key, own.entry);

		return stream$;
	}

	/**
	 * Removes one scope from the cache.
	 *
	 * @param key - The scope key to evict.
	 * @returns The evicted entry, if there was one, for {@link _release}.
	 */
	private _drop(key: string): ICacheEntry[] {
		const entry = this._cache.get(key);
		if (!entry) {
			return [];
		}

		this._cache.delete(key);
		return [entry];
	}

	/**
	 * Empties the cache.
	 *
	 * @returns Every evicted entry, for {@link _release}.
	 */
	private _dropAll(): ICacheEntry[] {
		const entries = Array.from(this._cache.values());
		this._cache.clear();
		return entries;
	}

	/**
	 * Aborts the requests of entries that are no longer reachable.
	 *
	 * Without this, a refresh issued while a fetch is still in flight would leave
	 * TWO requests running for the same scope: the evicted entry holds its source
	 * subscription open (`refCount: false`) even after every widget has switched
	 * away, so nothing would ever tear it down, and its response would be parsed
	 * and thrown away.
	 *
	 * @param entries - The entries {@link _drop} / {@link _dropAll} removed.
	 */
	private _release(entries: ICacheEntry[]): void {
		for (const entry of entries) {
			entry.released$.next();
			entry.released$.complete();
		}
	}

	/**
	 * Drops expired entries so long sessions do not accumulate dead scopes.
	 *
	 * Deliberately does NOT {@link _release} what it drops. Expiry only means the
	 * entry is too stale to be handed to the NEXT subscriber; widgets that are
	 * already subscribed keep theirs. Aborting here would cut off a request that
	 * merely outlived the TTL — its widget would complete without a value and sit
	 * in the loading state forever. Only an explicit invalidate/clear, where every
	 * subscriber is told to re-resolve, may abort.
	 */
	private _prune(now: number): void {
		for (const [key, entry] of Array.from(this._cache.entries())) {
			if (entry.expiresAt <= now) {
				this._cache.delete(key);
			}
		}
	}
}
