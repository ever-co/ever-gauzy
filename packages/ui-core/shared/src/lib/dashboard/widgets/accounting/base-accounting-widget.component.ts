import { CurrencyPipe } from '@angular/common';
import { computed, DEFAULT_CURRENCY_CODE, Directive, inject, LOCALE_ID, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of, Observable, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';
import { IAggregatedEmployeeStatistic, IStatisticSum } from '@gauzy/contracts';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { BaseDashboardWidgetComponent } from '../../widget-host/base-dashboard-widget.component';
import { CurrencyPositionPipe } from '../../../pipes/currency-position.pipe';
import { AccountingStatisticsCacheService } from './accounting-statistics-cache.service';

/**
 * Shared data layer for every Accounting KPI widget.
 *
 * All four KPIs (income, expenses, profit, bonus) are projections of the very
 * same `/employee-statistics/aggregate` payload the Accounting page renders, so
 * they all subscribe to the ambient dashboard context here and fetch through
 * {@link AccountingStatisticsCacheService}. The cache collapses the four
 * identical in-flight requests into one — which is what makes a KPI cheap enough
 * to be dropped on a canvas four times.
 *
 * Subclasses only decide *which* number of the payload they show and how it is
 * coloured; they never fetch.
 */
@Directive()
export abstract class BaseAccountingWidgetComponent extends BaseDashboardWidgetComponent implements OnInit {
	private readonly _statisticsCache = inject(AccountingStatisticsCacheService);

	/**
	 * Currency formatter.
	 *
	 * Constructed rather than injected so a widget never needs `providers:
	 * [CurrencyPipe]`: a canvas widget is created through the host's own injector
	 * and would otherwise fail with a NullInjectorError on any page that does not
	 * happen to provide the pipe. `DEFAULT_CURRENCY_CODE` is honoured, so an app
	 * level override still applies when an organization declares no currency.
	 */
	private readonly _currencyPipe = new CurrencyPipe(inject(LOCALE_ID), inject(DEFAULT_CURRENCY_CODE));

	/** Moves the currency symbol to the side the organization configured. */
	private readonly _currencyPositionPipe = new CurrencyPositionPipe();

	/** Manual re-fetch trigger, fed by {@link refresh}. */
	private readonly _reload$ = new Subject<void>();

	/** Latest aggregate payload; `null` until the first successful fetch. */
	protected readonly statistics = signal<IAggregatedEmployeeStatistic | null>(null);

	/** Organization-wide totals of the selected period — what every KPI projects. */
	protected readonly total = computed<IStatisticSum | null>(() => this.statistics()?.total ?? null);

	/**
	 * Currency of the active organization.
	 *
	 * `undefined` — never `''` — when the organization declares none: an empty
	 * currency code makes `CurrencyPipe` suppress the symbol entirely, which is
	 * both wrong and the one input `CurrencyPositionPipe` cannot parse.
	 */
	protected readonly currency = computed<string | undefined>(
		() => this.context()?.organization?.currency || this.context()?.currency || undefined
	);

	/** `LEFT` / `RIGHT` placement of the currency symbol, as configured per organization. */
	protected readonly currencyPosition = computed<string | undefined>(
		() => this.context()?.organization?.currencyPosition || undefined
	);

	/**
	 * Whether the organization runs a bonus scheme.
	 *
	 * The Accounting page hides its bonus KPI entirely when this is unset; the
	 * bonus widget shows an explanatory hint instead, because a widget the user
	 * placed deliberately must not render as a silent, permanent zero.
	 */
	protected readonly hasBonusType = computed<boolean>(() => !!this.context()?.organization?.bonusType);

	/**
	 * Starts the aggregate statistics subscription.
	 *
	 * Deliberately does NOT call `super.ngOnInit()`: the base class' default is to
	 * call {@link refresh} on every context emission, which here would push an
	 * extra value through `_reload$` and fetch the same payload twice. This class
	 * subscribes to `context$` itself instead.
	 */
	public override ngOnInit(): void {
		// Show the skeleton from the very first paint: the canvas may take a moment
		// to resolve an organization, and a hard "0.00" would read as real data.
		this.loading.set(true);
		this.observeStatistics();
	}

	/**
	 * Re-fetches the aggregate payload, clearing any previous error first.
	 *
	 * Invoked by the widget host's refresh control and by the card's retry button.
	 */
	public override refresh(): void {
		this.clearError();

		// Without dropping the cached payload a manual refresh inside the cache TTL
		// would silently replay the stale numbers. `invalidate()` coalesces per
		// scope, so all four KPIs refreshing at once still cause one request.
		const context = this.context();
		if (context?.organizationId) {
			this._statisticsCache.invalidate(context);
		}

		this._reload$.next();
	}

	/**
	 * Formats an amount with the organization's currency and symbol position.
	 *
	 * @param amount - The raw amount from the aggregate payload.
	 * @returns The formatted figure, ready to render.
	 */
	protected formatCurrency(amount: number): string {
		const value = Number.isFinite(amount) ? amount : 0;
		const formatted = this._currencyPipe.transform(value, this.currency()) ?? String(value);

		try {
			return this._currencyPositionPipe.transform(formatted, this.currencyPosition() ?? '');
		} catch {
			// `CurrencyPositionPipe` assumes the formatted string contains a currency
			// symbol and dereferences the regex match unguarded; a locale/code pair
			// that renders none must degrade to the plain figure, not take the
			// widget down.
			return formatted;
		}
	}

	/**
	 * Wires `context$` (plus manual reloads) to the cached aggregate endpoint and
	 * mirrors the request lifecycle into the `loading` / `error` signals.
	 */
	private observeStatistics(): void {
		// The aggregate endpoint takes ONLY organization, tenant and the range —
		// no employee/project/team scope. Without this guard every change of those
		// selectors would refetch an answer that cannot have changed.
		const scoped$: Observable<IDashboardWidgetContext> = this.context$.pipe(
			// A context without an organization cannot produce a meaningful request;
			// the canvas shows the "select an organization" state.
			filter((context): context is IDashboardWidgetContext => !!context?.organizationId),
			distinctUntilChanged(
				(previous: IDashboardWidgetContext, current: IDashboardWidgetContext) =>
					previous.tenantId === current.tenantId &&
					previous.organizationId === current.organizationId &&
					isSameInstant(previous.startDate, current.startDate) &&
					isSameInstant(previous.endDate, current.endDate)
			)
		);

		// `distinctUntilChanged` sits BEFORE the combine on purpose: applied after
		// it, a manual reload carrying an unchanged context would be swallowed and
		// the retry button would do nothing.
		combineLatest([scoped$, this._reload$.pipe(startWith(undefined))])
			.pipe(
				map(([context]) => context),
				tap(() => {
					this.loading.set(true);
					this.clearError();
				}),
				// switchMap, not mergeMap: a fast date-range change must abandon the
				// previous request instead of racing it to the signal.
				switchMap((context: IDashboardWidgetContext) =>
					this._statisticsCache.getAggregate(context).pipe(
						catchError((error: unknown) => {
							this.setError(error);
							return of(null);
						})
					)
				),
				tap((statistics: IAggregatedEmployeeStatistic | null) => {
					// Keep the last good payload on screen when a refresh fails, rather
					// than blanking a working widget.
					if (statistics) {
						this.statistics.set(statistics);
					}
					this.loading.set(false);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}
}

/**
 * Whether two range bounds denote the same instant.
 *
 * Compares epoch values rather than identity: the date range picker emits a new
 * `Date` instance on every selector change, so an identity check would refetch
 * on ranges that did not actually move.
 *
 * @param previous - Previous bound.
 * @param current - Current bound.
 * @returns True when both denote the same instant (or both are absent).
 */
function isSameInstant(previous: Date, current: Date): boolean {
	return toTime(previous) === toTime(current);
}

/**
 * Epoch value of a range bound, tolerating a serialized (string) date.
 *
 * @param value - The bound to normalize.
 * @returns The epoch value, or `null` when it is absent or unparsable.
 */
function toTime(value: Date): number | null {
	if (!value) {
		return null;
	}
	const time = value instanceof Date ? value.getTime() : new Date(value as unknown as string).getTime();
	return Number.isNaN(time) ? null : time;
}
