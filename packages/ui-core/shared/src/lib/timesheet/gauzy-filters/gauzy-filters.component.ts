import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import * as moment from 'moment';
import { BehaviorSubject, combineLatest, from, of, Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, switchMap, take, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pick } from 'underscore';
import { Options, ChangeContext } from '@angular-slider/ngx-slider';
import {
	ICountsStatistics,
	IDateRangePicker,
	IGetCountsStatistics,
	IOrganization,
	IOrganizationEmploymentType,
	ITimeLogFilters,
	ITimeLogTodayFilters,
	PermissionsEnum,
	TimeFormatEnum,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	ActivityLevel,
	DateRangePickerBuilderService,
	OrganizationEmploymentTypesService,
	Store,
	TimesheetFilterService,
	TimesheetStatisticsService,
	ToastrService
} from '@gauzy/ui-core/core';
import { distinctUntilChange, isNotEmpty, toUtcOffset } from '@gauzy/ui-core/common';
import { TimeZoneService } from './timezone-filter';
import { getAdjustDateRangeFutureAllowed } from '../../selectors';
import { NgxPermissionsService } from 'ngx-permissions';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-filters',
	templateUrl: './gauzy-filters.component.html',
	styleUrls: ['./gauzy-filters.component.scss'],
	standalone: false
})
export class GauzyFiltersComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	// declaration of variables
	public PermissionsEnum = PermissionsEnum;
	public TimeLogType = TimeLogType;
	public TimeLogSourceEnum = TimeLogSourceEnum;
	public counts: ICountsStatistics;
	public organization: IOrganization;
	public employeeIds: string[] = [];
	public projectIds: string[] = [];
	public teamIds: string[] = [];
	public hasFilterApplies: boolean;
	public activityLevel = ActivityLevel;
	public sliderOptions: Partial<Options> = {
		floor: 0,
		ceil: 100,
		step: 5
	};
	public employmentTypes: IOrganizationEmploymentType[] = [];
	public readonly timeLogSourceSelectors = this.getTimeLogSourceSelectors();

	public payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);
	public logs$: Subject<any> = new Subject();

	private autoRefresh$: Subscription;

	private _selectedDateRange: IDateRangePicker;
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	set selectedDateRange(range: IDateRangePicker) {
		if (isNotEmpty(range)) {
			this._selectedDateRange = range;
		}
	}

	@Input() saveFilters = true;
	@Input() hasLogTypeFilter = true;
	@Input() hasSourceFilter = true;
	@Input() hasActivityLevelFilter = true;
	@Input() hasTimeZoneFilter = true;
	@Input() hasWorkedPerDay = false;
	@Input() hasWorkedPerWeek = false;
	@Input() isTimeFormat = false;
	@Input() hasEmploymentTypes = false;

	/*
	 * Getter & Setter for dynamic enabled/disabled element
	 */
	private filters$: Subject<any> = new Subject();
	private _filters: ITimeLogFilters = {
		timeFormat: TimeFormatEnum.FORMAT_12_HOURS,
		source: [],
		logType: [],
		activityLevel: ActivityLevel,
		employmentTypes: []
	};
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(filters: ITimeLogFilters) {
		if (filters) {
			this._filters = filters;
			this.activityLevel = {
				start: filters.activityLevel ? filters.activityLevel.start : 0,
				end: filters.activityLevel ? filters.activityLevel.end : 100
			};
		}
		this.cd.detectChanges();
	}

	@Output() filtersChange: EventEmitter<ITimeLogFilters> = new EventEmitter();

	/**
	 * define constructor
	 */
	constructor(
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly cd: ChangeDetectorRef,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		private readonly toastrService: ToastrService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly timeZoneService: TimeZoneService,
		private readonly organizationEmploymentTypesService: OrganizationEmploymentTypesService,
		private readonly ngxPermissionsService: NgxPermissionsService
	) {
		super(translateService);
	}

	ngOnInit() {
		if (this.saveFilters) {
			this.timesheetFilterService.filter$
				.pipe(
					take(1),
					tap((filters: ITimeLogFilters) => {
						this.filters = Object.assign(
							{},
							pick(filters, 'source', 'employmentTypes', 'activityLevel', 'logType')
						);
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
		this.filters$
			.pipe(
				debounceTime(400),
				tap(() => (this.hasFilterApplies = this.hasFilter())),
				tap(() => this.filtersChange.emit(this.arrangedFilters())),
				untilDestroyed(this)
			)
			.subscribe();
		this.logs$
			.pipe(
				debounceTime(200),
				tap(async () => await this.getStatistics()),
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

		if (this.hasEmploymentTypes) {
			from(this.hasPermissionEmploymentTypes())
				.pipe(
					filter((canChange) => canChange),
					switchMap(() => {
						const { id: organizationId, tenantId } = this.store.selectedOrganization;
						return this.organizationEmploymentTypesService.getAll([], { tenantId, organizationId });
					}),
					untilDestroyed(this)
				)
				.subscribe((types) => {
					this.employmentTypes = types.items;
				});
		}
	}

	ngAfterViewInit() {
		const timeZone$ = this.timeZoneService.timeZone$.pipe(filter((timeZone: string) => !!timeZone));
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeTeam$ = this.store.selectedTeam$;
		const storeProject$ = this.store.selectedProject$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;

		combineLatest([storeOrganization$, selectedDateRange$, storeEmployee$, storeProject$, storeTeam$, timeZone$])
			.pipe(
				distinctUntilChange(),
				debounceTime(500),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				switchMap(([organization, dateRange, employee, project, team]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					return combineLatest([of(employee), of(project), of(team)]);
				}),
				filter(([employee]) => !!employee),
				tap(([employee, project, team]) => {
					this.employeeIds = employee ? [employee.id] : [];
					this.projectIds = project ? [project.id] : [];
					this.teamIds = team ? [team.id] : [];
				}),
				tap(() => this.preparePayloads()),
				tap(() => this.setAutoRefresh(true)),
				untilDestroyed(this)
			)
			.subscribe();

		this.triggerFilterChange();
		this.cd.detectChanges();
	}

	/**
	 * Fetches statistics for the current organization
	 */
	async getStatistics() {
		if (!this.organization) {
			return;
		}
		if (this.hasWorkedPerDay || this.hasWorkedPerWeek) {
			await this.getCounts();
		}
	}

	/**
	 * Fetches the counts statistics.
	 *
	 * @returns Promise<void>
	 */
	async getCounts(): Promise<void> {
		try {
			const request: IGetCountsStatistics = this.payloads$.getValue();
			this.counts = await this.timesheetStatisticsService.getCounts(request);
		} catch (error) {
			this.toastrService.error(error.message || 'An error occurred while fetching counts.');
		}
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

		const { employeeIds, projectIds, teamIds, selectedDateRange } = this;
		const { id: organizationId, tenantId } = this.organization;
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(selectedDateRange);
		const timeZone = this.timeZoneService.currentTimeZone;

		const request: ITimeLogFilters & ITimeLogTodayFilters = {
			tenantId,
			organizationId,
			todayStart: toUtcOffset(moment().startOf('day'), timeZone).format('YYYY-MM-DD HH:mm:ss'),
			todayEnd: toUtcOffset(moment().endOf('day'), timeZone).format('YYYY-MM-DD HH:mm:ss'),
			startDate: toUtcOffset(startDate, timeZone).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUtcOffset(endDate, timeZone).format('YYYY-MM-DD HH:mm:ss'),
			timeZone
		};

		if (isNotEmpty(employeeIds)) {
			request['employeeIds'] = employeeIds;
		}
		if (isNotEmpty(projectIds)) {
			request['projectIds'] = projectIds;
		}
		if (isNotEmpty(teamIds)) {
			request['teamIds'] = teamIds;
		}

		this.payloads$.next(request);
	}

	async hasPermissionEmploymentTypes(): Promise<boolean> {
		const hasPermission = await this.ngxPermissionsService.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		return hasPermission;
	}

	/**
	 * Sets the auto refresh functionality.
	 *
	 * @param value - Determines if auto refresh should be enabled.
	 */
	setAutoRefresh(value: boolean) {
		if (this.autoRefresh$) {
			this.autoRefresh$.unsubscribe();
		}
		if (value) {
			this.autoRefresh$ = timer(0, 60000 * 10)
				.pipe(
					filter((timer) => !!timer),
					tap(() => this.logs$.next(true)),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	/**
	 * Sets the activity level filter based on the provided ChangeContext.
	 *
	 * @param activity - The change context containing the new activity level values.
	 */
	setActivityLevel(activity: ChangeContext): void {
		this.filters.activityLevel = {
			start: activity.value,
			end: activity.highValue
		};
		this.activityLevel = this.filters.activityLevel;
		this.triggerFilterChange();
	}

	/**
	 * Triggers the filter change event.
	 */
	triggerFilterChange(): void {
		this.filters$.next(true);
	}

	/**
	 * Clears all filters and triggers a filter change.
	 */
	clearFilters(): void {
		this.filters = this.timesheetFilterService.clear();
		this.triggerFilterChange();
	}

	/**
	 * Checks if any filters are currently applied.
	 *
	 * @returns True if any filters are applied, otherwise false.
	 */
	hasFilter(): boolean {
		return (
			(this._filters.source && this._filters.source.length >= 1) ||
			(this._filters.logType && this._filters.logType.length >= 1) ||
			(this._filters.employmentTypes && this._filters.employmentTypes.length >= 1) ||
			(this.activityLevel && this.activityLevel.end < 100) ||
			(this.activityLevel && this.activityLevel.start > 0)
		);
	}

	/**
	 *
	 * @returns
	 */
	arrangedFilters(): ITimeLogFilters {
		Object.keys(this.filters).forEach((key) => (this.filters[key] === undefined ? delete this.filters[key] : {}));
		return this.filters;
	}

	/**
	 * Handles the event when the time format is changed.
	 *
	 * @param timeFormat The new time format.
	 */
	timeFormatChanged(timeFormat: TimeFormatEnum): void {
		this.filters.timeFormat = timeFormat;
		this.triggerFilterChange();
	}

	/**
	 * Handles the event when the time zone is changed.
	 *
	 * @param timezone The new time zone.
	 */
	timeZoneChanged(timeZone: string): void {
		this.filters.timeZone = timeZone;
		this.triggerFilterChange();
	}

	/**
	 * Generate Dynamic Timelog Source Selector
	 */
	getTimeLogSourceSelectors(): Array<{ label: string; value: TimeLogSourceEnum }> {
		return [
			{
				label: this.getTranslation('TIMESHEET.SOURCES.WEB_TIMER'),
				value: TimeLogSourceEnum.WEB_TIMER
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.DESKTOP'),
				value: TimeLogSourceEnum.DESKTOP
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.MOBILE'),
				value: TimeLogSourceEnum.MOBILE
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.UPWORK'),
				value: TimeLogSourceEnum.UPWORK
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.HUBSTAFF'),
				value: TimeLogSourceEnum.HUBSTAFF
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.BROWSER_EXTENSION'),
				value: TimeLogSourceEnum.BROWSER_EXTENSION
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.TEAMS'),
				value: TimeLogSourceEnum.TEAMS
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.CLOC'),
				value: TimeLogSourceEnum.CLOC
			}
		];
	}
}
