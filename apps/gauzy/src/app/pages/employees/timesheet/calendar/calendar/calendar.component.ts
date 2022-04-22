// tslint:disable: nx-enforce-module-boundaries
import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	OnDestroy,
	TemplateRef,
	ChangeDetectorRef
} from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import * as moment from 'moment';
import * as _ from 'underscore';
import { combineLatest, Observable, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import {
	IGetTimeLogInput,
	IOrganization,
	ITimeLog,
	ITimeLogFilters,
	OrganizationPermissionsEnum
} from '@gauzy/contracts';
import { toUTC, toLocal, isEmpty, distinctUntilChange } from '@gauzy/common-angular';
import { DateRangePickerBuilderService, Store } from './../../../../../@core/services';
import {
	EditTimeLogModalComponent,
	TimesheetFilterService,
	TimesheetService,
	ViewTimeLogModalComponent
} from './../../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';
import { dayOfWeekAsString } from './../../../../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-calendar-timesheet',
	templateUrl: './calendar.component.html'
})
export class CalendarComponent implements 
	OnInit, AfterViewInit, OnDestroy {

	@ViewChild('calendar', { static: true }) calendar: FullCalendarComponent;
	@ViewChild('viewLogTemplate', { static: true }) viewLogTemplate: TemplateRef<any>;
	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;

	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	calendarComponent: FullCalendarComponent; // the #calendar in the template
	calendarOptions: CalendarOptions;
	subject$: Subject<any> = new Subject();
	organization: IOrganization;
	employeeId: string;
	loading: boolean;
	futureDateAllowed: boolean;
	logRequest: ITimeLogFilters = {};
	selectedEmployeeId: string | null = null;
	projectId: string | null = null;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly store: Store,
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly cdr: ChangeDetectorRef,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		this.calendarOptions = {
			initialView: 'timeGridWeek',
			headerToolbar: {
				left: 'prev,next today',
				center: 'title',
				right: 'dayGridMonth,timeGridWeek,timeGridDay'
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
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization]) => {
					this.organization = organization;
					this.futureDateAllowed = organization.futureDateAllowed;
					this.calendar.getApi().setOption('firstDay', dayOfWeekAsString(organization.startWeekOn));
				}),
				tap(([organization, employee, project]) => {
					if (organization) {
						this.selectedEmployeeId = employee ? employee.id : null;
						this.projectId = project ? project.id : null;
						this.subject$.next(true);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.ngxPermissionsService.permissions$
			.pipe(
				untilDestroyed(this)
			)
			.subscribe(async () => {
				if (this.calendar.getApi()) {
					const calendar = this.calendar.getApi();
					if (
						await this.ngxPermissionsService.hasPermission(
							OrganizationPermissionsEnum.ALLOW_MANUAL_TIME
						)
					) {
						calendar.setOption('selectable', true);
					} else {
						calendar.setOption('selectable', false);
					}

					if (
						await this.ngxPermissionsService.hasPermission(
							OrganizationPermissionsEnum.ALLOW_MODIFY_TIME
						)
					) {
						calendar.setOption('editable', true);
					} else {
						calendar.setOption('editable', false);
					}
				}
			});
	}

	filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		if (this.logRequest.startDate && this.calendar.getApi()) {
			this.calendar.getApi().gotoDate(this.logRequest.startDate);
		}
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.subject$.next(true);
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
		this.subject$
			.pipe(
				debounceTime(800),
				untilDestroyed(this)
			)
			.subscribe(() => {
				if (this.calendar.getApi()) {
					this.calendar.getApi().refetchEvents();
				}
			});
	}

	getEvents(arg: any, callback) {
		if (!this.organization || isEmpty(this.logRequest)) {
			return null;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const startDate = moment(arg.start).startOf('day').format('YYYY-MM-DD HH:mm:ss');
		const endDate = moment(arg.end).endOf('day').format('YYYY-MM-DD HH:mm:ss');

		const appliedFilter = _.pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const projectIds: string[] = [];
		if (this.projectId) {
			projectIds.push(this.projectId);
		}

		const request: IGetTimeLogInput = {
			organizationId,
			tenantId,
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeIds.length > 0 ? { employeeIds } : {}),
			...(projectIds.length > 0 ? { projectIds } : {})
		};

		this.loading = true;
		this.timesheetService
			.getTimeLogs(request)
			.then((logs: ITimeLog[]) => {
				const events = logs.map(
					(log: ITimeLog): EventInput => {
						const title = log.project
							? log.project.name
							: 'No project';
						return {
							id: log.id,
							title: title,
							start: toLocal(log.startedAt).toDate(),
							end: toLocal(log.stoppedAt).toDate(),
							log: log
						};
					}
				);
				callback(events);
			})
			.finally(() => (this.loading = false));
	}

	selectAllow({ start, end }) {
		const isOneDay = moment(start).isSame(moment(end), 'day');
		return this.futureDateAllowed
			? isOneDay
			: isOneDay && moment(end).isSameOrBefore(moment());
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
			employeeId: this.logRequest.employeeIds
				? this.logRequest.employeeIds[0]
				: null,
			projectId: this.logRequest.projectIds
				? this.logRequest.projectIds[0]
				: null
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

		if (!curOverflow || curOverflow === 'visible')
			el.style.overflow = 'hidden';

		const isOverflowing =
			el.clientWidth < el.scrollWidth ||
			el.clientHeight < el.scrollHeight;

		if (el.style) {
			el.style.overflow = curOverflow;
		}

		return isOverflowing;
	}

	openDialog(timeLog?: ITimeLog | Partial<ITimeLog>) {
		this.nbDialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.subscribe(() => {
				this.subject$.next(true);
			});
	}

	updateTimeLog(id: string, timeLog: ITimeLog | Partial<ITimeLog>) {
		this.loading = true;
		this.timesheetService.updateTime(id, timeLog).then(() => {
			this.loading = false;
		});
	}

	ngOnDestroy() {}
}
