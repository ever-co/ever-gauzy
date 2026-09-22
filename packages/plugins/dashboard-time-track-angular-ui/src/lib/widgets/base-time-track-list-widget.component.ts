import { computed, Directive, inject, OnInit, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';
import { IDashboardWidgetContext, TimesheetStatisticsCacheService } from '@gauzy/ui-core/core';
import { BaseDashboardWidgetComponent } from '@gauzy/ui-core/shared';
import {
	RangePeriod,
	rangeMessageKey,
	resolveRangePeriod,
	timeTrackScopeKey,
	toErrorMessage
} from './time-track-widget.utils';

/**
 * Shared data layer for the five list-shaped Time Tracking widgets — Manual
 * Time, Tasks, Projects, Apps & URLs and Members.
 *
 * Each of them is one of the "windows" the legacy Time Tracking page renders,
 * and each reads a different `/timesheet/statistics/*` endpoint. Fetching goes
 * through {@link TimesheetStatisticsCacheService}, which already exposes every
 * one of those endpoints: it collapses identical in-flight requests into one, so
 * dropping the same panel twice on a canvas (or a panel next to the counters
 * that share its scope) still costs a single HTTP call per endpoint.
 *
 * Subclasses only decide WHICH endpoint they read and how a row renders; they
 * never own loading, error or empty handling.
 *
 * @typeParam T - Row type of the panel.
 */
@Directive()
export abstract class BaseTimeTrackListWidgetComponent<T> extends BaseDashboardWidgetComponent implements OnInit {
	/** Request-coalescing cache in front of the timesheet statistics endpoints. */
	protected readonly statisticsCache = inject(TimesheetStatisticsCacheService);

	/** Manual re-fetch trigger, fed by {@link refresh}. */
	private readonly _reload$ = new Subject<void>();

	/** Rows currently on screen; empty until the first successful fetch. */
	protected readonly rows = signal<T[]>([]);

	/** Context the current rows were fetched for; powers the range-aware copy. */
	protected readonly widgetContext = signal<IDashboardWidgetContext | null>(null);

	/**
	 * Whether a fetch has completed at least once.
	 *
	 * Without it an empty `rows()` on the very first paint would render "no
	 * manual time for the week" before anything had been requested.
	 */
	private readonly _loaded = signal<boolean>(false);

	/** Day / week / arbitrary-period classification of the selected range. */
	protected readonly rangePeriod: Signal<RangePeriod> = computed(() => resolveRangePeriod(this.widgetContext()));

	/** Displayable form of the base class' `error` signal. */
	protected readonly errorMessage: Signal<string | null> = computed(() => toErrorMessage(this.error()));

	/** True once a fetch has succeeded and produced nothing to show. */
	protected readonly isEmpty: Signal<boolean> = computed(() => this._loaded() && this.rows().length === 0);

	/**
	 * Range-aware "nothing here" message, e.g. `TIMESHEET.NO_MANUAL_TIME_WEEK`.
	 *
	 * Safe despite {@link emptyMessageBaseKey} being a subclass field: a
	 * `computed` only runs its body when first READ (from the template), long
	 * after the subclass' field initializers.
	 */
	protected readonly emptyMessageKey: Signal<string> = computed(() =>
		rangeMessageKey(this.emptyMessageBaseKey, this.rangePeriod())
	);

	/**
	 * Translation key of the empty message WITHOUT its `_DAY` / `_WEEK` /
	 * `_PERIOD` suffix, e.g. `TIMESHEET.NO_MANUAL_TIME`.
	 */
	protected abstract readonly emptyMessageBaseKey: string;

	/**
	 * Reads this panel's endpoint for the given context.
	 *
	 * Implementations MUST go through {@link statisticsCache} rather than
	 * `TimesheetStatisticsService`: the cache is what collapses identical requests
	 * into one, and it is also what applies the organization's UTC offset the same
	 * way the legacy page does (`buildStatisticsRequest`), so a widget and the
	 * standard dashboard never disagree about the same numbers.
	 *
	 * @param context - The dashboard context to query for.
	 * @returns The rows to render.
	 */
	protected abstract fetch(context: IDashboardWidgetContext): Observable<T[]>;

	/**
	 * Starts the rows subscription.
	 *
	 * Deliberately does NOT call `super.ngOnInit()`: the base class' default is to
	 * call {@link refresh} on every context emission, which here would push an
	 * extra value through `_reload$` and fetch the same payload twice. This class
	 * subscribes to `context$` itself instead.
	 *
	 * Subclasses that need extra data must override this and call `super.ngOnInit()`.
	 */
	public override ngOnInit(): void {
		// Show the skeleton from the very first paint: the canvas may take a moment
		// to resolve an organization, and an empty list would read as real data.
		this.loading.set(true);
		this.observeRows();
	}

	/**
	 * Re-fetches this panel's rows, clearing any previous error first.
	 *
	 * Invoked by the widget host's refresh control and by the state wrapper's
	 * retry button.
	 */
	public override refresh(): void {
		this.clearError();

		// Without dropping the cached payload a manual refresh inside the cache TTL
		// would silently replay the stale rows. `invalidate()` coalesces per scope,
		// so every Time Tracking widget on the canvas refreshing at once still
		// causes one request per endpoint.
		const context = this.widgetContext();
		if (context) {
			this.statisticsCache.invalidate(context);
		}

		// Pushing through `_reload$` also RE-CALLS `fetch()`. That matters after a
		// failure: an errored cache stream is terminated and no longer reacts to
		// `invalidate()`, so a widget that only invalidated could never recover.
		this._reload$.next();
	}

	/**
	 * Wires `context$` (plus manual reloads) to {@link fetch} and mirrors the
	 * request lifecycle into the `loading` / `error` signals.
	 */
	private observeRows(): void {
		combineLatest([
			// Compare on the request fingerprint only: an unrelated store write
			// hands out a new `organization` object on every emission, and without
			// this each of them would re-run the fetch for an identical payload.
			this.context$.pipe(
				distinctUntilChanged(
					(previous: IDashboardWidgetContext, current: IDashboardWidgetContext) =>
						timeTrackScopeKey(previous) === timeTrackScopeKey(current)
				)
			),
			this._reload$.pipe(startWith(undefined))
		])
			.pipe(
				map(([context]) => context),
				// A context without an organization cannot produce a meaningful
				// request; the canvas shows the "select an organization" state.
				filter((context): context is IDashboardWidgetContext => !!context?.organizationId),
				tap((context: IDashboardWidgetContext) => {
					this.widgetContext.set(context);
					this.loading.set(true);
					this.clearError();
				}),
				// switchMap, not mergeMap: a fast date-range change must abandon the
				// previous request instead of racing it to the signal.
				switchMap((context: IDashboardWidgetContext) =>
					this.fetch(context).pipe(
						catchError((error: unknown) => {
							this.setError(error);
							// `null`, not `[]`: an empty array would blank a working
							// panel and then claim there is no data.
							return of(null);
						})
					)
				),
				tap((rows: T[] | null) => {
					// Keep the last good rows in the signal when a refresh fails: the
					// state wrapper shows the error instead of them, but a successful
					// retry then re-renders straight into the previous content rather
					// than flashing the empty state on the way back.
					if (rows) {
						this.rows.set(rows);
						this._loaded.set(true);
					}
					this.loading.set(false);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}
}
