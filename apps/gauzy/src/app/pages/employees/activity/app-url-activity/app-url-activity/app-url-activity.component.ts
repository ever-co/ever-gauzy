import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { chain, reduce } from 'underscore';
import * as moment from 'moment';
import {
	ITimeLogFilters,
	IGetActivitiesInput,
	ActivityType,
	IDailyActivity,
	IActivity,
	IURLMetaData
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { toUTC, toLocal, isJsObject, isEmpty } from '@gauzy/common-angular';
import { Store } from './../../../../../@core/services';
import { ActivityService, TimesheetFilterService } from './../../../../../@shared/timesheet';
import { BaseSelectorFilterComponent } from './../../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-app-url-activity',
	styleUrls: ['./app-url-activity.component.scss'],
	templateUrl: './app-url-activity.component.html'
})
export class AppUrlActivityComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	loading: boolean;
	apps: {
		hour: string;
		activities: IDailyActivity[];
	}[];
	filters: ITimeLogFilters;
	activities$: Subject<boolean> = this.subject$;
	type: 'apps' | 'urls';

	constructor(
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		private readonly activatedRoute: ActivatedRoute,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly activityService: ActivityService
	) {
		super(store, translateService);
	}

	ngOnInit(): void {
		this.activities$
			.pipe(
				debounceTime(300),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.activatedRoute.data
			.pipe(
				tap((params) => this.type = params.type),
				untilDestroyed(this)
			)
			.subscribe();
	}

	filtersChange(filters: ITimeLogFilters) {
		this.timesheetFilterService.filter = filters;
		this.filters = Object.assign({}, filters);
		this.activities$.next(true);
	}

	loadChild(item: IDailyActivity) {
		const date = moment(item.date).format('YYYY-MM-DD');
		const dateTime = toLocal(moment.utc(date + ' ' + item.time));

		const { id: organizationId } = this.organization;
		const request: IGetActivitiesInput = {
			startDate: toUTC(dateTime).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(dateTime).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
			employeeIds: [item.employeeId],
			types: [this.type === 'urls' ? ActivityType.URL : ActivityType.APP],
			titles: [item.title],
			organizationId
		};

		this.activityService.getActivities(request).then((items) => {
			item.childItems = items.map(
				(activity: IActivity): IDailyActivity => {
					const dailyActivity = {
						duration: activity.duration,
						employeeId: activity.employeeId,
						date: activity.date,
						title: activity.title,
						description: activity.description,
						durationPercentage: (activity.duration * 100) / item.duration
					}
					if (activity.metaData) {
						let metaData: IURLMetaData = new Object();
						if (typeof activity.metaData === 'string') {
							metaData = JSON.parse(activity.metaData) as IURLMetaData;
						} else if (isJsObject(activity.metaData)) {
							metaData = activity.metaData as IURLMetaData;
						}
						dailyActivity['metaData'] = metaData;
						dailyActivity['url'] = metaData.url || '';
					}
					return dailyActivity;
				}
			);
		});
	}

	getLogs() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const request: IGetActivitiesInput = {
			...this.getFilterRequest(this.filters),
			types: [this.type === 'apps' ? ActivityType.APP : ActivityType.URL]
		};

		this.loading = true;
		this.activityService
			.getDailyActivities(request)
			.then((activities) => {
				this.apps = chain(activities)
					.map((activity) => {
						activity.hours = toLocal(
							moment.utc(
								moment.utc(activity.date).format('YYYY-MM-DD') +
									' ' +
									activity.time
							)
						);
						return activity;
					})
					.groupBy('hours')
					.mapObject((value, key) => {
						value = value.slice(0, 6);
						const sum = reduce(
							value,
							(memo, activity) =>
								memo + parseInt(activity.duration + '', 10),
							0
						);
						value = value.map((activity) => {
							activity.durationPercentage = parseFloat(
								((activity.duration * 100) / sum).toFixed(1)
							);
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
