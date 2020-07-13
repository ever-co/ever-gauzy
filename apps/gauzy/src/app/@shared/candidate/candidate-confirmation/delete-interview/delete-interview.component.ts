import { ICandidateInterview } from '@gauzy/models';
import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../language-base/translation-base.component';
import { CandidateTechnologiesService } from 'apps/gauzy/src/app/@core/services/candidate-technologies.service';
import { CandidatePersonalQualitiesService } from 'apps/gauzy/src/app/@core/services/candidate-personal-qualities.service';
import { CandidateInterviewersService } from 'apps/gauzy/src/app/@core/services/candidate-interviewers.service';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';

@Component({
	selector: 'ga-delete-interview',
	templateUrl: 'delete-interview.component.html',
	styleUrls: ['delete-interview.component.scss']
})
export class DeleteInterviewComponent extends TranslationBaseComponent
	implements OnDestroy {
	@Input() interview: ICandidateInterview;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<DeleteInterviewComponent>,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private candidateInterviewService: CandidateInterviewService,
		private candidateTechnologiesService: CandidateTechnologiesService,
		private candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		private candidateInterviewersService: CandidateInterviewersService
	) {
		super(translateService);
	}

	async delete() {
		try {
			if (this.interview.personalQualities.length > 0) {
				await this.candidatePersonalQualitiesService.deleteBulkByInterviewId(
					this.interview.id
				);
			}
			if (this.interview.technologies.length > 0) {
				await this.candidateTechnologiesService.deleteBulkByInterviewId(
					this.interview.id
				);
			}
			await this.candidateInterviewersService.deleteBulkByInterviewId(
				this.interview.id
			);
			await this.candidateInterviewService.delete(this.interview.id);
			this.dialogRef.close(this.interview);
		} catch (error) {
			this.toastrError(error);
		}
	}

	private toastrError(error) {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
				error: error.error ? error.error.message : error.message
			}),
			this.getTranslation('TOASTR.TITLE.ERROR')
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
