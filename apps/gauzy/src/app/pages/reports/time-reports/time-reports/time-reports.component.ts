import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum,
	TimeLogType
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { pluck } from 'underscore';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService, Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-reports',
	templateUrl: './time-reports.component.html',
	styleUrls: ['./time-reports.component.scss']
})
export class TimeReportsComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit, OnDestroy {

	filters: ITimeLogFilters;
	loading: boolean = false;
	chartData: IChartData;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
	}

	ngOnInit() {
		this.cdr.detectChanges();
	}

	ngAfterViewInit() {
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.updateChart()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.filters,
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.payloads$.next(request);
	}

	async updateChart() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		this.loading = true;
		try {
			const payloads = this.payloads$.getValue();
			const logs: any = await this.timesheetService.getDailyReportChart(payloads);
			const commonOptions = {
				borderWidth: 2,
				pointRadius: 2,
				pointHoverRadius: 4,
				pointHoverBorderWidth: 4,
			}
			const datasets = [
				{
					label: TimeLogType.MANUAL,
					data: logs.map((log) => log.value[TimeLogType.MANUAL]),
					borderColor: ChartUtil.CHART_COLORS.red,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 1),
					...commonOptions,
				},
				{
					label: TimeLogType.TRACKED,
					data: logs.map((log) => log.value[TimeLogType.TRACKED]),
					borderColor: ChartUtil.CHART_COLORS.blue,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.blue, 1),
					...commonOptions,
				},
				{
					label: TimeLogType.IDLE,
					data: logs.map((log) => log.value[TimeLogType.IDLE]),
					borderColor: ChartUtil.CHART_COLORS.yellow,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.yellow, 1),
					...commonOptions,
				},
				{
					label: TimeLogType.RESUMED,
					data: logs.map((log) => log.value[TimeLogType.RESUMED]),
					borderColor: ChartUtil.CHART_COLORS.green,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.green, 1),
					tooltip: {
						titleFontColor: 'pink'
					},
					...commonOptions,
				}
			];
			this.chartData = {
				labels: pluck(logs, 'date'),
				datasets
			};
		} catch (error) {
			console.log('Error while retrieving time & activity charts data', error);
		} finally {
			this.loading = false;
		}
	}

	ngOnDestroy(): void {}
}
