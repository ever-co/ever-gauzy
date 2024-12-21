import { AfterViewInit, Component, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NbJSThemeVariable, NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

// Define the type for JSThemeVariable
type JSThemeVariable = string | NbJSThemeVariable | string[];

@Component({
    selector: 'ngx-proposal-pie-chart',
    template: `<canvas baseChart [options]="options" class="echart"></canvas>`,
    styleUrls: ['./proposal-pie-chart.component.scss'],
    standalone: false
})
export class ProposalPieChartComponent extends TranslationBaseComponent implements AfterViewInit, OnDestroy {
	@Input() values: { name: string; value: number }[];

	options: any = {};
	private subscription: Subscription;

	constructor(private readonly nbThemeService: NbThemeService, translateService: TranslateService) {
		super(translateService);
	}

	ngAfterViewInit() {
		this.subscription = this.nbThemeService.getJsTheme().subscribe((config) => {
			const { warningLight, infoLight, dangerLight, successLight, primaryLight, echarts } = config.variables;

			// Set the chart options
			this.options = this.getChartOptions(
				warningLight,
				infoLight,
				dangerLight,
				successLight,
				primaryLight,
				echarts
			);
		});
	}

	/**
	 * Returns the chart options based on the provided theme variables.
	 *
	 * @param warningLight
	 * @param infoLight
	 * @param dangerLight
	 * @param successLight
	 * @param primaryLight
	 * @param echarts
	 * @returns
	 */
	private getChartOptions(
		warningLight: JSThemeVariable,
		infoLight: JSThemeVariable,
		dangerLight: JSThemeVariable,
		successLight: JSThemeVariable,
		primaryLight: JSThemeVariable,
		echarts: any
	) {
		return {
			backgroundColor: echarts.bg,
			color: [warningLight, infoLight, dangerLight, successLight, primaryLight],
			tooltip: {
				trigger: 'item',
				formatter: '{a} <br/>{b} : {c} ({d}%)'
			},
			legend: {
				orient: 'vertical',
				left: 'left',
				data: [
					this.getTranslation('PROPOSALS_PAGE.ACCEPTED_PROPOSALS'),
					this.getTranslation('PROPOSALS_PAGE.TOTAL_PROPOSALS')
				],
				textStyle: {
					color: echarts.textColor
				}
			},
			series: [
				{
					name: this.getTranslation('PROPOSALS_PAGE.PROPOSALS'),
					type: 'pie',
					radius: '80%',
					center: ['50%', '50%'],
					data: this.values,
					itemStyle: {
						emphasis: {
							shadowBlur: 10,
							shadowOffsetX: 0,
							shadowColor: echarts.itemHoverShadowColor
						}
					},
					label: {
						normal: {
							textStyle: {
								color: echarts.textColor
							}
						}
					},
					labelLine: {
						normal: {
							lineStyle: {
								color: echarts.axisLineColor
							}
						}
					}
				}
			]
		};
	}

	ngOnDestroy(): void {
		this.subscription?.unsubscribe();
	}
}
