import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Candidate, ICandidateInterview, Employee } from '@gauzy/models';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';

@Component({
	selector: 'ga-criterions-rating-chart',
	templateUrl: './criterions-rating-chart.component.html',
	styleUrls: ['./criterions-rating-chart.component.scss']
})
export class CriterionsRatingChartComponent implements OnInit, OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	interviews = [];
	employees = [];
	employeeIds: string[];
	selectedEmployeeIds = null;
	currentEmployee: Employee[] = [];
	disabledIds = [];
	@Input() candidates: Candidate[];
	@Input() interviewList: ICandidateInterview[];
	data: any;
	options: any;
	currentInterview: ICandidateInterview;
	backgroundColor: string[] = [];
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private themeService: NbThemeService,
		private candidateFeedbacksService: CandidateFeedbacksService,
		private candidateInterviewService: CandidateInterviewService,
		private employeesService: EmployeesService
	) {}

	ngOnInit() {
		if (this.candidates) {
			this.loadData();
			this.loadChart();
		}
	}
	onMembersSelected(event: string[]) {
		this.selectedEmployeeIds = event;
	}

	async onInterviewSelected(interview: ICandidateInterview) {
		this.rating = [];
		this.labels = [];
		this.currentEmployee = [];
		this.interviewList.forEach((interviewItem) =>
			interviewItem.id === interview.id
				? (this.currentInterview = interviewItem)
				: null
		);

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
			for (const feedback of feedbacks) {
				allFbIds.push(feedback.interviewer.employeeId);
				this.rating.push(feedback.rating);
				const employee = await this.employeesService.getEmployeeById(
					feedback.interviewer.employeeId,
					['user']
				);
				if (employee) {
					this.labels.push(employee.user.name);
				}
			}
			for (const interviewer of this.currentInterview.interviewers) {
				allIds.push(interviewer.employeeId);
				const result = await this.employeesService.getEmployeeById(
					interviewer.employeeId,
					['user']
				);
				if (result) {
					interviewer.employeeName = result.user.name;
					interviewer.employeeImageUrl = result.user.imageUrl;
					this.currentEmployee.push(result);
				}
			}
			this.disabledIds = allIds.filter((x) => !allFbIds.includes(x));
			this.loadChart();
		}
	}
	private loadChart() {
		//TO DO
		this.themeService
			.getJsTheme()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.data = {
					labels: this.labels,
					datasets: [
						{
							maxBarThickness: 150,
							label: 'Assessments from interviewers',
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
			const interviews = await this.candidateInterviewService.findByCandidateId(
				this.candidates[i].id
			);
			this.candidates[i].interview = interviews ? interviews : null;

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
