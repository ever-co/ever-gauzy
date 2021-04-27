import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IGetTimeLimitReportInput,
	ISelectedEmployee,
	ITimeLimitReport,
	ITimeLogFilters
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import * as moment from 'moment';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { toUTC } from '@gauzy/common-angular';

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
	projectId: string | null = null;

	constructor(
		private cd: ChangeDetectorRef,
		private timesheetService: TimesheetService,
		private activatedRoute: ActivatedRoute,
		private store: Store
	) {}

	ngOnInit(): void {
		this.updateLogs$
			.pipe(
				debounceTime(1350),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([organization, employee, project]) => {
					if (organization) {
						this.organization = organization;
						this.selectedEmployee = employee;
						this.projectId = project ? project.id : null;
						this.updateLogs$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.activatedRoute.data
			.pipe(untilDestroyed(this))
			.subscribe((data) => {
				this.logRequest.duration = data.duration || 'day';
				this.title = data.title;
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
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const request: IGetTimeLimitReportInput = {
			duration,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			organizationId,
			tenantId,
			relations: ['task', 'project', 'employee', 'employee.user'],
			...(this.selectedEmployee && this.selectedEmployee.id
				? { employeeIds: [this.selectedEmployee.id] }
				: {}),
			...(this.projectId ? { projectIds: [this.projectId] } : {})
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
