import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { ICandidateInterview, Candidate } from '@gauzy/models';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { takeUntil, first } from 'rxjs/operators';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
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
	allInterviews: ICandidateInterview[];
	interviewTitle: ICandidateInterview[];
	search: FormControl = new FormControl();
	constructor(
		readonly translateService: TranslateService,
		private candidateInterviewService: CandidateInterviewService,
		private candidatesService: CandidatesService,
		private employeesService: EmployeesService,
		private router: Router
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.loadInterviews();
		this.search.valueChanges.subscribe((item) => {
			this.interviewTitle = [];
			this.interviewList.forEach((el) => {
				if (
					item !== '' &&
					el.title.toLocaleLowerCase().includes(item)
				) {
					this.interviewTitle.push(el);
				}
			});
			console.log(this.interviewTitle);
		});
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
			this.candidatesService
				.getAll(['user'])
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((candidates) => {
					this.candidates = candidates.items;
					this.interviewList.forEach((interview) => {
						this.loadEmployee(interview);
						this.candidates.forEach((item) => {
							if (item.id === interview.candidateId) {
								interview.candidate = item;
							}
						});

						if (interview.feedbacks.length > 0) {
							const res: number[] = [];
							interview.feedbacks.forEach((fb) => {
								res.push(Number(fb.rating));
							});
							const fbSum = res.reduce((sum, current) => {
								return sum + current;
							});
							interview.rating =
								fbSum / interview.feedbacks.length;
						} else {
							interview.rating = 0;
						}
					});
				});
		}
	}
	async loadEmployee(interview: ICandidateInterview) {
		const employees = [];
		const { items } = await this.employeesService
			.getAll(['user'])
			.pipe(first())
			.toPromise();
		const employeeList = items;
		interview.interviewers.forEach((interviewer) => {
			employeeList.forEach((employee) => {
				if (interviewer.employeeId === employee.id) {
					employees.push(employee);
				}
			});
		});
		interview.employees = employees;
	}

	goToCandidate(id: string) {
		this.router.navigate([
			`/pages/employees/candidates/edit/${id}/profile/interview`
		]);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
