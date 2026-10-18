import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	inject,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	ViewChild,
	type SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { NbIconModule, NbJSThemeOptions, NbSpinnerModule, NbThemeService, NbTooltipModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import * as moment from 'moment-timezone';
import { IOrganizationSprint, IPagination, ITask, OrganizationSprintStatusEnum } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { isTaskFinished } from '../../../../tasks/components/task-view/task-view-sections';
import {
	IEmployeeChartPalette,
	resolveEmployeeChartPalette
} from '../../../../dashboard/employee-charts/employee-chart-palette';
import {
	employeeChartBase,
	employeeChartCategoryScale,
	employeeChartTooltip,
	employeeChartValueScale
} from '../../../../dashboard/employee-charts/employee-chart-options';
import { humanize, Loadable, loaded, loading, failed, rangeLabelOf } from '../project-view.utils';

/** One sprint, as the Sprints panel lists it. */
interface ISprintRow {
	id: string;
	name: string;
	goal?: string;
	status: string;
	tone: 'success' | 'info' | 'basic' | 'warning';
	dates?: string;
	/** Elapsed share of start → end, 0–100; null without both dates. */
	elapsed: number | null;
	hint: { key: string; count?: number } | null;
	tasks: number;
	done: number;
}

/** The burn-up's series: tasks in scope and tasks done, at the end of each day of the period. */
interface IBurnUp {
	labels: string[];
	scope: number[];
	done: number[];
	/** Finished in the period, and in scope at its end. */
	finished: number;
	total: number;
}

const SPRINT_ORDER: Record<string, number> = {
	[OrganizationSprintStatusEnum.ACTIVE]: 0,
	[OrganizationSprintStatusEnum.UPCOMING]: 1,
	[OrganizationSprintStatusEnum.DRAFT]: 2,
	[OrganizationSprintStatusEnum.COMPLETED]: 3
};

/**
 * The project page's Planning tab: a burn-up of the project's tasks over the period — how the scope
 * grew and how much of it got done — and its sprints, active first, each with its dates, how far
 * through them it is, and how many of its tasks are done.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-planning',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe,
		BaseChartDirective
	],
	templateUrl: './project-planning.component.html',
	styleUrls: [
		'../../../../employees/view-employee/view-employee.component.scss',
		'../../project-quick-look/project-quick-look.component.scss',
		'./project-planning.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class ProjectPlanningComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
	@Input() projectId: string;
	@Input() organizationId: string;
	@Input() tenantId: string;
	@Input() rangeStart: string;
	@Input() rangeEnd: string;

	public burnUp: Loadable<IBurnUp | null> = loading(null);
	public sprints: Loadable<ISprintRow[]> = loading([]);
	public palette: IEmployeeChartPalette = resolveEmployeeChartPalette({} as NbJSThemeOptions);
	public chartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
	public chartOptions: ChartConfiguration<'line'>['options'];

	@ViewChild(BaseChartDirective) private readonly _chart?: BaseChartDirective;
	private readonly _http = inject(HttpClient);
	private readonly _translate = inject(TranslateService);
	private readonly _themeService = inject(NbThemeService);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);
	private readonly _resizeObserver =
		typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.remeasure()) : null;
	private _tasks: ITask[] | null = null;
	private _sequence = 0;

	ngOnInit(): void {
		this._resizeObserver?.observe(this._elementRef.nativeElement);
		this._themeService
			.getJsTheme()
			.pipe(
				debounceTime(100),
				tap((config: NbJSThemeOptions) => {
					this.palette = resolveEmployeeChartPalette(config, this._elementRef.nativeElement);
					this.buildChart();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._translate.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.buildChart());
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (!this.projectId) return;
		if (changes['projectId'] || changes['organizationId']) {
			void this.load();
		} else if ((changes['rangeStart'] || changes['rangeEnd']) && this._tasks) {
			// Same tasks, another window: only the burn-up is redrawn.
			this.burnUp = loaded(this.toBurnUp(this._tasks));
			this.buildChart();
		}
	}

	ngAfterViewInit(): void {
		this.remeasure();
	}

	ngOnDestroy(): void {
		this._resizeObserver?.disconnect();
	}

	get rangeLabel(): string {
		return rangeLabelOf(this.rangeStart, this.rangeEnd);
	}

	private remeasure(): void {
		requestAnimationFrame(() => this._chart?.chart?.resize());
	}

	private async load(): Promise<void> {
		const sequence = ++this._sequence;
		const { organizationId, tenantId, projectId } = this;
		this._tasks = null;
		this.burnUp = loading(null);
		this.sprints = loading([]);

		const tasks = firstValueFrom(
			this._http.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, {
				params: toParams({ where: { organizationId, tenantId, projectId }, relations: ['taskStatus'] })
			})
		);
		const sprints = firstValueFrom(
			this._http.get<IPagination<IOrganizationSprint>>(`${API_PREFIX}/organization-sprint`, {
				params: {
					data: JSON.stringify({
						findInput: { organizationId, tenantId, projectId },
						relations: ['tasks']
					})
				}
			})
		);

		try {
			const result = await tasks;
			if (sequence !== this._sequence) return;
			this._tasks = result?.items || [];
			this.burnUp = loaded(this.toBurnUp(this._tasks));
			this.buildChart();
		} catch {
			if (sequence === this._sequence) this.burnUp = failed(null);
		}

		try {
			const result = await sprints;
			if (sequence !== this._sequence) return;
			this.sprints = loaded(
				(result?.items || [])
					.filter((sprint) => !!sprint?.name)
					.map((sprint) => this.toSprintRow(sprint))
					.sort(
						(a, b) =>
							(SPRINT_ORDER[a.status.toLowerCase()] ?? 9) - (SPRINT_ORDER[b.status.toLowerCase()] ?? 9) ||
							a.name.localeCompare(b.name)
					)
			);
		} catch {
			if (sequence === this._sequence) this.sprints = failed([]);
		}
	}

	/**
	 * For each day of the period: the tasks created by its end (the scope) and the tasks finished
	 * by its end (done). A finished task counts from when it was resolved, else last updated.
	 */
	private toBurnUp(tasks: ITask[]): IBurnUp {
		const start = moment(this.rangeStart).startOf('day');
		const end = moment.min(moment(this.rangeEnd), moment()).endOf('day');
		const days: moment.Moment[] = [];
		for (const day = start.clone(); day.isSameOrBefore(end, 'day') && days.length < 92; day.add(1, 'day')) {
			days.push(day.clone());
		}
		const created = tasks.map((task) => moment(task.createdAt || 0).valueOf());
		const finished = tasks
			.filter((task) => isTaskFinished(task))
			.map((task) => moment(task.resolvedAt || task.updatedAt || task.createdAt || 0).valueOf());
		const format = days.length <= 7 ? 'ddd D' : 'D MMM';
		const scope = days.map((day) => created.filter((time) => time <= day.clone().endOf('day').valueOf()).length);
		const done = days.map((day) => finished.filter((time) => time <= day.clone().endOf('day').valueOf()).length);
		const startTime = start.valueOf();
		return {
			labels: days.map((day) => day.format(format)),
			scope,
			done,
			finished: finished.filter((time) => time >= startTime).length,
			total: scope.length ? scope[scope.length - 1] : tasks.length
		};
	}

	private buildChart(): void {
		const burnUp = this.burnUp.value;
		if (!burnUp) return;
		const valueScale = employeeChartValueScale(this.palette) as any;
		const categoryScale = employeeChartCategoryScale(this.palette) as any;
		const tick = { size: 10 };
		this.chartOptions = {
			...employeeChartBase(),
			interaction: { mode: 'index', intersect: false },
			plugins: {
				legend: { display: false },
				tooltip: employeeChartTooltip(
					this.palette,
					(value) => String(Math.round(value)),
					(item) => Number(item.parsed?.y) || 0
				)
			},
			elements: { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0.25, borderWidth: 2 } },
			scales: {
				x: {
					...categoryScale,
					ticks: {
						...categoryScale.ticks,
						font: tick,
						maxRotation: 0,
						minRotation: 0,
						autoSkip: true,
						autoSkipPadding: 16
					}
				},
				y: {
					...valueScale,
					beginAtZero: true,
					ticks: { ...valueScale.ticks, font: tick, precision: 0 }
				}
			}
		} as any;
		this.chartData = {
			labels: burnUp.labels,
			datasets: [
				{
					label: this._translate.instant('PROJECT_VIEW.SCOPE'),
					data: burnUp.scope,
					borderColor: this.palette.textColor,
					backgroundColor: 'transparent',
					borderDash: [4, 4],
					fill: false
				},
				{
					label: this._translate.instant('EMPLOYEES_PAGE.VIEW.TASK_FILTERS.DONE'),
					data: burnUp.done,
					borderColor: this.palette.revenue,
					backgroundColor: this.palette.revenue,
					fill: false
				}
			]
		};
		this.remeasure();
	}

	private toSprintRow(sprint: IOrganizationSprint): ISprintRow {
		const today = moment().startOf('day');
		const start = sprint.startDate ? moment(sprint.startDate).startOf('day') : null;
		const end = sprint.endDate ? moment(sprint.endDate).startOf('day') : null;
		const status = sprint.status || '';
		const tones: Record<string, ISprintRow['tone']> = {
			[OrganizationSprintStatusEnum.ACTIVE]: 'info',
			[OrganizationSprintStatusEnum.COMPLETED]: 'success',
			[OrganizationSprintStatusEnum.UPCOMING]: 'warning'
		};
		let elapsed: number | null = null;
		if (start && end && end.isAfter(start)) {
			elapsed = Math.min(100, Math.max(0, (today.diff(start, 'days') / end.diff(start, 'days')) * 100));
		}
		let hint: ISprintRow['hint'] = null;
		if (status === OrganizationSprintStatusEnum.COMPLETED) {
			hint = { key: 'PROJECT_QUICK_LOOK.FINISHED' };
			elapsed = elapsed === null ? null : 100;
		} else if (start && today.isBefore(start)) {
			hint = { key: 'PROJECT_QUICK_LOOK.STARTS_IN', count: start.diff(today, 'days') };
		} else if (end) {
			const left = end.diff(today, 'days');
			hint =
				left < 0
					? { key: 'EMPLOYEES_PAGE.VIEW.DUE.OVERDUE_DAYS', count: -left }
					: { key: 'PROJECT_VIEW.DAYS_LEFT', count: left };
		}
		const tasks = sprint.tasks || [];
		return {
			id: sprint.id,
			name: sprint.name,
			goal: sprint.goal?.trim() || undefined,
			status: humanize(status),
			tone: tones[status] || 'basic',
			dates:
				start || end ? [start ? start.format('ll') : '…', end ? end.format('ll') : '…'].join(' – ') : undefined,
			elapsed,
			hint,
			tasks: tasks.length,
			done: tasks.filter((task) => isTaskFinished(task)).length
		};
	}
}
