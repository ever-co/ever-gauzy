import { Component, OnInit, ViewChild } from '@angular/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import bootstrapPlugin from '@fullcalendar/bootstrap';
@Component({
	selector: 'ngx-calendar',
	templateUrl: './calendar.component.html',
	styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent; // the #calendar in the template

	calendarVisible = true;
	calendarPlugins = [
		//	dayGridPlugin,
		timeGrigPlugin,
		interactionPlugin,
		bootstrapPlugin
	];
	calendarWeekends = true;
	calendarEvents: EventInput[] = [{ title: 'Event Now', start: new Date() }];

	constructor() {}

	ngOnInit() {}

	handleDateClick(arg) {}
}
