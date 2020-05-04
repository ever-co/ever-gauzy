import { Component, ViewChild, OnDestroy, OnInit } from '@angular/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Router, ActivatedRoute } from '@angular/router';
import { EventInput } from '@fullcalendar/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import bootstrapPlugin from '@fullcalendar/bootstrap';

@Component({
	templateUrl: './appointment.component.html',
	styleUrls: ['./appointment.component.scss']
})
export class AppointmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarPlugins = [
		dayGridPlugin,
		timeGrigPlugin,
		interactionPlugin,
		bootstrapPlugin
	];
	calendarWeekends = true;
	calendarEvents: EventInput[] = [
		{
			title: 'Meeting 1',
			start: new Date(),
			groupId: 1,
			allDay: true,
			url: 'http://google.com'
		},
		{
			title: 'Meeting 2',
			start: new Date(),
			groupId: 1,
			backgroundColor: 'lightpink'
		},
		{
			title: 'Meeting 3',
			start: new Date(),
			groupId: 2,
			backgroundColor: 'lightblue'
		},
		{
			title: 'Meeting 4',
			start: new Date(),
			groupId: 3,
			url: 'http://google.com'
		}
	];

	tabs: {
		title: string;
		icon: string;
		responsive: boolean;
		route: string;
	}[] = [];

	loading = true;

	constructor(
		private store: Store,
		private router: Router,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.store.selectedEmployee$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((emp) => {
						this.loadTabs(emp);
					});
			});
	}

	getRoute(name: string) {
		return `/pages/employees/appointments/${name}`;
	}

	manageAppointments() {
		this.router.navigate([this.getRoute('add')]);
	}

	loadTabs(selectedEmployee: SelectedEmployee) {
		let conditionalTabs = [];

		if (selectedEmployee && selectedEmployee.id) {
		}

		this.tabs = [];

		this.loading = false;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
