import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as moment from 'moment';
import * as _ from 'underscore';
import {
	IGetTimeLogInput,
	Organization,
	PermissionsEnum,
	TimeLog,
	OrganizationProjects,
	TimeLogFilters
} from '@gauzy/models';
import { toUTC } from 'libs/utils';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { debounceTime } from 'rxjs/operators';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { NbDialogService } from '@nebular/theme';
import { EditTimeLogModalComponent } from 'apps/gauzy/src/app/@shared/timesheet/edit-time-log-modal/edit-time-log-modal.component';

interface WeeklyDayData {
	project?: OrganizationProjects;
	dates: any;
}

@Component({
	selector: 'ngx-weekly',
	templateUrl: './weekly.component.html',
	styleUrls: ['./weekly.component.scss']
})
export class WeeklyComponent implements OnInit, OnDestroy {
	today: Date = new Date();
	logRequest: TimeLogFilters = {};
	updateLogs$: Subject<any> = new Subject();
	organization: Organization;
	canChangeSelectedEmployee: boolean;

	weekData: WeeklyDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;

	constructor(
		private timesheetService: TimesheetService,
		private nbDialogService: NbDialogService,
		private store: Store
	) {}

	private _selectedDate: Date = new Date();
	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	ngOnInit() {
		this.logRequest.startDate = moment(this.today).startOf('week').toDate();
		this.logRequest.endDate = moment(this.today).endOf('week').toDate();
		this.updateWeekDayList();

		this.store.user$.subscribe(() => {
			this.canChangeSelectedEmployee = this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		});
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				this.organization = organization;
			});

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});

		this.updateLogs$.next();
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

	filtersChange($event: TimeLogFilters) {
		const dateChagne = $event.startDate !== this.logRequest.startDate;
		this.logRequest = $event;
		if (dateChagne) {
			this.updateWeekDayList();
		}
		this.updateLogs$.next();
	}

	async getLogs() {
		const { startDate, endDate, employeeId } = this.logRequest;
		const request: IGetTimeLogInput = {
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			organizationId: this.organization ? this.organization.id : null
		};

		this.loading = true;
		this.timesheetService
			.getTimeLogs(request)
			.then((logs: TimeLog[]) => {
				this.weekData = _.chain(logs)
					.groupBy('projectId')
					.map((logs: TimeLog[], _projectId) => {
						const byDate = _.chain(logs)
							.groupBy((log) =>
								moment(log.startedAt).format('YYYY-MM-DD')
							)
							.mapObject((logs: TimeLog[]) => {
								const sum = logs.reduce(
									(iteratee: any, log: any) => {
										return iteratee + log.duration;
									},
									0
								);
								return sum;
							})
							.value();

						const project =
							logs.length > 0 ? logs[0].project : null;
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

	openAddEdit(timeLog?: TimeLog) {
		this.nbDialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.subscribe(() => {
				this.updateLogs$.next();
			});
	}

	ngOnDestroy(): void {}
}
