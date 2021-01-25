import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	IOrganization,
	ITimeLog,
	ITimeLogFilters,
	TimeLogType
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { chain, pick } from 'underscore';

@UntilDestroy()
@Component({
	selector: 'ga-manual-time',
	templateUrl: './manual-time.component.html',
	styleUrls: ['./manual-time.component.scss']
})
export class ManualTimeComponent implements OnInit, AfterViewInit {
	logRequest: ITimeLogFilters = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate()
	};
	updateLogs$: Subject<any> = new Subject();
	filters: ITimeLogFilters;
	organization: any;
	selectedEmployee: SelectedEmployee;
	loading: boolean;
	dailyData: any;

	constructor(
		private cd: ChangeDetectorRef,
		private timesheetService: TimesheetService,
		private store: Store
	) {}

	ngOnInit(): void {
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
					this.selectedEmployee = employee;
				} else {
					this.selectedEmployee = null;
				}
				this.filters = Object.assign({}, this.logRequest);
				this.updateLogs$.next();
			});
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.updateLogs$.next();
	}

	async getLogs() {
		const { startDate, endDate } = this.logRequest;
		const appliedFilter = pick(
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
			logType: [TimeLogType.MANUAL],
			relations: ['task', 'project', 'employee', 'employee.user']
		};

		this.loading = true;
		this.timesheetService
			.getTimeLogs(request)
			.then((logs: ITimeLog[]) => {
				this.dailyData = chain(logs)
					.groupBy((log: ITimeLog) => {
						return moment(log.updatedAt).format('YYYY-MM-DD');
					})
					.map((timeLogs, date) => {
						return {
							date,
							timeLogs
						};
					})
					.value();
			})
			.finally(() => (this.loading = false));
	}
}
