import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IMonthAggregatedEmployeeStatistics,
	ITimeLogFilters
} from '@gauzy/contracts';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ChartComponent, ChartModule } from 'angular2-chartjs';
import { ChartUtil } from "./chart-utils";
import { Chart, LineController } from "chart.js";

export interface IChartData {
	labels?: any[];
	datasets: {
		label?: string;
		backgroundColor?: string;
		borderColor?: string;
		borderWidth?: number;
		pointRadius?: number;
		pointHoverRadius?: number;
		pointBorderWidth?: number;
		pointHoverBorderWidth?: number;
		pointBorderColor?: string;
		data?: any[];
	}[];
}

@UntilDestroy()
@Component({
	selector: 'ngx-line-chart',
	templateUrl: './line-chart.component.html',
	styleUrls: ['./line-chart.component.scss']
})
export class LineChartComponent implements OnInit, OnDestroy {
	options: any;
	incomeStatistics: number[] = [];
	expenseStatistics: number[] = [];
	labels: string[] = [];
	selectedDate: Date;
	noData = false;
	chartUpdated = false;


	logRequest: ITimeLogFilters = {};

	@ViewChild('chart') chart: ChartComponent;

	private _data: IChartData;

	@Input()
	public get data(): IChartData {
		return this._data;
	}
	public set data(value: IChartData) {
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
						align: 'start',
						labels: {
							fontColor: chartJs.textColor,
						}
					},
					hover: {
						mode: 'point',
						intersect: false,
					},
					onHover: (evt, activeElements) => {
						if (!activeElements || !activeElements.length) {
							this.data.datasets.forEach(x => {
								x.borderWidth = 1
								x.pointRadius = 2
								x.pointBorderWidth = 1
								x.pointBorderColor = x.borderColor
								x.backgroundColor = ChartUtil.transparentize(x.backgroundColor, 1)
								evt.target.style.cursor = 'default'
							})
							if (!this.chartUpdated) {
								this.chart.chart.update()
								this.chartUpdated = true
							}
						} else {
							this.chartUpdated = false
							evt.target.style.cursor = 'pointer'
							const datasetIndex = activeElements[0]._datasetIndex
							const activeDataset = this.data.datasets[datasetIndex]

							activeDataset.borderWidth = 8
							activeDataset.pointRadius = 7
							activeDataset.pointBorderWidth = 6
							activeDataset.pointBorderColor = 'rgb(255, 255, 255)'
							activeDataset.backgroundColor = ChartUtil.transparentize(activeDataset.backgroundColor, 0.90)
							this.chart.chart.update()
						}
					},
					tooltips: this.selectedDate ? {
						enabled: true,
						mode: 'point',
						intersect: false,
						callbacks: {
							label: function (tooltipItem, data) {
								const label =
									data.datasets[
										tooltipItem.datasetIndex
										].label || '';
								return label;
							}
						}
					} : { enabled: true },
					plugins: {}
				};
				if (this.chart && this.chart.chart) {
					this.chart.chart.update();
				}
			});
	}

	ngOnDestroy() {}
}
