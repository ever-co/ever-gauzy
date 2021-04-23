import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	IOrganization,
	IReportDayData,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { toUTC } from '@gauzy/common-angular';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { pick } from 'underscore';
import { Store } from '../../../@core/services/store.service';
import { TimesheetService } from '../../timesheet/timesheet.service';

@UntilDestroy()
@Component({
	selector: 'ga-daily-grid',
	templateUrl: './daily-grid.component.html',
	styleUrls: ['./daily-grid.component.scss']
})
export class DailyGridComponent implements OnInit, AfterViewInit {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date();
	logRequest: ITimeLogFilters = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate()
	};
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;

	dailyData: IReportDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;

	selectedEmployeeId: string | null = null;
	projectId: string | null = null;
	futureDateAllowed: boolean;
	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';

	private _selectedDate: Date = new Date();
	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	@Input()
	set filters(value) {
		this.logRequest = value;
		this.updateLogs$.next();
	}

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly store: Store,
		private readonly cd: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(
				untilDestroyed(this),
				debounceTime(500),
				tap(() => this.getLogs())
			)
			.subscribe();
		const storeProject$ = this.store.selectedProject$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		combineLatest([storeProject$, storeEmployee$, storeOrganization$])
			.pipe(
				tap(([project, employee, organization]) => {
					if (organization) {
						this.organization = organization;
						this.selectedEmployeeId = employee ? employee.id : null;
						this.projectId = project.id || null;
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

	filtersChange($event) {
		this.logRequest = $event;
		this.updateLogs$.next();
	}

	groupByChange() {
		this.updateLogs$.next();
	}

	async getLogs() {
		if (!this.organization || !this.logRequest) {
			return;
		}

		const { startDate, endDate } = this.logRequest;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const projectIds: string[] = [];
		if (this.projectId) {
			projectIds.push(this.projectId);
		}

		const appliedFilter = pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);

		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			...(employeeIds.length > 0 ? { employeeIds } : {}),
			...(projectIds.length > 0 ? { projectIds } : {}),
			organizationId,
			tenantId,
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
}
