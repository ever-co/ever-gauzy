import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import {
	BaseEmployeeChartWidgetComponent,
	EMPLOYEE_CHART_WIDGET_PROVIDERS
} from './base-employee-chart-widget.component';
import { EmployeeChartCardComponent } from './employee-chart-card.component';
import { EmployeeChartKind } from './employee-chart.utils';

/**
 * Chart widget: how each month's expenses, bonus and profit divide that month's
 * revenue, as a stacked horizontal bar.
 *
 * The composition view of the HR dashboard's chart switcher. Each month's values
 * are normalized by its own `(expense + profit + bonus) / income` proportion, so
 * a strong month and a weak one are directly comparable.
 */
@Component({
	selector: 'ga-employee-stacked-bar-chart-widget',
	templateUrl: './employee-stacked-bar-chart-widget.component.html',
	styleUrls: ['./employee-chart-widget.shared.scss'],
	standalone: true,
	imports: [EmployeeChartCardComponent],
	providers: EMPLOYEE_CHART_WIDGET_PROVIDERS,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeStackedBarChartWidgetComponent extends BaseEmployeeChartWidgetComponent {
	/** Chart.js type of this widget's single rendering. */
	protected readonly chartType = computed<ChartType>(() => this.chartTypeFor(EmployeeChartKind.STACKED_BAR));

	/** Stacked bar datasets for the current payload. */
	protected readonly chartData = computed<ChartConfiguration['data']>(() =>
		this.chartDataFor(EmployeeChartKind.STACKED_BAR)
	);

	/** Stacked bar options, themed with the active palette. */
	protected readonly chartOptions = computed<ChartConfiguration['options']>(() =>
		this.chartOptionsFor(EmployeeChartKind.STACKED_BAR)
	);
}
