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
	/**
	 * Which chart to draw. An input rather than internal state: the switcher that
	 * sets it belongs in the host panel's header beside the panel title, not in a
	 * row of its own above the canvas. Defaulted, so a host that renders no
	 * switcher still gets a chart.
	 */
	@Input() selectedChart: EmployeeChartEnum = EmployeeChartEnum.BAR;

	EmployeeChartEnum: typeof EmployeeChartEnum = EmployeeChartEnum;

	@Input() employeeStatistics: IMonthAggregatedEmployeeStatistics[] = [];

	ngOnInit() {}
}
