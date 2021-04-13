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
	IManualTimesStatistics,
	ISelectedEmployee
} from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap, withLatestFrom } from 'rxjs/operators';
import _ from 'underscore';
import { progressStatus } from '@gauzy/common-angular';
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
	employeeId = null;
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
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		storeEmployee$
			.pipe(
				filter((employee: ISelectedEmployee) => !!employee),
				debounceTime(200),
				withLatestFrom(storeOrganization$),
				untilDestroyed(this)
			)
			.subscribe(([employee]) => {
				if (employee && this.organization) {
					this.employeeId = employee.id;
					this.updateLogs$.next();
				}
			});
		storeOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				debounceTime(200),
				withLatestFrom(storeEmployee$),
				untilDestroyed(this)
			)
			.subscribe(([organization, employee]) => {
				this.employeeId = employee ? employee.id : null;
				if (organization) {
					this.organization = organization;
					this.tenantId = this.store.user.tenantId;
					this.organizationId = organization.id;
					this.updateLogs$.next();
				}
			});
		this.updateLogs$
			.pipe(
				debounceTime(200),
				tap(() => this.getStatistics()),
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
		const { tenantId, organizationId, employeeId } = this;
		const timeSlotRequest: IGetTimeSlotStatistics = {
			tenantId,
			organizationId,
			employeeId
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
		const { tenantId, organizationId, employeeId } = this;
		const request: IGetCountsStatistics = {
			tenantId,
			organizationId,
			employeeId
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
		const { tenantId, organizationId, employeeId } = this;
		const activityRequest: IGetActivitiesStatistics = {
			tenantId,
			organizationId,
			employeeId
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
		const { tenantId, organizationId, employeeId } = this;
		const projectRequest: IGetProjectsStatistics = {
			tenantId,
			organizationId,
			employeeId
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
		const { tenantId, organizationId, employeeId } = this;
		const taskRequest: IGetTasksStatistics = {
			tenantId,
			organizationId,
			employeeId
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
		const { tenantId, organizationId, employeeId } = this;
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
		const { tenantId, organizationId, employeeId } = this;
		const memberRequest: IGetMembersStatistics = {
			tenantId,
			organizationId,
			employeeId
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
