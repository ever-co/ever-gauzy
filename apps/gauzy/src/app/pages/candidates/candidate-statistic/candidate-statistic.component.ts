import { Candidate } from '@gauzy/models';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { TranslateService } from '@ngx-translate/core';
import { CandidateFeedbacksService } from '../../../@core/services/candidate-feedbacks.service';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ga-candidate-statistic',
	templateUrl: './candidate-statistic.component.html',
	styleUrls: ['./candidate-statistic.component.scss']
})
export class CandidateStatisticComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	candidateRating: number;
	public candidates: Candidate[] = null;
	public names: string[] = [];
	rating: number[] = [];

	constructor(
		private candidatesService: CandidatesService,
		private translate: TranslateService,
		private errorHandler: ErrorHandlingService,
		private candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(translate);
	}

	ngOnInit() {
		this.loadData();
	}

	async loadData() {
		const { items } = await this.candidatesService
			.getAll(['user', 'interview', 'feedbacks'])
			.pipe(first())
			.toPromise();
		if (items) {
			for (const candidate of items) {
				const feedbacks = await this.candidateFeedbacksService.getAll(
					['interviewer'],
					{
						candidateId: candidate.id
					}
				);
				if (feedbacks) {
					this.candidateRating = 0;
					for (let i = 0; i < feedbacks.total; i++) {
						candidate.rating +=
							+feedbacks.items[i].rating / feedbacks.total;
					}
				}
			}
			this.candidates = items;
			// console.log(this.candidates);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
