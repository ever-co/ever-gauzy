import { CurrencyPipe } from '@angular/common';
import { computed, Directive, inject, LOCALE_ID, OnInit, Signal, signal, Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbDialogService } from '@nebular/theme';
import { combineLatest, from, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap, take, tap } from 'rxjs/operators';
import { BonusTypeEnum, EmployeeStatisticsHistoryEnum, ID, IMonthAggregatedEmployeeStatistics } from '@gauzy/contracts';
import { EmployeeStatisticsService, IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { CurrencyPositionPipe } from '../../../pipes/currency-position.pipe';
import { BaseDashboardWidgetComponent } from '../../widget-host/base-dashboard-widget.component';
import { HrStatisticsCacheService } from './hr-statistics-cache.service';
import { hrStatisticsKey, IHrStatisticsTotals, resolveHrEmployeeId, sumHrStatistics } from './hr-statistics.utils';

/**
 * Shared data layer for every Human Resources info-block widget.
 *
 * All nine blocks are projections of the very same
 * `/employee-statistics/months` payload, so they all subscribe to the ambient
 * dashboard context here and fetch through {@link HrStatisticsCacheService},
 * which collapses their nine identical in-flight requests into one — that is the
 * whole reason a block is cheap enough to be dropped on a canvas nine times.
 *
 * Subclasses only decide *which* number of the payload they show, how it is
 * labelled, and which history dialog (if any) it opens; they never fetch.
 */
@Directive()
export abstract class BaseHrInfoWidgetComponent extends BaseDashboardWidgetComponent implements OnInit {
	private readonly _statisticsCache = inject(HrStatisticsCacheService);

	/** Record-level history behind the aggregates; used by the history dialogs. */
	protected readonly employeeStatistics = inject(EmployeeStatisticsService);

	/**
	 * Optional on purpose: `NbDialogService` comes from `NbDialogModule.forRoot()`.
	 * A widget is created through the host's own injector and may be rendered by a
	 * shell that never registered it, and a missing history dialog must not take
	 * the whole figure down with a NullInjectorError.
	 */
	protected readonly dialogs = inject(NbDialogService, { optional: true });

	/** Built by hand (rather than injected) so the widget needs no `providers`. */
	private readonly _currencyPipe = new CurrencyPipe(inject(LOCALE_ID));
	private readonly _currencyPositionPipe = new CurrencyPositionPipe();

	/** Manual re-fetch trigger, fed by {@link refresh}. */
	private readonly _reload$ = new Subject<void>();

	/** Latest context, for the labels and the history dialogs. */
	protected readonly widgetContext = signal<IDashboardWidgetContext | null>(null);

	/** Latest monthly rows; `null` until the first successful fetch. */
	protected readonly statistics = signal<IMonthAggregatedEmployeeStatistics[] | null>(null);

	/** Everything the blocks render, derived from {@link statistics}. */
	protected readonly totals: Signal<IHrStatisticsTotals> = computed(() => sumHrStatistics(this.statistics()));

	/** The employee the figures are about, or `null` when none is in scope. */
	protected readonly employeeId: Signal<ID | null> = computed(() => resolveHrEmployeeId(this.widgetContext()));

	/** Drives the card's "select an employee" empty state. */
	protected readonly hasEmployee: Signal<boolean> = computed(() => !!this.employeeId());

	/** ISO currency code the amounts are formatted in. */
	protected readonly currency: Signal<string> = computed(() => {
		const context = this.widgetContext();
		return context?.organization?.currency || context?.currency || '';
	});

	/** Whether the symbol goes before or after the amount. */
	protected readonly currencyPosition: Signal<string> = computed(
		() => this.widgetContext()?.organization?.currencyPosition ?? ''
	);

	/** The organization's bonus rule, or `null` when it pays no bonuses. */
	protected readonly bonusType: Signal<BonusTypeEnum | null> = computed(
		() => this.widgetContext()?.organization?.bonusType ?? null
	);

	/** Percentage the organization's bonus rule applies. */
	protected readonly bonusPercentage: Signal<number> = computed(
		() => this.widgetContext()?.organization?.bonusPercentage ?? 0
	);

	/**
	 * Starts the context and statistics subscriptions.
	 *
	 * Deliberately does NOT call `super.ngOnInit()`: the base class' default is to
	 * call {@link refresh} on every context emission, which here would push an
	 * extra value through `_reload$` and fetch the same payload twice.
	 */
	public override ngOnInit(): void {
		// Show the skeleton from the very first paint: the canvas may take a moment
		// to resolve an organization, and a hard "0" would read as real data.
		this.loading.set(true);
		this.observeContext();
		this.observeStatistics();
	}

	/**
	 * Re-fetches the statistics payload, clearing any previous error first.
	 *
	 * Invoked by the widget host's refresh control and by the card's retry button.
	 */
	public override refresh(): void {
		this.error.set(null);

		// Without dropping the cached payload a manual refresh inside the cache TTL
		// would silently replay the stale numbers. `invalidate()` coalesces per
		// scope, so all nine blocks refreshing at once still cause one request.
		const context = this.widgetContext();
		const employeeId = this.employeeId();
		if (context && employeeId) {
			this._statisticsCache.invalidate(context, employeeId);
		}

		this._reload$.next();
	}

	/**
	 * Formats an amount the way the legacy Human Resources page does: through the
	 * `currency` pipe, then repositioned per the organization's preference.
	 *
	 * @param amount - The raw amount.
	 * @returns The display string; the bare number when no currency is configured.
	 */
	protected formatAmount(amount: number | null | undefined): string {
		const value = Number(amount) || 0;
		const currency = this.currency();
		if (!currency) {
			return `${value}`;
		}

		const formatted = this._currencyPipe.transform(value, currency) ?? `${value}`;
		try {
			return this._currencyPositionPipe.transform(formatted, this.currencyPosition());
		} catch {
			// `CurrencyPositionPipe.extract()` indexes the result of `RegExp.exec()`
			// without a null check, so a formatted value that carries no symbol at
			// all throws. The formatted string, unmoved, is a fine fallback.
			return formatted;
		}
	}

	/**
	 * Colour for an amount that is only "good" while it is positive.
	 *
	 * @param amount - The raw amount.
	 * @param positive - Colour used at or above zero.
	 * @param negative - Colour used below zero.
	 */
	protected signedColor(amount: number, positive: string, negative: string): string {
		return amount >= 0 ? positive : negative;
	}

	/**
	 * Opens the records-history dialog for one of this employee's figures.
	 *
	 * @param type - Which history to load; `null`/`undefined` makes the click inert
	 *               (the bonus blocks have no history behind them, exactly as on
	 *               the legacy page).
	 */
	public openHistory(type: EmployeeStatisticsHistoryEnum | null | undefined): void {
		const context = this.widgetContext();
		const employeeId = this.employeeId();
		if (!type || !context || !employeeId || !this.dialogs) {
			return;
		}

		const { startDate, endDate, organizationId, tenantId } = context;

		from(
			Promise.all([
				this.employeeStatistics.getEmployeeStatisticsHistory({
					employeeId,
					startDate,
					endDate,
					type,
					organizationId,
					tenantId
				}),
				this.loadDeclaredComponent<unknown>(
					() => import('../../records-history/records-history.module'),
					() => import('../../records-history/records-history.component'),
					(module) => module.RecordsHistoryComponent
				)
			])
		)
			.pipe(
				take(1),
				catchError((error: unknown) => {
					this.setError(error);
					return of(null);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((resolved) => {
				if (!resolved) {
					return;
				}
				const [records, component] = resolved;
				this.dialogs?.open(component, { context: { type, records } });
			});
	}

	/**
	 * Loads a component that is DECLARED in an NgModule (not standalone).
	 *
	 * Importing only the component file is not enough: Ivy registers a declared
	 * component's template scope when the *NgModule* file is evaluated, so a
	 * dialog opened without that would render with its own directives unresolved.
	 * Both files are therefore imported, and both stay out of the widget's initial
	 * chunk — history dialogs drag in the whole smart-table stack.
	 *
	 * @param loadModule - Dynamic import of the declaring NgModule file.
	 * @param loadComponent - Dynamic import of the component file.
	 * @param pick - Selects the component class from the component module's exports.
	 */
	protected async loadDeclaredComponent<T>(
		loadModule: () => Promise<unknown>,
		loadComponent: () => Promise<any>,
		pick: (module: any) => Type<T>
	): Promise<Type<T>> {
		const [, componentModule] = await Promise.all([loadModule(), loadComponent()]);
		return pick(componentModule);
	}

	/** Mirrors every context emission into {@link widgetContext} for the labels. */
	private observeContext(): void {
		this.context$
			.pipe(
				tap((context: IDashboardWidgetContext) => this.widgetContext.set(context)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}

	/**
	 * Wires `context$` (plus manual reloads) to the cached statistics endpoint and
	 * mirrors the request lifecycle into the `loading` / `error` signals.
	 */
	private observeStatistics(): void {
		const request$ = this.context$.pipe(
			// A context without an organization cannot produce a meaningful request.
			filter((context): context is IDashboardWidgetContext => !!context?.organizationId),
			// Only the fields the request is actually built from. Without this, a
			// project or team selection — which this endpoint does not even accept —
			// would refetch the identical payload on every canvas.
			distinctUntilChanged(
				(previous: IDashboardWidgetContext, current: IDashboardWidgetContext) =>
					hrStatisticsKey(previous) === hrStatisticsKey(current)
			)
		);

		combineLatest([request$, this._reload$.pipe(startWith(undefined))])
			.pipe(
				map(([context]) => context),
				tap(() => this.error.set(null)),
				// switchMap, not mergeMap: a fast date-range change must abandon the
				// previous request instead of racing it to the signal.
				switchMap((context: IDashboardWidgetContext) => {
					const employeeId = resolveHrEmployeeId(context);
					if (!employeeId) {
						// Nothing to fetch — and the previous employee's numbers must go,
						// or the card would keep showing them under an empty selection.
						this.statistics.set(null);
						this.loading.set(false);
						return of(null);
					}

					this.loading.set(true);
					return this._statisticsCache.getStatistics(context, employeeId).pipe(
						catchError((error: unknown) => {
							this.setError(error);
							return of(null);
						})
					);
				}),
				tap((rows: IMonthAggregatedEmployeeStatistics[] | null) => {
					// Keep the last good payload on screen when a refresh fails, rather
					// than blanking a working widget.
					if (rows) {
						this.statistics.set(rows);
					}
					this.loading.set(false);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}
}
