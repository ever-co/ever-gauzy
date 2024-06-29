import { Component, OnInit, Input } from '@angular/core';
import { IKeyResult, KeyResultDeadlineEnum, IKPI, IOrganization } from '@gauzy/contracts';
import { GoalSettingsService } from '@gauzy/ui-core/core';
import { differenceInCalendarDays, addMonths, compareDesc, addDays, addWeeks, addQuarters, isAfter } from 'date-fns';
import { Store } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-keyresult-progress-chart',
	templateUrl: './keyresult-progress-chart.component.html',
	styleUrls: ['./keyresult-progress-chart.component.scss']
})
export class KeyResultProgressChartComponent extends TranslationBaseComponent implements OnInit {
	data: any;
	options: any;
	loading = true;
	@Input() keyResult: IKeyResult;
	@Input() kpi: IKPI;
	@Input() organization: IOrganization;
	constructor(
		private goalSettingsService: GoalSettingsService,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.updateChart(this.keyResult);
	}

	public async updateChart(keyResult: IKeyResult) {
		const findInput = {
			name: keyResult.goal.deadline === '' ? null : keyResult.goal.deadline,
			organization: {
				id: this.store.selectedOrganization.id
			},
			tenantId: this.organization.tenantId
		};
		await this.goalSettingsService
			.getAllTimeFrames(findInput)
			.then((res) => {
				if (res.items.length > 0) {
					let start;
					let end;
					let period;
					if (keyResult.deadline === KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE) {
						start = new Date(res.items[0].startDate);
						end = new Date(res.items[0].endDate);
					} else {
						start = new Date(res.items[0].startDate);
						end = new Date(keyResult.hardDeadline ? keyResult.hardDeadline : res.items[0].endDate);
					}
					const diffInDays = differenceInCalendarDays(end, start);
					period = diffInDays > 180 ? 'quarter' : diffInDays > 30 ? 'month' : diffInDays > 7 ? 'week' : 'day';
					const labels = this.labelCalculator(start, end, period);
					const progressParts = labels.length;
					this.calculateData(labels, keyResult);
					this.options = {
						legend: {
							position: 'bottom',
							align: 'start',
							labels: {
								textAlign: 'center'
							}
						},
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
					label: this.getTranslation('GOALS_PAGE.EXPECTED'),
					data: this.expectedDataCalculation(
						!!this.kpi ? this.kpi.currentValue : keyResult.initialValue,
						!!this.kpi ? this.kpi.targetValue + this.kpi.targetValue : keyResult.targetValue,
						labelsData
					),
					borderWidth: 4,
					borderColor: 'rgb(76, 23, 33,0.25)',
					borderDash: [10, 5],
					fill: false
				},
				{
					label: this.getTranslation('GOALS_PAGE.PROGRESS'),
					data: this.progressData(keyResult, labelsData),
					borderWidth: 4,
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
		update.push({
			x: labelsData[0],
			y: !!this.kpi ? this.kpi.currentValue : keyResult.initialValue
		});
		const sortedUpdates = [...updates].sort((a, b) => a.x - b.x);
		sortedUpdates.forEach((val, index) => {
			if (index === 0) {
				update.push(val);
			} else if (val.x.getDate() === update[update.length - 1].x.getDate()) {
				if (isAfter(val.x, update[update.length - 1].x)) {
					update.pop();
					update.push(val);
				}
			} else {
				update.push(val);
			}
		});
		this.loading = false;
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
			y: Math.round(!!this.kpi ? target - this.kpi.targetValue : target)
		});
		return result;
	}
}
