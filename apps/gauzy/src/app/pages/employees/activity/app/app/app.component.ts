import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Subject } from 'rxjs';
import {
	Organization,
	TimeLogFilters,
	IGetActivitiesInput
} from '@gauzy/models';
import { debounceTime } from 'rxjs/operators';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { toUTC } from 'libs/utils';
import * as _ from 'underscore';
import * as moment from 'moment';

@Component({
	selector: 'ngx-app',
	templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
	loading: boolean;
	apps: any[];
	request: any;
	updateLogs$: Subject<any> = new Subject();
	organization: Organization;

	constructor(
		private store: Store,
		private timesheetService: TimesheetService
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

		const request: IGetActivitiesInput = {
			organizationId: this.organization.id,
			...this.request,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			relations: ['screenshots', 'timeLogs']
		};

		this.loading = true;
		this.timesheetService
			.getTimeSlots(request)
			.then((activities) => {
				this.apps = _.chain(activities)
					.groupBy((timeSlot) =>
						moment(timeSlot.localStartedAt).format('HH')
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
