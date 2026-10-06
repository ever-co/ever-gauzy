import { Component, OnInit } from '@angular/core';
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
import { Store, TasksService, TimesheetService, TimesheetStatisticsService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TimeZoneService } from '@gauzy/ui-core/shared';
import { IEmployeeHoursDay } from './employee-hours-chart/employee-hours-chart.component';

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

/** A task as the Assigned tasks table lists it. */
interface IAssignedTaskRow {
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

const CLOSED_STATUSES: string[] = [TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED];
const IN_PROGRESS_STATUSES: string[] = [
	TaskStatusEnum.IN_PROGRESS,
	TaskStatusEnum.READY_FOR_REVIEW,
	TaskStatusEnum.IN_REVIEW
];

/** How many rows a ranked table shows. */
const LIST_LIMIT = 6;
/** How many rows the Assigned tasks table shows per view. */
const TASK_LIMIT = 8;

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
	public projects: Loadable<IRankedRow[]> = Loadable.empty([]);
	public topTasks: Loadable<IRankedRow[]> = Loadable.empty([]);
	public apps: Loadable<IRankedRow[]> = Loadable.empty([]);
	public tasks: Loadable<IAssignedTaskRow[]> = Loadable.empty([]);
	public screenshots: Loadable<ITimeSlot[]> = Loadable.empty([]);

