// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as moment from 'moment';
import * as _ from 'underscore';
import {
	IGetTimeLogInput,
	Organization,
	PermissionsEnum,
	TimeLog,
	OrganizationProjects
} from '@gauzy/models';
import { toUTC } from 'libs/utils';
import { TimeTrackerService } from 'apps/gauzy/src/app/@shared/time-tracker/time-tracker.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { debounceTime } from 'rxjs/operators';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';

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
	logRequest: {
		startDate?: Date;
		endDate?: Date;
		employeeId?: string;
	} = {};
	updateLogs$: Subject<any> = new Subject();
	organization: Organization;
	canChangeSelectedEmployee: boolean;

	weekData: WeeklyDayData[] = [];
	weekDayList: string[] = [];

	constructor(
		private timeTrackerService: TimeTrackerService,
		private store: Store
	) {}

	private _selectedDate: Date = new Date();
	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
		this.logRequest.startDate = moment(value)
			.startOf('isoWeek')
			.toDate();
		this.logRequest.endDate = moment(value)
			.endOf('isoWeek')
			.toDate();

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

		this.updateLogs$.next();
	}

	ngOnInit() {
		this.selectedDate = this.today;
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

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee: SelectedEmployee) => {
				if (employee) {
					this.logRequest.employeeId = employee.id;
					this.updateLogs$.next();
				}
			});

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});
	}

	async nextDay() {
		const date = moment(this.selectedDate).add(7, 'day');
		if (date.isAfter(this.today)) {
			return;
		}
		this.selectedDate = date.toDate();
	}

	async previousDay() {
		this.selectedDate = moment(this.selectedDate)
			.subtract(7, 'day')
			.toDate();
	}

	async getLogs() {
		const { startDate, endDate, employeeId } = this.logRequest;
		const _startDate = moment(startDate).format('YYYY-MM-DD') + ' 00:00:00';
		const _endDate = moment(endDate).format('YYYY-MM-DD') + ' 23:59:59';

		const request: IGetTimeLogInput = {
			startDate: toUTC(_startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(_endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			organizationId: this.organization ? this.organization.id : null
		};

		this.timeTrackerService.getTimeLogs(request).then((logs: TimeLog[]) => {
			this.weekData = _.chain(logs)
				.groupBy('projectId')
				.map((logs: TimeLog[], _projectId) => {
					const byDate = _.chain(logs)
						.groupBy((log) =>
							moment(log.startedAt).format('YYYY-MM-DD')
						)
						.mapObject((logs: TimeLog[], date) => {
							const sum = logs.reduce(
								(iteratee: any, log: any) => {
									return iteratee + log.duration;
								},
								0
							);
							return sum;
						})
						.value();

					const project = logs.length > 0 ? logs[0].project : null;
					const dates: any = {};
					this.weekDayList.forEach((date) => {
						dates[date] = byDate[date] || 0;
					});
					return { project, dates };
				})
				.value();
		});
	}

	ngOnDestroy(): void {}
}
