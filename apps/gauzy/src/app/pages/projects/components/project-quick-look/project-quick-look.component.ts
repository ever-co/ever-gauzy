import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	HostBinding,
	Input,
	OnChanges,
	Output,
	type SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import {
	IEmployee,
	IMembersStatistics,
	IOrganizationProject,
	IOrganizationProjectModule,
	IPagination,
	ITask,
	ITasksStatistics,
	ITimeLogFilters,
	ITimeLogTodayFilters,
	OrganizationProjectBudgetTypeEnum,
	PermissionsEnum,
	ProjectModuleStatusEnum,
	ProjectStatusEnum,
	TimeLogType
} from '@gauzy/contracts';
import { API_PREFIX, toParams, toUtcOffset } from '@gauzy/ui-core/common';
import { OrganizationProjectsService, Store, TimesheetService, TimesheetStatisticsService } from '@gauzy/ui-core/core';
import { IRecordViewSection, IRecordViewStatus, RecordViewModule, TimeZoneService } from '@gauzy/ui-core/shared';
import {
	EmployeeHoursChartComponent,
	IEmployeeHoursDay
} from '../../../employees/view-employee/employee-hours-chart/employee-hours-chart.component';
import { isTaskFinished } from '../../../tasks/components/task-view/task-view-sections';
import { buildProjectViewSections, PROJECT_VIEW_RELATIONS, projectStatusOf } from './project-view-sections';
import {
	dueInWords,
	humanize,
	initialsOf,
	Loadable,
	loading,
	nameOf,
	Presence,
	presenceOf,
	statusGroupOf
} from '../project-view/project-view.utils';

/** The card a project is opened from: its name, logo and the host's time on it in the period. */
export interface IProjectQuickLookCard {
	id: string;
	name: string;
	imageUrl?: string;
	initials: string;
	/**
	 * Seconds the host page counts for it in the period (the employee's, or the team's).
	 * Absent on the project's own page, where the headline shows the period's total instead.
	 */
	duration?: number;
}

/** Where the quick look renders: a Projects panel's right-side drawer, or the project's own page. */
export type ProjectQuickLookMode = 'drawer' | 'page';

/** The host's period, so the period's change compares with the same span of the one before it. */
export type ProjectQuickLookPeriod = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_30_DAYS';

/** A person the host page already knows, so a contributor shows their name, photo and presence. */
export interface IProjectQuickLookPerson {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
	presence?: Presence;
}

/** One row of a ranked list: a name and its time in the period. */
interface IRankedRow {
	id: string;
	name: string;
	duration: number;
	/** Share of the list's total, 0–100. */
	share: number;
	/** Bar length, 0–100, relative to the largest row. */
	width: number;
}

/** One person in "who worked the most": their photo, time, share and activity. */
interface IContributorRow extends IRankedRow {
	initials: string;
	avatarUrl?: string;
	/** Average activity in the period, 0–100; absent when unknown. */
	activity?: number;
	/** Live presence, for the "tracking now" dot; known only for the host's own people. */
	presence?: Presence;
}

/** A project's task completion: done, in progress and still to do, out of all its tasks. */
interface IProjectProgress {
	total: number;
	done: number;
	progress: number;
	todo: number;
	/** Done share of all tasks, 0–100. */
	percent: number;
}

/** The headline: status line and key figures. */
interface IProjectFacts {
	status: IRecordViewStatus | null;
	isPublic?: boolean;
	client?: string;
	/** Null until the project's full read lands. */
	members: number | null;
	endDate?: string;
	due: { key: string; count?: number } | null;
	overdue: boolean;
}

/** An hours budget against the hours worked on the project since it started. */
interface IProjectBudget {
	usedHours: number;
	budgetHours: number;
	/** Used share of the budget, 0–100 (capped for the bar; `over` says when it is exceeded). */
	percent: number;
	over: boolean;
	/** Amber from 80% used. */
	warning: boolean;
}

/** The project page's timeline: its dates, how far through them it is, and what that means. */
interface IProjectTimeline {
	start?: string;
	end?: string;
	/** Elapsed share of start → end, 0–100; null without both dates. */
	percent: number | null;
	/** "In 63 days", "3 days overdue", "Starts in 5 days", "Finished". */
	hint: { key: string; count?: number } | null;
	tone: 'danger' | 'success' | null;
}

/** The period's time so far against the same span of the previous period. */
interface IPeriodDelta {
	percent: number;
	direction: 'up' | 'down' | 'flat';
}

/** One person on the project page's Team panel. */
interface ITeamMemberRow {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
	isManager: boolean;
	presence: Presence;
	/** Seconds on the project in the period; null until the period's figures land. */
	duration: number | null;
}

/** One module on the project page's Modules panel. */
interface IModuleRow {
	id: string;
	name: string;
	status: string;
	tone: 'success' | 'info' | 'danger' | 'warning' | 'basic';
	dates?: string;
	tasks: number;
}

/** An open task that is overdue or due within {@link ATTENTION_DAYS} days. */
interface IAttentionTask {
	id: string;
	title: string;
	due: { key: string; count?: number };
	overdue: boolean;
}

interface ITaskPerson {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
}

/** A project task as the drawer's task list shows it. */
interface ITaskRow {
	id: string;
	key: string;
	title: string;
	status: string;
	statusGroup: 'todo' | 'progress' | 'blocked' | 'done';
	/** The status's own colour, as the Board's column shows it; unset, the dot takes its group's. */
	statusColor?: string;
	dueDate?: string;
	dueDateLong?: string;
	due: { key: string; count?: number };
	dueTime: number;
	doneTime: number;
	overdue: boolean;
	priority?: string;
	priorityLevel?: 'urgent' | 'high' | 'medium' | 'low';
	people: ITaskPerson[];
	morePeople: ITaskPerson[];
}

export type ProjectTaskFilter = 'open' | 'progress' | 'overdue' | 'done';

/** How the page's Daily activity reads: the period's bars, or a year of days as squares. */
export type ProjectActivityView = 'chart' | 'grid';

/** One day of the year grid, placed on its month block's week column and weekday row. */
interface IActivityGridDay {
	key: string;
	/** "Wed, Oct 21, 2026", for the square's tooltip. */
	label: string;
	tracked: number;
	manual: number;
	/** Hours band, 0 (no time) to 4 — see {@link GRID_BANDS}. */
	level: number;
	/**
	 * How much of the square the manual fill takes from the bottom, 0–100: the day's manual share,
	 * kept at a visible minimum when there is any.
	 */
	manualFill: number;
	/** 1-based grid column and row. */
	column: number;
	row: number;
}

