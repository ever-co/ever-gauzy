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
	OrganizationPermissionsEnum
} from '@gauzy/models';
import { toUTC } from 'libs/utils';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { debounceTime } from 'rxjs/operators';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { NbDialogService } from '@nebular/theme';
import { EditTimeLogModalComponent } from 'apps/gauzy/src/app/@shared/timesheet/edit-time-log-modal/edit-time-log-modal.component';
import { ViewTimeLogComponent } from 'apps/gauzy/src/app/@shared/timesheet/view-time-log/view-time-log.component';
import { NgxPermissionsService } from 'ngx-permissions';
import { TimesheetFilterService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-filter.service';

interface WeeklyDayData {
	project?: IOrganizationProject;
	dates: any;
}

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
		private nbDialogService: NbDialogService,
		private timesheetFilterService: TimesheetFilterService,
		private ngxPermissionsService: NgxPermissionsService,
		private store: Store
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

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});

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
		console.log('filtersChange week', $event);
		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	async getLogs() {
		const { startDate, endDate, employeeIds } = this.logRequest;
		const request: IGetTimeLogInput = {
			employeeIds: this.logRequest.employeeIds,
			projectIds: this.logRequest.projectIds,
			source: this.logRequest.source,
			activityLevel: this.logRequest.activityLevel,
			logType: this.logRequest.logType,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			organizationId: this.organization ? this.organization.id : null,
			tenantId: this.organization ? this.organization.tenantId : null
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
