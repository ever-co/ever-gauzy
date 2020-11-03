import { Component, OnInit } from '@angular/core';
import {
	ICountsStatistics,
	IEmployee,
	IGetTimeLogInput,
	IOrganization,
	IOrganizationProject,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/models';
import { toUTC } from '@gauzy/utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetFilterService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-filter.service';
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

	private _selectedDate: Date = new Date();
	futureDateAllowed: boolean;
	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	constructor(
		private timesheetService: TimesheetService,
		private timesheetFilterService: TimesheetFilterService,
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
		const request: IGetTimeLogInput = {
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			organizationId: this.organization ? this.organization.id : null,
			tenantId: this.organization ? this.organization.tenantId : null
		};

		this.loading = true;
		this.timesheetService
			.getDailyReport(request)
			.then((logs: any) => {
				this.dailyData = logs;
			})
			.finally(() => (this.loading = false));
	}
}
