import { Component, Input, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	Candidate,
	ICandidateInterview,
	ICandidateFeedback,
	ICandidateTechnologies,
	ICandidatePersonalQualities
} from '@gauzy/models';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';

@Component({
	selector: 'ga-candidate-criterions-rating-chart',
	templateUrl: './candidate-criterions-rating-chart.component.html',
	styleUrls: ['./candidate-criterions-rating-chart.component.scss']
})
export class CandidateCriterionsRatingChartComponent implements OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	feedbacks: ICandidateFeedback[];
	@Input() candidates: Candidate[];
	@Input() interviewList: ICandidateInterview[];
	data: any;
	options: any;
	backgroundColor: string[] = [];
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private themeService: NbThemeService,
		private candidateFeedbacksService: CandidateFeedbacksService
	) {}

	async onMembersSelected(id: string) {
		const res = await this.candidateFeedbacksService.getAll(
			['interviewer', 'criterionsRating'],
			{
				candidateId: id
			}
		);
		if (res) {
			const currInterviews = [];
			this.feedbacks = res.items.filter((item) => item.interviewId);
			const criterionsRating = [];
			this.feedbacks.forEach((feedback) => {
				this.interviewList.forEach((interview) => {
					if (
						interview.id === feedback.interviewId &&
						!currInterviews.includes(interview)
					) {
						currInterviews.push(interview);
					}
				});
				feedback.criterionsRating.forEach((criterionEl) => {
					currInterviews.forEach((interview) => {
						interview.personalQualities.forEach(
							(pq: ICandidatePersonalQualities) => {
								if (pq.id === criterionEl.personalQualityId) {
									criterionsRating.push({
										name: pq.name,
										rating: criterionEl.rating
									});
								}
							}
						);
						interview.technologies.forEach(
							(t: ICandidateTechnologies) => {
								if (t.id === criterionEl.technologyId) {
									criterionsRating.push({
										name: t.name,
										rating: criterionEl.rating
									});
								}
							}
						);
					});
				});
			});
			this.labels = [];
			this.rating = [];
			this.rating = this.getCriterionsRating(criterionsRating).map(
				(x) => x.rating
			);
			this.labels = this.getCriterionsRating(criterionsRating).map(
				(x) => x.name
			);
			this.loadChart();
		}
	}
	getCriterionsRating(criterionsRating) {
		return criterionsRating
			.reduce((prev, curr) => {
				const existing = prev.find((data) => data.name === curr.name);
				if (!existing) {
					return [...prev, { ...curr, rating: [curr.rating] }];
				}
				existing.rating.push(curr.rating);
				return [...prev];
			}, [])
			.map((data) => {
				this.loadColor(data.rating);
				const rating = (
					data.rating.reduce((prev, curr) => prev + curr) /
					data.rating.length
				).toFixed(2);
				return { ...data, rating };
			});
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
							label: `Criterion's rating from all feedbacks`,
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
	loadColor(data: string[]) {
		for (let i = 0; i < data.length; i++) {
			const color =
				i % 2 === 0
					? 'rgba(75, 192, 192, 0.2)'
					: 'rgba(153, 102, 255, 0.2)';
			this.backgroundColor.push(color);
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
