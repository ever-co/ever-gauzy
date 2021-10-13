import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
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
	IRolePermission,
	AvailabilitySlotType,
	ISelectedEmployee,
	StatusTypesEnum,
	WeekDaysEnum
} from '@gauzy/contracts';
import { first, filter, tap, debounceTime } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { distinctUntilChange, isEmpty, isNotEmpty } from '@gauzy/common-angular';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import {
	AvailabilitySlotsService,
	ErrorHandlingService,
	Store,
	TimeOffService,
	ToastrService
} from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-availability-slots',
	templateUrl: './availability-slots.component.html'
})
export class AvailabilitySlotsComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	@ViewChild('calendar', { static: false })
	calendar: FullCalendarComponent;

	calendarComponent: FullCalendarComponent;
	calendarEvents: EventInput[] = [];
	calendarOptions: CalendarOptions;

	headerToolbarOptions: {
		left: string;
		center: string;
		right: string;
	} = {
		left: 'next',
		center: 'title',
		right: 'dayGridMonth,timeGridWeek'
	};

	recurringAvailabilityMode: boolean;
	dateSelected: boolean;
	hiddenDays: number[] = [];
	
	removedEvents: EventInput[] = [];
	timeOffs: ITimeOff[] = [];
	public loading: boolean = true;

	selectedEmployee: ISelectedEmployee;
	organization: IOrganization;
	availableSlots$: Subject<any> = new Subject();

	createForm = {
		startTime: '00:00',
		endTime: '00:00'
	};
	weekDaysEnum = WeekDaysEnum;

	constructor(
		private readonly store: Store,
		private readonly route: ActivatedRoute,
		private readonly errorHandler: ErrorHandlingService,
		private readonly toastrService: ToastrService,
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly timeOffService: TimeOffService,
		readonly translateService: TranslateService,
		private readonly ngxPermissionsService: NgxPermissionsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.getCalendarOption();
		this.route.data
			.pipe(untilDestroyed(this))
			.subscribe(({ page }) => {
				this.recurringAvailabilityMode = (page === 'recurring');
				if (page === 'recurring') {
					delete this.calendarOptions.selectAllow;
					this.calendarOptions.hiddenDays = [];
					this.calendarOptions.dayHeaderFormat = { weekday: 'long' };
					this.calendarOptions.headerToolbar = {
						center: '',
						right: '',
						left: ''
					};
				}
			});
		this.store.userRolePermissions$
			.pipe(
				filter(
					(permissions: IRolePermission[]) => isNotEmpty(permissions)
				),
				untilDestroyed(this)
			)
			.subscribe((data) => {
				const permissions = data.map(({ permission }) => permission);
				this.ngxPermissionsService.loadPermissions(permissions);
			});
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				tap(([organization]) => (
					this.organization = organization as IOrganization
				)),
				distinctUntilChange(),
				tap(([organization, employee]) => {
					const { defaultStartTime, defaultEndTime } = organization;
					if (defaultStartTime) {
						this.createForm.startTime = defaultStartTime;
					}
					if (defaultEndTime) {
						this.createForm.endTime = defaultEndTime;
					}
					if (employee && employee.id) {
						this.selectedEmployee = employee;
					} else {
						this.selectedEmployee = null;
					}
				}),
				tap(() => this.availableSlots$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.availableSlots$
			.pipe(
				debounceTime(500),
				tap(() => this.fetchAvailableSlots()),
				untilDestroyed(this)
			)
			.subscribe();
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
			eventClick: this.unSelectEvent.bind(this),
			selectAllow: (select) => moment().diff(select.start) <= 0,
			select: this.handleSelectRange.bind(this),
			eventDrop: this.dragDropEvent.bind(this)
		};
	}

	/*
	* Schedule Drag & Drop Event Calendar
	*/
	async dragDropEvent($event) {
		const event = $event.event;
		const { id } = event.extendedProps;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		
		const input = {
			startTime: event.start,
			endTime: event.end,
			type: this.recurringAvailabilityMode
				? AvailabilitySlotType.RECURRING
				: AvailabilitySlotType.DEFAULT,
			allDay: event.allDay,
			organizationId,
			tenantId
		};
		if (this.selectedEmployee) {
			input['employeeId'] = this.selectedEmployee.id;
		}
		if (event.allDay) {
			input['endTime'] = new Date(
				moment(event.start).endOf('day').format('YYYY-MM-DD hh:mm:ss')
			);
		}
		await this.availabilitySlotsService.update(id, { ...input });
	}

	headerMount(config: any) {
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
			this.headerToolbarOptions.left = moment(currentStart).isSameOrBefore(moment(),'day') ? 
				'next' : 
				'prev,next';
			this.calendar
				.getApi()
				.setOption('headerToolbar', this.headerToolbarOptions);
			this.renderTimeOff(config.date);
		}
	}

	renderTimeOff(date) {
		if (isEmpty(this.timeOffs)) {
			return;
		}
		const isDayOff = this.timeOffs.find(
			(off: ITimeOff) => off.status === StatusTypesEnum.APPROVED &&
				moment(date).isBetween(off.start, off.end, 'date', '[]')
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

	getEvents(arg, callback) {
		if (!this.organization) {
			return null;
		}
		callback(this.calendarEvents);
	}

	unSelectEvent(o) {
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
		if (!this.selectedEmployee) {
			this.toastrService.danger('SCHEDULE.SELECT_EMPLOYEE');
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId, startWeekOn } = this.organization;
		const { id: employeeId } = this.selectedEmployee;

		const payload: IAvailabilitySlotsCreateInput[] = [];
		const calender = this.calendar.getApi();
		const range = calender.getCurrentData().dateProfile.currentRange;
		let start = range.start;
		while (start < range.end) {
			const date = moment(start).format('YYYY-MM-DD');
			let days = [];
			if (startWeekOn === WeekDaysEnum.MONDAY) {
				days = [0, 1, 2, 3, 4];
			} else {
				days = [6, 0, 1, 2, 3];
			}
			if (days.indexOf(moment(start).weekday()) >= 0) {
				payload.push({
					startTime: moment(date + " " + this.createForm.startTime).toDate(),
					endTime: moment(date + " " + this.createForm.endTime).toDate(),
					employeeId,
					organizationId,
					tenantId,
					type: this.recurringAvailabilityMode
						? AvailabilitySlotType.RECURRING
						: AvailabilitySlotType.DEFAULT,
					allDay: false
				});
			}
			start = moment(start).add(1, 'day').toDate();
		}

		await this.availabilitySlotsService.createBulk(payload);
		this.availableSlots$.next(true);
	}

	async saveSelectedDateRange() {
		if (!this.selectedEmployee) {
			this.toastrService.danger('SCHEDULE.SELECT_EMPLOYEE');
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { id: employeeId } = this.selectedEmployee;

			const payload: IAvailabilitySlotsCreateInput[] = [];
			for (const e of this.calendarEvents) {
				if (!e.extendedProps['id']) {
					payload.push({
						startTime: new Date(e.start.toString()),
						endTime: new Date(e.end.toString()),
						employeeId,
						organizationId,
						tenantId,
						type: this.recurringAvailabilityMode
							? AvailabilitySlotType.RECURRING
							: AvailabilitySlotType.DEFAULT,
						allDay: e.allDay
					});
				}
			}
			if (isNotEmpty(payload)) {
				await this.availabilitySlotsService.createBulk(payload);
			}
			for (const e of this.removedEvents) {
				await this.availabilitySlotsService.delete(
					e.extendedProps['id']
				);
			}
			this.toastrService.success('NOTES.AVAILABILITY_SLOTS.SAVE');

			this.removedEvents = [];
			this.availableSlots$.next(true)
			this.dateSelected = false;
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async fetchTimeOff() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		let request: any = {
			organizationId,
			tenantId
		}
		if (this.selectedEmployee) {
			const { id: employeeId } = this.selectedEmployee;
			request = {
				...request,
				employeeId
			}
		}
		const { items = [] } = await this.timeOffService
			.getAllTimeOffRecords(['employees', 'employees.user'], { ...request })
			.pipe(first())
			.toPromise();
		this.timeOffs = items;
	}

	async fetchAvailableSlots() {
		this.calendarEvents = [];
		const { tenantId } = this.store.user;
		const { id: organizationId  } = this.organization;
		let findObj: any = {
			type: this.recurringAvailabilityMode ? 
					AvailabilitySlotType.RECURRING : 
					AvailabilitySlotType.DEFAULT,
			organizationId,
			tenantId
		};
		if (this.selectedEmployee) {
			findObj = {
				...findObj,
				employeeId: this.selectedEmployee.id
			}
		}
		try {
			this.loading = false;
			if (!this.recurringAvailabilityMode) {
				await this.fetchTimeOff();
			}
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

			for (const item of slots.items) {
				if (this.recurringAvailabilityMode) {
					// Convert recurring events to current date range of full calendar
					const startDay = moment(item.startTime).day();
					const startHours = moment(item.startTime).hours();
					const startMinutes = moment(item.startTime).minutes();

					const endDay = moment(item.endTime).day();
					const endHours = moment(item.endTime).hours();
					const endMinutes = moment(item.endTime).minutes();

					const eventStartDate = moment(start)
						.add(startDay, 'days')
						.set('hours', startHours)
						.set('minutes', startMinutes);
					const eventEndDate = moment(start)
						.add(endDay, 'days')
						.set('hours', endHours)
						.set('minutes', endMinutes);

					item.startTime = new Date(eventStartDate.format());
					item.endTime = new Date(eventEndDate.format());
				}
				this._prepareEvent(item);
			}
			this.calendar.getApi().refetchEvents();
		} catch (error) {
			this.toastrService.danger('NOTES.AVAILABILITY_SLOTS.ERROR', null, {
				error: error.message || error.error.message
			});
		}
	}

	private _prepareEvent(
		slot: IAvailabilitySlotsView,
		isDayOff: ITimeOff = null
	) {
		const eventStartTime = slot.startTime;
		const eventEndTime = slot.endTime;

		const find = this.calendarEvents.find(
			(event) => moment(event.start).format() === moment(slot.startTime).format()
		);
		if (!!find) return;

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
