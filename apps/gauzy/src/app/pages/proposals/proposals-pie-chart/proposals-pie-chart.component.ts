import {
	AfterViewInit,
	Component,
	EventEmitter,
	Input,
	OnDestroy,
	Output,
	OnInit
} from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { delay, takeWhile } from 'rxjs/operators';

@Component({
	selector: 'ngx-proposals-pie-chart',
	template: `
		<chart class="echart" style="height: 420px" [options]="options">
		</chart>
	`,
	styleUrls: ['./proposals-pie-chart.component.scss']
})
export class ProposalsPieChartComponent implements AfterViewInit {
	@Input() values: { value: number; name: string }[];

	options: any = {};
	// echartsInstance;

	constructor(private theme: NbThemeService) {}

	ngAfterViewInit() {
		console.log(this.values);

		this.theme.getJsTheme().subscribe((config) => {
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
						name: 'Countries',
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

	getOptions(variables) {
		const earningPie: any = variables.earningPie;

		return {
			tooltip: {
				trigger: 'item',
				formatter: ''
			},
			series: [
				{
					name: ' ',
					clockWise: true,
					hoverAnimation: false,
					type: 'pie',
					center: earningPie.center,
					radius: earningPie.radius,
					data: [
						{
							value: this.values[0].value,
							name: this.values[0].name,
							label: {
								normal: {
									position: 'center',
									formatter: '',
									textStyle: {
										fontSize: '22',
										fontFamily: variables.fontSecondary,
										fontWeight: '600',
										color: variables.fgHeading
									}
								}
							},
							tooltip: {
								show: false
							},
							itemStyle: {
								normal: {
									color: new echarts.graphic.LinearGradient(
										0,
										0,
										0,
										1,
										[
											{
												offset: 0,
												color:
													earningPie.firstPieGradientLeft
											},
											{
												offset: 1,
												color:
													earningPie.firstPieGradientRight
											}
										]
									),
									shadowColor: earningPie.firstPieShadowColor,
									shadowBlur: 0,
									shadowOffsetX: 0,
									shadowOffsetY: 3
								}
							}
						},
						{
							value: this.values[1].value,
							name: this.values[1].name,
							label: {
								normal: {
									position: 'center',
									formatter: '',
									textStyle: {
										fontSize: '22',
										fontFamily: variables.fontSecondary,
										fontWeight: '600',
										color: variables.fgHeading
									}
								}
							},
							tooltip: {
								show: false
							},
							itemStyle: {
								normal: {
									color: new echarts.graphic.LinearGradient(
										0,
										0,
										0,
										1,
										[
											{
												offset: 0,
												color:
													earningPie.secondPieGradientLeft
											},
											{
												offset: 1,
												color:
													earningPie.secondPieGradientRight
											}
										]
									),
									shadowColor:
										earningPie.secondPieShadowColor,
									shadowBlur: 0,
									shadowOffsetX: 0,
									shadowOffsetY: 3
								}
							}
						}
					]
				}
			]
		};
	}
}
