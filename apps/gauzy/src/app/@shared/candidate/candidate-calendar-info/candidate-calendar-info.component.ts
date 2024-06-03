import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, EventInput, DateSelectArg, EventHoveringArg } from '@fullcalendar/core';
import { disableCursor } from '@fullcalendar/core/internal';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { IOrganization } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';
import { CandidateInterviewService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-candidate-interviews-calendar-info',
	templateUrl: './candidate-calendar-info.component.html',
	styleUrls: ['./candidate-calendar-info.component.scss']
})
export class CandidateCalendarInfoComponent implements OnInit {
	@ViewChild('calendar', { static: true }) calendar: FullCalendarComponent;

	calendarOptions: CalendarOptions;
	calendarEvents: EventInput[] = [];

	eventStartTime: Date;
	eventEndTime: Date;
	isPast: boolean = false;
	titleText: string;
	employeeNames: string;

	public organization: IOrganization;

	constructor(
		protected readonly dialogRef: NbDialogRef<CandidateCalendarInfoComponent>,
		private readonly candidateInterviewService: CandidateInterviewService,
		private readonly store: Store
	) {
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
			selectAllow: ({ start, end }) => moment(start).isSame(moment(end), 'day'),
			select: this.handleEventSelect.bind(this),
			dateClick: this.handleDateClick.bind(this),
			eventMouseEnter: this.handleEventMouseEnter.bind(this),
			eventMouseLeave: this.handleEventMouseLeave.bind(this)
		};
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getCandidateInterviewes()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * GET candidate calendar interview events
	 *
	 * @returns
	 */
	async getCandidateInterviewes() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const interviews = (
			await this.candidateInterviewService.getAll(['interviewers'], {
				tenantId,
				organizationId
			})
		).items;

		this.calendarEvents = [];
		for (const interview of interviews) {
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

	/**
	 * Continue with selected date range times
	 *
	 * @returns
	 */
	continue() {
		if (this.isPastDates()) {
			return;
		}
		this.dialogRef.close({
			startTime: this.eventStartTime,
			endTime: this.eventEndTime
		});
	}

	handleDateClick(event: DateClickArg) {
		if (event.view.type === 'dayGridMonth') {
			this.calendar.getApi().changeView('timeGridWeek', event.date);
		}
	}

	handleEventSelect(event: DateSelectArg) {
		this.eventStartTime = event.start;
		this.eventEndTime = event.end;

		if (this.isPastDates()) {
			disableCursor();
			this.isPast = true;
		} else {
			this.isPast = false;
		}
	}

	handleEventMouseEnter({ el }: EventHoveringArg) {
		if (this.hasOverflow(el.querySelector('.fc-event-main'))) {
			el.style.position = 'unset';
		}
	}

	handleEventMouseLeave({ el }: EventHoveringArg) {
		el.removeAttribute('style');
	}

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

	closeDialog() {
		this.dialogRef.close();
	}

	/**
	 * If, selected date range is past
	 *
	 * @returns {Boolean}
	 */
	isPastDates(): boolean {
		if (!this.eventStartTime) {
			return;
		}
		return moment(this.eventStartTime).diff(moment()) < 0;
	}
}
