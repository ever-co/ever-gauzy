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
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import * as moment from 'moment';
import {
	IGetTimeLogInput,
	IOrganization,
	ITimeLog,
	ITimeLogFilters,
	OrganizationPermissionsEnum
} from '@gauzy/contracts';
import { toUTC, toLocal } from '@gauzy/common-angular';
import { Store } from './../../../../../@core/services/store.service';
import { combineLatest, Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { TimesheetService } from './../../../../../@shared/timesheet/timesheet.service';
import { EditTimeLogModalComponent } from './../../../../../@shared/timesheet/edit-time-log-modal/edit-time-log-modal.component';
import { ViewTimeLogModalComponent } from './../../../../../@shared/timesheet/view-time-log-modal/view-time-log-modal/view-time-log-modal.component';
import { NgxPermissionsService } from 'ngx-permissions';
import { TimesheetFilterService } from './../../../../../@shared/timesheet/timesheet-filter.service';
import * as _ from 'underscore';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-calendar',
	templateUrl: './calendar.component.html'
})
export class CalendarComponent implements OnInit, AfterViewInit, OnDestroy {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	@ViewChild('calendar', { static: true }) calendar: FullCalendarComponent;
	@ViewChild('viewLogTemplate', { static: true })
	viewLogTemplate: TemplateRef<any>;
	calendarComponent: FullCalendarComponent; // the #calendar in the template
	calendarOptions: CalendarOptions;
	updateLogs$: Subject<any> = new Subject();
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
		private readonly cdr: ChangeDetectorRef
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
				filter(([organization]) => !!organization),
				tap(([organization, employee, project]) => {
					if (organization) {
						this.organization = organization;
						this.selectedEmployeeId = employee ? employee.id : null;
						this.projectId = project ? project.id : null;
						this.updateLogs$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.futureDateAllowed = await this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				);
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

	filtersChange($event: ITimeLogFilters) {
		this.logRequest = $event;
		if (this.logRequest.date && this.calendar.getApi()) {
			this.calendar.getApi().gotoDate(this.logRequest.date);
		}

		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
		this.updateLogs$
			.pipe(debounceTime(800), untilDestroyed(this))
			.subscribe(() => {
				if (this.calendar.getApi()) {
					this.calendar.getApi().refetchEvents();
				}
			});
	}

	getEvents(arg, callback) {
		if (!this.organization || !this.logRequest) {
			return null;
		}

		const _startDate = moment(arg.start)
			.startOf('day')
			.format('YYYY-MM-DD HH:mm:ss');
		const _endDate = moment(arg.end)
			.endOf('day')
			.format('YYYY-MM-DD HH:mm:ss');
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
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
			startDate: toUTC(_startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(_endDate).format('YYYY-MM-DD HH:mm:ss'),
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
				this.updateLogs$.next();
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
