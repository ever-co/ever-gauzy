import { Component, OnInit, Input, ElementRef, inject } from '@angular/core';
import { IKeyResult, KeyResultDeadlineEnum, IKPI, IOrganization } from '@gauzy/contracts';
import { GoalSettingsService } from '@gauzy/ui-core/core';
import { differenceInCalendarDays, addMonths, compareDesc, addDays, addWeeks, addQuarters, isAfter } from 'date-fns';
import { Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { NbThemeService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-keyresult-progress-chart',
    templateUrl: './keyresult-progress-chart.component.html',
    styleUrls: ['./keyresult-progress-chart.component.scss'],
    standalone: false
})
export class KeyResultProgressChartComponent extends TranslationBaseComponent implements OnInit {
	data: any;
	options: any;
	loading = true;
	@Input() keyResult: IKeyResult;
	@Input() kpi: IKPI;
	@Input() organization: IOrganization;

	/**
	 * Host element for theme colour lookups. Nebular emits its theme tokens as
	 * CSS custom properties on the themed subtree (`.nb-theme-*` on `nb-layout`),
	 * NOT on `<html>`, so they have to be resolved against an element inside it.
	 */
	private readonly elementRef = inject(ElementRef);
	private readonly themeService = inject(NbThemeService);

	/** Theme the current datasets were coloured for; guards the replayed emission. */
	private renderedTheme?: string;

	constructor(
		private goalSettingsService: GoalSettingsService,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.renderedTheme = this.themeService.currentTheme;
		this.updateChart(this.keyResult);

		// Chart.js copies concrete colour strings into the dataset; it cannot hold a
		// `var()` and re-resolve it. So a theme switch while this dialog is open would
		// otherwise leave both lines painted in the colours of the theme that was
		// active when the chart was built — the exact contrast problem the tokens were
		// introduced to solve. Rebuilding on theme change re-reads them.
		//
		// Compared against the theme already drawn rather than piped through `skip(1)`:
		// `onThemeChange()` REPLAYS the current theme to a new subscriber, so a bare
		// subscription rebuilt the chart immediately and fired `getAllTimeFrames` a
		// second time for every key result on screen. A name comparison drops that
		// replay without assuming the replay is always there.
		this.themeService
			.onThemeChange()
			.pipe(untilDestroyed(this))
			.subscribe((theme) => {
				const name = theme?.name;
				if (!name || name === this.renderedTheme) {
					return;
				}
				this.renderedTheme = name;
				this.updateChart(this.keyResult);
			});
	}

