import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { FormBuilder, Validators } from '@angular/forms';
import { CandidateFeedbacksService } from '../../../@core/services/candidate-feedbacks.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
@Component({
	selector: 'ngx-candidate-interview-feedback',
	templateUrl: './candidate-interview-feedback.component.html',
	styleUrls: ['./candidate-interview-feedback.component.scss'],
})
export class CandidateInterviewFeedbackComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input() candidateId: string;
	@Input() interviewId: string;
	form: any;
	interviewTitle: string;
	status: any;
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewFeedbackComponent>,
		private readonly fb: FormBuilder,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidatesService: CandidatesService,
		private candidateInterviewService: CandidateInterviewService,
		private readonly candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.loadData();
		this._initializeForm();
	}
	private async _initializeForm() {
		this.form = this.fb.group({
			description: ['', Validators.required],
			rating: ['', Validators.required],
		});
	}
	async loadData() {
		const res = await this.candidateInterviewService.findById(
			this.interviewId
		);
		if (res) {
			this.interviewTitle = res.title;
		}
	}
	async createFeedback() {
		if (this.form.valid) {
			try {
				await this.candidateFeedbacksService.create({
					...this.form.value,
					candidateId: this.candidateId,
				});
				if (this.status) {
					await this.candidatesService.setCandidateAsHired(
						this.candidateId
					);
				} else if (!this.status) {
					await this.candidatesService.setCandidateAsRejected(
						this.candidateId
					);
				}
				this.dialogRef.close();
				this.toastrService.success(
					this.getTranslation('TOASTR.TITLE.SUCCESS'),
					this.getTranslation('TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED')
				);
			} catch (error) {
				this.toastrService.danger(
					this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
						error: error.error
							? error.error.message
							: error.message,
					}),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			}
		} else {
			this.toastrService.danger(
				this.getTranslation('NOTES.CANDIDATE.INVALID_FORM'),
				this.getTranslation(
					'TOASTR.MESSAGE.CANDIDATE_FEEDBACK_REQUIRED'
				)
			);
		}
	}
	closeDialog() {
		this.dialogRef.close();
	}
}
