import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { OptionsInput, EventInput, disableCursor } from '@fullcalendar/core';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import * as moment from 'moment';
@Component({
	selector: 'ga-candidate-calendar-info',
	templateUrl: './candidate-calendar-info.component.html',
	styleUrls: ['./candidate-calendar-info.component.scss']
})
export class CandidateCalendarInfoComponent implements OnInit {
	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: OptionsInput;
	calendarEvents: EventInput[] = [];
	eventStartTime: Date;
	eventEndTime: Date;
	isPast = false;

	constructor(
		protected dialogRef: NbDialogRef<CandidateCalendarInfoComponent>,
		private candidateInterviewService: CandidateInterviewService
	) {}

	async ngOnInit() {
		this.loadData();
	}
	async loadData() {
		this.calendarOptions = {
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
			eventMouseEnter: this.handleEventMouseEnter.bind(this)
			// eventMouseLeave: this.handleEventMouseLeave.bind(this),
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
	continue() {
		this.dialogRef.close({
			startTime: this.eventStartTime,
			endTime: this.eventEndTime
		});
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
			this.eventStartTime = event.start;
			this.eventEndTime = event.end;
			this.isPast = false;
		} else {
			disableCursor();
			this.isPast = true;
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
	handleDisableCursor() {}
	closeDialog() {
		this.dialogRef.close();
	}
}
