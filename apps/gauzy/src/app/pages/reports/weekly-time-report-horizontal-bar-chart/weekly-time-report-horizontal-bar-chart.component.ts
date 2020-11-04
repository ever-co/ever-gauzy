import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IMonthAggregatedEmployeeStatistics,
	ITimeLogFilters
} from '@gauzy/models';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ChartComponent } from 'angular2-chartjs';
import * as moment from 'moment';

declare let window: any;

export interface ChartData {
	labels?: string[];
	datasets: {
		label?: string;
		backgroundColor?: string;
		borderWidth?: number;
		data?: number[];
	}[];
}

@UntilDestroy()
@Component({
	selector: 'gauzy-weekly-time-report-horizontal-bar-chart',
	templateUrl: './weekly-time-report-horizontal-bar-chart.component.html',
	styleUrls: ['./weekly-time-report-horizontal-bar-chart.component.scss']
})
export class WeeklyTimeReportHorizontalBarChartComponent
	implements OnInit, OnDestroy {
	options: any;
	incomeStatistics: number[] = [];
	expenseStatistics: number[] = [];
	labels: string[] = [];
	noData = false;
	private _data: ChartData;

	logRequest: ITimeLogFilters = {};

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

	@ViewChild('chart') chart: ChartComponent;

	weekDayList: string[];

	constructor(private themeService: NbThemeService) {}

	ngOnInit() {
		this.updateWeekDayList();

		this.themeService
			.getJsTheme()
			.pipe(untilDestroyed(this))
			.subscribe((config) => {
				const chartJs: any = config.variables.chartjs;
				this.loadChart(chartJs);
			});
	}

	loadChart(chartJs) {
		this.options = {
			responsive: true,
			maintainAspectRatio: false,
			elements: {
				rectangle: {
					borderWidth: 2
				}
			},
			color: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56'],
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
			tooltips: {
				enabled: true
				// mode: 'dataset',
				// callbacks: {
				// 	label: (tooltipItem, data) => {
				// 		const label =
				// 			data.datasets[
				// 				tooltipItem.datasetIndex
				// 			].label || '';
				// 		return label;
				// 	}
				// }
			}
		};
		if (this.chart && this.chart.chart) {
			this.chart.chart.update();
		}
	}

	updateWeekDayList() {
		const range = {};
		let i = 0;
		const start = moment(this.logRequest.startDate);
		while (start.isSameOrBefore(this.logRequest.endDate) && i < 7) {
			const date = start.format('YYYY-MM-DD');
			range[date] = null;
			start.add(1, 'day');
			i++;
		}
		this.weekDayList = Object.keys(range);
	}

	ngOnDestroy() {}
}
