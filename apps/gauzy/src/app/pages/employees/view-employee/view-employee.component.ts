import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, timer } from 'rxjs';
import { debounceTime, filter, map, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import {
	IActivitiesStatistics,
	ICountsStatistics,
	IEmployee,
	IOrganizationProject,
	IProjectsStatistics,
	ITask,
	ITasksStatistics,
	ITimeLogFilters,
	ITimeLogTodayFilters,
	ITimeSlot,
	PermissionsEnum,
	TaskStatusEnum,
	TimeFormatEnum,
	TimeLogType
} from '@gauzy/contracts';
import { toUtcOffset } from '@gauzy/ui-core/common';
import {
	OrganizationProjectsService,
	Store,
	TasksService,
	TimesheetService,
	TimesheetStatisticsService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { HashNumberPipe, IRecordViewSection, IRecordViewStatus, TimeZoneService } from '@gauzy/ui-core/shared';
import { IEmployeeHoursDay } from './employee-hours-chart/employee-hours-chart.component';
import { AssigneePopoverKeyboard } from './assignee-popover-keyboard';
import {
	buildTaskViewSections,
	taskStatusOf,
	TASK_VIEW_RELATIONS
} from '../../tasks/components/task-view/task-view-sections';

/** The date windows the overview can be read over. */
export enum EmployeeViewPeriod {
	THIS_WEEK = 'THIS_WEEK',
	THIS_MONTH = 'THIS_MONTH',
	LAST_30_DAYS = 'LAST_30_DAYS'
}

export type EmployeeViewTab = 'overview' | 'profile';

/** One row of a ranked table (projects, tasks, apps): a name and its time in the period. */
interface IRankedRow {
	id: string;
	name: string;
	meta?: string;
	duration: number;
	/** Share of the period's total, 0–100. */
	share: number;
	/** Bar length, 0–100, relative to the largest row so the longest bar fills the track. */
	width: number;
}

/** An assignee, as their avatar and its hover card show them. */
interface ITaskPerson {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
	email?: string;
	/** Live presence, as the dot on the card's photo and the line under the name. */
	presence: 'tracking' | 'online' | 'away' | 'offline';
	/** Their short description, from the profile. */
	bio?: string;
	/** "Oct 12, 2025": when they started working, if set. */
	since?: string;
}

/** A task as the Assigned tasks table lists it. */
interface IAssignedTaskRow {
	/** The task as the list loaded it — what the quick look opens with before its full read lands. */
	task: ITask;
	id: string;
	key: string;
	title: string;
	project?: string;
	status: string;
	statusGroup: 'todo' | 'progress' | 'blocked' | 'done';
	priority?: string;
	priorityLevel?: 'urgent' | 'high' | 'medium' | 'low';
	/** The due date in full, for the tooltip. */
	dueDate?: string;
	/** The due date in words: an i18n key and its count ("3 days overdue", "Due today"). */
	due: { key: string; count?: number };
	/** Due date as a timestamp, for sorting; Infinity when there is none. */
	dueTime: number;
	/** When it was finished, for ordering the Done view newest first. */
	doneTime: number;
	overdue: boolean;
	/** Assignees as avatars; the first few are drawn, the rest counted. */
	people: ITaskPerson[];
	/** The assignees behind the "+N" avatar, listed when it is hovered. */
	morePeople: ITaskPerson[];
	/** The due date written out in full (weekday included), for its tooltip. */
	dueDateLong?: string;
}

/** One project on the Overview: an assigned project and its time in the period. */
interface IProjectOverviewRow {
	id: string;
	name: string;
	imageUrl?: string;
	initials: string;
	duration: number;
	share: number;
	width: number;
	/**
	 * Whether they are a member of it; null when the membership list could not
	 * be read, so no card is wrongly marked as outside their projects.
	 */
	member: boolean | null;
}

/** The Projects panel's data: every project's total, and the projects they belong to. */
interface IProjectsPanel {
	stats: IRankedRow[];
	/** Null when the membership request failed — membership is then unknown. */
	assigned: IOrganizationProject[] | null;
}

/** The views of the Assigned tasks table, each with its count on the tab. */
export type TaskFilter = 'open' | 'progress' | 'overdue' | 'done';

/** Change against the same span of the previous period. */
interface IDelta {
	/** Rounded percentage change; null when there is nothing to compare against. */
	percent: number | null;
	direction: 'up' | 'down' | 'flat';
}

/** One label/value line on the Profile tab. */
interface IProfileField {
	label: string;
	value?: string;
	href?: string;
	icon?: string;
}

/** The Profile tab, formatted and with every empty value already dropped. */
interface IEmployeeProfile {
	shortDescription?: string;
	description?: string;
	employment: IProfileField[];
	rates: IProfileField[];
	contact: IProfileField[];
	/** Postal address, one line per entry. */
	address: string[];
	socials: (IProfileField & { href: string })[];
	skills: { name?: string; color?: string }[];
	tags: { name?: string; color?: string }[];
}

/** Each request either lands or fails on its own; a failure (most often a 403) only blanks its panel. */
type Loadable<T> = { loading: boolean; failed: boolean; value: T };

const Loadable = {
	empty<T>(value: T): Loadable<T> {
		return { loading: true, failed: false, value };
	}
};

type PanelKey = 'counts' | 'previousCounts' | 'hours' | 'projects' | 'topTasks' | 'apps' | 'tasks' | 'screenshots';

const CLOSED_STATUSES = new Set<string>([TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED]);
const IN_PROGRESS_STATUSES = new Set<string>([
	TaskStatusEnum.IN_PROGRESS,
	TaskStatusEnum.READY_FOR_REVIEW,
	TaskStatusEnum.IN_REVIEW
]);
const PRIORITY_LEVELS = new Set<string>(['urgent', 'high', 'medium', 'low']);

type TaskSummary = { open: number; todo: number; progress: number; blocked: number; overdue: number; done: number };
type HoursSummary = { total: number; average: number };

/** How many rows a ranked table shows. */
const LIST_LIMIT = 6;
/** How many rows the Assigned tasks table shows per view. */
const TASK_LIMIT = 8;
/** The project statistics endpoint keeps its five most-worked projects: ask for at most that many at once. */
const PROJECT_STATS_GROUP = 5;

/**
 * Employee page, modelled on the member page of time-tracking tools such as
 * Hubstaff: a profile header (presence, local time, contract facts), then an
 * Overview tab — the period's summary against the previous period, hours per
 * day, projects, recent screenshots, assigned work, apps — and a Profile tab
 * holding the full read-only record.
 *
 * Every figure is scoped to one employee and one period. Each panel loads on
 * its own, so a missing permission blanks that panel rather than the page.
 * Nothing here edits: Edit links to the existing edit page, behind its own
 * permission.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view-employee',
	templateUrl: './view-employee.component.html',
	styleUrls: ['./view-employee.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ViewEmployeeComponent extends TranslationBaseComponent implements OnInit {
	public readonly PermissionsEnum = PermissionsEnum;
	public readonly periods: EmployeeViewPeriod[] = Object.values(EmployeeViewPeriod);

	public employee: IEmployee;
	public profile: IEmployeeProfile;
	public tab: EmployeeViewTab = 'overview';

	public readonly period$ = new BehaviorSubject<EmployeeViewPeriod>(EmployeeViewPeriod.THIS_WEEK);
	public get period(): EmployeeViewPeriod {
		return this.period$.getValue();
	}
	public set period(value: EmployeeViewPeriod) {
		this.period$.next(value);
	}

	public counts: Loadable<ICountsStatistics | null> = Loadable.empty(null);
	public previousCounts: Loadable<ICountsStatistics | null> = Loadable.empty(null);
	public hours: Loadable<IEmployeeHoursDay[]> = Loadable.empty([]);
	/** Every project's time in the period, with the projects the employee is a member of. */
	public projects: Loadable<IProjectsPanel> = Loadable.empty({ stats: [], assigned: [] });
	public topTasks: Loadable<IRankedRow[]> = Loadable.empty([]);
	public apps: Loadable<IRankedRow[]> = Loadable.empty([]);
	public tasks: Loadable<IAssignedTaskRow[]> = Loadable.empty([]);
	public screenshots: Loadable<ITimeSlot[]> = Loadable.empty([]);

	public readonly taskFilters: TaskFilter[] = ['open', 'progress', 'overdue', 'done'];
	public taskFilter: TaskFilter = 'open';
	/** The Assigned tasks panel lists every task of the selected view, not just the first few. */
	public showAllTasks = false;
	public readonly taskLimit = TASK_LIMIT;

	/** The task open in the quick-look drawer, its sections and status lozenge. */
	public viewedTask: ITask | null = null;
	public viewSections: IRecordViewSection[] = [];
	public viewStatus: IRecordViewStatus | null = null;
	/** Keyboard access to the assignee cards and the "+N" list. */
	public readonly assigneeKeyboard = new AssigneePopoverKeyboard();
	private _viewSequence = 0;
	private readonly _hashPipe = new HashNumberPipe();
	private _projectOverview: { from: IProjectsPanel; value: IProjectOverviewRow[] } | null = null;

	/*
	 * The task counts and the hours caption are DERIVED from the panel values
	 * `track()` accepted, never written while a request is in flight: `track()`
	 * drops a stale response, so it can no longer leave counts or a caption from
	 * another period or employee beside the current rows. Each is memoised on
	 * the value it was computed from, as the template reads them on every change
	 * detection.
	 */
	private _taskSummary: { from: IAssignedTaskRow[]; value: TaskSummary } | null = null;
	private _hoursSummary: { from: IEmployeeHoursDay[]; value: HoursSummary } | null = null;

	/** Task counts behind the Open tasks figure and the filter tabs. */
	get taskSummary(): TaskSummary {
		const rows = this.tasks.value || [];
		if (this._taskSummary?.from !== rows) {
			const value: TaskSummary = { open: 0, todo: 0, progress: 0, blocked: 0, overdue: 0, done: 0 };
			for (const row of rows) {
				if (row.statusGroup === 'done') {
					value.done++;
					continue;
				}
				value.open++;
				value[row.statusGroup]++;
				if (row.overdue) value.overdue++;
			}
			this._taskSummary = { from: rows, value };
		}
		return this._taskSummary.value;
	}

	/** Seconds worked in the period and per working day, for the chart's caption. */
	get hoursSummary(): HoursSummary {
		const days = this.hours.value || [];
		if (this._hoursSummary?.from !== days) {
			const total = days.reduce((sum, day) => sum + day.tracked + day.manual, 0);
			const worked = days.filter((day) => day.tracked + day.manual > 0).length;
			const value = { total: total * 3600, average: worked ? (total / worked) * 3600 : 0 };
			this._hoursSummary = { from: days, value };
		}
		return this._hoursSummary.value;
	}

	/** The employee's wall clock, refreshed each minute. */
	public localTime: string | undefined;

	public get timeZone(): string {
		return this._timeZoneService.currentTimeZone;
	}
	public get timeFormat(): TimeFormatEnum {
		return this._timeZoneService.currentTimeFormat;
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _timeZoneService: TimeZoneService,
		private readonly _statisticsService: TimesheetStatisticsService,
		private readonly _timesheetService: TimesheetService,
		private readonly _tasksService: TasksService,
		private readonly _projectsService: OrganizationProjectsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		const employee$ = this._route.data.pipe(
			filter((data: Data) => !!data && !!data.employee),
			map(({ employee }: Data) => employee as IEmployee),
			tap((employee: IEmployee) => {
				// The route reuses this page for another employee's profile (the assignee
				// links lead here): close the previous employee's task and drop its read.
				// Period changes reload too, but keep the same employee — and the task.
				if (this.employee && this.employee.id !== employee.id) {
					this.closeTask();
				}
				this.employee = employee;
				this.updateLocalTime();
				this.profile = this.buildProfile(employee);
			})
		);
		// Scoped by the employee's own organization, not the header's selection:
		// this route hides the organization selector, so on a direct link the
		// selected organization is never set and the page would wait on it forever.
		combineLatest([employee$, this.period$])
			.pipe(
				debounceTime(50),
				tap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();

		timer(60_000, 60_000)
			.pipe(
				tap(() => this.updateLocalTime()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/* ── Header ──────────────────────────────────────────────────────────── */

	/** Display name, falling back through the shapes the API can return. */
	get displayName(): string {
		const user = this.employee?.user;
		const parts = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
		return this.employee?.fullName || user?.name || parts || '';
	}

	get initials(): string {
		return this.displayName
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('');
	}

	get avatarUrl(): string | undefined {
		return this.employee?.user?.image?.fullUrl || this.employee?.user?.imageUrl;
	}

	/** Department, employment type and level, as chips under the name. */
	get traits(): string[] {
		const employee = this.employee;
		if (!employee) return [];
		return [
			...(employee.organizationDepartments || []).map((item) => item?.name),
			...(employee.organizationEmploymentTypes || []).map((item) => item?.name),
			employee.employeeLevel
		].filter(Boolean);
	}

	/** Live presence, as the avatar dot and the label beside the name. */
	get presence(): { key: string; tone: 'tracking' | 'online' | 'away' | 'offline' } {
		const employee = this.employee;
		if (employee?.isTrackingTime) return { key: 'EMPLOYEES_PAGE.VIEW.PRESENCE.TRACKING', tone: 'tracking' };
		if (employee?.isOnline && employee?.isAway) return { key: 'EMPLOYEES_PAGE.VIEW.PRESENCE.AWAY', tone: 'away' };
		if (employee?.isOnline) return { key: 'EMPLOYEES_PAGE.VIEW.PRESENCE.ONLINE', tone: 'online' };
		return { key: 'EMPLOYEES_PAGE.VIEW.PRESENCE.OFFLINE', tone: 'offline' };
	}

	/** Employment state: still working, work ended, or not yet started. */
	get workStatus(): { key: string; tone: 'success' | 'danger' | 'basic' } {
		const employee = this.employee;
		if (employee?.endWork) return { key: 'EMPLOYEES_PAGE.WORK_ENDED', tone: 'danger' };
		if (employee?.startedWorkOn) return { key: 'EMPLOYEES_PAGE.ACTIVE', tone: 'success' };
		return { key: 'EMPLOYEES_PAGE.NOT_STARTED', tone: 'basic' };
	}

	get startedOn(): string | undefined {
		const started = this.employee?.startedWorkOn;
		return started ? moment(started).format('ll') : undefined;
	}

	/** "2 years" since the start date — how long they have been here. */
	get tenure(): string | undefined {
		const started = this.employee?.startedWorkOn;
		if (!started) return undefined;
		const end = this.employee?.endWork ? moment(this.employee.endWork) : moment();
		return moment.duration(end.diff(moment(started))).humanize();
	}

	get billRate(): string | undefined {
		const { billRateValue, billRateCurrency } = this.employee || {};
		return billRateValue ? `${billRateValue} ${billRateCurrency || ''}`.trim() : undefined;
	}

	get weeklyLimit(): string | undefined {
		const limit = this.employee?.reWeeklyLimit;
		return limit ? `${limit}h` : undefined;
	}

	/** The employee's own zone, or undefined when the profile does not carry one. */
	get employeeTimeZone(): string | undefined {
		const zone = this.employee?.user?.timeZone;
		return zone && moment.tz.zone(zone) ? zone : undefined;
	}

	private updateLocalTime(): void {
		const zone = this.employeeTimeZone;
		this.localTime = zone ? moment().tz(zone).format('LT') : undefined;
	}

	edit(): void {
		if (this.employee) {
			this._router.navigate(['/pages/employees/edit', this.employee.id]);
		}
	}

	/**
	 * Opens one of the employee activity / timesheet pages scoped to this
	 * employee. Those pages read the employee from the header selector, so it is
	 * set first — the same hand-off the edit page does.
	 */
	openFor(path: string[]): void {
		const employee = this.employee;
		if (!employee) return;
		this._store.selectedEmployee = {
			id: employee.id,
			firstName: employee.user?.firstName,
			lastName: employee.user?.lastName,
			fullName: this.displayName,
			imageUrl: this.avatarUrl,
			tags: employee.tags || [],
			skills: employee.skills || []
		};
		this._router.navigate(path);
	}

	/* ── Period ─────────────────────────────────────────────────────────── */

	/** "Oct 5 – Oct 11, 2026": the window every figure on the Overview covers. */
	get rangeLabel(): string {
		const { start, end } = this.periodRange();
		const sameYear = start.year() === end.year();
		return `${start.format(sameYear ? 'MMM D' : 'll')} – ${end.format('ll')}`;
	}

	private periodRange(): { start: moment.Moment; end: moment.Moment } {
		switch (this.period) {
			case EmployeeViewPeriod.THIS_MONTH:
				return { start: moment().startOf('month'), end: moment().endOf('month') };
			case EmployeeViewPeriod.LAST_30_DAYS:
				return { start: moment().subtract(29, 'days').startOf('day'), end: moment().endOf('day') };
			case EmployeeViewPeriod.THIS_WEEK:
			default:
				return { start: moment().startOf('week'), end: moment().endOf('week') };
		}
	}

	/**
	 * The same span one period earlier, cut at the same point in time: on a
	 * Wednesday, this week so far is compared with last week up to Wednesday,
	 * not with all of last week.
	 */
	private previousRange(): { start: moment.Moment; end: moment.Moment } {
		const { start, end } = this.periodRange();
		const cut = moment.min(end, moment());
		const shift = (date: moment.Moment) => {
			switch (this.period) {
				case EmployeeViewPeriod.THIS_MONTH:
					return date.clone().subtract(1, 'month');
				case EmployeeViewPeriod.LAST_30_DAYS:
					return date.clone().subtract(30, 'days');
				case EmployeeViewPeriod.THIS_WEEK:
				default:
					return date.clone().subtract(1, 'week');
			}
		};
		return { start: shift(start), end: shift(cut) };
	}

	/* ── Figures ─────────────────────────────────────────────────────────── */

	/** Seconds as "5h 07m" — the unit every time figure on the page is read in. */
	formatDuration = (seconds: number): string => {
		const total = Math.max(0, Math.round(Number(seconds) || 0));
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		return `${h}h ${m.toString().padStart(2, '0')}m`;
	};

	/** Hours (the chart's unit) as "5h 07m", for the tooltip. */
	formatHours = (hours: number): string => this.formatDuration((Number(hours) || 0) * 3600);

	/** 42.5 -> "43%". */
	formatPercent(value: number | undefined): string {
		return `${Math.round(Number(value) || 0)}%`;
	}

	get durationDelta(): IDelta {
		return ViewEmployeeComponent.delta(this.counts.value?.weekDuration, this.previousCounts.value?.weekDuration);
	}

	get activityDelta(): IDelta {
		return ViewEmployeeComponent.delta(
			this.counts.value?.weekActivities,
			this.previousCounts.value?.weekActivities
		);
	}

	private static delta(current: number | undefined, previous: number | undefined): IDelta {
		const now = Number(current) || 0;
		const before = Number(previous) || 0;
		if (!before) return { percent: null, direction: 'flat' };
		const percent = Math.round(((now - before) / before) * 100);
		let direction: IDelta['direction'] = 'flat';
		if (percent > 0) direction = 'up';
		else if (percent < 0) direction = 'down';
		return { percent: Math.abs(percent), direction };
	}

	/** How many tasks a filter tab stands for. */
	taskCount(filter: TaskFilter): number {
		return this.taskSummary[filter];
	}

	/** Every task in the selected view, in the order that view reads best. */
	get filteredTasks(): IAssignedTaskRow[] {
		const rows = this.tasks.value || [];
		switch (this.taskFilter) {
			case 'progress':
				return rows.filter((row) => row.statusGroup === 'progress');
			case 'overdue':
				return rows.filter((row) => row.overdue);
			case 'done':
				return rows.filter((row) => row.statusGroup === 'done').sort((a, b) => b.doneTime - a.doneTime);
			case 'open':
			default:
				return rows.filter((row) => row.statusGroup !== 'done');
		}
	}

	/** The rows the table shows: the first few of the selected view, or all of them. */
	get visibleTasks(): IAssignedTaskRow[] {
		return this.showAllTasks ? this.filteredTasks : this.filteredTasks.slice(0, TASK_LIMIT);
	}

	/* ── Task quick look ─────────────────────────────────────────────────── */

	/**
	 * Opens a task in the quick-look drawer — the same sections and header the
	 * task lists and the team page show — without leaving the employee page. It
	 * opens at once with the row's data, then fills in from the task's full read;
	 * a failed read keeps what the row had.
	 */
	async openTask(row: IAssignedTaskRow): Promise<void> {
		const sequence = ++this._viewSequence;
		this.showTask(row.task);
		try {
			const task = await this._tasksService.getById(row.id, TASK_VIEW_RELATIONS);
			if (sequence === this._viewSequence && this.viewedTask?.id === row.id && task) {
				this.showTask(task);
			}
		} catch {
			// The row's own data stays on screen.
		}
	}

	closeTask(): void {
		this._viewSequence++;
		this.viewedTask = null;
	}

	/** The task's own full-width page. */
	taskLink(id: string): string[] {
		return ['/pages/tasks/view', id];
	}

	private showTask(task: ITask): void {
		this.viewStatus = taskStatusOf(task);
		this.viewSections = buildTaskViewSections(task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this._hashPipe.transform(value)
		});
		this.viewedTask = task;
	}

	/* ── Projects ────────────────────────────────────────────────────────── */

	/**
	 * The Overview's Projects panel, as on the team page: every project the
	 * employee is a member of, with their time on it in the period, plus any
	 * project they tracked time on without being a member (flagged as such).
	 * Most worked first; projects with no time keep their place at the end.
	 */
	get projectOverview(): IProjectOverviewRow[] {
		const panel = this.projects.value || { stats: [], assigned: [] };
		const stats = panel.stats || [];
		const assigned = panel.assigned || [];
		// Membership is only known when the membership list was read.
		const known = panel.assigned !== null;
		if (this._projectOverview?.from !== panel) {
			const time = new Map(stats.map((row) => [row.id, row.duration]));
			const members = assigned
				.filter((project) => !!project?.name)
				.map((project) => ({
					id: project.id,
					name: project.name,
					imageUrl: project.imageUrl || (project as any).image?.fullUrl,
					initials: ViewEmployeeComponent.initialsOf(project.name),
					duration: time.get(project.id) || 0,
					member: true
				}));
			const memberIds = new Set(members.map((project) => project.id));
			const others = stats
				.filter((row) => !memberIds.has(row.id))
				.map((row) => ({
					id: row.id,
					name: row.name,
					imageUrl: undefined,
					initials: ViewEmployeeComponent.initialsOf(row.name),
					duration: row.duration,
					member: known ? false : null
				}));
			const all = [...members, ...others];
			const total = all.reduce((sum, row) => sum + row.duration, 0);
			const max = Math.max(0, ...all.map((row) => row.duration));
			const value = all
				.map((row) => ({
					...row,
					share: total ? (row.duration / total) * 100 : 0,
					width: max ? Math.max(row.duration ? 2 : 0, (row.duration / max) * 100) : 0
				}))
				.sort((a, b) => b.duration - a.duration || a.name.localeCompare(b.name));
			this._projectOverview = { from: panel, value };
		}
		return this._projectOverview.value;
	}

	/* ── Loading ─────────────────────────────────────────────────────────── */

	/** Re-fetches the screenshots after one is deleted from its card. */
	reloadScreenshots(): void {
		const request = this.buildRequest(this.periodRange());
		void this.track('screenshots', () => this.fetchScreenshots(request));
	}

	private load(): void {
		if (!this.employee?.organizationId) return;

		const request = this.buildRequest(this.periodRange());
		const previous = this.buildRequest(this.previousRange());
		const employeeId = this.employee.id;

		// Each panel loads on its own and `track()` catches its own failure, so
		// the returned promises are deliberately not awaited.
		void this.track('counts', () => this._statisticsService.getCounts(request));
		void this.track('previousCounts', () => this._statisticsService.getCounts(previous));
		void this.track('hours', async () =>
			this.toHoursDays(await this._timesheetService.getDailyReportChart(request))
		);
		// Read once, for the most worked tasks and to find the projects those tasks belong to.
		const taskStatistics = this._statisticsService.getTasksStatistics(request);
		void this.track('projects', () => this.fetchProjectsPanel(request, employeeId, taskStatistics));
		// Fetched in full and ranked here, like Projects and Apps. The endpoint
		// orders by last update, not by time, and applies `take` first, so a
		// server-side limit could drop the most-worked tasks and would leave each
		// share computed over the kept rows only.
		void this.track('topTasks', async () =>
			this.rank(await taskStatistics, (task: ITasksStatistics) => ({
				id: task.id,
				name: task.title,
				meta: task.project?.name
			}))
		);
		void this.track('apps', async () =>
			this.rank(await this._statisticsService.getActivities(request), (activity: IActivitiesStatistics) => ({
				id: activity.title,
				name: activity.title
			}))
		);
		void this.track('screenshots', () => this.fetchScreenshots(request));
		void this.track('tasks', async () => {
			const { organizationId, tenantId } = this.employee;
			const tasks = await this._tasksService.getAllTasksByEmployee(employeeId, {
				where: { organizationId, tenantId },
				relations: ['project', 'members', 'members.user']
			} as any);
			return this.toAssignedTasks(tasks || [], employeeId);
		});
	}

	/**
	 * The Projects panel: the projects the employee belongs to, and the time on
	 * every project they worked on.
	 *
	 * The statistics endpoint returns only its five most-worked projects, so the
	 * totals are read for a known list of projects instead — every project they
	 * belong to, the overall top five, and the projects of the tasks they worked
	 * on — in groups of five, each of which the endpoint returns whole. A failed
	 * membership read leaves membership unknown rather than empty.
	 */
	private async fetchProjectsPanel(
		request: ITimeLogFilters & ITimeLogTodayFilters,
		employeeId: string,
		taskStatistics: Promise<ITasksStatistics[]>
	): Promise<IProjectsPanel> {
		const { organizationId, tenantId } = this.employee;
		const [top, assigned, tasks] = await Promise.all([
			this._statisticsService.getProjects(request),
			this._projectsService.getAllByEmployee(employeeId, { organizationId, tenantId }).catch(() => null),
			taskStatistics.catch(() => [] as ITasksStatistics[])
		]);

		const ids = new Set<string>();
		for (const project of assigned || []) if (project?.id) ids.add(project.id);
		for (const project of top || []) if (project?.id) ids.add(project.id);
		for (const task of tasks || []) if (task?.projectId) ids.add(task.projectId);

		const groups: string[][] = [];
		const all = [...ids];
		for (let i = 0; i < all.length; i += PROJECT_STATS_GROUP) groups.push(all.slice(i, i + PROJECT_STATS_GROUP));
		const totals = (
			await Promise.all(
				groups.map((projectIds) => this._statisticsService.getProjects({ ...request, projectIds }))
			)
		).flat();

		const stats = this.rank(
			totals,
			(project: IProjectsStatistics) => ({ id: project.id, name: project.name }),
			Infinity
		);
		return { stats, assigned: assigned || null };
	}

	/** The period's latest time slots for this employee, newest first, with their screenshots. */
	private async fetchScreenshots(request: ITimeLogFilters): Promise<ITimeSlot[]> {
		const employees = await this._statisticsService.getTimeSlots(request);
		const own = (employees || []).find((employee) => employee.id === this.employee.id);
		return own?.timeSlots || [];
	}

	/**
	 * Runs one panel's request. A stale response (the period or employee changed
	 * while it was in flight) is dropped rather than painted over the new one.
	 */
	private async track(key: PanelKey, fetch: () => Promise<any>): Promise<void> {
		const token = {};
		this.pending[key] = token;
		const panel = this as unknown as Record<PanelKey, Loadable<any>>;
		panel[key] = { ...panel[key], loading: true, failed: false };
		try {
			const value = await fetch();
			if (this.pending[key] === token) panel[key] = { loading: false, failed: false, value };
		} catch {
			if (this.pending[key] === token) panel[key] = { ...panel[key], loading: false, failed: true };
		}
	}
	private pending: Partial<Record<PanelKey, object>> = {};

	/** A window as the statistics endpoints expect it: UTC wall-clock strings in the viewer's zone. */
	private buildRequest(range: { start: moment.Moment; end: moment.Moment }): ITimeLogFilters & ITimeLogTodayFilters {
		const { organizationId, tenantId } = this.employee;
		const timeZone = this._timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');

		return {
			tenantId,
			organizationId,
			employeeIds: [this.employee.id],
			startDate: format(range.start),
			endDate: format(range.end),
			todayStart: format(moment().startOf('day')),
			todayEnd: format(moment().endOf('day')),
			timeZone
		};
	}

	/** Daily-chart rows (hours per log type) -> the chart's tracked/manual days. */
	private toHoursDays(rows: any): IEmployeeHoursDay[] {
		const format = this.period === EmployeeViewPeriod.THIS_WEEK ? 'ddd D' : 'D MMM';
		return (Array.isArray(rows) ? rows : []).map((row: any) => ({
			label: moment(row.date).format(format),
			// Resumed time is timer time picked back up after an idle prompt, so it counts as tracked.
			tracked: (Number(row.value?.[TimeLogType.TRACKED]) || 0) + (Number(row.value?.[TimeLogType.RESUMED]) || 0),
			manual: Number(row.value?.[TimeLogType.MANUAL]) || 0
		}));
	}

	/** Sorts by duration, keeps the top rows, and sizes each against the total and the largest. */
	private rank<T extends { duration?: number }>(
		items: T[],
		describe: (item: T) => Pick<IRankedRow, 'id' | 'name' | 'meta'>,
		limit = LIST_LIMIT
	): IRankedRow[] {
		const all = (items || [])
			.map((item) => ({ ...describe(item), duration: Number(item.duration) || 0 }))
			.filter((row) => row.duration > 0 && row.name)
			.sort((a, b) => b.duration - a.duration);
		const total = all.reduce((sum, row) => sum + row.duration, 0) || 1;
		const max = all[0]?.duration || 1;
		return all.slice(0, limit).map((row) => ({
			...row,
			share: (row.duration / total) * 100,
			width: Math.max(2, (row.duration / max) * 100)
		}));
	}

	/**
	 * Keeps the tasks assigned to this employee and describes each in plain
	 * words: its status group, its priority, and how its due date stands against
	 * today. Ordered overdue first, then soonest due, undated last. Pure: the
	 * counts are derived from the accepted rows (see `taskSummary`).
	 *
	 * The endpoint also returns the tasks of the employee's teams. A team task
	 * with no assignee is kept, as it is the team's and so theirs; one assigned to
	 * other members is not this employee's work and would inflate their open and
	 * overdue counts, so it is left out.
	 */
	private toAssignedTasks(tasks: ITask[], employeeId: string): IAssignedTaskRow[] {
		const today = moment().startOf('day');
		const rows = tasks
			.filter((task) => !task.members?.length || task.members.some((member) => member?.id === employeeId))
			.map((task) => this.toTaskRow(task, today));

		// Overdue first, then soonest due; undated last. (Infinity - Infinity is NaN, hence the guard.)
		return rows.sort(
			(a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueTime === b.dueTime ? 0 : a.dueTime - b.dueTime)
		);
	}

	/** One task as a table row. */
	private toTaskRow(task: ITask, today: moment.Moment): IAssignedTaskRow {
		const statusGroup = ViewEmployeeComponent.statusGroupOf(task.status);
		const isDone = statusGroup === 'done';
		const daysLeft = task.dueDate ? moment(task.dueDate).startOf('day').diff(today, 'days') : null;
		const priority = (task.taskPriority?.name || task.priority || '').toLowerCase();
		const people = (task.members || [])
			.map((member) => {
				const user = member?.user;
				const name =
					member?.fullName ||
					user?.name ||
					[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
					user?.email ||
					'';
				return {
					id: member?.id,
					name,
					initials: ViewEmployeeComponent.initialsOf(name),
					avatarUrl: user?.image?.fullUrl || user?.imageUrl || undefined,
					email: user?.email,
					presence: ViewEmployeeComponent.presenceOfPerson(member),
					bio: member?.short_description?.trim() || undefined,
					since: member?.startedWorkOn ? moment(member.startedWorkOn).format('ll') : undefined
				} as ITaskPerson;
			})
			.filter((person) => !!person.name);

		return {
			task,
			people,
			morePeople: people.slice(3),
			dueDateLong: task.dueDate ? moment(task.dueDate).format('dddd, LL') : undefined,
			id: task.id,
			key: task.prefix && task.number ? `${task.prefix}-${task.number}` : '',
			title: task.title,
			project: task.project?.name,
			status: task.taskStatus?.name || this.humanize(task.status) || '',
			statusGroup,
			priority: task.taskPriority?.name || this.humanize(task.priority) || undefined,
			priorityLevel: PRIORITY_LEVELS.has(priority) ? (priority as IAssignedTaskRow['priorityLevel']) : undefined,
			dueDate: task.dueDate ? moment(task.dueDate).format('ll') : undefined,
			due: ViewEmployeeComponent.dueInWords(daysLeft, isDone),
			dueTime: task.dueDate ? moment(task.dueDate).valueOf() : Infinity,
			doneTime: moment(task.resolvedAt || task.updatedAt || 0).valueOf(),
			overdue: !isDone && daysLeft !== null && daysLeft < 0
		};
	}

	/** Live presence from the employee's own flags, as the employee page reads it. */
	private static presenceOfPerson(employee: any): ITaskPerson['presence'] {
		if (employee?.isTrackingTime) return 'tracking';
		if (employee?.isOnline && employee?.isAway) return 'away';
		if (employee?.isOnline) return 'online';
		return 'offline';
	}

	private static initialsOf(name: string): string {
		return (name || '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('');
	}

	/** Which of the four groups a task status belongs to. */
	private static statusGroupOf(status: string | undefined): IAssignedTaskRow['statusGroup'] {
		const value = (status || '').toLowerCase();
		if (CLOSED_STATUSES.has(value)) return 'done';
		if (IN_PROGRESS_STATUSES.has(value)) return 'progress';
		if (value === TaskStatusEnum.BLOCKED) return 'blocked';
		return 'todo';
	}

	/** Days until (or past) the due date, as the words the Due column prints. */
	private static dueInWords(daysLeft: number | null, isDone: boolean): IAssignedTaskRow['due'] {
		const prefix = 'EMPLOYEES_PAGE.VIEW.DUE.';
		if (daysLeft === null) return { key: prefix + 'NONE' };
		if (isDone) return { key: prefix + 'WAS_DUE' };
		if (daysLeft < -1) return { key: prefix + 'OVERDUE_DAYS', count: -daysLeft };
		if (daysLeft === -1) return { key: prefix + 'OVERDUE_DAY' };
		if (daysLeft === 0) return { key: prefix + 'TODAY' };
		if (daysLeft === 1) return { key: prefix + 'TOMORROW' };
		return { key: prefix + 'IN_DAYS', count: daysLeft };
	}

	/** "in-progress" -> "In progress". */
	private humanize(value?: string): string {
		if (!value) return '';
		const text = value.replace(/[-_]+/g, ' ').trim();
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	/* ── Profile ─────────────────────────────────────────────────────────── */

	/**
	 * The Profile tab as a view model: every value already formatted, and every
	 * empty one dropped, so the template only lays out what is actually set.
	 */
	private buildProfile(employee: IEmployee): IEmployeeProfile {
		const user = employee.user;
		const contact = employee.contact;
		const date = (value?: Date | string) => (value ? moment(value).format('ll') : undefined);
		const keep = (fields: IProfileField[]) => fields.filter((field) => !!field.value);

		const socials: [string, string | undefined, string][] = [
			['LinkedIn', employee.linkedInUrl, 'linkedin-outline'],
			['GitHub', employee.githubUrl, 'github-outline'],
			['GitLab', employee.gitlabUrl, 'code-outline'],
			['Stack Overflow', employee.stackoverflowUrl, 'layers-outline'],
			['Upwork', employee.upworkUrl, 'briefcase-outline'],
			['Twitter', employee.twitterUrl, 'twitter-outline'],
			['Facebook', employee.facebookUrl, 'facebook-outline'],
			['Instagram', employee.instagramUrl, 'camera-outline']
		];

		const minimumRate = employee.minimumBillingRate
			? `${employee.minimumBillingRate} ${employee.billRateCurrency || ''}`.trim()
			: undefined;

		return {
			shortDescription: employee.short_description?.trim() || undefined,
			description: employee.description?.trim() || undefined,
			employment: keep([
				{ label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.POSITION', value: employee.organizationPosition?.name },
				{ label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYEE_LEVEL', value: employee.employeeLevel },
				{
					label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.DEPARTMENT',
					value: ViewEmployeeComponent.names(employee.organizationDepartments)
				},
				{
					label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYMENT_TYPE',
					value: ViewEmployeeComponent.names(employee.organizationEmploymentTypes)
				},
				{ label: 'FORM.LABELS.START_DATE', value: date(employee.startedWorkOn) },
				{ label: 'EMPLOYEES_PAGE.WORK_ENDED', value: date(employee.endWork) },
				{ label: 'FORM.LABELS.OFFER_DATE', value: date(employee.offerDate) },
				{ label: 'FORM.LABELS.ACCEPT_DATE', value: date(employee.acceptDate) },
				{ label: 'FORM.LABELS.REJECT_DATE', value: date(employee.rejectDate) }
			]),
			rates: keep([
				{ label: 'FORM.LABELS.PAY_PERIOD', value: this.humanize((employee.payPeriod || '').toLowerCase()) },
				{ label: 'FORM.LABELS.BILL_RATE', value: this.billRate },
				{ label: 'FORM.LABELS.BILL_RATE_MIN', value: minimumRate },
				{ label: 'FORM.LABELS.RECURRING_WEEKLY_LIMIT', value: this.weeklyLimit }
			]),
			contact: keep([
				{
					label: 'SM_TABLE.EMAIL',
					value: user?.email,
					href: user?.email && `mailto:${user.email}`,
					icon: 'email-outline'
				},
				{
					label: 'FORM.LABELS.PHONE_NUMBER',
					value: user?.phoneNumber,
					href: user?.phoneNumber && `tel:${user.phoneNumber}`,
					icon: 'phone-outline'
				},
				{
					label: 'FORM.LABELS.PREFERRED_LANGUAGE',
					value: ViewEmployeeComponent.displayName(user?.preferredLanguage, 'language'),
					icon: 'globe-outline'
				},
				{ label: 'EMPLOYEES_PAGE.VIEW.PROFILE.TIME_ZONE', value: this.employeeTimeZone, icon: 'clock-outline' }
			]),
			address: [
				contact?.address,
				contact?.address2,
				[contact?.city, contact?.postcode].filter(Boolean).join(' '),
				ViewEmployeeComponent.displayName(contact?.country, 'region')
			].filter((line) => !!line && !!line.trim()),
			socials: socials
				.filter(([, url]) => !!url?.trim())
				.map(([label, url, icon]) => ({
					label,
					icon,
					href: /^https?:\/\//i.test(url) ? url : `https://${url}`,
					value: url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
				})),
			skills: (employee.skills || []).filter((skill) => !!skill?.name),
			tags: (employee.tags || []).filter((tag) => !!tag?.name)
		};
	}

	/** Comma-joined names of a relation list, or undefined so the row is dropped. */
	private static names(items: { name?: string }[] | undefined): string | undefined {
		const names = (items || []).map((item) => item?.name).filter(Boolean);
		return names.length ? names.join(', ') : undefined;
	}

	/** "FR" -> "France", "de" -> "German", in the reader's language; the code itself if the browser cannot say. */
	private static displayName(code: string | undefined, type: 'region' | 'language'): string | undefined {
		if (!code) return undefined;
		try {
			const names = new (Intl as any).DisplayNames([moment.locale(), 'en'], { type });
			return names.of(type === 'region' ? code.toUpperCase() : code) || code;
		} catch {
			return code;
		}
	}
}
