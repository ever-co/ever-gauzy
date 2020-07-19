import { ICandidateInterview } from '@gauzy/models';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { CandidateInterviewMutationComponent } from '../../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';

@Component({
	selector: 'ga-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	tabs: any[];
	interviewList: ICandidateInterview[];

	private _ngDestroy$ = new Subject<void>();
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		public candidateInterviewService: CandidateInterviewService
	) {
		super(translateService);
	}
	ngOnInit() {
		this.loadTabs();
		this._applyTranslationOnTabs();
		this.loadInterviews();
	}
	getRoute(tab: string): string {
		return `/pages/employees/candidates/interviews/${tab}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.CALENDAR'
				),
				responsive: true,
				route: this.getRoute('calendar')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.INTERVIEWS'
				),
				responsive: true,
				route: this.getRoute('interview_panel')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.CRITERIONS'
				),
				responsive: true,
				route: this.getRoute('criterion')
			}
		];
	}
	async add() {
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'
					),
					isCalendar: true,
					interviewList: this.interviewList
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
	async loadInterviews() {
		const res = await this.candidateInterviewService.getAll([
			'feedbacks',
			'interviewers',
			'technologies',
			'personalQualities',
			'candidate'
		]);
		if (res) {
			this.interviewList = res.items;
		}
	}
	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadTabs();
			});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
