import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import {
	FormBuilder,
	Validators,
	FormGroup,
	FormArray,
	FormControl
} from '@angular/forms';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { takeUntil, first } from 'rxjs/operators';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';
import {
	ICandidateFeedback,
	CandidateStatus,
	ICandidateInterviewers,
	ICandidateInterview,
	ICandidateTechnologies,
	ICandidatePersonalQualities,
	Employee
} from '@gauzy/models';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { CandidateCriterionsRatingService } from 'apps/gauzy/src/app/@core/services/candidate-criterions-rating.service';
import { DeleteFeedbackComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-confirmation/delete-feedback/delete-feedback.component';

@Component({
	selector: 'ga-edit-candidate-feedbacks',
	templateUrl: './edit-candidate-feedbacks.component.html',
	styleUrls: ['./edit-candidate-feedbacks.component.scss']
})
export class EditCandidateFeedbacksComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	feedbackId = null;
	showAddCard: boolean;
	feedbackList: ICandidateFeedback[] = [];
	allFeedbacks: ICandidateFeedback[] = [];
	candidateId: string;
	form: FormGroup;
	status: string;
	currentInterview: ICandidateInterview;
	feedbackInterviewId: string;
	feedbackInterviewer: ICandidateInterviewers;
	statusHire: number;
	all = 'all';
	interviewersHire: ICandidateInterviewers[] = [];
	interviewers = [];
	averageRating: number;
	technologiesList: ICandidateTechnologies[];
	personalQualitiesList: ICandidatePersonalQualities[];
	currentFeedback: ICandidateFeedback;
	isCancel = false;
	loading: boolean;
	employeeList: Employee[];
	isEmployeeReset: boolean;
	selectInterview: FormControl = new FormControl();
	interviewList: ICandidateInterview[];
	constructor(
		private readonly fb: FormBuilder,
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private employeesService: EmployeesService,
		private dialogService: NbDialogService,
		private candidatesService: CandidatesService,
		private candidateInterviewService: CandidateInterviewService,
		private candidateCriterionsRatingService: CandidateCriterionsRatingService
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadInterviews();
				}
			});
		const { items } = await this.employeesService
			.getAll(['user'])
			.pipe(first())
			.toPromise();
		this.employeeList = items;
	}
	private _initializeForm() {
		this.form = new FormGroup({
			feedbacks: this.fb.array([])
		});
		const feedbackForm = this.form.controls.feedbacks as FormArray;
		feedbackForm.push(
			this.fb.group({
				description: ['', Validators.required],
				rating: [this.averageRating ? this.averageRating : null],
				technologies: this.fb.array([]),
				personalQualities: this.fb.array([])
			})
		);
	}
	private async loadFeedbacks() {
		const res = await this.candidateFeedbacksService.getAll(
			['interviewer', 'criterionsRating'],
			{ candidateId: this.candidateId }
		);
		if (res) {
			this.feedbackList = res.items;
			this.allFeedbacks = res.items;
			return this.feedbackList;
		}
	}
	private async loadCriterions(feedback: ICandidateFeedback) {
		if (feedback.interviewId) {
			this.currentInterview = this.interviewList.find(
				(item) => item.id === feedback.interviewId
			);
			this.technologiesList = this.currentInterview.technologies;
			this.personalQualitiesList = this.currentInterview.personalQualities;
			feedback.criterionsRating.forEach((item) => {
				this.technologiesList.forEach((tech) =>
					tech.id === item.technologyId
						? (tech.rating = item.rating)
						: null
				);
				this.personalQualitiesList.forEach((qual) =>
					qual.id === item.personalQualityId
						? (qual.rating = item.rating)
						: null
				);
			});
		}
		const techRating = this.form.get([
			'feedbacks',
			0,
			'technologies'
		]) as FormArray;
		const qualRating = this.form.get([
			'feedbacks',
			0,
			'personalQualities'
		]) as FormArray;
		if (qualRating.controls.length < this.personalQualitiesList.length) {
			this.personalQualitiesList.forEach((item) => {
				qualRating.push(this.fb.control(item.rating));
			});
		}
		if (techRating.controls.length < this.technologiesList.length) {
			this.technologiesList.forEach((item) => {
				techRating.push(this.fb.control(item.rating));
			});
		}
		this.form.valueChanges.subscribe((item) => {
			this.averageRating = this.setRating(
				item.feedbacks[0].technologies,
				item.feedbacks[0].personalQualities
			);
		});
	}
	private setRating(technologies: number[], qualities: number[]) {
		this.technologiesList.forEach(
			(tech, index) => (tech.rating = technologies[index])
		);
		this.personalQualitiesList.forEach(
			(qual, index) => (qual.rating = qualities[index])
		);
		const techSum =
			technologies.length > 0
				? technologies.reduce((sum, current) => sum + current, 0) /
				  technologies.length
				: 0;
		const qualSum =
			qualities.length > 0
				? qualities.reduce((sum, current) => sum + current, 0) /
				  qualities.length
				: 0;
		const isSomeEmpty =
			(technologies.length > 0 ? 1 : 0) + (qualities.length > 0 ? 1 : 0);
		const res = techSum || qualSum ? (techSum + qualSum) / isSomeEmpty : 0;
		return res;
	}
	async loadInterviews() {
		const result = await this.candidateInterviewService.getAll(
			['feedbacks', 'interviewers', 'technologies', 'personalQualities'],
			{ candidateId: this.candidateId }
		);
		const { items } = await this.candidatesService
			.getAll(['user', 'interview', 'feedbacks'])
			.pipe(first())
			.toPromise();
		if (result) {
			this.interviewList = result.items;
			this.interviewList.forEach((interview) => {
				items.forEach((candidate) => {
					if (interview.candidateId === candidate.id) {
						interview.candidate = candidate;
					}
				});
			});
			this.loading = true;
			const feedbackList = await this.loadFeedbacks();
			feedbackList.forEach((fb) => {
				const currentInterview = this.interviewList.find(
					(interview) =>
						fb.interviewId && interview.id === fb.interviewId
				);
				fb.interviewTitle = currentInterview
					? currentInterview.title
					: '';
				this.employeeList.forEach((item) => {
					if (
						fb.interviewId &&
						fb.interviewer.employeeId === item.id
					) {
						fb.interviewer.employeeImageUrl = item.user.imageUrl;
						fb.interviewer.employeeName = item.user.name;
					}
				});
			});
			const uniq = {};
			this.interviewList = this.interviewList.filter(
				(obj) => !uniq[obj.id] && (uniq[obj.id] = true)
			);
		}
		this.loading = false;
	}
	editFeedback(index: number, id: string) {
		this.currentFeedback = this.feedbackList[index];
		this._initializeForm();
		this.loadCriterions(this.currentFeedback);
		this.showAddCard = !this.showAddCard;
		this.form.controls.feedbacks.patchValue([this.currentFeedback]);
		this.feedbackId = id;
		if (this.currentFeedback.interviewId) {
			this.status = this.currentFeedback.status;
			this.feedbackInterviewer = this.currentFeedback.interviewer;
			this.feedbackInterviewId = this.currentFeedback.interviewId;
			this.interviewers = this.interviewList.find(
				(interview) => this.feedbackInterviewId === interview.id
			).interviewers;
			this.getStatusHire(this.feedbackInterviewId);
			this.interviewersHire = this.interviewers
				? this.interviewers
				: null;
			this.averageRating = this.currentFeedback.rating;
		}
	}
	onEmployeeSelected(id: string) {
		this.isEmployeeReset = false;
		this.selectInterview.reset();
		return (this.feedbackList = this.allFeedbacks.filter(
			(fb) => fb.interviewId && id === fb.interviewer.employeeId
		));
	}
	submitForm() {
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
			await this.candidateCriterionsRatingService.updateBulk(
				this.currentFeedback.criterionsRating,
				formValue['technologies'],
				formValue['personalQualities']
			);
			await this.candidateFeedbacksService.update(this.feedbackId, {
				description: formValue.description,
				rating:
					this.technologiesList.length === 0 &&
					this.personalQualitiesList.length === 0
						? formValue.rating
						: this.averageRating,
				interviewer: this.feedbackInterviewer,
				status: this.status
			});
			this.loadInterviews();
			this.toastrSuccess('UPDATED');
			this.setStatus(this.status);
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
				candidateId: this.candidateId
			});
			this.toastrSuccess('CREATED');
			this.loadInterviews();
			this.showAddCard = !this.showAddCard;
			this.form.controls.feedbacks.reset();
		} catch (error) {
			this.toastrError(error);
		}
	}
	async getStatusHire(interviewId: string) {
		this.statusHire = 0;
		const feedbacks = this.feedbackList.filter(
			(fb) => fb.interviewId === interviewId
		);
		feedbacks.forEach((fb) => {
			if (fb.interviewId === interviewId) {
				this.statusHire =
					fb.status === CandidateStatus.HIRED
						? this.statusHire + 1
						: this.statusHire;
			}
		});
	}
	async setStatus(status: string) {
		this.getStatusHire(this.feedbackInterviewId);
		if (status === CandidateStatus.REJECTED) {
			await this.candidatesService.setCandidateAsRejected(
				this.candidateId
			);
		} else if (
			this.interviewers &&
			this.statusHire === this.interviewers.length
		) {
			await this.candidatesService.setCandidateAsHired(this.candidateId);
		} else {
			await this.candidatesService.setCandidateAsApplied(
				this.candidateId
			);
		}
	}
	async removeFeedback(id: string) {
		const dialog = this.dialogService.open(DeleteFeedbackComponent, {
			context: {
				feedbackId: id
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('DELETED');
			this.loadInterviews();
		}
	}
	onInterviewSelected(value: any) {
		this.isEmployeeReset = true;
		this.feedbackList = this.allFeedbacks;
		if (value !== 'all') {
			this.feedbackList = this.feedbackList.filter(
				(fb) => fb.interviewId === value
			);
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
	cancel() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.feedbacks.reset();
		this.form.reset();
		this.status = null;
		this.feedbackInterviewer = null;
		this.feedbackInterviewId = null;
		this.interviewers = [];
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.reset();
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
