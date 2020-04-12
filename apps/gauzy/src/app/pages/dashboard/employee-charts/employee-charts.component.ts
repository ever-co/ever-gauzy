import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'ga-employee-charts',
	templateUrl: './employee-charts.component.html',
	styleUrls: ['./employee-charts.component.scss']
})
export class EmployeeChartsComponent implements OnInit {
	selectedChart = '1';

	constructor() {}

	ngOnInit() {}

	onChartSelected(selectedChart: string) {
		this.selectedChart = selectedChart;
	}
}
