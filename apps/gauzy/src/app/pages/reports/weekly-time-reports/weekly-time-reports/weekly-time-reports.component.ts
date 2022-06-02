import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportDayData
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { pluck, pick } from 'underscore';
import { TranslateService } from '@ngx-translate/core';
import * as randomColor from 'randomcolor';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { moment } from './../../../../@core/moment-extend';
import { DateRangePickerBuilderService, Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-weekly-time-reports',
	templateUrl: './weekly-time-reports.component.html',
	styleUrls: ['./weekly-time-reports.component.scss']
})
export class WeeklyTimeReportsComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

	filters: ITimeLogFilters;
	weekLogs: ReportDayData[] = [];
	weekDays: string[] = [];
	loading: boolean = false;
	chartData: IChartData;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly cdr: ChangeDetectorRef,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.cdr.detectChanges();
	}

	ngAfterViewInit() {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getWeeklyLogs()),
				tap(() => this.updateWeekDays()),
				untilDestroyed(this)
			)
			.subscribe();
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
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request)
		};
		this.payloads$.next(request);
	}

	updateWeekDays() {
		const {
			startDate = moment().startOf('week'),
			endDate = moment().endOf('week')
		} = this.request;

		const start = moment(moment(startDate).format('YYYY-MM-DD'));
		const end = moment(moment(endDate).format('YYYY-MM-DD'));
		const range = Array.from(moment.range(start, end).by('day'));

		const days: Array<string> = new Array();
		let i = 0;
		while (i < range.length) {
			const date = range[i].format('YYYY-MM-DD');
			days.push(date);
			i++;
		}
		this.weekDays = days;
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	async getWeeklyLogs() {
		if (!this.organization) {
			return;
		}
		const payloads = this.payloads$.getValue();

		this.loading = true;
		try {
			const logs: ReportDayData[] = await this.timesheetService.getWeeklyReportChart(payloads);
			this.weekLogs = logs;
			this._mapLogs(logs);
		} catch (error) {
			console.log('Error while retriving weekly time logs reports', error);
		} finally {
			this.loading = false;
		}
	}

	/**
	* Weekly reports for employee logs
	* @param logs 
	*/
	private _mapLogs(logs: ReportDayData[]) {
		let employees = [];
		const datasets = [];

		logs.forEach((log: ReportDayData) => {
			const color = randomColor({ 
				luminosity: 'light',
				format: 'rgba',
				alpha: 1
			});
			employees = Object.keys(log.dates);
			datasets.push({
				label: log.employee.fullName,
				data: pluck(log.dates, 'sum').map((val) => val ? parseFloat((val / 3600).toFixed(1)) : 0),
				borderColor: color,
				backgroundColor: ChartUtil.transparentize(color, 1),
				borderWidth: 1,
				pointRadius: 2,
				pointHoverRadius: 7,
				pointHoverBorderWidth: 6,
			});
		});

		this.chartData = {
			labels: employees,
			datasets: datasets
		};
	}
}
