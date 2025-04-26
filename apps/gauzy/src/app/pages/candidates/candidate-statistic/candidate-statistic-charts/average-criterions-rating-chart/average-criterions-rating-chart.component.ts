import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ICandidate,
	ICandidateInterview,
	ICandidateFeedback,
	ICandidateTechnologies,
	ICandidatePersonalQualities
} from '@gauzy/contracts';
import { CandidateFeedbacksService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-average-criterions-rating-chart',
    templateUrl: './average-criterions-rating-chart.component.html',
    styleUrls: ['./average-criterions-rating-chart.component.scss'],
    standalone: false
})
export class AverageCriterionsRatingChartComponent implements OnInit, OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	feedbacks: ICandidateFeedback[];
	data: any;
	options: any;
	backgroundColor: string[] = [];

	@Input() candidates: ICandidate[];
	@Input() interviews: ICandidateInterview[];

	constructor(
		private readonly themeService: NbThemeService,
		private readonly candidateFeedbacksService: CandidateFeedbacksService
	) {}

	ngOnInit(): void {
		this.themeService
			.getJsTheme()
			.pipe(
				tap(() => this.initializeChartOptions()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 * @param id
	 */
	async onMembersSelected(candidateId: string) {
		const res = await this.candidateFeedbacksService.getAll(['interviewer', 'criterionsRating'], { candidateId });
		if (res) {
			const currInterviews = [];
			this.feedbacks = res.items.filter((item) => item.interviewId);
			const criterionsRating = [];
			this.feedbacks.forEach((feedback) => {
				this.interviews.forEach((interview) => {
					if (interview.id === feedback.interviewId && !currInterviews.includes(interview)) {
						currInterviews.push(interview);
					}
				});
				feedback.criterionsRating.forEach((criterionEl) => {
					currInterviews.forEach((interview) => {
						interview.personalQualities.forEach((pq: ICandidatePersonalQualities) => {
							if (pq.id === criterionEl.personalQualityId) {
								criterionsRating.push({
									name: pq.name,
									rating: criterionEl.rating
								});
							}
						});
						interview.technologies.forEach((t: ICandidateTechnologies) => {
							if (t.id === criterionEl.technologyId) {
								criterionsRating.push({
									name: t.name,
									rating: criterionEl.rating
								});
							}
						});
					});
				});
			});
			this.labels = [];
			this.rating = [];
			this.rating = this.getCriterionsRating(criterionsRating).map((x) => x.rating);
			this.labels = this.getCriterionsRating(criterionsRating).map((x) => x.name);
			this.initializeChartOptions();
		}
	}

	/**
	 *
	 * @param criterionsRating
	 * @returns
	 */
	getCriterionsRating(criterionsRating: any[]) {
		return criterionsRating
			.reduce((prev: any[], curr: any) => {
				const existing = prev.find((data) => data.name === curr.name);
				if (!existing) {
					return [...prev, { ...curr, rating: [curr.rating] }];
				}
				existing.rating.push(curr.rating);
				return [...prev];
			}, [])
			.map((data: any) => {
				this.initializeChartBackgroundColor(data.rating);
				const rating = (
					data.rating.reduce((prev: any[], curr: any) => prev + curr) / data.rating.length
				).toFixed(2);
				return { ...data, rating };
			});
	}

	/**
	 * Initializes chart data and options.
	 */
	private initializeChartOptions() {
		this.data = {
			labels: this.labels,
			datasets: [
				{
					maxBarThickness: 150,
					label: `Average criterion's rating`,
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
	}

	/**
	 * Initializes the chart data based on candidates' ratings and names.
	 */
	private initializeChartBackgroundColor(data: string[]): void {
		data.forEach((item: string, index: number) => {
			// Determine background color based on index
			const backgroundColor = index % 2 === 0 ? 'rgba(75, 192, 192, 0.2)' : 'rgba(153, 102, 255, 0.2)';
			this.backgroundColor.push(backgroundColor);
		});
	}

	ngOnDestroy() {}
}
