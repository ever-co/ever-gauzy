import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, filter } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { chain, reduce } from 'underscore';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import {
	ITimeLogFilters,
	IGetActivitiesInput,
	ActivityType,
	IDailyActivity,
	IActivity,
	IURLMetaData
} from '@gauzy/contracts';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { toUTC, toLocal, isJsObject, isEmpty, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { Store } from './../../../../../@core/services';
import { ActivityService, TimesheetFilterService } from './../../../../../@shared/timesheet';
import { BaseSelectorFilterComponent } from './../../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { GauzyFiltersComponent } from './../../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-app-url-activity',
	styleUrls: ['./app-url-activity.component.scss'],
	templateUrl: './app-url-activity.component.html'
})
export class AppUrlActivityComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	filters: ITimeLogFilters = this.request;
	loading: boolean;
	apps: {
		hour: string;
		activities: IDailyActivity[];
	}[];
	type: 'apps' | 'urls';

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		private readonly activatedRoute: ActivatedRoute,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly activityService: ActivityService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
	}

	ngOnInit(): void {
		this.activatedRoute.data
			.pipe(
				tap((params) => (this.type = params.type)),
				untilDestroyed(this)
			)
			.subscribe();
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getAppUrlActivityLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Prepare Unique Request Always
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const request: IGetActivitiesInput = {
			...this.filters,
			...this.getFilterRequest(this.request),
			types: [this.type === 'apps' ? ActivityType.APP : ActivityType.URL]
		};
		this.payloads$.next(request);
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
			item.childItems = items.map((activity: IActivity): IDailyActivity => {
				const dailyActivity = {
					duration: activity.duration,
					employeeId: activity.employeeId,
					date: activity.date,
					title: activity.title,
					description: activity.description,
					durationPercentage: (activity.duration * 100) / item.duration
				};
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
			});
		});
	}

	/**
	 * Get APP & URL's activity logs
	 *
	 * @returns
	 */
	getAppUrlActivityLogs() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const payloads = this.payloads$.getValue();

		this.loading = true;
		this.activityService
			.getDailyActivities(payloads)
			.then((activities) => {
				this.apps = chain(activities)
					.map((activity) => {
						activity.hours = toLocal(
							moment.utc(moment.utc(activity.date).format('YYYY-MM-DD') + ' ' + activity.time)
						);
						return activity;
					})
					.groupBy('hours')
					.mapObject((value, key) => {
						value = value.slice(0, 6);
						const sum = reduce(value, (memo, activity) => memo + parseInt(activity.duration + '', 10), 0);
						value = value.map((activity) => {
							activity.durationPercentage = parseFloat(((activity.duration * 100) / sum).toFixed(1));
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
