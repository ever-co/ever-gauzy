import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ICandidate, ICandidateInterview, IEmployee } from '@gauzy/contracts';
import { CandidateFeedbacksService } from '@gauzy/ui-core/core';
import { tap } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-interview-rating-chart',
    templateUrl: './interview-rating-chart.component.html',
    styleUrls: ['./interview-rating-chart.component.scss'],
    standalone: false
})
export class InterviewRatingChartComponent implements OnInit, OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	interviews = [];
	data: any;
	options: any;
	backgroundColor: string[] = [];
	@Input() candidates: ICandidate[] = [];
	@Input() employees: IEmployee[] = [];

	constructor(
		private readonly themeService: NbThemeService,
		private readonly candidateFeedbacksService: CandidateFeedbacksService
	) {}

	ngOnInit() {
		this.initializeChartBackgroundColor();
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
	 * @param interview
	 */
	async onInterviewSelected(interview: ICandidateInterview) {
		this.rating = [];
		this.labels = [];

		const { items = [] } = await this.candidateFeedbacksService.getAll(['interviewer', 'interviewer.employee'], {
			candidateId: interview.candidateId
		});
		if (items) {
			const feedbacks = items.filter((item) => item.interviewId && item.interviewId === interview.id);
			for (const item of feedbacks) {
				this.rating.push(parseFloat((+item.rating).toFixed(2)));
				this.employees.forEach((employee) => {
					if (item.interviewer?.employeeId) {
						if (item.interviewer?.employeeId === employee.id) {
							this.labels.push(employee.user.name);
						}
					}
				});
			}
			this.initializeChartOptions();
		}
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
	}

	/**
	 * Initializes the chart data based on candidates' ratings and names.
	 */
	private initializeChartBackgroundColor(): void {
		const colors = ['rgba(153, 102, 255, 0.2)', 'rgba(255, 159, 64, 0.2)'];

		this.candidates.forEach((candidate: ICandidate, index: number) => {
			// Determine background color based on index
			const backgroundColor = colors[index % 2];
			this.backgroundColor.push(backgroundColor);
		});
	}

	ngOnDestroy() {}
}
