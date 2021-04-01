import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as moment from 'moment';
import * as _ from 'underscore';
import {
	IGetTimeLogInput,
	IOrganization,
	ITimeLog,
	IOrganizationProject,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	ISelectedEmployee
} from '@gauzy/contracts';
import { toUTC } from '@gauzy/common-angular';
import { Store } from './../../../../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap, withLatestFrom } from 'rxjs/operators';
import { TimesheetService } from './../../../../../@shared/timesheet/timesheet.service';
import { NbDialogService } from '@nebular/theme';
import { EditTimeLogModalComponent } from './../../../../../@shared/timesheet/edit-time-log-modal/edit-time-log-modal.component';
import { ViewTimeLogComponent } from './../../../../../@shared/timesheet/view-time-log/view-time-log.component';
import { NgxPermissionsService } from 'ngx-permissions';
import { TimesheetFilterService } from './../../../../../@shared/timesheet/timesheet-filter.service';

interface WeeklyDayData {
	project?: IOrganizationProject;
	dates: any;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-weekly',
	templateUrl: './weekly.component.html',
	styleUrls: ['./weekly.component.scss']
})
export class WeeklyComponent implements OnInit, OnDestroy {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	today: Date = new Date();
	logRequest: ITimeLogFilters = {};
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;

	weekData: WeeklyDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	viewTimeLogComponent = ViewTimeLogComponent;

	futureDateAllowed: boolean;
	private _selectedDate: Date = new Date();
	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	selectedEmployeeId = null;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly store: Store
	) {}

	addTimeCallback = (data) => {
		if (data) {
			this.updateLogs$.next();
		}
	};

	ngOnInit() {
		this.logRequest.startDate = moment(this.today).startOf('week').toDate();
		this.logRequest.endDate = moment(this.today).endOf('week').toDate();
		this.updateWeekDayList();

		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		storeEmployee$
			.pipe(
				filter((employee: ISelectedEmployee) => !!employee),
				debounceTime(200),
				withLatestFrom(storeOrganization$),
				untilDestroyed(this)
			)
			.subscribe(([employee]) => {
				if (employee && this.organization) {
					this.selectedEmployeeId = employee.id;
					this.updateLogs$.next();
				}
			});
		storeOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				withLatestFrom(storeEmployee$),
				untilDestroyed(this)
			)
			.subscribe(([organization, employee]) => {
				this.selectedEmployeeId = employee ? employee.id : null;
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});
		this.updateLogs$
			.pipe(
				debounceTime(500),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.getLogs()),
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
		this.updateWeekDayList();
		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	async getLogs() {
		if (!this.organization || !this.logRequest) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { startDate, endDate } = this.logRequest;

		const appliedFilter = _.pick(
			this.logRequest,
			'projectIds',
			'source',
			'activityLevel',
			'logType'
		);

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const request: IGetTimeLogInput = {
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeIds.length > 0 ? { employeeIds } : {}),
			organizationId,
			tenantId
		};

		this.loading = true;
		this.timesheetService
			.getTimeLogs(request)
			.then((logs: ITimeLog[]) => {
				this.weekData = _.chain(logs)
					.groupBy('projectId')
					.map((innerLogs: ITimeLog[], _projectId) => {
						const byDate = _.chain(innerLogs)
							.groupBy((log) =>
								moment(log.startedAt).format('YYYY-MM-DD')
							)
							.mapObject((res: ITimeLog[]) => {
								const sum = res.reduce(
									(iteratee: any, log: any) => {
										return iteratee + log.duration;
									},
									0
								);
								return { sum, logs: res };
							})
							.value();

						const project =
							innerLogs.length > 0 ? innerLogs[0].project : null;
						const dates: any = {};
						this.weekDayList.forEach((date) => {
							dates[date] = byDate[date] || 0;
						});
						return { project, dates };
					})
					.value();
			})
			.finally(() => (this.loading = false));
	}

	openAddEdit(timeLog?: ITimeLog) {
		this.nbDialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.updateLogs$.next();
				}
			});
	}

	openAddByDateProject(date, project: IOrganizationProject) {
		const minutes = moment().minutes();
		const stoppedAt = new Date(
			moment(date).format('YYYY-MM-DD') +
				' ' +
				moment()
					.set('minutes', minutes - (minutes % 10))
					.format('HH:mm')
		);
		const startedAt = moment(stoppedAt).subtract('1', 'hour').toDate();

		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: {
					timeLog: {
						startedAt,
						stoppedAt,
						organizationContactId: project
							? project.organizationContactId
							: null,
						projectId: project ? project.id : null,
						...(this.logRequest.employeeIds
							? { employeeId: this.logRequest.employeeIds[0] }
							: {})
					}
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.updateLogs$.next();
				}
			});
	}

	allowAdd(date) {
		return this.futureDateAllowed
			? true
			: moment(date).isSameOrBefore(moment());
	}
	ngOnDestroy(): void {}
}
