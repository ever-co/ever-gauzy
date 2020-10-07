import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import * as moment from 'moment';
import {
	PermissionsEnum,
	IAvailabilitySlotsCreateInput,
	ITimeOff,
	IAvailabilitySlotsView,
	IOrganization
} from '@gauzy/models';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { AvailabilitySlotsService } from 'apps/gauzy/src/app/@core/services/availability-slots.service';
import { takeUntil, first } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import {
	EmployeeSelectorComponent,
	SelectedEmployee
} from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import { TimeOffService } from 'apps/gauzy/src/app/@core/services/time-off.service';

@Component({
	templateUrl: './availability-slots.component.html'
})
export class AvailabilitySlotsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('calendar', { static: false })
	calendar: FullCalendarComponent;
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;

	calendarComponent: FullCalendarComponent;
	calendarEvents: EventInput[] = [];
	calendarOptions: CalendarOptions;

	private _ngDestroy$ = new Subject<void>();
	private firstLoad: boolean = true;
	recurringAvailabilityMode: boolean = false;
	_selectedOrganizationId: string;
	selectedEmployeeId: string;
	canChangeSelectedEmployee: boolean;
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

	constructor(
		private store: Store,
		private route: ActivatedRoute,
		private errorHandler: ErrorHandlingService,
		private toastrService: NbToastrService,
		private availabilitySlotsService: AvailabilitySlotsService,
		private timeOffService: TimeOffService,
		readonly translateService: TranslateService
	) {
		super(translateService);

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
			select: this.handleSelectRange.bind(this)
		};
	}

	ngOnInit() {
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

		this.store.user$.subscribe(() => {
			this.canChangeSelectedEmployee = this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.organization = org;
					this._selectedOrganizationId = org.id;
					this.fetchAvailableSlots();
				}
			});
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

		isDayOff &&
			this._prepareEvent(
				{
					startTime: date,
					endTime: date,
					allDay: true
				},
				isDayOff
			);
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

	async saveSelectedDateRange() {
		try {
			const payload: IAvailabilitySlotsCreateInput[] = [];
			for (const e of this.calendarEvents) {
				!e.extendedProps['id'] &&
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
			payload.length > 0 &&
				(await this.availabilitySlotsService.createBulk(payload));

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
			this.ngOnInit();
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
			!this.recurringAvailabilityMode && (await this.fetchTimeOff());
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

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
