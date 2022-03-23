import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { chain, reduce } from 'underscore';
import * as moment from 'moment';
import {
	IOrganization,
	ITimeLogFilters,
	IGetActivitiesInput,
	ActivityType,
	IDailyActivity,
	IActivity,
	IURLMetaData
} from '@gauzy/contracts';
import { toUTC, toLocal, distinctUntilChange } from '@gauzy/common-angular';
import { Store } from './../../../../../@core/services';
import { ActivityService, TimesheetFilterService } from './../../../../../@shared/timesheet';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-app-url-activity',
	styleUrls: ['./app-url-activity.component.scss'],
	templateUrl: './app-url-activity.component.html'
})
export class AppUrlActivityComponent implements OnInit, OnDestroy {
	loading: boolean;
	apps: {
		hour: string;
		activities: IDailyActivity[];
	}[];
	request: any;
	activities$: Subject<any> = new Subject();
	organization: IOrganization;
	type: 'apps' | 'urls';
	selectedEmployeeId: string | null = null;
	projectId: string | null = null;

	constructor(
		private readonly store: Store,
		private readonly activatedRoute: ActivatedRoute,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly activityService: ActivityService
	) {}

	ngOnInit(): void {
		this.activities$
			.pipe(
				debounceTime(100),
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
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				filter(([organization, employee]) => !!organization && !!employee),
				distinctUntilChange(),
				tap(([organization, employee, project]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
					this.projectId = project ? project.id : null;
					this.activities$.next(true);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async filtersChange($event: ITimeLogFilters) {
		this.request = $event;
		this.timesheetFilterService.filter = $event;
		this.activities$.next(true);
	}

	loadChild(item: IDailyActivity) {
		const dateTime = toLocal(moment.utc(item.date + ' ' + item.time));
		const request: IGetActivitiesInput = {
			startDate: toUTC(dateTime).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(dateTime).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
			employeeIds: [item.employeeId],
			types: [this.type === 'urls' ? ActivityType.URL : ActivityType.APP],
			titles: [item.title]
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
					if (activity.metaData && typeof activity.metaData === 'string') {
						const metaData = JSON.parse(activity.metaData) as IURLMetaData;
						dailyActivity['metaData'] = metaData;
						dailyActivity['url'] = metaData.url || '';
					}
					return dailyActivity;
				}
			);
		});
	}

	async getLogs() {
		if (!this.organization || !this.request) {
			return;
		}

		const { startDate, endDate } = this.request;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const projectIds: string[] = [];
		if (this.projectId) {
			projectIds.push(this.projectId);
		}

		const request: IGetActivitiesInput = {
			organizationId,
			tenantId,
			...this.request,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeIds.length > 0 ? { employeeIds } : {}),
			...(projectIds.length > 0 ? { projectIds } : {}),
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
