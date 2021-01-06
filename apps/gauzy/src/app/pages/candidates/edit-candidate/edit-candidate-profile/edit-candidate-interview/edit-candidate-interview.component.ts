import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { CandidateInterviewMutationComponent } from '../../../../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { filter, first } from 'rxjs/operators';
import { CandidateInterviewService } from '../../../../../@core/services/candidate-interview.service';
import { CandidateStore } from '../../../../../@core/services/candidate-store.service';
import { FormGroup } from '@angular/forms';
import {
	ICandidate,
	ICandidateInterview,
	ICandidateInterviewers,
	ComponentLayoutStyleEnum,
	IEmployee,
	ICandidateFeedback,
	IOrganization
} from '@gauzy/models';
import { EmployeesService } from '../../../../../@core/services';
import { CandidateInterviewFeedbackComponent } from '../../../../../@shared/candidate/candidate-interview-feedback/candidate-interview-feedback.component';
import { DeleteInterviewComponent } from '../../../../../@shared/candidate/candidate-confirmation/delete-interview/delete-interview.component';
import { ComponentEnum } from '../../../../../@core/constants/layout.constants';
import { LocalDataSource } from 'ng2-smart-table';
import { Store } from '../../../../../@core/services/store.service';
import { InterviewActionsTableComponent } from '../../../manage-candidate-interviews/interview-panel/table-components/actions/actions.component';
import { InterviewDateTableComponent } from '../../../manage-candidate-interviews/interview-panel/table-components/date/date.component';
import { InterviewStarRatingComponent } from '../../../manage-candidate-interviews/interview-panel/table-components/rating/rating.component';
import { InterviewersTableComponent } from '../../../manage-candidate-interviews/interview-panel/table-components/interviewers/interviewers.component';
import { InterviewCriterionsTableComponent } from '../../../manage-candidate-interviews/interview-panel/table-components/criterions/criterions.component';
import { CandidateFeedbacksService } from '../../../../../@core/services/candidate-feedbacks.service';
import { CandidatesService } from '../../../../../@core/services/candidates.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-candidate-interview',
	templateUrl: './edit-candidate-interview.component.html',
	styleUrls: ['./edit-candidate-interview.component.scss']
})
export class EditCandidateInterviewComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	interviewList: ICandidateInterview[];
	candidateId: string;
	selectedCandidate: ICandidate;
	selectedOrganization: IOrganization;
	interviewers: ICandidateInterviewers[];
	interviewersNumber: number;
	form: FormGroup;
	loading: boolean;
	onlyPast = false;
	onlyFuture = false;
	@ViewChild('interviewsTable') interviewsTable;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	tableInterviewList = [];
	employeeList: IEmployee[];
	candidates: ICandidate[];
	allInterviews: ICandidateInterview[];
	allFeedbacks: ICandidateFeedback[];
	constructor(
		private dialogService: NbDialogService,
		private candidatesService: CandidatesService,
		private employeesService: EmployeesService,
		private candidateFeedbacksService: CandidateFeedbacksService,
		private readonly candidateInterviewService: CandidateInterviewService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private store: Store,
		private toastrService: ToastrService
	) {
		super(translateService);
		this.setView();
	}
	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(
				filter((candidate) => !!candidate),
				untilDestroyed(this)
			)
			.subscribe((candidate) => {
				this.selectedCandidate = candidate;
				if (candidate) {
					this.selectedOrganization = this.store.selectedOrganization;
					this.candidateId = candidate.id;
					this.loadInterview();
					this.loadSmartTable();
					this._applyTranslationOnSmartTable();

					const {
						id: organizationId,
						tenantId
					} = this.selectedOrganization;
					this.candidatesService
						.getAll(['user'], { organizationId, tenantId })
						.pipe(untilDestroyed(this))
						.subscribe((candidates) => {
							this.candidates = candidates.items;
						});
				}
			});
	}
	setView() {
		this.viewComponentName = ComponentEnum.INTERVIEWS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				title: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.TITLE'
					),
					type: 'string'
				},
				date: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.DATE'
					),
					type: 'custom',
					width: '120px',
					renderComponent: InterviewDateTableComponent,
					filter: false,
					class: 'text-center'
				},
				rating: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.RATING'
					),
					type: 'custom',
					width: '136px',
					renderComponent: InterviewStarRatingComponent,
					filter: false
				},
				employees: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.INTERVIEWERS'
					),
					type: 'custom',
					width: '155px',
					renderComponent: InterviewersTableComponent,
					filter: false
				},
				criterions: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.CRITERIONS'
					),
					type: 'custom',
					renderComponent: InterviewCriterionsTableComponent,
					filter: false
				},
				location: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.LOCATION'
					),
					type: 'string'
				},
				note: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.NOTES'
					),
					type: 'string',
					filter: false
				},
				actions: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.ACTIONS'
					),
					width: '150px',
					type: 'custom',
					renderComponent: InterviewActionsTableComponent,
					filter: false,
					onComponentInitFunction: (instance) => {
						instance.updateResult.subscribe((params) => {
							switch (params.type) {
								case 'feedback':
									this.addInterviewFeedback(params.data.id);
									break;
								case 'edit':
									this.editInterview(params.data.id);
									break;
								case 'remove':
									this.removeInterview(params.data.id);
									break;
							}
						});
					}
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}
	async add() {
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'
					),
					selectedCandidate: this.selectedCandidate,
					interviewList: this.interviewList
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('CREATED');
			this.loadInterview();
		}
	}

	private async loadInterview() {
		this.loading = true;
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const {
			items: allFeedbacks = []
		} = await this.candidateFeedbacksService.getAll(['interviewer'], {
			organizationId,
			tenantId
		});
		this.allFeedbacks = allFeedbacks;

		const { items } = await this.employeesService
			.getAll(['user'], {
				organizationId,
				tenantId
			})
			.pipe(first())
			.toPromise();
		this.employeeList = items;
		const interviews = await this.candidateInterviewService.getAll(
			[
				'feedbacks',
				'interviewers',
				'technologies',
				'personalQualities',
				'candidate'
			],
			{ candidateId: this.candidateId, organizationId, tenantId }
		);
		if (interviews) {
			this.interviewList = interviews.items;
			this.allInterviews = interviews.items;
			this.tableInterviewList = [];
			this.interviewList.forEach((interview) => {
				const employees = [];
				interview.interviewers.forEach(
					(interviewer: ICandidateInterviewers) => {
						this.employeeList.forEach((employee: IEmployee) => {
							if (interviewer.employeeId === employee.id) {
								interviewer.employeeImageUrl =
									employee.user.imageUrl;
								interviewer.employeeName = employee.user.name;
								employees.push(employee);
							}
						});
					}
				);
				this.candidates.forEach((item) => {
					if (item.id === interview.candidate.id) {
						interview.candidate.user = item.user;
					}
				});

				interview.employees = employees;
				this.tableInterviewList.push({
					...interview,
					fullName: this.selectedCandidate.user.name,
					imageUrl: this.selectedCandidate.user.imageUrl,
					showArchive: false,
					employees: employees,
					allFeedbacks: this.allFeedbacks
				});
			});
		}
		this.interviewList = this.onlyPast
			? this.filterInterviewByTime(this.interviewList, true)
			: this.interviewList;

		this.interviewList = this.onlyFuture
			? this.filterInterviewByTime(this.interviewList, false)
			: this.interviewList;

		this.tableInterviewList = this.onlyPast
			? this.filterInterviewByTime(this.tableInterviewList, true)
			: this.tableInterviewList;

		this.tableInterviewList = this.onlyFuture
			? this.filterInterviewByTime(this.tableInterviewList, false)
			: this.tableInterviewList;

		this.sourceSmartTable.load(this.tableInterviewList);
		this.loading = false;
	}

	async addInterviewFeedback(id: string) {
		const currentInterview = this.interviewList.find(
			(item) => item.id === id
		);
		if (
			currentInterview.feedbacks.length !==
			currentInterview.interviewers.length
		) {
			const dialog = this.dialogService.open(
				CandidateInterviewFeedbackComponent,
				{
					context: {
						currentInterview: currentInterview,
						candidateId: this.selectedCandidate.id,
						interviewId: id
					}
				}
			);
			const data = await dialog.onClose.pipe(first()).toPromise();
			if (data) {
				this.toastrSuccess('CREATED');
				this.loadInterview();
			}
		} else {
			this.toastrService.warning(
				'TOASTR.MESSAGE.CANDIDATE_FEEDBACK_ABILITY'
			);
		}
	}

	async editInterview(id: string) {
		const currentInterview = this.interviewList.find(
			(item) => item.id === id
		);
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.EDIT_INTERVIEW'
					),
					editData: currentInterview,
					selectedCandidate: this.selectedCandidate,
					interviewId: id,
					interviewList: this.interviewList
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('UPDATED');
			this.loadInterview();
		}
	}

	isPastInterview(interview: ICandidateInterview) {
		const now = new Date().getTime();
		if (new Date(interview.startTime).getTime() > now) {
			return false;
		} else {
			return true;
		}
	}
	changePast(checked: boolean) {
		this.onlyPast = checked;
		if (this.onlyFuture) {
			this.onlyFuture = false;
		}
		this.loadInterview();
	}
	changeFuture(checked: boolean) {
		this.onlyFuture = checked;
		if (this.onlyPast) {
			this.onlyPast = false;
		}
		this.loadInterview();
	}
	filterInterviewByTime(list: ICandidateInterview[], isPast: boolean) {
		const now = new Date().getTime();
		return list.filter((item) =>
			isPast
				? new Date(item.startTime).getTime() < now
				: new Date(item.startTime).getTime() > now
		);
	}

	async removeInterview(id: string) {
		const currentInterview = this.interviewList.find(
			(item) => item.id === id
		);
		const dialog = this.dialogService.open(DeleteInterviewComponent, {
			context: {
				interview: currentInterview
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('DELETED');
			this.loadInterview();
		}
	}

	private toastrSuccess(text: string) {
		this.toastrService.success(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`);
	}
	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}
	ngOnDestroy() {}

	openEmployees(employeeId?: string) {}
}
