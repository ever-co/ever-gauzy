import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { ICandidateInterview, Candidate } from '@gauzy/models';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { takeUntil } from 'rxjs/operators';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { Router } from '@angular/router';
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
			this.candidatesService
				.getAll(['user'])
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((candidates) => {
					this.candidates = candidates.items;
					this.interviewList.forEach((interview) => {
						this.candidates.forEach((item) => {
							if (item.id === interview.candidateId) {
								interview.candidate = item;
							}
						});
						this.loadEmployee(this.interviewList);

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
						}
					});
				});
		}
	}
	async loadEmployee(list: ICandidateInterview[]) {
		for (const interview of list) {
			const employees = [];
			for (const interviewer of interview.interviewers) {
				const res = await this.employeesService.getEmployeeById(
					interviewer.employeeId,
					['user']
				);
				if (res) {
					employees.push(res);
				}
			}
			interview.employees = employees;
		}
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
