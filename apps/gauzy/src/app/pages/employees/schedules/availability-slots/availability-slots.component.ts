import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import * as moment from 'moment';
import {
	IAvailabilitySlotsCreateInput,
	ITimeOff,
	IAvailabilitySlotsView,
	IOrganization,
	IRolePermission
} from '@gauzy/models';
import { Store } from '../../../../@core/services/store.service';
import { AvailabilitySlotsService } from '../../../../@core/services/availability-slots.service';
import { first, filter } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from '../../../../@core/services/error-handling.service';
import {
	EmployeeSelectorComponent,
	SelectedEmployee
} from '../../../../@theme/components/header/selectors/employee/employee.component';
import { TimeOffService } from '../../../../@core/services/time-off.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './availability-slots.component.html'
})
export class AvailabilitySlotsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('calendar', { static: false })
	calendar: FullCalendarComponent;
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;

	calendarComponent: FullCalendarComponent;
	calendarEvents: EventInput[] = [];
	calendarOptions: CalendarOptions;

	private firstLoad: boolean = true;
	recurringAvailabilityMode: boolean = false;
	_selectedOrganizationId: string;
	selectedEmployeeId: string;
	dateSelected: boolean;
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
	removedEvents: EventInput[] = [];
	timeOff: ITimeOff[];
	public loading: boolean = true;
	organization: IOrganization;

	createForm = {
		startTime: '00:00',
		endTime: '00:00'
	};

	constructor(
		private store: Store,
		private route: ActivatedRoute,
		private errorHandler: ErrorHandlingService,
		private toastrService: NbToastrService,
		private availabilitySlotsService: AvailabilitySlotsService,
		private timeOffService: TimeOffService,
		readonly translateService: TranslateService,
		private readonly ngxPermissionsService: NgxPermissionsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.getCalendarOption();
		if (
			this.route.snapshot['_routerState'].url.includes(
				'recurring-availability'
			)
		) {
			this.recurringAvailabilityMode = true;
			delete this.calendarOptions.selectAllow;

			this.calendarOptions.dayHeaderFormat = { weekday: 'long' };
			this.calendarOptions.headerToolbar = {
				center: '',
				right: '',
				left: ''
			};
			this.calendarOptions.hiddenDays = [];
		}

		this.calendarEvents = [];
		this.selectedEmployeeId =
			this.selectedEmployeeId ||
			(this.store.selectedEmployee && this.store.selectedEmployee.id);

		this.store.userRolePermissions$
			.pipe(
				filter(
					(permissions: IRolePermission[]) => permissions.length > 0
				),
				untilDestroyed(this)
			)
			.subscribe((data) => {
				const permissions = data.map(({ permission }) => permission);
				this.ngxPermissionsService.loadPermissions(permissions);
			});

		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				this.organization = org;
				this._selectedOrganizationId = org.id;
				this.fetchAvailableSlots();

				if (org.defaultStartTime) {
					this.createForm.startTime = org.defaultStartTime;
				}
				if (org.defaultEndTime) {
					this.createForm.endTime = org.defaultEndTime;
				}
			});

		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				this.onEmployeeChange(employee);
			});
	}

	/*
	 * Get calendar option
	 */
	getCalendarOption() {
		let currentDay = moment().day();
		while (currentDay > 0) {
			this.hiddenDays.push(currentDay--);
		}
		this.calendarOptions = {
			initialView: 'timeGridWeek',
			headerToolbar: this.headerToolbarOptions,
			themeSystem: 'bootstrap',
			plugins: [
				dayGridPlugin,
				timeGrigPlugin,
				interactionPlugin,
				bootstrapPlugin
			],
			weekends: true,
			selectable: true,
			height: 'auto',
			selectOverlap: false,
			events: this.getEvents.bind(this),
			editable: true,
			eventOverlap: false,
			hiddenDays: this.hiddenDays,
			dayHeaderDidMount: this.headerMount.bind(this),
			eventClick: this.unselectEvent.bind(this),
			selectAllow: (select) => moment().diff(select.start) <= 0,
			select: this.handleSelectRange.bind(this),
			eventDrop: this.dragDropEvent.bind(this)
		};
	}

	/*
	 * Schedule Drag & Drop Event Calendar
	 */
	dragDropEvent($event) {
		const event = $event.event;
		const { id } = event.extendedProps;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const input = {
			startTime: event.start,
			endTime: event.end,
			type: this.recurringAvailabilityMode ? 'Recurring' : 'Default',
			allDay: event.allDay,
			employeeId: this.selectedEmployeeId,
			organizationId,
			tenantId
		};
		if (event.allDay) {
			input['endTime'] = new Date(
				moment(event.start).endOf('day').format('YYYY-MM-DD hh:mm:ss')
			);
		}
		this.availabilitySlotsService.update(id, { ...input });
	}

	headerMount(config) {
		if (this.calendar && !this.recurringAvailabilityMode) {
			const currentStart = this.calendar.getApi().view.currentStart;
			const currentEnd = this.calendar.getApi().view.currentEnd;
			const hideDays = moment().isBetween(
				currentStart,
				currentEnd,
				'day',
				'[]'
			)
				? this.hiddenDays
				: [];
			this.calendar.getApi().setOption('hiddenDays', hideDays);
			this.headerToolbarOptions.left = moment(
				currentStart
			).isSameOrBefore(moment(), 'day')
				? 'next'
				: 'prev,next';
			this.calendar
				.getApi()
				.setOption('headerToolbar', this.headerToolbarOptions);

			this.renderTimeOff(config.date);
		}
	}

	renderTimeOff(date) {
		const isDayOff = this.timeOff.find(
			(o) =>
				o.status === 'Approved' &&
				moment(date).isBetween(o.start, o.end, 'date', '[]')
		);
		if (isDayOff) {
			this._prepareEvent(
				{
					startTime: date,
					endTime: date,
					allDay: true
				},
				isDayOff
			);
		}
	}

	onEmployeeChange(selectedEmployee: SelectedEmployee) {
		if (this.firstLoad) return;
		if (selectedEmployee && selectedEmployee.id) {
			this.selectedEmployeeId = selectedEmployee.id;
			this.fetchAvailableSlots();
		} else {
			this.selectedEmployeeId = null;
			if (this._selectedOrganizationId) {
				this.fetchAvailableSlots();
			}
		}
	}

	getEvents(arg, callback) {
		if (!this.organization) {
			return null;
		}
		callback(this.calendarEvents);
	}

	unselectEvent(o) {
		if (o.event.extendedProps && o.event.extendedProps.isDayOff) return;
		if (o.event.extendedProps && o.event.extendedProps.id) {
			this.removedEvents.push(o.event);
			this.dateSelected = true;
			this.saveSelectedDateRange();
		}
		this.calendarEvents = this.calendarEvents.filter(
			(e) => !moment(e.start).isSame(moment(o.event.start))
		);

		this.calendar.getApi().refetchEvents();
	}

	handleSelectRange(o) {
		this.dateSelected = true;

		this._prepareEvent({
			startTime: o.start,
			endTime: o.end,
			allDay: o.allDay
		});

		this.saveSelectedDateRange();
	}

	async setSchedule() {
		const payload: IAvailabilitySlotsCreateInput[] = [];
		const calender = this.calendar.getApi();
		const range = calender.getCurrentData().dateProfile.currentRange;
		let start = range.start;
		while (start < range.end) {
			const date = moment(start).format('YYYY-MM-DD');
			payload.push({
				startTime: moment(
					date + ' ' + this.createForm.startTime
				).toDate(),
				endTime: moment(date + ' ' + this.createForm.endTime).toDate(),
				employeeId: this.selectedEmployeeId,
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId,
				type: this.recurringAvailabilityMode ? 'Recurring' : 'Default',
				allDay: false
			});
			start = moment(start).add(1, 'day').toDate();
		}

		await this.availabilitySlotsService.createBulk(payload);
		this.fetchAvailableSlots();
	}

	async saveSelectedDateRange() {
		try {
			const payload: IAvailabilitySlotsCreateInput[] = [];
			for (const e of this.calendarEvents) {
				if (!e.extendedProps['id']) {
					payload.push({
						startTime: new Date(e.start.toString()),
						endTime: new Date(e.end.toString()),
						employeeId: this.selectedEmployeeId,
						organizationId: this.organization.id,
						tenantId: this.organization.tenantId,
						type: this.recurringAvailabilityMode
							? 'Recurring'
							: 'Default',
						allDay: e.allDay
					});
				}
			}
			if (payload.length > 0) {
				await this.availabilitySlotsService.createBulk(payload);
			}

			for (const e of this.removedEvents) {
				await this.availabilitySlotsService.delete(
					e.extendedProps['id']
				);
			}

			this.toastrService.primary(
				this.getTranslation('NOTES.AVAILABILITY_SLOTS.SAVE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.removedEvents = [];
			this.fetchAvailableSlots();
			this.dateSelected = false;
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async fetchTimeOff() {
		const { id: organizationId, tenantId } = this.organization;
		const data = await this.timeOffService
			.getAllTimeOffRecords(['employees', 'employees.user'], {
				organizationId,
				tenantId,
				employeeId: this.selectedEmployeeId || ''
			})
			.pipe(first())
			.toPromise();

		this.timeOff = data.items;
	}

	async fetchAvailableSlots() {
		this.calendarEvents = [];
		const findObj = {
			type: this.recurringAvailabilityMode ? 'Recurring' : 'Default',
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId,
			employeeId: this.selectedEmployeeId || null
		};
		try {
			if (!this.recurringAvailabilityMode) {
				await this.fetchTimeOff();
			}
			this.loading = false;
			const slots = await this.availabilitySlotsService.getAll(
				[],
				findObj
			);
			const start = this.calendar.getApi().view.currentStart;
			const end = this.calendar.getApi().view.currentEnd;
			let date = moment(start);

			if (!this.recurringAvailabilityMode) {
				while (moment(end).diff(date, 'day') > 0) {
					this.renderTimeOff(new Date(date.format()));
					date = date.add(1, 'day');
				}
			}

			if (this.recurringAvailabilityMode) {
				for (const o of slots.items) {
					// Convert recurring events to current date range of full calendar
					const startDay = moment(o.startTime).day();
					const startHours = moment(o.startTime).hours();
					const startMinutes = moment(o.startTime).minutes();

					const endDay = moment(o.endTime).day();
					const endHours = moment(o.endTime).hours();
					const endMinutes = moment(o.endTime).minutes();

					const eventStartDate = moment(start)
						.add(startDay, 'days')
						.set('hours', startHours)
						.set('minutes', startMinutes);
					const eventEndDate = moment(start)
						.add(endDay, 'days')
						.set('hours', endHours)
						.set('minutes', endMinutes);

					o.startTime = new Date(eventStartDate.format());
					o.endTime = new Date(eventEndDate.format());
				}
			}

			for (const o of slots.items) {
				this._prepareEvent(o);
			}
			this.calendar.getApi().refetchEvents();
			this.firstLoad = false;
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('NOTES.AVAILABILITY_SLOTS.ERROR', {
					error: error.message || error.error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	private _prepareEvent(
		slot: IAvailabilitySlotsView,
		isDayOff: ITimeOff = null
	) {
		const eventStartTime = slot.startTime;
		const eventEndTime = slot.endTime;
		if (
			this.calendarEvents.find(
				(e) =>
					moment(e.start).format() === moment(slot.startTime).format()
			)
		)
			return;

		this.calendarEvents.push({
			start: eventStartTime,
			end: eventEndTime,
			allDay: slot.allDay,
			color: isDayOff ? 'red' : 'seablue',
			extendedProps: {
				id: slot.id,
				isDayOff: isDayOff ? true : false
			}
		});
		this.calendar.getApi().refetchEvents();
	}

	ngOnDestroy() {}
}
