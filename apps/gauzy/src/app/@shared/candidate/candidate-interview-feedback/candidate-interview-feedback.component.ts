import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { FormBuilder, Validators, FormArray } from '@angular/forms';
import { CandidateFeedbacksService } from '../../../@core/services/candidate-feedbacks.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { CandidatesService } from '../../../@core/services/candidates.service';
import {
	CandidateStatus,
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies,
	ICandidatePersonalQualities,
	ICandidateInterview
} from '@gauzy/models';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { CandidateCriterionsRatingService } from '../../../@core/services/candidate-criterions-rating.service';

@Component({
	selector: 'ga-candidate-interview-feedback',
	templateUrl: './candidate-interview-feedback.component.html',
	styleUrls: ['./candidate-interview-feedback.component.scss']
})
export class CandidateInterviewFeedbackComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input() candidateId: string;
	@Input() interviewId: string;
	@Input() currentInterview: ICandidateInterview;
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;
	form: any;
	interviewTitle: string;
	feedbacks: ICandidateFeedback[] = null;
	status: any;
	statusHire = 0;
	interviewers: ICandidateInterviewers[];
	feedbackInterviewer: ICandidateInterviewers;
	isRejected: boolean;
	selectedEmployeeId: string;
	disabledIds: string[] = [];
	technologiesList: ICandidateTechnologies[];
	personalQualitiesList: ICandidatePersonalQualities[];
	averageRating = null;
	emptyFeedback = {
		description: '',
		rating: null,
		status: null,
		interviewer: null
	};
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewFeedbackComponent>,
		private readonly fb: FormBuilder,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidatesService: CandidatesService,
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private candidateCriterionsRatingService: CandidateCriterionsRatingService
	) {
		super(translateService);
	}
	ngOnInit() {
		this._initializeForm();
		this.loadCriterions();
		this.loadFeedbacks();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			description: ['', Validators.required],
			rating: [''],
			technologies: this.fb.array([]),
			personalQualities: this.fb.array([])
		});
		this.form.valueChanges.subscribe((item) => {
			this.averageRating = this.setRating(
				item.technologies,
				item.personalQualities
			);
		});
	}
	private setRating(technologies: number[], qualities: number[]) {
		this.technologiesList.map(
			(tech, index) => (tech.rating = technologies[index])
		);
		this.personalQualitiesList.map(
			(qual, index) => (qual.rating = qualities[index])
		);
		const techSum = technologies.reduce((sum, current) => sum + current, 0);
		const qualSum = qualities.reduce((sum, current) => sum + current, 0);
		const res =
			techSum || qualSum
				? (techSum / technologies.length + qualSum / qualities.length) /
				  2
				: 0;
		return res;
	}

	private async loadFeedbacks() {
		const result = await this.candidateFeedbacksService.getAll(
			['interviewer'],
			{ candidateId: this.candidateId }
		);
		if (result) {
			for (const feedback of result.items) {
				if (
					feedback.interviewId === this.interviewId &&
					feedback.interviewer
				) {
					this.disabledIds.push(feedback.interviewer.employeeId);

					if (feedback.status === CandidateStatus.REJECTED) {
						this.isRejected = true;
					} else {
						this.isRejected = false;
					}
					this.statusHire =
						feedback.status === CandidateStatus.HIRED
							? this.statusHire + 1
							: this.statusHire;
				}
			}
		}
	}

	onMembersSelected(id: string) {
		this.selectedEmployeeId = id;
		for (const item of this.currentInterview.interviewers) {
			if (this.selectedEmployeeId === item.employeeId) {
				this.feedbackInterviewer = item;
			}
		}
	}

	async createFeedback() {
		const description = this.form.get('description').value;
		if (this.form.valid) {
			try {
				const feedback = await this.candidateFeedbacksService.create({
					...this.emptyFeedback,
					candidateId: this.candidateId,
					interviewId: this.interviewId
				});

				await this.candidateCriterionsRatingService.createBulk(
					feedback.id,
					this.technologiesList,
					this.personalQualitiesList
				);
				await this.candidateFeedbacksService.update(feedback.id, {
					description: description,
					rating: this.averageRating,
					interviewer: this.feedbackInterviewer,
					status: this.status
				});
				this.setStatus(this.status);
				this.technologiesList.map((tech) => (tech.rating = null));
				this.personalQualitiesList.map((qual) => (qual.rating = null));
				this.dialogRef.close();
				this.form.reset();
				this.toastrService.success(
					this.getTranslation('TOASTR.TITLE.SUCCESS'),
					this.getTranslation('TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED')
				);
			} catch (error) {
				this.toastrService.danger(
					this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
						error: error.error ? error.error.message : error.message
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

	private async setStatus(status: string) {
		if (status === CandidateStatus.REJECTED) {
			await this.candidatesService.setCandidateAsRejected(
				this.candidateId
			);
		} else if (
			this.statusHire + 1 ===
			this.currentInterview.employees.length
		) {
			await this.candidatesService.setCandidateAsHired(this.candidateId);
		} else {
			await this.candidatesService.setCandidateAsApplied(
				this.candidateId
			);
		}
	}
	private loadCriterions() {
		this.technologiesList = this.currentInterview.technologies;
		this.personalQualitiesList = this.currentInterview.personalQualities;

		const technologyRating = this.form.get('technologies') as FormArray;
		this.technologiesList.forEach((item) => {
			technologyRating.push(this.fb.control(item.rating));
		});

		const personalQualityRating = this.form.get(
			'personalQualities'
		) as FormArray;
		this.personalQualitiesList.forEach((item) => {
			personalQualityRating.push(this.fb.control(item.rating));
		});
	}
	closeDialog() {
		this.dialogRef.close();
		this.form.reset();
	}
}
