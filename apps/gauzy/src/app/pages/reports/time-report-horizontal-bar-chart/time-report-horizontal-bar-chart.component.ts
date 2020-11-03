import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import {
	IMonthAggregatedEmployeeStatistics,
	ITimeLogFilters
} from '@gauzy/models';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';

@UntilDestroy()
@Component({
	selector: 'gauzy-time-report-horizontal-bar-chart',
	templateUrl: './time-report-horizontal-bar-chart.component.html',
	styleUrls: ['./time-report-horizontal-bar-chart.component.scss']
})
export class TimeReportHorizontalBarChartComponent
	implements OnInit, OnDestroy {
	data: any;
	options: any;
	incomeStatistics: number[] = [];
	expenseStatistics: number[] = [];
	labels: string[] = [];
	selectedDate: Date;
	noData = false;

	logRequest: ITimeLogFilters = {};

	@Input()
	employeeStatistics: IMonthAggregatedEmployeeStatistics[];
	weekDayList: string[];

	constructor(private themeService: NbThemeService) {}

	ngOnInit() {
		const startDate = moment().startOf('week').toDate();
		const endDate = moment().endOf('week').toDate();

		this.updateWeekDayList();

		this.themeService
			.getJsTheme()
			.pipe(untilDestroyed(this))
			.subscribe((config) => {
				const chartJs: any = config.variables.chartJs;

				this.data = {
					labels: this.labels,
					datasets: [
						{
							label: 'Manual',
							backgroundColor: '#089c17',
							borderWidth: 1,
							data: this.incomeStatistics
						},
						{
							label: `Tracked`,
							backgroundColor: '#dbc300',
							data: this.expenseStatistics
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
			});
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
