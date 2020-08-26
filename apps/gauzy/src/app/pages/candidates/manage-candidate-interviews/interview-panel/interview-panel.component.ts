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
	ICandidateInterviewers,
	ComponentLayoutStyleEnum
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
import { ComponentEnum } from 'apps/gauzy/src/app/@core/constants/layout.constants';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ArchiveConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/archive-confirmation/archive-confirmation.component';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { CandidateInterviewFeedbackComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-interview-feedback/candidate-interview-feedback.component';

@Component({
	selector: 'ga-interview-panel',
	templateUrl: './interview-panel.component.html',
	styleUrls: ['./interview-panel.component.scss']
})
export class InterviewPanelComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	interviewList: ICandidateInterview[];
	tableInterviewList = [];
	candidates: Candidate[];
	averageRating: number;
	employeeList: Employee[];
	allInterviews: ICandidateInterview[];
	interviewTitle: ICandidateInterview[];
	allFeedbacks: ICandidateFeedback[];
	isResetSelect: boolean;
	loading: boolean;
	includeArchived = false;
	onlyPast = false;
	onlyFuture = false;
	addedInterview: ICandidateInterview[];
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedEmployees: string[] = [];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	@ViewChild('interviewsTable') interviewsTable;
	constructor(
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private readonly store: Store,
		private toastrService: NbToastrService,
		private candidateInterviewService: CandidateInterviewService,
		private router: Router,
		private errorHandler: ErrorHandlingService,
		private candidateStore: CandidateStore,
		private candidatesService: CandidatesService,
		private employeesService: EmployeesService,
		private candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(translateService);
		this.setView();
	}
	async ngOnInit() {
		this.candidatesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidates) => {
				this.candidates = candidates.items;
			});
		this.loadInterviews();
		this.candidateStore.interviewList$.subscribe(() => {
			this.loadInterviews();
		});
	}
	onEmployeeSelected(empIds: string[]) {
		this.selectedEmployees = empIds;
		this.interviewList = this.findByEmployee(this.allInterviews);
		const tableList = this.findByEmployee(this.tableInterviewList);
		this.sourceSmartTable.load(tableList);
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
		this.employeeList = items;
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
			this.tableInterviewList = [];
			const result = [];
			this.interviewList.forEach((interview) => {
				const employees = [];
				interview.interviewers.forEach(
					(interviewer: ICandidateInterviewers) => {
						this.employeeList.forEach((employee: Employee) => {
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
						result.push({
							...interview,
							fullName: item.user.name,
							imageUrl: item.user.imageUrl,
							employees: employees,
							showArchive: true,
							allFeedbacks: this.allFeedbacks
						});
					}
				});
				// For rating
				if (interview.feedbacks.length > 0) {
					const rate: number[] = [];
					interview.feedbacks.forEach((fb) => {
						rate.push(Number(fb.rating));
					});
					const fbSum = rate.reduce((sum, current) => {
						return sum + current;
					});
					interview.rating = fbSum / interview.feedbacks.length;
				} else {
					interview.rating = 0;
				}
			});
			// for grid view
			this.interviewList = this.onlyPast
				? this.filterInterviewByTime(this.interviewList, true)
				: this.interviewList;

			this.interviewList = this.onlyFuture
				? this.filterInterviewByTime(this.interviewList, false)
				: this.interviewList;

			this.interviewList = this.includeArchivedCheck(
				this.includeArchived,
				this.interviewList
			);
			// for table view
			this.tableInterviewList = this.includeArchivedCheck(
				this.includeArchived,
				result
			);
			this.tableInterviewList = this.onlyPast
				? this.filterInterviewByTime(this.tableInterviewList, true)
				: this.tableInterviewList;

			this.tableInterviewList = this.onlyFuture
				? this.filterInterviewByTime(this.tableInterviewList, false)
				: this.tableInterviewList;

			this.sourceSmartTable.load(this.tableInterviewList);
			this.loading = false;
			this.loadSmartTable();
			this._applyTranslationOnSmartTable();
		}
	}
	filterInterviewByTime(list: ICandidateInterview[], isPast: boolean) {
		const now = new Date().getTime();
		let res: ICandidateInterview[] = [];
		return (res = list.filter((item) =>
			isPast
				? new Date(item.startTime).getTime() < now
				: new Date(item.startTime).getTime() > now
		));
	}

	includeArchivedCheck(
		includeArchived: boolean,
		list: ICandidateInterview[]
	) {
		let res: ICandidateInterview[] = [];
		if (!includeArchived) {
			list.forEach((interview) => {
				if (!interview.isArchived) {
					res.push(interview);
				}
			});
		} else {
			res = list;
		}
		return res;
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
					width: '150px',
					type: 'custom',
					renderComponent: InterviewActionsTableComponent,
					filter: false,
					onComponentInitFunction: (instance) => {
						instance.updateResult.subscribe((params) => {
							switch (params.type) {
								case 'feedback':
									this.addFeedback(params.data);
									break;
								case 'archive':
									this.archive(params.data);
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
	setView() {
		this.viewComponentName = ComponentEnum.TEAMS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}
	changeIncludeArchived(checked: boolean) {
		this.includeArchived = checked;
		this.loadInterviews();
	}
	changePast(checked: boolean) {
		this.onlyPast = checked;
		if (this.onlyFuture) {
			this.onlyFuture = false;
		}
		this.loadInterviews();
	}
	changeFuture(checked: boolean) {
		this.onlyFuture = checked;
		if (this.onlyPast) {
			this.onlyPast = false;
		}
		this.loadInterviews();
	}
	async addFeedback(interview: ICandidateInterview) {
		if (!this.isPastInterview(interview)) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.TITLE.WARNING'),
				this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.FEEDBACK_PROHIBIT'
				)
			);
		} else {
			if (interview.feedbacks.length !== interview.interviewers.length) {
				const dialog = this.dialogService.open(
					CandidateInterviewFeedbackComponent,
					{
						context: {
							currentInterview: interview,
							candidateId: interview.candidate.id,
							interviewId: interview.id
						}
					}
				);
				const data = await dialog.onClose.pipe(first()).toPromise();
				if (data) {
					this.toastrSuccess('CREATED');
					this.loadInterviews();
				}
			} else {
				this.toastrService.primary(
					this.getTranslation('TOASTR.TITLE.WARNING'),
					this.getTranslation(
						'TOASTR.MESSAGE.CANDIDATE_FEEDBACK_ABILITY'
					)
				);
			}
		}
	}
	archive(interview: ICandidateInterview) {
		if (interview.isArchived) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.TITLE.WARNING'),
				this.getTranslation('TOASTR.MESSAGE.ARCHIVE_INTERVIEW')
			);
		} else {
			this.dialogService
				.open(ArchiveConfirmationComponent, {
					context: {
						recordType: `${interview.title}`
					}
				})
				.onClose.pipe(takeUntil(this._ngDestroy$))
				.subscribe(async (result) => {
					if (result) {
						try {
							await this.candidateInterviewService.setInterviewAsArchived(
								interview.id
							);
							this.toastrService.primary(
								`${interview.title}` + '  set as archived.',
								'Success'
							);
							this.loadInterviews();
						} catch (error) {
							this.errorHandler.handleError(error);
						}
					}
				});
		}
	}
	async editInterview(id: string) {
		const currentInterview = this.interviewList.find(
			(item) => item.id === id
		);
		if (this.isPastInterview(currentInterview)) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.TITLE.WARNING'),
				this.getTranslation('TOASTR.MESSAGE.EDIT_PAST_INTERVIEW')
			);
		} else {
			const candidate = await this.candidatesService
				.getAll(['user'], {
					id: currentInterview.candidate.id
				})
				.pipe(first())
				.toPromise();
			const dialog = this.dialogService.open(
				CandidateInterviewMutationComponent,
				{
					context: {
						header: this.getTranslation(
							'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.EDIT_INTERVIEW'
						),
						editData: currentInterview,
						selectedCandidate: candidate.items[0],
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
	}
	async removeInterview(id: string) {
		const currentInterview = this.interviewList.find(
			(item) => item.id === id
		);
		if (this.isPastInterview(currentInterview)) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.TITLE.WARNING'),
				this.getTranslation('TOASTR.MESSAGE.DELETE_PAST_INTERVIEW')
			);
		} else {
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
	}
	goToCandidate(id: string) {
		this.router.navigate([
			`/pages/employees/candidates/edit/${id}/profile`
		]);
	}
	isPastInterview(interview: ICandidateInterview) {
		const now = new Date().getTime();
		if (new Date(interview.startTime).getTime() > now) {
			return false;
		} else {
			return true;
		}
	}
	openEmployees(id: string) {
		this.router.navigate([`/pages/employees/edit/${id}`]);
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
