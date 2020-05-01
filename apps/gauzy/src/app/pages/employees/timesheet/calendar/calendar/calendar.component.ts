import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	ElementRef,
	ViewEncapsulation
} from '@angular/core';
import { EventInput, OptionsInput, Calendar } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
@Component({
	selector: 'ngx-calendar',
	templateUrl: './calendar.component.html',
	styleUrls: ['./calendar.component.scss']
	// encapsulation: ViewEncapsulation.None,
})
export class CalendarComponent implements OnInit, AfterViewInit {
	@ViewChild('calendar', { static: true }) calendarEl: ElementRef;

	calendar: Calendar; // the #calendar in the template
	calendarComponent: FullCalendarComponent; // the #calendar in the template

	calendarEvents: EventInput[] = [{ title: 'Event Now', start: new Date() }];
	calendarOptions: OptionsInput = {
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
		events: this.calendarEvents
	};

	constructor() {}

	ngOnInit() {}

	ngAfterViewInit() {
		this.calendar = new Calendar(
			this.calendarEl.nativeElement,
			this.calendarOptions
		);
		this.calendar.render();
	}

	handleDateClick(arg) {}
}
