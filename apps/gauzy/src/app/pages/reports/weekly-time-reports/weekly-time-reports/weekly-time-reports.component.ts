import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	ICountsStatistics,
	IEmployee,
	IGetCountsStatistics,
	IGetTimeLogReportInput,
	IOrganization,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from './../../../../@core/services/store.service';
import { TimesheetStatisticsService } from './../../../../@shared/timesheet/timesheet-statistics.service';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { debounceTime } from 'rxjs/operators';
import * as _ from 'underscore';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';
import { TranslateService } from '@ngx-translate/core';

interface ReportDayData {
	employee?: IEmployee;
	dates: any;
}

@UntilDestroy()
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
	counts: ICountsStatistics;
	weekData: ReportDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	countsLoading: boolean;

	futureDateAllowed: boolean;
	chartData: {
		labels: any[];
		datasets: {
			label: any;
			backgroundColor: any;
			borderWidth: any;
			data: any;
		}[];
	};

	constructor(
		private timesheetService: TimesheetService,
		private ngxPermissionsService: NgxPermissionsService,
		private timesheetStatisticsService: TimesheetStatisticsService,
		private cd: ChangeDetectorRef,
		protected store: Store,
		readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(debounceTime(500), untilDestroyed(this))
			.subscribe(() => {
				this.getCounts();
				this.getLogs();
				this.updateWeekDayList();
			});
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

	async getLogs() {
		const request: IGetTimeLogReportInput = this.makeFilterRequest();
		this.loading = true;
		this.timesheetService
			.getWeeklyReport(request)
			.then((logs: any) => {
				this.weekData = logs;

				let employees = [];
				const datasets = [];
				logs.forEach((log) => {
					employees = Object.keys(log.dates);
					datasets.push({
						label: log.employee.user.name,
						data: _.pluck(log.dates, 'sum').map((val) =>
							val ? parseFloat((val / 3600).toFixed(1)) : 0
						)
					});
				});

				this.chartData = {
					labels: employees,
					datasets: datasets
				};
			})
			.finally(() => (this.loading = false));
	}

	getCounts() {
		const request: IGetCountsStatistics = this.makeFilterRequest();
		this.countsLoading = true;
		this.timesheetStatisticsService
			.getCounts(request)
			.then((resp) => {
				this.counts = resp;
			})
			.finally(() => {
				this.countsLoading = false;
			});
	}

	makeFilterRequest() {
		const appliedFilter = _.pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		return {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest)
		};
	}
}
