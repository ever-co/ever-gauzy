import {
	Component,
	ViewChild,
	OnDestroy,
	OnInit,
	forwardRef,
	Input,
} from '@angular/core';
import { OptionsInput, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';
import { TranslateService } from '@ngx-translate/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import { EmployeeAppointment, TimeOff } from '@gauzy/models';
import * as moment from 'moment';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import { AvailabilitySlotsService } from '../../../@core/services/availability-slots.service';

@Component({
	selector: 'ga-appointment-calendar',
	templateUrl: './appointment.component.html',
	styleUrls: ['./appointment.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => AppointmentComponent),
			multi: true,
		},
	],
})
export class AppointmentComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@Input('showHeader')
	showHeader: boolean = true;

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: OptionsInput;

	calendarEvents: EventInput[] = [];
	timeOff: TimeOff[] = [
		{
			start: new Date(
				moment()
					.hour(0)
					.minute(0)
					.second(0)
					.subtract(2, 'days')
					.format()
			),
			end: new Date(
				moment()
					.hour(0)
					.minute(0)
					.second(0)
					.subtract(1, 'days')
					.format()
			),
		},
	];

	constructor(
		private router: Router,
		private store: Store,
		private availabilitySlotsService: AvailabilitySlotsService,
		private employeeAppointmentService: EmployeeAppointmentService,
		readonly translateService: TranslateService
	) {
		this._loadAppointments();

		this.calendarOptions = {
			eventClick: (event) => {
				let eventObject = event.event._def;
				this.router.navigate([
					this.getRoute('manage') +
						'/' +
						eventObject.extendedProps.id,
				]);
			},
			initialView: 'timeGridWeek',
			header: {
				left: 'prev,next today',
				center: 'title',
				right: 'timeGridWeek',
			},
			themeSystem: 'bootstrap',
			plugins: [
				dayGridPlugin,
				timeGrigPlugin,
				interactionPlugin,
				bootstrapPlugin,
			],
			selectable: true,
			selectAllow: (select) => moment().diff(select.start) <= 0,
			select: this.handleSelectRange.bind(this),
			weekends: true,
			height: 'auto',
		};
	}

	ngOnInit(): void {}

	handleSelectRange(o) {
		console.log(o);
	}

	getRoute(name: string) {
		return `/pages/employees/appointments/${name}`;
	}

	private _loadAppointments() {
		const findObj = {
			employee: {
				id: this.store.selectedEmployee
					? this.store.selectedEmployee.id
					: null,
			},
		};

		this.employeeAppointmentService
			.getAll(['employee', 'employee.user'], findObj)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((appointments) => {
				console.log(appointments);
				appointments.items.forEach((o) => {
					this._prepareEvent(o);
				});
				this.markUnavailability();
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
					id: appointment.id,
				},
				backgroundColor: 'grey',
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
					id: appointment.id,
				},
				backgroundColor: 'grey',
			});
		}

		if (appointment.breakTimeInMins) {
			let breakEventStartTime = new Date(appointment.breakStartTime);
			this.calendarEvents.push({
				title: appointment.agenda,
				start: eventStartTime,
				end: breakEventStartTime,
				extendedProps: {
					id: appointment.id,
				},
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
					id: appointment.id,
				},
				backgroundColor: 'lightblue',
			});
			this.calendarEvents.push({
				title: appointment.agenda,
				start: afterBreakStartTime,
				end: eventEndTime,
				extendedProps: {
					id: appointment.id,
				},
			});
		} else {
			this.calendarEvents.push({
				title: appointment.agenda,
				start: eventStartTime,
				end: eventEndTime,
				extendedProps: {
					id: appointment.id,
				},
			});
		}
	}

	markUnavailability() {
		this.timeOff.forEach((o) =>
			this.calendarEvents.push({
				start: o.start,
				end: o.end,
				backgroundColor: 'lightyellow',
			})
		);
	}

	manageAppointments() {
		this.router.navigate([this.getRoute('manage')]);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
