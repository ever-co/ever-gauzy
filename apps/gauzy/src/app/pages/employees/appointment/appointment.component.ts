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
import momentTimezonePlugin from '@fullcalendar/moment-timezone';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import {
	EmployeeAppointment,
	TimeOff,
	IEventType,
	Employee,
	IAvailabilitySlots,
	PermissionsEnum
} from '@gauzy/models';
import * as moment from 'moment';
import { NbDialogService } from '@nebular/theme';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import { AvailabilitySlotsService } from '../../../@core/services/availability-slots.service';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { AppointmentEmployeesService } from '../../../@core/services/appointment-employees.service';
import { TimezoneSelectorComponent } from './timezone-selector/timezone-selector.component';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { first } from 'rxjs/operators';

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

	hasEventTypesViewPermission: boolean = false;
	selectedTimeZoneName = moment.tz.guess();
	selectedTimeZoneOffset = moment.tz(this.selectedTimeZoneName).format('Z');
	calendarOptions: OptionsInput;
	allowedDuration: number;
	calendarEvents: EventInput[] = [];
	_selectedOrganizationId: string;
	_selectedEmployeeId: string;
	slots: IAvailabilitySlots[];
	dateSpecificSlots: IAvailabilitySlots[];
	recurringSlots: IAvailabilitySlots[];
	appointments: EmployeeAppointment[];
	timeOff: TimeOff[];

	constructor(
		private router: Router,
		private store: Store,
		private toastrService: NbToastrService,
		private dialogService: NbDialogService,
		private availabilitySlotsService: AvailabilitySlotsService,
		private employeeAppointmentService: EmployeeAppointmentService,
		private timeOffService: TimeOffService,
		private appointmentEmployeesService: AppointmentEmployeesService,
		readonly translateService: TranslateService
	) {
		super(translateService);

		this.calendarOptions = {
			eventClick: (event) => {
				let eventObject = event.event;
				if (eventObject.extendedProps['type'] !== 'BookedSlot') {
					this.router.navigate(
						[
							this.appointmentFormURL ||
								this.getManageRoute(this._selectedEmployeeId)
						],
						{
							state: {
								dateStart: eventObject.start,
								dateEnd: eventObject.end,
								selectedEventType: this.selectedEventType,
								timezone: this.selectedTimeZoneName
							}
						}
					);
				} else {
					const config = {
						dateStart: eventObject.start,
						dateEnd: eventObject.end,
						timezone: this.selectedTimeZoneName
					};
					const prevSlot = this.calendarEvents.find(
						(o) =>
							new Date(o.end.toString()).getTime() ===
							eventObject.start.getTime()
					);
					const nextSlot = this.calendarEvents.find(
						(o) =>
							new Date(o.start.toString()).getTime() ===
							eventObject.end.getTime()
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
						[
							this.getManageRoute(
								this._selectedEmployeeId,
								eventObject.extendedProps['id']
							)
						],
						{ state: config }
					);
				}
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
				bootstrapPlugin,
				momentTimezonePlugin
			],
			weekends: true,
			height: 'auto',
			dayHeaderDidMount: (o) => this._prepareSlots(o.date)
		};
	}

	ngOnInit(): void {
		this.hasEventTypesViewPermission = this.store.hasPermission(
			PermissionsEnum.EVENT_TYPES_VIEW
		);

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
					if (org.timeZone && !this.selectedEventType) {
						this.selectedTimeZoneName = org.timeZone;
						this.selectedTimeZoneOffset = moment
							.tz(org.timeZone)
							.format('Z');
						const calendarApi = this.calendarComponent.getApi();
						calendarApi &&
							calendarApi.setOption(
								'timeZone',
								this.selectedTimeZoneName
							);
					}
				}
			});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this._selectedEmployeeId = employee.id;
					this.renderAppointmentsAndSlots(this._selectedEmployeeId);
				} else {
					this._selectedEmployeeId = null;
					this.calendarEvents = [];
					this.renderAppointmentsAndSlots(null);
					this.calendarComponent.getApi() &&
						this.calendarComponent.getApi().refetchEvents();
				}
			});

		// only call in case of public appointment booking
		if (this.employee && this.employee.id && this.selectedEventType) {
			this.renderAppointmentsAndSlots(this.employee.id);
		}
	}

	async fetchTimeOff() {
		const data = await this.timeOffService
			.getAllTimeOffRecords(['employees', 'employees.user'], {
				organizationId: this._selectedOrganizationId,
				employeeId: this._selectedEmployeeId || ''
			})
			.pipe(first())
			.toPromise();

		this.timeOff = data.items;
	}

	bookPublicAppointment() {
		this._selectedEmployeeId
			? this.router.navigate([
					`/share/employee/${this._selectedEmployeeId}`
			  ])
			: this.router.navigate(['/share/employee']);
	}

	renderAppointmentsAndSlots(employeeId: string) {
		let findObj;

		if (employeeId) {
			findObj = {
				status: null,
				employee: {
					id: employeeId
				}
			};
		} else {
			findObj = {
				status: null,
				organization: {
					id: this._selectedOrganizationId
				},
				employee: {
					id: null
				}
			};
		}

		this.employeeAppointmentService
			.getAll(['employee', 'employee.user'], findObj)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (appointments) => {
				this.calendarEvents = [];
				this.calendarComponent.getApi().refetchEvents();

				this.appointments = appointments.items;
				await this.fetchTimeOff();
				this.renderBookedAppointments(this.appointments);
				employeeId &&
					(await this.fetchEmployeeAppointments(employeeId));

				this._fetchAvailableSlots(employeeId);
				this.calendarComponent
					.getApi()
					.setOption('timeZone', this.selectedTimeZoneName);
			});
	}

	// fetch appointments where the employee is an invitee
	async fetchEmployeeAppointments(employeeId: string) {
		const employeeAppointments = await this.appointmentEmployeesService
			.findEmployeeAppointments(employeeId)
			.pipe(takeUntil(this._ngDestroy$))
			.toPromise();

		this.renderBookedAppointments(
			employeeAppointments
				.map((o) => o.employeeAppointment)
				.filter((o) => o && o.status !== 'Cancelled')
		);
	}

	renderBookedAppointments(appointments) {
		for (let appointment of appointments) {
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
		return (
			`/pages/employees/appointments/manage/${employeeId}` +
			(appointmentId ? `/${appointmentId}` : '')
		);
	}

	private async _fetchAvailableSlots(employeeId: string) {
		let findObj = {};

		if (employeeId) {
			findObj = {
				employee: {
					id: employeeId
				}
			};
		} else {
			findObj = {
				organization: {
					id: this._selectedOrganizationId
				},
				employee: {
					id: null
				}
			};
		}

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

	openEventTypes() {
		this.router.navigate(['/pages/employees/event-types']);
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
			foundDateSpecificSlot = true;
			this.getAvailabilitySlots(slot);
		}

		if (foundDateSpecificSlot)
			return this.calendarComponent.getApi().refetchEvents();

		for (const innerSlot of this.recurringSlots) {
			const startDay = moment(innerSlot.startTime).day();
			if (startDay !== day) continue;

			const startHours = moment(innerSlot.startTime).hours();
			const startMinutes = moment(innerSlot.startTime).minutes();

			const endDay = moment(innerSlot.endTime).day();
			const endHours = moment(innerSlot.endTime).hours();
			const endMinutes = moment(innerSlot.endTime).minutes();

			const eventStartDate = moment(date)
				.set('hours', startHours)
				.set('minutes', startMinutes);
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

	checkAndAddEventToCalendar(
		startTime: string,
		endTime: string,
		id: string,
		type: string
	) {
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
		!this.calendarEvents.find(
			(o) =>
				new Date(o.start.toString()).getTime() ===
					new Date(startTime).getTime() &&
				new Date(o.end.toString()).getTime() ===
					new Date(endTime).getTime()
		) &&
			(!durationCheck ||
				this._selectedEmployeeId ||
				this._selectedOrganizationId ||
				moment(endTime).diff(moment(startTime), 'minutes') >=
					this.allowedDuration) &&
			this.calendarEvents.push({
				start: new Date(startTime),
				end: new Date(endTime),
				extendedProps: {
					id: id,
					type: type
				},
				backgroundColor: durationCheck ? 'green' : 'red'
			});
	}

	getAvailabilitySlots(slot: IAvailabilitySlots) {
		const appointmentsOnDay = this.appointments
			.filter(
				(o) =>
					moment(o.startDateTime)
						.utc()
						.isSame(moment(slot.startTime).utc()) ||
					moment(o.startDateTime)
						.utc()
						.isBetween(
							moment(slot.startTime).utc(),
							moment(slot.endTime).utc()
						)
			)
			.sort((a, b) =>
				moment(a.startDateTime)
					.utc()
					.isBefore(moment(b.startDateTime).utc())
					? -1
					: 1
			);

		for (let index = 0; index < appointmentsOnDay.length; index++) {
			const appointmentOne = appointmentsOnDay[index];
			const appointmentTwo = appointmentsOnDay[index + 1];
			if (
				moment(appointmentOne.startDateTime)
					.utc()
					.isSame(moment(slot.startTime).utc()) &&
				(!appointmentTwo ||
					moment(appointmentTwo.startDateTime)
						.utc()
						.isAfter(moment(appointmentOne.endDateTime).utc()))
			) {
				this.checkAndAddEventToCalendar(
					moment(appointmentOne.endDateTime).utc().format(),
					moment(
						(appointmentTwo && appointmentTwo.startDateTime) ||
							slot.endTime
					)
						.utc()
						.format(),
					slot.id,
					'AvailabilitySlot'
				);
			} else if (
				moment(appointmentOne.startDateTime)
					.utc()
					.isAfter(moment(slot.startTime).utc())
			) {
				const prevAppointment = appointmentsOnDay[index - 1];
				this.checkAndAddEventToCalendar(
					moment(
						(prevAppointment && prevAppointment.endDateTime) ||
							slot.startTime
					)
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

		appointmentsOnDay.length === 0 &&
			this.checkAndAddEventToCalendar(
				moment(slot.startTime).utc().format(),
				moment(slot.endTime).utc().format(),
				slot.id,
				'AvailabilitySlot'
			);
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

	selectTimezone() {
		this.dialogService
			.open(TimezoneSelectorComponent)
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (data) => {
				if (data) {
					this.selectedTimeZoneName = data;
					this.selectedTimeZoneOffset = moment.tz(data).format('Z');
					this.calendarComponent
						.getApi()
						.setOption('timeZone', this.selectedTimeZoneName);
				}
			});
	}

	markUnavailability() {}

	manageAppointments() {
		this.router.navigate([this.getManageRoute()]);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
