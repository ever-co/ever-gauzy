import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { FormBuilder, Validators, FormGroup, FormArray } from '@angular/forms';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { takeUntil } from 'rxjs/operators';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';
import { ICandidateFeedback } from '@gauzy/models';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';

@Component({
	selector: 'ga-edit-candidate-feedbacks',
	templateUrl: './edit-candidate-feedbacks.component.html',
	styleUrls: ['./edit-candidate-feedbacks.component.scss'],
})
export class EditCandidateFeedbacksComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	feedbackId = null;
	showAddCard: boolean;
	feedbackList: ICandidateFeedback[] = [];
	candidateId: string;
	form: FormGroup;
	constructor(
		private readonly fb: FormBuilder,
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private candidateInterviewService: CandidateInterviewService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadFeedbacks();
				}
			});
	}
	private async _initializeForm() {
		this.form = new FormGroup({
			feedbacks: this.fb.array([]),
		});
		const feedbackForm = this.form.controls.feedbacks as FormArray;
		feedbackForm.push(
			this.fb.group({
				description: ['', Validators.required],
				rating: ['', Validators.required],
			})
		);
	}
	private async loadFeedbacks() {
		const res = await this.candidateFeedbacksService.getAll({
			candidateId: this.candidateId,
		});
		if (res) {
			this.feedbackList = res.items;
			this.loadInterviews(this.feedbackList);
		}
	}

	async loadInterviews(feedbackList: ICandidateFeedback[]) {
		for (const item of feedbackList) {
			if (item.interviewId) {
				const res = await this.candidateInterviewService.findById(
					item.interviewId
				);
				if (res) {
					item.interviewTitle = res.title;
				}
			}
		}
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.feedbacks.reset();
	}

	editFeedback(index: number, id: string) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.feedbacks.patchValue([this.feedbackList[index]]);
		this.feedbackId = id;
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.feedbacks.value.length = 0;
	}

	async submitForm() {
		const feedbackForm = this.form.controls.feedbacks as FormArray;
		const formValue = { ...feedbackForm.value[0] };

		if (feedbackForm.valid) {
			if (this.feedbackId !== null) {
				this.updateFeedback(formValue);
			} else {
				this.createFeedback(formValue);
			}
		} else {
			this.toastrInvalid();
		}
	}

	async updateFeedback(formValue: ICandidateFeedback) {
		try {
			await this.candidateFeedbacksService.update(this.feedbackId, {
				...formValue,
			});
			this.loadFeedbacks();
			this.toastrSuccess('UPDATED');
			this.showAddCard = !this.showAddCard;
			this.form.controls.feedbacks.reset();
		} catch (error) {
			this.toastrError(error);
		}
		this.feedbackId = null;
	}
	async createFeedback(formValue: ICandidateFeedback) {
		try {
			await this.candidateFeedbacksService.create({
				...formValue,
				candidateId: this.candidateId,
			});
			this.toastrSuccess('CREATED');
			this.loadFeedbacks();
			this.showAddCard = !this.showAddCard;
			this.form.controls.feedbacks.reset();
		} catch (error) {
			this.toastrError(error);
		}
	}

	async removeFeedback(id: string) {
		try {
			await this.candidateFeedbacksService.delete(id);
			this.toastrSuccess('DELETED');
			this.loadFeedbacks();
		} catch (error) {
			this.toastrError(error);
		}
	}

	private toastrError(error) {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
				error: error.error ? error.error.message : error.message,
			}),
			this.getTranslation('TOASTR.TITLE.ERROR')
		);
	}

	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`)
		);
	}
	private toastrInvalid() {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.INVALID_FORM'),
			this.getTranslation('TOASTR.MESSAGE.CANDIDATE_FEEDBACK_REQUIRED')
		);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
