import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import {
	BaseEmployeeChartWidgetComponent,
	EMPLOYEE_CHART_WIDGET_PROVIDERS
} from './base-employee-chart-widget.component';
import { EmployeeChartCardComponent } from './employee-chart-card.component';
import { EmployeeChartKind } from './employee-chart.utils';

/**
 * Chart widget: the selected member's revenue, expenses, profit and bonus per
 * month, as grouped horizontal bars.
 *
 * The month-over-month view of the HR dashboard's chart switcher, and the one it
 * defaults to. Profit and bonus bars below zero are drawn in the theme's danger
 * colours, so a loss is never mistaken for a gain.
 */
@Component({
	selector: 'ga-employee-horizontal-bar-chart-widget',
	templateUrl: './employee-horizontal-bar-chart-widget.component.html',
	styleUrls: ['./employee-chart-widget.shared.scss'],
	standalone: true,
	imports: [EmployeeChartCardComponent],
	providers: EMPLOYEE_CHART_WIDGET_PROVIDERS,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeHorizontalBarChartWidgetComponent extends BaseEmployeeChartWidgetComponent {
	/** Chart.js type of this widget's single rendering. */
	protected readonly chartType = computed<ChartType>(() => this.chartTypeFor(EmployeeChartKind.HORIZONTAL_BAR));

	/** Grouped bar datasets for the current payload. */
	protected readonly chartData = computed<ChartConfiguration['data']>(() =>
		this.chartDataFor(EmployeeChartKind.HORIZONTAL_BAR)
	);

	/** Bar chart options, themed with the active palette. */
	protected readonly chartOptions = computed<ChartConfiguration['options']>(() =>
		this.chartOptionsFor(EmployeeChartKind.HORIZONTAL_BAR)
	);
}
