// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { pick } from 'underscore';
import { Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { IGetTimeLogInput, ITimeLog, ITimeLogFilters, PermissionsEnum } from '@gauzy/contracts';
import { toLocal, isEmpty } from '@gauzy/common-angular';
import { Store } from './../../../../../@core/services';
import {
	EditTimeLogModalComponent,
	TimesheetFilterService,
	TimesheetService,
	ViewTimeLogModalComponent
} from './../../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';
import { dayOfWeekAsString } from './../../../../../@theme/components/header/selectors/date-range-picker';
import { BaseSelectorFilterComponent } from './../../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-calendar-timesheet',
	templateUrl: './calendar.component.html',
	styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('calendar', { static: true }) calendar: FullCalendarComponent;
	@ViewChild('viewLogTemplate', { static: true }) viewLogTemplate: TemplateRef<any>;
	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;

	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	PermissionsEnum = PermissionsEnum;
	calendarComponent: FullCalendarComponent; // the #calendar in the template
	calendarOptions: CalendarOptions;
	filters: ITimeLogFilters;
	loading: boolean = false;
	futureDateAllowed: boolean;

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly cdr: ChangeDetectorRef,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		public readonly translateService: TranslateService
	) {
		super(store, translateService, dateRangePickerBuilderService);
		this.calendarOptions = {
			initialView: 'timeGridWeek',
			headerToolbar: {
				left: '',
				center: 'title',
				right: 'dayGridMonth,timeGridWeek,timeGridDay'
			},
			themeSystem: 'bootstrap',
			plugins: [dayGridPlugin, timeGrigPlugin, interactionPlugin, bootstrapPlugin],
			showNonCurrentDates: false,
			weekends: true,
			height: 'auto',
			editable: true,
			selectable: true,
			firstDay: 1,
			selectAllow: this.selectAllow.bind(this),
			events: this.getEvents.bind(this),
			eventDrop: this.handleEventDrop.bind(this),
			eventResize: this.handleEventResize.bind(this),
			select: this.handleEventSelect.bind(this),
			eventClick: this.handleEventClick.bind(this),
			dateClick: this.handleDateClick.bind(this),
			eventMouseEnter: this.handleEventMouseEnter.bind(this),
			eventMouseLeave: this.handleEventMouseLeave.bind(this)
		};
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.calendar.getApi() && !!this.organization),
				tap(() => this.setCalendarOptions()),
				tap(() => this.setCalenderInitialView()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * SET calendar options
	 *
	 * @returns
	 */
	async setCalendarOptions() {
		if (!this.organization || !this.calendar.getApi()) {
			return;
		}

		const calendar = this.calendar.getApi();
		const { allowManualTime, allowModifyTime, futureDateAllowed, startWeekOn } = this.organization;

		this.futureDateAllowed = futureDateAllowed;

		/**
		 * Allow manual time
		 */
		if ((await this.ngxPermissionsService.hasPermission(PermissionsEnum.ALLOW_MANUAL_TIME)) && allowManualTime) {
			calendar.setOption('selectable', true);
		} else {
			calendar.setOption('selectable', false);
		}
		/**
		 * Allow modify time
		 */
		if ((await this.ngxPermissionsService.hasPermission(PermissionsEnum.ALLOW_MODIFY_TIME)) && allowModifyTime) {
			calendar.setOption('editable', true);
		} else {
			calendar.setOption('editable', false);
		}
		calendar.setOption('firstDay', dayOfWeekAsString(startWeekOn));
	}

	/**
	 * SET calender initial view
	 *
	 */
	setCalenderInitialView() {
		if (!this.organization || !this.calendar.getApi()) {
			return;
		}

		const { startDate } = this.request;
		if (this.isMoreThanUnit('weeks')) {
			this.calendar.getApi().changeView('dayGridMonth', startDate);
		} else if (this.isMoreThanUnit('days')) {
			this.calendar.getApi().changeView('timeGridWeek', startDate);
		} else {
			this.calendar.getApi().changeView('timeGridDay', startDate);
		}
		this.calendar.getApi().refetchEvents();
	}

	getEvents(arg: any, callback: Function) {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const startDate = moment(arg.start).startOf('day').format('YYYY-MM-DD HH:mm:ss');
		const endDate = moment(arg.end).subtract(1, 'days').endOf('day').format('YYYY-MM-DD HH:mm:ss');

		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');

		const request: IGetTimeLogInput = {
			...appliedFilter,
			...this.getFilterRequest({
				startDate,
				endDate
			})
		};

		this.loading = true;
		this.timesheetService
			.getTimeLogs(request, ['project', 'task', 'organizationContact', 'employee.user'])
			.then((logs: ITimeLog[]) => {
				const events = logs.map((log: ITimeLog): EventInput => {
					const title = log.project ? log.project.name : this.getTranslation('TIMESHEET.NO_PROJECT');
					return {
						id: log.id,
						title: title,
						start: toLocal(log.startedAt).toDate(),
						end: toLocal(log.stoppedAt).toDate(),
						log: log
					};
				});
				callback(events);
			})
			.finally(() => (this.loading = false));
	}

	selectAllow({ start, end }) {
		const isOneDay = moment(start).isSame(moment(end), 'day');
		return this.futureDateAllowed ? isOneDay : isOneDay && moment(end).isSameOrBefore(moment());
	}

	handleEventClick({ event }) {
		this.nbDialogService.open(ViewTimeLogModalComponent, {
			context: { timeLog: event.extendedProps.log },
			dialogClass: 'view-log-dialog'
		});
	}

	handleDateClick(event) {
		if (this.calendar.getApi()) {
			this.calendar.getApi().changeView('timeGridWeek', event.date);
		}
	}

	handleEventSelect(event) {
		this.openDialog({
			startedAt: event.start,
			stoppedAt: event.end,
			employeeId: this.request.employeeIds ? this.request.employeeIds[0] : null,
			projectId: this.request.projectIds ? this.request.projectIds[0] : null
		});
	}

	handleEventMouseEnter({ el }) {
		if (this.hasOverflow(el.querySelector('.fc-event-main'))) {
			el.style.position = 'unset';
		}
	}
	handleEventMouseLeave({ el }) {
		el.removeAttribute('style');
	}

	handleEventDrop({ event }) {
		this.updateTimeLog(event.id, {
			startedAt: event.start,
			stoppedAt: event.end
		});
	}

	handleEventResize({ event }) {
		this.updateTimeLog(event.id, {
			startedAt: event.start,
			stoppedAt: event.end
		});
	}

	hasOverflow(el: HTMLElement) {
		if (!el) {
			return;
		}
		const curOverflow = el.style ? el.style.overflow : 'hidden';

		if (!curOverflow || curOverflow === 'visible') el.style.overflow = 'hidden';

		const isOverflowing = el.clientWidth < el.scrollWidth || el.clientHeight < el.scrollHeight;

		if (el.style) {
			el.style.overflow = curOverflow;
		}

		return isOverflowing;
	}

	openDialog(timeLog?: ITimeLog | Partial<ITimeLog>) {
		this.nbDialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.pipe(
				filter((timeLog: ITimeLog) => !!timeLog),
				tap((timeLog: ITimeLog) =>
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(timeLog.startedAt))
				),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	updateTimeLog(id: string, timeLog: ITimeLog | Partial<ITimeLog>) {
		this.loading = true;
		this.timesheetService.updateTime(id, timeLog).then(() => {
			this.loading = false;
		});
	}

	/**
	 * If, selected date range are more than a weeks/days
	 */
	isMoreThanUnit(unitOfTime: moment.unitOfTime.Base): boolean {
		if (!this.request.startDate) {
			return false;
		}
		const { startDate, endDate } = this.request;
		return moment(endDate).diff(moment(startDate), unitOfTime) > 0;
	}

	ngOnDestroy() {}
}
