import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum,
	TimeLogType
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { pick, pluck } from 'underscore';
import { isEmpty } from '@gauzy/common-angular';
import { Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { getAdjustDateRangeFutureAllowed } from './../../../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-reports',
	templateUrl: './time-reports.component.html',
	styleUrls: ['./time-reports.component.scss']
})
export class TimeReportsComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit, OnDestroy {

	logRequest: ITimeLogFilters = this.request;
	filters: ITimeLogFilters;
	loading: boolean;
	chartData: IChartData;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.cdr.detectChanges();
	}

	ngAfterViewInit() {
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.updateChart()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		this.filters = Object.assign(
			{},
			this.logRequest,
			getAdjustDateRangeFutureAllowed(this.logRequest)
		);
		this.subject$.next(true);
	}

	updateChart() {
		if (!this.organization || isEmpty(this.logRequest)) {
			return;
		}
		const appliedFilter = pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		this.loading = true;
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.timesheetService
			.getDailyReportChart(request)
			.then((logs: any[]) => {
				const commonOptions = {
					borderWidth: 1,
					pointRadius: 2,
					pointHoverRadius: 7,
					pointHoverBorderWidth: 6,
				}
				const datasets = [
					{
						label: TimeLogType.MANUAL,
						data: logs.map((log) => log.value[TimeLogType.MANUAL]),
						borderColor: ChartUtil.CHART_COLORS.red,
						backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 0.1),
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
