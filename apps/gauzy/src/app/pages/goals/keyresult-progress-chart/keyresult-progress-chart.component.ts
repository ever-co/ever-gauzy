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
	@Input() keyResult: KeyResult;
	constructor(private goalSettingsService: GoalSettingsService) {}

	ngOnInit() {
		this.updateChart(this.keyResult);
	}

	public async updateChart(keyResult: KeyResult) {
		await this.goalSettingsService
			.getTimeFrameByName(this.keyResult.goal.deadline)
			.then((res) => {
				let start;
				let end;
				let period;
				if (keyResult.deadline === 'No Custom Deadline') {
					start = new Date(res.items[0].startDate);
					end = new Date(res.items[0].endDate);
				} else {
					console.log(keyResult.createdAt);
					start = new Date(keyResult.createdAt);
					end = new Date(keyResult.hardDeadline);
				}
				const noOfDays =
					(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
				period =
					noOfDays > 30 ? 'month' : noOfDays > 7 ? 'week' : 'day';

				const labels = this.labelCalculator(start, end, period);
				const progressParts = labels.length;

				this.calculateData(labels, progressParts, keyResult);

				this.options = {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						xAxes: [
							{
								type: 'time',
								time: {
									displayFormats: {
										hour: 'MMM DD'
									},
									tooltipFormat: 'MMM D'
								},
								ticks: {
									maxTicksLimit: progressParts + 1
								}
							}
						],
						yAxes: [
							{
								display: 'true'
							}
						]
					}
				};
			});
	}

	calculateData(labelsData, progressParts, keyResult) {
		this.data = {
			labels: labelsData,
			datasets: [
				{
					label: 'Expected',
					data: this.rangeCalculation(
						keyResult.initialValue,
						keyResult.targetValue,
						progressParts,
						labelsData
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
	}

	progressData(keyResult) {
		const updates = keyResult.updates
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() -
					new Date(a.createdAt).getTime()
			)
			.map((val) => {
				if (val.status === 'on track') {
					const date = new Date(val.createdAt).getMonth();
					return {
						x: new Date(new Date().setMonth(date)),
						y: val.update
					};
				} else {
					return {
						x: new Date(val.createdAt),
						y: val.update
					};
				}
			});
		const update = [];
		const sortedUpdates = updates.sort((a, b) => a.x - b.x);
		console.log(sortedUpdates);
		sortedUpdates.forEach((val, index) => {
			if (index === 0) {
				update.push(val);
			} else if (index + 1 < sortedUpdates.length) {
				if (val.x.getDate() !== sortedUpdates[index + 1].x.getDate()) {
					update.push(sortedUpdates[index + 1]);
				}
			}
		});
		console.log(update);
		return update;
	}

	labelCalculator(start, end, period) {
		const labels = [];
		while (start <= end) {
			labels.push(new Date(start));
			if (period === 'week') {
				start.setDate(start.getDate() + 7);
			} else if (period === 'month') {
				start.setMonth(start.getMonth() + 1);
			} else if (period === 'day') {
				start.setDate(start.getDate() + 1);
			}
		}
		return labels;
	}

	rangeCalculation(start, target, parts, labelsData) {
		const result = [];
		const delta = (target - start) / (parts - 1);
		let index = 0;
		while (start < target) {
			if (target !== 1) {
				result.push({ x: labelsData[index], y: Math.ceil(start) });
			}
			start += delta;
			index++;
		}
		result.push({ x: labelsData[index], y: Math.ceil(target) });
		return result;
	}
}
