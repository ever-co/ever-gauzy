import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import {
	BaseEmployeeChartWidgetComponent,
	EMPLOYEE_CHART_WIDGET_PROVIDERS
} from './base-employee-chart-widget.component';
import { EmployeeChartCardComponent } from './employee-chart-card.component';
import { EmployeeChartKind } from './employee-chart.utils';

/**
 * Chart widget: the selected member's revenue, expenses, bonus and profit over
 * the selected range, as a doughnut.
 *
 * The share-of-the-whole view of the HR dashboard's chart switcher. Unlike the
 * legacy component — which charted `employeeStatistics[0]`, i.e. only the first
 * month of whatever came back — this totals every month in the range, because a
 * canvas widget's range is not locked to a single month.
 */
@Component({
	selector: 'ga-employee-doughnut-chart-widget',
	templateUrl: './employee-doughnut-chart-widget.component.html',
	styleUrls: ['./employee-chart-widget.shared.scss'],
	standalone: true,
	imports: [EmployeeChartCardComponent],
	providers: EMPLOYEE_CHART_WIDGET_PROVIDERS,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDoughnutChartWidgetComponent extends BaseEmployeeChartWidgetComponent {
	/** Chart.js type of this widget's single rendering. */
	protected readonly chartType = computed<ChartType>(() => this.chartTypeFor(EmployeeChartKind.DOUGHNUT));

	/** Doughnut slices for the current payload. */
	protected readonly chartData = computed<ChartConfiguration['data']>(() =>
		this.chartDataFor(EmployeeChartKind.DOUGHNUT)
	);

	/** Doughnut options, themed with the active palette. */
	protected readonly chartOptions = computed<ChartConfiguration['options']>(() =>
		this.chartOptionsFor(EmployeeChartKind.DOUGHNUT)
	);
}
