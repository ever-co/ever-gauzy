// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as moment from 'moment';
import { IGetTimeLogInput, Organization, PermissionsEnum } from '@gauzy/models';
import { toUTC } from 'libs/utils';
import { TimeTrackerService } from 'apps/gauzy/src/app/@shared/time-tracker/time-tracker.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';

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
		this.updateLogs$.next();
	}

	ngOnInit() {
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
	}

	async nextDay() {
		const date = moment(this.selectedDate).add(1, 'day');
		if (date.isAfter(this.today)) {
			return;
		}
		this.selectedDate = date.toDate();
	}

	async previousDay() {
		this.selectedDate = moment(this.selectedDate)
			.subtract(1, 'day')
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

		await this.timeTrackerService.getTimeLogs(request).then((logs) => {
			return logs;
		});
	}

	ngOnDestroy(): void {}
}
