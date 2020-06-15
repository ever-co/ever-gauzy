import { Component, OnInit, Input } from '@angular/core';
import { KeyResult } from '@gauzy/models';

@Component({
	selector: 'ga-keyresult-progress-chart',
	templateUrl: './keyresult-progress-chart.component.html',
	styleUrls: ['./keyresult-progress-chart.component.scss']
})
export class KeyresultProgressChartComponent implements OnInit {
	data: any;
	options: any;
	@Input() keyResult: KeyResult;
	constructor() {}

	ngOnInit(): void {
		this.data = {
			labels: [
				'January',
				'February',
				'March',
				'April',
				'May',
				'June',
				'July'
			],
			datasets: [
				{
					label: 'My First dataset',
					data: [65, 59, 80, 81, 56, 55, 40]
				}
			]
		};
		this.options = {
			responsive: true,
			maintainAspectRatio: false
		};
	}
}
