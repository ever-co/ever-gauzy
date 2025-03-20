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
	TimesheetFilterService,
	TimesheetService,
	TimeTrackerService
} from '@gauzy/ui-core/core';
import { IGetTimeLogInput, ITimeLog, IOrganizationProject, ITimeLogFilters, PermissionsEnum } from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { TranslateService } from '@ngx-translate/core';
import {
	BaseSelectorFilterComponent,
	ViewTimeLogComponent,
	GauzyFiltersComponent,
	TimeZoneService,
	EditTimeLogModalComponent
} from '@gauzy/ui-core/shared';
import { combineLatest, Subject, takeUntil } from 'rxjs';

interface WeeklyDayData {
	project?: IOrganizationProject;
	dates: any;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-weekly-timesheet',
	templateUrl: './weekly.component.html',
	styleUrls: ['./weekly.component.scss']
})
export class WeeklyComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	filters: ITimeLogFilters = this.request;
	weekData: WeeklyDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	limitReached = false;
	futureDateAllowed: boolean;

	datePickerConfig$: Observable<IDatePickerConfig> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	viewTimeLogComponent = ViewTimeLogComponent;
	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	@ViewChild(NbPopoverDirective) popover: NbPopoverDirective;

	private readonly workedThisWeek$: Observable<number> = this.timeTrackerService.workedThisWeek$;
	private readonly reWeeklyLimit$: Observable<number> = this.timeTrackerService.reWeeklyLimit$;
	private readonly destroy$ = new Subject<void>();

	constructor(
		public readonly translateService: TranslateService,
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly timeTrackerService: TimeTrackerService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.updateWeekDayList()),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getWeeklyTimesheetLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();

		combineLatest([this.workedThisWeek$, this.reWeeklyLimit$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(() => {
				this.limitReached = this.timeTrackerService.hasReachedWeeklyLimit();
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
		this.loading = true;
		try {
			const logs = await this.timesheetService.getTimeLogs(payloads, ['project', 'employee.user']);
			this.weekData = chain(logs)
				.groupBy('projectId')
				.map((innerLogs, _projectId) => {
					const byDate = chain(innerLogs)
						.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
						.mapObject((res) => {
							const sum = res.reduce((iteratee, log) => iteratee + log.duration, 0);
							return { sum, logs: res };
						})
						.value();

					const project = innerLogs.length > 0 ? innerLogs[0].project : null;
					const dates = {};

					this.weekDayList.forEach((date) => {
						dates[date] = byDate[date] || 0;
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
		if (this.limitReached) return;
		if (!this.nbDialogService) {
			throw new Error('NbDialogService is not available.');
		}

		const dialogRef = this.nbDialogService.open(EditTimeLogModalComponent, {
			context: { timeLog }
		});

		dialogRef.onClose
			.pipe(
				filter((log: ITimeLog) => !!log),
				tap((log: ITimeLog) =>
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(log.startedAt))
				),
				tap(() => this.subject$.next(true)),
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
		// Calculate the nearest previous 10-minute mark for stoppedAt
		const currentMoment = moment();
		const minutes = moment().minutes();
		const nearestTenMinutes = minutes - (minutes % 10);

		const stoppedAt = new Date(
			moment(date).format('YYYY-MM-DD') + ' ' + currentMoment.set('minutes', nearestTenMinutes).format('HH:mm')
		);

		// Calculate startedAt by subtracting one hour from stoppedAt
		const startedAt = moment(stoppedAt).subtract('1', 'hour').toDate();

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
				}
			}
		});

		// Handle the closure of the dialog
		dialogRef.onClose
			.pipe(
				filter((timeLog) => !!timeLog), // Ensure valid timeLog
				tap((timeLog) => this.dateRangePickerBuilderService.refreshDateRangePicker(moment(timeLog.startedAt))), // Refresh the date range picker
				tap(() => this.subject$.next(true)), // Notify observers of changes
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
		}
	};

	/**
	 * Handle the 'close' event based on a boolean trigger
	 *
	 * @param event
	 */
	onClose = (event: boolean) => {
		if (event) this.popover.hide();
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
