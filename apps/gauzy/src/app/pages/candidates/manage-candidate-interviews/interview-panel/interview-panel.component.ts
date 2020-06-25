import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { ICandidateInterview } from '@gauzy/models';
@Component({
	selector: 'ga-interview-panel',
	templateUrl: './interview-panel.component.html',
	styleUrls: ['./interview-panel.component.scss']
})
export class InterviewPanelComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	interviewList: ICandidateInterview[];
	constructor(
		readonly translateService: TranslateService,
		private candidateInterviewService: CandidateInterviewService
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.loadInterviews();
	}
	async loadInterviews() {
		const res = await this.candidateInterviewService.getAll([
			'interviewers',
			'candidate',
			'technologies',
			'personalQualities',
			'feedbacks'
		]);
		if (res) {
			this.interviewList = res.items;
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