	public async updateChart(keyResult: IKeyResult) {
		const findInput = {
			name: keyResult.goal.deadline === '' ? null : keyResult.goal.deadline,
			organization: {
				id: this.store.selectedOrganization.id
			},
			tenantId: this.organization.tenantId
		};
		await this.goalSettingsService
			.getAllTimeFrames(findInput)
			.then((res) => {
				if (res.items.length > 0) {
					let start;
					let end;
					let period;
					if (keyResult.deadline === KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE) {
						start = new Date(res.items[0].startDate);
						end = new Date(res.items[0].endDate);
					} else {
						start = new Date(res.items[0].startDate);
						end = new Date(keyResult.hardDeadline ? keyResult.hardDeadline : res.items[0].endDate);
					}
					const diffInDays = differenceInCalendarDays(end, start);
					period = diffInDays > 180 ? 'quarter' : diffInDays > 30 ? 'month' : diffInDays > 7 ? 'week' : 'day';
					const labels = this.labelCalculator(start, end, period);
					const progressParts = labels.length;
					this.calculateData(labels, keyResult);
					this.options = {
						legend: {
							position: 'bottom',
							align: 'start',
							labels: {
								textAlign: 'center'
							}
						},
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							xAxes: [
								{
									type: 'time',
									distribution: 'series',
									time: {
										unit: period,
										displayFormats: {
											hour: 'MMM DD'
										},
										tooltipFormat: 'MMM D'
									},
									ticks: {
										maxTicksLimit: progressParts
									}
								}
							],
							yAxes: [
								{
									display: 'true',
									ticks: {
										beginAtZero: true
									}
								}
							]
						}
					};
				}
			})
			.catch((error) => {
				console.log(error);
			});
	}

	calculateData(labelsData, keyResult) {
		this.data = {
			labels: labelsData,
			datasets: [
				{
					label: this.getTranslation('GOALS_PAGE.EXPECTED'),
					data: this.expectedDataCalculation(
						!!this.kpi ? this.kpi.currentValue : keyResult.initialValue,
						!!this.kpi ? this.kpi.targetValue + this.kpi.targetValue : keyResult.targetValue,
						labelsData
					),
					borderWidth: 4,
					// Was `rgb(76, 23, 33,0.25)` — four arguments in the legacy
					// comma form, which is not a valid colour. The canvas keeps
					// whatever `strokeStyle` it had, so the "expected" guide line
					// was drawn in the default black: invisible on every dark
					// theme. It is a guide, so it takes the muted text colour.
					borderColor: this.themeColor('--text-hint-color', 'rgba(113, 113, 122, 1)'),
					borderDash: [10, 5],
					fill: false
				},
				{
					label: this.getTranslation('GOALS_PAGE.PROGRESS'),
					data: this.progressData(keyResult, labelsData),
					borderWidth: 4,
					// Was a hard-coded `#00d68f` — the old Nebular success green,
					// the same in all eight themes and washed out on the light
					// canvas. The theme's own success accent has a light and a
					// dark value, so the line stays legible on both.
					borderColor: this.themeColor('--gauzy-action-success-text', '#047857'),
					fill: false
				}
			]
		};
	}

	/**
	 * Reads a colour off the active theme's CSS custom properties.
	 *
	 * Chart.js paints onto a canvas and cannot resolve `var()` itself, so the
	 * value has to be looked up here. Guarded for non-browser platforms (SSR,
	 * unit tests) where `getComputedStyle` does not exist — the chart must fall
	 * back to a literal, not crash.
	 *
	 * @param name - Custom property name, including the leading `--`.
	 * @param fallback - Colour to use when the property cannot be read.
	 * @returns A non-empty CSS colour string.
	 */
	private themeColor(name: string, fallback: string): string {
		const host: Element | null = this.elementRef.nativeElement ?? null;
		if (!host || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
			return fallback;
		}
		try {
			return window.getComputedStyle(host).getPropertyValue(name).trim() || fallback;
		} catch {
			return fallback;
		}
	}

	progressData(keyResult, labelsData) {
		const updates = [];
		keyResult.updates
			.sort((a, b) => {
				compareDesc(new Date(a.createdAt), new Date(b.createdAt));
			})
			.map((val) => {
				if (val.status === 'on track') {
					updates.push({
						x: new Date(val.createdAt),
						y: val.update
					});
				}
			});
		const update = [];
		update.push({
			x: labelsData[0],
			y: !!this.kpi ? this.kpi.currentValue : keyResult.initialValue
		});
		const sortedUpdates = [...updates].sort((a, b) => a.x - b.x);
		sortedUpdates.forEach((val, index) => {
			if (index === 0) {
				update.push(val);
			} else if (val.x.getDate() === update[update.length - 1].x.getDate()) {
				if (isAfter(val.x, update[update.length - 1].x)) {
					update.pop();
					update.push(val);
				}
			} else {
				update.push(val);
			}
		});
		this.loading = false;
		return update;
	}

	labelCalculator(start, end, period) {
		const labels = [];
		while (start <= end) {
			labels.push(start);
			if (period === 'week') {
				start = addWeeks(start, 1);
			} else if (period === 'month') {
				start = addMonths(start, 1);
			} else if (period === 'day') {
				start = addDays(start, 1);
			} else if (period === 'quarter') {
				start = addQuarters(start, 1);
			}
		}
		labels.push(end);
		return labels;
	}

	expectedDataCalculation(start, target, labelsData) {
		const result = [];
		result.push({ x: labelsData[0], y: Math.round(start) });
		result.push({
			x: labelsData[labelsData.length - 1],
			y: Math.round(!!this.kpi ? target - this.kpi.targetValue : target)
		});
		return result;
	}
}
