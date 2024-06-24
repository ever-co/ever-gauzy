import { Component, OnDestroy, ViewChild, OnInit } from '@angular/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, DateSelectArg, EventHoveringArg, EventInput } from '@fullcalendar/core';
import { disableCursor } from '@fullcalendar/core/internal';
import { TranslateService } from '@ngx-translate/core';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { NbDialogService } from '@nebular/theme';
import { filter } from 'rxjs/operators';
import { firstValueFrom, tap } from 'rxjs';
import { IEmployee, IDateRange, ICandidateInterview, IOrganization } from '@gauzy/contracts';
import * as moment from 'moment';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	CandidateInterviewService,
	CandidateInterviewersService,
	CandidateStore,
	EmployeesService,
	ToastrService
} from '@gauzy/ui-core/core';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import * as _ from 'underscore';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { CandidateInterviewInfoComponent, CandidateInterviewMutationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-interview-calendar',
	templateUrl: './interview-calendar.component.html',
	styleUrls: ['./interview-calendar.component.scss']
})
export class InterviewCalendarComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: CalendarOptions;
	selectedInterview = true;
	isCandidate = false;
	candidateList: string[] = [];
	employeeList: string[] = [];
	isEmployee = false;
	employees: IEmployee[] = [];
	calendarEvents: EventInput[] = [];
	interviewList: ICandidateInterview[];
	organization: IOrganization;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly candidateInterviewService: CandidateInterviewService,
		private readonly candidateInterviewersService: CandidateInterviewersService,
		private readonly toastrService: ToastrService,
		private readonly employeesService: EmployeesService,
		private readonly candidateStore: CandidateStore,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.getEmployees();

					this.candidateStore.interviewList$.pipe(untilDestroyed(this)).subscribe(() => {
						this.loadInterviews();
					});
				}
			});
	}

	/**
	 *
	 * @returns
	 */
	getEmployees() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		this.employeesService
			.getAll(['user'], { organizationId, tenantId })
			.pipe(
				tap(({ items }) => {
					this.employees = items;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	async loadInterviews() {
		const { id: organizationId, tenantId } = this.organization;
		const res = await firstValueFrom(
			this.candidateInterviewService.getAll(['interviewers'], { organizationId, tenantId })
		);
		if (res) {
			this.interviewList = res.items;
			this.calendarOptions = {
				eventClick: (event) => {
					const id = event.event._def.extendedProps.id;
					this.dialogService.open(CandidateInterviewInfoComponent, {
						context: {
							interviewId: id,
							interviewList: this.interviewList,
							isSlider: false
						}
					});
				},
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
				selectAllow: ({ start, end }) => moment(start).isSame(moment(end), 'day'),
				select: this.handleEventSelect.bind(this),
				dateClick: this.handleDateClick.bind(this),
				eventMouseEnter: this.handleEventMouseEnter.bind(this),
				eventMouseLeave: this.handleEventMouseLeave.bind(this)
			};

			this.calendarEvents = [];
			for (const interview of res.items) {
				const { interviewers = [] } = interview;
				this.calendarEvents.push({
					title: interview.title,
					start: interview.startTime,
					end: interview.endTime,
					candidateId: interview.candidateId,
					id: interview.id,
					extendedProps: {
						id: interview.id
					},
					backgroundColor: '#36f',
					employeeIds: _.pluck(interviewers, 'employeeId')
				});
			}
			this.mappedCalendarEvents();
		}
	}

	async onCandidateSelected(ids: string[]) {
		this.isCandidate = !ids.length ? false : true;
		this.candidateList = ids;
		this.mappedCalendarEvents();
	}

	async onEmployeeSelected(ids: string[]) {
		this.isEmployee = !ids.length ? false : true;
		this.employeeList = ids;
		this.mappedCalendarEvents();
	}

	async mappedCalendarEvents() {
		let result = [];
		for (const event of this.calendarEvents as EventInput[]) {
			if (this.isCandidate && this.isEmployee) {
				let isMatchCandidate,
					isMatchEmployee = false;
				if (this.candidateList.includes(event.candidateId)) {
					isMatchCandidate = true;
				}
				for (const id of this.employeeList) {
					if (event.employeeIds.includes(id)) {
						isMatchEmployee = true;
					}
				}
				if (isMatchCandidate && isMatchEmployee) {
					result.push(event);
				}
			} else if (this.isCandidate) {
				if (this.candidateList.includes(event.candidateId)) {
					result.push(event);
				}
			} else if (this.isEmployee) {
				let isMatchEmployee = false;
				for (const id of this.employeeList) {
					if (event.employeeIds.includes(id)) {
						isMatchEmployee = true;
					}
				}
				if (isMatchEmployee) {
					result.push(event);
				}
			} else {
				result = this.calendarEvents;
			}
		}
		this.calendarOptions.events = result;
	}

	/**
	 *
	 * @returns
	 */
	async getInterviewers() {
		for (const event of this.calendarOptions.events as EventInput[]) {
			return await this.candidateInterviewersService.findByInterviewId(event.id as string);
		}
	}

	/**
	 *
	 * @param selectedRange
	 */
	async add(selectedRange?: IDateRange) {
		const dialog = this.dialogService.open(CandidateInterviewMutationComponent, {
			context: {
				headerTitle: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'),
				isCalendar: true,
				selectedRangeCalendar: selectedRange,
				interviews: this.interviewList
			}
		});
		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.toastrService.success(`TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED`, {
				name: data.title
			});
			this.loadInterviews();
		}
	}

	/**
	 *
	 * @param event
	 */
	handleDateClick(event: DateClickArg) {
		if (event.view.type === 'dayGridMonth') {
			if (this.calendarComponent) {
				this.calendarComponent.getApi().changeView('timeGridWeek', event.date);
			}
		}
	}

	/**
	 *
	 * @param event
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
	 *
	 * @param param0
	 */
	handleEventMouseEnter({ el }: EventHoveringArg) {
		if (this.hasOverflow(el.querySelector('.fc-event-main'))) {
			el.style.position = 'unset';
		}
	}

	/**
	 *
	 * @param param0
	 */
	handleEventMouseLeave({ el }: EventHoveringArg) {
		el.removeAttribute('style');
	}

	/**
	 *
	 * @param el
	 * @returns
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