/** A month block: its name, under the grid columns it spans. */
interface IActivityGridMonth {
	key: string;
	label: string;
	column: number;
	span: number;
}

/**
 * The last twelve months, each its own block of week columns with a gap between blocks, so a
 * month reads as a unit. `columns` is the grid's track list: label column, then the blocks.
 */
interface IActivityGrid {
	columns: string;
	/** Week columns across all the month blocks, for the grid's minimum width. */
	weeks: number;
	days: IActivityGridDay[];
	months: IActivityGridMonth[];
	/** The year's hours, tracked and manual, and each on its own. */
	total: number;
	tracked: number;
	manual: number;
	range: string;
}

const PRIORITY_LEVELS = new Set<string>(['urgent', 'high', 'medium', 'low']);

/** Rows the ranked lists keep. */
const LIST_LIMIT = 6;
/** Rows the task list shows before "Show all". */
const TASK_LIMIT = 6;
/** Tasks due within this many days count as due soon. */
const ATTENTION_DAYS = 3;
/** Months the year grid shows, ending with this one. */
const GRID_MONTHS = 12;
/**
 * The year grid's shades, by a day's hours: fixed bands, so a square means the same on every
 * project. Each is the band's lower bound; a day under the first non-zero bound has no time.
 */
const GRID_BANDS = [0, 0.01, 1, 4, 8];

/**
 * A project's quick look, in the right-side drawer of a page's Projects panel: its
 * status, key figures and budget, task progress and what needs attention, its tasks,
 * the hours per day, who worked on it the most and its most worked tasks — then the
 * full read-only record. Each panel loads on its own: a missing permission blanks
 * that panel, never the drawer.
 *
 * The host says whose time the period figures count (`scopeEmployeeIds`): a team's
 * members, or everyone on the project (`null`). Opening, switching and closing are
 * driven by `project`; the period by `rangeStart` / `rangeEnd`.
 */
