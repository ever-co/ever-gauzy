import { Component, OnDestroy, ViewChild, OnInit } from '@angular/core';
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
import { first, takeUntil } from 'rxjs/operators';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { Candidate } from '@gauzy/models';

@Component({
	selector: 'ngx-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('calendar', { static: true })
	calendarComponent: FullCalendarComponent;
	calendarOptions: OptionsInput;
	selectedInterview = true;
	selectedCandidateIds: string[];
	candidates: Candidate[] = [];
	calendarEvents: EventInput[] = [];
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private candidateInterviewService: CandidateInterviewService,
		private toastrService: NbToastrService,
		private candidatesService: CandidatesService
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.candidatesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidates) => {
				this.candidates = candidates.items;
			});
		this.loadInterviews();
	}
	async loadInterviews() {
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
		const res = await this.candidateInterviewService.getAll([
			'interviewers'
		]);
		if (res) {
			this.calendarEvents = [];
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

	async onCandidateSelected(id: string) {
		// TO DO
		// const candidate = await this.candidatesService.getCandidateById(id, [
		// 	'user'
		// ]);
		// this.selectedCandidate = candidate;
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
