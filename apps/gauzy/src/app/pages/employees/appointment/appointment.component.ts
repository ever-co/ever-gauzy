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
import { EmployeeAppointment } from '@gauzy/models';
import * as moment from 'moment';

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
					this._prepareEvent(o);
				});
				this.calendarOptions.events = this.calendarEvents;
			});
	}

	private _prepareEvent(appointment: EmployeeAppointment) {
		let eventStartTime = appointment.startDateTime;
		let eventEndTime = appointment.endDateTime;

		if (appointment.bufferTimeStart) {
			eventStartTime = new Date(
				moment(appointment.startDateTime)
					.add(
						appointment.bufferTimeInMins as moment.DurationInputArg1,
						'minutes'
					)
					.format()
			);
			this.calendarEvents.push({
				title: `Buffer for ${appointment.agenda}`,
				start: new Date(moment(appointment.startDateTime).format()),
				end: eventStartTime,
				extendedProps: {
					id: appointment.id
				},
				backgroundColor: 'grey'
			});
		}

		if (appointment.bufferTimeEnd) {
			eventEndTime = new Date(
				moment(appointment.endDateTime)
					.subtract(
						appointment.bufferTimeInMins as moment.DurationInputArg1,
						'minutes'
					)
					.format()
			);
			this.calendarEvents.push({
				title: `Buffer for ${appointment.agenda}`,
				start: eventEndTime,
				end: new Date(moment(appointment.endDateTime).format()),
				extendedProps: {
					id: appointment.id
				},
				backgroundColor: 'grey'
			});
		}

		if (appointment.breakTimeInMins) {
			let breakEventStartTime = new Date(appointment.breakStartTime);
			this.calendarEvents.push({
				title: appointment.agenda,
				start: eventStartTime,
				end: breakEventStartTime,
				extendedProps: {
					id: appointment.id
				}
			});

			let afterBreakStartTime = new Date(
				moment(breakEventStartTime)
					.add(
						appointment.breakTimeInMins as moment.DurationInputArg1,
						'minutes'
					)
					.format()
			);
			this.calendarEvents.push({
				title: `Break Time ${appointment.agenda}`,
				start: breakEventStartTime,
				end: afterBreakStartTime,
				extendedProps: {
					id: appointment.id
				},
				backgroundColor: 'lightblue'
			});
			this.calendarEvents.push({
				title: appointment.agenda,
				start: afterBreakStartTime,
				end: eventEndTime,
				extendedProps: {
					id: appointment.id
				}
			});
		} else {
			this.calendarEvents.push({
				title: appointment.agenda,
				start: eventStartTime,
				end: eventEndTime,
				extendedProps: {
					id: appointment.id
				}
			});
		}
	}

	manageAppointments() {
		this.router.navigate([this.getRoute('manage')]);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
