import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { OptionsInput, EventInput } from '@fullcalendar/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

@Component({
	selector: 'ngx-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html'
})
export class ManageCandidateInterviewsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: OptionsInput;

	calendarEvents: EventInput[] = [];

	constructor(
		private router: Router,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.calendarOptions = {
			initialView: 'timeGridWeek',
			header: {
				left: 'prev,next today',
				center: 'title',
				right: 'timeGridWeek'
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
			events: this.calendarEvents
		};
	}

	ngOnInit(): void {}

	getRoute(name: string) {
		return `/pages/employees/appointments/${name}`;
	}

	manageAppointments() {
		this.router.navigate([this.getRoute('add')]);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
