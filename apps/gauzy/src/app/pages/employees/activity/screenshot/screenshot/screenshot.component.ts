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
import { toUTC } from 'libs/utils';
import * as _ from 'underscore';
import * as moment from 'moment';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Component({
	selector: 'ngx-screenshot',
	templateUrl: './screenshot.component.html',
	styleUrls: ['./screenshot.component.scss']
})
export class ScreenshotComponent implements OnInit, OnDestroy {
	request: TimeLogFilters;
	loading: boolean;
	timeSlots: { hour: string; timeSlots: TimeSlot[] }[];
	checkAllCheckbox: any;
	selectedIds: {};
	updateLogs$: Subject<any> = new Subject();
	organization: any;

	defaultSlots: {
		'00': null;
		'10': null;
		'20': null;
		'30': null;
		'40': null;
		'50': null;
	};

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

	async getLogs() {
		if (!this.organization) {
			return;
		}

		const { employeeId, startDate, endDate } = this.request;

		const request: IGetTimeSlotInput = {
			organizationId: this.organization.id,
			...this.request,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			relations: ['screenshots']
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
				timeSlots.forEach((log) => (this.selectedIds[log.id] = false));

				const hourlySlots = _.groupBy(timeSlots, (timeSlot) =>
					moment(timeSlot.startedAt).format('HH')
				);

				this.timeSlots = Object.keys(hourlySlots)
					.map((hour) => ({
						hour,
						timeSlots: _.values(
							_.extend(
								this.defaultSlots,
								_.groupBy(hourlySlots[hour], (timeSlot) =>
									moment(timeSlot.startedAt).format('MM')
								)
							)
						)
					}))
					.filter((hourlySlot) => hourlySlot.timeSlots.length === 0);
			})
			.finally(() => (this.loading = false));
	}

	ngOnDestroy(): void {}
}
