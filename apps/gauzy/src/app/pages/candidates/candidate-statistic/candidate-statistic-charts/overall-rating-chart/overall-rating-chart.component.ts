import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Candidate } from '@gauzy/models';

@Component({
	selector: 'ga-overall-rating-chart',
	template: `
		<chart
			style="height: 400px; width: 100%;"
			type="bar"
			[data]="data"
			[options]="options"
			*ngIf="rating?.length > 0 && candidates.length > 0"
		></chart>
		<div
			*ngIf="candidates.length === 0 || rating?.length === 0"
			style="display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			border: 1px #e5e5e5 solid;
			height: 150px;"
		>
			<nb-icon icon="info-outline" style="color: #909cb4;"></nb-icon>
			<span style="color: #909cb4;">{{
				'CANDIDATES_PAGE.STATISTIC.NO_DATA' | translate
			}}</span>
		</div>
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

	async loadData() {
		for (let i = 0; i < this.candidates.length; i++) {
			this.labels.push(this.candidates[i].user.name);
			this.rating.push(parseFloat(this.candidates[i].rating.toFixed(2)));

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
