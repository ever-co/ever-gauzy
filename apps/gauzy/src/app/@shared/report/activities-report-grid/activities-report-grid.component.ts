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
	ISelectedEmployee,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { pick } from 'underscore';
import { Store } from '../../../@core/services/store.service';
import { ActivityService } from '../../timesheet/activity.service';
import { toUTC } from '@gauzy/common-angular';

@UntilDestroy()
@Component({
	selector: 'ga-activities-report-grid',
	templateUrl: './activities-report-grid.component.html',
	styleUrls: ['./activities-report-grid.component.scss']
})
export class ActivitiesReportGridComponent implements OnInit, AfterViewInit {
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

	private _selectedDate: Date = new Date();
	futureDateAllowed: boolean;
	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';
	selectedEmployee: ISelectedEmployee;

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	@Input()
	set filters(value) {
		this.logRequest = value || {};
		this.updateLogs$.next();
	}

	constructor(
		private activityService: ActivityService,
		private ngxPermissionsService: NgxPermissionsService,
		private store: Store,
		private cd: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(
				debounceTime(1350),
				tap(() => this.getActivities()),
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

	filtersChange($event) {
		this.logRequest = $event;
		this.updateLogs$.next();
	}

	groupByChange() {
		this.updateLogs$.next();
	}

	async getActivities() {
		const { startDate, endDate } = this.logRequest;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const appliedFilter = pick(
			this.logRequest,
			'projectIds',
			'employeeIds',
			'source',
			'activityLevel',
			'logType'
		);

		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			organizationId,
			tenantId,
			groupBy: this.groupBy
		};

		this.loading = true;
		this.activityService
			.getDailyActivitiesReport(request)
			.then((logs: IReportDayData[]) => {
				this.dailyData = logs;
			})
			.catch((error) => {})
			.finally(() => (this.loading = false));
	}
}
