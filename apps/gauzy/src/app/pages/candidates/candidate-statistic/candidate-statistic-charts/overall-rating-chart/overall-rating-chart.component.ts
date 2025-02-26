import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ICandidate } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-overall-rating-chart',
    template: `
		<ng-container *ngIf="rating?.length > 0 && candidates?.length > 0; else noDataTemplate">
			<canvas
				style="height: 400px; width: 100%;"
				[type]="'bar'"
				baseChart
				[data]="data"
				[options]="options"
			></canvas>
		</ng-container>
		<ng-template #noDataTemplate>
			<div class="no-data">
				<nb-icon icon="info-outline" class="info-icon"></nb-icon>
				<span>{{ 'CANDIDATES_PAGE.STATISTIC.NO_DATA' | translate }}</span>
			</div>
		</ng-template>
	`,
    standalone: false
})
export class CandidateRatingChartComponent implements OnInit, OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	data: any;
	options: any;
	backgroundColor: string[] = [];

	@Input() candidates: ICandidate[] = [];

	constructor(private readonly themeService: NbThemeService) {}

	ngOnInit() {
		this.initializeChart();

		this.themeService
			.getJsTheme()
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				// Set chart data with labels, ratings, and background colors
				this.data = {
					labels: this.labels,
					datasets: [
						{
							maxBarThickness: 150,
							label: 'Overall rating',
							data: this.rating,
							backgroundColor: this.backgroundColor
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

	/**
	 * Initializes the chart data based on candidates' ratings and names.
	 */
	private initializeChart(): void {
		const colors = ['rgba(89, 139, 255, 0.2)', 'rgba(0, 214, 143, 0.2)'];

		this.candidates.forEach((candidate: ICandidate, index: number) => {
			// Determine background color based on index
			const backgroundColor = colors[index % 2];
			this.backgroundColor.push(backgroundColor);

			// Push candidate's name to labels array
			const candidateName = candidate.user?.name || 'Unknown';
			this.labels.push(candidateName);

			// Push candidate's ratings, formatted to 2 decimal places, to ratings array if available
			if (candidate.ratings) {
				const formattedRating = parseFloat(candidate.ratings.toFixed(2));
				this.rating.push(formattedRating);
			}
		});
	}

	ngOnDestroy() {}
}
