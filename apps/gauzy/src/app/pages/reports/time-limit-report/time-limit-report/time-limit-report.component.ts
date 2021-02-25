import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IGetTimeLimitReportInput,
	IOrganization,
	ISelectedEmployee,
	ITimeLimitReport,
	ITimeLogFilters
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@UntilDestroy()
@Component({
	selector: 'ga-time-limit-report',
	templateUrl: './time-limit-report.component.html',
	styleUrls: ['./time-limit-report.component.scss']
})
export class TimeLimitReportComponent implements OnInit, AfterViewInit {
	logRequest: IGetTimeLimitReportInput = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate(),
		duration: 'day'
	};
	updateLogs$: Subject<any> = new Subject();
	filters: ITimeLogFilters;
	organization: any;
	selectedEmployee: ISelectedEmployee;
	loading: boolean;
	dailyData: any;
	title: string;

	constructor(
		private cd: ChangeDetectorRef,
		private timesheetService: TimesheetService,
		private activatedRoute: ActivatedRoute,
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

		this.activatedRoute.data
			.pipe(untilDestroyed(this))
			.subscribe((data) => {
				this.logRequest.duration = data.duration || 'day';
				this.title = data.title;
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee: ISelectedEmployee) => {
				if (employee && employee.id) {
					this.selectedEmployee = employee;
				} else {
					this.selectedEmployee = null;
				}
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
		const { startDate, endDate, duration } = this.logRequest;
		const request: IGetTimeLimitReportInput = {
			duration,
			startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: moment(endDate).format('YYYY-MM-DD HH:mm:ss'),
			organizationId: this.organization ? this.organization.id : null,
			relations: ['task', 'project', 'employee', 'employee.user'],
			...(this.selectedEmployee && this.selectedEmployee.id
				? { employeeIds: [this.selectedEmployee.id] }
				: {})
		};

		this.loading = true;
		this.timesheetService
			.getTimeLimit(request)
			.then((logs: ITimeLimitReport[]) => {
				this.dailyData = logs;
			})
			.finally(() => (this.loading = false));
	}
}
