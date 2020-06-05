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
	candidates: Candidate[];
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
		this.getData();
	}
	async getData() {
		const { items } = await this.candidatesService
			.getAll(['user'])
			.pipe(first())
			.toPromise();
		if (items) {
			this.candidates = items;
			for (const candidate of this.candidates) {
				// this.getCandidateRating(candidate.id);
				const res = await this.candidateFeedbacksService.getAll(
					['interviewer'],
					{
						candidateId: candidate.id
					}
				);
				if (res) {
					this.candidateRating = 0;
					for (let i = 0; i < res.total; i++) {
						candidate.rating += +res.items[i].rating / res.total;
					}
				}
			}
		}
	}
	// async getCandidateRating(id: string) {
	// 	const res = await this.candidateFeedbacksService.getAll(
	// 		['interviewer'],
	// 		{
	// 			candidateId: id
	// 		}
	// 	);
	// 	if (res) {
	// 		this.candidateRating = 0;
	// 		for (let i = 0; i < res.total; i++) {
	// 			this.candidateRating += +res.items[i].rating / res.total;
	// 		}
	// 	}
	// }

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
