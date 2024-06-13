import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormBuilder, Validators, UntypedFormGroup, FormArray, FormControl } from '@angular/forms';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom, tap } from 'rxjs';
import {
	ICandidateFeedback,
	CandidateStatusEnum,
	ICandidateInterviewers,
	ICandidateInterview,
	ICandidateTechnologies,
	ICandidatePersonalQualities,
	IEmployee,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { ComponentEnum, Store } from '@gauzy/ui-core/common';
import {
	CandidateCriterionsRatingService,
	CandidateFeedbacksService,
	CandidateInterviewService,
	CandidatesService,
	CandidateStore,
	EmployeesService,
	ToastrService
} from '@gauzy/ui-core/core';
import { InterviewersTableComponent } from '../../../manage-candidate-interviews/interview-panel/table-components/interviewers/interviewers.component';
import { InterviewStarRatingComponent } from '../../../manage-candidate-interviews/interview-panel/table-components/rating/rating.component';
import { FeedbackStatusTableComponent } from './table-components';
import { DeleteFeedbackComponent, PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-candidate-feedbacks',
	templateUrl: './edit-candidate-feedbacks.component.html',
	styleUrls: ['./edit-candidate-feedbacks.component.scss']
})
export class EditCandidateFeedbacksComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	feedbackId = null;
	showAddCard: boolean;
	feedbackList: ICandidateFeedback[] = [];
	allFeedbacks: ICandidateFeedback[] = [];
	candidateId: string;
	form: UntypedFormGroup;
	status: string;
	disableButton = true;
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
	employeeList: IEmployee[];
	selectedFeedback: ICandidateFeedback;
	isEmployeeReset: boolean;
	selectInterview: FormControl = new FormControl();
	interviewList: ICandidateInterview[];
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedOrganization: IOrganization;

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private readonly candidateStore: CandidateStore,
		private readonly employeesService: EmployeesService,
		private readonly dialogService: NbDialogService,
		private readonly candidatesService: CandidatesService,
		private readonly store: Store,
		private readonly candidateInterviewService: CandidateInterviewService,
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.candidateStore.selectedCandidate$.pipe(untilDestroyed(this)).subscribe((candidate) => {
			if (candidate) {
				this.selectedOrganization = this.store.selectedOrganization;
				this.candidateId = candidate.id;
				this._initializeForm();
				this.loadInterviews();
				this.getEmployees();
				this._applyTranslationOnSmartTable();
			}
		});
		this.loadSmartTableSettings();
		this.selectInterview.setValue('all');
	}
	async getEmployees() {
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;

		const { items } = await firstValueFrom(
			this.employeesService.getAll(['user'], {
				organizationId,
				tenantId
			})
		);
		this.employeeList = items;
		this.loading = false;
	}
	setView() {
		this.viewComponentName = ComponentEnum.FEEDBACKS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedFeedback = this.dataLayoutStyle === 'CARDS_GRID' ? null : this.selectedFeedback;
			});
	}
	private _initializeForm() {
		this.form = new UntypedFormGroup({
			feedbacks: this.fb.array([])
		});
		const feedbackForm = this.feedbacks;
		feedbackForm.push(
			this.fb.group({
				description: ['', Validators.required],
				rating: [this.averageRating ? this.averageRating : null],
				technologies: this.fb.array([]),
				personalQualities: this.fb.array([])
			})
		);
	}
	async loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			columns: {
				description: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.DESCRIPTION'),
					type: 'string',
					filter: false
				},
				rating: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.RATING'),
					type: 'custom',
					width: '136px',
					filter: false,
					renderComponent: InterviewStarRatingComponent,
					componentInitFunction: (instance: InterviewStarRatingComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				interviewTitle: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.INTERVIEW'),
					type: 'string',
					width: '200px'
				},
				employees: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEWER'),
					type: 'custom',
					width: '130px',
					filter: false,
					renderComponent: InterviewersTableComponent,
					componentInitFunction: (instance: InterviewersTableComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				status: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.FEEDBACK_STATUS'),
					type: 'custom',
					width: '5%',
					renderComponent: FeedbackStatusTableComponent,
					componentInitFunction: (instance: FeedbackStatusTableComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}
	private async loadFeedbacks() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const res = await this.candidateFeedbacksService.getAll(['interviewer', 'criterionsRating'], {
			candidateId: this.candidateId,
			organizationId,
			tenantId
		});
		if (res) {
			this.feedbackList = res.items;
			this.allFeedbacks = res.items;
			const feedbacksForTable = [];

			this.feedbackList.forEach((fb) => {
				const interview = this.interviewList.find((item) => item.id === fb.interviewId);
				feedbacksForTable.push({
					...fb,
					interviewTitle: interview ? interview.title : null,
					employees: fb.interviewer
						? [this.employeeList.find((emp) => emp.id === fb.interviewer.employeeId)]
						: null
				});
			});
			this.sourceSmartTable.load(feedbacksForTable);
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				this._loadGridLayoutData();
			}
			this.setPagination({
				...this.getPagination(),
				totalItems: this.sourceSmartTable.count()
			});
			return this.feedbackList;
		}
	}

	private async _loadGridLayoutData() {
		this.feedbackList = await this.sourceSmartTable.getElements();
	}

	private async loadCriterions(feedback: ICandidateFeedback) {
		if (feedback.interviewId) {
			this.currentInterview = this.interviewList.find((item) => item.id === feedback.interviewId);
			this.technologiesList = this.currentInterview.technologies;
			this.personalQualitiesList = this.currentInterview.personalQualities;
			feedback.criterionsRating.forEach((item) => {
				this.technologiesList.forEach((tech) =>
					tech.id === item.technologyId ? (tech.rating = item.rating) : null
				);
				this.personalQualitiesList.forEach((qual) =>
					qual.id === item.personalQualityId ? (qual.rating = item.rating) : null
				);
			});
		}
		const techRating = this.form.get(['feedbacks', 0, 'technologies']) as FormArray;
		const qualRating = this.form.get(['feedbacks', 0, 'personalQualities']) as FormArray;
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
			this.averageRating = this.setRating(item.feedbacks[0].technologies, item.feedbacks[0].personalQualities);
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
	async loadInterviews() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;

		const result = await this.candidateInterviewService.getAll(
			['feedbacks', 'interviewers', 'technologies', 'personalQualities'],
			{ candidateId: this.candidateId, organizationId, tenantId }
		);
		const { items } = await firstValueFrom(
			this.candidatesService.getAll(['user', 'interview', 'feedbacks'], {
				organizationId,
				tenantId
			})
		);

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
					(interview) => fb.interviewId && interview.id === fb.interviewId
				);
				fb.interviewTitle = currentInterview ? currentInterview.title : '';

				if (fb.interviewer) {
					this.employeeList.forEach((item) => {
						if (fb.interviewId && fb.interviewer.employeeId === item.id) {
							fb.interviewer.employeeImageUrl = item.user.imageUrl;
							fb.interviewer.employeeName = item.user.name;
						}
					});
				}
			});
			const uniq = {};
			this.interviewList = this.interviewList.filter((obj) => !uniq[obj.id] && (uniq[obj.id] = true));
		}
		this.loading = false;
	}
	editFeedback(feedback?: ICandidateFeedback) {
		this.cancel();
		this.currentFeedback = feedback ? feedback : this.selectedFeedback;
		this._initializeForm();
		if (this.currentFeedback.criterionsRating.length) {
			this.loadCriterions(this.currentFeedback);
		}
		this.showAddCard = this.showAddCard ? this.showAddCard : !this.showAddCard;
		this.form.controls.feedbacks.patchValue([this.currentFeedback]);
		this.feedbackId = this.currentFeedback.id;
		if (this.currentFeedback.interviewId) {
			this.status = this.currentFeedback.status;
			this.feedbackInterviewer = this.currentFeedback.interviewer;
			this.feedbackInterviewId = this.currentFeedback.interviewId;
			this.interviewers = this.interviewList.find(
				(interview) => this.feedbackInterviewId === interview.id
			).interviewers;
			this.getStatusHire(this.feedbackInterviewId);
			this.interviewersHire = this.interviewers ? this.interviewers : null;
			this.averageRating = this.currentFeedback.rating;
		}
	}
	onEmployeeSelected(id: string) {
		this.isEmployeeReset = false;
		this.selectInterview.reset();
		this.feedbackList = this.allFeedbacks.filter((fb) => fb.interviewId && id === fb.interviewer.employeeId);
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
			const { id: organizationId, tenantId } = this.selectedOrganization;
			await this.candidateCriterionsRatingService.updateBulk(
				this.currentFeedback.criterionsRating,
				formValue['technologies'],
				formValue['personalQualities']
			);
			await this.candidateFeedbacksService.update(this.feedbackId, {
				description: formValue.description,
				rating:
					this.technologiesList.length === 0 && this.personalQualitiesList.length === 0
						? formValue.rating
						: this.averageRating,
				interviewer: this.feedbackInterviewer,
				status: this.status,
				organizationId,
				tenantId
			});
			this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_FEEDBACK_UPDATED');
			this.loadInterviews();
			this.setStatus(this.status);
			this.showAddCard = !this.showAddCard;
			this.feedbacks.reset();
		} catch (error) {
			this.toastrError(error);
		}
		this.feedbackId = null;
	}
	async createFeedback(formValue: ICandidateFeedback) {
		try {
			const { id: organizationId, tenantId } = this.selectedOrganization;
			await this.candidateFeedbacksService.create({
				...formValue,
				candidateId: this.candidateId,
				organizationId,
				tenantId
			});
			this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_FEEDBACK_CREATED');
			this.loadInterviews();
			this.showAddCard = !this.showAddCard;
			this.feedbacks.reset();
		} catch (error) {
			this.toastrError(error);
		}
	}
	async getStatusHire(interviewId: string) {
		this.statusHire = 0;
		const feedbacks = this.feedbackList.filter((fb) => fb.interviewId === interviewId);
		feedbacks.forEach((fb) => {
			if (fb.interviewId === interviewId) {
				this.statusHire = fb.status === CandidateStatusEnum.HIRED ? this.statusHire + 1 : this.statusHire;
			}
		});
	}
	async setStatus(status: string) {
		this.getStatusHire(this.feedbackInterviewId);
		if (status === CandidateStatusEnum.REJECTED) {
			await this.candidatesService.setCandidateAsRejected(this.candidateId);
		} else if (this.interviewers && this.statusHire === this.interviewers.length) {
			await this.candidatesService.setCandidateAsHired(this.candidateId);
		} else {
			await this.candidatesService.setCandidateAsApplied(this.candidateId);
		}
	}
	async removeFeedback(id?: string) {
		const dialog = this.dialogService.open(DeleteFeedbackComponent, {
			context: {
				feedbackId: id ? id : this.selectedFeedback.id
			}
		});
		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_FEEDBACK_DELETED');
			this.loadInterviews();
		}
	}

	selectFeedback({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedFeedback = isSelected ? data : null;
	}

	onInterviewSelected(value: any) {
		this.isEmployeeReset = true;
		this.feedbackList = this.allFeedbacks;
		if (value !== 'all') {
			this.feedbackList = this.feedbackList.filter((fb) => fb.interviewId === value);
		}
	}

	private toastrError(error) {
		this.toastrService.danger(error);
	}

	private toastrInvalid() {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.INVALID_FORM'),
			this.getTranslation('TOASTR.MESSAGE.CANDIDATE_FEEDBACK_REQUIRED')
		);
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
		this.feedbacks.reset();
		this.form.reset();
		this.status = null;
		this.feedbackInterviewer = null;
		this.feedbackInterviewId = null;
		this.interviewers = [];
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Getter for candidate feedback form controls array
	 */
	get feedbacks(): FormArray {
		return this.form.get('feedbacks') as FormArray;
	}

	ngOnDestroy(): void {}
}
