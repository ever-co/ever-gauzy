// tslint:disable: nx-enforce-module-boundaries
import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	OnDestroy,
	TemplateRef
} from '@angular/core';
import { OptionsInput, EventInput } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import * as moment from 'moment';
import {
	IGetTimeLogInput,
	Organization,
	PermissionsEnum,
	TimeLog
} from '@gauzy/models';
import { toUTC } from 'libs/utils';
import { TimeTrackerService } from 'apps/gauzy/src/app/@shared/time-tracker/time-tracker.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import { debounceTime } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';

@Component({
	selector: 'ngx-calendar',
	templateUrl: './calendar.component.html',
	styleUrls: ['./calendar.component.scss']
	// encapsulation: ViewEncapsulation.None,
})
export class CalendarComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('calendar', { static: true }) calendar: FullCalendarComponent;
	@ViewChild('viewLogTemplate', { static: true })
	viewLogTemplate: TemplateRef<any>;

	calendarComponent: FullCalendarComponent; // the #calendar in the template

	calendarOptions: OptionsInput;

	updateLogs$: Subject<any> = new Subject();
	organization: Organization;
	canChangeSelectedEmployee: boolean;
	employeeId: string;

	constructor(
		private timeTrackerService: TimeTrackerService,
		private store: Store,
		private nbDialogService: NbDialogService
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
			height: 'auto',
			events: this.getEvents.bind(this),
			eventClick: this.handleEventClick.bind(this),
			dateClick: this.handleDateClick.bind(this),
			eventMouseEnter: this.handleEventMouseEnter.bind(this),
			eventMouseLeave: this.handleEventMouseLeave.bind(this)
		};
	}

	ngOnInit() {
		this.store.user$.subscribe(() => {
			this.canChangeSelectedEmployee = this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		});
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				this.organization = organization;
				this.updateLogs$.next();
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee: SelectedEmployee) => {
				if (employee) {
					this.employeeId = employee.id;
					this.updateLogs$.next();
				}
			});
	}

	ngAfterViewInit() {
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.calendar.getApi().refetchEvents();
			});
	}

	getEvents(arg, callback) {
		if (!this.organization) {
			return null;
		}
		const _startDate = moment(arg.start).format('YYYY-MM-DD') + ' 00:00:00';
		const _endDate = moment(arg.end).format('YYYY-MM-DD') + ' 23:59:59';

		const request: IGetTimeLogInput = {
			startDate: toUTC(_startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(_endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(this.employeeId ? { employeeId: this.employeeId } : {}),
			organizationId: this.organization.id
		};

		this.timeTrackerService.getTimeLogs(request).then((logs: TimeLog[]) => {
			const events = logs.map(
				(log: TimeLog): EventInput => {
					const title = log.project ? log.project.name : 'No project';
					// if (this.canChangeSelectedEmployee){
					// 	title += ` (${log.employee.user.firstName} ${log.employee.user.lastName})`
					// }
					return {
						id: log.id,
						title: title,
						start: log.startedAt,
						end: log.stoppedAt,
						log: log
					};
				}
			);
			callback(events);
		});
	}

	handleEventClick({ event }) {
		this.nbDialogService.open(this.viewLogTemplate, {
			context: event.extendedProps.log,
			dialogClass: 'view-log-dialog'
		});
	}

	handleDateClick(arg) {
		console.log('handleDateClick', arg);
	}

	handleEventMouseEnter({ el }) {
		if (this.hasOverflow(el.querySelector('.fc-event-main'))) {
			el.style.position = 'unset';
		}
	}
	handleEventMouseLeave({ el }) {
		el.removeAttribute('style');
	}

	hasOverflow(el) {
		const curOverflow = el.style.overflow;

		if (!curOverflow || curOverflow === 'visible')
			el.style.overflow = 'hidden';

		const isOverflowing =
			el.clientWidth < el.scrollWidth ||
			el.clientHeight < el.scrollHeight;

		el.style.overflow = curOverflow;

		return isOverflowing;
	}

	ngOnDestroy() {}
}
