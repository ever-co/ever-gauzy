import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Candidate, ICandidateInterview } from '@gauzy/models';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';

@Component({
	selector: 'ga-interviewer-assessment-chart',
	template: `
		<h6>
			{{ 'CANDIDATES_PAGE.STATISTIC.INTERVIEWER_ASSESSMENT' | translate }}
		</h6>
		<nb-select
			placeholder="Select an interview"
			style=" width: 100%; margin: 2rem 0;"
			(selectedChange)="onInterviewSelected($event)"
		>
			<nb-option-group
				*ngFor="let candidate of candidates"
				title="{{ candidate.user.name }}"
			>
				<nb-option
					*ngFor="let interview of candidate.interview"
					[value]="interview"
				>
					{{ interview.title }}
				</nb-option>
			</nb-option-group>
		</nb-select>

		<chart
			style="height: 400px; width: 100%;"
			type="bar"
			[data]="data"
			[options]="options"
		></chart>
	`
})
export class InterviewerAssessmentChartComponent implements OnInit, OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	interviews = [];
	@Input() candidates: Candidate[];
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
		console.log(interview);
		this.currentInterview = interview;
		const res = await this.candidateFeedbacksService.getAll(
			['interviewer'],
			{
				candidateId: interview.candidateId
			}
		);
		if (res) {
			console.log(res);
			const feedbacks = res.items.filter((item) => item.interviewId);
			for (let item of feedbacks) {
				console.log(item);
			}
			console.log('feedbacks', feedbacks);
		}
	}
	private loadChart() {
		this.themeService
			.getJsTheme()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				(this.data = {
					labels: ['111', '22', '333'],
					datasets: [
						{
							label: 'Interview 1',
							backgroundColor: this.backgroundColor,
							data: [3, 4, 8]
						}
					]
				}),
					(this.options = {
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
					});
			});
	}

	async loadData() {
		for (let i = 0; i < this.candidates.length; i++) {
			const interviews = await this.candidateInterviewService.findByCandidateId(
				this.candidates[i].id
			);
			this.candidates[i].interview = interviews ? interviews : null;

			const color =
				i % 2 === 0
					? 'rgba(153, 102, 255, 0.2)'
					: 'rgba(75, 192, 192, 0.2)';
			this.backgroundColor.push(color);
		}
		// console.log('111', this.candidates);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
// 'rgba(255, 99, 132, 0.2)',
// 	'rgba(54, 162, 235, 0.2)',
// 		'rgba(255, 206, 86, 0.2)',
// 		'rgba(75, 192, 192, 0.2)',
// 		'rgba(153, 102, 255, 0.2)',
// 		'rgba(255, 159, 64, 0.2)'
