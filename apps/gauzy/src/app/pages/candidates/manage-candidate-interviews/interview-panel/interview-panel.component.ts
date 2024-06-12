import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { filter, firstValueFrom, Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
	ICandidateInterview,
	ICandidate,
	IEmployee,
	ICandidateFeedback,
	ICandidateInterviewers,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { tap, debounceTime } from 'rxjs/operators';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { CandidateInterviewMutationComponent } from './../../../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { DeleteInterviewComponent } from './../../../../@shared/candidate/candidate-confirmation/delete-interview/delete-interview.component';
import { InterviewStarRatingComponent } from './table-components/rating/rating.component';
import { ComponentEnum } from '@gauzy/ui-sdk/common';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-sdk/core';
import {
	CandidateFeedbacksService,
	CandidateInterviewService,
	CandidatesService,
	CandidateStore,
	EmployeesService
} from '@gauzy/ui-sdk/core';
import { CandidateInterviewFeedbackComponent } from './../../../../@shared/candidate/candidate-interview-feedback/candidate-interview-feedback.component';
import {
	ArchiveConfirmationComponent,
	IPaginationBase,
	PaginationFilterBaseComponent,
	PictureNameTagsComponent
} from '@gauzy/ui-sdk/shared';
import {
	InterviewActionsTableComponent,
	InterviewCriterionsTableComponent,
	InterviewDateTableComponent,
	InterviewersTableComponent
} from './table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-interview-panel',
	templateUrl: './interview-panel.component.html',
	styleUrls: ['./interview-panel.component.scss']
})
export class InterviewPanelComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	interviewList: ICandidateInterview[];
	tableInterviewList = [];
	candidates: ICandidate[];
	averageRating: number;
	employeeList: IEmployee[];
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
	organization: IOrganization;
	disabled: boolean = true;
	selectedInterview: ICandidateInterview;
	private _refresh$: Subject<boolean> = new Subject();

	constructor(
		private readonly dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly candidateInterviewService: CandidateInterviewService,
		private readonly router: Router,
		private readonly errorHandler: ErrorHandlingService,
		private readonly candidateStore: CandidateStore,
		private readonly candidatesService: CandidatesService,
		private readonly employeesService: EmployeesService,
		private readonly candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.loadInterviews()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.getCandidates();
					this.candidateStore.interviewList$.pipe(untilDestroyed(this)).subscribe();
				}
			});
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.tableInterviewList = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 * @returns
	 */
	getCandidates() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		const candidates$ = this.candidatesService.getAll(['user'], {
			organizationId,
			tenantId
		});
		candidates$
			.pipe(
				tap(({ items }) => (this.candidates = items)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onEmployeeSelected(empIds: string[]) {
		this.selectedEmployees = empIds;
		this.interviewList = this.findByEmployee(this.allInterviews);
		const tableList = this.findByEmployee(this.tableInterviewList);
		this.sourceSmartTable.load(tableList);
		this._loadGridLayoutData();
		this.setPagination({
			...this.getPagination(),
			totalItems: this.sourceSmartTable.count()
		});
	}

	findByEmployee(list: ICandidateInterview[]) {
		if (!this.selectedEmployees[0]) {
			this.interviewList = list;
		} else {
			const result = [];
			list.forEach((interview) => {
				interview.interviewers.forEach((interviewer) => {
					this.selectedEmployees.forEach((item: string) => {
						if (item === interviewer.employeeId && !result.includes(interview)) {
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
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;

		try {
			this.loading = true;
			const { activePage, itemsPerPage } = this.getPagination();
			const res = await this.candidateFeedbacksService.getAll(['interviewer'], { organizationId, tenantId });
			if (res) {
				this.allFeedbacks = res.items;
			}

			const { items } = await firstValueFrom(
				this.employeesService.getAll(['user'], {
					organizationId,
					tenantId
				})
			);
			this.employeeList = items;

			const interviews = await this.candidateInterviewService.getAll(
				['feedbacks', 'interviewers', 'technologies', 'personalQualities', 'candidate'],
				{ organizationId, tenantId }
			);
			if (interviews) {
				this.interviewList = interviews.items;
				this.allInterviews = interviews.items;
				let tableInterviewList = [];
				const result = [];
				this.interviewList.forEach((interview) => {
					const employees = [];
					interview.interviewers.forEach((interviewer: ICandidateInterviewers) => {
						this.employeeList.forEach((employee: IEmployee) => {
							if (interviewer.employeeId === employee.id) {
								interviewer.employeeImageUrl = employee.user.imageUrl;
								interviewer.employeeName = employee.user.name;
								employees.push(employee);
							}
						});
					});
					this.candidates.forEach((candidate) => {
						if (candidate.id === interview?.candidate?.id) {
							interview.candidate.user = candidate.user;
							result.push({
								...interview,
								fullName: candidate.user.name,
								imageUrl: candidate.user.imageUrl,
								employees: employees,
								showArchive: true,
								allFeedbacks: this.allFeedbacks,
								hideActions: true
							});
						}
					});
				});
				// for grid view
				this.interviewList = this.onlyPast
					? this.filterInterviewByTime(this.interviewList, true)
					: this.interviewList;

				this.interviewList = this.onlyFuture
					? this.filterInterviewByTime(this.interviewList, false)
					: this.interviewList;

				this.interviewList = this.includeArchivedCheck(this.includeArchived, this.interviewList);
				//for table view
				tableInterviewList = this.includeArchivedCheck(this.includeArchived, result);
				tableInterviewList = this.onlyPast
					? this.filterInterviewByTime(tableInterviewList, true)
					: tableInterviewList;

				tableInterviewList = this.onlyFuture
					? this.filterInterviewByTime(tableInterviewList, false)
					: tableInterviewList;
				this.sourceSmartTable.setPaging(activePage, itemsPerPage, false);
				this.sourceSmartTable.load(this._getUniquesById(tableInterviewList));
				this._loadGridLayoutData();
				this.setPagination({
					...this.getPagination(),
					totalItems: this.sourceSmartTable.count()
				});
			}
		} catch (error) {
			console.log('Error while getting candidate inteviews', error);
		} finally {
			this.loading = false;
		}
	}

	private _getUniquesById(array: any[]) {
		return array.filter((value, index, self) => index === self.findIndex(({ id }) => id === value.id));
	}

	private async _loadGridLayoutData() {
		if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
			this.tableInterviewList.push(...(await this.sourceSmartTable.getElements()));
			this.tableInterviewList = this._getUniquesById(this.tableInterviewList);
		}
	}

	filterInterviewByTime(list: ICandidateInterview[], isPast: boolean) {
		const now = new Date().getTime();
		return list.filter((item) =>
			isPast ? new Date(item.startTime).getTime() < now : new Date(item.startTime).getTime() > now
		);
	}

	includeArchivedCheck(includeArchived: boolean, list: ICandidateInterview[]) {
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

	_loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.INTERVIEW'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			columns: {
				fullName: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.CANDIDATE'),
					type: 'custom',
					class: 'align-row',
					renderComponent: PictureNameTagsComponent,
					componentInitFunction: (instance: PictureNameTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				title: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.TITLE'),
					type: 'string'
				},
				date: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.DATE'),
					type: 'custom',
					width: '120px',
					filter: false,
					renderComponent: InterviewDateTableComponent,
					componentInitFunction: (instance: InterviewDateTableComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				rating: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.RATING'),
					type: 'custom',
					filter: false,
					renderComponent: InterviewStarRatingComponent,
					componentInitFunction: (instance: InterviewStarRatingComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				employees: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.INTERVIEWERS'),
					type: 'custom',
					width: '155px',
					filter: false,
					renderComponent: InterviewersTableComponent,
					componentInitFunction: (instance: InterviewersTableComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				criterions: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.CRITERIONS'),
					type: 'custom',
					filter: false,
					renderComponent: InterviewCriterionsTableComponent,
					componentInitFunction: (instance: InterviewCriterionsTableComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				location: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.LOCATION'),
					type: 'string'
				},
				note: {
					title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.NOTES'),
					type: 'string',
					filter: false
				},
				actions: {
					title: this.getTranslation('SM_TABLE.LAST_UPDATED'),
					width: '10%',
					type: 'custom',
					filter: false,
					renderComponent: InterviewActionsTableComponent,
					componentInitFunction: (instance: InterviewActionsTableComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
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
			}
		};
	}

	setView() {
		this.viewComponentName = ComponentEnum.TEAMS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.tableInterviewList = [])),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	changeIncludeArchived(checked: boolean) {
		this.includeArchived = checked;
		this._refresh$.next(true);
		this.subject$.next(true);
	}

	changePast(checked: boolean) {
		this.onlyPast = checked;
		if (this.onlyFuture) {
			this.onlyFuture = false;
		}
		this._refresh$.next(true);
		this.subject$.next(true);
	}

	changeFuture(checked: boolean) {
		this.onlyFuture = checked;
		if (this.onlyPast) {
			this.onlyPast = false;
		}
		this._refresh$.next(true);
		this.subject$.next(true);
	}

	async addFeedback(interview: ICandidateInterview) {
		if (!this.isPastInterview(interview)) {
			this.toastrService.warning('CANDIDATES_PAGE.MANAGE_INTERVIEWS.FEEDBACK_PROHIBIT');
		} else {
			if (interview.feedbacks.length !== interview.interviewers.length) {
				const dialog = this.dialogService.open(CandidateInterviewFeedbackComponent, {
					context: {
						currentInterview: interview,
						candidateId: interview.candidate.id,
						interviewId: interview.id
					}
				});
				const data = await firstValueFrom(dialog.onClose);
				if (data) {
					this._refresh$.next(true);
					this.subject$.next(true);
					this.toastrService.success('TOASTR.MESSAGE.INTERVIEW_FEEDBACK_CREATED', {
						name: interview.title
					});
				}
			} else {
				this.toastrService.warning('TOASTR.MESSAGE.CANDIDATE_FEEDBACK_ABILITY');
			}
		}
	}

	archive(interview: ICandidateInterview) {
		if (interview.isArchived) {
			this.toastrService.warning('TOASTR.MESSAGE.ARCHIVE_INTERVIEW');
		} else {
			this.dialogService
				.open(ArchiveConfirmationComponent, {
					context: {
						recordType: `${interview.title}`
					}
				})
				.onClose.pipe(untilDestroyed(this))
				.subscribe(async (result) => {
					if (result) {
						try {
							await this.candidateInterviewService.setInterviewAsArchived(interview.id);
							this.toastrService.success('TOASTR.MESSAGE.ARCHIVE_INTERVIEW_SET', {
								name: interview.title
							});
							this._refresh$.next(true);
							this.subject$.next(true);
						} catch (error) {
							this.errorHandler.handleError(error);
						}
					}
				});
		}
	}

	async editInterview(id: string) {
		const currentInterview = this.interviewList.find((item) => item.id === id);
		if (this.isPastInterview(currentInterview)) {
			this.toastrService.warning('TOASTR.MESSAGE.EDIT_PAST_INTERVIEW');
		} else {
			const { id: organizationId, tenantId } = this.organization;
			const candidate = await firstValueFrom(
				this.candidatesService.getAll(['user'], {
					id: currentInterview.candidate.id,
					organizationId,
					tenantId
				})
			);
			const dialog = this.dialogService.open(CandidateInterviewMutationComponent, {
				context: {
					headerTitle: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.EDIT_INTERVIEW'),
					editData: currentInterview,
					selectedCandidate: candidate.items[0],
					interviewId: id,
					interviews: this.interviewList
				}
			});
			const data = await firstValueFrom(dialog.onClose);
			if (data) {
				this.toastrService.success('TOASTR.MESSAGE.INTERVIEW_UPDATED', {
					name: data.title
				});
				this._refresh$.next(true);
				this.subject$.next(true);
			}
		}
	}

	async removeInterview(id: string) {
		const currentInterview = this.interviewList.find((item) => item.id === id);
		if (this.isPastInterview(currentInterview)) {
			this.toastrService.warning('TOASTR.MESSAGE.DELETE_PAST_INTERVIEW');
		} else {
			const dialog = this.dialogService.open(DeleteInterviewComponent, {
				context: {
					interview: currentInterview
				}
			});
			const data = await firstValueFrom(dialog.onClose);
			if (data) {
				this.toastrService.success('TOASTR.MESSAGE.INTERVIEW_DELETED', {
					name: data.title
				});
				this._refresh$.next(true);
				this.subject$.next(true);
			}
		}
	}

	goToCandidate(id: string) {
		this.router.navigate([`/pages/employees/candidates/edit/${id}/profile`]);
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

	ngOnDestroy() {}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectInterview(interview: any) {
		this.selectedInterview = interview.data;
		this.disabled = !interview.isSelected;
	}

	async addInterview() {
		const dialog = this.dialogService.open(CandidateInterviewMutationComponent, {
			context: {
				headerTitle: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'),
				isCalendar: true,
				interviews: this.interviewList
			}
		});
		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.toastrService.success(`TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED`, {
				name: data.title
			});
		}
		this._refresh$.next(true);
		this.subject$.next(true);
	}
}
