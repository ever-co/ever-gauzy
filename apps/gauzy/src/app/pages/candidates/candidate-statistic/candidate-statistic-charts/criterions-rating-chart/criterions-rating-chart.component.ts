import { Component, Input, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	Candidate,
	ICandidateInterview,
	Employee,
	ICandidateFeedback
} from '@gauzy/models';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';

@Component({
	selector: 'ga-criterions-rating-chart',
	templateUrl: './criterions-rating-chart.component.html',
	styleUrls: ['./criterions-rating-chart.component.scss']
})
export class CriterionsRatingChartComponent implements OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	interviews = [];
	currentEmployee: Employee[] = [];
	disabledIds = [];
	feedbacks: ICandidateFeedback[];
	@Input() candidates: Candidate[];
	@Input() interviewList: ICandidateInterview[];
	@Input() employeeList: Employee[];
	data: any;
	options: any;
	currentInterview: ICandidateInterview;
	backgroundColor: string[] = [];
	isResetSelect: boolean;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private themeService: NbThemeService,
		private candidateFeedbacksService: CandidateFeedbacksService
	) {}

	async onMembersSelected(id: string) {
		this.isResetSelect = false;
		const ratings = [];
		const res = await this.candidateFeedbacksService.getAll(
			['interviewer', 'criterionsRating'],
			{
				candidateId: this.currentInterview.candidateId
			}
		);

		if (res) {
			this.feedbacks = res.items.filter(
				(item) =>
					item.interviewId &&
					item.interviewId === this.currentInterview.id
			);
			this.feedbacks.forEach((feedback) => {
				if (id === 'all') {
					const rating = [];
					this.labels = [];
					this.getRating(feedback, rating);
					ratings.push(rating);
				}
				if (feedback.interviewer.employeeId === id) {
					this.getRating(feedback);
				}
			});
			if (id === 'all') {
				this.rating = this.calcAllRating(ratings);
			}
			this.loadChart();
		}
	}

	getRating(feedback: ICandidateFeedback, rating?: number[]) {
		this.rating = [];
		this.labels = [];
		feedback.criterionsRating.forEach((crItem) => {
			this.currentInterview.technologies.forEach((techItem) => {
				if (techItem.id === crItem.technologyId) {
					techItem.rating = crItem.rating;
					rating
						? rating.push(techItem.rating)
						: this.rating.push(techItem.rating);
					this.labels.push(techItem.name);
				}
			});
			this.currentInterview.personalQualities.forEach((qualItem) => {
				if (qualItem.id === crItem.personalQualityId) {
					qualItem.rating = crItem.rating;
					rating
						? rating.push(qualItem.rating)
						: this.rating.push(qualItem.rating);
					this.labels.push(qualItem.name);
				}
			});
		});
	}

	calcAllRating(ratings) {
		const sumArr = [];
		ratings.forEach((x: number[]) => (sumArr.length = x.length));
		sumArr.fill(0);
		ratings.forEach((x: number[]) =>
			x.forEach((item, index) => (sumArr[index] += item))
		);
		const result = [];
		sumArr.forEach((x) => result.push((x / ratings.length).toFixed(2)));
		return result;
	}

	async onInterviewSelected(interview: ICandidateInterview) {
		this.rating = [];
		this.labels = [];
		this.interviewList.forEach((interviewItem) =>
			interviewItem.id === interview.id
				? (this.currentInterview = interviewItem)
				: null
		);
		this.isResetSelect = true;
		this.currentEmployee = [];
		const allIds = [];
		const allFbIds = [];
		const res = await this.candidateFeedbacksService.getAll(
			['interviewer', 'criterionsRating'],
			{
				candidateId: interview.candidateId
			}
		);
		if (res) {
			const feedbacks = res.items.filter(
				(item) => item.interviewId && item.interviewId === interview.id
			);
			feedbacks.forEach((feedback) => {
				allFbIds.push(feedback.interviewer.employeeId);
				this.loadColor(feedback);
			});
			for (const interviewer of this.currentInterview.interviewers) {
				allIds.push(interviewer.employeeId);
				if (this.employeeList) {
					this.employeeList.forEach((item) => {
						if (interviewer.employeeId === item.id) {
							interviewer.employeeName = item.user.name;
							interviewer.employeeImageUrl = item.user.imageUrl;
							this.currentEmployee.push(item);
						}
					});
				}
			}
			this.disabledIds = allIds.filter((x) => !allFbIds.includes(x));
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
