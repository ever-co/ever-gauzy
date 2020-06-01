import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { OptionsInput, EventInput } from '@fullcalendar/core';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
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
			header: {
				left: 'prev,next today',
				center: 'title',
				right: 'timeGridWeek'
			},
			themeSystem: 'bootstrap',
			plugins: [
				dayGridPlugin,
				timeGrigPlugin,
				interactionPlugin,
				bootstrapPlugin
			],
			weekends: true,
			height: 'auto'
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
	closeDialog() {
		this.dialogRef.close();
	}
}
