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
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetStatisticsService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-statistics.service';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import * as moment from 'moment';
import { toUTC } from '@gauzy/common-angular';
import { NgxPermissionsService } from 'ngx-permissions';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import * as _ from 'underscore';

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
export class WeeklyTimeReportsComponent implements OnInit, AfterViewInit {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date();
	logRequest: ITimeLogFilters = {};
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;
	counts: ICountsStatistics;

	weekData: ReportDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	countsLoading: boolean;

	private _selectedDate: Date = new Date();
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
	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	constructor(
		private timesheetService: TimesheetService,
		private ngxPermissionsService: NgxPermissionsService,
		private timesheetStatisticsService: TimesheetStatisticsService,
		private cd: ChangeDetectorRef,
		private store: Store
	) {
		this.logRequest.startDate = moment(this.today)
			.startOf('week')
			.format('YYYY-MM-DD');
		this.logRequest.endDate = moment(this.today)
			.endOf('week')
			.format('YYYY-MM-DD');
	}

	ngOnInit() {
		this.updateLogs$
			.pipe(debounceTime(500), untilDestroyed(this))
			.subscribe(() => {
				this.getCounts();
				this.getLogs();
				this.updateWeekDayList();
			});
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([organization, employee, project]) => {
					if (organization) {
						this.organization = organization;
						if (employee && employee.id) {
							this.logRequest.employeeIds = [employee.id];
						} else {
							delete this.logRequest.employeeIds;
						}
						if (project && project.id) {
							this.logRequest.projectIds = [project.id];
						} else {
							delete this.logRequest.projectIds;
						}
						this.updateLogs$.next();
					}
				}),
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
		this.updateLogs$.next();
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
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { startDate, endDate } = this.logRequest;
		const appliedFilter = _.pick(
			this.logRequest,
			'employeeIds',
			'projectIds',
			'source',
			'activityLevel',
			'logType'
		);
		return {
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			organizationId,
			tenantId
		};
	}
}
