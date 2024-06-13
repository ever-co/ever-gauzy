import { Component, ViewChild, OnDestroy, OnInit, forwardRef, Input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import { FullCalendarComponent } from '@fullcalendar/angular';
import momentTimezonePlugin from '@fullcalendar/moment-timezone';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import moment from 'moment';
import * as timezone from 'moment-timezone';
import {
	AppointmentEmployeesService,
	AvailabilitySlotsService,
	EmployeeAppointmentService,
	TimeOffService,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	IEmployeeAppointment,
	ITimeOff,
	IEventType,
	IEmployee,
	IAvailabilitySlot,
	IOrganization,
	WeekDaysEnum
} from '@gauzy/contracts';
import { Store, convertLocalToTimezone } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { dayOfWeekAsString } from '@gauzy/ui-core/shared';
import { TimezoneSelectorComponent } from './timezone-selector/timezone-selector.component';

@UntilDestroy({ checkProperties: true })
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
export class AppointmentComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	organization: IOrganization;

	@Input()
	showHeader: boolean = true;

	@Input()
	appointmentFormURL: string;

	@Input()
	employee: IEmployee;

	@Input()
	selectedEventType: IEventType;

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;

	selectedTimeZoneName = timezone.tz.guess();
	selectedTimeZoneOffset = timezone.tz(this.selectedTimeZoneName).format('Z');
	calendarOptions: CalendarOptions;
	allowedDuration: number;
	calendarEvents: EventInput[] = [];
	_selectedOrganizationId: string;
	_selectedEmployeeId: string;
	slots: IAvailabilitySlot[];
	dateSpecificSlots: IAvailabilitySlot[];
	recurringSlots: IAvailabilitySlot[];
	appointments: IEmployeeAppointment[];
	timeOff: ITimeOff[];
	hiddenDays: number[] = [];
	headerToolbarOptions: {
		left: string;
		center: string;
		right: string;
	} = {
		left: 'next',
		center: 'title',
		right: 'dayGridMonth,timeGridWeek'
	};

	constructor(
		private router: Router,
		private store: Store,
		private toastrService: ToastrService,
		private dialogService: NbDialogService,
		private availabilitySlotsService: AvailabilitySlotsService,
		private employeeAppointmentService: EmployeeAppointmentService,
		private timeOffService: TimeOffService,
		private appointmentEmployeesService: AppointmentEmployeesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.getCalendarOption();
		this.calendarEvents = [];
		if (this.selectedEventType) {
			this.allowedDuration =
				this.selectedEventType.durationUnit === 'Day(s)'
					? this.selectedEventType.duration * 24 * 60
					: this.selectedEventType.durationUnit === 'Hour(s)'
					? this.selectedEventType.duration * 60
					: this.selectedEventType.duration * 1;
		}
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				if (org) {
					this.organization = org;
					this._selectedOrganizationId = org.id;
					if (org.timeZone && !this.selectedEventType) {
						this.selectedTimeZoneName = org.timeZone;
						this.selectedTimeZoneOffset = timezone.tz(org.timeZone).format('Z');
					}
				}
			});
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				untilDestroyed(this),
				debounceTime(500)
			)
			.subscribe((employee) => {
				// Will only call in case of public appointment booking
				if (this.employee && this.employee.id && this.selectedEventType) {
					return this.renderAppointmentsAndSlots(this.employee.id);
				}

				if (employee && employee.id) {
					this._selectedEmployeeId = employee.id;
					this.renderAppointmentsAndSlots(this._selectedEmployeeId);
				} else {
					this._selectedEmployeeId = null;
					this.renderAppointmentsAndSlots(null);
					if (this.calendarComponent.getApi()) {
						this.calendarComponent.getApi().refetchEvents();
					}
				}
			});
	}

	getCalendarOption() {
		// Get yesterday's day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
		let currentDay = moment().subtract(1, 'day').day();

		// Loop to hide days from yesterday until Sunday
		while (currentDay >= 0) {
			this.hiddenDays.push(currentDay);
			currentDay--;
		}
		this.calendarOptions = {
			eventClick: (event) => {
				const eventObject = event.event;
				if (eventObject.extendedProps['type'] !== 'BookedSlot') {
					this.router.navigate([this.appointmentFormURL || this.getManageRoute(this._selectedEmployeeId)], {
						state: {
							dateStart: eventObject.start,
							dateEnd: eventObject.end,
							selectedEventType: this.selectedEventType,
							timezone: this.selectedTimeZoneName
						}
					});
				} else {
					const config = {
						dateStart: eventObject.start,
						dateEnd: eventObject.end,
						timezone: this.selectedTimeZoneName
					};
					const prevSlot = this.calendarEvents.find(
						(o) => new Date(o.end.toString()).getTime() === eventObject.start.getTime()
					);
					const nextSlot = this.calendarEvents.find(
						(o) => new Date(o.start.toString()).getTime() === eventObject.end.getTime()
					);

					if (
						prevSlot &&
						nextSlot &&
						nextSlot.extendedProps['type'] !== 'BookedSlot' &&
						prevSlot.extendedProps['type'] !== 'BookedSlot'
					) {
						config.dateStart = new Date(prevSlot.start.toString());
						config.dateEnd = new Date(nextSlot.end.toString());
					}

					this.router.navigate(
						[this.getManageRoute(this._selectedEmployeeId, eventObject.extendedProps['id'])],
						{ state: config }
					);
				}
			},
			events: this.getEvents.bind(this),
			initialView: 'timeGridWeek',
			headerToolbar: this.headerToolbarOptions,
			hiddenDays: this.hiddenDays,
			themeSystem: 'bootstrap',
			plugins: [dayGridPlugin, timeGrigPlugin, interactionPlugin, bootstrapPlugin, momentTimezonePlugin],
			weekends: true,
			height: 'auto',
			dayHeaderDidMount: this.headerMount.bind(this),
			firstDay: dayOfWeekAsString(this.store?.selectedOrganization?.startWeekOn || WeekDaysEnum.MONDAY)
		};
	}

	async fetchTimeOff() {
		const data = await firstValueFrom(
			this.timeOffService.getAllTimeOffRecords(['employees', 'employees.user'], {
				organizationId: this._selectedOrganizationId,
				tenantId: this.organization.tenantId,
				employeeId: this._selectedEmployeeId || (this.employee && this.employee.id) || null
			})
		);

		this.timeOff = data.items;
	}

	bookPublicAppointment() {
		this._selectedEmployeeId
			? this.router.navigate([`/share/employee/${this._selectedEmployeeId}`])
			: this.router.navigate(['/share/employee']);
	}

	renderAppointmentsAndSlots(employeeId: string) {
		const { tenantId } = this.store.user;
		const findObj = {
			status: null,
			organizationId: this.organization.id,
			tenantId,
			employeeId: employeeId || null
		};

		this.employeeAppointmentService
			.getAll(['employee', 'employee.user'], findObj)
			.pipe(untilDestroyed(this))
			.subscribe(async (appointments) => {
				this.calendarEvents = [];
				this.calendarComponent.getApi().refetchEvents();
				this.appointments = appointments.items;
				await this.fetchTimeOff();
				this.renderBookedAppointments(this.appointments);
				if (employeeId) {
					await this.fetchEmployeeAppointments(employeeId);
				}
				await this._fetchAvailableSlots(employeeId);
			});
	}

	// fetch appointments where the employee is an invitee
	async fetchEmployeeAppointments(employeeId: string) {
		const employeeAppointments = await firstValueFrom(
			this.appointmentEmployeesService.findEmployeeAppointments(employeeId).pipe(untilDestroyed(this))
		);
		this.renderBookedAppointments(
			employeeAppointments.map((o) => o.employeeAppointment).filter((o) => o && o.status !== 'Cancelled')
		);
	}

	renderBookedAppointments(appointments) {
		for (const appointment of appointments) {
			this.checkAndAddEventToCalendar(
				moment(appointment.startDateTime).utc().format(),
				moment(appointment.endDateTime).utc().format(),
				appointment.id,
				'BookedSlot'
			);
		}
	}

	getEvents(arg, callback) {
		callback(this.calendarEvents);
	}

	getManageRoute(employeeId: string = '', appointmentId: string = '') {
		return `/pages/employees/appointments/manage/${employeeId}` + (appointmentId ? `/${appointmentId}` : '');
	}

	private async _fetchAvailableSlots(employeeId: string) {
		const { tenantId } = this.store.user;
		const findObj = {
			organizationId: this._selectedOrganizationId,
			tenantId,
			employeeId: employeeId || null
		};

		try {
			const slots = await this.availabilitySlotsService.getAll([], findObj);
			this.slots = slots.items;
			this.dateSpecificSlots = this.slots.filter((o) => o.type === 'Default');
			this.recurringSlots = this.slots.filter((o) => o.type === 'Recurring');
			const currentStart = this.calendarComponent.getApi().view.currentStart;
			const currentEnd = this.calendarComponent.getApi().view.currentEnd;
			let dayDiff = moment(currentEnd).diff(currentStart, 'days');

			while (dayDiff > 0) {
				this._prepareSlots(new Date(moment(currentStart).add(dayDiff, 'days').format()));
				dayDiff--;
			}
		} catch (error) {
			this.toastrService.danger('NOTES.AVAILABILITY_SLOTS.ERROR', null, {
				error: error.error.message || error.message
			});
		}
	}

	openEventTypes() {
		this.router.navigate(['/pages/employees/event-types']);
	}

	headerMount(config) {
		const currentStart = this.calendarComponent.getApi().view.currentStart;
		const currentEnd = this.calendarComponent.getApi().view.currentEnd;
		const hideDays = moment().isBetween(currentStart, currentEnd, 'day', '[]') ? this.hiddenDays : [];
		this.calendarComponent.getApi().setOption('hiddenDays', hideDays);
		this.headerToolbarOptions.left = moment(currentStart).isSameOrBefore(moment(), 'day') ? 'next' : 'prev,next';
		this.calendarComponent.getApi().setOption('headerToolbar', this.headerToolbarOptions);
	}

	private _prepareSlots(date: Date) {
		if (!this.slots || moment(date).isBefore(moment())) return;
		const day = moment(date).day();

		let foundDateSpecificSlot = false;
		const slot = this.dateSpecificSlots.find(
			(o) => moment(o.startTime).format('MMM Do YY') === moment(date).format('MMM Do YY')
		);

		if (slot) {
			foundDateSpecificSlot = true;
			this.getAvailabilitySlots(slot);
		}

		if (foundDateSpecificSlot) return this.calendarComponent.getApi().refetchEvents();

		for (const innerSlot of this.recurringSlots) {
			const startDay = moment(innerSlot.startTime).day();
			if (startDay !== day) continue;

			const startHours = moment(innerSlot.startTime).hours();
			const startMinutes = moment(innerSlot.startTime).minutes();

			const endDay = moment(innerSlot.endTime).day();
			const endHours = moment(innerSlot.endTime).hours();
			const endMinutes = moment(innerSlot.endTime).minutes();

			const eventStartDate = moment(date).set('hours', startHours).set('minutes', startMinutes);
			const eventEndDate = moment(date)
				.add(endDay - day, 'days')
				.set('hours', endHours)
				.set('minutes', endMinutes);

			innerSlot.startTime = new Date(eventStartDate.format());
			innerSlot.endTime = new Date(eventEndDate.format());

			this.getAvailabilitySlots(innerSlot);
		}
		this.calendarComponent.getApi().refetchEvents();
	}

	checkAndAddEventToCalendar(startTime: string, endTime: string, id: string, type: string) {
		if (
			startTime === endTime ||
			new Date(startTime).getTime() < new Date().getTime() ||
			this.timeOff.find(
				(o) =>
					o.status === 'Approved' &&
					(moment(startTime).isBetween(o.start, o.end, 'day', '[]') ||
						moment(endTime).isBetween(o.start, o.end, 'day', '[]'))
			)
		)
			return;

		const durationCheck = type === 'AvailabilitySlot' ? true : false;
		const find = this.calendarEvents.find(
			(o) =>
				new Date(o.start.toString()).getTime() === new Date(startTime).getTime() &&
				new Date(o.end.toString()).getTime() === new Date(endTime).getTime()
		);
		const allowedDuration = moment(endTime).diff(moment(startTime), 'minutes') >= this.allowedDuration;
		if (!find || !durationCheck || this._selectedEmployeeId || this._selectedOrganizationId || allowedDuration) {
			const startDate = moment(convertLocalToTimezone(startTime, null, this.selectedTimeZoneName)).format(
				'YYYY-MM-DD hh:mm:ss'
			);
			const endDate = moment(convertLocalToTimezone(endTime, null, this.selectedTimeZoneName)).format(
				'YYYY-MM-DD hh:mm:ss'
			);

			this.calendarEvents.push({
				start: startDate,
				end: endDate,
				extendedProps: {
					id: id,
					type: type
				},
				backgroundColor: durationCheck ? 'green' : 'red'
			});
		}
	}

	getAvailabilitySlots(slot: IAvailabilitySlot) {
		const appointmentsOnDay = this.appointments
			.filter(
				(o) =>
					moment(o.startDateTime).utc().isSame(moment(slot.startTime).utc()) ||
					moment(o.startDateTime).utc().isBetween(moment(slot.startTime).utc(), moment(slot.endTime).utc())
			)
			.sort((a, b) => (moment(a.startDateTime).utc().isBefore(moment(b.startDateTime).utc()) ? -1 : 1));

		for (let index = 0; index < appointmentsOnDay.length; index++) {
			const appointmentOne = appointmentsOnDay[index];
			const appointmentTwo = appointmentsOnDay[index + 1];
			if (
				moment(appointmentOne.startDateTime).utc().isSame(moment(slot.startTime).utc()) &&
				(!appointmentTwo ||
					moment(appointmentTwo.startDateTime).utc().isAfter(moment(appointmentOne.endDateTime).utc()))
			) {
				this.checkAndAddEventToCalendar(
					moment(appointmentOne.endDateTime).utc().format(),
					moment((appointmentTwo && appointmentTwo.startDateTime) || slot.endTime)
						.utc()
						.format(),
					slot.id,
					'AvailabilitySlot'
				);
			} else if (moment(appointmentOne.startDateTime).utc().isAfter(moment(slot.startTime).utc())) {
				const prevAppointment = appointmentsOnDay[index - 1];
				this.checkAndAddEventToCalendar(
					moment((prevAppointment && prevAppointment.endDateTime) || slot.startTime)
						.utc()
						.format(),
					moment(appointmentOne.startDateTime).utc().format(),
					slot.id,
					'AvailabilitySlot'
				);
				if (!appointmentTwo) {
					this.checkAndAddEventToCalendar(
						moment(appointmentOne.endDateTime).utc().format(),
						moment(slot.endTime).utc().format(),
						slot.id,
						'AvailabilitySlot'
					);
				}
			}
		}
		if (appointmentsOnDay.length === 0) {
			this.checkAndAddEventToCalendar(
				moment(slot.startTime).utc().format(),
				moment(slot.endTime).utc().format(),
				slot.id,
				'AvailabilitySlot'
			);
		}
	}

	private _prepareEvent(appointment: IEmployeeAppointment) {
		let eventStartTime = appointment.startDateTime;
		let eventEndTime = appointment.endDateTime;

		if (appointment.bufferTimeStart) {
			eventStartTime = new Date(
				moment(appointment.startDateTime)
					.add(appointment.bufferTimeInMins as moment.DurationInputArg1, 'minutes')
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
					.subtract(appointment.bufferTimeInMins as moment.DurationInputArg1, 'minutes')
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
			const breakEventStartTime = new Date(appointment.breakStartTime);
			this.calendarEvents.push({
				title: appointment.agenda,
				start: eventStartTime,
				end: breakEventStartTime,
				extendedProps: {
					id: appointment.id
				}
			});

			const afterBreakStartTime = new Date(
				moment(breakEventStartTime)
					.add(appointment.breakTimeInMins as moment.DurationInputArg1, 'minutes')
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

	selectTimezone() {
		this.dialogService
			.open(TimezoneSelectorComponent, {
				context: {
					selectedTimezone: this.selectedTimeZoneName
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				if (data) {
					this.selectedTimeZoneName = data;
					this.selectedTimeZoneOffset = timezone.tz(data).format('Z');
					this.setCalenderTimezone(this.selectedTimeZoneName);
				}
			});
	}

	markUnavailability() {}

	/*
	 * Set calender timezone option
	 */
	setCalenderTimezone(timeZone: string) {
		if (this.calendarComponent) {
			if (this._selectedEmployeeId) {
				this.renderAppointmentsAndSlots(this._selectedEmployeeId);
			} else {
				this._selectedEmployeeId = null;
				this.calendarEvents = [];
				this.renderAppointmentsAndSlots(null);
				if (this.calendarComponent.getApi()) {
					this.calendarComponent.getApi().refetchEvents();
				}
			}
		}
	}

	manageAppointments() {
		this.router.navigate([this.getManageRoute()]);
	}

	ngOnDestroy() {}
}