@Component({
	selector: 'ngx-project-quick-look',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgxPermissionsModule,
		TranslatePipe,
		RecordViewModule,
		EmployeeHoursChartComponent
	],
	templateUrl: './project-quick-look.component.html',
	styleUrls: ['../../../employees/view-employee/view-employee.component.scss', './project-quick-look.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class ProjectQuickLookComponent implements OnChanges {
	/** The card the drawer is open for, kept current by the host; null closes the drawer. */
	@Input() project: IProjectQuickLookCard | null = null;
	@Input() organizationId: string;
	@Input() tenantId: string;
	/** The host's period, as ISO dates. */
	@Input() rangeStart: string;
	@Input() rangeEnd: string;
	/**
	 * Which period the range is, for the period's change: this week is compared with the same days of
	 * last week, this month with the same days of last month, the last 30 days with the 30 before.
	 * Unset, the change compares with the span just before the range.
	 */
	@Input() period: ProjectQuickLookPeriod | null = null;
	/** Whose time the period figures count; `null` for everyone on the project, `[]` for nobody. */
	@Input() scopeEmployeeIds: string[] | null = null;
	/** People the host knows, for contributors' names, photos and presence. */
	@Input() people: IProjectQuickLookPerson[] = [];
	/** A person to pick out among the contributors (the employee whose page it is). */
	@Input() highlightEmployeeId: string | null = null;
	/**
	 * i18n key under "Who worked the most"; takes `{{ range }}`. Unset, it says whose time the
	 * server counts for the viewer: everyone's, or only their own (see `contributorsCaptionKey`).
	 */
	@Input() contributorsCaption: string | null = null;
	/** `drawer` (default) frames the quick look in a right-side drawer; `page` lays it out as a page body. */
	@Input() mode: ProjectQuickLookMode = 'drawer';
	@Output() readonly closed = new EventEmitter<void>();

	/** On a page, the panels lay out in two columns instead of the drawer's one. */
	@HostBinding('class.is-page')
	get isPage(): boolean {
		return this.mode === 'page';
	}

	public readonly PermissionsEnum = PermissionsEnum;
	public readonly taskFilters: ProjectTaskFilter[] = ['open', 'progress', 'overdue', 'done'];
	public readonly taskLimit = TASK_LIMIT;

	public viewedProject: IOrganizationProject | null = null;
	public sections: IRecordViewSection[] = [];
	/** On a page, Details sits in the grid's narrow column; the record view below keeps the rest. */
	public detailsSections: IRecordViewSection[] = [];
	public recordSections: IRecordViewSection[] = [];
	public facts: IProjectFacts | null = null;
	public taskProgress: Loadable<IProjectProgress | null> = loading(null);
	public tasks: ITaskRow[] = [];
	public attention: IAttentionTask[] = [];
	public budget: IProjectBudget | null = null;
	public hours: Loadable<IEmployeeHoursDay[]> = loading([]);
	public contributors: Loadable<IContributorRow[]> = loading([]);
	public topTasks: Loadable<IRankedRow[]> = loading([]);
	public taskFilter: ProjectTaskFilter = 'open';
	public showAllTasks = false;

	/* The project page's own figures and panels (page mode only). */
	/** Seconds tracked on the project since it started, by everyone; null when the caller may not read it. */
	public lifetime: Loadable<number | null> = loading(null);
	/** The previous period's hours, for the period's change. */
	public previousHours: number | null = null;
	public timeline: IProjectTimeline | null = null;
	public modules: Loadable<IModuleRow[]> = loading([]);
	public activityView: ProjectActivityView = 'chart';
	/** The last year of the project's days; read the first time the grid is shown. */
	public activityGrid: Loadable<IActivityGrid | null> = loading(null);
	/** The calendar year the grid shows; null for the last {@link GRID_MONTHS} months. */
	public gridYear: number | null = null;
	/** The index of the grid's day in the tab order; the latest day until another is focused. */
	public gridFocus = 0;
	/** Whether a day of the grid has keyboard focus, to show that day's figures under the grid. */
	public gridHasFocus = false;
	/** Whether the grid holds the current project's and scope's year, so showing it again reads nothing. */
	private _gridRead = false;
	/** Bumped on every read of the grid, so a reply for a year left behind never lands. */
	private _gridSequence = 0;
	/** Each person's seconds on the project in the period, from the contributors' read. */
	private _periodTime = new Map<string, number>();

	/** Bumped on every open, switch and close, so no reply for another project lands. */
	private _projectSequence = 0;
	/** Bumped on every reload of the period figures, so an older reply never lands over a newer one. */
	private _periodSequence = 0;
	/** Bumped on every read of the tasks, so an older read never lands over a newer one. */
	private _tasksSequence = 0;

	constructor(
		private readonly _http: HttpClient,
		private readonly _translate: TranslateService,
		private readonly _timeZoneService: TimeZoneService,
		private readonly _projectsService: OrganizationProjectsService,
		private readonly _statisticsService: TimesheetStatisticsService,
		private readonly _timesheetService: TimesheetService,
		private readonly _store: Store
	) {}

	ngOnChanges(changes: SimpleChanges): void {
		const projectId = this.project?.id || null;
		const previousId = (changes['project']?.previousValue as IProjectQuickLookCard | null)?.id || null;
		if (changes['project'] && projectId !== previousId) {
			if (projectId) this.open(this.project);
			else this.reset();
			return;
		}
		// Same project, another window or scope: only the period figures change.
		if (
			projectId &&
			(changes['rangeStart'] || changes['rangeEnd'] || changes['period'] || changes['scopeEmployeeIds'])
		) {
			this.loadPeriodFigures(projectId);
		}
	}

	close(): void {
		this.closed.emit();
	}

	/** Re-reads the project's tasks, for a host that changed one (the project page's Board). */
	reloadTasks(): void {
		if (this.project?.id) void this.loadProgress(this.project.id, this._projectSequence);
	}

	/* ── View helpers ────────────────────────────────────────────────────── */

	get rangeLabel(): string {
		const start = moment(this.rangeStart);
		const end = moment(this.rangeEnd);
		if (!start.isValid() || !end.isValid()) return '';
		const sameYear = start.year() === end.year();
		return `${start.format(sameYear ? 'MMM D' : 'll')} – ${end.format('ll')}`;
	}

	formatDuration = (seconds: number): string => {
		const total = Math.max(0, Math.round(Number(seconds) || 0));
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		return `${h}h ${m.toString().padStart(2, '0')}m`;
	};

	formatHours = (hours: number): string => this.formatDuration((Number(hours) || 0) * 3600);

	formatPercent(value: number | undefined): string {
		return `${Math.round(Number(value) || 0)}%`;
	}

	/**
	 * The host's caption, else whose time the contributors are: a viewer who may not read
	 * everyone's time on the project gets back only their own, so it must not say "everyone's";
	 * one who may reads the host's scope — a team's members, or everyone on the project.
	 */
	get contributorsCaptionKey(): string {
		if (this.contributorsCaption) return this.contributorsCaption;
		// Rows with anyone else in them already show the wider scope, even before the project's
		// full read (and so its managers) has landed.
		const ownId = this._store.user?.employeeId;
		const showsOthers = (this.contributors.value || []).some((person) => person.id !== ownId);
		if (!showsOthers && (!this.viewedProject || !this.canReadProjectTotal(this.viewedProject))) {
			return 'PROJECT_QUICK_LOOK.YOUR_TIME_CAPTION';
		}
		return this.scopeEmployeeIds
			? 'PROJECT_QUICK_LOOK.TEAM_CONTRIBUTORS_CAPTION'
			: 'PROJECT_QUICK_LOOK.CONTRIBUTORS_CAPTION';
	}

	/** The team's or everyone's hours on the project over the period, tracked and manual. */
	get hoursTotal(): number {
		return (this.hours.value || []).reduce((sum, day) => sum + day.tracked + day.manual, 0);
	}

	/**
	 * The headline's "worked in period": the host's own figure (an employee's or a team's time,
	 * as on its card); without one, the period's total from the daily activity.
	 */
	get workedSeconds(): number {
		const own = this.project?.duration;
		return own !== undefined && own !== null ? own : this.hoursTotal * 3600;
	}

	/** The grid reads the project's year the first time it is shown. */
	setActivityView(view: ProjectActivityView): void {
		this.activityView = view;
		if (view === 'grid' && !this._gridRead) this.readGrid();
	}

	/**
	 * The grid's choices, newest first: the last 12 months (null), then each calendar year from this
	 * one back to the earliest of the project's start, the project's creation and the organization's
	 * creation. The project's dates alone are no bound — its start can be moved later than time already
	 * logged, and an empty year can sit between logged ones — but no time is logged before the
	 * organization existed, so every logged year stays within reach.
	 */
	get gridYears(): (number | null)[] {
		const current = moment().year();
		const years = [
			this.viewedProject?.startDate,
			this.viewedProject?.createdAt,
			this._store.selectedOrganization?.createdAt
		]
			.map((date) => moment(date))
			.filter((date) => date.isValid())
			.map((date) => date.year());
		const first = Math.min(current, ...years, this.gridYear ?? current);
		return [null, ...Array.from({ length: current - first + 1 }, (_, index) => current - index)];
	}

	/** Steps the grid to an older (+1) or newer (-1) choice in {@link gridYears}. */
	stepGridYear(step: 1 | -1): void {
		const years = this.gridYears;
		const next = years[years.indexOf(this.gridYear) + step];
		if (next === undefined) return;
		this.gridYear = next;
		this.readGrid();
	}

	/**
	 * Arrow keys move between days as the grid lays them out — a row is a weekday, so up and down
	 * step a day and left and right a week — and Home and End go to the first and last day. Only
	 * the day in focus is in the tab order, so the grid is one tab stop.
	 */
	onGridDayKeydown(event: KeyboardEvent, index: number): void {
		const count = this.activityGrid.value?.days.length || 0;
		const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
		let next: number;
		if (event.key in steps) next = index + steps[event.key];
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = count - 1;
		else return;
		event.preventDefault();
		next = Math.max(0, Math.min(count - 1, next));
		this.gridFocus = next;
		const grid = (event.currentTarget as HTMLElement).parentElement;
		grid?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus();
	}

	/** Reads the grid for the current project, scope and year. */
	private readGrid(): void {
		if (!this.project?.id) return;
		// An empty scope (a team with nobody on it) has no time: an empty employee filter would read everyone's.
		if (Array.isArray(this.scopeEmployeeIds) && !this.scopeEmployeeIds.length) {
			this.activityGrid = { loading: false, failed: false, value: null };
			this._gridRead = true;
			return;
		}
		const project = this._projectSequence;
		const period = this._periodSequence;
		void this.loadActivityGrid(
			this.project.id,
			() => project === this._projectSequence && period === this._periodSequence
		);
	}

	/** "2h 18m on Wed, Oct 21, 2026 · 1h 48m tracked · 30m manual", or "No time on …". */
	gridDayTooltip(day: IActivityGridDay): string {
		const total = day.tracked + day.manual;
		if (!total) return this._translate.instant('PROJECT_QUICK_LOOK.GRID_DAY_EMPTY', { date: day.label });
		const text = this._translate.instant('PROJECT_QUICK_LOOK.GRID_DAY', {
			time: this.formatHours(total),
			date: day.label
		});
		if (!day.manual) return text;
		const part = (hours: number, key: string) =>
			`${this.formatHours(hours)} ${this._translate.instant(key).toLowerCase()}`;
		return [
			text,
			...(day.tracked ? [part(day.tracked, 'EMPLOYEES_PAGE.VIEW.TRACKED')] : []),
			part(day.manual, 'EMPLOYEES_PAGE.VIEW.MANUAL')
		].join(' · ');
	}

	/** The legend's bands: "No time", "< 1h", "1–4h", "4–8h", "8h+". */
	get gridBands(): { level: number; label: string }[] {
		return GRID_BANDS.map((from, level) => {
			const to = GRID_BANDS[level + 1];
			const label = !level
				? this._translate.instant('PROJECT_QUICK_LOOK.GRID_NONE')
				: level === 1
					? `< ${to}h`
					: to
						? `${from}–${to}h`
						: `${from}h+`;
			return { level, label };
		});
	}

	/** Every weekday's short name down the grid's side, in the locale's week order. */
	get gridWeekdays(): string[] {
		const first = moment.localeData().firstDayOfWeek();
		return Array.from({ length: 7 }, (_, row) =>
			moment()
				.day((first + row) % 7)
				.format('dd')
		);
	}

	taskCount(filter: ProjectTaskFilter): number {
		return this.filterTasks(filter).length;
	}

	get filteredTasks(): ITaskRow[] {
		return this.filterTasks(this.taskFilter);
	}

	get visibleTasks(): ITaskRow[] {
		const rows = this.filteredTasks;
		return this.showAllTasks ? rows : rows.slice(0, TASK_LIMIT);
	}

	setTaskFilter(filter: ProjectTaskFilter): void {
		this.taskFilter = filter;
		this.showAllTasks = false;
	}

	/** "Ann B., Carl D." — the people behind a "+N" chip. */
	peopleNames(people: ITaskPerson[]): string {
		return (people || []).map((person) => person.name).join(', ');
	}

	taskLink(id: string): string[] {
		return ['/pages/tasks/view', id];
	}

	projectEditLink(id: string): string[] {
		return ['/pages/organization/projects', id, 'edit'];
	}

	/* ── Opening ─────────────────────────────────────────────────────────── */

	/**
	 * Opens at once with the card's name and logo, then fills in from the project's
	 * full read; a failed read (e.g. no permission to view projects) keeps the card's.
	 */
	private async open(card: IProjectQuickLookCard): Promise<void> {
		const sequence = ++this._projectSequence;
		this.attention = [];
		this.budget = null;
		this.tasks = [];
		// Another project's figures never show under this one's name while its own load.
		this.hours = loading([]);
		this.contributors = loading([]);
		this.topTasks = loading([]);
		this.taskFilter = 'open';
		this.showAllTasks = false;
		this.lifetime = loading(null);
		this.previousHours = null;
		this.modules = loading([]);
		this.activityGrid = loading(null);
		this.gridYear = null;
		this._gridRead = false;
		this._periodTime = new Map();
		this.show({ id: card.id, name: card.name, imageUrl: card.imageUrl } as IOrganizationProject);
		void this.loadProgress(card.id, sequence);
		this.loadPeriodFigures(card.id);
		if (this.isPage) void this.loadModules(card.id, sequence);
		try {
			const project = await firstValueFrom(this._projectsService.getById(card.id, PROJECT_VIEW_RELATIONS));
			if (sequence === this._projectSequence && project) {
				this.show(project);
				void this.loadLifetime(project, sequence);
			}
		} catch {
			// The card's own data stays on screen.
		}
	}

	private reset(): void {
		this._projectSequence++;
		this._periodSequence++;
		this.viewedProject = null;
		this.facts = null;
	}

	private show(project: IOrganizationProject): void {
		this.viewedProject = project;
		this.facts = this.toFacts(project);
		this.timeline = this.toTimeline(project);
		this.buildSections();
	}

	/**
	 * The record's sections. On the page, Details leaves out a field only while the headline shows it:
	 * billing and currency while the billing figure stands in for an hours budget, the budget while the
	 * budget bar or the cost budget under the billing figure shows it.
	 */
	private buildSections(): void {
		const project = this.viewedProject;
		if (!project) return;
		this.sections = buildProjectViewSections(
			project,
			{ translate: (key) => this._translate.instant(key) },
			{
				page: this.isPage,
				billingInHeadline: this.isPage && !this.budget,
				budgetInHeadline: this.isPage && (!!this.budget || !!this.costBudget)
			}
		);
		this.detailsSections = this.sections.filter((section) => section.title === 'BUTTONS.DETAILS');
		this.recordSections = this.sections.filter((section) => section.title !== 'BUTTONS.DETAILS');
	}

	/** Status line and key figures; a finished project's end date is no longer a deadline. */
	private toFacts(project: IOrganizationProject): IProjectFacts {
		const isFinished = [ProjectStatusEnum.COMPLETED, ProjectStatusEnum.CANCELLED].includes(project.status);
		const daysLeft = project.endDate
			? moment(project.endDate).startOf('day').diff(moment().startOf('day'), 'days')
			: null;
		return {
			status: projectStatusOf(project),
			isPublic: project.public,
			client: project.organizationContact?.name,
			members: project.members ? project.members.filter((member) => !!member?.employee).length : null,
			endDate: project.endDate ? moment(project.endDate).format('ll') : undefined,
			due: daysLeft === null || isFinished ? null : dueInWords(daysLeft, false),
			overdue: !isFinished && daysLeft !== null && daysLeft < 0
		};
	}

	/** Start → end, how far through it the project is, and what is left; a finished project says so. */
	private toTimeline(project: IOrganizationProject): IProjectTimeline | null {
		if (!project.startDate && !project.endDate) return null;
		const today = moment().startOf('day');
		const start = project.startDate ? moment(project.startDate).startOf('day') : null;
		const end = project.endDate ? moment(project.endDate).startOf('day') : null;
		const isFinished = [ProjectStatusEnum.COMPLETED, ProjectStatusEnum.CANCELLED].includes(project.status);
		let percent: number | null = null;
		if (start && end && end.isAfter(start)) {
			percent = Math.min(100, Math.max(0, (today.diff(start, 'days') / end.diff(start, 'days')) * 100));
		}
		let hint: IProjectTimeline['hint'] = null;
		let tone: IProjectTimeline['tone'] = null;
		if (isFinished) {
			hint = { key: 'PROJECT_QUICK_LOOK.FINISHED' };
			tone = 'success';
			percent = percent === null ? null : 100;
		} else if (start && today.isBefore(start)) {
			const daysToStart = start.diff(today, 'days');
			hint =
				daysToStart === 1
					? { key: 'PROJECT_QUICK_LOOK.STARTS_TOMORROW' }
					: { key: 'PROJECT_QUICK_LOOK.STARTS_IN', count: daysToStart };
		} else if (end) {
			const daysLeft = end.diff(today, 'days');
			hint = dueInWords(daysLeft, false);
			tone = daysLeft < 0 ? 'danger' : null;
		}
		return {
			start: start ? start.format('ll') : undefined,
			end: end ? end.format('ll') : undefined,
			percent,
			hint,
			tone
		};
	}

	/**
	 * The project page's Team panel: managers first, then by name, each with their live
	 * presence and their time on the project in the period.
	 */
	get team(): ITeamMemberRow[] {
		const figuresLanded = !this.contributors.loading && !this.contributors.failed;
		// A viewer who may not read everyone's time gets back only their own: the others' is unknown, not zero.
		const readsEveryone = !!this.viewedProject && this.canReadProjectTotal(this.viewedProject);
		const ownId = this._store.user?.employeeId;
		return (this.viewedProject?.members || [])
			.filter((member) => !!member?.employee && member.isActive !== false && member.isArchived !== true)
			.map((member) => {
				const employee = member.employee as IEmployee;
				const name = nameOf(employee);
				return {
					id: employee.id,
					name,
					initials: initialsOf(name),
					avatarUrl: employee.user?.image?.fullUrl || employee.user?.imageUrl || undefined,
					isManager: !!member.isManager,
					presence: presenceOf(employee),
					duration:
						figuresLanded && (readsEveryone || employee.id === ownId)
							? this._periodTime.get(employee.id) || 0
							: null
				};
			})
			.filter((row) => !!row.name)
			.sort((a, b) => Number(b.isManager) - Number(a.isManager) || a.name.localeCompare(b.name));
	}

	/** The period's hours against the previous period's; null until both are known, or with nothing before. */
	get periodDelta(): IPeriodDelta | null {
		const before = this.previousHours;
		if (before === null || this.hours.loading || this.hours.failed || !before) return null;
		const percent = Math.round(((this.hoursTotal - before) / before) * 100);
		const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
		return { percent: Math.abs(percent), direction };
	}

	/** "Rate · USD": how the project bills, for the page's fourth figure when it has no hours budget. */
	get billing(): string | null {
		const project = this.viewedProject;
		if (!project) return null;
		const parts = [humanize(project.billing), project.currency].filter(Boolean);
		return parts.length ? parts.join(' · ') : null;
	}

	/** A cost budget, as the form sets it ("1,000 USD"), under the billing figure. */
	get costBudget(): string | null {
		const project = this.viewedProject;
		if (!project || project.budgetType !== OrganizationProjectBudgetTypeEnum.COST || !project.budget) return null;
		return [Number(project.budget).toLocaleString(), project.currency].filter(Boolean).join(' ');
	}

	/* ── Tasks: progress, attention and the list, from one read ───────────── */

	private async loadProgress(projectId: string, sequence: number): Promise<void> {
		const read = ++this._tasksSequence;
		this.taskProgress = loading(null);
		try {
			const result = await firstValueFrom(
				this._http.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, {
					params: toParams({
						where: { organizationId: this.organizationId, tenantId: this.tenantId, projectId },
						relations: ['taskStatus', 'taskPriority', 'members', 'members.user']
					})
				})
			);
			if (sequence !== this._projectSequence || read !== this._tasksSequence) return;
			const items = result?.items || [];
			this.tasks = this.toTaskRows(items);
			this.attention = this.toAttention(items);
			// Counted from the rows, so Progress and the task list always agree.
			const done = this.tasks.filter((row) => row.statusGroup === 'done').length;
			const progress = this.tasks.filter((row) => row.statusGroup === 'progress').length;
			this.taskProgress = {
				loading: false,
				failed: false,
				value: {
					total: items.length,
					done,
					progress,
					todo: items.length - done - progress,
					percent: items.length ? (done / items.length) * 100 : 0
				}
			};
		} catch {
			if (sequence === this._projectSequence && read === this._tasksSequence) {
				this.taskProgress = { loading: false, failed: true, value: null };
			}
		}
	}

	/** Open hides done tasks; Done lists the most recently finished first. */
	private filterTasks(filter: ProjectTaskFilter): ITaskRow[] {
		switch (filter) {
			case 'progress':
				return this.tasks.filter((row) => row.statusGroup === 'progress');
			case 'overdue':
				return this.tasks.filter((row) => row.overdue);
			case 'done':
				return this.tasks.filter((row) => row.statusGroup === 'done').sort((a, b) => b.doneTime - a.doneTime);
			case 'open':
			default:
				return this.tasks.filter((row) => row.statusGroup !== 'done');
		}
	}

	/** Overdue first, then soonest due; undated last. */
	private toTaskRows(tasks: ITask[]): ITaskRow[] {
		const today = moment().startOf('day');
		return tasks
			.map((task) => this.toTaskRow(task, today))
			.sort(
				(a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueTime === b.dueTime ? 0 : a.dueTime - b.dueTime)
			);
	}

	private toTaskRow(task: ITask, today: moment.Moment): ITaskRow {
		// Finished by the task views' own rule (a tenant status's `isDone` flag included).
		const statusGroup = isTaskFinished(task) ? 'done' : statusGroupOf(task.status);
		const isDone = statusGroup === 'done';
		const daysLeft = task.dueDate ? moment(task.dueDate).startOf('day').diff(today, 'days') : null;
		const people = (task.members || [])
			.map((member: IEmployee) => {
				const name = nameOf(member);
				return {
					id: member.id,
					name,
					initials: initialsOf(name),
					avatarUrl: member.user?.image?.fullUrl || member.user?.imageUrl || undefined
				};
			})
			.filter((person) => !!person.name);
		const priority = (task.taskPriority?.name || task.priority || '').toLowerCase();
		return {
			id: task.id,
			key: task.prefix && task.number ? `${task.prefix}-${task.number}` : '',
			title: task.title,
			status: task.taskStatus?.name || humanize(task.status) || '',
			statusGroup,
			statusColor: task.taskStatus?.color || undefined,
			dueDate: task.dueDate ? moment(task.dueDate).format('ll') : undefined,
			dueDateLong: task.dueDate ? moment(task.dueDate).format('dddd, LL') : undefined,
			due: dueInWords(daysLeft, isDone),
			dueTime: task.dueDate ? moment(task.dueDate).valueOf() : Infinity,
			doneTime: moment(task.resolvedAt || task.updatedAt || 0).valueOf(),
			overdue: !isDone && daysLeft !== null && daysLeft < 0,
			priority: task.taskPriority?.name || humanize(task.priority) || undefined,
			priorityLevel: PRIORITY_LEVELS.has(priority) ? (priority as ITaskRow['priorityLevel']) : undefined,
			people,
			morePeople: people.slice(3)
		};
	}

	/** Overdue first, then soonest due: open tasks past due or due within a few days. */
	private toAttention(tasks: ITask[]): IAttentionTask[] {
		const today = moment().startOf('day');
		return tasks
			.filter((task) => !!task.dueDate && !isTaskFinished(task))
			.map((task) => ({ task, daysLeft: moment(task.dueDate).startOf('day').diff(today, 'days') }))
			.filter(({ daysLeft }) => daysLeft <= ATTENTION_DAYS)
			.sort((a, b) => a.daysLeft - b.daysLeft)
			.slice(0, LIST_LIMIT)
			.map(({ task, daysLeft }) => ({
				id: task.id,
				title: task.title,
				due: dueInWords(daysLeft, false),
				overdue: daysLeft < 0
			}));
	}

	/* ── Budget ──────────────────────────────────────────────────────────── */

	/**
	 * All the time worked on the project since it started, by anyone: the project page's
	 * "total tracked", and what an hours budget is measured against. A cost budget needs
	 * rates, so it is left to the billing figure and the Details row.
	 */
	private async loadLifetime(project: IOrganizationProject, sequence: number): Promise<void> {
		const budgetHours = Number(project.budget) || 0;
		const hasHoursBudget = project.budgetType === OrganizationProjectBudgetTypeEnum.HOURS && budgetHours > 0;
		// A caller who would get back only their own time has no project-wide total to show.
		if (!this.canReadProjectTotal(project)) {
			this.lifetime = { loading: false, failed: true, value: null };
			return;
		}
		// The drawer shows no lifetime total: it reads it only for an hours budget.
		if (!this.isPage && !hasHoursBudget) return;
		const timeZone = this._timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');
		try {
			const rows = await this._statisticsService.getProjects({
				tenantId: this.tenantId,
				organizationId: this.organizationId,
				projectIds: [project.id],
				startDate: format(moment(project.startDate || project.createdAt).startOf('day')),
				endDate: format(moment().endOf('day'))
			});
			if (sequence !== this._projectSequence) return;
			const seconds = (rows || []).find((row) => row.id === project.id)?.duration || 0;
			this.lifetime = { loading: false, failed: false, value: Number(seconds) || 0 };
			if (!hasHoursBudget) return;
			const usedHours = Number(seconds) / 3600;
			const used = (usedHours / budgetHours) * 100;
			this.budget = {
				usedHours,
				budgetHours,
				percent: Math.min(100, used),
				over: used > 100,
				warning: used >= 80
			};
			// The budget bar now stands in for Details' budget, and billing is back in Details.
			this.buildSections();
		} catch {
			// No total and no budget bar; the Details panel (in the drawer) still lists the budget.
			if (sequence === this._projectSequence) this.lifetime = { loading: false, failed: true, value: null };
		}
	}

	/** The project page's Modules panel: each module with its status, dates and task count. */
	private async loadModules(projectId: string, sequence: number): Promise<void> {
		this.modules = loading([]);
		try {
			const result = await firstValueFrom(
				this._http.get<IPagination<IOrganizationProjectModule>>(`${API_PREFIX}/organization-project-modules`, {
					params: toParams({
						where: { organizationId: this.organizationId, tenantId: this.tenantId, projectId },
						relations: ['tasks']
					})
				})
			);
			if (sequence !== this._projectSequence) return;
			const rows = (result?.items || [])
				.filter((module) => !!module?.name)
				.map((module) => this.toModuleRow(module))
				.sort((a, b) => a.name.localeCompare(b.name));
			this.modules = { loading: false, failed: false, value: rows };
		} catch {
			// Without permission to read modules, the panel is left out.
			if (sequence === this._projectSequence) this.modules = { loading: false, failed: true, value: [] };
		}
	}

	private toModuleRow(module: IOrganizationProjectModule): IModuleRow {
		const toneOf: Record<string, IModuleRow['tone']> = {
			[ProjectModuleStatusEnum.COMPLETED]: 'success',
			[ProjectModuleStatusEnum.IN_PROGRESS]: 'info',
			[ProjectModuleStatusEnum.CANCELLED]: 'danger',
			[ProjectModuleStatusEnum.PAUSED]: 'warning'
		};
		const start = module.startDate ? moment(module.startDate).format('ll') : null;
		const end = module.endDate ? moment(module.endDate).format('ll') : null;
		return {
			id: module.id,
			name: module.name,
			status: humanize(module.status) || '',
			tone: toneOf[module.status] || 'basic',
			dates: start || end ? [start || '…', end || '…'].join(' – ') : undefined,
			tasks: (module.tasks || []).length
		};
	}

	/**
	 * Whether the project statistics read counts everyone's time, as the server scopes it
	 * (ManagedEmployeeService.filterAccessibleEmployeeIds): anyone may be selected, an
	 * organization-wide viewer with no employee record, or a manager of this project.
	 * Anyone else gets back only their own time.
	 */
	private canReadProjectTotal(project: IOrganizationProject): boolean {
		if (this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) return true;
		const employeeId = this._store.user?.employeeId;
		if (!employeeId) return this._store.hasPermission(PermissionsEnum.ALL_ORG_VIEW);
		// Only a membership still in effect, as the server reads it: an unset flag counts as active, not archived.
		return (project.members || []).some(
			(member) =>
				member.isManager &&
				member.isActive !== false &&
				member.isArchived !== true &&
				(member.employeeId || member.employee?.id) === employeeId
		);
	}

	/* ── Period figures ──────────────────────────────────────────────────── */

	/**
	 * Contributors, hours per day and top tasks over the period. Each reload takes its
	 * own token: a reply counts only while both the project and this reload are still
	 * the latest, so a slow reply for an earlier period is dropped.
	 */
	private loadPeriodFigures(projectId: string): void {
		const project = this._projectSequence;
		const period = ++this._periodSequence;
		const isCurrent = () => project === this._projectSequence && period === this._periodSequence;
		// An empty scope (a team with nobody on it) has no figures: an empty employee
		// filter would read everyone instead.
		if (Array.isArray(this.scopeEmployeeIds) && !this.scopeEmployeeIds.length) {
			this.hours = { loading: false, failed: false, value: [] };
			this.contributors = { loading: false, failed: false, value: [] };
			this.topTasks = { loading: false, failed: false, value: [] };
			this.activityGrid = { loading: false, failed: false, value: null };
			this._gridRead = true;
			return;
		}
		const request = { ...this.buildRequest(), projectIds: [projectId] };
		void this.loadHours(request, isCurrent);
		void this.loadContributors(request, isCurrent);
		void this.loadTopTasks(request, isCurrent);
		if (this.isPage) void this.loadPreviousHours(projectId, isCurrent);
		// The grid's year is the scope's, not the period's: a shown grid reads it again, a hidden one on showing.
		this._gridRead = false;
		if (this.isPage && this.activityView === 'grid') void this.loadActivityGrid(projectId, isCurrent);
	}

	/**
	 * The project's days for the year grid — the last {@link GRID_MONTHS} months through today, or the
	 * chosen calendar year through its end or today — each month a block of week columns, each day
	 * shaded by its hours band ({@link GRID_BANDS}).
	 */
	private async loadActivityGrid(projectId: string, isLatest: () => boolean): Promise<void> {
		this._gridRead = true;
		const sequence = ++this._gridSequence;
		const isCurrent = () => isLatest() && sequence === this._gridSequence;
		this.activityGrid = { ...this.activityGrid, loading: true, failed: false };
		const today = moment().startOf('day');
		const year = this.gridYear;
		const start =
			year === null
				? today
						.clone()
						.startOf('month')
						.subtract(GRID_MONTHS - 1, 'months')
				: moment({ year, month: 0, day: 1 });
		// A calendar year lays out all twelve months, so its squares match the last 12 months'; days to come stay blank.
		const layoutEnd = year === null ? today : moment({ year, month: 11, day: 31 });
		const end = moment.min(layoutEnd, today);
		const timeZone = this._timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');
		try {
			const rows = await this._timesheetService.getDailyReportChart({
				...this.buildRequest(),
				projectIds: [projectId],
				startDate: format(start),
				endDate: format(end.clone().endOf('day'))
			});
			if (!isCurrent()) return;
			const byDay = new Map<string, { tracked: number; manual: number }>(
				(Array.isArray(rows) ? rows : []).map((row: any) => [
					moment(row.date).format('YYYY-MM-DD'),
					{
						tracked:
							(Number(row.value?.[TimeLogType.TRACKED]) || 0) +
							(Number(row.value?.[TimeLogType.RESUMED]) || 0),
						manual: Number(row.value?.[TimeLogType.MANUAL]) || 0
					}
				])
			);
			const firstWeekday = moment.localeData().firstDayOfWeek();
			const rowOf = (date: moment.Moment) => ((date.day() - firstWeekday + 7) % 7) + 1;
			// Column 1 holds the weekday names; each month's weeks follow, a spacer track between months.
			// `columns` counts grid columns so far: a `repeat(n, …)` track entry is n of them.
			const tracks: string[] = ['auto'];
			let columns = 1;
			const days: IActivityGridDay[] = [];
			const months: IActivityGridMonth[] = [];
			let tracked = 0;
			let manual = 0;
			for (let month = start.clone(); month.isSameOrBefore(layoutEnd, 'month'); month.add(1, 'month')) {
				const first = month.clone().startOf('month');
				const last = moment.min(month.clone().endOf('month').startOf('day'), layoutEnd);
				const weeks = last.clone().startOf('week').diff(first.clone().startOf('week'), 'weeks') + 1;
				if (months.length) {
					tracks.push('var(--grid-month-gap)');
					columns++;
				}
				const column = columns + 1;
				tracks.push(`repeat(${weeks}, minmax(0, 1fr))`);
				columns += weeks;
				months.push({ key: first.format('YYYY-MM'), label: first.format('MMM'), column, span: weeks });
				for (let date = first.clone(); date.isSameOrBefore(moment.min(last, end), 'day'); date.add(1, 'day')) {
					const key = date.format('YYYY-MM-DD');
					const hours = byDay.get(key) || { tracked: 0, manual: 0 };
					const sum = hours.tracked + hours.manual;
					tracked += hours.tracked;
					manual += hours.manual;
					days.push({
						key,
						label: date.format('ddd, ll'),
						...hours,
						level: GRID_BANDS.reduce((level, from, band) => (band && sum >= from ? band : level), 0),
						manualFill: hours.manual ? Math.max(25, Math.round((hours.manual / sum) * 100)) : 0,
						column: column + date.clone().startOf('week').diff(first.clone().startOf('week'), 'weeks'),
						row: rowOf(date)
					});
				}
			}
			this.gridFocus = days.length - 1;
			this.activityGrid = {
				loading: false,
				failed: false,
				value: {
					columns: tracks.join(' '),
					weeks: columns - 1 - (months.length - 1),
					days,
					months,
					total: tracked + manual,
					tracked,
					manual,
					range: `${start.format('ll')} – ${end.format('ll')}`
				}
			};
		} catch {
			if (isCurrent()) this.activityGrid = { loading: false, failed: true, value: null };
		}
	}

	/**
	 * The hours of the same span of the previous period, cut at the same point: on a Wednesday, this
	 * week so far against last week up to Wednesday; on the 10th, this month so far against last
	 * month up to the 10th; the last 30 days against the 30 before — as the team page compares.
	 * Without a known period, the span just before the range, as long as the part that has passed.
	 * Read the same way as the period's own hours (the daily chart), so the two compare like for like.
	 */
	private async loadPreviousHours(projectId: string, isCurrent: () => boolean): Promise<void> {
		this.previousHours = null;
		const start = moment(this.rangeStart);
		const end = moment(this.rangeEnd);
		if (!start.isValid() || !end.isValid()) return;
		const cut = moment.max(start, moment.min(end, moment()));
		const shift = (date: moment.Moment): moment.Moment | null => {
			switch (this.period) {
				case 'THIS_WEEK':
					return date.clone().subtract(1, 'week');
				case 'THIS_MONTH':
					return date.clone().subtract(1, 'month');
				case 'LAST_30_DAYS':
					return date.clone().subtract(30, 'days');
				default:
					return null;
			}
		};
		let previousStart = shift(start);
		let previousEnd = shift(cut);
		if (!previousStart || !previousEnd) {
			previousEnd = start.clone().subtract(1, 'millisecond');
			previousStart = previousEnd.clone().subtract(cut.diff(start), 'milliseconds');
		}
		const timeZone = this._timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');
		try {
			const rows = await this._timesheetService.getDailyReportChart({
				...this.buildRequest(),
				projectIds: [projectId],
				startDate: format(previousStart),
				endDate: format(previousEnd)
			});
			if (!isCurrent()) return;
			this.previousHours = this.toHoursDays(rows).reduce((sum, day) => sum + day.tracked + day.manual, 0);
		} catch {
			// No change shown.
		}
	}

	private async loadHours(request: ITimeLogFilters & ITimeLogTodayFilters, isCurrent: () => boolean): Promise<void> {
		this.hours = { ...this.hours, loading: true, failed: false };
		try {
			const rows = await this._timesheetService.getDailyReportChart(request);
			if (!isCurrent()) return;
			this.hours = { loading: false, failed: false, value: this.toHoursDays(rows) };
		} catch {
			if (isCurrent()) this.hours = { loading: false, failed: true, value: [] };
		}
	}

	private async loadTopTasks(
		request: ITimeLogFilters & ITimeLogTodayFilters,
		isCurrent: () => boolean
	): Promise<void> {
		this.topTasks = { ...this.topTasks, loading: true, failed: false };
		try {
			const rows = await this._statisticsService.getTasksStatistics(request);
			if (!isCurrent()) return;
			this.topTasks = {
				loading: false,
				failed: false,
				value: this.rank(
					(rows || []).map((task: ITasksStatistics) => ({
						id: task.id,
						name: task.title,
						duration: Number(task.duration) || 0
					})),
					5
				)
			};
		} catch {
			if (isCurrent()) this.topTasks = { loading: false, failed: true, value: [] };
		}
	}

	private async loadContributors(
		request: ITimeLogFilters & ITimeLogTodayFilters,
		isCurrent: () => boolean
	): Promise<void> {
		this.contributors = { ...this.contributors, loading: true, failed: false };
		try {
			const rows = await this._statisticsService.getMembers(request);
			if (!isCurrent()) return;
			this._periodTime = new Map(
				(rows || []).map((row: IMembersStatistics) => [row.id, Number(row.weekTime?.duration) || 0])
			);
			const known = new Map((this.people || []).map((person) => [person.id, person]));
			const stats = new Map((rows || []).map((row: IMembersStatistics) => [row.id, row]));
			const ranked = this.rank(
				(rows || []).map((row: IMembersStatistics) => ({
					id: row.id,
					name: known.get(row.id)?.name || row.user?.name,
					duration: Number(row.weekTime?.duration) || 0
				}))
			);
			this.contributors = {
				loading: false,
				failed: false,
				value: ranked.map((row) => {
					const person = known.get(row.id);
					const weekTime = stats.get(row.id)?.weekTime;
					return {
						...row,
						initials: person?.initials || initialsOf(row.name),
						avatarUrl: person?.avatarUrl || stats.get(row.id)?.user?.imageUrl || undefined,
						activity: weekTime ? Number(weekTime.overall) || 0 : undefined,
						presence: person?.presence
					};
				})
			};
		} catch {
			if (isCurrent()) this.contributors = { loading: false, failed: true, value: [] };
		}
	}

	/** The host's window as the statistics endpoints expect it, over the chosen scope. */
	private buildRequest(): ITimeLogFilters & ITimeLogTodayFilters {
		const timeZone = this._timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');
		return {
			tenantId: this.tenantId,
			organizationId: this.organizationId,
			employeeIds: this.scopeEmployeeIds || [],
			startDate: format(moment(this.rangeStart)),
			endDate: format(moment(this.rangeEnd)),
			todayStart: format(moment().startOf('day')),
			todayEnd: format(moment().endOf('day')),
			timeZone
		};
	}

	/** Daily-chart rows -> the chart's days; a week reads by weekday, longer windows by date. */
	private toHoursDays(rows: any): IEmployeeHoursDay[] {
		const days = moment(this.rangeEnd).diff(moment(this.rangeStart), 'days');
		const format = days <= 7 ? 'ddd D' : 'D MMM';
		return (Array.isArray(rows) ? rows : []).map((row: any) => ({
			label: moment(row.date).format(format),
			tracked: (Number(row.value?.[TimeLogType.TRACKED]) || 0) + (Number(row.value?.[TimeLogType.RESUMED]) || 0),
			manual: Number(row.value?.[TimeLogType.MANUAL]) || 0
		}));
	}

	/** Most first, with each row's share of the total and bar against the largest. */
	private rank(items: { id: string; name: string; duration: number }[], limit = LIST_LIMIT): IRankedRow[] {
		const all = items.filter((row) => row.duration > 0 && !!row.name).sort((a, b) => b.duration - a.duration);
		const total = all.reduce((sum, row) => sum + row.duration, 0) || 1;
		const max = all[0]?.duration || 1;
		return all.slice(0, limit).map((row) => ({
			...row,
			share: (row.duration / total) * 100,
			width: Math.max(2, (row.duration / max) * 100)
		}));
	}
}
