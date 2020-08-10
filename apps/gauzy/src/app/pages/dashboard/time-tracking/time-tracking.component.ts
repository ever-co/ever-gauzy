import { Component, OnDestroy, OnInit } from '@angular/core';
import { TimesheetStatisticsService } from '../../../@shared/timesheet/timesheet-statistics.service';
import { Store } from '../../../@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import {
	Organization,
	GetTimeSlotStatistics,
	GetActivitiesStatistics,
	GetProjectsStatistics,
	GetTasksStatistics,
	GetMembersStatistics
} from '@gauzy/models';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as _ from 'underscore';

@Component({
	selector: 'ga-time-tracking',
	templateUrl: './time-tracking.component.html'
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
	timeSlotEmployees = [];
	activities = [];
	projects = [];
	tasks = [];
	members = [];
	organization: Organization;
	updateLogs$: Subject<any> = new Subject();
	timeSlotLoading = true;
	activitiesLoading = true;
	projectsLoading = true;
	tasksLoading = true;
	memberLoading = true;

	constructor(
		private timesheetStatisticsService: TimesheetStatisticsService,
		private store: Store
	) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getStatistics();
			});
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});
	}

	getStatistics() {
		this.getTimeSlots();
		this.getActivities();
		this.getProjects();
		this.getTasks();
		this.getMembers();
	}

	getTimeSlots() {
		const timeSlotRequest: GetTimeSlotStatistics = {
			organizationId: this.organization.id
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
	getActivities() {
		const activityRequest: GetActivitiesStatistics = {
			organizationId: this.organization.id
		};
		this.activitiesLoading = true;
		this.timesheetStatisticsService
			.getActivities(activityRequest)
			.then((resp) => {
				const sum = _.reduce(
					resp,
					(memo, activitiy) =>
						memo + parseInt(activitiy.duration + '', 10),
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
		const projectRequest: GetProjectsStatistics = {
			organizationId: this.organization.id
		};
		this.projectsLoading = true;
		this.timesheetStatisticsService
			.getProjects(projectRequest)
			.then((resp) => {
				const sum = _.reduce(
					resp,
					(memo, project) =>
						memo + parseInt(project.duration + '', 10),
					0
				);
				this.projects = resp.map((project) => {
					project.durationPercentage = (project.duration * 100) / sum;
					return project;
				});
			})
			.finally(() => {
				this.projectsLoading = false;
			});
	}

	getTasks() {
		const taskRequest: GetTasksStatistics = {
			organizationId: this.organization.id
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

	getMembers() {
		const memberRequest: GetMembersStatistics = {
			organizationId: this.organization.id
		};
		this.memberLoading = true;
		this.timesheetStatisticsService
			.getMembers(memberRequest)
			.then((resp) => {
				this.members = resp;
			})
			.finally(() => {
				this.memberLoading = false;
			});
	}

	ngOnDestroy() {}
}
