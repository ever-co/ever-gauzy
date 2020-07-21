import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Subject } from 'rxjs';
import {
	Organization,
	TimeLogFilters,
	IGetActivitiesInput,
	ActivityType,
	DailyActivity
} from '@gauzy/models';
import { debounceTime } from 'rxjs/operators';
import { toUTC, toLocal } from 'libs/utils';
import { ActivityService } from 'apps/gauzy/src/app/@shared/timesheet/activity.service';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'underscore';
import * as moment from 'moment';

@Component({
	selector: 'ngx-app-url-activity',
	styleUrls: ['./app-url-activity.component.scss'],
	templateUrl: './app-url-activity.component.html'
})
export class AppUrlActivityComponent implements OnInit, OnDestroy {
	loading: boolean;
	apps: {
		hour: string;
		activities: DailyActivity[];
	}[];
	request: any;
	updateLogs$: Subject<any> = new Subject();
	organization: Organization;
	type: 'apps' | 'urls';

	constructor(
		private store: Store,
		private activatedRoute: ActivatedRoute,
		private activityService: ActivityService
	) {}

	ngOnInit(): void {
		this.activatedRoute.params.subscribe((params) => {
			if (params.type) {
				this.type = params.type;
				this.updateLogs$.next();
			}
		});

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
			type: this.type === 'apps' ? ActivityType.APP : ActivityType.URL
		};

		this.loading = true;
		this.activityService
			.getDailyActivites(request)
			.then((activities) => {
				this.apps = _.chain(activities)
					.map((activity) => {
						activity.hours = toLocal(
							moment(
								moment(activity.date).format('YYYY-MM-DD') +
									' ' +
									activity.time
							).toDate()
						);
						return activity;
					})
					.groupBy('hours')
					.mapObject((value, key) => {
						const sum = _.reduce(
							value,
							(memo, activitiy) =>
								memo + parseInt(activitiy.duration + '', 10),
							0
						);
						value = value.map((activity) => {
							activity.durationPercentage = (
								(activity.duration * 100) /
								sum
							).toFixed(1);
							return activity;
						});
						return { hour: key, activities: value };
					})
					.values()
					.value();
			})
			.finally(() => (this.loading = false));
	}

	ngOnDestroy(): void {}
}
