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
	GetMembersStatistics,
	PermissionsEnum,
	GetCountsStatistics,
	CountsStatistics,
	MembersStatistics,
	ActivitiesStatistics,
	TimeSlotStatistics,
	ProjectsStatistics,
	TasksStatistics,
	GetManualTimesStatistics,
	ManualTimesStatistics
} from '@gauzy/models';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import _ from 'underscore';
import { prgressStatus } from 'libs/utils';
import * as moment from 'moment';

@Component({
	selector: 'ga-time-tracking',
	templateUrl: './time-tracking.component.html',
	styleUrls: ['./time-tracking.component.scss']
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
	timeSlotEmployees: TimeSlotStatistics[] = [];
	activities: ActivitiesStatistics[] = [];
	projects: ProjectsStatistics[] = [];
	tasks: TasksStatistics[] = [];
	members: MembersStatistics[] = [];
	manualTimes: ManualTimesStatistics[] = [];
	counts: CountsStatistics;
	organization: Organization;
	updateLogs$: Subject<any> = new Subject();
	timeSlotLoading = true;
	activitiesLoading = true;
	projectsLoading = true;
	tasksLoading = true;
	memberLoading = true;
	countsLoading = true;
	manualTimeLoading = true;

	PermissionsEnum = PermissionsEnum;
	prgressStatus = prgressStatus;
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
		this.getCounts();
		this.getTimeSlots();
		this.getActivities();
		this.getProjects();
		this.getTasks();
		this.getMembers();
		this.getManualTimes();
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

	onDelete() {
		this.getTimeSlots();
	}

	getCounts() {
		const request: GetCountsStatistics = {
			organizationId: this.organization.id
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
				this.projects = resp;
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

	getManualTimes() {
		const request: GetManualTimesStatistics = {
			organizationId: this.organization.id
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
		const memberRequest: GetMembersStatistics = {
			organizationId: this.organization.id
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
