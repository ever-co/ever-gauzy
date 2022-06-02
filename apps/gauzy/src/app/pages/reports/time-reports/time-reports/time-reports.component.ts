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
import { debounceTime, filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { pick, pluck } from 'underscore';
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
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.updateChart()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	prepareRequest() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const appliedFilter = pick(
			this.filters,
			'source',
			'activityLevel',
			'logType'
		);
		this.loading = true;
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.payloads$.next(request);
	}

	updateChart() {
		if (!this.organization) {
			return;
		}
		const payloads = this.payloads$.getValue();

		this.loading = true;
		this.timesheetService
			.getDailyReportChart(payloads)
			.then((logs: any[]) => {
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
						label: TimeLogType.IDEAL,
						data: logs.map((log) => log.value[TimeLogType.IDEAL]),
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
			})
			.finally(() => (this.loading = false));
	}

	ngOnDestroy(): void {}
}
