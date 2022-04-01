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
	IUser,
	ISelectedEmployee,
	IEmployee,
	IDateRangePicker
} from '@gauzy/contracts';
import { combineLatest, Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { indexBy, range, reduce } from 'underscore';
import { distinctUntilChange, progressStatus, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { TranslateService } from '@ngx-translate/core';
import { TimesheetStatisticsService } from '../../../@shared/timesheet/timesheet-statistics.service';
import { EmployeesService, Store } from '../../../@core/services';
import { GalleryService } from '../../../@shared/gallery';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { Router } from '@angular/router';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';

export enum RangePeriod {
	DAY = "DAY",
	WEEK = "WEEK",
	PERIOD = "PERIOD"
}

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
	employeesCount: number;
	projectCount: number;

	public organization: IOrganization;
	logs$: Subject<any> = new Subject();

	timeSlotLoading = false;
	activitiesLoading = false;
	projectsLoading = false;
	tasksLoading = false;
	memberLoading = false;
	countsLoading = false;
	manualTimeLoading = false;

	progressStatus = progressStatus;
	public readonly PermissionsEnum = PermissionsEnum;
	public readonly RangePeriod = RangePeriod;

	employeeId: string = null;
	projectId: string = null;
	tenantId: string = null;
	organizationId: string = null;

	private autoRefresh$: Subscription;
	autoRefresh: boolean = true;

	private _selectedDateRange: IDateRangePicker = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate(),
		isCustomDate: false
	};
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	set selectedDateRange(range: IDateRangePicker) {
		if (range) {
			if (!range.hasOwnProperty('isCustomDate')) {
				range.isCustomDate = true
			}
			/**
			 * Check, if start date is Greater Than end date
			 */
			if (moment(range.startDate).isAfter(range.endDate)) {
				this._selectedDateRange = {
					startDate: range.endDate,
					endDate: range.startDate,
					isCustomDate: range.isCustomDate
				}
			} else {
				this._selectedDateRange = range;
			}
		}
	}

	constructor(
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		private readonly store: Store,
		private readonly galleryService: GalleryService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		public readonly translateService: TranslateService,
		private readonly changeRef: ChangeDetectorRef,
		private readonly _router: Router,
		private readonly employeesService: EmployeesService,
    	private readonly projectService: OrganizationProjectsService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				distinctUntilChange(),
				tap((user: IUser) => (this.tenantId = user.tenantId)),
				untilDestroyed(this)
			)
			.subscribe();
		this.logs$
			.pipe(
				debounceTime(500),
				tap(() => this.galleryService.clearGallery()),
				tap(() => this.getStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		const selectedDateRange$ = this.store.selectedDateRange$;

		combineLatest([storeOrganization$, storeEmployee$, storeProject$, selectedDateRange$])
			.pipe(
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				debounceTime(300),
				tap(([organization, employee, project, dateRange]) => {
					this.organization = organization;

					this.organizationId = organization.id;
					this.employeeId = employee ? employee.id : null;
					this.projectId = project ? project.id : null;
					this.selectedDateRange = dateRange;

					this.logs$.next(true);
				}),
				tap(() => {
					this.loadEmployeesCount();
					this.loadProjectsCount();
				}),
				tap(() => this.setAutoRefresh(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewChecked(): void {
		this.changeRef.detectChanges();
	}

	getStatistics() {
		if (!this.organization) {
			return;
		}
		this.getCounts();
		this.getTimeSlots();
		this.getActivities();
		this.getProjects();
		this.getTasks();
		this.getManualTimes();
		this.getMembers();
	}

	setAutoRefresh(value: boolean) {
		if (this.autoRefresh$) {
			this.autoRefresh$.unsubscribe();
		}
		if (value) {
			this.autoRefresh$ = timer(0, 60000 * 2)
				.pipe(
					filter((timer) => !!timer),
					tap(() => this.logs$.next(true)),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	getTimeSlots() {
		const {
			tenantId,
			organizationId,
			employeeId,
			projectId
		} = this;
		const { startDate, endDate } = this.getAdjustDateRangeFutureAllowed();
		const timeSlotRequest: IGetTimeSlotStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
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
		this.logs$.next(true);
	}

	getCounts() {
		const {
			tenantId,
			organizationId,
			employeeId,
			projectId
		} = this;
		const { startDate, endDate } = this.getAdjustDateRangeFutureAllowed();
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
		const {
			tenantId,
			organizationId,
			employeeId,
			projectId
		} = this;
		const { startDate, endDate } = this.getAdjustDateRangeFutureAllowed();
		const activityRequest: IGetActivitiesStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
		};
		this.activitiesLoading = true;
		this.timesheetStatisticsService
			.getActivities(activityRequest)
			.then((resp) => {
				const sum = reduce(
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
		const {
			tenantId,
			organizationId,
			employeeId,
			projectId
		} = this;
		const { startDate, endDate } = this.getAdjustDateRangeFutureAllowed();
		const projectRequest: IGetProjectsStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
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
		const {
			tenantId,
			organizationId,
			employeeId,
			projectId
		} = this;
		const { startDate, endDate } = this.getAdjustDateRangeFutureAllowed();
		const taskRequest: IGetTasksStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
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
		const {
			tenantId,
			organizationId,
			employeeId,
			projectId
		} = this;
		const { startDate, endDate } = this.getAdjustDateRangeFutureAllowed();
		const request: IGetManualTimesStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
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

	async getMembers() {
		if (!await this.ngxPermissionsService.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
		) {
			return;
		}
		const {
			tenantId,
			organizationId,
			employeeId,
			projectId
		} = this;
		const { startDate, endDate } = this.getAdjustDateRangeFutureAllowed();
		const memberRequest: IGetMembersStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
		};
		this.memberLoading = true;
		this.timesheetStatisticsService
			.getMembers(memberRequest)
			.then((resp: any) => {
				this.members = resp.map((member) => {
					const week: any = indexBy(member.weekHours, 'day');

					const sum = reduce(
						member.weekHours,
						(memo, day: any) =>
							memo + parseInt(day.duration + '', 10),
						0
					);
					member.weekHours = range(0, 7).map((day) => {
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

	ngOnDestroy() {
		this.galleryService.clearGallery();
	}

	get period() {
		const { startDate, endDate } = this.selectedDateRange;
		if (startDate && endDate) {
			const start = moment(startDate);
			const end = moment(endDate);
			return end.diff(start, 'days') * 86400;
		}
	}

	/**
	 * Get selected date range period
	 */
	get selectedPeriod(): RangePeriod {
		const { startDate, endDate, isCustomDate } = this.selectedDateRange;

		const start = moment(startDate);
		const end = moment(endDate);
		const days = end.diff(start, 'days');

		if (days === 6 && isCustomDate === false) {
			return RangePeriod.WEEK;
		} else if (days === 0 && isCustomDate === true) {
			return RangePeriod.DAY;
		} else {
			return RangePeriod.PERIOD
		}
	}

	/**
	 * If, selected date range are more than a week
	 */
	isMoreThanWeek(): boolean {
		const { startDate, endDate } = this.selectedDateRange as IDateRangePicker;
		if (startDate && endDate) {
			return moment(endDate).diff(moment(startDate), 'weeks') > 0;
		}
		return false;
	}

	/**
	 * Redirect to screenshots page for specific employee
	 *
	 * @param employee
	 */
	async redirectToScreenshots(employee: IEmployee) {
		if (!employee.id) {
			return;
		}
		try {
			const people  = await this.employeesService.getEmployeeById(
				employee.id,
				['user']
			);
			this.store.selectedEmployee = (employee.id) ? {
				id: people.id,
				firstName: people.user.firstName,
				lastName: people.user.lastName,
				imageUrl: people.user.imageUrl,
				employeeLevel: people.employeeLevel,
				fullName: people.user.name,
				shortDescription: people.short_description
			} as ISelectedEmployee : ALL_EMPLOYEES_SELECTED;
			if (this.store.selectedEmployee) {
				this._router.navigate([`/pages/employees/activity/screenshots`]);
			}
		} catch (error) {
			console.log('Error while redirecting screenshots page.', error);
		}
	}

	/**
	 * Redirect to Task dashboard page
	 */
	public redirectToTask() {
		try {
			this._router.navigate(['pages/tasks/dashboard']);
		} catch (error) {
			console.log('Error while redirecting to tasks page.', error);
		}
	}

	/**
	 * Redirect to Manual Time Report
	 */
	public redirectToManualTimeReport() {
		try {
			const { startDate, endDate } = this.selectedDateRange as IDateRangePicker;
			this._router.navigate(['/pages/reports/manual-time-edits'], {
				queryParams: {
					start: moment(startDate).format("MM-DD-YYYY"),
					end: moment(endDate).format("MM-DD-YYYY")
				}
			});
		} catch (error) {
			console.log('Error while redirecting to manual time report.', error);
		}
	}

	/**
	 * Redirect to App & URL Activity Report
	 */
	public redirectToAppUrlReport() {
		try {
			const { startDate, endDate } = this.selectedDateRange as IDateRangePicker;
			this._router.navigate(['/pages/reports/apps-urls'], {
				queryParams: {
					start: moment(startDate).format("MM-DD-YYYY"),
					end: moment(endDate).format("MM-DD-YYYY")
				}
			});
		} catch (error) {
			console.log('Error while redirecting to apps & urls report.', error);
		}
	}

	/**
	 * We are having issue, when organization not allowed future date
	 * When someone run timer for today, all statistic not displaying correctly
	 *
	 * @returns
	 */
	private getAdjustDateRangeFutureAllowed(): IDateRangePicker {
		const { selectedDateRange } = this;
		const now = moment();

		let { startDate, endDate } = selectedDateRange;
		/**
		 * If, user selected single day date range.
		 */
		if (
			moment(moment(startDate).format('YYYY-MM-DD')).isSame(
				moment(endDate).format('YYYY-MM-DD')
			)
		) {
			startDate = moment(startDate).startOf('day').utc().toDate();
			endDate = moment(endDate).endOf('day').utc().toDate();
		}

		/**
		 * If, user selected TODAY date range.
		 */
		if (
			moment(now.format('YYYY-MM-DD')).isSame(
				moment(endDate).format('YYYY-MM-DD')
			)
		) {
			endDate = moment.utc().toDate();
		}
		return {
			startDate,
			endDate
		}
	}

  	private async loadEmployeesCount() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.employeesCount = await this.employeesService.getCount([], {
			organizationId,
			tenantId
		});
	}

  	private async loadProjectsCount() {
    	const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.projectCount = await this.projectService.getCount([],{
			organizationId,
			tenantId
		});
	}
}
