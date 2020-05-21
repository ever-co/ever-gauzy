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
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { CandidateInterviewInfoComponent } from '../../../@shared/candidate/candidate-interview-info/candidate-interview-info.component';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { CandidateInterviewMutationComponent } from '../../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ngx-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent extends TranslationBaseComponent
	implements OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: OptionsInput;
	selectedInterview = true;
	calendarEvents: EventInput[] = [];
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private candidateInterviewService: CandidateInterviewService,
		private toastrService: NbToastrService
	) {
		super(translateService);
		this.loadInterviews();
		this.calendarOptions = {
			eventClick: (event) => {
				const id = event.event._def.extendedProps.id;

				this.dialogService.open(CandidateInterviewInfoComponent, {
					context: {
						interviewId: id
					}
				});
			},
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
			height: 'auto'
		};
	}

	async loadInterviews() {
		const res = await this.candidateInterviewService.getAll([
			'interviewers'
		]);
		if (res) {
			for (const interview of res.items) {
				this.calendarEvents.push({
					title: interview.title,
					start: interview.startTime,
					end: interview.endTime,
					extendedProps: {
						id: interview.id
					},
					backgroundColor: '#36f'
				});
			}
			this.calendarOptions.events = this.calendarEvents;
		}
	}
	async add() {
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					isCalendar: true
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrService.success(
				this.getTranslation('TOASTR.TITLE.SUCCESS'),
				this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED`)
			);
			this.loadInterviews();
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
