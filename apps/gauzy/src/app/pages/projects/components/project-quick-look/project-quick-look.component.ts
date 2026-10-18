import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
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
	IPagination,
	ITask,
	ITasksStatistics,
	ITimeLogFilters,
	ITimeLogTodayFilters,
	OrganizationProjectBudgetTypeEnum,
	PermissionsEnum,
	ProjectStatusEnum,
	TaskStatusEnum,
	TimeLogType
} from '@gauzy/contracts';
import { API_PREFIX, toParams, toUtcOffset } from '@gauzy/ui-core/common';
import { OrganizationProjectsService, TimesheetService, TimesheetStatisticsService } from '@gauzy/ui-core/core';
import { IRecordViewSection, IRecordViewStatus, RecordViewModule, TimeZoneService } from '@gauzy/ui-core/shared';
import {
	EmployeeHoursChartComponent,
	IEmployeeHoursDay
} from '../../../employees/view-employee/employee-hours-chart/employee-hours-chart.component';
import { isTaskFinished } from '../../../tasks/components/task-view/task-view-sections';
import { buildProjectViewSections, PROJECT_VIEW_RELATIONS, projectStatusOf } from './project-view-sections';

type Presence = 'tracking' | 'online' | 'away' | 'offline';

/** The card a project is opened from: its name, logo and the host's time on it in the period. */
export interface IProjectQuickLookCard {
	id: string;
	name: string;
	imageUrl?: string;
	initials: string;
	/** Seconds the host page counts for it in the period (the employee's, or the team's). */
	duration: number;
}

/** A person the host page already knows, so a contributor shows their name, photo and presence. */
export interface IProjectQuickLookPerson {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
	presence?: Presence;
}

/** Each request lands or fails on its own; a failure (most often a 403) only blanks its panel. */
type Loadable<T> = { loading: boolean; failed: boolean; value: T };

const loading = <T>(value: T): Loadable<T> => ({ loading: true, failed: false, value });

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

const CLOSED_STATUSES = new Set<string>([TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED]);
const IN_PROGRESS_STATUSES = new Set<string>([
	TaskStatusEnum.IN_PROGRESS,
	TaskStatusEnum.READY_FOR_REVIEW,
	TaskStatusEnum.IN_REVIEW
]);
const PRIORITY_LEVELS = new Set<string>(['urgent', 'high', 'medium', 'low']);

