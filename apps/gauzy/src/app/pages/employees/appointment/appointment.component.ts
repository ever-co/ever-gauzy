import {
	Component,
	ViewChild,
	OnDestroy,
	OnInit,
	forwardRef,
	Input
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
import {
	EmployeeAppointment,
	TimeOff,
	IEventType,
	Employee,
	IAvailabilitySlots
} from '@gauzy/models';
import * as moment from 'moment';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import { AvailabilitySlotsService } from '../../../@core/services/availability-slots.service';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-appointment-calendar',
	templateUrl: './appointment.component.html',
	styleUrls: ['./appointment.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => AppointmentComponent),
			multi: true
		}
	]
})
export class AppointmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@Input('showHeader')
	showHeader: boolean = true;

	@Input('appointmentFormURL')
	appointmentFormURL: string;

	@Input('employee')
	employee: Employee;

	@Input('selectedEventType')
	selectedEventType: IEventType;

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;

	calendarOptions: OptionsInput;
	allowedDuration: number;
	calendarEvents: EventInput[] = [];
	_selectedOrganizationId: string;
	_selectedEmployeeId: string;
	slots: IAvailabilitySlots[];
	dateSpecificSlots: IAvailabilitySlots[];
	recurringSlots: IAvailabilitySlots[];
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
			)
		}
	];

	constructor(
		private router: Router,
		private store: Store,
		private toastrService: NbToastrService,
		private availabilitySlotsService: AvailabilitySlotsService,
		private employeeAppointmentService: EmployeeAppointmentService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this._loadAppointments();

		this.calendarOptions = {
			eventClick: (event) => {
				let eventObject = event.event;
				this.router.navigate(
					[this.appointmentFormURL || this.getRoute('manage')],
					{
						state: {
							dateStart: eventObject.start,
							dateEnd: eventObject.end,
							selectedEventType: this.selectedEventType
						}
					}
				);
			},
			events: this.getEvents.bind(this),
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
			height: 'auto',
			dayHeaderDidMount: (o) => this._prepareSlots(o.date)
		};
	}

	ngOnInit(): void {
		if (this.selectedEventType) {
			this.allowedDuration =
				this.selectedEventType.durationUnit === 'Day(s)'
					? this.selectedEventType.duration * 24 * 60
					: this.selectedEventType.durationUnit === 'Hour(s)'
					? this.selectedEventType.duration * 60
					: this.selectedEventType.duration * 1;
		}

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
				}
			});

		if (this.employee && this.employee.id) {
			this._fetchAvailableSlots();
		}
	}

	getEvents(arg, callback) {
		callback(this.calendarEvents);
	}

	getRoute(name: string) {
		return `/pages/employees/appointments/${name}`;
	}

	private _loadAppointments() {
		const findObj = {
			employee: {
				id: this.store.selectedEmployee
					? this.store.selectedEmployee.id
					: null
			}
		};

		this.employeeAppointmentService
			.getAll(['employee', 'employee.user'], findObj)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((appointments) => {
				console.log(appointments);
			});
	}

	private async _fetchAvailableSlots() {
		const findObj = {
			employee: {
				id: this.employee.id
			}
		};

		try {
			const slots = await this.availabilitySlotsService.getAll(
				[],
				findObj
			);
			this.slots = slots.items;
			this.dateSpecificSlots = this.slots.filter(
				(o) => o.type === 'Default'
			);
			this.recurringSlots = this.slots.filter(
				(o) => o.type === 'Recurring'
			);
			const currentStart = this.calendarComponent.getApi().view
				.currentStart;
			const currentEnd = this.calendarComponent.getApi().view.currentEnd;
			let dayDiff = moment(currentEnd).diff(currentStart, 'days');

			while (dayDiff > 0) {
				this._prepareSlots(
					new Date(moment(currentStart).add(dayDiff, 'days').format())
				);
				dayDiff--;
			}
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('NOTES.AVAILABILITY_SLOTS.ERROR', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	private _prepareSlots(date: Date) {
		if (!this.slots || moment(date).isBefore(moment())) return;
		const day = moment(date).day();

		let foundDateSpecificSlot = false;
		const slot = this.dateSpecificSlots.find(
			(o) =>
				moment(o.startTime).format('MMM Do YY') ===
				moment(date).format('MMM Do YY')
		);
		if (slot) {
			!this.calendarEvents.find(
				(o) =>
					new Date(o.start.toString()).getTime() ===
					new Date(slot.startTime).getTime()
			) &&
				moment(slot.endTime).diff(moment(slot.startTime), 'minutes') >
					this.allowedDuration &&
				this.calendarEvents.push({
					start: new Date(slot.startTime),
					end: new Date(slot.endTime),
					extendedProps: {
						id: slot.id,
						type: 'AvailabilitySlot'
					},
					backgroundColor: 'green'
				});
			foundDateSpecificSlot = true;
		}

		if (foundDateSpecificSlot) return;

		for (const slot of this.recurringSlots) {
			const startDay = moment(slot.startTime).day();
			if (startDay !== day) continue;

			const startHours = moment(slot.startTime).hours();
			const startMinutes = moment(slot.startTime).minutes();

			const endDay = moment(slot.endTime).day();
			const endHours = moment(slot.endTime).hours();
			const endMinutes = moment(slot.endTime).minutes();

			const eventStartDate = moment(date)
				.set('hours', startHours)
				.set('minutes', startMinutes);
			const eventEndDate = moment(date)
				.add(endDay - day, 'days')
				.set('hours', endHours)
				.set('minutes', endMinutes);

			slot.startTime = new Date(eventStartDate.format());
			slot.endTime = new Date(eventEndDate.format());

			!this.calendarEvents.find(
				(o) =>
					new Date(o.start.toString()).getTime() ===
					new Date(slot.startTime).getTime()
			) &&
				eventEndDate.diff(eventStartDate, 'minutes') >
					this.allowedDuration &&
				this.calendarEvents.push({
					start: slot.startTime,
					end: slot.endTime,
					extendedProps: {
						id: slot.id,
						type: 'AvailabilitySlot'
					},
					backgroundColor: 'green'
				});
		}
		this.calendarComponent.getApi().refetchEvents();
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

	markUnavailability() {}

	manageAppointments() {
		this.router.navigate([this.getRoute('manage')]);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
