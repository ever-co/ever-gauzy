import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	ICountsStatistics,
	IGetCountsStatistics,
	IGetTimeLogReportInput,
	IOrganization,
	IReportDayData,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum,
	TimeLogType
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetStatisticsService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-statistics.service';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as _ from 'underscore';

@UntilDestroy()
@Component({
	selector: 'gauzy-time-reports',
	templateUrl: './time-reports.component.html',
	styleUrls: ['./time-reports.component.scss']
})
export class TimeReportsComponent implements OnInit, AfterViewInit {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date();
	logRequest: ITimeLogFilters = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate()
	};
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;
	counts: ICountsStatistics;

	dailyData: IReportDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	countsLoading: boolean;
	chartData: any;

	private _selectedDate: Date = new Date();
	futureDateAllowed: boolean;
	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	constructor(
		private timesheetService: TimesheetService,
		private timesheetStatisticsService: TimesheetStatisticsService,
		private ngxPermissionsService: NgxPermissionsService,
		private store: Store,
		private cd: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
				this.updateChartData();
				this.getCounts();
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee: SelectedEmployee) => {
				if (employee && employee.id) {
					this.logRequest.employeeIds = [employee.id];
				} else {
					delete this.logRequest.employeeIds;
				}
				this.updateLogs$.next();
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

	filtersChange($event) {
		console.log($event);
		this.logRequest = $event;
		this.updateLogs$.next();
	}

	filterChange() {
		this.updateLogs$.next();
	}

	async getLogs() {
		const { startDate, endDate } = this.logRequest;

		const appliedFilter = _.pick(
			this.logRequest,
			'employeeIds',
			'projectIds',
			'source',
			'activityLevel',
			'logType'
		);

		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: moment(endDate).format('YYYY-MM-DD HH:mm:ss'),
			organizationId: this.organization ? this.organization.id : null,
			tenantId: this.organization ? this.organization.tenantId : null,
			groupBy: this.groupBy
		};

		this.loading = true;
		this.timesheetService
			.getDailyReport(request)
			.then((logs: IReportDayData[]) => {
				this.dailyData = logs;
			})
			.catch((error) => {
				console.log(error);
			})
			.finally(() => (this.loading = false));
	}

	updateChartData() {
		const { startDate, endDate } = this.logRequest;
		const request: IGetTimeLogReportInput = {
			startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: moment(endDate).format('YYYY-MM-DD HH:mm:ss'),
			organizationId: this.organization ? this.organization.id : null,
			tenantId: this.organization ? this.organization.tenantId : null,
			groupBy: this.groupBy
		};
		this.loading = true;
		this.timesheetService
			.getDailyReportChartData(request)
			.then((logs: any[]) => {
				const datasets = [
					{
						label: TimeLogType.MANUAL,
						data: logs.map((log) => log.value[TimeLogType.MANUAL])
					},
					{
						label: TimeLogType.TRACKED,
						data: logs.map((log) => log.value[TimeLogType.TRACKED])
					}
				];
				this.chartData = {
					labels: _.pluck(logs, 'date'),
					datasets
				};
			})
			.finally(() => (this.loading = false));
	}

	getCounts() {
		const { startDate, endDate } = this.logRequest;
		const appliedFilter = _.pick(
			this.logRequest,
			'employeeIds',
			'projectIds',
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetCountsStatistics = {
			...appliedFilter,
			startDate: moment(startDate).toDate(),
			endDate: moment(endDate).toDate(),
			organizationId: this.organization ? this.organization.id : null,
			tenantId: this.organization ? this.organization.tenantId : null
		};
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
}
