import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	NgZone,
	OnDestroy,
	computed,
	inject,
	input,
	output,
	viewChild
} from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';

/**
 * Presentational body shared by the four employee chart widgets.
 *
 * It wraps `ng2-charts`' `BaseChartDirective` — the very directive the HR
 * dashboard's charts use — and adds the four states a canvas-hosted widget needs
 * but that page never had: a loading skeleton, a recoverable error state, an
 * actionable "pick a member" hint, and the existing "no data" notice.
 *
 * It deliberately renders NO card and NO title: on a canvas every widget is
 * already wrapped by `<ga-dashboard-widget-host>`, which owns the `nb-card`, the
 * header title and the edit-mode menu. Rendering our own would nest a card in a
 * card and print the title twice.
 *
 * Purely presentational on purpose — all fetching, theming and dataset building
 * live in `BaseEmployeeChartWidgetComponent`, so this component stays trivially
 * reusable by any future chart widget.
 */
@Component({
	selector: 'ga-employee-chart-card',
	templateUrl: './employee-chart-card.component.html',
	styleUrls: ['./employee-chart-card.component.scss'],
	standalone: true,
	imports: [NbButtonModule, NbIconModule, TranslateModule, BaseChartDirective],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeChartCardComponent implements AfterViewInit, OnDestroy {
	private readonly _host: ElementRef<HTMLElement> = inject(ElementRef);
	private readonly _zone = inject(NgZone);

	/** Chart.js chart type — `'bar'` or `'doughnut'` for the shipped widgets. */
	readonly type = input<ChartType>('bar');

	/** Chart.js data object; `null` while the widget has nothing to draw. */
	readonly data = input<ChartConfiguration['data'] | null>(null);

	/** Chart.js options, already themed by the widget. */
	readonly options = input<ChartConfiguration['options'] | null>(null);

	/** Shows the skeleton instead of the chart. */
	readonly loading = input<boolean>(false);

	/** Non-null switches the card into its error state. */
	readonly error = input<string | null>(null);

	/**
	 * True when the widget cannot query anything until the user picks a member.
	 *
	 * Rendered as an actionable hint rather than an empty chart, because "no bars"
	 * and "no member selected" are two very different answers.
	 */
	readonly requiresEmployee = input<boolean>(false);

	/** True when the query succeeded but returned no months. */
	readonly empty = input<boolean>(false);

	/** Emitted when the user asks for a re-fetch from the error state. */
	readonly retry = output<void>();

	/**
	 * Chart data, never `null`.
	 *
	 * `BaseChartDirective` assigns whatever it is given straight onto the Chart.js
	 * instance, and a `null` there throws inside the library rather than in our
	 * template — so the empty structure is substituted here.
	 */
	protected readonly chartData = computed<ChartConfiguration['data']>(
		() => this.data() ?? { labels: [], datasets: [] }
	);

	/** Chart options, normalized to `undefined` so Chart.js applies its defaults. */
	protected readonly chartOptions = computed<ChartConfiguration['options']>(() => this.options() ?? undefined);

	/** The rendered chart, absent in every state other than "ready". */
	private readonly chartDirective = viewChild(BaseChartDirective);

	/** Watches the widget's own box, see {@link scheduleResize}. */
	private resizeObserver: ResizeObserver | null = null;

	/** Pending animation frame id, `0` when none is scheduled. */
	private resizeFrame = 0;

	/**
	 * Starts observing the host box so the chart follows its grid cell.
	 *
	 * Chart.js only re-measures when its own container resizes, and on a dashboard
	 * canvas the widget is resized by a CSS grid whose track sizes change without
	 * any layout event the chart can see (another widget dropped next to it, the
	 * width menu picking 4 → 8 columns, the browser window changing). Without this
	 * the canvas keeps its first measured size and the chart renders stretched.
	 */
	public ngAfterViewInit(): void {
		if (typeof ResizeObserver === 'undefined') {
			return;
		}

		// Outside Angular: the observer fires on every animation frame of a drag,
		// and each notification would otherwise run a full change detection pass.
		this._zone.runOutsideAngular(() => {
			this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
			this.resizeObserver.observe(this._host.nativeElement);
		});
	}

	/** Stops the observer and drops any pending frame. */
	public ngOnDestroy(): void {
		if (this.resizeFrame) {
			cancelAnimationFrame(this.resizeFrame);
			this.resizeFrame = 0;
		}
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	/**
	 * Coalesces a burst of resize notifications into one `chart.resize()`.
	 *
	 * Resizing a Chart.js chart re-renders it synchronously, so calling it per
	 * observer notification during a drag would drop frames.
	 */
	private scheduleResize(): void {
		if (this.resizeFrame) {
			cancelAnimationFrame(this.resizeFrame);
		}

		this.resizeFrame = requestAnimationFrame(() => {
			this.resizeFrame = 0;
			// The chart is destroyed in every non-"ready" state, so this is a
			// no-op while the widget shows a skeleton or an error.
			this.chartDirective()?.chart?.resize();
		});
	}
}
