import { Component, OnDestroy, ViewChild, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { OptionsInput, EventInput, disableCursor } from '@fullcalendar/core';
import { TranslateService } from '@ngx-translate/core';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { CandidateInterviewInfoComponent } from '../../../@shared/candidate/candidate-interview-info/candidate-interview-info.component';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { CandidateInterviewMutationComponent } from '../../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { first, takeUntil } from 'rxjs/operators';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { Candidate, Employee, IDateRange } from '@gauzy/models';
import { EmployeesService } from '../../../@core/services';
import { CandidateInterviewersService } from '../../../@core/services/candidate-interviewers.service';
import * as moment from 'moment';

@Component({
	selector: 'ga-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: OptionsInput;
	selectedInterview = true;
	isCandidate = false;
	candidateList: EventInput[] = [];
	employeeList: EventInput[] = [];
	isEmployee = false;
	candidates: Candidate[] = [];
	employees: Employee[] = [];
	calendarEvents: EventInput[] = [];
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private candidateInterviewService: CandidateInterviewService,
		private candidateInterviewersService: CandidateInterviewersService,
		private toastrService: NbToastrService,
		private candidatesService: CandidatesService,
		private employeesService: EmployeesService
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.candidatesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidates) => {
				this.candidates = candidates.items;
			});
		this.employeesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
		this.loadInterviews();
	}
	async loadInterviews() {
		this.calendarOptions = {
			eventClick: (event) => {
				const id = event.event._def.extendedProps.id;
				this.dialogService.open(CandidateInterviewInfoComponent, {
					context: {
						interviewId: id
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
			plugins: [
				dayGridPlugin,
				timeGrigPlugin,
				interactionPlugin,
				bootstrapPlugin
			],
			weekends: true,
			height: 'auto',
			selectable: true,
			selectAllow: ({ start, end }) =>
				moment(start).isSame(moment(end), 'day'),
			select: this.handleEventSelect.bind(this),
			dateClick: this.handleDateClick.bind(this),
			eventMouseEnter: this.handleEventMouseEnter.bind(this),
			eventMouseLeave: this.handleEventMouseLeave.bind(this)
		};
		const res = await this.candidateInterviewService.getAll([
			'interviewers'
		]);
		if (res) {
			this.calendarEvents = [];
			for (const interview of res.items) {
				this.calendarEvents.push({
					title: interview.title,
					start: interview.startTime,
					end: interview.endTime,
					candidateId: interview.candidateId,
					id: interview.id,
					extendedProps: {
						id: interview.id
					},
					backgroundColor: '#36f'
				});
			}
			this.calendarOptions.events = this.calendarEvents;
		}
	}

	async onCandidateSelected(ids: string[]) {
		if (!ids[0]) {
			//if no one is selected
			this.isCandidate = false;
			this.calendarOptions.events = this.isEmployee
				? this.employeeList
				: this.calendarEvents;
		} else {
			this.calendarOptions.events = this.isEmployee
				? this.employeeList
				: this.calendarEvents;

			const result = [];
			for (const id of ids) {
				for (const event of this.calendarOptions
					.events as EventInput[]) {
					if (event.candidateId === id) {
						result.push(event);
					}
				}
			}
			this.isCandidate = true;
			this.candidateList = result;
			this.calendarOptions.events = result;
		}
	}
	async onEmployeeSelected(ids: string[]) {
		if (!ids[0]) {
			this.isEmployee = false;
			this.calendarOptions.events = this.isCandidate
				? this.candidateList
				: this.calendarEvents;
		} else {
			this.calendarOptions.events = this.isCandidate
				? this.candidateList
				: this.calendarEvents;

			const result = [];

			for (const event of this.calendarOptions.events as EventInput[]) {
				const res = await this.candidateInterviewersService.findByInterviewId(
					event.id as string
				);
				if (res) {
					for (const item of res) {
						for (const id of ids) {
							if (item.employeeId === id) {
								result.push(event);
							}
						}
					}
				}
			}
			this.employeeList = result;
			this.calendarOptions.events = result;
			this.isEmployee = true;
		}
	}

	async getInterviewers() {
		for (const event of this.calendarOptions.events as EventInput[]) {
			return await this.candidateInterviewersService.findByInterviewId(
				event.id as string
			);
		}
	}
	async add(selectedRange?: IDateRange) {
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'
					),
					isCalendar: true,
					selectedRangeCalendar: selectedRange
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrService.success(
				this.getTranslation('TOASTR.TITLE.SUCCESS'),
				this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED`)
			);
			this.loadInterviews();
		}
	}
	handleDateClick(event) {
		if (event.view.type === 'dayGridMonth') {
			this.calendarComponent
				.getApi()
				.changeView('timeGridWeek', event.date);
		}
	}

	handleEventSelect(event) {
		const now = new Date().getTime();
		if (now < event.start.getTime()) {
			this.add({ start: event.start, end: event.end });
		} else {
			disableCursor();
		}
	}

	handleEventMouseEnter({ el }) {
		if (this.hasOverflow(el.querySelector('.fc-event-main'))) {
			el.style.position = 'unset';
		}
	}
	handleEventMouseLeave({ el }) {
		el.removeAttribute('style');
	}

	hasOverflow(el: HTMLElement) {
		if (!el) {
			return;
		}
		const curOverflow = el.style ? el.style.overflow : 'hidden';

		if (!curOverflow || curOverflow === 'visible') {
			el.style.overflow = 'hidden';
			el.style.backgroundColor = '#3366ff';
		}

		const isOverflowing =
			el.clientWidth < el.scrollWidth ||
			el.clientHeight < el.scrollHeight;

		if (el.style) {
			el.style.overflow = curOverflow;
		}

		return isOverflowing;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
