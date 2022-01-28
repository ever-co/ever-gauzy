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
	ISelectedDateRange,
	ISelectedEmployee,
	IEmployee
} from '@gauzy/contracts';
import { combineLatest, Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { indexBy, range, reduce } from 'underscore';
import { distinctUntilChange, progressStatus, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { TranslateService } from '@ngx-translate/core';
import { TimesheetStatisticsService } from '../../../@shared/timesheet/timesheet-statistics.service';
import { Store } from '../../../@core/services';
import { GalleryService } from '../../../@shared/gallery';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { Router } from '@angular/router';
import { EmployeesService } from '../../../@core/services/employees.service';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';



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
	today: Date = new Date(moment().format('YYYY-MM-DD HH:mm:ss'));

	private _selectedDateRange: ISelectedDateRange = {
		start: moment().startOf('week').toDate(),
		end: moment().endOf('week').toDate(),
		isCustomDate: false
	};
	
	get selectedDateRange(): ISelectedDateRange {
		return this._selectedDateRange;
	}
	set selectedDateRange(range: ISelectedDateRange) {
		if (range) {
			if (!range.hasOwnProperty('isCustomDate')) {
				range.isCustomDate = true
			}
			/**
			 * Check, if start date is Greater Than end date
			 */
			if (moment(range.start).isAfter(range.end)) {
				this._selectedDateRange = {
					start: range.end,
					end: range.start,
					isCustomDate: range.isCustomDate
				}
			} else {
				this._selectedDateRange = range;
			}
			if (range.start && range.end) {
				this.logs$.next(true);
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
		private readonly employeesService: EmployeesService
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

					this.logs$.next(true);
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
		const timeSlotRequest: IGetTimeSlotStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(this.selectedDateRange.start).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(this.selectedDateRange.end).format('YYYY-MM-DD HH:mm')
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
			projectId,
			selectedDateRange
		} = this;
		const request: IGetCountsStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(selectedDateRange.start).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(selectedDateRange.end).format('YYYY-MM-DD HH:mm')
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
		const { tenantId, organizationId, employeeId, projectId, selectedDateRange } = this;
		const activityRequest: IGetActivitiesStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(selectedDateRange.start).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(selectedDateRange.end).format('YYYY-MM-DD HH:mm')
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
		const { tenantId, organizationId, employeeId, projectId, selectedDateRange } = this;
		const projectRequest: IGetProjectsStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(selectedDateRange.start).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(selectedDateRange.end).format('YYYY-MM-DD HH:mm')
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
		const { tenantId, organizationId, employeeId, projectId, selectedDateRange } = this;
		const taskRequest: IGetTasksStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(selectedDateRange.start).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(selectedDateRange.end).format('YYYY-MM-DD HH:mm')
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
		const { tenantId, organizationId, employeeId, projectId, selectedDateRange } = this;
		const request: IGetManualTimesStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(selectedDateRange.start).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(selectedDateRange.end).format('YYYY-MM-DD HH:mm')
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
		const { tenantId, organizationId, employeeId, projectId, selectedDateRange } = this;
		const memberRequest: IGetMembersStatistics = {
			tenantId,
			organizationId,
			employeeId,
			projectId,
			startDate: toUTC(selectedDateRange.start).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(selectedDateRange.end).format('YYYY-MM-DD HH:mm')
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

	nextDay() {
		const startDate = moment(this.selectedDateRange.end).add(1, "week").startOf("week").toDate();
		const date = moment(startDate);
		if (date.isAfter(this.today)) {
			return;
		}
		this.selectedDateRange = {
			start: startDate,
			end: moment(startDate).endOf("week").toDate(),
			isCustomDate: false
		}
	}

	previousDay() {
		const startDate = moment(this.selectedDateRange.end).subtract(1, "week").startOf("week").toDate();
		this.selectedDateRange = {
			start: startDate,
			end: moment(startDate).endOf("week").toDate(),
			isCustomDate: false
		}
	}

	todayDate () {
		this.selectedDateRange = {
			start: this.today,
			end: this.today,
		}
	}

	/**
	 * Get selected date range period
	 */
	get selectedPeriod(): RangePeriod {
		const { start, end, isCustomDate } = this.selectedDateRange;

		const startDate = moment(start);
		const endDate = moment(end);
		const days = endDate.diff(startDate, 'days');
		
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
		const { start, end } = this.selectedDateRange;
		if (start && end) {
			return moment(end).diff(moment(start), 'weeks') > 0;
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
}
