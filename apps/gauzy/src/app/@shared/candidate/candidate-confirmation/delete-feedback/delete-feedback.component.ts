import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../language-base/translation-base.component';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';
import { CandidateCriterionsRatingService } from 'apps/gauzy/src/app/@core/services/candidate-criterions-rating.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

@Component({
	selector: 'ga-delete-feedback',
	templateUrl: 'delete-feedback.component.html',
	styleUrls: ['delete-feedback.component.scss']
})
export class DeleteFeedbackComponent
	extends TranslationBaseComponent
	implements OnDestroy {
	@Input() feedbackId: string;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		protected dialogRef: NbDialogRef<DeleteFeedbackComponent>,
		readonly translateService: TranslateService,
		private toastrService: ToastrService,
		private candidateCriterionsRatingService: CandidateCriterionsRatingService,
		private candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(translateService);
	}

	async delete() {
		try {
			const res = await this.candidateFeedbacksService.findById(
				this.feedbackId
			);
			if (res && res.interviewId) {
				await this.candidateCriterionsRatingService.deleteBulk(
					this.feedbackId
				);
				await this.candidateFeedbacksService.delete(
					this.feedbackId,
					res.interviewId
				);
			} else {
				await this.candidateFeedbacksService.delete(this.feedbackId);
			}

			this.dialogRef.close(this.feedbackId);
		} catch (error) {
			this.toastrError(error);
		}
	}
	private toastrError(error) {
		this.toastrService.danger(
			'NOTES.CANDIDATE.EXPERIENCE.ERROR',
			'TOASTR.TITLE.ERROR',
			error
		);
	}
	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
