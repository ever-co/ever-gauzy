import { Component, OnDestroy, ViewChild, OnInit } from '@angular/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, DateSelectArg, EventClickArg, EventHoveringArg, EventInput } from '@fullcalendar/core';
import { disableCursor } from '@fullcalendar/core/internal';
import { TranslateService } from '@ngx-translate/core';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { NbDialogService } from '@nebular/theme';
import { filter, map, tap, switchMap } from 'rxjs/operators';
import { Observable, Subject, catchError, firstValueFrom, of } from 'rxjs';
import { pluck } from 'underscore';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IDateRange, ICandidateInterview, IOrganization, IPagination } from '@gauzy/contracts';
import * as moment from 'moment';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { CandidateInterviewService, EmployeesService, ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { CandidateInterviewInfoComponent, CandidateInterviewMutationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-interview-calendar',
	templateUrl: './interview-calendar.component.html',
	styleUrls: ['./interview-calendar.component.scss']
})
export class InterviewCalendarComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public calendarOptions: CalendarOptions = { events: [] };
	public selectedCandidates: string[] = [];
	public selectedEmployees: string[] = [];
	public calendarEvents: EventInput[] = [];
	public organization: IOrganization;
	public interviews: ICandidateInterview[] = [];
	public organization$: Observable<IOrganization>;
	public employees$: Observable<IEmployee[]>; // Observable for an array of Organization employees
	public subject$: Subject<boolean> = new Subject();

	@ViewChild('calendar', { static: true }) calendarComponent: FullCalendarComponent;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _nbDialogService: NbDialogService,
		private readonly _candidateInterviewService: CandidateInterviewService,
		private readonly _toastrService: ToastrService,
		private readonly _employeesService: EmployeesService,
		private readonly _store: Store,
		protected readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
		this.getCalendarOption();
	}

	ngOnInit() {
		this.organization$ = this._store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization),
			distinctUntilChange(),
			tap((organization: IOrganization) => {
				this.organization = organization;
				this.subject$.next(true);
			})
		);
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				switchMap(() => {
					// Extract organization properties
					const { id: organizationId, tenantId } = this.organization;

					return this._candidateInterviewService
						.getAll(['interviewers'], {
							organizationId,
							tenantId,
							isActive: true,
							isArchived: false
						})
						.pipe(
							map(({ items }) => items),
							tap((interviews: ICandidateInterview[]) => this.mappedInterviews(interviews)),
							catchError((error) => {
								// Handle and log errors
								this._errorHandlingService.handleError(error);
								return of([]);
							}),
							// Handle component lifecycle to avoid memory leaks
							untilDestroyed(this)
						);
				})
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.employees$ = this.organization$.pipe(
			switchMap((organization: IOrganization) => {
				// Extract organization properties
				const { id: organizationId, tenantId } = organization;

				return this._employeesService.getAll(['user'], { organizationId, tenantId }).pipe(
					map(({ items }: IPagination<IEmployee>) => items),
					catchError((error) => {
						// Handle and log errors
						this._errorHandlingService.handleError(error);
						return of([]);
					}),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this)
				);
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Returns the configuration options for the calendar.
	 *
	 * @returns An object containing calendar options.
	 */
	getCalendarOption() {
		this.calendarOptions = {
			initialView: 'timeGridWeek',
			headerToolbar: {
				left: 'prev,next today',
				center: 'title',
				right: 'dayGridMonth,timeGridWeek,timeGridDay'
			},
			themeSystem: 'bootstrap',
			plugins: [dayGridPlugin, timeGrigPlugin, interactionPlugin, bootstrapPlugin],
			weekends: true,
			height: 'auto',
			selectable: true,
			select: this.handleEventSelect.bind(this),
			dateClick: this.handleDateClick.bind(this),
			eventMouseEnter: this.handleEventMouseEnter.bind(this),
			eventMouseLeave: this.handleEventMouseLeave.bind(this),
			eventClick: this.handleEventClick.bind(this)
		};
	}

	/**
	 * Maps an array of candidate interviews to calendar events and updates the calendarEvents property.
	 * Each interview is converted into an event object and added to the calendarEvents array.
	 * After processing all interviews, the mappedCalendarEvents method is called.
	 *
	 * @param interviews - An array of candidate interviews to be mapped to calendar events.
	 */
	mappedInterviews(interviews: ICandidateInterview[]) {
		this.calendarEvents = interviews.map((interview) => ({
			title: interview.title,
			start: interview.startTime,
			end: interview.endTime,
			candidateId: interview.candidateId,
			id: interview.id,
			extendedProps: { id: interview.id },
			backgroundColor: '#36f',
			employeeIds: pluck(interview.interviewers, 'employeeId')
		}));

		// Maps an array of calendar events and updates the calendarEvents property.
		this.mappedCalendarEvents();
	}

	/**
	 * Handles the selection of candidates.
	 * Updates the isCandidate flag and selectedCandidates with the selected candidate IDs,
	 * and triggers the mapping of calendar events.
	 *
	 * @param ids - An array of selected candidate IDs.
	 */
	async onCandidateSelected(ids: string[]) {
		this.selectedCandidates = ids;
		this.mappedCalendarEvents();
	}

	/**
	 * Handles the selection of employees.
	 * Updates the isEmployee flag and selectedEmployees with the selected employee IDs,
	 * and triggers the mapping of calendar events.
	 *
	 * @param ids - An array of selected employee IDs.
	 */
	async onEmployeeSelected(ids: string[]) {
		this.selectedEmployees = ids;
		this.mappedCalendarEvents();
	}

	/**
	 * Handles any additional processing or updates needed after mapping calendar events.
	 * Filters calendar events based on the selected candidates and employees.
	 */
	async mappedCalendarEvents() {
		let events: EventInput[] = [];

		const isCandidateSelected = this.selectedCandidates.length;
		const isEmployeeSelected = this.selectedEmployees.length;

		if (isCandidateSelected === 0 && isEmployeeSelected === 0) {
			// If there are no filters, use all calendar events
			this.calendarOptions.events = this.calendarEvents;
			return;
		}

		for (const event of this.calendarEvents as EventInput[]) {
			const isMatchCandidate = this.selectedCandidates.includes(event.candidateId);
			const isMatchEmployee = event.employeeIds.some((id: string) => this.selectedEmployees.includes(id));

			if (
				(isMatchCandidate && isMatchEmployee) ||
				(isCandidateSelected > 0 && isMatchCandidate) ||
				(isEmployeeSelected > 0 && isMatchEmployee)
			) {
				events.push(event);
			}
		}

		this.calendarOptions.events = events;
	}

	/**
	 * Opens a dialog for scheduling an interview within the selected date range.
	 * If the dialog closes with data, a success message is displayed.
	 *
	 * @param selectedRange - The date range for scheduling an interview (optional).
	 */
	async add(selectedRange?: IDateRange) {
		try {
			const dialog = this._nbDialogService.open(CandidateInterviewMutationComponent, {
				context: {
					headerTitle: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'),
					isCalendar: true,
					selectedRangeCalendar: selectedRange,
					interviews: this.interviews
				}
			});

			const data = await firstValueFrom(dialog.onClose);
			if (data) {
				this._toastrService.success(`TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED`, { name: data.title });
			}
		} catch (error) {
			// Handle and log errors
			this._errorHandlingService.handleError(error);
		} finally {
			this.subject$.next(true);
		}
	}

	/**
	 * Determines if the date selection is allowed based on the criteria.
	 *
	 * @param param0 - An object containing the start and end dates of the selection.
	 * @returns {boolean} - Returns true if the selection is allowed, false otherwise.
	 */
	selectAllow({ start, end }): boolean {
		return moment(start).isSame(moment(end), 'day');
	}

	/**
	 * Handles the event click action by opening a modal dialog to view the time log details.
	 *
	 * @param param0 - An object containing the clicked event.
	 */
	handleEventClick({ event }: EventClickArg) {
		const id = event._def.extendedProps.id;
		this._nbDialogService.open(CandidateInterviewInfoComponent, {
			context: {
				interviewId: id,
				interviews: this.interviews,
				isSlider: false
			}
		});
	}

	/**
	 * Handles the date click event in the calendar.
	 * If the current view is 'dayGridMonth', changes the view to 'timeGridWeek' starting from the clicked date.
	 *
	 * @param event - The event object containing details about the clicked date.
	 */
	handleDateClick(event: DateClickArg) {
		if (event.view.type === 'dayGridMonth') {
			if (this.calendarComponent) {
				this.calendarComponent.getApi().changeView('timeGridWeek', event.date);
			}
		}
	}

	/**
	 * Handles the event selection in the calendar.
	 * If the selected event's start time is in the future, adds the event. Otherwise, disables the cursor.
	 *
	 * @param event - The event object containing details about the selected event.
	 */
	handleEventSelect(event: DateSelectArg) {
		const now = new Date().getTime();
		if (now < event.start.getTime()) {
			this.add({ start: event.start, end: event.end });
		} else {
			disableCursor();
		}
	}

	/**
	 * Handles the mouse enter event over a calendar event.
	 * Checks if the event element has overflow and, if so, un-sets its position style.
	 *
	 * @param param0 - The event object containing details about the hovered element.
	 */
	handleEventMouseEnter({ el }: EventHoveringArg) {
		if (this.hasOverflow(el.querySelector('.fc-event-main'))) {
			el.style.position = 'unset';
		}
	}

	/**
	 * Handles the mouse leave event over a calendar event.
	 * Removes the style attribute from the event element.
	 *
	 * @param param0 - The event object containing details about the hovered element.
	 */
	handleEventMouseLeave({ el }: EventHoveringArg) {
		el.removeAttribute('style');
	}

	/**
	 * Checks if a given element has overflow.
	 * Temporarily sets the overflow style to 'hidden' if it is not already set,
	 * checks for overflow, and then restores the original overflow style.
	 *
	 * @param el - The element to check for overflow.
	 * @returns A boolean indicating whether the element has overflow.
	 */
	hasOverflow(el: HTMLElement) {
		if (!el) {
			return;
		}
		const curOverflow = el.style ? el.style.overflow : 'hidden';

		if (!curOverflow || curOverflow === 'visible') {
			el.style.overflow = 'hidden';
		}

		const isOverflowing = el.clientWidth < el.scrollWidth || el.clientHeight < el.scrollHeight;

		if (el.style) {
			el.style.overflow = curOverflow;
		}

		return isOverflowing;
	}

	ngOnDestroy() {}
}
