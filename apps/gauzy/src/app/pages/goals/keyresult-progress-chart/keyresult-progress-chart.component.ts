import { Component, OnInit, Input } from '@angular/core';
import { KeyResult } from '@gauzy/models';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import {
	differenceInCalendarDays,
	addMonths,
	compareDesc,
	addDays,
	addWeeks,
	addQuarters
} from 'date-fns';

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
			.getTimeFrameByName(
				keyResult.goal.deadline === '' ? null : keyResult.goal.deadline
			)
			.then((res) => {
				if (res.items.length > 0) {
					let start;
					let end;
					let period;
					if (keyResult.deadline === 'No Custom Deadline') {
						start = new Date(res.items[0].startDate);
						end = new Date(res.items[0].endDate);
					} else {
						start = new Date(keyResult.createdAt);
						end = new Date(
							keyResult.hardDeadline
								? keyResult.hardDeadline
								: res.items[0].endDate
						);
					}
					const diffInDays = differenceInCalendarDays(end, start);
					period =
						diffInDays > 180
							? 'quarter'
							: diffInDays > 30
							? 'month'
							: diffInDays > 7
							? 'week'
							: 'day';
					const labels = this.labelCalculator(start, end, period);
					const progressParts = labels.length;
					this.calculateData(labels, keyResult);
					this.options = {
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							xAxes: [
								{
									type: 'time',
									distribution: 'series',
									time: {
										unit: period,
										displayFormats: {
											hour: 'MMM DD'
										},
										tooltipFormat: 'MMM D'
									},
									ticks: {
										maxTicksLimit: progressParts
									}
								}
							],
							yAxes: [
								{
									display: 'true',
									ticks: {
										beginAtZero: true
									}
								}
							]
						}
					};
				}
			})
			.catch((error) => {
				console.log(error);
			});
	}

	calculateData(labelsData, keyResult) {
		this.data = {
			labels: labelsData,
			datasets: [
				{
					label: 'Expected',
					data: this.expectedDataCalculation(
						keyResult.initialValue,
						keyResult.targetValue,
						labelsData
					),
					borderWidth: 2,
					borderColor: 'rgb(76, 23, 33,0.25)',
					borderDash: [10, 5],
					fill: false
				},
				{
					label: 'Progress',
					data: this.progressData(keyResult, labelsData),
					borderWidth: 3,
					borderColor: '#00d68f',
					fill: false
				}
			]
		};
	}

	progressData(keyResult, labelsData) {
		const updates = [];
		keyResult.updates
			.sort((a, b) => {
				compareDesc(new Date(a.createdAt), new Date(b.createdAt));
			})
			.map((val) => {
				if (val.status === 'on track') {
					updates.push({
						x: new Date(val.createdAt),
						y: val.update
					});
				}
			});

		const update = [];
		update.push({ x: labelsData[0], y: 0 });
		const sortedUpdates = updates.sort((a, b) => a.x - b.x);
		sortedUpdates.forEach((val, index) => {
			if (index === 0) {
				update.push(val);
			} else if (
				val.x.getDate() === update[update.length - 1].x.getDate()
			) {
				if (val.y > update[update.length - 1].y) {
					update.pop();
					update.push(val);
				}
			} else {
				update.push(val);
			}
		});
		return update;
	}

	labelCalculator(start, end, period) {
		const labels = [];
		while (start <= end) {
			labels.push(start);
			if (period === 'week') {
				start = addWeeks(start, 1);
			} else if (period === 'month') {
				start = addMonths(start, 1);
			} else if (period === 'day') {
				start = addDays(start, 1);
			} else if (period === 'quarter') {
				start = addQuarters(start, 1);
			}
		}
		labels.push(end);
		return labels;
	}

	expectedDataCalculation(start, target, labelsData) {
		const result = [];
		result.push({ x: labelsData[0], y: Math.round(start) });
		result.push({
			x: labelsData[labelsData.length - 1],
			y: Math.round(target)
		});
		return result;
	}
}
