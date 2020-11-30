import { Component, Input, OnInit, ViewChild } from '@angular/core';
import {
	ChartData,
	IMonthAggregatedEmployeeStatistics,
	ITimeLogFilters
} from '@gauzy/models';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ChartComponent } from 'angular2-chartjs';

@UntilDestroy()
@Component({
	selector: 'ngx-expanses-report-horizontal-chart',
	templateUrl: './expanses-report-horizontal-chart.component.html',
	styleUrls: ['./expanses-report-horizontal-chart.component.scss']
})
export class ExpansesReportHorizontalChartComponent implements OnInit {
	options: any;
	incomeStatistics: number[] = [];
	expenseStatistics: number[] = [];
	labels: string[] = [];
	selectedDate: Date;
	noData = false;

	logRequest: ITimeLogFilters = {};

	@ViewChild('chart') chart: ChartComponent;

	private _data: ChartData;

	@Input()
	public get data(): ChartData {
		return this._data;
	}
	public set data(value: ChartData) {
		this._data = value;
		if (this.chart && this.chart.chart) {
			this.chart.chart.update();
		}
	}

	@Input()
	employeeStatistics: IMonthAggregatedEmployeeStatistics[];
	weekDayList: string[];

	constructor(private themeService: NbThemeService) {}

	ngOnInit() {
		this.themeService
			.getJsTheme()
			.pipe(untilDestroyed(this))
			.subscribe((config) => {
				const chartJs: any = config.variables.chartjs;

				this.options = {
					responsive: true,
					maintainAspectRatio: false,
					color: [
						config.variables.primary,
						config.variables.primaryLight
					],
					backgroundColor: [
						config.variables.primary,
						config.variables.primaryLight
					],
					elements: {
						rectangle: {
							borderWidth: 2
						}
					},
					scales: {
						xAxes: [
							{
								gridLines: {
									display: true,
									color: chartJs.axisLineColor
								},
								ticks: {
									fontColor: chartJs.textColor
								}
							}
						],
						yAxes: [
							{
								gridLines: {
									display: false,
									color: chartJs.axisLineColor
								},
								ticks: {
									fontColor: chartJs.textColor
								}
							}
						]
					},
					legend: {
						position: 'bottom',
						labels: {
							fontColor: chartJs.textColor
						}
					},
					tooltips: this.selectedDate
						? {
								enabled: true,
								mode: 'dataset',
								callbacks: {
									label: function (tooltipItem, data) {
										const label =
											data.datasets[
												tooltipItem.datasetIndex
											].label || '';
										return label;
									}
								}
						  }
						: {
								enabled: true
						  }
				};
				if (this.chart && this.chart.chart) {
					this.chart.chart.update();
				}
			});
	}

	ngOnDestroy() {}
}
