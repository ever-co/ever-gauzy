import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { OptionsInput, EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import * as moment from 'moment';
import {
	Organization,
	PermissionsEnum,
	Employee,
	IAvailabilitySlotsCreateInput
} from '@gauzy/models';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { AvailabilitySlotsService } from 'apps/gauzy/src/app/@core/services/availability-slots.service';
import { takeUntil } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';

export interface IAvailabilitySlotsView {
	id?: string;
	startTime: Date;
	endTime: Date;
	allDay: boolean;
	type?: string;
	employeeId?: string;
	organizationId?: string;
	employee?: Employee;
	organization?: Organization;
}

@Component({
	templateUrl: './availability-slots.component.html'
})
export class AvailabilitySlotsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('calendar', { static: true }) calendar: FullCalendarComponent;
	calendarComponent: FullCalendarComponent;
	calendarEvents: EventInput[] = [];
	calendarOptions: OptionsInput;

	private _ngDestroy$ = new Subject<void>();
	recurringAvailabilityMode: boolean = false;
	_selectedOrganizationId: string;
	selectedEmployeeId: string;
	canChangeSelectedEmployee: boolean;
	dateSelected: boolean;
	removedEvents: EventInput[] = [];

	constructor(
		private store: Store,
		private route: ActivatedRoute,
		private errorHandler: ErrorHandlingService,
		private toastrService: NbToastrService,
		private availabilitySlotsService: AvailabilitySlotsService,
		readonly translateService: TranslateService
	) {
		super(translateService);

		this.calendarOptions = {
			initialView: 'timeGridWeek',
			headerToolbar: {
				left: 'prev,next today',
				center: 'title',
				right: 'dayGridMonth,timeGridWeek'
			},
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
			this.calendarOptions.headerToolbar = {
				center: '',
				right: ''
			};
		}

		this.store.user$.subscribe(() => {
			this.canChangeSelectedEmployee = this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this.fetchAvailableSlots(null);
				} else {
					if (this._selectedOrganizationId) {
						this.fetchAvailableSlots(true);
					}
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
				}
				this.fetchAvailableSlots(true);
			});
	}

	getEvents(arg, callback) {
		if (!this._selectedOrganizationId) {
			return null;
		}
		callback(this.calendarEvents);
	}

	unselectEvent(o) {
		if (o.event.extendedProps && o.event.extendedProps.id) {
			this.removedEvents.push(o.event);
			this.dateSelected = true;
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

		this.calendar.getApi().refetchEvents();
	}

	async saveSelectedDateRange() {
		try {
			const payload: IAvailabilitySlotsCreateInput[] = [];
			for (let e of this.calendarEvents) {
				!e.extendedProps['id'] &&
					payload.push({
						startTime: new Date(e.start.toString()),
						endTime: new Date(e.end.toString()),
						employeeId: this.selectedEmployeeId,
						organizationId: this.store.selectedOrganization.id,
						type: this.recurringAvailabilityMode
							? 'Recurring'
							: 'Default',
						allDay: e.allDay
					});
			}
			payload.length > 0 &&
				(await this.availabilitySlotsService.createBulk(payload));

			for (let e of this.removedEvents) {
				await this.availabilitySlotsService.delete(
					e.extendedProps['id']
				);
			}

			this.toastrService.primary(
				this.getTranslation('NOTES.AVAILABILITY_SLOTS.SAVE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.dateSelected = false;
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async fetchAvailableSlots(isOrganizationId) {
		let findObj;

		if (isOrganizationId) {
			findObj = {
				type: this.recurringAvailabilityMode ? 'Recurring' : 'Default',
				organization: {
					id: this._selectedOrganizationId
				}
			};
		} else {
			findObj = {
				type: this.recurringAvailabilityMode ? 'Recurring' : 'Default',
				employee: {
					id: this.selectedEmployeeId
				}
			};
		}

		try {
			const slots = await this.availabilitySlotsService.getAll(
				[],
				findObj
			);
			const start = this.calendar.getApi().view.currentStart;

			if (this.recurringAvailabilityMode) {
				for (let o of slots.items) {
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

			this.calendarEvents = [];
			for (let o of slots.items) {
				this._prepareEvent(o);
			}
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('NOTES.AVAILABILITY_SLOTS.ERROR', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
		this.calendar.getApi().refetchEvents();
	}

	private _prepareEvent(slot: IAvailabilitySlotsView) {
		let eventStartTime = slot.startTime;
		let eventEndTime = slot.endTime;

		this.calendarEvents.push({
			start: eventStartTime,
			end: eventEndTime,
			allDay: slot.allDay,
			extendedProps: {
				id: slot.id
			}
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
