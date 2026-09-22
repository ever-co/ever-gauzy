import { computed, Directive, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of, Subject } from 'rxjs';
import { catchError, filter, map, startWith, switchMap, tap } from 'rxjs/operators';
import { ICountsStatistics } from '@gauzy/contracts';
import { IDashboardWidgetContext, TimesheetStatisticsCacheService } from '@gauzy/ui-core/core';
import { BaseDashboardWidgetComponent } from '@gauzy/ui-core/shared';
import {
	isCurrentWeekRange,
	RangePeriod,
	resolvePeriodSeconds,
	resolveRangePeriod,
	toErrorMessage
} from './time-track-widget.utils';

/**
 * Shared data layer for every Time Tracking counter widget.
 *
 * All six counters are projections of the very same
 * `/timesheet/statistics/counts` payload, so they all subscribe to the ambient
 * dashboard context here and fetch through {@link TimesheetStatisticsCacheService}.
 * The cache collapses the six identical in-flight requests into one — which is
 * the whole reason a counter is cheap enough to be dropped on a canvas six times.
 *
 * Subclasses only decide *which* number of the payload they show and how it is
 * formatted; they never fetch.
 */
@Directive()
export abstract class BaseTimeTrackCounterWidgetComponent extends BaseDashboardWidgetComponent implements OnInit {
	private readonly _statisticsCache = inject(TimesheetStatisticsCacheService);

	/** Manual re-fetch trigger, fed by {@link refresh}. */
	private readonly _reload$ = new Subject<void>();

	/** Latest counts payload; `null` until the first successful fetch. */
	protected readonly counts = signal<ICountsStatistics | null>(null);

	/** Context the current payload was fetched for; powers the period-aware titles. */
	protected readonly widgetContext = signal<IDashboardWidgetContext | null>(null);

	/** Day / week / arbitrary-period classification of the selected range. */
	protected readonly rangePeriod = computed<RangePeriod>(() => resolveRangePeriod(this.widgetContext()));

	/** True when the selected range is exactly the current calendar week. */
	protected readonly isCurrentWeek = computed<boolean>(() => isCurrentWeekRange(this.widgetContext()));

	/** Workable seconds in the range across all members — the duration counters' denominator. */
	protected readonly periodSeconds = computed<number>(() =>
		resolvePeriodSeconds(this.widgetContext(), this.counts()?.employeesCount ?? 0)
	);

	/** Displayable form of the base class' `error` signal. */
	protected readonly errorMessage = computed<string | null>(() => toErrorMessage(this.error()));

	/**
	 * Starts the counts subscription.
	 *
	 * Deliberately does NOT call `super.ngOnInit()`: the base class' default is to
	 * call {@link refresh} on every context emission, which here would push an
	 * extra value through `_reload$` and fetch the same payload twice. This class
	 * subscribes to `context$` itself instead.
	 *
	 * Subclasses that need extra data (total members, total projects) override
	 * this and must call `super.ngOnInit()`.
	 */
	public override ngOnInit(): void {
		// Show the skeleton from the very first paint: the canvas may take a moment
		// to resolve an organization, and a hard "0" would read as real data.
		this.loading.set(true);
		this.observeCounts();
	}

	/**
	 * Re-fetches the counts payload, clearing any previous error first.
	 *
	 * Invoked by the widget host's refresh control and by the card's retry button.
	 */
	public override refresh(): void {
		this.error.set(null);

		// Without dropping the cached payload a manual refresh inside the cache TTL
		// would silently replay the stale numbers. `invalidate()` coalesces per
		// scope, so all six counters refreshing at once still cause one request.
		const context = this.widgetContext();
		if (context) {
			this._statisticsCache.invalidate(context);
		}

		this._reload$.next();
	}

	/**
	 * Wires `context$` (plus manual reloads) to the cached counts endpoint and
	 * mirrors the request lifecycle into the `loading` / `error` signals.
	 */
	private observeCounts(): void {
		combineLatest([this.context$, this._reload$.pipe(startWith(undefined))])
			.pipe(
				map(([context]) => context),
				// A context without an organization cannot produce a meaningful
				// request; the canvas shows the "select an organization" state.
				filter((context): context is IDashboardWidgetContext => !!context?.organizationId),
				tap((context: IDashboardWidgetContext) => {
					this.widgetContext.set(context);
					this.loading.set(true);
					this.error.set(null);
				}),
				// switchMap, not mergeMap: a fast date-range change must abandon
				// the previous request instead of racing it to the signal.
				switchMap((context: IDashboardWidgetContext) =>
					// The cache service takes the context itself and does the
					// request shaping (`buildStatisticsRequest`) — reproducing it
					// here is what makes a widget disagree with the standard
					// dashboard about the UTC offset.
					this._statisticsCache.getCounts(context).pipe(
						catchError((error: unknown) => {
							this.error.set(toErrorMessage(error));
							return of(null);
						})
					)
				),
				tap((counts: ICountsStatistics | null) => {
					// Keep the last good payload on screen when a refresh fails,
					// rather than blanking a working widget.
					if (counts) {
						this.counts.set(counts);
					}
					this.loading.set(false);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}
}
