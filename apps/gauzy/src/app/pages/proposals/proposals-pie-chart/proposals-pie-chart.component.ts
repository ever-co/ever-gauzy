import { AfterViewInit, Component, Input, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { delay, takeWhile } from 'rxjs/operators';

@Component({
	selector: 'ngx-proposals-pie-chart',
	template: `
		<chart [options]="options" class="echart"></chart>
	`,
	styleUrls: ['./proposals-pie-chart.component.scss']
})
export class ProposalsPieChartComponent implements AfterViewInit, OnDestroy {
	@Input() values: { name: string; value: number }[];

	options: any = {};
	themeSubscription: any;

	constructor(private theme: NbThemeService) {}

	// TODO translate
	ngAfterViewInit() {
		this.themeSubscription = this.theme.getJsTheme().subscribe((config) => {
			const colors = config.variables;
			const echarts: any = config.variables.echarts;
			this.options = {
				backgroundColor: echarts.bg,
				color: [
					colors.warningLight,
					colors.infoLight,
					colors.dangerLight,
					colors.successLight,
					colors.primaryLight
				],
				tooltip: {
					trigger: 'item',
					formatter: '{a} <br/>{b} : {c} ({d}%)'
				},
				legend: {
					orient: 'vertical',
					left: 'left',
					data: ['Accepted Proposals', 'Total Proposals'],
					textStyle: {
						color: echarts.textColor
					}
				},
				series: [
					{
						name: 'Proposals',
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
		});
	}

	ngOnDestroy(): void {
		this.themeSubscription.unsubscribe();
	}
}
