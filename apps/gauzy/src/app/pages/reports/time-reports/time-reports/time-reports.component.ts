import { Component, OnInit } from '@angular/core';
import {
	ICountsStatistics,
	IEmployee,
	IGetCountsStatistics,
	IGetTimeLogReportInput,
	IOrganization,
	IOrganizationProject,
	ITask,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/models';
import { toUTC } from '@gauzy/utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetFilterService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-filter.service';
import { TimesheetStatisticsService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-statistics.service';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as _ from 'underscore';

interface ReportDayData {
	date: string;
	logs: {
		project: IOrganizationProject;
		task: ITask;
		projectLogs: {
			employee: IEmployee;
			sum: number;
			activity: number;
		}[];
	}[];
}

@UntilDestroy()
@Component({
	selector: 'gauzy-time-reports',
	templateUrl: './time-reports.component.html',
	styleUrls: ['./time-reports.component.scss']
})
export class TimeReportsComponent implements OnInit {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date();
	logRequest: ITimeLogFilters = {};
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;
	counts: ICountsStatistics;

	dailyData: ReportDayData[] = [];
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
		private timesheetFilterService: TimesheetFilterService,
		private timesheetStatisticsService: TimesheetStatisticsService,
		private ngxPermissionsService: NgxPermissionsService,
		private store: Store
	) {}

	ngOnInit() {
		this.logRequest.startDate = moment(this.today).startOf('week').toDate();
		this.logRequest.endDate = moment(this.today).endOf('week').toDate();

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
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

	filtersChange($event: ITimeLogFilters) {
		this.logRequest = $event;
		this.timesheetFilterService.filter = $event;
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
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			organizationId: this.organization ? this.organization.id : null,
			tenantId: this.organization ? this.organization.tenantId : null,
			groupBy: this.groupBy
		};

		this.loading = true;
		this.timesheetService
			.getDailyReport(request)
			.then((logs: ReportDayData[]) => {
				this.dailyData = logs;

				const dates = [];
				const data = [];
				logs.forEach((log) => {
					dates.push(log.date);
					const allProjectSum = log.logs.map(({ projectLogs }) => {
						const sumAry = _.pluck(projectLogs, 'sum');
						return sumAry.reduce(
							(iteratee: any, duration: any) =>
								iteratee + duration,
							0
						);
					});
					const sum = allProjectSum.reduce(
						(iteratee: any, duration: any) => iteratee + duration,
						0
					);
					data.push(sum ? parseFloat((sum / 3600).toFixed(1)) : 0);
				});

				this.chartData = {
					labels: dates,
					datasets: [
						{
							label: 'Hours',
							data
						}
					]
				};

				console.log(this.chartData);
			})
			.catch((error) => {
				console.log(error);
			})
			.finally(() => (this.loading = false));
	}

	getCounts() {
		const request: IGetCountsStatistics = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
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
