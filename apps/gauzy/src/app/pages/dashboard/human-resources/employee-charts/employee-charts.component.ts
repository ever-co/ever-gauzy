import { Component, OnInit, Input } from '@angular/core';
import { IMonthAggregatedEmployeeStatistics } from '@gauzy/models';

@Component({
	selector: 'ga-employee-charts',
	templateUrl: './employee-charts.component.html',
	styleUrls: ['./employee-charts.component.scss']
})
export class EmployeeChartsComponent implements OnInit {
	@Input()
	employeeStatistics: IMonthAggregatedEmployeeStatistics[];

	selectedChart = '1';

	constructor() {}

	ngOnInit() {}
}
