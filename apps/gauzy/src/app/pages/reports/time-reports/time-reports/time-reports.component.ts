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
import { Store } from './../../../../@core/services/store.service';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-reports',
	templateUrl: './time-reports.component.html',
	styleUrls: ['./time-reports.component.scss']
})
export class TimeReportsComponent
	extends ReportBaseComponent
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
		private readonly cd: ChangeDetectorRef
	) {
		super(store, translateService);
	}

	ngOnInit() {}

	ngAfterViewInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.updateChart()),
				untilDestroyed(this)
			)
			.subscribe();
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.subject$.next(true);
	}

	updateChart() {
		const appliedFilter = pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.timesheetService
			.getDailyReportChart(request)
			.then((logs: any[]) => {
				const datasets = [
					{
						label: TimeLogType.MANUAL,
						data: logs.map((log) => log.value[TimeLogType.MANUAL]),
						borderColor: ChartUtil.CHART_COLORS.red,
						backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 0.5),
						borderWidth: 1
					},
					{
						label: TimeLogType.TRACKED,
						data: logs.map((log) => log.value[TimeLogType.TRACKED]),
						borderColor: ChartUtil.CHART_COLORS.blue,
						backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.blue, 0.5),
						borderWidth: 1
					},
					{
						label: TimeLogType.IDEAL,
						data: logs.map((log) => log.value[TimeLogType.IDEAL]),
						borderColor: ChartUtil.CHART_COLORS.yellow,
						backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.yellow, 0.5),
						borderWidth: 1
					},
					{
						label: TimeLogType.RESUMED,
						data: logs.map((log) => log.value[TimeLogType.RESUMED]),
						borderColor: ChartUtil.CHART_COLORS.green,
						backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.green, 0.5),
						borderWidth: 1
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
