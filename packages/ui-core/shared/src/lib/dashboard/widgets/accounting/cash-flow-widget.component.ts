import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { IChartEmployeeStatistic } from '@gauzy/contracts';
import { LineChartModule } from '../../../report/charts/line-chart/line-chart.module';
import { IChartData } from '../../../report/charts/line-chart/ichart.interface';
// Reuses the chart palette the employee chart widgets already resolve: a
// `<canvas>` cannot read a CSS custom property, so every chart in the dashboard
// has to look its colours up in TypeScript, and doing it twice would let the two
// families of charts drift apart.
import { IEmployeeChartPalette, resolveEmployeeChartPalette } from '../charts/employee-chart.utils';
import { TeamsWidgetStateComponent } from '../teams/teams-widget-state.component';
import { BaseAccountingWidgetComponent } from './base-accounting-widget.component';
import {
	CASH_FLOW_SERIES_KEYS,
	DEFAULT_CASH_FLOW_LABELS,
	ICashFlowSeriesLabels,
	buildCashFlowChartData
} from './cash-flow-chart.utils';

/**
 * Cash flow over the selected period: income, expenses, profit and bonus plotted
 * against the aggregate payload's date buckets.
 *
 * This is the Accounting page's `<ngx-line-chart>` on a canvas. The chart
 * component itself is reused untouched — it owns the Chart.js options, the theme
 * subscription and the hover behaviour — so this widget only has to supply the
 * datasets and the three states the page never had (loading, error, empty).
 *
 * It reads the very same `/employee-statistics/aggregate` response as the four
 * Accounting KPIs and the employee breakdown table, so a canvas showing all six
 * still issues ONE request per context change (see
 * `AccountingStatisticsCacheService`).
 */
@Component({
	selector: 'ga-accounting-cash-flow-widget',
	templateUrl: './cash-flow-widget.component.html',
	styleUrls: ['./cash-flow-widget.component.scss'],
	standalone: true,
	imports: [LineChartModule, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CashFlowWidgetComponent extends BaseAccountingWidgetComponent {
	private readonly _themeService = inject(NbThemeService);
	private readonly _translateService = inject(TranslateService);
	private readonly _host: ElementRef<HTMLElement> = inject(ElementRef);

	/** Chart colours of the active theme; re-resolved on every theme switch. */
	private readonly palette = signal<IEmployeeChartPalette>(resolveEmployeeChartPalette(null));

	/** Translated series names; re-emitted on every language change. */
	private readonly seriesLabels = signal<ICashFlowSeriesLabels>(DEFAULT_CASH_FLOW_LABELS);

	/** Date buckets of the current payload, or an empty list before the first fetch. */
	private readonly chartRows = computed<IChartEmployeeStatistic[]>(() => this.statistics()?.chart ?? []);

	/** True when the query succeeded but the range contains no bucket to plot. */
	protected readonly isEmpty = computed<boolean>(() => this.chartRows().length === 0);

	/** Fully built datasets for `ngx-line-chart`. */
	protected readonly chartData = computed<IChartData>(() =>
		buildCashFlowChartData(this.chartRows(), this.palette(), this.seriesLabels())
	);

	constructor() {
		super();
		this.observeTheme();
		this.observeSeriesLabels();
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
			this._translateService.stream(CASH_FLOW_SERIES_KEYS.income),
			this._translateService.stream(CASH_FLOW_SERIES_KEYS.expense),
			this._translateService.stream(CASH_FLOW_SERIES_KEYS.profit),
			this._translateService.stream(CASH_FLOW_SERIES_KEYS.bonus)
		])
			.pipe(
				map(([income, expense, profit, bonus]: string[]) => ({ income, expense, profit, bonus })),
				tap((labels: ICashFlowSeriesLabels) => this.seriesLabels.set(labels)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}
}
