import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
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
	IUser
} from '@gauzy/contracts';
import { combineLatest, Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import _ from 'underscore';
import { distinctUntilChange, progressStatus, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { TranslateService } from '@ngx-translate/core';
import { TimesheetStatisticsService } from '../../../@shared/timesheet/timesheet-statistics.service';
import { Store } from '../../../@core/services';
import { GalleryService } from '../../../@shared/gallery';
import { TranslationBaseComponent } from '../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-tracking',
	templateUrl: './time-tracking.component.html',
	styleUrls: ['./time-tracking.component.scss']
})
export class TimeTrackingComponent 
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {
	
	timeSlotEmployees: ITimeSlotStatistics[] = [];
	activities: IActivitiesStatistics[] = [];
	projects: IProjectsStatistics[] = [];
	tasks: ITasksStatistics[] = [];
	members: IMembersStatistics[] = [];
	manualTimes: IManualTimesStatistics[] = [];
	counts: ICountsStatistics;

	organization: IOrganization;
	logs$: Subject<any> = new Subject();

	timeSlotLoading = true;
	activitiesLoading = true;
	projectsLoading = true;
	tasksLoading = true;
	memberLoading = true;
	countsLoading = true;
	manualTimeLoading = true;

	PermissionsEnum = PermissionsEnum;
	progressStatus = progressStatus;

	startDate: Date = moment().startOf('week').toDate();
	endDate: Date = moment().endOf('week').toDate();

	employeeId: string = null;
	projectId: string = null;
	tenantId: string = null;
	organizationId: string = null;
	isAllowedMembers: boolean;

	private autoRefresh$: Subscription;
	autoRefresh: boolean = false;

	constructor(
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		private readonly store: Store,
		private readonly galleryService: GalleryService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		public readonly translateService: TranslateService,
		private readonly changeRef: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit() {
		this.ngxPermissionsService
			.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
			.then((value: boolean) => {
				this.isAllowedMembers = value;
			});
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.tenantId = user.tenantId)),
				untilDestroyed(this)
			)
			.subscribe();
		this.logs$
			.pipe(
				debounceTime(800),
				tap(() => this.getStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization, employee, project]) => {
					this.organization = organization;

					this.organizationId = organization.id;
					this.employeeId = employee ? employee.id : null;
					this.projectId = project ? project.id : null;

					this.logs$.next();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewChecked(): void {
		this.changeRef.detectChanges();
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

	setAutoRefresh(value) {
		if (value) {
			this.autoRefresh$ = timer(0, 60000)
				.pipe(
					filter((timer) => !!timer),
					tap(() => this.logs$.next()),
					untilDestroyed(this)
				)
				.subscribe();
		} else {
			if (this.autoRefresh$) {
				this.autoRefresh$.unsubscribe();
			}
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
		this.logs$.next();
	}

	getCounts() {
		const {
			tenantId,
			organizationId,
			employeeId,
			startDate,
			endDate,
			projectId
		} = this;
		const request: IGetCountsStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
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
			employeeId,
			projectId
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
