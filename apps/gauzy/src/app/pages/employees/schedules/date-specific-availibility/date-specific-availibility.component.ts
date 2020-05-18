import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { OptionsInput, EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import * as moment from 'moment';
import { Organization, PermissionsEnum, Employee } from '@gauzy/models';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { AvailibilitySlotsService } from 'apps/gauzy/src/app/@core/services/availability-slots.service';
import { takeUntil } from 'rxjs/operators';

export interface IAvailabilitySlotsView {
	startTime: Date;
	endTime: Date;
	allDay: boolean;
	type: string;
	employeeId?: string;
	organizationId?: string;
	employee?: Employee;
	organization?: Organization;
}

@Component({
	templateUrl: './date-specific-availibility.component.html'
})
export class DateSpecificAvailibilityComponent implements OnInit, OnDestroy {
	@ViewChild('calendar', { static: true }) calendar: FullCalendarComponent;
	calendarComponent: FullCalendarComponent;
	private _ngDestroy$ = new Subject<void>();

	calendarOptions: OptionsInput;

	_selectedOrganizationId: string;
	selectedEmployeeId: string;
	canChangeSelectedEmployee: boolean;
	dateSelected: boolean;
	calendarEvents: EventInput[] = [];

	constructor(
		private store: Store,
		private availabilitySlotsService: AvailibilitySlotsService
	) {
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
			dateClick: this.handleDateClick.bind(this),
			selectAllow: (select) => moment().diff(select.start) <= 0,
			select: this.handleSelectRange.bind(this)
		};
	}

	ngOnInit() {
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

	handleDateClick(arg) {
		console.log('handleDateClick', arg);
	}

	handleSelectRange(o) {
		this.dateSelected = true;

		this._prepareEvent({
			startTime: o.start,
			endTime: o.end,
			allDay: o.allDay,
			type: 'Default'
		});

		this.calendar.getApi().refetchEvents();
	}

	async saveSelectedDateRange() {
		const payload = [];
		for (let e of this.calendarEvents) {
			payload.push({
				startTime: new Date(e.start.toString()),
				endTime: new Date(e.end.toString()),
				employeeId: this.selectedEmployeeId,
				organizationId: this.store.selectedOrganization.id,
				type: 'Default',
				allDay: e.allDay
			});
		}
		await this.availabilitySlotsService.create(payload);
	}

	discardSelectedDates() {
		this.calendarEvents = [];
		this.dateSelected = false;
		this.calendar.getApi().refetchEvents();
	}

	async fetchAvailableSlots(isOrganizationId) {
		let findObj;

		if (isOrganizationId) {
			findObj = {
				organization: {
					id: this._selectedOrganizationId
				}
			};
		} else {
			findObj = {
				employee: {
					id: this.selectedEmployeeId
				}
			};
		}

		const slots = await this.availabilitySlotsService.getAll([], findObj);
		console.log(slots);
	}

	private _prepareEvent(slot: IAvailabilitySlotsView) {
		let eventStartTime = slot.startTime;
		let eventEndTime = slot.endTime;

		this.calendarEvents.push({
			start: eventStartTime,
			end: eventEndTime,
			allDay: slot.allDay
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
