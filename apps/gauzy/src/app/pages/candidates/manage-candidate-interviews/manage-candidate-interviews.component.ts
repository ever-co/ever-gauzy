import { Component, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { OptionsInput, EventInput } from '@fullcalendar/core';
import { TranslateService } from '@ngx-translate/core';
import bootstrapPlugin from '@fullcalendar/bootstrap';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGrigPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CandidateInterviewInfoComponent } from '../../../@shared/candidate/candidate-interview-info/candidate-interview-info.component';
import { NbDialogService } from '@nebular/theme';

@Component({
	selector: 'ngx-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html'
})
export class ManageCandidateInterviewsComponent extends TranslationBaseComponent
	implements OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: OptionsInput;
	selectedInterview = true;
	calendarEvents: EventInput[] = [
		{
			title: 'Meeting 1',
			start: new Date(),
			groupId: 1,
			allDay: true,
			url: '/'
		}
	];
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService
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
	async eventInfo() {
		if (this.selectedInterview) {
			this.dialogService.open(CandidateInterviewInfoComponent);
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
