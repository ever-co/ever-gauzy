import { Component, OnInit, Input } from '@angular/core';
import { KeyResult } from '@gauzy/models';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';

@Component({
	selector: 'ga-keyresult-progress-chart',
	templateUrl: './keyresult-progress-chart.component.html',
	styleUrls: ['./keyresult-progress-chart.component.scss']
})
export class KeyResultProgressChartComponent implements OnInit {
	data: any;
	options: any;
	month = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	@Input() keyResult: KeyResult;
	constructor(private goalSettingsService: GoalSettingsService) {}

	ngOnInit() {
		this.updateChart(this.keyResult);
	}

	public async updateChart(keyResult) {
		await this.goalSettingsService
			.getTimeFrameByName(this.keyResult.goal.deadline)
			.then((res) => {
				const start = new Date(res.items[0].startDate).getMonth();
				const end = new Date(res.items[0].endDate).getMonth();
				console.log(`${start}...${end} and ${new Date(end)}`);
				this.data = {
					labels: this.labelCalculator(start, end),
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
							data: this.progressData(keyResult),
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
			});
	}

	progressData(keyResult) {
		const updates = keyResult.updates
			.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() -
					new Date(b.createdAt).getTime()
			)
			.map((val) => {
				return {
					x: this.month[new Date(val.createdAt).getMonth()],
					y: val.update
				};
			});
		console.log(updates);
		return updates;
	}

	labelCalculator(start, end) {
		const labels = [];
		while (start <= end) {
			labels.push(this.month[start]);
			start++;
		}
		return labels;
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
