import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, filter } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { chain, reduce } from 'underscore';
import moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import {
	ITimeLogFilters,
	IGetActivitiesInput,
	ActivityType,
	IDailyActivity,
	IActivity,
	IURLMetaData
} from '@gauzy/contracts';
import { ActivityService, DateRangePickerBuilderService, TimesheetFilterService } from '@gauzy/ui-sdk/core';
import { Store, distinctUntilChange, isEmpty, isJsObject, toLocal, toUTC } from '@gauzy/ui-sdk/common';
import { BaseSelectorFilterComponent, GauzyFiltersComponent, TimeZoneService } from '@gauzy/ui-sdk/shared';

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
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
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

	/**
	 * Handles changes to the filters.
	 *
	 * @param filters The new filters to apply.
	 */
	filtersChange(filters: ITimeLogFilters): void {
		// Save filters if saveFilters is true
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}

		// Update the current filters with a new copy of the filters object
		this.filters = Object.assign({}, filters);

		// Notify subscribers about the filter change
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

	/**
	 * Load child activities for the given item.
	 *
	 * @param item The daily activity item to load child activities for.
	 */
	async loadChild(item: IDailyActivity) {
		const date = moment(item.date).format('YYYY-MM-DD');
		const dateTime = toLocal(moment.utc(date + ' ' + item.time));

		try {
			const request: IGetActivitiesInput = {
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId,
				startDate: toUTC(dateTime).format('YYYY-MM-DD HH:mm:ss'),
				endDate: toUTC(dateTime).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
				employeeIds: [item.employeeId],
				types: [this.type === 'urls' ? ActivityType.URL : ActivityType.APP],
				titles: [item.title]
			};

			const activities = await this.activityService.getActivities(request);
			item.childItems = activities.map((activity) => this.createDailyActivity(activity, item.duration));
		} catch (error) {
			console.error('Error loading child activities:', error);
		}
	}

	/**
	 * Creates a daily activity object from the given activity data.
	 *
	 * @param activity The activity data.
	 * @param parentDuration The duration of the parent activity.
	 * @returns The daily activity object.
	 */
	private createDailyActivity(activity: IActivity, parentDuration: number): IDailyActivity {
		const dailyActivity: IDailyActivity = {
			duration: activity.duration,
			employeeId: activity.employeeId,
			date: activity.date,
			title: activity.title,
			description: activity.description,
			durationPercentage: (activity.duration * 100) / parentDuration
		};

		if (activity.metaData) {
			let metaData: IURLMetaData = {};

			if (typeof activity.metaData === 'string') {
				metaData = JSON.parse(activity.metaData) as IURLMetaData;
			} else if (isJsObject(activity.metaData)) {
				metaData = activity.metaData as IURLMetaData;
			}

			dailyActivity.metaData = metaData;
			dailyActivity.url = metaData.url || '';
		}

		return dailyActivity;
	}

	/**
	 * Get APP & URL's activity logs
	 *
	 * @returns void
	 */
	async getAppUrlActivityLogs(): Promise<void> {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		this.loading = true;

		try {
			const payloads = this.payloads$.getValue();
			const activities = await this.activityService.getDailyActivities(payloads);
			this.apps = chain(activities)
				.map((activity) => {
					activity.hours = toLocal(
						moment.utc(moment.utc(activity.date).format('YYYY-MM-DD') + ' ' + activity.time)
					);
					return activity;
				})
				.groupBy('hours')
				.map((activities, hour) => this.calculateActivityDurations(activities, hour))
				.values()
				.value();
		} catch (error) {
			console.error('Failed to get daily activities:', error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Calculate the duration percentages for activities and group them by hour.
	 *
	 * @param activities The list of activities for a specific hour.
	 * @param hour The hour to group activities by.
	 * @returns An object containing the hour and its activities with duration percentages.
	 */
	private calculateActivityDurations(activities: any[], hour: string): { hour: string; activities: any[] } {
		const limitedActivities = activities.slice(0, 6);
		const totalDuration = reduce(limitedActivities, (sum, activity) => sum + parseInt(activity.duration, 10), 0);

		const activitiesWithDurations = limitedActivities.map((activity) => {
			activity.durationPercentage = parseFloat(((activity.duration * 100) / totalDuration).toFixed(1));
			return activity;
		});

		return { hour, activities: activitiesWithDurations };
	}

	ngOnDestroy(): void {}
}
