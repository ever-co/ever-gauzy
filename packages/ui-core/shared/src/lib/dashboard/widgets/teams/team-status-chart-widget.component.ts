import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ChartConfiguration, ChartType, TooltipItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamsWidgetStateComponent } from './teams-widget-state.component';
import { ITeamStatusChartPalette, resolveTeamStatusPalette } from './team-status-chart.utils';

/** Neutral palette used until the theme service has emitted, so `chartData` is never empty. */
const NEUTRAL_PALETTE: ITeamStatusChartPalette = {
	online: 'green',
	working: 'orange',
	notWorking: 'crimson',
	textColor: 'gray'
};

/**
 * Doughnut of how the teams in scope are split between working now, worked
 * today and not working.
 *
 * This is the widgetized form of `gz-doughnut-chart` — a component that was
 * declared in `dashboard.module.ts` but rendered by NO template, so it had never
 * run. Widgetizing it surfaced three defects that are fixed here:
 *
 * 1. `ngOnChanges` dereferenced `changes['statistics']` unconditionally, so any
 *    other input change threw. There are no inputs at all now: the data comes
 *    from the ambient dashboard context.
 * 2. Its options used the Chart.js **v2** shape (`legend` / `tooltips` at the
 *    root, `elements.rectangle`), which Chart.js v4 — the version this repo ships
 *    — silently ignores, so the legend and tooltips never appeared.
 * 3. Its slice colours were the literals `green` / `orange` / `red`; they now
 *    come from the active theme (see {@link resolveTeamStatusPalette}).
 */
@Component({
	selector: 'ga-team-status-chart-widget',
	templateUrl: './team-status-chart-widget.component.html',
	styleUrls: ['./team-status-chart-widget.component.scss'],
	standalone: true,
	imports: [BaseChartDirective, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamStatusChartWidgetComponent extends BaseTeamsWidgetComponent {
	private readonly _themeService = inject(NbThemeService);
	private readonly _translateService = inject(TranslateService);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);

	/** Chart.js type; a plain field because the template binds it once. */
	protected readonly chartType: ChartType = 'doughnut';

	/** Colours of the active theme, refreshed whenever the user switches theme. */
	private readonly palette = signal<ITeamStatusChartPalette>(NEUTRAL_PALETTE);

	/** Bumped on every language change, so the labels are re-translated. */
	private readonly langVersion = signal(0);

	/** Teams currently online / working / not working, in slice order. */
	private readonly slices = computed<number[]>(() => {
		const snapshot = this.snapshot();
		const online = snapshot?.teamsOnline ?? 0;
		const working = snapshot?.teamsWorking ?? 0;

		// `working` INCLUDES the online teams, exactly like the legacy statistics
		// object; clamped so a mid-refresh snapshot cannot produce a negative slice.
		return [online, Math.max(working - online, 0), snapshot?.teamsNotWorking ?? 0];
	});

	/** True when there is nothing to chart, which drives the empty state. */
	protected readonly isEmpty = computed<boolean>(() => this.slices().every((slice) => slice === 0));

	/** Fully built Chart.js dataset, including the count-carrying legend labels. */
	protected readonly chartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
		// Read so the labels are rebuilt after a language change.
		this.langVersion();

		const [online, working, notWorking] = this.slices();
		const palette = this.palette();

		return {
			labels: [
				`${this._translateService.instant('DASHBOARD_PAGE.CHARTS.WORKING_NOW')}: ${online}`,
				`${this._translateService.instant('DASHBOARD_PAGE.CHARTS.WORKING')}: ${working}`,
				`${this._translateService.instant('DASHBOARD_PAGE.CHARTS.NOT_WORKING')}: ${notWorking}`
			],
			datasets: [
				{
					data: [online, working, notWorking],
					backgroundColor: [palette.online, palette.working, palette.notWorking],
					// Fully transparent rather than a colour: a hover border drawn in
					// any theme colour looks like a selection artefact.
					hoverBorderColor: 'transparent',
					borderWidth: 0
				}
			]
		};
	});

	/** Chart.js v4 options — note that `legend`/`tooltip` live under `plugins`. */
	protected readonly chartOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => ({
		responsive: true,
		// The widget host sizes the card; letting the chart keep its aspect ratio
		// would make it overflow a wide, short placement.
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: 'bottom',
				labels: { color: this.palette().textColor }
			},
			tooltip: {
				enabled: true,
				callbacks: {
					// The label already carries the count, so the value would repeat it.
					label: (item: TooltipItem<'doughnut'>) => item.label ?? ''
				}
			}
		}
	}));

	constructor() {
		super();

		// The palette has to be re-resolved on every theme switch; `getJsTheme()`
		// re-emits, so this keeps the slices correct without a page reload.
		this._themeService
			.getJsTheme()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((theme: NbJSThemeOptions) =>
				this.palette.set(resolveTeamStatusPalette(theme?.variables, this._elementRef.nativeElement))
			);

		this._translateService.onLangChange
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.langVersion.update((version: number) => version + 1));
	}
}
