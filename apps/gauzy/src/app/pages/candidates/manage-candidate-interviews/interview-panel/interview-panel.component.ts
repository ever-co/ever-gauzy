import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import {
	ICandidateInterview,
	Candidate,
	Employee,
	ICandidateFeedback
} from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { CandidateInterviewMutationComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { DeleteInterviewComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-confirmation/delete-interview/delete-interview.component';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { LocalDataSource } from 'ng2-smart-table';
import { InterviewCandidatePictureNameComponent } from './table-components/candidate/candidate.component';
import { InterviewStarRatingComponent } from './table-components/rating/rating.component';
import { InterviewCriterionsTableComponent } from './table-components/criterions/criterions.component';
import { InterviewDateTableComponent } from './table-components/date/date.component';
import { InterviewersTableComponent } from './table-components/interviewers/interviewers.component';
import { InterviewActionsTableComponent } from './table-components/actions/actions.component';

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
	interviewSearch: FormControl = new FormControl();
	candidateSearch: FormControl = new FormControl();
	sort: FormControl = new FormControl();
	feedbacks: ICandidateFeedback[];
	isResetSelect: boolean;
	filter = {
		name: '',
		title: '',
		empIds: null
	};
	loading: boolean;
	addedInterview: ICandidateInterview[];
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	@ViewChild('interviewsTable') interviewsTable;
	constructor(
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private candidateInterviewService: CandidateInterviewService,
		private router: Router,
		private candidateStore: CandidateStore
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadInterviews();
		this.interviewSearch.valueChanges.subscribe((item) => {
			this.filterBySearch(item, 'title');
		});
		this.candidateSearch.valueChanges.subscribe((item) => {
			this.filterBySearch(item, 'name');
		});

		this.candidateStore.interviewList$.subscribe(() => {
			this.loadInterviews();
		});
	}
	selectInterview(value) {}
	filterBySearch(item: string, type: string) {
		type === 'name'
			? (this.filter.name = item)
			: (this.filter.title = item);
		this.isResetSelect = false;
		this.filterInterviews();
	}
	onEmployeeSelected(empIds: string[]) {
		this.filter.empIds = empIds;
		this.isResetSelect = false;
		this.filterInterviews();
	}
	filterInterviews() {
		//TO FIX
		// 0
		if (!this.filter.name && !this.filter.title && !this.filter.empIds)
			this.interviewList = this.allInterviews;
		// 1
		if (this.filter.name && !this.filter.title && !this.filter.empIds)
			this.interviewList = this.findByName(this.allInterviews);
		if (!this.filter.name && this.filter.title && !this.filter.empIds)
			this.interviewList = this.findByTitle(this.allInterviews);
		if (!this.filter.name && !this.filter.title && this.filter.empIds)
			this.interviewList = this.findByEmployee(this.allInterviews);
		// 2
		if (this.filter.name && this.filter.title && !this.filter.empIds)
			this.interviewList = this.findByTitle(
				this.findByName(this.allInterviews)
			);
		if (!this.filter.name && this.filter.title && this.filter.empIds)
			this.interviewList = this.findByEmployee(
				this.findByTitle(this.allInterviews)
			);
		if (this.filter.name && !this.filter.title && this.filter.empIds)
			this.interviewList = this.findByEmployee(
				this.findByName(this.allInterviews)
			);
		// 3
		if (this.filter.name && this.filter.title && this.filter.empIds)
			this.interviewList = this.findByEmployee(
				this.findByTitle(this.findByName(this.allInterviews))
			);
	}
	findByName(list: ICandidateInterview[]) {
		return list.filter(
			(interview) =>
				interview.candidate.user.name
					.toLocaleLowerCase()
					.indexOf(this.filter.name.toLocaleLowerCase()) !== -1
		);
	}
	findByTitle(list: ICandidateInterview[]) {
		return list.filter(
			(interview) =>
				interview.title
					.toLocaleLowerCase()
					.indexOf(this.filter.title.toLocaleLowerCase()) !== -1
		);
	}
	findByEmployee(list: ICandidateInterview[]) {
		if (!this.filter.empIds[0]) {
			this.interviewList = list;
		} else {
			const result = [];
			list.forEach((interview) => {
				interview.interviewers.forEach((interviewer) => {
					this.filter.empIds.forEach((item: string) => {
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
	clearFilters() {
		this.candidateSearch.reset();
		this.interviewSearch.reset();
		this.isResetSelect = true;
		this.filter.name = '';
		this.filter.title = '';
		this.sort.reset();
		this.filter.empIds = null;
		this.interviewList = this.allInterviews;
	}
	onSortSelected(value: string) {
		switch (value) {
			case 'date':
				this.interviewList.sort(function (a, b) {
					const dateA = new Date(a.startTime),
						dateB = new Date(b.startTime);
					return dateB > dateA ? -1 : dateB < dateA ? 1 : 0;
				});
				break;
			case 'name':
				this.interviewList.sort(function (a, b) {
					const nameA = a.candidate.user.name.toLowerCase(),
						nameB = b.candidate.user.name.toLowerCase();
					return nameB > nameA ? -1 : nameB < nameA ? 1 : 0;
				});
				break;
			case 'rating':
				this.interviewList.sort((a, b) => b.rating - a.rating);
				break;
			default:
				return this.interviewList;
		}
	}
	async loadInterviews() {
		this.loading = true;
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
			this.sourceSmartTable.load(this.interviewList);
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
					renderComponent: InterviewCandidatePictureNameComponent,
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
					renderComponent: InterviewDateTableComponent,
					filter: false
				},
				rating: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.RATING'
					),
					type: 'custom',
					renderComponent: InterviewStarRatingComponent,
					filter: false
				},
				interviewers: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.MANAGE_INTERVIEWS.INTERVIEWERS'
					),
					type: 'custom',
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
				notes: {
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
					type: 'custom',
					renderComponent: InterviewActionsTableComponent,
					filter: false
					// onComponentInitFunction: (instance) => {
					// 	instance.updateResult.subscribe((params) => {
					// 		this.handleEvent(params);
					// 	});
					// },
				}
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
	isPastInterview(interview: ICandidateInterview) {
		const now = new Date().getTime();
		if (new Date(interview.startTime).getTime() > now) {
			return false;
		} else {
			return true;
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
