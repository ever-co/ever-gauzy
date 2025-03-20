// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import {
	CalendarOptions,
	DateSelectArg,
	EventClickArg,
	EventDropArg,
	EventHoveringArg,
	EventInput
} from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { pick } from 'underscore';
import { combineLatest, Observable, Subject, takeUntil } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import {
	DateRangePickerBuilderService,
	IDatePickerConfig,
	Store,
	TimesheetFilterService,
	TimesheetService,
	TimeTrackerService
} from '@gauzy/ui-core/core';
import { isEmpty, toTimezone } from '@gauzy/ui-core/common';
import { IGetTimeLogInput, ITimeLog, ITimeLogFilters, PermissionsEnum, TimeFormatEnum } from '@gauzy/contracts';
import {
	BaseSelectorFilterComponent,
	EditTimeLogModalComponent,
	GauzyFiltersComponent,
	TimeZoneService,
	ViewTimeLogModalComponent,
	dayOfWeekAsString
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-calendar-timesheet',
	templateUrl: './calendar.component.html',
	styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('calendar', { static: true }) calendar: FullCalendarComponent;
	@ViewChild('viewLogTemplate', { static: true }) viewLogTemplate: TemplateRef<any>;
	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;

	datePickerConfig$: Observable<IDatePickerConfig> = this.dateRangePickerBuilderService.datePickerConfig$;
	private readonly workedThisWeek$: Observable<number> = this.timeTrackerService.workedThisWeek$;
	private readonly reWeeklyLimit$: Observable<number> = this.timeTrackerService.reWeeklyLimit$;
	private readonly destroy$ = new Subject<void>();

	PermissionsEnum = PermissionsEnum;
	calendarComponent: FullCalendarComponent; // the #calendar in the template
	calendarOptions: CalendarOptions;
	filters: ITimeLogFilters;
	loading = false;
	futureDateAllowed: boolean;
	limitReached = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef,
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetService: TimesheetService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly timeTrackerService: TimeTrackerService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
		this.calendarOptions = {
			initialView: 'timeGridWeek',
			headerToolbar: {
				left: '',
				center: 'title',
				right: 'dayGridMonth,timeGridWeek,timeGridDay'
			},
			themeSystem: 'bootstrap',
			plugins: [dayGridPlugin, timeGrigPlugin, interactionPlugin, bootstrapPlugin],
			showNonCurrentDates: false,
			weekends: true,
			height: 'auto',
			editable: true,
			selectable: true,
			firstDay: 1,
			selectAllow: this.selectAllow.bind(this),
			events: this.getEvents.bind(this),
			eventDrop: this.handleEventDrop.bind(this),
			eventResize: this.handleEventResize.bind(this),
			select: this.handleEventSelect.bind(this),
			eventClick: this.handleEventClick.bind(this),
			dateClick: this.handleDateClick.bind(this),
			eventMouseEnter: this.handleEventMouseEnter.bind(this),
			eventMouseLeave: this.handleEventMouseLeave.bind(this)
		};
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.calendar.getApi() && !!this.organization),
				tap(() => this.setCalendarOptions()),
				tap(() => this.setCalenderInitialView()),
				untilDestroyed(this)
			)
			.subscribe();

		combineLatest([this.workedThisWeek$, this.reWeeklyLimit$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(() => {
				this.limitReached = this.timeTrackerService.hasReachedWeeklyLimit();
			});
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	/**
	 * Handles the change in time log filters.
	 *
	 * @param filters The new set of filters for time logs.
	 */
	filtersChange(filters: ITimeLogFilters): void {
		if (this.gauzyFiltersComponent.saveFilters) {
			// Save filters if the saveFilters flag is enabled
			this.timesheetFilterService.filter = filters;
		}

		// Update component filters
		this.filters = { ...filters };

		// Notify subscribers about the filter change
		this.subject$.next(true);
	}

	/**
	 * SET calendar options
	 *
	 * @returns
	 */
	async setCalendarOptions() {
		if (!this.organization || !this.calendar.getApi()) {
			return;
		}

		const calendar = this.calendar.getApi();
		const { allowManualTime, allowModifyTime, futureDateAllowed, startWeekOn } = this.organization;

		this.futureDateAllowed = futureDateAllowed;

		// Set 'selectable' option based on organization settings and user permissions
		calendar.setOption(
			'selectable',
			(await this.ngxPermissionsService.hasPermission(PermissionsEnum.ALLOW_MANUAL_TIME)) && allowManualTime
		);

		// Set 'editable' option based on organization settings and user permissions
		calendar.setOption(
			'editable',
			(await this.ngxPermissionsService.hasPermission(PermissionsEnum.ALLOW_MODIFY_TIME)) && allowModifyTime
		);

		// Set 'firstDay' option to define the start of the week
		calendar.setOption('firstDay', dayOfWeekAsString(startWeekOn));

		// Set 'slotLabelFormat' option for slot labels
		calendar.setOption('slotLabelFormat', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: this.filters?.timeFormat === TimeFormatEnum.FORMAT_12_HOURS
		});

		// Set 'eventTimeFormat' option for event times
		calendar.setOption('eventTimeFormat', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: this.filters?.timeFormat === TimeFormatEnum.FORMAT_12_HOURS
		});
	}

	/**
	 * Sets the initial view of the calendar based on organization settings and request parameters.
	 */
	setCalenderInitialView(): void {
		if (!this.organization || !this.calendar.getApi()) {
			return;
		}

		const { startDate } = this.request;

		if (this.isMoreThanUnit('weeks')) {
			// If the time range is more than weeks, set the initial view to month view
			this.calendar.getApi().changeView('dayGridMonth', startDate);
		} else if (this.isMoreThanUnit('days')) {
			// If the time range is more than days, set the initial view to week view
			this.calendar.getApi().changeView('timeGridWeek', startDate);
		} else {
			// Otherwise, set the initial view to day view
			this.calendar.getApi().changeView('timeGridDay', startDate);
		}

		// Refresh events after changing the view
		this.calendar.getApi().refetchEvents();
	}

	/**
	 * Fetches events based on the provided arguments and invokes the callback with the events.
	 *
	 * @param {Object} arg - The argument containing the start and end dates.
	 * @param {Function} callback - The callback function to be called with the fetched events.
	 * @returns {Promise<void>}
	 */
	getEvents(arg: any, callback: Function): Promise<void> {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		const timeZone = this.timeZoneService.currentTimeZone;
		const startDate = moment(arg.start).startOf('day').format('YYYY-MM-DD HH:mm:ss');
		const endDate = moment(arg.end).subtract(1, 'days').endOf('day').format('YYYY-MM-DD HH:mm:ss');
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');
		const request: IGetTimeLogInput = {
			...appliedFilter,
			...this.getFilterRequest({ startDate, endDate })
		};

		try {
			this.loading = true;
			const timeLogs$ = this.timesheetService.getTimeLogs(request, [
				'project',
				'task',
				'organizationContact',
				'employee.user'
			]);
			timeLogs$.then((logs: ITimeLog[]) => {
				const events = logs.map((log: ITimeLog): EventInput => {
					const title = log.project ? log.project.name : this.getTranslation('TIMESHEET.NO_PROJECT');
					return {
						id: log.id,
						title: title,
						start: toTimezone(log.startedAt, timeZone).format('YYYY-MM-DD HH:mm:ss'),
						end: toTimezone(log.stoppedAt, timeZone).format('YYYY-MM-DD HH:mm:ss'),
						log: log
					};
				});
				callback(events);
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Determines if the date selection is allowed based on the criteria.
	 *
	 * @param param0 - An object containing the start and end dates of the selection.
	 * @returns {boolean} - Returns true if the selection is allowed, false otherwise.
	 */
	selectAllow({ start, end }): boolean {
		const isOneDay = moment(start).isSame(moment(end), 'day');
		return this.futureDateAllowed ? isOneDay : isOneDay && moment(end).isSameOrBefore(moment());
	}

	/**
	 * Handles the event click action by opening a modal dialog to view the time log details.
	 *
	 * @param param0 - An object containing the clicked event.
	 */
	handleEventClick({ event }: EventClickArg) {
		this.nbDialogService.open(ViewTimeLogModalComponent, {
			context: { timeLog: event.extendedProps.log },
			dialogClass: 'view-log-dialog'
		});
	}

	/**
	 * Handles the click event on a date in the calendar.
	 * Changes the view to the week view starting from the clicked date.
	 *
	 * @param event - The click event object.
	 */
	handleDateClick(event: DateClickArg): void {
		if (this.calendar.getApi()) {
			this.calendar.getApi().changeView('timeGridWeek', event.date);
		}
	}

	/**
	 * Handles the selection of an event (time slot) in the calendar.
	 * Opens a dialog for creating a new event/appointment.
	 *
	 * @param event - The event object representing the selected time slot.
	 */
	handleEventSelect(event: DateSelectArg): void {
		this.openDialog({
			startedAt: event.start,
			stoppedAt: event.end,
			employeeId: this.request.employeeIds ? this.request.employeeIds[0] : null,
			projectId: this.request.projectIds ? this.request.projectIds[0] : null
		});
	}

	/**
	 * Handles the mouse enter event on a FullCalendar event element.
	 * Adjusts the position of the event element if it has overflow.
	 *
	 * @param param0 - An object containing the event element (`el`).
	 */
	handleEventMouseEnter({ el }: EventHoveringArg): void {
		if (this.hasOverflow(el.querySelector('.fc-event-main'))) {
			el.style.position = 'unset';
		}
	}

	/**
	 * Handles the mouse leave event on a FullCalendar event element.
	 * Removes any custom styles applied during mouse enter.
	 *
	 * @param param0 - An object containing the event element (`el`).
	 */
	handleEventMouseLeave({ el }: EventHoveringArg): void {
		el.removeAttribute('style');
	}

	/**
	 * Handles the event drop action by updating the time log with the new start and end times.
	 *
	 * @param param0 - An object containing the dropped event.
	 */
	async handleEventDrop({ event }: EventDropArg) {
		await this.updateTimeLog(event.id, {
			startedAt: event.start,
			stoppedAt: event.end
		});
	}

	/**
	 * Handles the event resize action by updating the time log with the new start and end times.
	 *
	 * @param param0 - An object containing the resized event.
	 */
	async handleEventResize({ event }: EventResizeDoneArg) {
		await this.updateTimeLog(event.id, {
			startedAt: event.start,
			stoppedAt: event.end
		});
	}

	/**
	 * Checks if an HTML element has overflow content, either horizontally or vertically.
	 *
	 * @param el The HTML element to check for overflow.
	 * @returns True if the element has overflow content, otherwise false.
	 */
	hasOverflow(el: HTMLElement) {
		if (!el) {
			return;
		}
		const curOverflow = el.style ? el.style.overflow : 'hidden';

		// Temporarily set overflow to hidden if it's not already set or set to visible
		if (!curOverflow || curOverflow === 'visible') el.style.overflow = 'hidden';

		// Check if the element has overflow content
		const isOverflowing = el.clientWidth < el.scrollWidth || el.clientHeight < el.scrollHeight;

		// Restore the original overflow style
		if (el.style) {
			el.style.overflow = curOverflow;
		}

		return isOverflowing;
	}

	/**
	 * Opens a dialog to edit a time log.
	 *
	 * @param timeLog An optional parameter representing the time log to be edited.  It can be a complete ITimeLog object or a partial one.
	 */
	openDialog(timeLog?: ITimeLog | Partial<ITimeLog>) {
		if (this.limitReached) return;

		const dialog$ = this.nbDialogService.open(EditTimeLogModalComponent, { context: { timeLog } });
		dialog$.onClose
			.pipe(
				filter((timeLog: ITimeLog) => !!timeLog),
				tap((timeLog: ITimeLog) =>
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(timeLog.startedAt))
				),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Updates a time log with the provided ID.
	 *
	 * @param id The ID of the time log to be updated.
	 * @param timeLog The time log data to update. It can be a complete ITimeLog object or a partial one.
	 * @returns A promise that resolves when the update operation completes.
	 */
	async updateTimeLog(id: string, timeLog: ITimeLog | Partial<ITimeLog>): Promise<void> {
		try {
			this.loading = true; // Set loading indicator
			await this.timesheetService.updateTime(id, timeLog); // Call service to update time log
		} finally {
			this.loading = false; // Reset loading indicator
		}
	}

	/**
	 * If, selected date range are more than a weeks/days
	 */
	isMoreThanUnit(unitOfTime: moment.unitOfTime.Base): boolean {
		if (!this.request.startDate) {
			return false;
		}
		const { startDate, endDate } = this.request;
		return moment(endDate).diff(moment(startDate), unitOfTime) > 0;
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
