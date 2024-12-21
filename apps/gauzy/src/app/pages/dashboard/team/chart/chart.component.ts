import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gz-doughnut-chart',
    templateUrl: './chart.component.html',
    styleUrls: ['./chart.component.scss'],
    standalone: false
})
export class ChartComponent extends TranslationBaseComponent implements OnInit, OnChanges, OnDestroy {
	public data: any;
	public options: any;
	@Input() public statistics: any;
	@Input() public hideLegend: boolean = false;
	@Input() public chartType: string = 'doughnut';

	constructor(public readonly translateService: TranslateService, private readonly themeService: NbThemeService) {
		super(translateService);
	}

	private get _labels() {
		// Retrieve the statistics
		const { countOnline, countWorking, countNotWorking } = this.statistics;
		// Build the labels
		return {
			labels: [
				`${this.getTranslation('DASHBOARD_PAGE.CHARTS.WORKING_NOW')}: ${countOnline}`,
				`${this.getTranslation('DASHBOARD_PAGE.CHARTS.WORKING')}: ${countWorking - countOnline}`,
				`${this.getTranslation('DASHBOARD_PAGE.CHARTS.NOT_WORKING')}: ${countNotWorking}`
			]
		};
	}

	ngOnInit(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._updateLabels()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnChanges(changes: SimpleChanges): void {
		const statistics = changes['statistics'];
		if (JSON.stringify(statistics.previousValue) !== JSON.stringify(statistics.currentValue)) {
			this._loadChart();
		}
	}

	ngOnDestroy(): void {}

	private _loadChart() {
		this.themeService
			.getJsTheme()
			.pipe(untilDestroyed(this))
			.subscribe((config) => {
				const chart: any = config.variables.chartjs;
				this.data = {
					...this._labels,
					datasets: [
						{
							barPercentage: 0.5,
							barThickness: 10,
							maxBarThickness: 12,
							minBarLength: 2,
							data: [
								this.statistics.countOnline,
								this.statistics.countWorking - this.statistics.countOnline,
								this.statistics.countNotWorking
							],
							backgroundColor: ['green', 'orange', 'red'],
							hoverBorderColor: 'rgba(0, 0, 0, 0)',
							borderWidth: 0,
							fill: false,
							indexAxis: 'y'
						}
					]
				};
				this.options = {
					responsive: true,
					maintainAspectRatio: false,
					elements: {
						rectangle: {
							borderWidth: 2
						}
					},
					scales: {},
					legend: {
						display: !this.hideLegend,
						position: 'bottom',
						labels: {
							fontColor: chart.textColor
						}
					},
					tooltips: {
						enabled: true,
						callbacks: {
							label: function (tooltipItem, data) {
								return data.labels[tooltipItem.index] || '';
							}
						}
					}
				};
			});
	}

	private _updateLabels() {
		this.data = {
			...this.data,
			...this._labels
		};
	}
}
