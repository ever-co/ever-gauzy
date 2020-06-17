import { Component, OnInit, Input } from '@angular/core';
import { KeyResult } from '@gauzy/models';

@Component({
	selector: 'ga-keyresult-progress-chart',
	templateUrl: './keyresult-progress-chart.component.html',
	styleUrls: ['./keyresult-progress-chart.component.scss']
})
export class KeyResultProgressChartComponent implements OnInit {
	data: any;
	options: any;
	@Input() keyResult: KeyResult;
	constructor() {}

	ngOnInit() {
		this.updateChart(this.keyResult);
	}

	public updateChart(keyResult) {
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
					label: 'Expected',
					data: this.rangeCalculation(
						keyResult.initialValue,
						keyResult.targetValue,
						7
					),
					borderWidth: 2,
					borderColor: 'rgba(255, 99, 132, 0.2)',
					fill: false
				},
				{
					label: 'Progress',
					data: keyResult.updates
						.sort(
							(a, b) =>
								new Date(a.createdAt).getTime() -
								new Date(b.createdAt).getTime()
						)
						.map((val) => val.update),
					borderWidth: 3,
					borderColor: '#00d68f',
					fill: false
				}
			]
		};
		this.options = {
			responsive: true,
			maintainAspectRatio: false
		};
	}

	rangeCalculation(start, target, parts) {
		const result = [],
			delta = (target - start) / (parts - 1);
		while (start < target) {
			result.push(start);
			start += delta;
		}
		result.push(target);
		return result;
	}
}
