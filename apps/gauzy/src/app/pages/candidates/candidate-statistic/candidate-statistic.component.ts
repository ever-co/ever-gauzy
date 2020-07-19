import { Candidate, ICandidateInterview, Employee } from '@gauzy/models';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { CandidateFeedbacksService } from '../../../@core/services/candidate-feedbacks.service';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { EmployeesService } from '../../../@core/services';

@Component({
	selector: 'ga-candidate-statistic',
	templateUrl: './candidate-statistic.component.html'
})
export class CandidateStatisticComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	candidateRating: number;
	candidates: Candidate[] = null;
	names: string[] = [];
	rating: number[] = [];
	interviewList: ICandidateInterview[];
	employeeList: Employee[];
	constructor(
		private candidatesService: CandidatesService,
		private candidateFeedbacksService: CandidateFeedbacksService,
		private candidateInterviewService: CandidateInterviewService,
		private employeesService: EmployeesService
	) {}

	ngOnInit() {
		this.loadData();
		this.loadEmployee();
	}

	async loadData() {
		const { items } = await this.candidatesService
			.getAll(['user', 'interview', 'feedbacks'])
			.pipe(first())
			.toPromise();
		const interviews = await this.candidateInterviewService.getAll([
			'feedbacks',
			'interviewers',
			'technologies',
			'personalQualities'
		]);
		if (items && interviews) {
			this.interviewList = interviews.items;
			for (const candidate of items) {
				const feedbacks = await this.candidateFeedbacksService.getAll(
					['interviewer'],
					{
						candidateId: candidate.id
					}
				);
				if (feedbacks) {
					this.candidateRating = 0;
					for (let i = 0; i < feedbacks.total; i++) {
						candidate.rating +=
							+feedbacks.items[i].rating / feedbacks.total;
					}
				}
			}
			this.candidates = items;
		}
	}
	async loadEmployee() {
		const { items } = await this.employeesService
			.getAll(['user'])
			.pipe(first())
			.toPromise();
		this.employeeList = items;
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
