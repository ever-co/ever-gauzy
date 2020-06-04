import { Component, Input, OnDestroy, OnInit, OnChanges } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Candidate } from '@gauzy/models';

@Component({
	selector: 'ga-candidate-rating-chart',
	template: `
		<chart
			style="height: 500px; width: 500px;"
			type="bar"
			[data]="data"
			[options]="options"
		></chart>
	`
})
export class CandidateRatingChartComponent
	implements OnInit, OnDestroy, OnChanges {
	labels: string[];
	rating: number[];
	@Input() candidates: Candidate[];
	data: any;
	options: any;
	data1 = 20;
	data2 = 30;
	private _ngDestroy$ = new Subject<void>();

	constructor(private themeService: NbThemeService) {}

	ngOnInit() {
		this._LoadChart();
	}

	ngOnChanges() {
		this._LoadChart();
	}

	private _LoadChart() {
		this.themeService
			.getJsTheme()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((config) => {
				(this.data = {
					// labels: this.labels,
					labels: [
						'Red',
						'Blue',
						'Yellow',
						'Green',
						'Purple',
						'Orange'
					],
					datasets: [
						{
							label: '# of Votes',
							// data: this.rating,
							data: [12, 19, 3, 5, 2, 3],
							backgroundColor: [
								'rgba(255, 99, 132, 0.2)',
								'rgba(54, 162, 235, 0.2)',
								'rgba(255, 206, 86, 0.2)',
								'rgba(75, 192, 192, 0.2)',
								'rgba(153, 102, 255, 0.2)',
								'rgba(255, 159, 64, 0.2)'
							],
							borderColor: [
								'rgba(255, 99, 132, 1)',
								'rgba(54, 162, 235, 1)',
								'rgba(255, 206, 86, 1)',
								'rgba(75, 192, 192, 1)',
								'rgba(153, 102, 255, 1)',
								'rgba(255, 159, 64, 1)'
							],
							borderWidth: 1
						}
					]
				}),
					(this.options = {
						// responsive: true,
						maintainAspectRatio: false,
						// elements: {
						// 	rectangle: {
						// 		borderWidth: 2
						// 	}
						// },
						scales: {
							yAxes: [
								{
									ticks: {
										beginAtZero: true
									}
								}
							]
						},
						legend: {
							position: 'right'
						}
					});
			});
		// console.log(this.data.datasets.data);
	}

	// async _loadData() {}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
