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
				});
			});
			this.currRating = [];
			this.currRating.push(
				...this.getCriterionsRating(criterionsRating, 'tech')
			);
			this.currRating.push(
				...this.getCriterionsRating(criterionsRating, 'qual')
			);
			this.currLabels = this.getCriterionsName(currInterviews);
			this.labels = [];
			this.rating = [];
			this.currLabels[1].forEach((labelId, index) => {
				this.loadColor(this.currLabels[0]);
				this.currRating.forEach((itemRating) => {
					if (
						itemRating.technologyId === labelId ||
						itemRating.personalQualityId === labelId
					) {
						this.rating.push(itemRating.rating);
						this.labels.push(this.currLabels[0][index]);
					}
				});
			});
			this.loadChart();
		}
	}
	getCriterionsRating(arrData, criterion: string) {
		const arr = [...arrData];
		let value: string;
		criterion === 'tech'
			? (value = 'technologyId')
			: (value = 'personalQualityId');

		arr.sort((a, b) => b[value] - a[value]);
		const arrId = arr.filter((x) => x[value] !== null);
		const arrResult = [];
		let count = 2;
		//TO DO
		arrId.reduce((a, b) => {
			if (a[value] === b[value]) {
				b.rating += a.rating;
				a[value] = null;
				b.count = count++;
			} else {
				b.count = 1;
				count = 2;
			}
			return b;
		}, 0);

		arrId.forEach((x) =>
			x[value]
				? criterion === 'tech'
					? arrResult.push({
							technologyId: x[value],
							rating: x.rating / x.count,
							personalQualityId: null
					  })
					: arrResult.push({
							personalQualityId: x[value],
							rating: x.rating / x.count,
							technologyId: null
					  })
				: null
		);
		return arrResult;
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
	loadColor(labels: string[]) {
		for (let i = 0; i < labels.length; i++) {
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
