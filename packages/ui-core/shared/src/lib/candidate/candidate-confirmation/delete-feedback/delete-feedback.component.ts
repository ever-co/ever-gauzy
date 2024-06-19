import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ToastrService } from '@gauzy/ui-core/core';
import { CandidateCriterionsRatingService, CandidateFeedbacksService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-delete-feedback',
	templateUrl: 'delete-feedback.component.html',
	styleUrls: ['delete-feedback.component.scss']
})
export class DeleteFeedbackComponent extends TranslationBaseComponent implements OnDestroy {
	@Input() feedbackId: string;

	constructor(
		protected readonly dialogRef: NbDialogRef<DeleteFeedbackComponent>,
		readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService,
		private readonly candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(translateService);
	}

	async delete() {
		try {
			const res = await this.candidateFeedbacksService.findById(this.feedbackId);
			if (res && res.interviewId) {
				await this.candidateCriterionsRatingService.deleteBulkByFeedbackId(this.feedbackId);
				await this.candidateFeedbacksService.delete(this.feedbackId, res.interviewId);
			} else {
				await this.candidateFeedbacksService.delete(this.feedbackId);
			}

			this.dialogRef.close(this.feedbackId);
		} catch (error) {
			this.toastrError(error);
		}
	}

	private toastrError(error) {
		this.toastrService.danger('NOTES.CANDIDATE.EXPERIENCE.ERROR', 'TOASTR.TITLE.ERROR', error);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {}
}
