import { Directive, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { BaseDashboardWidgetComponent } from '../../widget-host/base-dashboard-widget.component';
import { TeamsDashboardStatisticsService } from './teams-dashboard-statistics.service';
import { ITeamsDashboardSnapshot } from './teams-dashboard.types';
import { teamsScopeKey } from './teams-widget.utils';

/**
 * Shared data layer for every Teams dashboard widget.
 *
 * All Teams widgets are projections of the very same snapshot — teams, their
 * classified members, the worked project/member counts and the range's activity
 * percentage — so they all subscribe to the ambient dashboard context here and
 * fetch through {@link TeamsDashboardStatisticsService}. That service collapses
 * the identical in-flight requests into one, which is what makes it cheap to
 * drop several Teams widgets on the same canvas.
 *
 * Subclasses only decide WHICH part of the snapshot they render; they never fetch.
 */
@Directive()
export abstract class BaseTeamsWidgetComponent extends BaseDashboardWidgetComponent implements OnInit {
	private readonly _statistics = inject(TeamsDashboardStatisticsService);

	/** Manual re-fetch trigger, fed by {@link refresh}. */
	private readonly _reload$ = new Subject<void>();

	/** Latest snapshot; `null` until the first successful fetch. */
	protected readonly snapshot = signal<ITeamsDashboardSnapshot | null>(null);

	/** Context the current snapshot was fetched for. */
	protected readonly widgetContext = signal<IDashboardWidgetContext | null>(null);

	/**
	 * Starts the snapshot subscription.
	 *
	 * Deliberately does NOT call `super.ngOnInit()`: the base class' default is to
	 * call {@link refresh} on every context emission, which here would push an
	 * extra value through `_reload$` and fetch the same snapshot twice. This class
	 * subscribes to `context$` itself instead.
	 *
	 * Subclasses that need extra data must override this and call `super.ngOnInit()`.
	 */
	public override ngOnInit(): void {
		// Show the skeleton from the very first paint: the canvas may take a moment
		// to resolve an organization, and a hard "0" would read as real data.
		this.loading.set(true);
		this.observeSnapshot();
	}

	/**
	 * Re-fetches the snapshot, clearing any previous error first.
	 *
	 * Invoked by the widget host's refresh control and by the card's retry button.
	 */
	public override refresh(): void {
		this.clearError();

		// Without dropping the cached snapshot a manual refresh inside the cache TTL
		// would silently replay the stale numbers. `invalidate()` coalesces per
		// scope, so several Teams widgets refreshing at once still cause one fetch.
		const context = this.widgetContext();
		if (context) {
			this._statistics.invalidate(context);
		}

		this._reload$.next();
	}

	/**
	 * Wires `context$` (plus manual reloads) to the snapshot service and mirrors
	 * the request lifecycle into the `loading` / `error` signals.
	 */
	private observeSnapshot(): void {
		combineLatest([
			// Compare on the scope key only: an unrelated store write hands out a new
			// `organization` object on every emission, and without this each of them
			// would re-run the whole teams + time-logs + counts fetch.
			this.context$.pipe(
				distinctUntilChanged(
					(previous: IDashboardWidgetContext, current: IDashboardWidgetContext) =>
						teamsScopeKey(previous) === teamsScopeKey(current)
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
					this._statistics.getSnapshot(context).pipe(
						catchError((error: unknown) => {
							this.setError(error);
							return of(null);
						})
					)
				),
				tap((snapshot: ITeamsDashboardSnapshot | null) => {
					// Keep the last good snapshot on screen when a refresh fails,
					// rather than blanking a working widget.
					if (snapshot) {
						this.snapshot.set(snapshot);
					}
					this.loading.set(false);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}
}
