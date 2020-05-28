import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { FormBuilder, Validators } from '@angular/forms';
import { CandidateFeedbacksService } from '../../../@core/services/candidate-feedbacks.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import {
	CandidateStatus,
	ICandidateFeedback,
	ICandidateInterviewers,
} from '@gauzy/models';
import { CandidateInterviewersService } from '../../../@core/services/candidate-interviewers.service';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { EmployeesService } from '../../../@core/services';
@Component({
	selector: 'ga-candidate-interview-feedback',
	templateUrl: './candidate-interview-feedback.component.html',
	styleUrls: ['./candidate-interview-feedback.component.scss'],
})
export class CandidateInterviewFeedbackComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input() candidateId: string;
	@Input() interviewId: string;
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;
	form: any;
	interviewTitle: string;
	feedbacks: ICandidateFeedback[] = null;
	status: any;
	statusHire = 0;
	interviewers: ICandidateInterviewers[];
	description: string;
	rating: number;
	feedbackInterviewer: ICandidateInterviewers;
	isRejected: boolean;
	selectedEmployeeId: string;
	employeesForSelect: any[] = [];
	disabledIds: string[] = [];
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewFeedbackComponent>,
		private readonly fb: FormBuilder,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidatesService: CandidatesService,
		private candidateInterviewService: CandidateInterviewService,
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private candidateInterviewersService: CandidateInterviewersService,
		private employeesService: EmployeesService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.loadData();
		this._initializeForm();
		this.loadFeedbacks();
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
		const interviewers = await this.candidateInterviewersService.findByInterviewId(
			this.interviewId
		);
		if (interviewers) {
			this.interviewers = interviewers;
			for (const item of interviewers) {
				const employee = await this.employeesService.getEmployeeById(
					item.employeeId,
					['user']
				);
				if (employee) {
					this.employeesForSelect.push(employee);
				}
			}
		}
	}

	async loadFeedbacks() {
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

	async onMembersSelected(id: string) {
		this.selectedEmployeeId = id;
		for (const item of this.interviewers) {
			if (this.selectedEmployeeId === item.employeeId) {
				this.feedbackInterviewer = item;
			}
		}
	}

	async createFeedback() {
		this.description = this.form.get('description').value;
		this.rating = this.form.get('rating').value;
		if (this.form.valid) {
			try {
				await this.candidateFeedbacksService.create({
					description: this.description,
					rating: this.rating,
					candidateId: this.candidateId,
					interviewId: this.interviewId,
					interviewer: this.feedbackInterviewer,
					status: this.status,
				});
				this.setStatus(this.status);
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

	async setStatus(status: string) {
		if (status === CandidateStatus.REJECTED) {
			await this.candidatesService.setCandidateAsRejected(
				this.candidateId
			);
		} else if (this.statusHire + 1 === this.employeesForSelect.length) {
			await this.candidatesService.setCandidateAsHired(this.candidateId);
		} else {
			await this.candidatesService.setCandidateAsApplied(
				this.candidateId
			);
		}
	}

	closeDialog() {
		this.dialogRef.close();
	}
}
