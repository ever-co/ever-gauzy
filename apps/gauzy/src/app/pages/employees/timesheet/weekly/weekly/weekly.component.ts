import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService, NbPopoverDirective } from '@nebular/theme';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { chain, pick } from 'underscore';
import {
	DateRangePickerBuilderService,
	IDatePickerConfig,
	moment,
	Store,
	TimeLogEventService,
	TimesheetFilterService,
	TimesheetService,
	TimeTrackerService
} from '@gauzy/ui-core/core';
import {
	IGetTimeLogInput,
	ITimeLog,
	IOrganizationProject,
	ITimeLogFilters,
	PermissionsEnum,
	IDateRangePicker
} from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-core/common';
import { TranslateService } from '@ngx-translate/core';
import {
	BaseSelectorFilterComponent,
	ViewTimeLogComponent,
	GauzyFiltersComponent,
	TimeZoneService,
	EditTimeLogModalComponent
} from '@gauzy/ui-core/shared';
import { combineLatest, debounceTime, Subject, takeUntil } from 'rxjs';

interface WeeklyDayData {
	project?: IOrganizationProject;
	dates: any;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-weekly-timesheet',
	templateUrl: './weekly.component.html',
	styleUrls: ['./weekly.component.scss'],
	standalone: false
})
export class WeeklyComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	filters: ITimeLogFilters = this.request;
	weekData: WeeklyDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	limitReached = false;
	futureDateAllowed: boolean;
	hasPermission = false;

	datePickerConfig$: Observable<IDatePickerConfig> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	viewTimeLogComponent = ViewTimeLogComponent;
	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	@ViewChild(NbPopoverDirective) popover: NbPopoverDirective;

	private readonly workedThisWeek$: Observable<number> = this.timeTrackerService.workedThisWeek$;
	private readonly reWeeklyLimit$: Observable<number> = this.timeTrackerService.reWeeklyLimit$;
	private readonly destroy$ = new Subject<void>();
	private readonly selectedDateRange$: Observable<IDateRangePicker | null> =
		this.dateRangePickerBuilderService.selectedDateRange$;

	constructor(
		public readonly translateService: TranslateService,
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly timeTrackerService: TimeTrackerService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService,
		protected readonly timeLogEventService: TimeLogEventService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this.hasPermission = this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				debounceTime(200),
				tap(() => this.updateWeekDayList()),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getWeeklyTimesheetLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeLogEventService.changes$
			.pipe(
				filter((action) => action === 'added' || action === 'deleted'),
				debounceTime(200),
				tap(() => this.subject$.next(true)),
				tap(() => this.gauzyFiltersComponent.getStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.subject$.next(true)),
				tap(() => this.gauzyFiltersComponent.getStatistics()),
				untilDestroyed(this)
			)
			.subscribe();

		combineLatest([this.selectedDateRange$, this.workedThisWeek$, this.reWeeklyLimit$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(([selectedDateRange]) => {
				if (this.timeTrackerService.isCurrentWeekSelected(selectedDateRange)) {
					this.limitReached = this.timeTrackerService.hasReachedWeeklyLimit();
				} else {
					this.limitReached = false;
				}
			});
	}

	/**
	 * Updates the list of weekdays between the start and end dates in the request.
	 */
	updateWeekDayList() {
		const { startDate, endDate } = this.request;

		// Ensure startDate and endDate are valid dates
		if (!startDate || !endDate) {
			throw new Error('Both startDate and endDate must be defined');
		}

		// Convert start and end dates to 'YYYY-MM-DD' format
		const start = moment(startDate).startOf('day'); // Start of the day for consistency
		const end = moment(endDate).startOf('day');

		// Check that start date is before or same as end date
		if (start.isAfter(end)) {
			throw new Error('startDate must be before or on the same day as endDate');
		}

		// Get an array of dates within the range, inclusive
		const dayRange = [];
		const current = start;

		while (!current.isAfter(end)) {
			// Include end date in the range
			dayRange.push(current.format('YYYY-MM-DD')); // Add formatted date to the list
			current.add(1, 'day'); // Move to the next day
		}

		// Assign the list of weekdays to weekDayList
		this.weekDayList = dayRange;
	}

	getGroupDate(date: string | Date): string | null {
		const timeZone = this.filters?.timeZone || this.timeZoneService.currentTimeZone;
		const parsed = moment.tz(date, timeZone);

		if (!parsed.isValid()) {
			console.warn('Invalid date passed to getGroupDate:', date);
			return null;
		}

		return parsed.format('YYYY-MM-DD');
	}

	/**
	 * Handles changes to timesheet filters and triggers data updates.
	 *
	 * @param {ITimeLogFilters} filters - The new set of filters to apply.
	 */
	filtersChange(filters: ITimeLogFilters) {
		// Check if we should save the filters to the timesheet filter service
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters; // Save the new filters
		}

		// Use Object.assign to create a shallow copy of the filters object
		this.filters = { ...filters }; // Updated assignment using spread operator

		// Notify subscribers that the filters have changed, triggering data updates
		this.subject$.next(true);
	}

	/**
	 * Prepare a unique request for timesheet data.
	 * If the `request` or `filters` are empty, it does nothing.
	 * Otherwise, it combines the current request and applied filters, then emits the combined result.
	 *
	 * @returns {void}
	 */
	prepareRequest(): void {
		// If `request` or `filters` are empty, do nothing
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return; // Early return to avoid further processing
		}
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');
		const request: IGetTimeLogInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request)
		};
		this.payloads$.next(request);
	}

	/**
	 * Get weekly timesheet logs
	 *
	 * @returns
	 */
	async getWeeklyTimesheetLogs() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		const payloads = this.payloads$.getValue();
		const timeZone = this.filters?.timeZone || this.timeZoneService.currentTimeZone;

		this.loading = true;
		try {
			const logs = await this.timesheetService.getTimeLogsChunk(payloads, ['project', 'employee.user', 'task']);

			this.weekData = chain(logs)
				.groupBy('projectId')
				.map((innerLogs, _projectId) => {
					const byDate = chain(innerLogs)
						.groupBy((log) => {
							const started = moment.tz(log.startedAt, timeZone);
							return started.isValid() ? started.format('YYYY-MM-DD') : 'invalid-date';
						})
						.mapObject((res) => {
							const sum = res.reduce((total, log) => total + log.duration, 0);
							return { sum, logs: res };
						})
						.value();

					const project = innerLogs.length > 0 ? innerLogs[0].project : null;
					const dates = {};

					this.weekDayList.forEach((date) => {
						const dateMoment = moment.tz(date, timeZone);
						const tzDate = dateMoment.isValid() ? dateMoment.tz(timeZone).format('YYYY-MM-DD') : null;
						if (tzDate) {
							dates[tzDate] = byDate[tzDate] || 0;
						}
					});

					return { project, dates };
				})
				.value();
		} catch (error) {
			console.error('Error fetching timesheet logs:', error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Definition for opening a dialog to add/edit a time log
	 *
	 * @param timeLog
	 */
	openAddEdit(timeLog?: ITimeLog) {
		if (this.limitReached && !this.hasPermission) return;
		const defaultTimeLog = {
			startedAt: moment
				.tz(this.filters?.timeZone)
				.set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
				.toDate(),
			stoppedAt: moment
				.tz(this.filters?.timeZone)
				.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
				.toDate(),
			employeeId: this.request.employeeIds?.[0] || null,
			projectId: this.request.projectIds?.[0] || null
		};

		if (!this.nbDialogService) {
			throw new Error('NbDialogService is not available.');
		}

		const dialogRef = this.nbDialogService.open(EditTimeLogModalComponent, {
			context: { timeLog: timeLog ?? defaultTimeLog, timeZone: this.filters?.timeZone }
		});

		dialogRef.onClose
			.pipe(
				filter((log: ITimeLog) => !!log),
				tap((log: ITimeLog) =>
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(log.startedAt))
				),
				tap(() => this.subject$.next(true)),
				tap(() => this.gauzyFiltersComponent.getStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Open a dialog for adding a time log based on a specific date and project
	 * @param date
	 * @param project
	 */
	openAddByDateProject(date: string, project: IOrganizationProject): void {
		if (this.limitReached && !this.hasPermission) return;
		const baseDate = moment(date);
		const startedAt = baseDate
			.clone()
			.tz(this.filters?.timeZone)
			.set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
			.toDate();

		const stoppedAt = baseDate
			.clone()
			.tz(this.filters?.timeZone)
			.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
			.toDate();
		if (!this.nbDialogService) {
			throw new Error('NbDialogService is not available.');
		}

		// Open the dialog with calculated start and stop times
		const dialogRef = this.nbDialogService.open(EditTimeLogModalComponent, {
			context: {
				timeLog: {
					startedAt,
					stoppedAt,
					organizationContactId: project?.organizationContactId ?? null,
					projectId: project?.id ?? null,
					// Adding an employeeId if available
					employeeId: this.request.employeeIds?.[0] ?? null
				},
				timeZone: this.filters?.timeZone
			}
		});

		// Handle the closure of the dialog
		dialogRef.onClose
			.pipe(
				filter((timeLog) => !!timeLog), // Ensure valid timeLog
				tap((timeLog) => this.dateRangePickerBuilderService.refreshDateRangePicker(moment(timeLog.startedAt))), // Refresh the date range picker
				tap(() => this.subject$.next(true)), // Notify observers of changes
				tap(() => this.gauzyFiltersComponent.getStatistics()),
				untilDestroyed(this) // Cleanup when the component is destroyed
			)
			.subscribe(); // Activate the observable pipeline
	}

	/**
	 * Handle the addition of a time log
	 *
	 * @param data
	 */
	addTimeCallback = (data: ITimeLog) => {
		if (data) {
			this.subject$.next(true);
			this.gauzyFiltersComponent.getStatistics();
		}
	};

	/**
	 * If an addition is allowed based on date and organization settings.
	 *
	 * @param date
	 * @returns
	 */
	allowAdd(date: string) {
		const { futureDateAllowed } = this.organization;
		const currentMoment = moment();
		return futureDateAllowed || moment(date).isSameOrBefore(currentMoment);
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
