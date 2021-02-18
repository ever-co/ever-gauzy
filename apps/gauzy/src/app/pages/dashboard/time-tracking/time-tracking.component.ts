import { Component, OnDestroy, OnInit } from '@angular/core';
import { TimesheetStatisticsService } from '../../../@shared/timesheet/timesheet-statistics.service';
import { Store } from '../../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IOrganization,
	IGetTimeSlotStatistics,
	IGetActivitiesStatistics,
	IGetProjectsStatistics,
	IGetTasksStatistics,
	IGetMembersStatistics,
	PermissionsEnum,
	IGetCountsStatistics,
	ICountsStatistics,
	IMembersStatistics,
	IActivitiesStatistics,
	ITimeSlotStatistics,
	IProjectsStatistics,
	ITasksStatistics,
	IGetManualTimesStatistics,
	IManualTimesStatistics
} from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import _ from 'underscore';
import { progressStatus } from '@gauzy/common-angular';
import * as moment from 'moment';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-tracking',
	templateUrl: './time-tracking.component.html',
	styleUrls: ['./time-tracking.component.scss']
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
	timeSlotEmployees: ITimeSlotStatistics[] = [];
	activities: IActivitiesStatistics[] = [];
	projects: IProjectsStatistics[] = [];
	tasks: ITasksStatistics[] = [];
	members: IMembersStatistics[] = [];
	manualTimes: IManualTimesStatistics[] = [];
	counts: ICountsStatistics;
	organization: IOrganization;
	updateLogs$: Subject<any> = new Subject();
	timeSlotLoading = true;
	activitiesLoading = true;
	projectsLoading = true;
	tasksLoading = true;
	memberLoading = true;
	countsLoading = true;
	manualTimeLoading = true;

	PermissionsEnum = PermissionsEnum;
	progressStatus = progressStatus;
	startDate: Date;
	endDate: Date;

	constructor(
		private timesheetStatisticsService: TimesheetStatisticsService,
		private store: Store
	) {
		this.startDate = moment().startOf('week').toDate();
		this.endDate = moment().endOf('week').toDate();
	}

	ngOnInit() {
		this.updateLogs$.pipe(untilDestroyed(this)).subscribe(() => {
			this.getStatistics();
		});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});
	}

	getStatistics() {
		this.getCounts();
		this.getTimeSlots();
		this.getActivities();
		this.getProjects();
		this.getTasks();
		this.getMembers();
		this.getManualTimes();
	}

	getTimeSlots() {
		const timeSlotRequest: IGetTimeSlotStatistics = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		};

		this.timeSlotLoading = true;
		this.timesheetStatisticsService
			.getTimeSlots(timeSlotRequest)
			.then((resp) => {
				this.timeSlotEmployees = resp;
			})
			.finally(() => {
				this.timeSlotLoading = false;
			});
	}

	onDelete() {
		this.getTimeSlots();
	}

	getCounts() {
		const request: IGetCountsStatistics = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		};
		this.countsLoading = true;
		this.timesheetStatisticsService
			.getCounts(request)
			.then((resp) => {
				this.counts = resp;
			})
			.finally(() => {
				this.countsLoading = false;
			});
	}

	getActivities() {
		const activityRequest: IGetActivitiesStatistics = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		};
		this.activitiesLoading = true;
		this.timesheetStatisticsService
			.getActivities(activityRequest)
			.then((resp) => {
				const sum = _.reduce(
					resp,
					(memo, activity) =>
						memo + parseInt(activity.duration + '', 10),
					0
				);
				this.activities = resp.map((activity) => {
					activity.durationPercentage =
						(activity.duration * 100) / sum;
					return activity;
				});
			})
			.finally(() => {
				this.activitiesLoading = false;
			});
	}
	getProjects() {
		const projectRequest: IGetProjectsStatistics = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		};
		this.projectsLoading = true;
		this.timesheetStatisticsService
			.getProjects(projectRequest)
			.then((resp) => {
				this.projects = resp;
			})
			.finally(() => {
				this.projectsLoading = false;
			});
	}

	getTasks() {
		const taskRequest: IGetTasksStatistics = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		};
		this.tasksLoading = true;
		this.timesheetStatisticsService
			.getTasks(taskRequest)
			.then((resp) => {
				this.tasks = resp;
			})
			.finally(() => {
				this.tasksLoading = false;
			});
	}

	getManualTimes() {
		const request: IGetManualTimesStatistics = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		};
		this.manualTimeLoading = true;
		this.timesheetStatisticsService
			.getManualTimes(request)
			.then((resp) => {
				this.manualTimes = resp;
			})
			.finally(() => {
				this.manualTimeLoading = false;
			});
	}

	getMembers() {
		const memberRequest: IGetMembersStatistics = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		};
		this.memberLoading = true;
		this.timesheetStatisticsService
			.getMembers(memberRequest)
			.then((resp: any) => {
				this.members = resp.map((member) => {
					const week: any = _.indexBy(member.weekHours, 'day');

					const sum = _.reduce(
						member.weekHours,
						(memo, day: any) =>
							memo + parseInt(day.duration + '', 10),
						0
					);
					member.weekHours = _.range(0, 7).map((day) => {
						if (week[day]) {
							week[day].duration =
								(week[day].duration * 100) / sum;
							return week[day];
						} else {
							return { day, duration: 0 };
						}
					});

					return member;
				});
			})
			.finally(() => {
				this.memberLoading = false;
			});
	}

	getMembChartData(member) {}

	ngOnDestroy() {}
}
