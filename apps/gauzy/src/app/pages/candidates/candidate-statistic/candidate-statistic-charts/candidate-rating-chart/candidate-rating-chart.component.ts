import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Candidate } from '@gauzy/models';

@Component({
	selector: 'ga-candidate-rating-chart',
	template: `
		<h6>
			{{ 'CANDIDATES_PAGE.STATISTIC.CANDIDATE_RATING' | translate }}
		</h6>
		<chart
			style="height: 400px; width: 100%;"
			type="bar"
			[data]="data"
			[options]="options"
		></chart>
	`
})
export class CandidateRatingChartComponent implements OnInit, OnDestroy {
	labels: string[] = [];
	rating: number[] = [];
	@Input() candidates: Candidate[];
	data: any;
	options: any;
	backgroundColor: string[] = [];
	private _ngDestroy$ = new Subject<void>();

	constructor(private themeService: NbThemeService) {}

	ngOnInit() {
		this.loadData();
		this.loadChart();
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
							label: 'Candidate rating',
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

	async loadData() {
		for (let i = 0; i < this.candidates.length; i++) {
			this.labels.push(this.candidates[i].user.name);
			this.rating.push(this.candidates[i].rating);

			const color =
				i % 2 === 0
					? 'rgba(89, 139, 255, 0.2)'
					: 'rgba(0, 214, 143, 0.2)';
			this.backgroundColor.push(color);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