	/** Task counts behind the Open tasks figure and the filter tabs. */
	public taskSummary = { open: 0, todo: 0, progress: 0, blocked: 0, overdue: 0, done: 0 };
	public readonly taskFilters: TaskFilter[] = ['open', 'progress', 'overdue', 'done'];
	public taskFilter: TaskFilter = 'open';
	/** Hours in the period and the per-working-day average, for the chart's caption. */
	public hoursSummary = { total: 0, average: 0 };

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
		private readonly _tasksService: TasksService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		const employee$ = this._route.data.pipe(
			filter((data: Data) => !!data && !!data.employee),
			map(({ employee }: Data) => employee as IEmployee),
			tap((employee: IEmployee) => {
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

	/** Opens the edit page on the tab that holds a Profile card's fields. */
	editSection(section: 'account' | 'employment' | 'rates' | 'location' | 'networks'): void {
		if (this.employee) {
			this._router.navigate(['/pages/employees/edit', this.employee.id, section]);
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
		return { percent: Math.abs(percent), direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat' };
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

	/** The rows the table shows: the first few of the selected view. */
	get visibleTasks(): IAssignedTaskRow[] {
		return this.filteredTasks.slice(0, TASK_LIMIT);
	}

	/* ── Loading ─────────────────────────────────────────────────────────── */

	/** Re-fetches the screenshots after one is deleted from its card. */
	reloadScreenshots(): void {
		const request = this.buildRequest(this.periodRange());
		this.track('screenshots', () => this.fetchScreenshots(request));
	}

	private load(): void {
		if (!this.employee?.organizationId) return;

		const request = this.buildRequest(this.periodRange());
		const previous = this.buildRequest(this.previousRange());
		const employeeId = this.employee.id;

		this.track('counts', () => this._statisticsService.getCounts(request));
		this.track('previousCounts', () => this._statisticsService.getCounts(previous));
		this.track('hours', async () => this.toHoursDays(await this._timesheetService.getDailyReportChart(request)));
		this.track('projects', async () =>
			this.rank(await this._statisticsService.getProjects(request), (project: IProjectsStatistics) => ({
				id: project.id,
				name: project.name
			}))
		);
		this.track('topTasks', async () =>
			this.rank(
				await this._statisticsService.getTasksStatistics({ ...request, take: LIST_LIMIT }),
				(task: ITasksStatistics) => ({ id: task.id, name: task.title, meta: task.project?.name })
			)
		);
		this.track('apps', async () =>
			this.rank(await this._statisticsService.getActivities(request), (activity: IActivitiesStatistics) => ({
				id: activity.title,
				name: activity.title
			}))
		);
		this.track('screenshots', () => this.fetchScreenshots(request));
		this.track('tasks', async () => {
			const { organizationId, tenantId } = this.employee;
			const tasks = await this._tasksService.getAllTasksByEmployee(employeeId, {
				where: { organizationId, tenantId },
				relations: ['project', 'members']
			} as any);
			return this.toAssignedTasks(tasks || [], employeeId);
		});
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
		const days: IEmployeeHoursDay[] = (Array.isArray(rows) ? rows : []).map((row: any) => ({
			label: moment(row.date).format(this.period === EmployeeViewPeriod.THIS_WEEK ? 'ddd D' : 'D MMM'),
			// Resumed time is timer time picked back up after an idle prompt, so it counts as tracked.
			tracked: (Number(row.value?.[TimeLogType.TRACKED]) || 0) + (Number(row.value?.[TimeLogType.RESUMED]) || 0),
			manual: Number(row.value?.[TimeLogType.MANUAL]) || 0
		}));

		const total = days.reduce((sum, day) => sum + day.tracked + day.manual, 0);
		const worked = days.filter((day) => day.tracked + day.manual > 0).length;
		this.hoursSummary = { total: total * 3600, average: worked ? (total / worked) * 3600 : 0 };
		return days;
	}

	/** Sorts by duration, keeps the top rows, and sizes each against the total and the largest. */
	private rank<T extends { duration?: number }>(
		items: T[],
		describe: (item: T) => Pick<IRankedRow, 'id' | 'name' | 'meta'>
	): IRankedRow[] {
		const all = (items || [])
			.map((item) => ({ ...describe(item), duration: Number(item.duration) || 0 }))
			.filter((row) => row.duration > 0 && row.name)
			.sort((a, b) => b.duration - a.duration);
		const total = all.reduce((sum, row) => sum + row.duration, 0) || 1;
		const max = all[0]?.duration || 1;
		return all.slice(0, LIST_LIMIT).map((row) => ({
			...row,
			share: (row.duration / total) * 100,
			width: Math.max(2, (row.duration / max) * 100)
		}));
	}

	/**
	 * Keeps the tasks this employee is a member of (the endpoint also returns
	 * their teams' tasks), counts them for the filter tabs, and describes each
	 * one in plain words — its status group, its priority, and how its due date
	 * stands against today. Ordered overdue first, then soonest due, undated last.
	 */
	private toAssignedTasks(tasks: ITask[], employeeId: string): IAssignedTaskRow[] {
		const own = tasks.filter(
			(task) => !task.members?.length || task.members.some((member) => member?.id === employeeId)
		);
		const today = moment().startOf('day');
		const summary = { open: 0, todo: 0, progress: 0, blocked: 0, overdue: 0, done: 0 };

		const rows: IAssignedTaskRow[] = own.map((task) => {
			const status = (task.status || '').toLowerCase();
			const statusGroup: IAssignedTaskRow['statusGroup'] = CLOSED_STATUSES.includes(status)
				? 'done'
				: IN_PROGRESS_STATUSES.includes(status)
				? 'progress'
				: status === TaskStatusEnum.BLOCKED
				? 'blocked'
				: 'todo';
			const isDone = statusGroup === 'done';
			const daysLeft = task.dueDate ? moment(task.dueDate).startOf('day').diff(today, 'days') : null;
			const overdue = !isDone && daysLeft !== null && daysLeft < 0;

			if (isDone) {
				summary.done++;
			} else {
				summary.open++;
				summary[statusGroup]++;
				if (overdue) summary.overdue++;
			}

			const priority = (task.taskPriority?.name || task.priority || '').toLowerCase();
			return {
				id: task.id,
				key: task.prefix && task.number ? `${task.prefix}-${task.number}` : '',
				title: task.title,
				project: task.project?.name,
				status: task.taskStatus?.name || this.humanize(task.status) || '',
				statusGroup,
				priority: task.taskPriority?.name || this.humanize(task.priority) || undefined,
				priorityLevel: ['urgent', 'high', 'medium', 'low'].includes(priority)
					? (priority as IAssignedTaskRow['priorityLevel'])
					: undefined,
				dueDate: task.dueDate ? moment(task.dueDate).format('ll') : undefined,
				due: ViewEmployeeComponent.dueInWords(daysLeft, isDone),
				dueTime: task.dueDate ? moment(task.dueDate).valueOf() : Infinity,
				doneTime: moment(task.resolvedAt || task.updatedAt || 0).valueOf(),
				overdue
			};
		});
		this.taskSummary = summary;

		// Overdue first, then soonest due; undated last. (Infinity - Infinity is NaN, hence the guard.)
		return rows.sort(
			(a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueTime === b.dueTime ? 0 : a.dueTime - b.dueTime)
		);
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
				{ label: 'SM_TABLE.EMAIL', value: user?.email, href: user?.email && `mailto:${user.email}`, icon: 'email-outline' },
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
