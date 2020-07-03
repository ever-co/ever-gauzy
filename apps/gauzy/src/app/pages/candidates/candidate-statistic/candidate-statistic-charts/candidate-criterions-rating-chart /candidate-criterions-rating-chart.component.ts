import { Component, Input, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	Candidate,
	ICandidateInterview,
	ICandidateFeedback
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
	currLabels = [];
	currRating = [];
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
			const uniqCriterionsRating = [];
			this.feedbacks.forEach((feedback) => {
				this.interviewList.forEach((interview) => {
					if (interview.id === feedback.interviewId) {
						if (!currInterviews.includes(interview)) {
							currInterviews.push(interview);
						}
					}
				});
				feedback.criterionsRating.forEach((techEl) => {
					criterionsRating.push(techEl);
					if (
						techEl.technologyId &&
						!uniqCriterionsRating.includes(techEl.technologyId)
					) {
						uniqCriterionsRating.push(techEl.technologyId);
					}
					if (
						techEl.personalQualityId &&
						!uniqCriterionsRating.includes(techEl.personalQualityId)
					) {
						uniqCriterionsRating.push(techEl.personalQualityId);
					}
				});
			});
			this.getCriterionsRating(criterionsRating, uniqCriterionsRating);
			this.currLabels = this.getCriterionsName(currInterviews);
			this.loadChart();
		}
	}
	getCriterionsRating(data, uniqArr) {
		//TO DO
		uniqArr.forEach((uniq) => {
			let filteredTech = [];
			let filteredQual = [];
			filteredTech = data.filter(
				(x) => x.technologyId && x.technologyId === uniq
			);
			filteredQual = data.filter(
				(x) => x.personalQualityId && x.personalQualityId === uniq
			);
		});
	}
	getCriterionsName(currInterviews: ICandidateInterview[]) {
		const resName = [];
		const resId = [];
		currInterviews.forEach((item) => {
			item.technologies.forEach((tech) => {
				if (!resName.includes(tech.name)) {
					resName.push(tech.name);
					resId.push(tech.id);
				}
			});
			item.personalQualities.forEach((qual) => {
				if (!resName.includes(qual.name)) {
					resName.push(qual.name);
					resId.push(qual.id);
				}
			});
		});
		return [resName, resId];
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
							label: 'Criterion ratings from interviewer(s)',
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
	loadColor(feedback: ICandidateFeedback) {
		for (let i = 0; i < feedback.criterionsRating.length; i++) {
			const color =
				i % 2 === 0
					? 'rgba(255, 206, 86, 0.2)'
					: 'rgba(255, 99, 132, 0.2)';
			this.backgroundColor.push(color);
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
