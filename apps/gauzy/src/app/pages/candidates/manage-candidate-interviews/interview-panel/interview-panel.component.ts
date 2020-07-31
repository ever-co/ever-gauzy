import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import {
	ICandidateInterview,
	Candidate,
	Employee,
	ICandidateFeedback,
	ICandidateInterviewers
} from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { CandidateInterviewMutationComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { DeleteInterviewComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-confirmation/delete-interview/delete-interview.component';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { LocalDataSource } from 'ng2-smart-table';
import { InterviewStarRatingComponent } from './table-components/rating/rating.component';
import { InterviewCriterionsTableComponent } from './table-components/criterions/criterions.component';
import { InterviewDateTableComponent } from './table-components/date/date.component';
import { InterviewersTableComponent } from './table-components/interviewers/interviewers.component';
import { InterviewActionsTableComponent } from './table-components/actions/actions.component';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { PictureNameTagsComponent } from 'apps/gauzy/src/app/@shared/table-components/picture-name-tags/picture-name-tags.component';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';

@Component({
	selector: 'ga-interview-panel',
	templateUrl: './interview-panel.component.html',
	styleUrls: ['./interview-panel.component.scss']
})
export class InterviewPanelComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	interviewList: ICandidateInterview[];
	candidates: Candidate[];
	averageRating: number;
	employeeList: Employee[];
	allInterviews: ICandidateInterview[];
	interviewTitle: ICandidateInterview[];
	allFeedbacks: ICandidateFeedback[];
	isResetSelect: boolean;
	loading: boolean;
	addedInterview: ICandidateInterview[];
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedEmployees: string[] = [];
	@ViewChild('interviewsTable') interviewsTable;
	constructor(
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private candidateInterviewService: CandidateInterviewService,
		private router: Router,
		private candidateStore: CandidateStore,
		private candidatesService: CandidatesService,
		private employeesService: EmployeesService,
		private candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.candidatesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidates) => {
				this.candidates = candidates.items;
			});
		this.loadInterviews();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();

		this.candidateStore.interviewList$.subscribe(() => {
			this.loadInterviews();
		});
	}
	selectInterview(value) {}

	onEmployeeSelected(empIds: string[]) {
		this.selectedEmployees = empIds;
		this.interviewList = this.findByEmployee(this.allInterviews);
	}
	findByEmployee(list: ICandidateInterview[]) {
		if (!this.selectedEmployees[0]) {
			this.interviewList = list;
		} else {
			const result = [];
			list.forEach((interview) => {
				interview.interviewers.forEach((interviewer) => {
					this.selectedEmployees.forEach((item: string) => {
						if (
							item === interviewer.employeeId &&
							!result.includes(interview)
						) {
							result.push(interview);
						}
					});
				});
			});
			this.interviewList = result;
		}
		return this.interviewList;
	}
	async loadInterviews() {
		const res = await this.candidateFeedbacksService.getAll([
			'interviewer'
		]);
		if (res) {
			this.allFeedbacks = res.items;
		}
		this.loading = true;
		const { items } = await this.employeesService
			.getAll(['user'])
			.pipe(first())
			.toPromise();
		const interviews = await this.candidateInterviewService.getAll([
			'feedbacks',
			'interviewers',
			'technologies',
			'personalQualities',
			'candidate'
		]);
		if (interviews) {
			this.interviewList = interviews.items;
			this.allInterviews = interviews.items;
			const result = [];
			this.interviewList.forEach((interview) => {
				const employees = [];
				interview.interviewers.forEach(
					(interviewer: ICandidateInterviewers) => {
						items.forEach((employee: Employee) => {
							if (interviewer.employeeId === employee.id) {
								employees.push(employee);
							}
						});
					}
				);
				this.candidates.forEach((item) => {
					if (item.id === interview.candidate.id) {
						result.push({
							...interview,
							fullName: item.user.name,
							imageUrl: item.user.imageUrl,
							employees: employees,
							allFeedbacks: this.allFeedbacks
						});
					}
				});
			});
			this.sourceSmartTable.load(result);
			this.loading = false;
		}
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.CANDIDATE'
					),
					type: 'custom',
					renderComponent: PictureNameTagsComponent,
					class: 'align-row'
				},
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
					width: '145px',
					type: 'custom',
					renderComponent: InterviewActionsTableComponent,
					filter: false,
					onComponentInitFunction: (instance) => {
						instance.updateResult.subscribe((params) => {
							if (params.isEdit) {
								this.editInterview(params.data.id);
							} else {
								this.removeInterview(params.data.id);
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
					selectedCandidate: currentInterview.candidate,
					interviewId: id,
					interviewList: this.interviewList
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('UPDATED');
			this.loadInterviews();
		}
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
			this.loadInterviews();
		}
	}
	goToCandidate(id: string) {
		this.router.navigate([
			`/pages/employees/candidates/edit/${id}/profile/interview`
		]);
	}
	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`)
		);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}
}
