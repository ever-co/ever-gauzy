import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	TimeLogFilters,
	Organization,
	TimeSlot,
	IGetTimeSlotInput
} from '@gauzy/models';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { debounceTime } from 'rxjs/operators';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { toUTC, toLocal } from 'libs/utils';
import * as _ from 'underscore';
import * as moment from 'moment';
import { untilDestroyed } from 'ngx-take-until-destroy';

export interface ScreenshotMap {
	startTime: string;
	endTime: string;
	timeSlots: TimeSlot[];
}

@Component({
	selector: 'ngx-screenshot',
	templateUrl: './screenshot.component.html',
	styleUrls: ['./screenshot.component.scss']
})
export class ScreenshotComponent implements OnInit, OnDestroy {
	request: TimeLogFilters;
	loading: boolean;
	timeSlots: ScreenshotMap[];
	checkAllCheckbox: any;
	selectedIds: {};
	updateLogs$: Subject<any> = new Subject();
	organization: any;

	constructor(
		private timesheetService: TimesheetService,
		private store: Store
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				this.organization = organization;
				this.updateLogs$.next();
			});

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});
	}

	async filtersChange($event: TimeLogFilters) {
		this.request = $event;
		this.updateLogs$.next();
	}

	prgressStatus(value) {
		if (value <= 25) {
			return 'danger';
		} else if (value <= 50) {
			return 'warning';
		} else if (value <= 75) {
			return 'info';
		} else {
			return 'success';
		}
	}

	async getLogs() {
		if (!this.organization) {
			return;
		}

		const { employeeIds, startDate, endDate } = this.request;

		const request: IGetTimeSlotInput = {
			organizationId: this.organization.id,
			...this.request,
			startDate: toUTC(startDate).format('YYYY-MM-DD'),
			endDate: toUTC(endDate).format('YYYY-MM-DD'),
			...(employeeIds ? { employeeIds } : {}),
			relations: ['screenshots', 'timeLogs']
		};

		this.loading = true;
		this.timesheetService
			.getTimeSlots(request)
			.then((timeSlots) => {
				this.selectedIds = {};
				if (this.checkAllCheckbox) {
					this.checkAllCheckbox.checked = false;
					this.checkAllCheckbox.indeterminate = false;
				}
				this.timeSlots = _.chain(timeSlots)
					.map((timeSlot) => {
						this.selectedIds[timeSlot.id] = false;
						timeSlot.localStartedAt = toLocal(
							timeSlot.startedAt
						).toDate();
						timeSlot.localStoppedAt = toLocal(
							timeSlot.stoppedAt
						).toDate();
						return timeSlot;
					})
					.groupBy((timeSlot) =>
						moment(timeSlot.localStartedAt).format('HH')
					)
					.mapObject(
						(hourTimeSlots: TimeSlot[], hour): ScreenshotMap => {
							const byMinutes = _.indexBy(
								hourTimeSlots,
								(timeSlot) =>
									moment(timeSlot.localStartedAt).format('mm')
							);
							timeSlots = [
								'00',
								'10',
								'20',
								'30',
								'40',
								'50'
							].map((key) => byMinutes[key] || null);
							const time = moment()
								.set('hour', hour)
								.set('minute', 0);
							const startTime = time.format('HH:mm');
							const endTime = time.add(1, 'hour').format('HH:mm');
							return { startTime, endTime, timeSlots };
						}
					)
					.values()
					.sortBy(({ startTime }) =>
						moment(startTime, 'HH:mm').toDate().getTime()
					)
					.value();
			})
			.finally(() => (this.loading = false));
	}

	ngOnDestroy(): void {}
}