/** Rows the ranked lists keep. */
const LIST_LIMIT = 6;
/** Rows the task list shows before "Show all". */
const TASK_LIMIT = 6;
/** Tasks due within this many days count as due soon. */
const ATTENTION_DAYS = 3;

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
	/** Whose time the period figures count; `null` for everyone on the project, `[]` for nobody. */
	@Input() scopeEmployeeIds: string[] | null = null;
	/** People the host knows, for contributors' names, photos and presence. */
	@Input() people: IProjectQuickLookPerson[] = [];
	/** A person to pick out among the contributors (the employee whose page it is). */
	@Input() highlightEmployeeId: string | null = null;
	/** i18n key under "Who worked the most"; takes `{{ range }}`. */
	@Input() contributorsCaption = 'PROJECT_QUICK_LOOK.CONTRIBUTORS_CAPTION';
	@Output() closed = new EventEmitter<void>();

	public readonly PermissionsEnum = PermissionsEnum;
	public readonly taskFilters: ProjectTaskFilter[] = ['open', 'progress', 'overdue', 'done'];
	public readonly taskLimit = TASK_LIMIT;

	public viewedProject: IOrganizationProject | null = null;
	public sections: IRecordViewSection[] = [];
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

	/** Bumped on every open, switch and close, so no reply for another project lands. */
	private _projectSequence = 0;
	/** Bumped on every reload of the period figures, so an older reply never lands over a newer one. */
	private _periodSequence = 0;

	constructor(
		private readonly _http: HttpClient,
		private readonly _translate: TranslateService,
		private readonly _timeZoneService: TimeZoneService,
		private readonly _projectsService: OrganizationProjectsService,
		private readonly _statisticsService: TimesheetStatisticsService,
		private readonly _timesheetService: TimesheetService
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
		if (projectId && (changes['rangeStart'] || changes['rangeEnd'] || changes['scopeEmployeeIds'])) {
			this.loadPeriodFigures(projectId);
		}
	}

	close(): void {
		this.closed.emit();
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

	/** The team's or everyone's hours on the project over the period, tracked and manual. */
	get hoursTotal(): number {
		return (this.hours.value || []).reduce((sum, day) => sum + day.tracked + day.manual, 0);
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
		this.taskFilter = 'open';
		this.showAllTasks = false;
		this.show({ id: card.id, name: card.name, imageUrl: card.imageUrl } as IOrganizationProject);
		void this.loadProgress(card.id, sequence);
		this.loadPeriodFigures(card.id);
		try {
			const project = await firstValueFrom(this._projectsService.getById(card.id, PROJECT_VIEW_RELATIONS));
			if (sequence === this._projectSequence && project) {
				this.show(project);
				void this.loadBudget(project, sequence);
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
		this.sections = buildProjectViewSections(project, { translate: (key) => this._translate.instant(key) });
		this.facts = this.toFacts(project);
		this.viewedProject = project;
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
			due: daysLeft === null || isFinished ? null : ProjectQuickLookComponent.dueInWords(daysLeft, false),
			overdue: !isFinished && daysLeft !== null && daysLeft < 0
		};
	}

	/* ── Tasks: progress, attention and the list, from one read ───────────── */

	private async loadProgress(projectId: string, sequence: number): Promise<void> {
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
			if (sequence !== this._projectSequence) return;
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
			if (sequence === this._projectSequence) this.taskProgress = { loading: false, failed: true, value: null };
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
		const statusGroup = isTaskFinished(task) ? 'done' : ProjectQuickLookComponent.statusGroupOf(task.status);
		const isDone = statusGroup === 'done';
		const daysLeft = task.dueDate ? moment(task.dueDate).startOf('day').diff(today, 'days') : null;
		const people = (task.members || [])
			.map((member: IEmployee) => {
				const name = ProjectQuickLookComponent.nameOf(member);
				return {
					id: member.id,
					name,
					initials: ProjectQuickLookComponent.initialsOf(name),
					avatarUrl: member.user?.image?.fullUrl || member.user?.imageUrl || undefined
				};
			})
			.filter((person) => !!person.name);
		const priority = (task.taskPriority?.name || task.priority || '').toLowerCase();
		return {
			id: task.id,
			key: task.prefix && task.number ? `${task.prefix}-${task.number}` : '',
			title: task.title,
			status: task.taskStatus?.name || ProjectQuickLookComponent.humanize(task.status) || '',
			statusGroup,
			dueDate: task.dueDate ? moment(task.dueDate).format('ll') : undefined,
			dueDateLong: task.dueDate ? moment(task.dueDate).format('dddd, LL') : undefined,
			due: ProjectQuickLookComponent.dueInWords(daysLeft, isDone),
			dueTime: task.dueDate ? moment(task.dueDate).valueOf() : Infinity,
			doneTime: moment(task.resolvedAt || task.updatedAt || 0).valueOf(),
			overdue: !isDone && daysLeft !== null && daysLeft < 0,
			priority: task.taskPriority?.name || ProjectQuickLookComponent.humanize(task.priority) || undefined,
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
				due: ProjectQuickLookComponent.dueInWords(daysLeft, false),
				overdue: daysLeft < 0
			}));
	}

	/* ── Budget ──────────────────────────────────────────────────────────── */

	/**
	 * An hours budget against all the time worked on the project since it started,
	 * by anyone. A cost budget needs rates, so it is left to the Details row.
	 */
	private async loadBudget(project: IOrganizationProject, sequence: number): Promise<void> {
		const budgetHours = Number(project.budget) || 0;
		if (project.budgetType !== OrganizationProjectBudgetTypeEnum.HOURS || budgetHours <= 0) return;
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
			const usedHours = Number(seconds) / 3600;
			const used = (usedHours / budgetHours) * 100;
			this.budget = {
				usedHours,
				budgetHours,
				percent: Math.min(100, used),
				over: used > 100,
				warning: used >= 80
			};
		} catch {
			// No budget bar; the Details panel still lists the budget.
		}
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
			return;
		}
		const request = { ...this.buildRequest(), projectIds: [projectId] };
		void this.loadHours(request, isCurrent);
		void this.loadContributors(request, isCurrent);
		void this.loadTopTasks(request, isCurrent);
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
						initials: person?.initials || ProjectQuickLookComponent.initialsOf(row.name),
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

	/* ── Helpers ─────────────────────────────────────────────────────────── */

	private static nameOf(person: IEmployee | any): string {
		const user = person?.user || person;
		const parts = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
		return person?.fullName || user?.name || parts || user?.email || '';
	}

	private static initialsOf(name: string): string {
		return (name || '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('');
	}

	private static statusGroupOf(status: string | undefined): ITaskRow['statusGroup'] {
		const value = (status || '').toLowerCase();
		if (CLOSED_STATUSES.has(value)) return 'done';
		if (IN_PROGRESS_STATUSES.has(value)) return 'progress';
		if (value === TaskStatusEnum.BLOCKED) return 'blocked';
		return 'todo';
	}

	private static dueInWords(daysLeft: number | null, isDone: boolean): { key: string; count?: number } {
		const prefix = 'EMPLOYEES_PAGE.VIEW.DUE.';
		if (daysLeft === null) return { key: prefix + 'NONE' };
		if (isDone) return { key: prefix + 'WAS_DUE' };
		if (daysLeft < -1) return { key: prefix + 'OVERDUE_DAYS', count: -daysLeft };
		if (daysLeft === -1) return { key: prefix + 'OVERDUE_DAY' };
		if (daysLeft === 0) return { key: prefix + 'TODAY' };
		if (daysLeft === 1) return { key: prefix + 'TOMORROW' };
		return { key: prefix + 'IN_DAYS', count: daysLeft };
	}

	private static humanize(value?: string): string {
		if (!value) return '';
		const text = value.replace(/[-_]+/g, ' ').trim();
		return text.charAt(0).toUpperCase() + text.slice(1);
	}
}
