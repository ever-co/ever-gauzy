import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import {
	BaseEmployeeChartWidgetComponent,
	EMPLOYEE_CHART_WIDGET_PROVIDERS
} from './base-employee-chart-widget.component';
import { EmployeeChartCardComponent } from './employee-chart-card.component';
import {
	EMPLOYEE_CHART_KINDS,
	EMPLOYEE_CHART_KIND_LABELS,
	EMPLOYEE_CHART_TYPE_CONFIG_KEY,
	EmployeeChartKind,
	toEmployeeChartKind
} from './employee-chart.utils';

/**
 * Chart widget: the HR dashboard's chart switcher, canvas-hosted.
 *
 * One widget that renders any of the three employee-statistics charts and lets
 * the viewer flip between them — the same dropdown `<ga-employee-charts>` puts
 * above its chart, so a canvas does not have to spend three cells to offer all
 * three views.
 *
 * The dropdown is a VIEW state, not a persisted one: a canvas widget has no
 * write access to its own placement, so a pick lasts for the session. The
 * starting rendering comes from the placement's `chartType` setting, which the
 * builder's configuration dialog writes.
 */
@Component({
	selector: 'ga-employee-statistics-chart-widget',
	templateUrl: './employee-statistics-chart-widget.component.html',
	styleUrls: ['./employee-statistics-chart-widget.component.scss'],
	standalone: true,
	imports: [NbSelectModule, TranslateModule, EmployeeChartCardComponent],
	providers: EMPLOYEE_CHART_WIDGET_PROVIDERS,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeStatisticsChartWidgetComponent extends BaseEmployeeChartWidgetComponent {
	/** Renderings offered by the dropdown, in the legacy switcher's order. */
	protected readonly chartKinds = EMPLOYEE_CHART_KINDS;

	/**
	 * The rendering currently on screen.
	 *
	 * Seeded from the placement's configuration; `toEmployeeChartKind` narrows an
	 * unknown persisted value (a renamed kind, hand-edited JSON) back to the
	 * default instead of rendering a blank canvas.
	 */
	protected readonly selectedKind = signal<EmployeeChartKind>(
		toEmployeeChartKind(this.getConfig<unknown>(EMPLOYEE_CHART_TYPE_CONFIG_KEY, null))
	);

	/** Chart.js type of the selected rendering. */
	protected readonly chartType = computed<ChartType>(() => this.chartTypeFor(this.selectedKind()));

	/** Datasets of the selected rendering. */
	protected readonly chartData = computed<ChartConfiguration['data']>(() => this.chartDataFor(this.selectedKind()));

	/** Options of the selected rendering, themed with the active palette. */
	protected readonly chartOptions = computed<ChartConfiguration['options']>(() =>
		this.chartOptionsFor(this.selectedKind())
	);

	/**
	 * Switches the rendering.
	 *
	 * Only the chart is rebuilt — the payload is untouched, so flipping between
	 * views never issues a request.
	 *
	 * @param kind - The rendering the viewer picked.
	 */
	public onKindChange(kind: EmployeeChartKind): void {
		this.selectedKind.set(toEmployeeChartKind(kind, this.selectedKind()));
	}

	/**
	 * Translation key of a rendering's dropdown label.
	 *
	 * @param kind - The rendering to label.
	 * @returns The translation key.
	 */
	public labelFor(kind: EmployeeChartKind): string {
		return EMPLOYEE_CHART_KIND_LABELS[kind];
	}
}
