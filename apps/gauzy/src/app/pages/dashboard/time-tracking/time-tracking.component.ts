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
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import _ from 'underscore';
import { progressStatus, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import { GalleryService } from '../../../@shared/gallery/gallery.service';
import { NgxPermissionsService } from 'ngx-permissions';

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
	employeeId: string = null;
	projectId: string = null;
	tenantId: string;
	organizationId: string;
	isAllowedMembers: boolean;

	constructor(
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		private readonly store: Store,
		private readonly galleryService: GalleryService,
		private readonly ngxPermissionsService: NgxPermissionsService
	) {
		this.startDate = moment().startOf('week').toDate();
		this.endDate = moment().endOf('week').toDate();
	}

	ngOnInit() {
		this.ngxPermissionsService
			.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
			.then((value: boolean) => {
				this.isAllowedMembers = value;
			});
		this.updateLogs$
			.pipe(
				debounceTime(800),
				tap(() => this.getStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeProject$ = this.store.selectedProject$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		combineLatest([storeProject$, storeEmployee$, storeOrganization$])
			.pipe(
				tap(([project, employee, organization]) => {
					if (organization) {
						this.organization = organization;
						this.organizationId = organization.id;
						this.tenantId = this.store.user.tenantId;
						if (employee) {
							this.employeeId = employee.id;
						}
						if (project) {
							this.projectId = project.id || null;
						}
						this.updateLogs$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getStatistics() {
		this.getCounts();
		this.getTimeSlots();
		this.getActivities();
		this.getProjects();
		this.getTasks();
		this.getManualTimes();

		if (this.isAllowedMembers) {
			this.getMembers();
		}
	}

	getTimeSlots() {
		const { tenantId, organizationId, employeeId, projectId } = this;
		const timeSlotRequest: IGetTimeSlotStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId
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
		this.updateLogs$.next();
	}

	getCounts() {
		const {
			tenantId,
			organizationId,
			employeeId,
			startDate,
			endDate
		} = this;
		const request: IGetCountsStatistics = {
			tenantId,
			organizationId,
			employeeId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
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
		const { tenantId, organizationId, employeeId, projectId } = this;
		const activityRequest: IGetActivitiesStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId
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
		const { tenantId, organizationId, employeeId, projectId } = this;
		const projectRequest: IGetProjectsStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId
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
		const { tenantId, organizationId, employeeId, projectId } = this;
		const taskRequest: IGetTasksStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId
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
		const { tenantId, organizationId, employeeId, projectId } = this;
		const request: IGetManualTimesStatistics = {
			tenantId,
			organizationId,
			employeeId
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
		const { tenantId, organizationId, employeeId, projectId } = this;
		const memberRequest: IGetMembersStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId
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

	ngOnDestroy() {
		this.galleryService.clearGallery();
	}
}
