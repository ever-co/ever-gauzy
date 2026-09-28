import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, debounceTime, firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ChartConfiguration, ChartDataset, ScriptableContext, TooltipItem } from 'chart.js';
import * as moment from 'moment';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	DateRangePickerBuilderService,
	EmployeeStatisticsService,
	EmployeesService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	IAggregatedEmployeeStatistic,
	CurrencyPosition,
	IDateRangePicker,
	IEmployeeStatisticSum,
	IOrganization,
	ISelectedEmployee
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { ALL_EMPLOYEES_SELECTED, ChartUtil, CurrencyPositionPipe } from '@gauzy/ui-core/shared';
import {
	IEmployeeChartLegendItem,
	IEmployeeChartPalette,
	employeeChartBase,
	employeeChartCategoryScale,
	employeeChartTooltip,
	employeeChartValueScale,
	resolveEmployeeChartPalette
} from '../employee-charts';

type StatisticKey = 'income' | 'expense' | 'profit' | 'bonus';
type SortKey = 'name' | StatisticKey;

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-dashboard-accounting',
	templateUrl: './accounting.component.html',
	styleUrls: ['./accounting.component.scss'],
	providers: [CurrencyPipe, CurrencyPositionPipe],
	standalone: false
})
export class AccountingComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public aggregatedEmployeeStatistics: IAggregatedEmployeeStatistic;
	public selectedDateRange: IDateRangePicker;
	public organization: IOrganization;
	public statistics$: Subject<boolean> = new Subject();
	public loading: boolean = false;

	public chartData: ChartConfiguration<'line'>['data'];
	public chartOptions: ChartConfiguration<'line'>['options'];
	public legendItems: IEmployeeChartLegendItem[] = [];
	public hasChartData = false;
	/** The chart's daily values as text, for the screen-reader table behind the canvas. */
	public chartTable: { date: string; values: string[] }[] = [];

	public sortKey: SortKey = 'expense';
	public sortDirection: 'asc' | 'desc' = 'desc';
	public sortedEmployees: IEmployeeStatisticSum[] = [];

	/**
	 * Series colours, kept from this page's original cash-flow chart. One source for the
	 * chart lines, the KPI glyphs and the table's column dots, so a series never
	 * changes colour between the three.
	 */
	protected readonly seriesColors: Record<StatisticKey, string> = {
		income: ChartUtil.CHART_COLORS.blue,
		expense: ChartUtil.CHART_COLORS.red,
		profit: ChartUtil.CHART_COLORS.yellow,
		bonus: ChartUtil.CHART_COLORS.green
	};

	/**
	 * The HR dashboard's chart chrome (grid, labels, tooltip surface), read off the
	 * `gauzy-chart-*` theme tokens so the canvas follows the active theme.
	 */
	private palette: IEmployeeChartPalette = resolveEmployeeChartPalette({} as NbJSThemeOptions);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);
	private readonly _currencyPositionPipe = inject(CurrencyPositionPipe);
	private readonly _currencyPipe = inject(CurrencyPipe);
	private readonly _themeService = inject(NbThemeService);

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly router: Router,
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._applyTranslationOnChart();
		this._themeService
			.getJsTheme()
			.pipe(
				// Re-read the palette on a theme switch; the tokens change with the theme class
				tap((config: NbJSThemeOptions) => {
					this.palette = resolveEmployeeChartPalette(config, this._elementRef.nativeElement);
					this.buildChartOptions();
					this.generateCharts();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedEmployee$
			.pipe(
				// Filter out falsy or invalid employees
				filter((employee: ISelectedEmployee) => !!employee && !!employee.id),
				// Perform a side effect: navigate to employee statistics
				tap(() => this.navigateToEmployeeStatistics()),
				// Ensure the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		this.statistics$
			.pipe(
				// Debounce the emissions to wait for a pause in changes
				debounceTime(200),
				// Perform a side effect: invoke the getAggregateStatistics method
				tap(() => this.getAggregateStatistics()),
				// Ensure the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;

		combineLatest([storeOrganization$, storeDateRange$])
			.pipe(
				// Debounce the emissions to wait for a pause in changes
				debounceTime(200),
				// Ensure distinct combinations of emissions
				distinctUntilChange(),
				// Filter out invalid combinations
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				// Perform a side effect: set organization and dateRange properties
				tap(([organization, dateRange]) => {
					this.organization = organization as IOrganization;
					this.selectedDateRange = dateRange as IDateRangePicker;
				}),
				// Perform another side effect: notify subscribers about a change in statistics
				tap(() => this.statistics$.next(true)),
				// Ensure the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _applyTranslationOnChart() {
		// Subscribe to the onLangChange event from translateService
		this.translateService.onLangChange
			.pipe(
				// Regenerate charts when the language changes; `formatDate` reads the new language,
				// so the axis, tooltip and screen-reader table dates follow it
				tap(() => this.generateCharts()),
				// Ensure the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** KPI glyph colour: the series colour, or the theme's negative step when the figure is below zero. */
	protected accentFor(key: StatisticKey): string {
		return this.totals[key] < 0 ? this.palette.negativeProfit : this.seriesColors[key];
	}

	/** Organization-wide totals, never undefined so the template can read them freely. */
	protected get totals(): Record<StatisticKey, number> {
		const total = this.aggregatedEmployeeStatistics?.total;
		return {
			income: total?.income || 0,
			expense: total?.expense || 0,
			profit: total?.profit || 0,
			bonus: total?.bonus || 0
		};
	}

	protected get employeeCount(): number {
		return this.aggregatedEmployeeStatistics?.employees?.length || 0;
	}

	/**
	 * `part` as a percentage of total income, or `null` when there is no income to
	 * compare against (a ratio of zero would read as a real figure). Non-positive income
	 * is rejected too: a loss divided by negative income would read as a positive margin.
	 */
	protected percentOfIncome(part: number): string | null {
		const income = this.totals.income;
		if (!(income > 0)) return null;
		const value = (part / income) * 100;
		if (value === 0) return '0';
		return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
	}

	/**
	 * Navigates to the employee statistics page in the HR dashboard.
	 * Uses Angular Router to navigate to the specified route.
	 */
	navigateToEmployeeStatistics(): void {
		// Navigate to the '/pages/dashboard/hr' route
		this.router.navigate(['/pages/dashboard/hr']);
	}

	/**
	 * Retrieves aggregate statistics for employees within the specified organization and date range.
	 * Updates the component's state with the fetched data and triggers chart generation.
	 * Handles loading states and error notifications.
	 */
	async getAggregateStatistics(): Promise<void> {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		try {
			// Extract relevant information
			const { id: organizationId, tenantId } = this.organization;
			const { startDate, endDate } = this.selectedDateRange;

			// Set loading state to true
			this.loading = true;

			// Fetch aggregate statistics from the service
			this.aggregatedEmployeeStatistics =
				await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId({
					organizationId,
					tenantId,
					startDate,
					endDate
				});

			this.generateCharts();
			this.sortEmployees();
		} catch (error) {
			// Handle errors
			console.log('Error while retrieving employee aggregate statistics', error);
			this.toastrService.danger(error);
		} finally {
			// Always drop the spinner, otherwise a failed request leaves the card covered forever
			this.loading = false;
		}
	}

	/**
	 * Builds the cash-flow datasets and the HTML legend beside them. Income is drawn
	 * over a faint fill so the headline series anchors the plot; the rest are lines.
	 */
	public generateCharts() {
		// Check if aggregatedEmployeeStatistics is empty
		if (isEmpty(this.aggregatedEmployeeStatistics)) {
			return;
		}

		const points = this.aggregatedEmployeeStatistics.chart || [];
		const series: { key: StatisticKey; label: string; color: string }[] = [
			{ key: 'income', label: 'DASHBOARD_PAGE.CHARTS.REVENUE', color: this.seriesColors.income },
			{ key: 'expense', label: 'DASHBOARD_PAGE.CHARTS.EXPENSES', color: this.seriesColors.expense },
			{ key: 'profit', label: 'DASHBOARD_PAGE.CHARTS.PROFIT', color: this.seriesColors.profit }
		];
		if (this.organization?.bonusType) {
			series.push({ key: 'bonus', label: 'DASHBOARD_PAGE.CHARTS.BONUS', color: this.seriesColors.bonus });
		}

		this.hasChartData = points.some(({ statistics }) =>
			series.some(({ key }) => (Number(statistics?.[key]) || 0) !== 0)
		);

		this.legendItems = series.map(({ key, label, color }) => ({
			label: this.getTranslation(label),
			color,
			amount: this.formatCurrency(this.totals[key])
		}));

		this.chartTable = points.map((point) => ({
			date: this.formatDate(point.dates, 'LL'),
			values: series.map(({ key }) => this.formatCurrency(Number(point.statistics?.[key]) || 0))
		}));

		this.chartData = {
			labels: points.map((point) => point.dates),
			datasets: series.map(
				({ key, label, color }): ChartDataset<'line'> => ({
					label: this.getTranslation(label),
					data: points.map((point) => Number(point.statistics?.[key]) || 0),
					borderColor: color,
					backgroundColor: key === 'income' ? (ctx) => this.areaFill(ctx, color) : color,
					pointBackgroundColor: color,
					pointBorderColor: this.palette.surface,
					borderWidth: 1.5,
					// A dot on every day, ringed in the surface colour so it stands off the line
					pointRadius: 3,
					pointBorderWidth: 1,
					pointHoverRadius: 5,
					pointHoverBorderWidth: 2,
					tension: 0.3,
					fill: key === 'income' ? 'origin' : false
				})
			)
		};
	}

	/** Faint vertical fade under the income line; transparent until the chart has a layout. */
	private areaFill(ctx: ScriptableContext<'line'>, color: string): CanvasGradient | string {
		const { chart } = ctx;
		const area = chart.chartArea;
		if (!area) return 'transparent';
		const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
		gradient.addColorStop(0, this.withAlpha(color, 0.16));
		gradient.addColorStop(1, this.withAlpha(color, 0));
		return gradient;
	}

	/** `#rrggbb` or `rgb()/rgba()` with its alpha replaced; anything else passes through. */
	private withAlpha(color: string, alpha: number): string {
		const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
		if (hex) {
			const n = parseInt(hex[1], 16);
			return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
		}
		const rgb = /^rgba?\(([^)]+)\)$/i.exec(color.trim());
		if (rgb) {
			const [r, g, b] = rgb[1].split(',').map((part) => part.trim());
			return `rgba(${r}, ${g}, ${b}, ${alpha})`;
		}
		return color;
	}

	/**
	 * The HR charts' shared chrome (hairline value grid, no category grid, surface
	 * tooltip), with one shared tooltip per day so every series reads at once.
	 */
	private buildChartOptions(): void {
		this.chartOptions = {
			...employeeChartBase(),
			interaction: { mode: 'index', intersect: false },
			plugins: {
				// The legend is `ga-employee-chart-legend` in the panel, not on the canvas
				legend: { display: false },
				tooltip: {
					...employeeChartTooltip(this.palette, (value) => this.formatCurrency(value)),
					callbacks: {
						title: (items: TooltipItem<'line'>[]) => this.formatDate(items[0]?.label, 'dddd, LL'),
						label: (item: TooltipItem<'line'>) =>
							`${item.dataset.label}: ${this.formatCurrency(Number(item.parsed.y) || 0)}`
					}
				}
			},
			scales: {
				x: {
					...employeeChartCategoryScale(this.palette),
					// A vertical line per day, in the value grid's colour, so each point lines up with its date
					grid: { display: true, color: this.palette.axisLineColor, tickLength: 0 },
					ticks: {
						...employeeChartCategoryScale(this.palette).ticks,
						maxRotation: 0,
						autoSkipPadding: 16,
						// Full dates, as the original chart showed; autoSkip drops labels that would collide
						callback: (_value, index) => this.formatDate(this.chartData?.labels?.[index] as string, 'LL')
					}
				},
				y: {
					...employeeChartValueScale(this.palette),
					beginAtZero: true,
					ticks: {
						...employeeChartValueScale(this.palette).ticks,
						// Full figures with thousands separators (9,000 rather than 9K), as the original chart showed
						maxTicksLimit: 10,
						callback: (value: number | string) => Number(value).toLocaleString()
					}
				}
			}
		} as ChartConfiguration<'line'>['options'];
	}

	/** Sorts the employee table; clicking the active column flips its direction. */
	protected sortBy(key: SortKey): void {
		if (this.sortKey === key) {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortKey = key;
			// Names read naturally A→Z, amounts are most useful largest-first
			this.sortDirection = key === 'name' ? 'asc' : 'desc';
		}
		this.sortEmployees();
	}

	/** The "sort by" select: picks the column, keeping its natural direction; re-picking it changes nothing. */
	protected setSortKey(key: SortKey): void {
		if (this.sortKey === key) return;
		this.sortBy(key);
	}

	protected toggleSortDirection(): void {
		this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
		this.sortEmployees();
	}

	protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (this.sortKey !== key) return 'none';
		return this.sortDirection === 'asc' ? 'ascending' : 'descending';
	}

	/** Breakdown table columns; the bonus column only exists for organizations that pay one. */
	protected get columns(): { key: SortKey; label: string }[] {
		const columns: { key: SortKey; label: string }[] = [
			{ key: 'name', label: 'DASHBOARD_PAGE.DEVELOPER.EMPLOYEES' },
			{ key: 'income', label: 'DASHBOARD_PAGE.DEVELOPER.TOTAL_INCOME' },
			{ key: 'expense', label: 'DASHBOARD_PAGE.DEVELOPER.TOTAL_EXPENSES' },
			{ key: 'profit', label: 'DASHBOARD_PAGE.DEVELOPER.PROFIT' }
		];
		if (this.organization?.bonusType) columns.push({ key: 'bonus', label: 'DASHBOARD_PAGE.DEVELOPER.BONUS' });
		return columns;
	}

	/**
	 * An employee's signed share of the organization's income, as a percentage, or `null`
	 * when total income is not positive. Income accepts negative entries, so a share can be
	 * below 0, or above 100 when other employees carry negative income.
	 */
	protected incomeShare(row: IEmployeeStatisticSum): number | null {
		const income = this.totals.income;
		if (!(income > 0)) return null;
		if (!row.income) return 0;
		return (row.income / income) * 100;
	}

	/** Bar width for a share: the signed figure is for the label, the bar stays inside its track. */
	protected shareWidth(share: number): number {
		return Math.max(0, Math.min(100, share));
	}

	private sortEmployees(): void {
		const rows = [...(this.aggregatedEmployeeStatistics?.employees || [])];
		const direction = this.sortDirection === 'asc' ? 1 : -1;
		const key = this.sortKey;

		rows.sort((a, b) => {
			if (key === 'name') {
				const nameA = a.employee?.user?.name || '';
				const nameB = b.employee?.user?.name || '';
				return nameA.localeCompare(nameB) * direction;
			}
			return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * direction;
		});
		this.sortedEmployees = rows;
	}

	/** Currency plus the organization's symbol position, matching the template's `currency | position`. */
	private formatCurrency(value: number): string {
		const currency = this._currencyPipe.transform(value || 0, this.organization?.currency);
		if (!currency) return String(value || 0);
		return this._currencyPositionPipe.transform(currency, this.organization?.currencyPosition || CurrencyPosition.LEFT);
	}

	/** Chart labels arrive as display strings; shorten them when they parse, pass them through when not. */
	private formatDate(label: string, format: string): string {
		if (!label) return '';
		// Date-only ISO strings must parse as local days; `new Date()` would read them as UTC midnight
		// and shift every label back a day west of Greenwich.
		const iso = moment(label, moment.ISO_8601, true);
		const date = iso.isValid() ? iso : moment(new Date(label));
		if (!date.isValid()) return label;
		// Format in the active UI language. Moment's global locale is only set once, from the
		// default language, and an unknown locale key leaves this instance on that global one.
		const lang = this.translateService.getCurrentLang();
		return (lang ? date.locale(lang) : date).format(format);
	}

	/**
	 * Selects an employee and fetches detailed information from the employeesService.
	 * Updates the selected employee in the store.
	 *
	 * @param employee - The selected employee information.
	 */
	async selectEmployee(employee: ISelectedEmployee) {
		if (!employee?.id) {
			return;
		}

		// Fetch detailed information about the selected employee from the employeesService
		const people = await firstValueFrom(this.employeesService.getEmployeeById(employee.id, ['user']));

		// Set the selected employee in the store
		this.store.selectedEmployee = employee.id
			? ({
					id: people.id,
					firstName: people.user.firstName,
					lastName: people.user.lastName,
					imageUrl: people.user.imageUrl,
					employeeLevel: people.employeeLevel,
					shortDescription: people.short_description
			  } as ISelectedEmployee)
			: ALL_EMPLOYEES_SELECTED;
	}

	ngOnDestroy(): void {}
}
