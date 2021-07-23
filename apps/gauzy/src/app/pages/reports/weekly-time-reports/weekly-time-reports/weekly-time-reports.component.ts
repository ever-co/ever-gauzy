import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	IOrganization,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum,
	ReportDayData
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { debounceTime, tap } from 'rxjs/operators';
import { pluck, pick } from 'underscore';
import { TranslateService } from '@ngx-translate/core';
import { Store } from './../../../../@core/services/store.service';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import * as randomColor from 'randomcolor';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-weekly-time-reports',
	templateUrl: './weekly-time-reports.component.html',
	styleUrls: ['./weekly-time-reports.component.scss']
})
export class WeeklyTimeReportsComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {

	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	logRequest: ITimeLogFilters = this.request;
	filters: ITimeLogFilters;
	organization: IOrganization;
	weekData: ReportDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	futureDateAllowed: boolean;
	chartData: IChartData;

	constructor(
		private timesheetService: TimesheetService,
		private ngxPermissionsService: NgxPermissionsService,
		private cd: ChangeDetectorRef,
		protected store: Store,
		readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.getWeeklyLogs()),
				tap(() => this.updateWeekDayList()),
				untilDestroyed(this)
			)
			.subscribe();
		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.futureDateAllowed = await this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				);
			});
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	updateWeekDayList() {
		const range = {};
		let i = 0;
		const start = moment(this.logRequest.startDate);
		while (start.isSameOrBefore(this.logRequest.endDate) && i < 7) {
			const date = start.format('YYYY-MM-DD');
			range[date] = null;
			start.add(1, 'day');
			i++;
		}
		this.weekDayList = Object.keys(range);
	}

	filtersChange($event: ITimeLogFilters) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.subject$.next();
	}

	getWeeklyLogs() {
		const appliedFilter = pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest)
		};
		this.timesheetService
			.getWeeklyReportChart(request)
			.then((logs: any) => {
				this.weekData = logs;
				this._mapLogs(logs);
			})
			.finally(() => (this.loading = false));
	}

	/**
	* Weekly reports for employee logs
	* @param logs 
	*/
	private _mapLogs(logs: any) {
		let employees = [];
		const datasets = [];

		logs.forEach((log: any) => {
			const color = randomColor({ 
				luminosity: 'light',
				format: 'rgba',
				alpha: 0.5
			});
			employees = Object.keys(log.dates);
			datasets.push({
				label: log.employee.fullName,
				data: pluck(log.dates, 'sum').map((val) => val ? parseFloat((val / 3600).toFixed(1)) : 0),
				borderColor: color,
				backgroundColor: ChartUtil.transparentize(color, 0.5),
				borderWidth: 1
			});
		});

		this.chartData = {
			labels: employees,
			datasets: datasets
		};
	}
}
