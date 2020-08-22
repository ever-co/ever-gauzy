import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Candidate, ICandidateInterview, Employee } from '@gauzy/models';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';

@Component({
	selector: 'ga-interview-rating-chart',
	templateUrl: './interview-rating-chart.component.html',
	styleUrls: ['./interview-rating-chart.component.scss']
})
export class InterviewRatingChartComponent implements OnInit, OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	interviews = [];
	@Input() candidates: Candidate[];
	@Input() interviewList: Candidate[];
	@Input() employeeList: Employee[];
	data: any;
	options: any;
	currentInterview: ICandidateInterview;
	backgroundColor: string[] = [];
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private themeService: NbThemeService,
		private candidateFeedbacksService: CandidateFeedbacksService,
		private candidateInterviewService: CandidateInterviewService
	) {}

	ngOnInit() {
		this.loadData();
		this.loadChart();
	}
	async onInterviewSelected(interview: ICandidateInterview) {
		this.currentInterview = interview;
		this.rating = [];
		this.labels = [];
		const res = await this.candidateFeedbacksService.getAll(
			['interviewer'],
			{
				candidateId: interview.candidateId
			}
		);
		if (res) {
			const feedbacks = res.items.filter(
				(item) => item.interviewId && item.interviewId === interview.id
			);
			for (const item of feedbacks) {
				this.rating.push(parseFloat((+item.rating).toFixed(2)));
				this.employeeList.forEach((employee) => {
					if (item.interviewer.employeeId === employee.id) {
						this.labels.push(employee.user.name);
					}
				});
			}
			this.loadChart();
		}
	}
	private loadChart() {
		this.themeService
			.getJsTheme()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.data = {
					labels: this.labels,
					datasets: [
						{
							maxBarThickness: 150,
							label: 'Rating per interview',
							backgroundColor: this.backgroundColor,
							data: this.rating
						}
					]
				};

				this.options = {
					responsive: true,
					maintainAspectRatio: false,
					elements: {
						rectangle: {
							borderWidth: 2
						}
					},
					scales: {
						yAxes: [
							{
								ticks: {
									beginAtZero: true
								}
							}
						]
					}
				};
			});
	}

	async loadData() {
		for (let i = 0; i < this.candidates.length; i++) {
			const interview = await this.candidateInterviewService.findByCandidateId(
				this.candidates[i].id
			);
			this.candidates[i].interview = interview ? interview : null;
			const color =
				i % 2 === 0
					? 'rgba(153, 102, 255, 0.2)'
					: 'rgba(255, 159, 64, 0.2)';
			this.backgroundColor.push(color);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
