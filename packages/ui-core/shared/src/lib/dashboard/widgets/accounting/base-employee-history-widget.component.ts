import { Directive, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';
import { ID } from '@gauzy/contracts';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { BaseDashboardWidgetComponent } from '../../widget-host/base-dashboard-widget.component';
// Reused rather than re-derived: the history endpoint is scoped exactly like the
// `/employee-statistics/months` one the HR widgets read, so both the employee
// resolution and the "did the request scope actually move?" fingerprint (which
// tolerates a bookmark-restored, string-serialized date) are already written.
import { hrStatisticsKey, resolveHrEmployeeId } from '../hr/hr-statistics.utils';
import { AccountingStatisticsCacheService } from './accounting-statistics-cache.service';

/**
 * Shared data layer for the two employee-scoped history widgets (Records History
 * and Profit History).
 *
 * Both render a component that used to exist ONLY as a modal dialog, fed by the
 * Human Resources page. On a canvas there is no opener to hand them their rows,
 * so this class does what `HumanResourcesComponent.openHistoryDialog()` /
 * `openProfitDialog()` did: resolve the employee in scope, fetch from
 * `/employee-statistics/history` through {@link AccountingStatisticsCacheService}
 * (which collapses the requests both widgets share into one), and mirror the
 * request lifecycle into the `loading` / `error` signals.
 *
 * Subclasses only decide WHICH requests make up their payload.
 *
 * @typeParam T - Shape of the payload the subclass renders.
 */
@Directive()
export abstract class BaseEmployeeHistoryWidgetComponent<T> extends BaseDashboardWidgetComponent implements OnInit {
	protected readonly statisticsCache = inject(AccountingStatisticsCacheService);

	/** Manual re-fetch trigger, fed by {@link refresh}. */
	private readonly _reload$ = new Subject<void>();

	/** Context the current payload was fetched for. */
	protected readonly widgetContext = signal<IDashboardWidgetContext | null>(null);

	/** Latest payload; `null` until the first successful fetch. */
	protected readonly payload = signal<T | null>(null);

	/** The employee the history is about, or `null` when none is in scope. */
	protected readonly employeeId = computed<ID | null>(() => resolveHrEmployeeId(this.widgetContext()));

	/**
	 * True when the widget has nothing to query.
	 *
	 * `/employee-statistics/history` is per-employee, so with the selector on "All
	 * employees" there is no request to make — the widget shows an actionable hint
	 * instead of an empty table that looks like "this person has no records".
	 */
	protected readonly requiresEmployee = computed<boolean>(() => !!this.widgetContext() && !this.employeeId());

	/**
	 * Starts the history subscription.
	 *
	 * Deliberately does NOT call `super.ngOnInit()`: the base class' default is to
	 * call {@link refresh} on every context emission, which here would push an
	 * extra value through the reload trigger and fetch the same payload twice.
	 * This class subscribes to `context$` itself instead.
	 */
	public override ngOnInit(): void {
		// Show the skeleton from the very first paint: the canvas may take a moment
		// to resolve an organization, and an empty table would read as real data.
		this.loading.set(true);
		this.observeHistory();
	}

	/**
	 * Re-fetches the payload, clearing any previous error first.
	 *
	 * Invoked by the widget host's refresh control and by the state wrapper's
	 * retry button.
	 */
	public override refresh(): void {
		this.clearError();

		// Without dropping the cached payload a manual refresh inside the cache TTL
		// would silently replay the stale rows. The cache coalesces invalidations per
		// scope, so several history widgets refreshing at once still cause one
		// request per distinct scope.
		const context = this.widgetContext();
		const employeeId = this.employeeId();
		if (context && employeeId) {
			this.invalidate(context, employeeId);
		}

		this._reload$.next();
	}

	/**
	 * Issues the request(s) making up this widget's payload.
	 *
	 * @param context - The context to query for.
	 * @param employeeId - The employee in scope.
	 * @returns The payload stream.
	 */
	protected abstract fetch(context: IDashboardWidgetContext, employeeId: ID): Observable<T>;

	/**
	 * Drops whatever this widget cached, so {@link refresh} really re-fetches.
	 *
	 * @param context - The context the payload was fetched for.
	 * @param employeeId - The employee in scope.
	 */
	protected abstract invalidate(context: IDashboardWidgetContext, employeeId: ID): void;

	/**
	 * Wires `context$` (plus manual reloads) to {@link fetch} and mirrors the
	 * request lifecycle into the `loading` / `error` signals.
	 */
	private observeHistory(): void {
		// `distinctUntilChanged` sits on the CONTEXT, before the reload trigger is
		// merged in: applying it afterwards would swallow a manual refresh whose
		// context has not changed — which is every manual refresh.
		const scoped$: Observable<IDashboardWidgetContext> = this.context$.pipe(
			// A context without an organization cannot produce a meaningful request;
			// the canvas shows the "select an organization" state.
			filter((context): context is IDashboardWidgetContext => !!context?.organizationId),
			distinctUntilChanged(
				(previous: IDashboardWidgetContext, current: IDashboardWidgetContext) =>
					hrStatisticsKey(previous) === hrStatisticsKey(current)
			)
		);

		combineLatest([scoped$, this._reload$.pipe(startWith(undefined))])
			.pipe(
				map(([context]) => context),
				tap((context: IDashboardWidgetContext) => {
					this.widgetContext.set(context);
					this.loading.set(true);
					this.clearError();
				}),
				// switchMap, not mergeMap: a fast employee or date-range change must
				// abandon the previous request instead of racing it to the signal.
				switchMap((context: IDashboardWidgetContext) => this.fetchFor(context)),
				tap((payload: T | null) => {
					// `null` marks a failed request: `setError` has already run and the
					// last good payload stays on screen rather than blanking the widget.
					if (payload !== null) {
						this.payload.set(payload);
					}
					this.loading.set(false);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}

	/**
	 * One fetch for the given context, or nothing when there is no employee.
	 *
	 * @param context - The context to query for.
	 * @returns The payload, or `null` when the request failed.
	 */
	private fetchFor(context: IDashboardWidgetContext): Observable<T | null> {
		const employeeId = resolveHrEmployeeId(context);
		if (!employeeId) {
			// No employee in scope: `requiresEmployee` renders the hint, and the
			// previous employee's records must not linger behind it.
			this.payload.set(null);
			return of(null);
		}

		return this.fetch(context, employeeId).pipe(
			catchError((error: unknown) => {
				this.setError(error);
				return of(null);
			})
		);
	}
}
