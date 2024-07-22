import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { UntypedFormBuilder, Validators, FormArray } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	CandidateStatusEnum,
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies,
	ICandidatePersonalQualities,
	ICandidateInterview,
	IOrganization
} from '@gauzy/contracts';
import {
	CandidateCriterionsRatingService,
	CandidateFeedbacksService,
	CandidatesService,
	ToastrService
} from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { EmployeeSelectorComponent } from '../../selectors/employee';

@Component({
	selector: 'ga-candidate-interview-feedback',
	templateUrl: './candidate-interview-feedback.component.html',
	styleUrls: ['./candidate-interview-feedback.component.scss']
})
export class CandidateInterviewFeedbackComponent extends TranslationBaseComponent implements OnInit {
	@Input() candidateId: string;
	@Input() interviewId: string;
	@Input() currentInterview: ICandidateInterview;
	@ViewChild('employeeSelector') employeeSelector: EmployeeSelectorComponent;

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
	organization: IOrganization;

	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewFeedbackComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private candidatesService: CandidatesService,
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private candidateCriterionsRatingService: CandidateCriterionsRatingService,
		private readonly store: Store
	) {
		super(translateService);
	}
	ngOnInit() {
		this.organization = this.store.selectedOrganization;
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
			this.averageRating = this.setRating(item.technologies, item.personalQualities);
		});
	}
	private setRating(technologies: number[], qualities: number[]) {
		this.technologiesList.forEach((tech, index) => (tech.rating = technologies[index]));
		this.personalQualitiesList.forEach((qual, index) => (qual.rating = qualities[index]));
		const techSum =
			technologies.length > 0 ? technologies.reduce((sum, current) => sum + current, 0) / technologies.length : 0;
		const qualSum =
			qualities.length > 0 ? qualities.reduce((sum, current) => sum + current, 0) / qualities.length : 0;
		const isSomeEmpty = (technologies.length > 0 ? 1 : 0) + (qualities.length > 0 ? 1 : 0);
		const res = techSum || qualSum ? (techSum + qualSum) / isSomeEmpty : 0;
		return res;
	}

	private async loadFeedbacks() {
		const { id: organizationId, tenantId } = this.organization;
		const result = await this.candidateFeedbacksService.getAll(['interviewer'], {
			candidateId: this.candidateId,
			organizationId,
			tenantId
		});
		if (result) {
			for (const feedback of result.items) {
				if (feedback.interviewId === this.interviewId && feedback.interviewer) {
					this.disabledIds.push(feedback.interviewer.employeeId);
					if (feedback.status === CandidateStatusEnum.REJECTED) {
						this.isRejected = true;
					} else {
						this.isRejected = false;
					}
					this.statusHire =
						feedback.status === CandidateStatusEnum.HIRED ? this.statusHire + 1 : this.statusHire;
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
		const { id: organizationId, tenantId } = this.organization;
		const description = this.form.get('description').value;
		if (
			this.form.valid &&
			this.status &&
			this.form.get('technologies').value.every((el: number) => el) &&
			this.form.get('personalQualities').value.every((el: number) => el)
		) {
			try {
				const feedback = await this.candidateFeedbacksService.create({
					...this.emptyFeedback,
					candidateId: this.candidateId,
					interviewId: this.interviewId,
					organizationId,
					tenantId
				});
				if (this.technologiesList.length !== 0 || this.personalQualitiesList.length !== 0) {
					await this.candidateCriterionsRatingService.createBulk(
						feedback.id,
						this.technologiesList,
						this.personalQualitiesList
					);
				}
				const updated = await this.candidateFeedbacksService.update(feedback.id, {
					description: description,
					rating:
						this.technologiesList.length === 0 && this.personalQualitiesList.length === 0
							? this.form.get('rating').value
							: this.averageRating,
					interviewer: this.feedbackInterviewer,
					status: this.status,
					organizationId,
					tenantId
				});
				this.setStatus(this.status);
				this.technologiesList.forEach((tech) => (tech.rating = null));
				this.personalQualitiesList.forEach((qual) => (qual.rating = null));
				this.dialogRef.close(updated);
				this.form.reset();
			} catch (error) {
				this.toastrService.danger('NOTES.CANDIDATE.EXPERIENCE.ERROR', 'TOASTR.TITLE.ERROR', {
					error: error.error ? error.error.message : error.message
				});
			}
		} else {
			this.toastrService.danger('NOTES.CANDIDATE.INVALID_FORM', 'TOASTR.MESSAGE.CANDIDATE_FEEDBACK_REQUIRED');
		}
	}

	private async setStatus(status: string) {
		if (status === CandidateStatusEnum.REJECTED) {
			await this.candidatesService.setCandidateAsRejected(this.candidateId);
		} else if (this.statusHire + 1 === this.currentInterview.employees.length) {
			await this.candidatesService.setCandidateAsHired(this.candidateId);
		} else {
			await this.candidatesService.setCandidateAsApplied(this.candidateId);
		}
	}
	private loadCriterions() {
		this.personalQualitiesList = this.currentInterview.personalQualities;
		this.technologiesList = this.currentInterview.technologies;
		const technologyRating = this.form.get('technologies') as FormArray;
		this.technologiesList.forEach((item) => {
			technologyRating.push(this.fb.control(item.rating));
		});

		const personalQualityRating = this.form.get('personalQualities') as FormArray;
		this.personalQualitiesList.forEach((item) => {
			personalQualityRating.push(this.fb.control(item.rating));
		});
	}
	closeDialog() {
		this.dialogRef.close();
		this.form.reset();
	}
}
