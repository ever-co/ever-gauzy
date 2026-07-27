import { CurrencyPipe } from '@angular/common';
import { Directive, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';
import { ChartConfiguration, ChartType } from 'chart.js';
import { ID, IMonthAggregatedEmployeeStatistics } from '@gauzy/contracts';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { CurrencyPositionPipe } from '../../../pipes/currency-position.pipe';
import { BaseDashboardWidgetComponent } from '../../widget-host/base-dashboard-widget.component';
import { EmployeeMonthStatisticsCacheService } from './employee-month-statistics-cache.service';
import {
	EmployeeChartKind,
	IEmployeeChartContext,
	IEmployeeChartPalette,
	buildDoughnutChartData,
	buildDoughnutChartOptions,
	buildHorizontalBarChartData,
	buildHorizontalBarChartOptions,
	buildStackedBarChartData,
	buildStackedBarChartOptions,
	formatEmployeeCurrency,
	resolveEmployeeChartPalette,
	toChartType
} from './employee-chart.utils';

/**
 * Providers every concrete employee chart widget must declare.
 *
 * `CurrencyPipe` is locale-bound and `CurrencyPositionPipe` is a plain
 * `@Pipe()` class, so neither is available in the root injector. They cannot be
 * declared on this `@Directive()` either — an abstract directive contributes no
 * providers to the component that extends it — hence the shared constant.
 */
export const EMPLOYEE_CHART_WIDGET_PROVIDERS = [CurrencyPipe, CurrencyPositionPipe];

/** Translation keys of the four money series, in dataset order. */
const SERIES_KEYS = {
	revenue: 'DASHBOARD_PAGE.CHARTS.REVENUE',
	expenses: 'DASHBOARD_PAGE.CHARTS.EXPENSES',
	profit: 'DASHBOARD_PAGE.CHARTS.PROFIT',
	bonus: 'DASHBOARD_PAGE.CHARTS.BONUS'
} as const;

/** Untranslated fallback, used only before the language file has resolved. */
const DEFAULT_SERIES_LABELS: IEmployeeChartContext['labels'] = {
	revenue: SERIES_KEYS.revenue,
	expenses: SERIES_KEYS.expenses,
	profit: SERIES_KEYS.profit,
	bonus: SERIES_KEYS.bonus
};

/**
 * Shared data + theming layer for every employee chart widget.
 *
 * All four charts are renderings of the very same
 * `/employee-statistics/months` payload, so they all subscribe to the ambient
 * dashboard context here and fetch through
 * {@link EmployeeMonthStatisticsCacheService}. The cache collapses identical
 * in-flight requests into one — which is what makes it cheap to put the doughnut
 * next to the bar chart on one canvas.
 *
 * Subclasses only decide WHICH rendering they show; they never fetch, never
 * resolve colours and never build datasets.
 */
@Directive()
export abstract class BaseEmployeeChartWidgetComponent extends BaseDashboardWidgetComponent implements OnInit {
	private readonly _statisticsCache = inject(EmployeeMonthStatisticsCacheService);
	private readonly _themeService = inject(NbThemeService);
	private readonly _translateService = inject(TranslateService);
	private readonly _currencyPipe = inject(CurrencyPipe);
	private readonly _currencyPositionPipe = inject(CurrencyPositionPipe);
	private readonly _host: ElementRef<HTMLElement> = inject(ElementRef);

	/** Manual re-fetch trigger, fed by {@link refresh}. */
	private readonly _reload$ = new Subject<void>();

	/** Monthly rows of the current selection; empty until the first fetch lands. */
	protected readonly statistics = signal<IMonthAggregatedEmployeeStatistics[]>([]);

	/** Context the current payload was fetched for; powers currency formatting. */
	protected readonly widgetContext = signal<IDashboardWidgetContext | null>(null);

	/** Chart colours of the active theme. */
	protected readonly palette = signal<IEmployeeChartPalette>(resolveEmployeeChartPalette(null));

	/** Translated series names; re-emitted on every language change. */
	protected readonly seriesLabels = signal<IEmployeeChartContext['labels']>(DEFAULT_SERIES_LABELS);

	/** The employee the charts describe, or `null` when none is selected. */
	protected readonly employeeId = computed<ID | null>(() => this.widgetContext()?.employeeIds?.[0] ?? null);

	/**
	 * True when the widget has nothing to query.
	 *
	 * `/employee-statistics/months` is per-employee, so with the page selector on
	 * "All employees" there is no request to make — the card shows an actionable
	 * hint instead of an empty plot.
	 */
	protected readonly requiresEmployee = computed<boolean>(() => !!this.widgetContext() && !this.employeeId());

	/** True when the query succeeded but the range contains no months. */
	protected readonly isEmpty = computed<boolean>(() => !this.statistics().length);

	/** Everything the dataset builders need beyond the raw statistics. */
	protected readonly chartContext = computed<IEmployeeChartContext>(() => {
		const organization = this.widgetContext()?.organization;
		const palette = this.palette();
		const labels = this.seriesLabels();

		return {
			palette,
			labels,
			formatCurrency: (value: number) =>
				formatEmployeeCurrency(value, organization, this._currencyPipe, this._currencyPositionPipe)
		};
	});

	/**
	 * Starts the statistics, theme and translation subscriptions.
	 *
	 * Deliberately does NOT call `super.ngOnInit()`: the base class' default is to
	 * call {@link refresh} on every context emission, which here would push an
	 * extra value through the reload trigger and fetch the same payload twice.
	 * This class subscribes to `context$` itself instead.
	 */
	public override ngOnInit(): void {
		// Show the skeleton from the very first paint: the canvas may take a moment
		// to resolve an organization, and an empty plot would read as "no data".
		this.loading.set(true);
		this.observeTheme();
		this.observeSeriesLabels();
		this.observeStatistics();
	}

	/**
	 * Re-fetches the statistics, clearing any previous error first.
	 *
	 * Invoked by the widget host's refresh control and by the card's retry button.
	 */
	public override refresh(): void {
		this.clearError();

		// Without dropping the cached payload a manual refresh inside the cache TTL
		// would silently replay the stale numbers. `invalidate()` coalesces per
		// scope, so several charts refreshing at once still cause one request.
		const context = this.widgetContext();
		const employeeId = this.employeeId();
		if (context && employeeId) {
			this._statisticsCache.invalidate(context, employeeId);
		}

		this._reload$.next();
	}

	/**
	 * Chart.js data for one rendering of the current payload.
	 *
	 * Exposed to subclasses (rather than each of them owning a builder) so the
	 * switcher widget can flip between renderings without duplicating anything.
	 *
	 * @param kind - Which rendering to build.
	 * @returns A Chart.js data object.
	 */
	protected chartDataFor(kind: EmployeeChartKind): ChartConfiguration['data'] {
		const statistics = this.statistics();
		const context = this.chartContext();

		switch (kind) {
			case EmployeeChartKind.DOUGHNUT:
				return buildDoughnutChartData(statistics, context);
			case EmployeeChartKind.STACKED_BAR:
				return buildStackedBarChartData(statistics, context);
			default:
				return buildHorizontalBarChartData(statistics, context);
		}
	}

	/**
	 * Chart.js options for one rendering, themed with the active palette.
	 *
	 * @param kind - Which rendering to configure.
	 * @returns Chart.js options.
	 */
	protected chartOptionsFor(kind: EmployeeChartKind): ChartConfiguration['options'] {
		const palette = this.palette();

		switch (kind) {
			case EmployeeChartKind.DOUGHNUT:
				return buildDoughnutChartOptions(palette);
			case EmployeeChartKind.STACKED_BAR:
				// The stacked datasets are normalized per month, so its tooltip needs
				// the raw rows (and the currency formatter) to report real amounts.
				return buildStackedBarChartOptions(palette, this.statistics(), this.chartContext().formatCurrency);
			default:
				return buildHorizontalBarChartOptions(palette);
		}
	}

	/**
	 * Chart.js chart type for one rendering.
	 *
	 * @param kind - Which rendering to type.
	 * @returns The Chart.js type name.
	 */
	protected chartTypeFor(kind: EmployeeChartKind): ChartType {
		return toChartType(kind);
	}

	/** Keeps {@link palette} in sync with the active Nebular theme. */
	private observeTheme(): void {
		this._themeService
			.getJsTheme()
			.pipe(
				map((config: NbJSThemeOptions) => config?.variables as Record<string, unknown> | undefined),
				tap((variables) => this.palette.set(resolveEmployeeChartPalette(variables, this._host.nativeElement))),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}

	/**
	 * Keeps {@link seriesLabels} translated.
	 *
	 * `stream()` rather than `instant()`: a widget is created the moment it is
	 * dropped on a canvas, which can be before the language file has resolved, and
	 * `instant()` would then bake the raw translation keys into the legend for the
	 * rest of the session.
	 */
	private observeSeriesLabels(): void {
		combineLatest([
			this._translateService.stream(SERIES_KEYS.revenue),
			this._translateService.stream(SERIES_KEYS.expenses),
			this._translateService.stream(SERIES_KEYS.profit),
			this._translateService.stream(SERIES_KEYS.bonus)
		])
			.pipe(
				map(([revenue, expenses, profit, bonus]: string[]) => ({ revenue, expenses, profit, bonus })),
				tap((labels) => this.seriesLabels.set(labels)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}

	/**
	 * Wires `context$` (plus manual reloads) to the cached months endpoint and
	 * mirrors the request lifecycle into the `loading` / `error` signals.
	 */
	private observeStatistics(): void {
		// `distinctUntilChanged` sits on the CONTEXT, before the reload trigger is
		// merged in: applying it afterwards would swallow a manual refresh whose
		// context has not changed — which is every manual refresh.
		const scopedContext$: Observable<IDashboardWidgetContext> = this.context$.pipe(
			// A context without an organization cannot produce a meaningful request;
			// the canvas shows the "select an organization" state.
			filter((context): context is IDashboardWidgetContext => !!context?.organizationId),
			distinctUntilChanged(
				(previous: IDashboardWidgetContext, current: IDashboardWidgetContext) =>
					statisticsScopeKey(previous) === statisticsScopeKey(current)
			)
		);

		combineLatest([scopedContext$, this._reload$.pipe(startWith(undefined))])
			.pipe(
				map(([context]) => context),
				tap((context: IDashboardWidgetContext) => {
					this.widgetContext.set(context);
					this.loading.set(true);
					this.clearError();
				}),
				// switchMap, not mergeMap: a fast date-range change must abandon the
				// previous request instead of racing it to the signal.
				switchMap((context: IDashboardWidgetContext) => this.fetchStatistics(context)),
				tap((statistics: IMonthAggregatedEmployeeStatistics[] | null) => {
					// Keep the last good payload on screen when a refresh fails,
					// rather than blanking a working chart. `Array.isArray` rather
					// than a truthiness check: an endpoint (or a proxy) answering
					// `200` with an object would otherwise reach the dataset builders
					// and throw while Angular renders the widget.
					if (Array.isArray(statistics)) {
						this.statistics.set(statistics);
					}
					this.loading.set(false);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}

	/**
	 * One request for the given context, or an empty payload when there is
	 * nothing to ask for.
	 *
	 * @param context - The context to query for.
	 * @returns The monthly rows, or `null` when the request failed.
	 */
	private fetchStatistics(context: IDashboardWidgetContext): Observable<IMonthAggregatedEmployeeStatistics[] | null> {
		const employeeId = context.employeeIds?.[0];
		if (!employeeId) {
			// No employee selected: `requiresEmployee` renders the hint, and the
			// previous employee's numbers must not linger behind it.
			return of([]);
		}

		return this._statisticsCache.getMonthStatistics(context, employeeId).pipe(
			catchError((error: unknown) => {
				this.setError(error);
				return of(null);
			})
		);
	}
}

/**
 * Fingerprint of the fields the months request (and its currency formatting)
 * actually depends on.
 *
 * Without it every unrelated context change — a project or team selector, a time
 * zone switch — would re-issue an identical request per chart on the canvas.
 *
 * @param context - The context to fingerprint.
 * @returns A stable comparison key.
 */
function statisticsScopeKey(context: IDashboardWidgetContext): string {
	return [
		context.tenantId ?? '',
		context.organizationId ?? '',
		context.employeeIds?.[0] ?? '',
		toEpoch(context.startDate),
		toEpoch(context.endDate),
		context.currency ?? ''
	].join('|');
}

/**
 * Epoch milliseconds of a value the context types as a `Date`.
 *
 * Defensive on purpose: a context restored from a bookmark carries an ISO
 * string, and `String(date)` would then key two identical ranges differently.
 *
 * @param value - The date to normalize.
 * @returns The epoch value, or an empty string when it cannot be parsed.
 */
function toEpoch(value: Date | undefined): string {
	if (!value) {
		return '';
	}
	const time = value instanceof Date ? value.getTime() : new Date(value as unknown as string).getTime();
	return Number.isNaN(time) ? '' : String(time);
}
