import { Component, ViewChild, OnDestroy, OnInit } from '@angular/core';
import { OptionsInput, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';
import { TranslateService } from '@ngx-translate/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import bootstrapPlugin from '@fullcalendar/bootstrap';

@Component({
	templateUrl: './appointment.component.html',
	styleUrls: ['./appointment.component.scss']
})
export class AppointmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: OptionsInput;

	calendarEvents: EventInput[] = [];

	constructor(
		private router: Router,
		private employeeAppointmentService: EmployeeAppointmentService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this._loadAppointments();

		this.calendarOptions = {
			eventClick: (event) => {
				let eventObject = event.event._def;
				this.router.navigate([
					this.getRoute('manage') + '/' + eventObject.extendedProps.id
				]);
			},
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
	}

	ngOnInit(): void {}

	getRoute(name: string) {
		return `/pages/employees/appointments/${name}`;
	}

	private _loadAppointments() {
		this.employeeAppointmentService
			.getAll()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((appointments) => {
				appointments.items.forEach((o) => {
					this.calendarEvents.push({
						title: o.agenda,
						start: new Date(o.startDateTime),
						end: new Date(o.endDateTime),
						extendedProps: {
							id: o.id
						}
						// url: o.location
					});
				});
				this.calendarOptions.events = this.calendarEvents;
			});
	}

	manageAppointments() {
		this.router.navigate([this.getRoute('manage')]);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
