import { Component, OnInit, Input } from '@angular/core';
import { IMonthAggregatedEmployeeStatistics } from '@gauzy/contracts';

export enum EmployeeChartEnum {
	BAR = 1,
	DOUGHNUT = 2,
	STACKED_BAR = 3
}

@Component({
    selector: 'ga-employee-charts',
    templateUrl: './employee-charts.component.html',
    styleUrls: ['./employee-charts.component.scss'],
    standalone: false
})
export class EmployeeChartsComponent implements OnInit {
	selectedChart = EmployeeChartEnum.BAR;
	EmployeeChartEnum: typeof EmployeeChartEnum = EmployeeChartEnum;

	@Input() employeeStatistics: IMonthAggregatedEmployeeStatistics[] = [];

	ngOnInit() {}
}
