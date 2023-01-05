import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit,
	QueryList,
	TemplateRef,
	ViewChildren
} from '@angular/core';
import { Router } from '@angular/router';
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
	ISelectedEmployee,
	IEmployee,
	IDateRangePicker,
	ITimeLogFilters,
	IUser
} from '@gauzy/contracts';
import { BehaviorSubject, combineLatest, firstValueFrom, of, Subject, Subscription, switchMap, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { indexBy, range, reduce } from 'underscore';
import {
	distinctUntilChange,
	isNotEmpty,
	progressStatus,
	toUTC
} from '@gauzy/common-angular';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { TranslateService } from '@ngx-translate/core';
import { SwiperComponent } from "swiper/angular";
// import Swiper core and required modules
import SwiperCore, { Virtual, Pagination, Navigation } from "swiper";
import { TimesheetStatisticsService } from '../../../@shared/timesheet/timesheet-statistics.service';
import {
	DateRangePickerBuilderService,
	EmployeesService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '../../../@core/services';
import { GalleryService } from '../../../@shared/gallery';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';
import { getAdjustDateRangeFutureAllowed } from '../../../@theme/components/header/selectors/date-range-picker';
import { NbPopoverDirective } from '@nebular/theme';
import { WidgetService } from '../../../@shared/dashboard/widget/widget.service';
import { GuiDrag } from '../../../@shared/dashboard/interfaces/gui-drag.abstract';
import { WindowService } from '../../../@shared/dashboard/window/window.service';

// install Swiper modules
SwiperCore.use([Pagination, Navigation, Virtual]);

export enum RangePeriod {
	DAY = 'DAY',
	WEEK = 'WEEK',
	PERIOD = 'PERIOD'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-tracking-dashboard',
	templateUrl: './time-tracking.component.html',
	styleUrls: ['./time-tracking.component.scss']
})
export class TimeTrackingComponent extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	user: IUser;
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

	employeeIds: string[] = [];
	projectIds: string[] = [];

	private autoRefresh$: Subscription;
	autoRefresh: boolean = true;

	private _selectedDateRange: IDateRangePicker;
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	set selectedDateRange(range: IDateRangePicker) {
		if (isNotEmpty(range)) {
			this._selectedDateRange = range;
		}
	}

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	@ViewChildren('widget') listOfWidgets: QueryList<TemplateRef<HTMLElement>>;
	@ViewChildren('window') listOfWindows: QueryList<TemplateRef<HTMLElement>>;
	public widgetsRef: TemplateRef<HTMLElement>[] = [];
	public windowsRef: TemplateRef<HTMLElement>[] = [];
	@ViewChildren(NbPopoverDirective)
	public popups: QueryList<NbPopoverDirective>;
	public widgets: GuiDrag[];
	public windows: GuiDrag[];

	constructor(
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly galleryService: GalleryService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		public readonly translateService: TranslateService,
		private readonly changeRef: ChangeDetectorRef,
		private readonly _router: Router,
		private readonly employeesService: EmployeesService,
    	private readonly projectService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		private readonly widgetService: WidgetService,
		private readonly windowService: WindowService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
		this.logs$
			.pipe(
				debounceTime(200),
				tap(() => this.galleryService.clearGallery()),
				tap(() => this.getStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.logs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;

		combineLatest([storeOrganization$, selectedDateRange$, storeEmployee$, storeProject$])
			.pipe(
				distinctUntilChange(),
				debounceTime(500),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				switchMap(([organization, dateRange, employee, project]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					return combineLatest([of(employee), of(project)]);
				}),
				filter(([employee]) => !!employee),
				tap(([employee, project]) => {
					this.employeeIds = employee ? [employee.id] : [];
					this.projectIds = project ? [project.id] : [];
					this.widgetService.widgets.forEach((widget: GuiDrag) => {
						if (widget.position === 0 && this.employeeIds[0]) {
							widget.hide = true;
						}
						if (widget.position === 1 && this.projectIds[0]) {
							widget.hide = true;
						}
					});
					this.windowService.windows.forEach((windows: GuiDrag) => {
						if (windows.position === 5 && this.employeeIds[0]) {
							windows.hide = true;
						}
					});
					this.widgetService.save();
					this.windowService.save();
				}),
				tap(() => this.preparePayloads()),
				tap(() => {
					this.loadEmployeesCount();
					this.loadProjectsCount();
				}),
				tap(() => this.setAutoRefresh(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.widgetsRef = this.listOfWidgets.toArray();
		this.windowsRef = this.listOfWindows.toArray();
	}

	ngAfterViewChecked(): void {
		this.widgets = this.widgetService.widgets;
		this.windows = this.windowService.windows;
		this.changeRef.detectChanges();
	}

	async getStatistics() {
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

	/**
	 * Prepare Unique Payloads
	 *
	 * @returns
	 */
	preparePayloads() {
		if (!this.organization) {
			return;
		}
		const {
			employeeIds,
			projectIds,
			selectedDateRange
		} = this;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(selectedDateRange);

		const request: ITimeLogFilters = {
			tenantId,
			organizationId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
		};

		if (isNotEmpty(employeeIds)) { request['employeeIds'] = employeeIds; }
		if (isNotEmpty(projectIds)) { request['projectIds'] = projectIds; }

		this.payloads$.next(request);
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

	async getTimeSlots() {
		const request: IGetTimeSlotStatistics = this.payloads$.getValue();
		try {
			this.timeSlotLoading = true;
			this.timeSlotEmployees = await this.timesheetStatisticsService.getTimeSlots(request);
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.timeSlotLoading = false;
		}
	}

	async getCounts() {
		const request: IGetCountsStatistics = this.payloads$.getValue();
		try {
			this.countsLoading = true;
			this.counts = await this.timesheetStatisticsService.getCounts(request);
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.countsLoading = false;
		}
	}

	async getActivities() {
		const request: IGetActivitiesStatistics = this.payloads$.getValue();
		try {
			this.activitiesLoading = true;
			const activities = await this.timesheetStatisticsService.getActivities(request);
			const sum = reduce(
				activities,
				(memo, activity) =>
					memo + parseInt(activity.duration + '', 10),
				0
			);
			this.activities = activities.map((activity) => {
				activity.durationPercentage = (activity.duration * 100) / sum;
				return activity;
			});
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.activitiesLoading = false;
		}
	}

	async getProjects() {
		const request: IGetProjectsStatistics = this.payloads$.getValue();
		try {
			this.projectsLoading = true;
			this.projects = await this.timesheetStatisticsService.getProjects(request);
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.projectsLoading = false;
		}
	}

	async getTasks() {
		const request: IGetTasksStatistics = this.payloads$.getValue();
		const take = 5;
		try {
			this.tasksLoading = true;
			this.tasks = await this.timesheetStatisticsService.getTasks({
				...request,
				take
			});
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.tasksLoading = false;
		}
	}

	async getManualTimes() {
		const request: IGetManualTimesStatistics = this.payloads$.getValue();
		try {
			this.manualTimeLoading = true;
			this.manualTimes = await this.timesheetStatisticsService.getManualTimes(request);
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.manualTimeLoading = false;
		}
	}

	async getMembers() {
		if (!await this.ngxPermissionsService.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
		) {
			return;
		}
		const request: IGetMembersStatistics = this.payloads$.getValue();
		try {
			this.memberLoading = true;
			const members = await this.timesheetStatisticsService.getMembers(request);

			this.members = members.map((member) => {
				const week: any = indexBy(member.weekHours, 'day');
				const sum = reduce(
					member.weekHours,
					(memo, day: any) => memo + parseInt(day.duration + '', 10),
					0
				);
				member.weekHours = range(0, 7).map((day) => {
					if (week[day]) {
						week[day].duration = (week[day].duration * 100) / sum;
						return week[day];
					} else {
						return { day, duration: 0 };
					}
				});
				return member;
			});
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.memberLoading = false;
		}
	}

	onDelete() {
		this.logs$.next(true);
	}

	ngOnDestroy() {
		this.galleryService.clearGallery();
	}

	get period() {
		if (!this.selectedDateRange) {
			return;
		}
		const { startDate, endDate } = this.selectedDateRange as IDateRangePicker;
		const endWork = moment(this.organization.defaultEndTime, 'HH:mm');
		const startWork = moment(this.organization.defaultStartTime, 'HH:mm');
		const duration = endWork.diff(startWork) / 1000;
		if (startDate && endDate && this.counts) {
			const start = moment(startDate);
			const end = moment(endDate);
			const dayCount = end.diff(start, 'days') + 1;
			return dayCount * (isNaN(duration) ? 86400 : duration) * this.counts.employeesCount;
		}
	}

	/**
	 * Get selected date range period
	 */
	get selectedPeriod(): RangePeriod {
		if (!this.selectedDateRange) {
			return;
		}
		const { startDate, endDate } = this.selectedDateRange as IDateRangePicker;

		const start = moment(startDate);
		const end = moment(endDate);
		const days = end.diff(start, 'days');

		if (days === 6) {
			return RangePeriod.WEEK;
		} else if (days === 0) {
			return RangePeriod.DAY;
		} else {
			return RangePeriod.PERIOD;
		}
	}

	/**
	 * GET header title accordingly selected date range
	 */
	get headerTitle() {
		if (!this.selectedDateRange) {
			return this.getTranslation('TIMESHEET.WEEKLY');
		}
		const { startDate, endDate, isCustomDate } = this.selectedDateRange as IDateRangePicker;
		if (startDate && endDate) {
			if (!isCustomDate) {
				if (this.isMoreThanWeek()) {
					return this.getTranslation('TIMESHEET.MONTHLY');
				} else if (this.isMoreThanDays()) {
					return this.getTranslation('TIMESHEET.WEEKLY');
				} else {
					return this.getTranslation('TIMESHEET.DAILY');
				}
			}
		}
	}

	/**
	 * If, selected date range are in current week
	 *
	 * @returns
	 */
	isCurrentWeek() {
		if (!this.selectedDateRange) {
			return;
		}
		const { startDate, endDate } = this.selectedDateRange as IDateRangePicker;
		return (
			(
				moment(startDate).format('YYYY-MM-DD') ===
				moment().startOf('week').format('YYYY-MM-DD')
			) &&
			(
				moment(endDate).format('YYYY-MM-DD') ===
				moment().endOf('week').format('YYYY-MM-DD')
			)
		);
	}

	/**
	 * If, selected date range are more than a days
	 */
	isMoreThanDays(): boolean {
		if (!this.selectedDateRange) {
			return;
		}
		const { startDate, endDate } = this.selectedDateRange as IDateRangePicker;
		if (startDate && endDate) {
			return moment(endDate).diff(moment(startDate), 'days') > 0;
		}
		return false;
	}

	/**
	 * If, selected date range are more than a week
	 */
	isMoreThanWeek(): boolean {
		if (!this.selectedDateRange) {
			return;
		}
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
			const people  = await firstValueFrom(this.employeesService.getEmployeeById(
				employee.id,
				['user']
			));
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
					date: moment(startDate).format("MM-DD-YYYY"),
					date_end: moment(endDate).format("MM-DD-YYYY")
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
					date: moment(startDate).format("MM-DD-YYYY"),
					date_end: moment(endDate).format("MM-DD-YYYY")
				}
			});
		} catch (error) {
			console.log('Error while redirecting to apps & urls report.', error);
		}
	}

	/**
	 * Get employee counts
	 *
	 */
  	private async loadEmployeesCount() {
		if (this.user && this.user.employeeId) {
			return;
		}
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.employeesService.getCount({ organizationId, tenantId })
			.pipe(
				tap((count: number) => this.employeesCount = count),
				untilDestroyed(this)
			)
			.subscribe();
	}

  	private async loadProjectsCount() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.projectCount = await this.projectService.getCount({
			organizationId,
			tenantId
		});
	}

	/**
	 * Hide Project Worked Block, If project selected from header
	 */
	get hideProjectBlock() {
		const hide = this.projectIds.filter(Boolean).length;
		if (hide) {
			this.widgetService.hideWidget(1);
			this.widgetService.save();
		}
		return hide;
	}

	/**
	 * Hide Employee Worked Block, If employee selected from header
	 */
	get hideEmployeeBlock() {
		const hide = this.employeeIds.filter(Boolean).length;
		if (hide) {
			this.widgetService.hideWidget(0);
			this.windowService.hideWindow(5);
			this.widgetService.save();
			this.windowService.save();
		}
		return hide;
	}
	/**
	 * The order of titles in array depend to order of templates
	 * @param position default position of widget or window
	 * @param isWidget define if it's widget or not
	 * @returns not translated title
	 */
	public titleMapper(position: number, isWidget: boolean = true): string {
		const widgetsTitles: string[] = [
			'TIMESHEET.MEMBERS_WORKED',
			'TIMESHEET.PROJECTS_WORKED',
			'TIMESHEET.TODAY_ACTIVITY',
			'TIMESHEET.WORKED_TODAY',
			'TIMESHEET.MEMBERS_WORKED',
			'TIMESHEET.MEMBERS_WORKED'
		];
		const windowsTitles = [
			'TIMESHEET.RECENT_ACTIVITIES',
			'TIMESHEET.MANUAL_TIME',
			'TIMESHEET.TASKS',
			'TIMESHEET.PROJECTS',
			'TIMESHEET.APPS_URLS',
			'TIMESHEET.MEMBERS'
		];
		switch (this.selectedPeriod) {
			case RangePeriod.PERIOD:
				widgetsTitles[4] = 'TIMESHEET.WORKED_OVER_PERIOD';
				widgetsTitles[5] = 'TIMESHEET.ACTIVITY_OVER_PERIOD';
				break;
			case RangePeriod.DAY:
				widgetsTitles[4] = 'TIMESHEET.WORKED_FOR_DAY';
				widgetsTitles[5] = 'TIMESHEET.ACTIVITY_FOR_DAY';
				break;
			default:
				widgetsTitles[4] = this.isCurrentWeek()
					? 'TIMESHEET.WORKED_THIS_WEEK'
					: 'TIMESHEET.WORKED_FOR_WEEK';
				widgetsTitles[5] = 'TIMESHEET.ACTIVITY_FOR_WEEK';
				break;
		}
		return isWidget ? widgetsTitles[position] : windowsTitles[position];
	}

	public updateWindowVisibility(value: GuiDrag) {
		value.hide = !value.hide;
		this.windowService.updateWindow(value);
		this.windowService.save();
	}

	public updateWidgetVisibility(value: GuiDrag) {
		value.hide = !value.hide;
		this.widgetService.updateWidget(value);
		this.widgetService.save();
	}

	public undo(isWindow?: boolean){
		isWindow
			? this.windowService.undoDrag()
			: this.widgetService.undoDrag();
	}

	public slideNext(swiper: SwiperComponent) {
		swiper.swiperRef.slideNext(100);
	}

	public slidePrev(swiper: SwiperComponent) {
		swiper.swiperRef.slidePrev(100);
	}
}
